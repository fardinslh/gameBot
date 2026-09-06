import type { GuildCrest, GuildCrestEmblem } from '@crown-and-coin/shared';
import { Castle, Crown, Flame, Shield, Sparkles, Swords, Zap } from 'lucide-react';

interface GuildCrestProps {
  crest: GuildCrest;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const EMBLEM_ICONS: Record<GuildCrestEmblem, typeof Shield> = {
  shield: Shield,
  crown: Crown,
  swords: Swords,
  lion: Zap,
  eagle: Sparkles,
  dragon: Flame,
  tower: Castle,
  flame: Flame,
};

export function GuildCrestBadge({ crest, size = 'md', className = '' }: GuildCrestProps) {
  const Icon = EMBLEM_ICONS[crest.emblem] ?? Shield;
  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 26 : 18;

  return (
    <div
      className={`guild-crest guild-crest--${size} ${className}`}
      style={{
        background: `linear-gradient(145deg, ${crest.primaryColor}, ${crest.secondaryColor})`,
        borderColor: crest.primaryColor,
      }}
    >
      <Icon aria-hidden="true" size={iconSize} />
    </div>
  );
}
