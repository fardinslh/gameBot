import { Injectable } from '@nestjs/common';

export interface DevelopmentPlayerContext {
  platform: 'WEB';
  externalUserId: string;
}

@Injectable()
export class PlayerContextService {
  resolve(developmentPlayerHeader?: string): DevelopmentPlayerContext {
    const configured = process.env.DEV_PLAYER_ID ?? 'local-crown-player';
    const candidate = developmentPlayerHeader?.trim() || configured;
    const externalUserId = candidate.slice(0, 100);
    return { platform: 'WEB', externalUserId };
  }
}
