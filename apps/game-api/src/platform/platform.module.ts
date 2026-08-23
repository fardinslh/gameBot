import { Module } from '@nestjs/common';
import { BaleAdapter, TelegramAdapter, WebAdapter } from './placeholder.adapters';
import { PlatformRegistry } from './platform.registry';

@Module({
  providers: [BaleAdapter, TelegramAdapter, WebAdapter, PlatformRegistry],
  exports: [PlatformRegistry],
})
export class PlatformModule {}
