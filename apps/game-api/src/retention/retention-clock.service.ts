import { Injectable } from '@nestjs/common';

@Injectable()
export class RetentionClock {
  now(): Date {
    return new Date();
  }
}
