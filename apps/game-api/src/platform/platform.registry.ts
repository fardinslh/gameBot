import { Injectable } from '@nestjs/common';
import type { PlatformAdapter } from '@crown-and-coin/platform';
import type { SupportedPlatform } from '@crown-and-coin/shared';
import { BaleAdapter, TelegramAdapter, WebAdapter } from './placeholder.adapters';

@Injectable()
export class PlatformRegistry {
  private readonly adapters: ReadonlyMap<SupportedPlatform, PlatformAdapter>;

  constructor(bale: BaleAdapter, telegram: TelegramAdapter, web: WebAdapter) {
    this.adapters = new Map<SupportedPlatform, PlatformAdapter>([
      [bale.platform, bale],
      [telegram.platform, telegram],
      [web.platform, web],
    ]);
  }

  get(platform: SupportedPlatform): PlatformAdapter {
    const adapter = this.adapters.get(platform);
    if (!adapter) {
      throw new Error(`No adapter registered for ${platform}`);
    }
    return adapter;
  }
}
