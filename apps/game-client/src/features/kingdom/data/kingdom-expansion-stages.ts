import type { KingdomExpansionStage } from '@crown-and-coin/shared';
import type { BuildingId } from '../domain/kingdom-types';

export type ExpansionEnvironmentKind = 'DEFENSIVE_FRONTIER' | 'SCHOLARLY_TERRACE' | 'ENGINEERING_YARD' | 'FORGE_YARD';

export interface KingdomExpansionPresentation {
  stage: Exclude<KingdomExpansionStage, 1>;
  buildingId: Extract<BuildingId, 'watchtower' | 'academy' | 'workshop' | 'blacksmith'>;
  castleLevel: number;
  groundX: number;
  groundY: number;
  scale: number;
  environment: ExpansionEnvironmentKind;
  revealDurationMs: number;
}

export const KINGDOM_EXPANSION_STAGES: Readonly<Record<KingdomExpansionStage, KingdomExpansionPresentation | null>> = {
  1: null,
  2: { stage: 2, buildingId: 'watchtower', castleLevel: 2, groundX: 552, groundY: 300, scale: .76, environment: 'DEFENSIVE_FRONTIER', revealDurationMs: 900 },
  3: { stage: 3, buildingId: 'academy', castleLevel: 3, groundX: 410, groundY: 420, scale: .84, environment: 'SCHOLARLY_TERRACE', revealDurationMs: 980 },
  4: { stage: 4, buildingId: 'workshop', castleLevel: 4, groundX: 335, groundY: 170, scale: .78, environment: 'ENGINEERING_YARD', revealDurationMs: 940 },
  5: { stage: 5, buildingId: 'blacksmith', castleLevel: 5, groundX: 88, groundY: 165, scale: .84, environment: 'FORGE_YARD', revealDurationMs: 1_020 },
};

export const KINGDOM_EXPANSION_PRESENTATIONS = Object.values(KINGDOM_EXPANSION_STAGES)
  .filter((stage): stage is KingdomExpansionPresentation => stage !== null);

export const EXPANSION_PRESENTATION_BY_BUILDING = Object.fromEntries(
  KINGDOM_EXPANSION_PRESENTATIONS.map((stage) => [stage.buildingId, stage]),
) as Readonly<Partial<Record<BuildingId, KingdomExpansionPresentation>>>;
