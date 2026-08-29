import { Injectable } from '@nestjs/common';

@Injectable()
export class ArmyClock {
  now(): Date {
    return new Date();
  }
}
