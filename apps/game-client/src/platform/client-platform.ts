export type ClientPlatform = 'bale' | 'telegram' | 'web';

export interface ClientPlatformContext {
  platform: ClientPlatform;
  launchPayload: string | null;
}

export function readPlatformContext(search: URLSearchParams): ClientPlatformContext {
  const requested = search.get('platform');
  const platform: ClientPlatform = requested === 'bale' || requested === 'telegram' ? requested : 'web';

  return {
    platform,
    launchPayload: search.get('launchPayload'),
  };
}
