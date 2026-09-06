import { Module } from '@nestjs/common';
import { PlayerModule } from '../player/player.module';
import { GuildController } from './guild.controller';
import { GuildService } from './guild.service';
import { GuildWarController } from './guild-war.controller';
import { GuildWarService } from './guild-war.service';

import { GuildTreasuryController } from './guild-treasury.controller';
import { GuildTreasuryService } from './guild-treasury.service';
import { GuildChatController } from './guild-chat.controller';
import { GuildChatService } from './guild-chat.service';
import { GuildScrimmageController } from './guild-scrimmage.controller';
import { GuildScrimmageService } from './guild-scrimmage.service';

@Module({
  imports: [PlayerModule],
  controllers: [
    GuildWarController,
    GuildScrimmageController,
    GuildTreasuryController,
    GuildChatController,
    GuildController,
  ],
  providers: [GuildService, GuildWarService, GuildTreasuryService, GuildChatService, GuildScrimmageService],
  exports: [GuildService, GuildWarService, GuildTreasuryService, GuildChatService, GuildScrimmageService],
})
export class GuildModule {}
