/**
 * Pilote du chemin RÉEL de la rangée 81-87 de la Colère des dieux (« Purifier la chair », `LDB 40 l.75`) :
 * `applyMiscast` → `finishMiscast` → `runCombatFlow`, palier `onFailHard` atteint par un Test de
 * Résistance forcé à −5 DR.
 */
import { expect } from 'vitest';
import type { Banc } from '../banc.testkit';
import { applyMiscast } from '../combatFlow';
import { seedBattleRng } from '../battleRng';
import { avanceEtapeCascade } from '../cascade.testkit';
import type { Combatant } from '../../engine/types';

/** Joue la Colère des dieux sur le héros que `preparer` remet en combat, avec la première graine de
 *  `battleRng` qui tire la rangée, jusqu'au palier `onFailHard` ; rend le héros vivant du combat. */
export function jouerPurifierLaChair(banc: Banc, preparer: () => Combatant): Combatant {
  let graine = -1;
  for (let s = 0; s < 400 && graine < 0; s++) {
    const H = preparer();
    seedBattleRng(s);
    applyMiscast(banc.getState, banc.setState, H, 'colere');
    avanceEtapeCascade(banc.getState);
    const casc = banc.getState().pendingCascade;
    const m = casc?.participants.find((p) => p.kind === 'incantationImparfaite');
    if (m?.outcome?.some((l) => /Purifier la chair/.test(l.text)) && casc?.participants.some((p) => p.kind === 'testDeclenche')) graine = s;
    banc.setState({ pendingCascade: null });
  }
  expect(graine, 'aucune graine ne produit la rangée 81-87').toBeGreaterThanOrEqual(0);

  const H = preparer();
  seedBattleRng(graine);
  applyMiscast(banc.getState, banc.setState, H, 'colere');
  avanceEtapeCascade(banc.getState);
  const p0 = banc.getState().pendingCascade!;
  const idx = p0.participants.findIndex((s) => s.kind === 'testDeclenche');
  const step = p0.participants[idx];
  banc.setState({
    pendingCascade: { ...p0, participants: p0.participants.map((s, k) => (k === idx ? { ...s, result: { roll: 99, target: step.base ?? 30, sl: -5, success: false } } : s)) },
  });
  banc.getState().jetLancer('cascade');
  return banc.getState().battle!.combatants.find((x) => x.id === H.id)!;
}
