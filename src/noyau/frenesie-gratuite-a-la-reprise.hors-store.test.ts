import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { testScene } from '../scenes/test-fixture';
import { blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { heroFaceAUnEnnemi } from './combatDeTest.testkit';
import { imposerLesD100 } from './battleRng.testkit';
import { doAttack } from './combatFlow';
import { armeDeTest } from '../engine/objetsDeTest.testkit';
import { setRule, resetRule } from '../engine/policy';
import { avanceEtapeCascade } from './cascade.testkit';

// LDB 21 l.33 ; LDB 85 l.41-43 — #4011 (G4).
let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });
afterEach(() => resetRule('combat-deviation-critique'));
const g = () => banc.getState();

/** Ce qui tient la main après la défense de l'Action d'un Frénétique, à son tour, contre un héros surfacé. */
type Fenetre = 'aucune' | 'assommante' | 'sauvegarde' | 'deviation' | 'assautFeroce';

/** Le tour du Frénétique E : son Action frappe H, la défense de H échoue, chaque fenêtre qui suit se joue.
 *  Rend E relu et le tour d'avant, une fois que la file a rendu la main (fenêtre ouverte ou tour passé). */
function jouer(fenetre: Fenetre) {
  const { H, E } = heroFaceAUnEnnemi(banc, testScene());
  E.weapons = [armeDeTest(fenetre === 'assommante' ? 'marteau-a-bec-de-corbin' : 'dague')];
  E.psychState = [{ type: 'frenesie' }];
  H.wounds = blessuresDeBase(200, 200, H);
  if (fenetre === 'assautFeroce') { E.talents = [...(E.talents ?? []), { talentId: 'assaut-feroce', times: 1 }]; E.advantage = 3; }
  if (fenetre === 'sauvegarde') H.traits = [...(H.traits ?? []), { id: 'protection', value: 6 }];
  if (fenetre === 'deviation') { setRule('combat-deviation-critique', true); H.armour = { tete: 2, brasG: 2, brasD: 2, corps: 2, jambeG: 2, jambeD: 2 }; }
  banc.setState({ battle: { ...g().battle!, turn: g().battle!.order.indexOf(E.id) } });
  if (fenetre === 'deviation') imposerLesD100(11, 23, 11, 23, 11, 23, 11, 23);
  else imposerLesD100(20, 23, 20, 23, 20, 23, 20, 23, 20, 23, 20, 23);
  doAttack(g, banc.setState, E, H);
  const tour = g().battle!.turn;
  const defenseEchoue = () => { g().jetLancer('defense'); g().jetImposerLeResultat('defense', 97); g().jetValider('defense'); };
  defenseEchoue();
  if (fenetre === 'assautFeroce') {
    expect(g().pendingDefense?.attackerId, 'la gratuite d’Assaut féroce ouvre SA défense').toBe(E.id);
    defenseEchoue();
  }
  for (let i = 0; i < 6 && g().pendingCascade && !g().pendingDefense; i++) avanceEtapeCascade(g, (etape) => (etape.kind === 'sauvegarde' ? 1 : undefined));
  banc.jusquA((s) => s.battle!.turn !== tour || !!s.pendingDefense, 10);
  return { E: g().battle!.combatants.find((c) => c.id === E.id)!, tour };
}

describe('Frénésie : la gratuite d’Arme part quelle que soit la fenêtre qui rend le tour (LDB 21 l.33)', () => {
  it.each<Fenetre>(['aucune', 'assommante', 'sauvegarde', 'deviation', 'assautFeroce'])('après la défense, fenêtre « %s » : la gratuite d’Arme est déclarée avant que le tour passe', (fenetre) => {
    const { E, tour } = jouer(fenetre);
    expect(E.freeAttacksThisTurn?.['arme'] ?? 0, 'la gratuite d’Arme de la Frénésie est déclarée').toBe(1);
    expect(g().battle!.turn, 'le tour reste au Frénétique').toBe(tour);
    expect(g().pendingDefense?.attackerId, 'sa défense est ouverte').toBe(E.id);
  });
});
