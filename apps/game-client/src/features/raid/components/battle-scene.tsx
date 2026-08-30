'use client';

import { useEffect, useRef } from 'react';
import type { BattleReplayResponse, BattleSide, HeroKey, TroopType } from '@crown-and-coin/shared';
import { Assets, Container, Graphics, Sprite } from 'pixi.js';
import { createPixiRuntime } from '@/game/rendering/pixi-runtime';
import { useGameAudio } from '@/features/audio/audio-provider';
import { sfxForBattleEvent } from '@/features/audio/battle-audio';
import type { SfxKey } from '@/features/audio/audio-manager';

interface BattleSceneProps { battle: BattleReplayResponse; onComplete(): void; }
interface VisualActor {
  side: BattleSide; slot: 1 | 2 | 3; maxHp: number; initialUnits: number; commanderKey: HeroKey;
  commanderPortrait: string; troopType: TroopType | null; troopAsset: string;
}
interface VisualUnit { container: Container; hp: Graphics; maxHp: number; figures: Sprite[]; initialUnits: number; }
const TROOP_ASSET: Record<TroopType, string> = { INFANTRY: '/assets/troops/infantry.webp', ARCHER: '/assets/troops/archer.webp', CAVALRY: '/assets/troops/cavalry.webp' };

export function BattleScene({ battle, onComplete }: BattleSceneProps) {
  const { playSfx } = useGameAudio();
  const hostRef = useRef<HTMLDivElement>(null);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let cleanup = () => {};
    const completionTimer = window.setTimeout(() => completeRef.current(), battle.durationMs + 450);
    void buildBattle(host, battle, playSfx).then((destroy) => { if (disposed) destroy(); else cleanup = destroy; }).catch((error) => console.error('Battle scene initialization failed', error));
    return () => { disposed = true; window.clearTimeout(completionTimer); cleanup(); };
  }, [battle, playSfx]);
  return <div className="battle-scene" data-battle-id={battle.id} data-rules-version={battle.rulesVersion} ref={hostRef} aria-label="Auto battle replay" />;
}

async function buildBattle(host: HTMLDivElement, battle: BattleReplayResponse, playSfx: (key: SfxKey) => void): Promise<() => void> {
  const runtime = await createPixiRuntime(host);
  const { app } = runtime;
  app.canvas.className = 'battle-canvas';
  const background = new Graphics();
  app.stage.addChild(background);
  const actors = battleActors(battle);
  const units = new Map<string, VisualUnit>();

  for (const actor of actors) {
    const container = new Container();
    const sideColor = actor.side === 'ATTACKER' ? 0x79b785 : 0xc66b65;
    const base = new Graphics().ellipse(0, 25, actor.troopType ? 43 : 34, 14).fill({ color: 0x050706, alpha: .58 }).stroke({ color: sideColor, width: 1, alpha: .6 });
    container.addChild(base);
    const figures: Sprite[] = [];
    if (actor.troopType) {
      const texture = await Assets.load(actor.troopAsset);
      const positions = [[-25, 4], [-9, -7], [8, 1], [24, -8], [0, 15]];
      for (let index = 0; index < positions.length; index += 1) {
        const figure = new Sprite(texture);
        figure.anchor.set(.5, 1);
        figure.position.set(positions[index][0], positions[index][1] + 30);
        figure.height = actor.troopType === 'CAVALRY' ? 55 : 51;
        figure.scale.x = figure.scale.y;
        figure.zIndex = positions[index][1];
        figures.push(figure);
        container.addChild(figure);
      }
      container.sortableChildren = true;
      const commanderTexture = await Assets.load(actor.commanderPortrait);
      const medallion = new Graphics().circle(31, -23, 12).fill({ color: 0x11140f }).stroke({ color: 0xe1b952, width: 2 });
      const portrait = new Sprite(commanderTexture);
      portrait.anchor.set(.5); portrait.position.set(31, -23); portrait.width = 20; portrait.height = 20;
      const mask = new Graphics().circle(31, -23, 10).fill(0xffffff); portrait.mask = mask;
      container.addChild(medallion, portrait, mask);
    } else {
      const texture = await Assets.load(actor.troopAsset);
      const portrait = new Sprite(texture); portrait.anchor.set(.5); portrait.width = 60; portrait.height = 60;
      const mask = new Graphics().circle(0, 0, 30).fill(0xffffff); portrait.mask = mask;
      container.addChild(portrait, mask);
    }
    const hp = new Graphics(); hp.position.set(-34, 39); drawHp(hp, 1, actor.side); container.addChild(hp);
    app.stage.addChild(container);
    units.set(key(actor.side, actor.slot), { container, hp, maxHp: actor.maxHp, figures, initialUnits: actor.initialUnits });
  }

  const layout = () => {
    const width = Math.max(host.clientWidth, 1), height = Math.max(host.clientHeight, 1);
    app.renderer.resize(width, height);
    background.clear().rect(0, 0, width, height).fill({ color: 0x151b16 }).rect(0, 0, width, height * .5).fill({ color: 0x202821 }).moveTo(width / 2, 0).lineTo(width / 2, height).stroke({ color: 0xc7a45a, alpha: .18, width: 2 });
    for (const actor of actors) {
      const unit = units.get(key(actor.side, actor.slot)); if (!unit) continue;
      unit.container.position.set(actor.side === 'ATTACKER' ? width * .24 : width * .76, height * (.21 + (actor.slot - 1) * .29));
    }
  };
  layout();
  const observer = new ResizeObserver(layout); observer.observe(host);
  const timers: number[] = [];
  const schedule = (callback: () => void, delay: number) => { timers.push(window.setTimeout(callback, delay)); };
  for (const event of battle.events) {
    const sourceActor = event.sourceSide && event.sourceSlot ? actors.find((actor) => actor.side === event.sourceSide && actor.slot === event.sourceSlot) : undefined;
    for (const sound of sfxForBattleEvent(event, sourceActor?.commanderKey)) schedule(() => playSfx(sound), event.timeMs);
    if (event.type === 'SKILL_CAST' && event.sourceSide && event.sourceSlot) schedule(() => showSkillEffect(app.stage, units, event.sourceSide!, event.sourceSlot!, event.skillKey, schedule), event.timeMs);
    if (event.type === 'DAMAGE' && event.targetSide && event.targetSlot && event.remainingHp !== null) schedule(() => {
      const target = units.get(key(event.targetSide!, event.targetSlot!));
      const source = event.sourceSide && event.sourceSlot ? units.get(key(event.sourceSide, event.sourceSlot)) : null;
      if (target) {
        drawHp(target.hp, event.remainingHp! / target.maxHp, event.targetSide!);
        const visibleFigures = event.remainingUnits == null ? target.figures.length : Math.ceil(target.figures.length * event.remainingUnits / target.initialUnits);
        target.figures.forEach((figure, index) => { figure.alpha = index < visibleFigures ? 1 : .12; });
        target.container.alpha = .45; schedule(() => { target.container.alpha = event.remainingHp === 0 ? .27 : 1; }, 120);
      }
      if (source) { const direction = event.sourceSide === 'ATTACKER' ? 8 : -8; source.container.x += direction; schedule(() => { source.container.x -= direction; }, 100); }
    }, event.timeMs);
  }
  return () => { observer.disconnect(); timers.forEach(window.clearTimeout); runtime.destroy(); };
}

