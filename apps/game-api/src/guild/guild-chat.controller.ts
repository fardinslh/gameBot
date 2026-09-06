import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
} from '@nestjs/common';
import type {
  GuildChatFeedResponse,
  GuildChatMessageItem,
  GuildWarCalloutItem,
  WarRoomStrategyResponse,
} from '@crown-and-coin/shared';
import { PlayerContextService } from '../player/player-context.service';
import {
  SendGuildChatMessageDto,
  SetWarCalloutDto,
} from './guild-chat.dto';
import { GuildChatService } from './guild-chat.service';

@Controller('guilds')
export class GuildChatController {
  constructor(
    private readonly chat: GuildChatService,
    private readonly playerContext: PlayerContextService,
  ) {}

  @Get('chat/feed')
  async getChatFeed(
    @Headers('x-dev-player-id') player?: string,
    @Query('limit') limit?: string,
  ): Promise<GuildChatFeedResponse> {
    const playerId = await this.chat.resolvePlayerId(this.playerContext.resolve(player));
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.chat.getChatFeed(playerId, isNaN(parsedLimit) ? 50 : parsedLimit);
  }

  @Post('chat/messages')
  async sendMessage(
    @Headers('x-dev-player-id') player: string | undefined,
    @Body() dto: SendGuildChatMessageDto,
  ): Promise<GuildChatMessageItem> {
    const playerId = await this.chat.resolvePlayerId(this.playerContext.resolve(player));
    return this.chat.sendMessage(playerId, dto);
  }

  @Get('war/strategy')
  async getWarRoomStrategy(
    @Headers('x-dev-player-id') player?: string,
  ): Promise<WarRoomStrategyResponse> {
    const playerId = await this.chat.resolvePlayerId(this.playerContext.resolve(player));
    return this.chat.getWarRoomStrategy(playerId);
  }

  @Post('war/callout')
  async setWarCallout(
    @Headers('x-dev-player-id') player: string | undefined,
    @Body() dto: SetWarCalloutDto,
  ): Promise<GuildWarCalloutItem> {
    const playerId = await this.chat.resolvePlayerId(this.playerContext.resolve(player));
    return this.chat.setWarCallout(playerId, dto);
  }
}
