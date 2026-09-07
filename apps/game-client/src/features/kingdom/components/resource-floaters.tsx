'use client';

import { useEffect, useState } from 'react';
import type { ResourceAmounts } from '@crown-and-coin/shared';
import type { Dictionary } from '@/i18n/config';
import { formatAmount } from './resource-hud';
import { BidiValue } from '@/i18n/bidi';

interface ResourceFloatersProps {
  gains: ResourceAmounts | null;
  dictionary: Dictionary;
}

interface FloaterItem {
  id: string;
  resource: string;
  amount: string;
  delayMs: number;
}

const RESOURCE_COLORS: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  GOLD: {
    bg: 'linear-gradient(135deg, rgba(245, 197, 24, 0.95), rgba(189, 121, 34, 0.95))',
    text: '#2a1a04',
    border: 'rgba(255, 226, 138, 0.8)',
    glow: 'rgba(245, 197, 24, 0.5)',
  },
  FOOD: {
    bg: 'linear-gradient(135deg, rgba(139, 195, 74, 0.95), rgba(85, 139, 47, 0.95))',
    text: '#112908',
    border: 'rgba(200, 230, 201, 0.8)',
    glow: 'rgba(139, 195, 74, 0.5)',
  },
  WOOD: {
    bg: 'linear-gradient(135deg, rgba(161, 110, 68, 0.95), rgba(109, 76, 46, 0.95))',
    text: '#ffffff',
    border: 'rgba(215, 175, 138, 0.8)',
    glow: 'rgba(161, 110, 68, 0.5)',
  },
  STONE: {
    bg: 'linear-gradient(135deg, rgba(144, 164, 174, 0.95), rgba(84, 110, 122, 0.95))',
    text: '#ffffff',
    border: 'rgba(207, 216, 220, 0.8)',
    glow: 'rgba(144, 164, 174, 0.5)',
  },
};

export function ResourceFloaters({ gains, dictionary: t }: ResourceFloatersProps) {
  const [activeItems, setActiveItems] = useState<FloaterItem[]>([]);

  useEffect(() => {
    if (!gains) return;

    const nonZero = Object.entries(gains).filter(([, value]) => {
      try {
        return BigInt(value) > BigInt(0);
      } catch {
        return false;
      }
    });

    if (nonZero.length === 0) return;

    const items: FloaterItem[] = nonZero.map(([resource, value], idx) => ({
      id: `${resource}-${Date.now()}-${idx}`,
      resource,
      amount: value,
      delayMs: idx * 80,
    }));

    setActiveItems(items);

    const timer = setTimeout(() => {
      setActiveItems([]);
    }, 1_400);

    return () => clearTimeout(timer);
  }, [gains]);

  if (activeItems.length === 0) return null;

  return (
    <div className="resource-floaters-container" aria-hidden="true">
      {activeItems.map((item) => {
        const colors = RESOURCE_COLORS[item.resource] ?? RESOURCE_COLORS.GOLD;
        const resourceName = t.resourceShort[item.resource as keyof typeof t.resourceShort] || item.resource;

        return (
          <div
            key={item.id}
            className="resource-floater"
            style={{
              animationDelay: `${item.delayMs}ms`,
              background: colors.bg,
              color: colors.text,
              borderColor: colors.border,
              boxShadow: `0 4px 14px ${colors.glow}, inset 0 1px 0 rgba(255,255,255,0.4)`,
            }}
          >
            <span className="resource-floater__plus">+</span>
            <BidiValue direction="ltr">{formatAmount(item.amount)}</BidiValue>
            <span className="resource-floater__label">{resourceName}</span>
          </div>
        );
      })}
    </div>
  );
}
