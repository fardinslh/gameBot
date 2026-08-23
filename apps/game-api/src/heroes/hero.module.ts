import { Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module';
import { PlayerModule } from '../player/player.module';
import { HeroController } from './hero.controller';
import { HeroService } from './hero.service';

@Module({
  imports: [EconomyModule, PlayerModule],
  controllers: [HeroController],
  providers: [HeroService],
  exports: [HeroService],
})
export class HeroModule {}
