import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from '../store';
import { applyMiscast } from '../combatFlow';
import { seedBattleRng } from '../battleRng';
import { avanceEtapeCascade } from '../cascadeTestKit';
import { createHero } from '../../engine/character';
import { summarizeEffects, chipCodex } from '../../gameIso/effectIcons';
import { testScene } from '../../scenes/test-fixture';
import type { Combatant } from '../../engine/types';
import { resetCadence } from '../../engine/cadence';

/**
 * ANCRAGE DE RÈGLE d'un contrecoup — chemin RÉEL (`applyMiscast` → `finishMiscast` → `runCombatFlow`,
 * qui partagent UN `OpsCtx`). L'effet durable posé par « Purifier la chair » (`LDB 40 l.75`) est une
 * pastille du joueur : sans entité SOURCE, elle s'affiche nue (ni fiche, ni popover — arbitrage user
 * 2026-07-18). La source est la RANGÉE tirée, dans la catégorie que sa table déclare en donnée.
 */
describe('Contrecoup — la pastille de l’effet porte SA rangée (LDB 40 l.75)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    resetCadence();
    useGame.setState({ pendingCascade: null, battle: null, pendingLogQueue: [] });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'Mage', seed: 3 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    H.wounds.max = 200; H.wounds.current = 200;
    useGame.setState({ battle: { ...b }, pendingCascade: null, pendingLogQueue: [] });
    return { H };
  }

  const live = (id: string): Combatant => useGame.getState().battle!.combatants.find((x) => x.id === id)!;

  /** Joue la Colère jusqu'au palier `onFailHard` (−4 DR forcé, comme `miscast-test.test.ts`) : c'est là
   *  que la rangée pose l'État ET la cause qui le maintient. */
  function purifierLaChair(): Combatant {
    let seed = -1;
    for (let s = 0; s < 400 && seed < 0; s++) {
      const { H } = setup();
      seedBattleRng(s);
      applyMiscast(useGame.getState, useGame.setState, H, 'colere');
      avanceEtapeCascade(useGame.getState);
      const casc = useGame.getState().pendingCascade;
      const m = casc?.participants.find((p) => p.kind === 'miscast');
      if (m?.outcome?.some((l) => /Purifier la chair/.test(l.text)) && casc?.participants.some((p) => p.kind === 'triggeredTest')) seed = s;
      useGame.setState({ pendingCascade: null });
    }
    expect(seed, 'aucune graine ne produit la rangée 81-87').toBeGreaterThanOrEqual(0);

    const { H } = setup();
    seedBattleRng(seed);
    applyMiscast(useGame.getState, useGame.setState, H, 'colere');
    avanceEtapeCascade(useGame.getState);
    const p0 = useGame.getState().pendingCascade!;
    const idx = p0.participants.findIndex((s) => s.kind === 'triggeredTest');
    const step = p0.participants[idx];
    useGame.setState({
      pendingCascade: { ...p0, participants: p0.participants.map((s, k) => (k === idx ? { ...s, result: { roll: 99, target: step.base ?? 30, sl: -5, success: false } } : s)) },
    });
    useGame.getState().cascadeResolveAll();
    return live(H.id);
  }

  it('la pastille de l’effet nomme la rangée et ouvre SA fiche Codex', () => {
    const h = purifierLaChair();
    const cause = (h.activeEffects ?? []).find((e) => e.opsPerRound);
    expect(cause, 'la cause récurrente est posée').toBeTruthy();
    expect(cause!.source, 'l’ancrage est la RANGÉE, dans la catégorie que sa table déclare')
      .toEqual({ kind: 'miscastWrath', id: 'colere-purifier-la-chair' });

    const chip = summarizeEffects(h.conditions, h.activeEffects).visible
      .find((c) => c.kind === 'buff' && c.source?.id === 'colere-purifier-la-chair');
    expect(chip, 'la pastille de l’effet porte son entité source').toBeTruthy();
    const cible = chipCodex(chip!);
    expect(cible, 'une pastille reliée à aucune règle n’ouvrirait ni fiche ni popover').toBeTruthy();
    expect(cible!.category).toBe('miscastWrath');
    expect(cible!.id, 'le popover ouvre la fiche de LA rangée').toBe('colere-purifier-la-chair');
  });
});
