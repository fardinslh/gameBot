import { Injectable } from '@nestjs/common';
import type {
  PaymentRequest,
  PaymentResult,
  PlatformAdapter,
  PlatformAuthResult,
  PlatformUser,
} from '@crown-and-coin/platform';
import { UnsupportedPlatformOperationError } from '@crown-and-coin/platform';
import type { SupportedPlatform } from '@crown-and-coin/shared';

abstract class PlaceholderAdapter implements PlatformAdapter {
  abstract readonly platform: SupportedPlatform;

  authenticate(_payload: string): Promise<PlatformAuthResult> {
    return Promise.reject(new UnsupportedPlatformOperationError('authenticate', this.platform));
  }

  getUser(_externalUserId: string): Promise<PlatformUser | null> {
    return Promise.reject(new UnsupportedPlatformOperationError('getUser', this.platform));
  }

  openAppContext(): Promise<Record<string, unknown>> {
    return Promise.resolve({ platform: this.platform, configured: false });
  }

  sendNotification(_externalUserId: string, _message: string): Promise<void> {
    return Promise.reject(new UnsupportedPlatformOperationError('sendNotification', this.platform));
  }

  createPayment(_request: PaymentRequest): Promise<PaymentResult> {
    return Promise.reject(new UnsupportedPlatformOperationError('createPayment', this.platform));
  }
}

@Injectable()
export class BaleAdapter extends PlaceholderAdapter {
  readonly platform = 'BALE' as const;
}

@Injectable()
export class TelegramAdapter extends PlaceholderAdapter {
  readonly platform = 'TELEGRAM' as const;
}

@Injectable()
export class WebAdapter extends PlaceholderAdapter {
  readonly platform = 'WEB' as const;
}