function battleActors(battle: BattleReplayResponse): VisualActor[] {
  if (battle.rulesVersion === 2) return [...battle.armies.attacker, ...battle.armies.defender].map((squad) => ({
    side: squad.side, slot: squad.slot, maxHp: squad.aggregateMaxHp, initialUnits: squad.initialUnitCount,
    commanderKey: squad.commanderKey, commanderPortrait: squad.commanderPortraitAsset, troopType: squad.troopType, troopAsset: TROOP_ASSET[squad.troopType],
  }));
  return [...battle.teams.attacker, ...battle.teams.defender].map((hero) => ({
    side: hero.side, slot: hero.slot, maxHp: hero.hp, initialUnits: 1, commanderKey: hero.key,
    commanderPortrait: hero.portraitAsset, troopType: null, troopAsset: hero.portraitAsset,
  }));
}

function showSkillEffect(stage: Container, units: Map<string, VisualUnit>, side: BattleSide, slot: number, skill: string | null, schedule: (callback: () => void, delay: number) => void): void {
  const source = units.get(key(side, slot)); if (!source) return;
  const effect = new Graphics();
  if (skill === 'SHIELD_WALL') effect.circle(0, 0, 48).fill({ color: 0xf2c95e, alpha: .14 }).stroke({ color: 0xffdc78, width: 4, alpha: .8 });
  else if (skill === 'POWER_SHOT') effect.moveTo(0, 0).lineTo(side === 'ATTACKER' ? 110 : -110, 0).stroke({ color: 0xffb457, width: 5, alpha: .9 });
  else effect.circle(0, 0, 60).fill({ color: 0x7857d8, alpha: .18 }).stroke({ color: 0xa98dff, width: 5, alpha: .75 });
  effect.position.copyFrom(source.container.position); stage.addChild(effect); schedule(() => { effect.parent?.removeChild(effect); effect.destroy(); }, 360);
}

function drawHp(graphics: Graphics, ratio: number, side: BattleSide): void {
  const width = 68;
  graphics.clear().roundRect(0, 0, width, 7, 3).fill({ color: 0x090b09, alpha: .9 }).roundRect(1, 1, Math.max(0, (width - 2) * Math.max(0, ratio)), 5, 2).fill({ color: side === 'ATTACKER' ? 0x62ba78 : 0xd1625d });
}
function key(side: BattleSide, slot: number): string { return `${side}:${slot}`; }
