import { Castle, Shield, ShoppingBag, Swords, Users } from 'lucide-react';
import type { Dictionary } from '@/i18n/config';

interface BottomNavigationProps {
  dictionary: Dictionary;
  activeSection: GameSection;
  onNavigate(section: GameSection): void;
  onComingSoon(section: string): void;
}

export type GameSection = 'kingdom' | 'raid' | 'heroes';

export function BottomNavigation({ dictionary: t, activeSection, onNavigate, onComingSoon }: BottomNavigationProps) {
  const items = [
    { id: 'kingdom', label: t.kingdom, Icon: Castle, enabled: true },
    { id: 'raid', label: t.raid, Icon: Swords, enabled: true },
    { id: 'heroes', label: t.heroes, Icon: Shield, enabled: true },
    { id: 'guild', label: t.guild, Icon: Users, enabled: false },
    { id: 'shop', label: t.shop, Icon: ShoppingBag, enabled: false },
  ];

  return (
    <nav className="bottom-navigation" aria-label={t.navLabel}>
      {items.map(({ id, label, Icon, enabled }) => {
        const active = id === activeSection;
        return (
        <button
          aria-current={active ? 'page' : undefined}
          className={active ? 'navigation-item navigation-item--active' : 'navigation-item'}
          data-nav-id={id}
          key={id}
          onClick={active ? undefined : enabled ? () => onNavigate(id as GameSection) : () => onComingSoon(label)}
          type="button"
        >
          <span className="navigation-item__icon"><Icon aria-hidden="true" size={21} /></span>
          <span>{label}</span>
        </button>
        );
      })}
    </nav>
  );
}
