import { Castle, Shield, ShoppingBag, Swords, Users } from 'lucide-react';
import type { Dictionary } from '@/i18n/config';

interface BottomNavigationProps {
  dictionary: Dictionary;
  onComingSoon(section: string): void;
}

export function BottomNavigation({ dictionary: t, onComingSoon }: BottomNavigationProps) {
  const items = [
    { id: 'kingdom', label: t.kingdom, Icon: Castle, active: true },
    { id: 'raid', label: t.raid, Icon: Swords, active: false },
    { id: 'heroes', label: t.heroes, Icon: Shield, active: false },
    { id: 'guild', label: t.guild, Icon: Users, active: false },
    { id: 'shop', label: t.shop, Icon: ShoppingBag, active: false },
  ];

  return (
    <nav className="bottom-navigation" aria-label={t.navLabel}>
      {items.map(({ id, label, Icon, active }) => (
        <button
          aria-current={active ? 'page' : undefined}
          className={active ? 'navigation-item navigation-item--active' : 'navigation-item'}
          data-nav-id={id}
          key={id}
          onClick={active ? undefined : () => onComingSoon(label)}
          type="button"
        >
          <span className="navigation-item__icon"><Icon aria-hidden="true" size={21} /></span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
