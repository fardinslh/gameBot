import type { SupportedPlatform } from '@crown-and-coin/shared';

export interface PlatformUser {
  externalUserId: string;
  displayName?: string;
  username?: string;
}

export interface PlatformAuthResult {
  platform: SupportedPlatform;
  user: PlatformUser;
  verified: boolean;
}

export interface PaymentRequest {
  productId: string;
  amount: number;
  currency: string;
}

export interface PaymentResult {
  externalPaymentId: string;
  status: 'pending' | 'completed' | 'failed';
}

export interface PlatformAdapter {
  readonly platform: SupportedPlatform;
  authenticate(payload: string): Promise<PlatformAuthResult>;
  getUser(externalUserId: string): Promise<PlatformUser | null>;
  openAppContext(): Promise<Record<string, unknown>>;
  sendNotification(externalUserId: string, message: string): Promise<void>;
  createPayment(request: PaymentRequest): Promise<PaymentResult>;
}

export class UnsupportedPlatformOperationError extends Error {
  constructor(operation: string, platform: SupportedPlatform) {
    super(`${operation} is not configured for ${platform}`);
    this.name = 'UnsupportedPlatformOperationError';
  }
}
