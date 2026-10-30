import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { applyMiscast } from '../combatFlow';
import { seedBattleRng } from '../battleRng';
import { avanceEtapeCascade } from '../cascade.testkit';
import { createHero } from '../../engine/character';
import { summarizeEffects, chipCodex } from '../../gameIso/effectIcons';
import { testScene } from '../../scenes/test-fixture';
import type { Combatant } from '../../engine/types';
import { blessuresDeBase } from '../../engine/characteristics';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * ANCRAGE DE RÈGLE d'un contrecoup — chemin RÉEL (`applyMiscast` → `finishMiscast` → `runCombatFlow`,
 * qui partagent UN `OpsCtx`). L'effet durable posé par « Purifier la chair » (`LDB 40 l.75`) est une
 * pastille du joueur : sans entité SOURCE, elle s'affiche nue (ni fiche, ni popover — arbitrage user
 * 2026-07-18). La source est la RANGÉE tirée, dans la catégorie que sa table déclare en donnée.
 */
describe('Contrecoup — la pastille de l’effet porte SA rangée (LDB 40 l.75)', () => {
  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'Mage', seed: 3 });
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().confirmRoundStart();
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    H.wounds = blessuresDeBase(200);
    banc.setState({ battle: { ...b }, pendingCascade: null, pendingLogQueue: [] });
    return { H };
  }

  const live = (id: string): Combatant => banc.getState().battle!.combatants.find((x) => x.id === id)!;

  /** Joue la Colère jusqu'au palier `onFailHard` (−4 DR forcé, comme `miscast-test.hors-store.test.ts`) : c'est là
   *  que la rangée pose l'État ET la cause qui le maintient. */
  function purifierLaChair(): Combatant {
    let seed = -1;
    for (let s = 0; s < 400 && seed < 0; s++) {
      const { H } = setup();
      seedBattleRng(s);
      applyMiscast(banc.getState, banc.setState, H, 'colere');
      avanceEtapeCascade(banc.getState);
      const casc = banc.getState().pendingCascade;
      const m = casc?.participants.find((p) => p.kind === 'miscast');
      if (m?.outcome?.some((l) => /Purifier la chair/.test(l.text)) && casc?.participants.some((p) => p.kind === 'triggeredTest')) seed = s;
      banc.setState({ pendingCascade: null });
    }
    expect(seed, 'aucune graine ne produit la rangée 81-87').toBeGreaterThanOrEqual(0);

    const { H } = setup();
    seedBattleRng(seed);
    applyMiscast(banc.getState, banc.setState, H, 'colere');
    avanceEtapeCascade(banc.getState);
    const p0 = banc.getState().pendingCascade!;
    const idx = p0.participants.findIndex((s) => s.kind === 'triggeredTest');
    const step = p0.participants[idx];
    banc.setState({
      pendingCascade: { ...p0, participants: p0.participants.map((s, k) => (k === idx ? { ...s, result: { roll: 99, target: step.base ?? 30, sl: -5, success: false } } : s)) },
    });
    banc.getState().cascadeResolveAll();
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
