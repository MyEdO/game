/**
 * Le coup encaissé hors bataille (#3892) : le héros du groupe, scène lancée, aucune bataille ; l'assaillant par
 * valeur ; le coup résolu par le moteur aux d100 imposés, puis appliqué par le flux réel `applyAttackResult`.
 */
import { expect } from 'vitest';
import { ouvrirLeBanc, type Banc, type EntreesDuBanc } from './banc.testkit';
import { heroDuDuel } from './combatDeTest.testkit';
import { imposerLesD100 } from './battleRng.testkit';
import { battleRng } from './battleRng';
import { applyAttackResult } from './combatFlow';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';
import { resolveMelee } from '../engine/combat';
import type { Combatant, Weapon } from '../engine/types';
import type { Scene } from './monde/scene';

/** Le héros du groupe, `scene` lancée (la scène de fixture, que le noyau n'importe pas), aucune bataille ; l'assaillant,
 *  un combattant par valeur. `reglesMaison` : les règles que le banc charge à son ouverture (`loadRuleOverrides`), qui
 *  efface toute surcharge posée avant lui. */
export function horsBataille(scene: Scene, reglesMaison: EntreesDuBanc['reglesMaison'] = {}): { banc: Banc; H: Combatant; E: Combatant } {
  const banc = ouvrirLeBanc({ reglesMaison });
  banc.setState({ party: [heroDuDuel()] });
  banc.getState().lancerLaScene(scene);
  expect(banc.getState().battle).toBeNull();
  return { banc, H: banc.getState().party[0], E: combattantDeTest({ id: 'assaillant', kind: 'ennemi', label: 'Assaillant' }) };
}

/** Le coup de `attaquant` sur `cible`, résolu par le moteur aux d100 imposés, puis appliqué ; l'arme, celle du héros par défaut. */
export function frapper(banc: Banc, attaquant: Combatant, cible: Combatant, des: number[], arme: Weapon = banc.getState().party[0].weapons[0]) {
  imposerLesD100(...des);
  const res = resolveMelee(attaquant, cible, arme, battleRng());
  applyAttackResult(banc.getState, banc.setState, attaquant, cible, arme, res);
  return res;
}
