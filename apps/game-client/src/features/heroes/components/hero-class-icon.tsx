import { Crosshair, ShieldCheck, Sparkles } from 'lucide-react';
import type { HeroCombatClass } from '@crown-and-coin/shared';

interface HeroClassIconProps {
  combatClass: HeroCombatClass;
  size?: number;
}

export function HeroClassIcon({ combatClass, size = 15 }: HeroClassIconProps) {
  if (combatClass === 'TANK') return <ShieldCheck aria-hidden="true" size={size} />;
  if (combatClass === 'SINGLE_TARGET_DPS') return <Crosshair aria-hidden="true" size={size} />;
  return <Sparkles aria-hidden="true" size={size} />;
}

