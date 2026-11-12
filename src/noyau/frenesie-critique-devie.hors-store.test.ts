import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { lancerLeScenario } from './lancementDeScenario';
import { lancementDuScenario } from '../scenes/test-scenarios/_shared';
import { testScenarios } from '../scenes/test-scenarios';
import { applyEffects, nePeutPasDifferer } from './combatEffects';
import { etatDeTourNeuf } from './combatFlow';
import { opPsy } from '../engine/psych/opsPsy';
import { makeRNG } from '../engine/dice';
import { openAttackCascade } from './combatFlow';
import { avanceEtapeCascade } from './cascade.testkit';
import { resetRule, setRule } from '../engine/policy';
import type { Combatant } from '../engine/types';

// LDB 21 l.33 — la Frénésie avec un Coup Critique dévié au jet 1, puis le balayage (Frappe mortelle).
const H = 'soldat-de-test';
let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });
const g = () => banc.getState();
const relu = (id: string): Combatant => g().battle!.combatants.find((c) => c.id === id)!;

/** Seed dont le premier d100 est un double bas (11) : Coup Critique au jet 1 (`previewRoll`, lecture pure). */
const seedDuCritique = (): number => {
  for (let s = 1; s < 100_000; s++) if (makeRNG(s).int(1, 100) === 11) return s;
  throw new Error('aucun seed à 11');
};

/** La défense de `id`, tenue par le siège MJ, se joue et échoue (97). */
const defenseEchoue = (id: string) => {
  expect(g().pendingDefense?.defenderId).toBe(id);
  g().jetLancer('defense');
  g().jetImposerLeResultat('defense', 97);
  g().jetValider('defense');
};

function monte() {
  lancerLeScenario(banc.getState, banc.setState, lancementDuScenario(testScenarios.find((sc) => sc.id === 'entrainement')!, idsDeTest));
  setRule('combat-frappe-mortelle', true);
  setRule('combat-deviation-critique', true);
  g().lancerLeCombat('enc-entrainement');
  expect(g().battle).toBeTruthy();
  if (g().pendingRoundStart) g().fenetreValider('debutDuRound');
  nePeutPasDifferer(applyEffects(g, banc.setState, [{ type: 'ops', on: 'heros', heroId: H, ops: [opPsy.pose('frenesie')] }]), 'frenesie-critique-devie');
  banc.setState({ battle: { ...g().battle!, ...etatDeTourNeuf(), turn: g().battle!.order.indexOf(H) } });
  const foes = g().battle!.combatants.filter((c) => c.kind !== 'heros');
  const gob = foes.find((f) => f.id === 'enemy-enc-entrainement-3')!;
  const man = foes.find((f) => f.id === 'enemy-enc-entrainement-0')!;
  const hero = relu(H);
  hero.pos = { x: gob.pos!.x - 1, y: gob.pos!.y };
  man.pos = { x: gob.pos!.x - 1, y: gob.pos!.y + 1 };
  gob.wounds.current = 1; // dépassement ≥ BE : pas de −20 (LDB 18 l.17 ; #1595 c.6222318751)
  gob.important = true; // LDB 18 l.44 : hors Mort subite
  gob.armour = { tete: 3, brasG: 3, brasD: 3, corps: 3, jambeG: 3, jambeD: 3 };
  for (const o of foes) if (o !== gob && o !== man && o.pos && Math.abs(o.pos.x - hero.pos.x) <= 1 && Math.abs(o.pos.y - hero.pos.y) <= 1) o.pos = { x: o.pos.x + 6, y: o.pos.y };
  // Un siège MJ tient les ennemis : la Déviation se tranche à l'étape (#1426), elle suspend le coup.
  banc.setState({ battle: { ...g().battle! }, net: { ...g().net, mode: 'hote', mySeat: 0, gmSeat: 1 } });
  expect(g().battle!.acted).toBe(false);

  g().ensemencerLeTirage(seedDuCritique());
  openAttackCascade(g, banc.setState, { attackerId: H, targetId: gob.id, location: null, result: null }, 'Attaque', 'action/attaquer');
  g().jetLancer('attaque');
  expect(g().pendingAttack?.result?.critical, 'le jet 1 doit être un Coup Critique').toBe(true);
  g().jetValider('attaque');
  defenseEchoue(gob.id);

  // L'étape critique : sévérité tirée, puis « Dévier ».
  const etape = g().pendingCascade?.participants.find((s) => s.kind === 'deviation');
  expect(etape, 'l’étape de Déviation doit s’ouvrir pour le porteur tenu').toBeTruthy();
  const pc = g().pendingCascade!;
  expect(pc.participants[pc.cursor].kind, 'le kit joue l’étape AU CURSEUR : ce doit être la Déviation').toBe('deviation');
  avanceEtapeCascade(g, undefined, () => 'devier');
  // LDB 18 l.17, l.53 : le coup dépasse les Blessures restantes — 2ᵉ fenêtre, même Localisation ; subie à 100, elle tue.
  const pc2 = g().pendingCascade!;
  expect(pc2.participants[pc2.cursor].kind, 'la 2ᵉ Blessure critique, le dépassement').toBe('deviation');
  avanceEtapeCascade(g, () => 100, () => 'subir');
  return { gob, man };
}

describe('Frénésie + Coup Critique dévié + balayage (LDB 21 l.33)', () => {
  afterEach(() => { resetRule('combat-frappe-mortelle'); resetRule('combat-deviation-critique'); });

  it('la restitution traverse l’étape critique, puis le maillon suivant rend `acted:false`', () => {
    const { man } = monte();
    expect(g().pendingCleave?.restitution).toEqual({ prevActed: false });
    g().frapperEnBalayage(man.id);
    g().jetLancer('attaque');
    g().jetImposerLeResultat('attaque', 21); // LDB 13 l.183
    expect(g().pendingAttack?.result?.critical, 'le 2ᵉ coup touche sans Coup Critique').toBe(false);
    g().jetValider('attaque');
    defenseEchoue(man.id);
    expect(g().pendingCleave ?? null).toBeNull();
    expect(g().battle!.acted).toBe(false);
  });

  it('la restitution traverse l’étape critique, puis la sortie du balayage rend `acted:false`', () => {
    monte();
    expect(g().pendingCleave?.restitution).toEqual({ prevActed: false });
    g().fenetreFermer('frappeMortelle');
    expect(g().battle!.acted).toBe(false);
  });
});
