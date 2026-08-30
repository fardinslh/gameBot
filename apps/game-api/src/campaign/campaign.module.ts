import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ArmyModule } from '../army/army.module';
import { EconomyModule } from '../economy/economy.module';
import { PlayerModule } from '../player/player.module';
import { RaidModule } from '../raid/raid.module';
import { CampaignController } from './campaign.controller';
import { CampaignNpcService } from './campaign-npc.service';
import { CampaignService } from './campaign.service';

@Module({
  imports: [AnalyticsModule, ArmyModule, EconomyModule, PlayerModule, RaidModule],
  controllers: [CampaignController],
  providers: [CampaignService, CampaignNpcService],
  exports: [CampaignService],
})
export class CampaignModule {}
