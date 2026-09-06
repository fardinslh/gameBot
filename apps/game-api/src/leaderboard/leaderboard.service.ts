import { Injectable } from '@nestjs/common';
import {
  type LeaderboardEntry,
  type LeaderboardResponse,
  type LeaderboardSeasonInfo,
  type ProfileCrestKey,
  resolveLeagueFromTrophies,
} from '@crown-and-coin/shared';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import type { DevelopmentPlayerContext } from '../player/player-context.service';

const TOP_PLAYERS_LIMIT = 50;
const SEASON_DURATION_MS = 14 * 24 * 60 * 60 * 1000; // 14-day seasons
const SEASON_EPOCH = new Date('2026-08-01T00:00:00Z').getTime();

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getLeaderboard(context: DevelopmentPlayerContext): Promise<LeaderboardResponse> {
    const account = await this.prisma.platformAccount.findUnique({
      where: {
        platform_externalUserId: {
          platform: 'WEB',
          externalUserId: context.externalUserId,
        },
      },
      select: { playerId: true },
    });
    const requestingPlayerId = account?.playerId;

    const topPlayersRaw = await this.prisma.player.findMany({
      where: {
        OR: [
          { isSystemOpponent: false },
          { systemOpponentKind: 'RAID' },
        ],
      },
      take: TOP_PLAYERS_LIMIT,
      orderBy: [
        { trophies: 'desc' },
        { createdAt: 'asc' },
      ],
      select: {
        id: true,
        displayName: true,
        trophies: true,
        isSystemOpponent: true,
        equippedProfileCrest: true,
        kingdom: {
          select: {
            level: true,
            buildings: {
              where: { type: 'CASTLE' },
              select: { level: true },
            },
          },
        },
      },
    });

    let currentPlayerEntry: LeaderboardEntry | null = null;
    const topPlayers: LeaderboardEntry[] = topPlayersRaw.map((p, index) => {
      const castleLevel = p.kingdom?.buildings[0]?.level ?? p.kingdom?.level ?? 1;
      const league = resolveLeagueFromTrophies(p.trophies);
      const isCurrentPlayer = p.id === requestingPlayerId;
      const entry: LeaderboardEntry = {
        rank: index + 1,
        playerId: p.id,
        displayName: p.displayName ?? (p.isSystemOpponent ? 'Frontier Champion' : 'Warden of Dawnkeep'),
        castleLevel,
        trophies: p.trophies,
        league,
        profileCrest: (p.equippedProfileCrest as ProfileCrestKey) ?? 'DEFAULT',
        isCurrentPlayer,
      };
      if (isCurrentPlayer) {
        currentPlayerEntry = entry;
      }
      return entry;
    });

    if (!currentPlayerEntry && requestingPlayerId) {
      const requestingPlayer = await this.prisma.player.findUnique({
        where: { id: requestingPlayerId },
        select: {
          id: true,
          displayName: true,
          trophies: true,
          createdAt: true,
          equippedProfileCrest: true,
          kingdom: {
            select: {
              level: true,
              buildings: {
                where: { type: 'CASTLE' },
                select: { level: true },
              },
            },
          },
        },
      });

      if (requestingPlayer) {
        const higherCount = await this.prisma.player.count({
          where: {
            AND: [
              {
                OR: [
                  { isSystemOpponent: false },
                  { systemOpponentKind: 'RAID' },
                ],
              },
              {
                OR: [
                  { trophies: { gt: requestingPlayer.trophies } },
                  {
                    trophies: requestingPlayer.trophies,
                    createdAt: { lt: requestingPlayer.createdAt },
                  },
                ],
              },
            ],
          },
        });

        currentPlayerEntry = {
          rank: higherCount + 1,
          playerId: requestingPlayer.id,
          displayName: requestingPlayer.displayName ?? 'Warden of Dawnkeep',
          castleLevel: requestingPlayer.kingdom?.buildings[0]?.level ?? requestingPlayer.kingdom?.level ?? 1,
          trophies: requestingPlayer.trophies,
          league: resolveLeagueFromTrophies(requestingPlayer.trophies),
          profileCrest: (requestingPlayer.equippedProfileCrest as ProfileCrestKey) ?? 'DEFAULT',
          isCurrentPlayer: true,
        };
      }
    }

    const now = Date.now();
    const activeSeason = await this.prisma.season.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { seasonNumber: 'desc' },
    });

    let season: LeaderboardSeasonInfo;
    if (activeSeason) {
      const endsAtMs = activeSeason.endsAt.getTime();
      const daysRemaining = Math.max(1, Math.ceil((endsAtMs - now) / (24 * 60 * 60 * 1000)));
      season = {
        seasonId: activeSeason.id,
        name: activeSeason.name,
        endsAt: activeSeason.endsAt.toISOString(),
        daysRemaining,
      };
    } else {
      const elapsedSinceEpoch = Math.max(0, now - SEASON_EPOCH);
      const seasonNumber = Math.floor(elapsedSinceEpoch / SEASON_DURATION_MS) + 1;
      const seasonEndMs = SEASON_EPOCH + seasonNumber * SEASON_DURATION_MS;
      const daysRemaining = Math.max(1, Math.ceil((seasonEndMs - now) / (24 * 60 * 60 * 1000)));

      season = {
        seasonId: `season-${seasonNumber}`,
        name: `Season ${seasonNumber}`,
        endsAt: new Date(seasonEndMs).toISOString(),
        daysRemaining,
      };
    }

    return {
      topPlayers,
      currentPlayer: currentPlayerEntry,
      season,
      serverTime: new Date().toISOString(),
    };
  }
}
