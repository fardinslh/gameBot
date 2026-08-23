'use client';

import { useEffect, useRef } from 'react';
import type { BattleReplayResponse, BattleSide } from '@crown-and-coin/shared';
import { Assets, Container, Graphics, Sprite } from 'pixi.js';
import { createPixiRuntime } from '@/game/rendering/pixi-runtime';

interface BattleSceneProps { battle: BattleReplayResponse; onComplete(): void; }

export function BattleScene({ battle, onComplete }: BattleSceneProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let cleanup = () => {};
    const completionTimer = window.setTimeout(() => completeRef.current(), battle.durationMs + 450);
    void buildBattle(host, battle).then((destroy) => {
      if (disposed) destroy(); else cleanup = destroy;
    }).catch((error) => console.error('Battle scene initialization failed', error));
    return () => { disposed = true; window.clearTimeout(completionTimer); cleanup(); };
  }, [battle]);

  return <div className="battle-scene" data-battle-id={battle.id} ref={hostRef} aria-label="Auto battle replay" />;
}

async function buildBattle(host: HTMLDivElement, battle: BattleReplayResponse): Promise<() => void> {
  const runtime = await createPixiRuntime(host);
  const { app } = runtime;
  app.canvas.className = 'battle-canvas';
  const background = new Graphics();
  app.stage.addChild(background);
  const units = new Map<string, { container: Container; hp: Graphics; maxHp: number }>();

  for (const hero of [...battle.teams.attacker, ...battle.teams.defender]) {
    const container = new Container();
    const ring = new Graphics().circle(0, 0, 34).fill({ color: hero.side === 'ATTACKER' ? 0x243f32 : 0x48282a, alpha: 0.96 }).stroke({ color: hero.side === 'ATTACKER' ? 0x7fbd8c : 0xcf7772, width: 2 });
    container.addChild(ring);
    const texture = await Assets.load(hero.portraitAsset);
    const portrait = new Sprite(texture);
    portrait.anchor.set(0.5);
    portrait.width = 60;
    portrait.height = 60;
    const mask = new Graphics().circle(0, 0, 30).fill(0xffffff);
    portrait.mask = mask;
    container.addChild(portrait, mask);
    const hp = new Graphics();
    hp.position.set(-31, 39);
    drawHp(hp, 1, hero.side);
    container.addChild(hp);
    app.stage.addChild(container);
    units.set(key(hero.side, hero.slot), { container, hp, maxHp: hero.hp });
  }

  const layout = () => {
    const width = Math.max(host.clientWidth, 1);
    const height = Math.max(host.clientHeight, 1);
    app.renderer.resize(width, height);
    background.clear().rect(0, 0, width, height).fill({ color: 0x182019 }).rect(0, height * .62, width, height * .38).fill({ color: 0x263321 }).moveTo(0, height * .68).lineTo(width, height * .58).stroke({ color: 0x8c7847, alpha: .3, width: 2 });
    for (const hero of [...battle.teams.attacker, ...battle.teams.defender]) {
      const unit = units.get(key(hero.side, hero.slot));
      if (!unit) continue;
      const row = hero.slot - 1;
      const x = hero.side === 'ATTACKER' ? width * (.22 + row * .06) : width * (.78 - row * .06);
      const y = height * (.31 + row * .19);
      unit.container.position.set(x, y);
    }
  };
  layout();
  const observer = new ResizeObserver(layout);
  observer.observe(host);
  const timers: number[] = [];
  const schedule = (callback: () => void, delay: number) => { timers.push(window.setTimeout(callback, delay)); };
  for (const event of battle.events) {
    if (event.type === 'SKILL_CAST' && event.sourceSide && event.sourceSlot) {
      schedule(() => showSkillEffect(app.stage, units, event.sourceSide!, event.sourceSlot!, event.skillKey, schedule), event.timeMs);
    }
    if (event.type === 'DAMAGE' && event.targetSide && event.targetSlot && event.remainingHp !== null) {
      schedule(() => {
        const target = units.get(key(event.targetSide!, event.targetSlot!));
        const source = event.sourceSide && event.sourceSlot ? units.get(key(event.sourceSide, event.sourceSlot)) : null;
        if (target) {
          drawHp(target.hp, event.remainingHp! / target.maxHp, event.targetSide!);
          target.container.alpha = .4;
          schedule(() => { target.container.alpha = event.remainingHp === 0 ? .28 : 1; }, 110);
        }
        if (source) {
          const direction = event.sourceSide === 'ATTACKER' ? 7 : -7;
          source.container.x += direction;
          schedule(() => { source.container.x -= direction; }, 100);
        }
      }, event.timeMs);
    }
  }
  return () => { observer.disconnect(); timers.forEach(window.clearTimeout); runtime.destroy(); };
}

function showSkillEffect(
  stage: Container,
  units: Map<string, { container: Container; hp: Graphics; maxHp: number }>,
  side: BattleSide,
  slot: number,
  skill: string | null,
  schedule: (callback: () => void, delay: number) => void,
): void {
  const source = units.get(key(side, slot));
  if (!source) return;
  const effect = new Graphics();
  if (skill === 'SHIELD_WALL') {
    effect.circle(0, 0, 42).fill({ color: 0xf2c95e, alpha: .14 }).stroke({ color: 0xffdc78, width: 4, alpha: .8 });
  } else if (skill === 'POWER_SHOT') {
    const direction = side === 'ATTACKER' ? 1 : -1;
    effect.moveTo(0, 0).lineTo(direction * 95, 0).stroke({ color: 0xffb457, width: 5, alpha: .9 });
  } else {
    effect.circle(0, 0, 55).fill({ color: 0x7857d8, alpha: .18 }).stroke({ color: 0xa98dff, width: 5, alpha: .75 });
  }
  effect.position.copyFrom(source.container.position);
  stage.addChild(effect);
  schedule(() => { effect.parent?.removeChild(effect); effect.destroy(); }, 360);
}

function drawHp(graphics: Graphics, ratio: number, side: BattleSide): void {
  const width = 62;
  graphics.clear().roundRect(0, 0, width, 7, 3).fill({ color: 0x090b09, alpha: .9 }).roundRect(1, 1, Math.max(0, (width - 2) * Math.max(0, ratio)), 5, 2).fill({ color: side === 'ATTACKER' ? 0x62ba78 : 0xd1625d });
}

function key(side: BattleSide, slot: number): string { return `${side}:${slot}`; }
