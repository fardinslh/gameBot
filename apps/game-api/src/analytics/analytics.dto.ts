import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CLIENT_ANALYTICS_EVENTS, MAX_ANALYTICS_BATCH_SIZE } from './analytics.events';

export class ClientAnalyticsEventDto {
  @IsUUID() eventId!: string;
  @IsIn(CLIENT_ANALYTICS_EVENTS) eventName!: (typeof CLIENT_ANALYTICS_EVENTS)[number];
  @IsUUID() sessionId!: string;
  @IsOptional() @IsString() @MaxLength(16) locale?: string;
  @IsOptional() @IsString() @MaxLength(50) appVersion?: string;
  @IsOptional() @IsString() @MaxLength(100) acquisitionSource?: string;
  @IsOptional() @IsObject() properties?: Record<string, unknown>;
  @IsOptional() @IsDateString() clientOccurredAt?: string;
}

export class AnalyticsEventsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ANALYTICS_BATCH_SIZE)
  @ValidateNested({ each: true })
  @Type(() => ClientAnalyticsEventDto)
  events!: ClientAnalyticsEventDto[];
}
