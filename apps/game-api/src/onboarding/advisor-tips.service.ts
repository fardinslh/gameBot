import { BadRequestException, Injectable } from '@nestjs/common';
import { ADVISOR_TIP_KEYS, type AdvisorTipKey, type AdvisorTipsResponse } from '@crown-and-coin/shared';
import { PrismaService } from '../infrastructure/prisma/prisma.service';

@Injectable()
export class AdvisorTipsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(playerId: string): Promise<AdvisorTipsResponse> {
    const rows = await this.prisma.advisorTipProgress.findMany({ where: { playerId }, select: { tipKey: true } });
    return { seen: rows.map((row) => row.tipKey).filter(isAdvisorTipKey) };
  }

  async dismiss(playerId: string, tipKey: string): Promise<AdvisorTipsResponse> {
    if (!isAdvisorTipKey(tipKey)) throw new BadRequestException('Unknown advisor tip.');
    await this.prisma.advisorTipProgress.upsert({
      where: { playerId_tipKey: { playerId, tipKey } },
      create: { playerId, tipKey },
      update: { seenAt: new Date() },
    });
    return this.get(playerId);
  }
}

function isAdvisorTipKey(value: string): value is AdvisorTipKey {
  return (ADVISOR_TIP_KEYS as readonly string[]).includes(value);
}
