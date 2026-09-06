import { Crown, Flame, Gem, Shield, Trophy } from 'lucide-react';
import type { TrophyLeague } from '@crown-and-coin/shared';
import { LEAGUE_CONFIGS } from '@crown-and-coin/shared';
import type { Dictionary } from '@/i18n/config';

interface LeagueBadgeProps {
  league: TrophyLeague;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  dictionary?: Dictionary;
  className?: string;
}

export function LeagueBadge({ league, size = 'md', showName = false, dictionary, className = '' }: LeagueBadgeProps) {
  const config = LEAGUE_CONFIGS[league] ?? LEAGUE_CONFIGS.BRONZE;
  const leagueName = dictionary?.leagues[league.toLowerCase() as keyof typeof dictionary.leagues] ?? league;

  const renderIcon = () => {
    const iconSize = size === 'sm' ? 12 : size === 'lg' ? 22 : 15;
    switch (league) {
      case 'CHAMPION':
        return <Trophy size={iconSize} />;
      case 'MASTER':
        return <Flame size={iconSize} />;
      case 'CRYSTAL':
        return <Gem size={iconSize} />;
      case 'GOLD':
        return <Crown size={iconSize} />;
      case 'SILVER':
      case 'BRONZE':
      default:
        return <Shield size={iconSize} />;
    }
  };

  return (
    <span
      className={`league-badge league-badge--${league.toLowerCase()} league-badge--${size} ${className}`}
      style={{
        '--league-color': config.badgeColor,
        '--league-accent': config.badgeAccent,
      } as React.CSSProperties}
      title={leagueName}
    >
      <span className="league-badge__icon" aria-hidden="true">
        {renderIcon()}
      </span>
      {showName ? <strong className="league-badge__label">{leagueName}</strong> : null}
    </span>
  );
}
