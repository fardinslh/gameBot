export const KINGDOM_THEMES = {
  DEFAULT: {
    assetNamespace: 'default',
    label: 'Default',
  },
} as const;

export type KingdomThemeId = keyof typeof KINGDOM_THEMES;

export const DEFAULT_KINGDOM_THEME: KingdomThemeId = 'DEFAULT';

export const PLANNED_KINGDOM_THEME_IDS = [
  'ACHAEMENID',
  'PARTHIAN',
  'SASANIAN',
  'SELJUK',
  'ILKHANID',
  'TIMURID',
  'SAFAVID',
  'ZAND',
  'QAJAR',
] as const;

export type PlannedKingdomThemeId = (typeof PLANNED_KINGDOM_THEME_IDS)[number];
