export const SUPPORTED_PLATFORMS = ['BALE', 'TELEGRAM', 'WEB'] as const;

export type SupportedPlatform = (typeof SUPPORTED_PLATFORMS)[number];

export interface HealthResponse {
  status: 'ok';
}
