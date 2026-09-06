'use client';

import { useEffect } from 'react';
import { Crown, Shield, Trophy, Users } from 'lucide-react';
import type { GuildLeaderboardResponse } from '@crown-and-coin/shared';
import type { Dictionary } from '@/i18n/config';
import { BidiValue } from '@/i18n/bidi';
import { GuildCrestBadge } from './guild-crest';

interface GuildLeaderboardViewProps {
  leaderboard: GuildLeaderboardResponse | null;
  onLoad(): Promise<void>;
  dictionary: Dictionary;
}

export function GuildLeaderboardView({
  leaderboard,
  onLoad,
  dictionary: t,
}: GuildLeaderboardViewProps) {
  useEffect(() => {
    if (!leaderboard) {
      void onLoad();
    }
  }, [leaderboard, onLoad]);

  if (!leaderboard) {
    return (
      <div className="guild-leaderboard-loading">
        <div className="leaderboard-spinner" />
        <p>{t.guildUi.loadingLeaderboard}</p>
      </div>
    );
  }

  const top3 = leaderboard.topGuilds.slice(0, 3);
  const remaining = leaderboard.topGuilds.slice(3);
  const playerGuild = leaderboard.playerGuild;

  return (
    <div className="guild-leaderboard-view">
      {/* Top 3 Podium */}
      {top3.length > 0 ? (
        <div className="guild-podium">
          {/* Rank 2 (Left) */}
          {top3[1] ? (
            <div className="guild-podium-spot guild-podium-spot--2">
              <GuildCrestBadge crest={top3[1].crest} size="md" />
              <div className="guild-podium-spot__rank">#2</div>
              <strong><BidiValue>{top3[1].name}</BidiValue></strong>
              <span><Trophy size={11} /> <BidiValue direction="ltr">{top3[1].score}</BidiValue></span>
              <div className="guild-podium-pedestal" />
            </div>
          ) : <div className="guild-podium-spot" />}

          {/* Rank 1 (Center) */}
          {top3[0] ? (
            <div className="guild-podium-spot guild-podium-spot--1">
              <Crown className="guild-podium-crown" size={24} />
              <GuildCrestBadge crest={top3[0].crest} size="lg" />
              <div className="guild-podium-spot__rank">#1</div>
              <strong><BidiValue>{top3[0].name}</BidiValue></strong>
              <span><Trophy size={12} /> <BidiValue direction="ltr">{top3[0].score}</BidiValue></span>
              <div className="guild-podium-pedestal" />
            </div>
          ) : null}

          {/* Rank 3 (Right) */}
          {top3[2] ? (
            <div className="guild-podium-spot guild-podium-spot--3">
              <GuildCrestBadge crest={top3[2].crest} size="md" />
              <div className="guild-podium-spot__rank">#3</div>
              <strong><BidiValue>{top3[2].name}</BidiValue></strong>
              <span><Trophy size={11} /> <BidiValue direction="ltr">{top3[2].score}</BidiValue></span>
              <div className="guild-podium-pedestal" />
            </div>
          ) : <div className="guild-podium-spot" />}
        </div>
      ) : null}

      {/* Ranks 4-50 List */}
      <div className="guild-leaderboard-list">
        {remaining.map((g) => (
          <div
            key={g.guildId}
            className={`guild-leaderboard-row ${g.isPlayerGuild ? 'guild-leaderboard-row--self' : ''}`}
          >
            <div className="guild-leaderboard-row__rank">
              <strong>#{g.rank}</strong>
            </div>

            <GuildCrestBadge crest={g.crest} size="sm" />

            <div className="guild-leaderboard-row__info">
              <strong><BidiValue>{g.name}</BidiValue></strong>
              <small>
                <Users size={11} /> {g.memberCount}/{g.maxMembers} · {g.tag}
              </small>
            </div>

            <div className="guild-leaderboard-row__score">
              <Trophy size={13} />
              <strong><BidiValue direction="ltr">{g.score}</BidiValue></strong>
            </div>
          </div>
        ))}
      </div>

      {/* Sticky Player Guild Bar */}
      {playerGuild ? (
        <div className="guild-leaderboard-user-bar">
          <div className="guild-leaderboard-user-bar__rank">
            <small>{t.leaderboard.yourRank}</small>
            <strong>#{playerGuild.rank}</strong>
          </div>
          <GuildCrestBadge crest={playerGuild.crest} size="sm" />
          <div className="guild-leaderboard-user-bar__info">
            <strong><BidiValue>{playerGuild.name}</BidiValue></strong>
            <small>{playerGuild.tag} · {playerGuild.memberCount}/{playerGuild.maxMembers}</small>
          </div>
          <div className="guild-leaderboard-user-bar__score">
            <Trophy size={13} />
            <strong><BidiValue direction="ltr">{playerGuild.score}</BidiValue></strong>
          </div>
        </div>
      ) : null}
    </div>
  );
}
