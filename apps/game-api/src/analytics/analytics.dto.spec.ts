import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ValidationPipe } from '@nestjs/common';
import { AnalyticsEventsDto } from './analytics.dto';

const valid = () => ({ eventId: crypto.randomUUID(), eventName: 'app_open', sessionId: crypto.randomUUID(), properties: {} });

describe('AnalyticsEventsDto', () => {
  it('accepts a bounded client event batch', async () => {
    expect(await validate(plainToInstance(AnalyticsEventsDto, { events: [valid()] }))).toHaveLength(0);
  });

  it('rejects server-only names and oversized batches', async () => {
    const serverEvent = plainToInstance(AnalyticsEventsDto, { events: [{ ...valid(), eventName: 'raid_win' }] });
    const oversized = plainToInstance(AnalyticsEventsDto, { events: Array.from({ length: 21 }, valid) });
    expect(await validate(serverEvent)).not.toHaveLength(0);
    expect(await validate(oversized)).not.toHaveLength(0);
  });

  it('accepts client onboarding presentation events but rejects server-owned completion', async () => {
    const started = plainToInstance(AnalyticsEventsDto, { events: [{ ...valid(), eventName: 'onboarding_started' }] });
    const seen = plainToInstance(AnalyticsEventsDto, { events: [{ ...valid(), eventName: 'onboarding_step_seen' }] });
    const completed = plainToInstance(AnalyticsEventsDto, { events: [{ ...valid(), eventName: 'onboarding_completed' }] });
    expect(await validate(started)).toHaveLength(0);
    expect(await validate(seen)).toHaveLength(0);
    expect(await validate(completed)).not.toHaveLength(0);
  });

  it('strips a client-supplied playerId before controller handling', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const transformed = await pipe.transform({ events: [{ ...valid(), playerId: 'forged-player' }] }, {
      type: 'body', metatype: AnalyticsEventsDto,
    });
    expect((transformed.events[0] as unknown as Record<string, unknown>).playerId).toBeUndefined();
  });
});
