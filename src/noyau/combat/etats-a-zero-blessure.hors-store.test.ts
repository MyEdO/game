import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import type { BattleState } from '../etat';
import { applyAttackResult, applyOups } from '../combatFlow';
import { seedBattleRng } from '../battleRng';
import { draineEtLit } from '../cascade.testkit';
import { applyOps, cleDeDe } from '../../engine/ops';
import { suffocationTick } from '../../engine/suffocation';
import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { desDuTest } from '../../engine/dice.testkit';
import type { Combatant, Weapon } from '../../engine/types';
import type { AttackResult } from '../../engine/combat';
import { emptyScene } from '../monde/scene';
import { hasCondition } from '../../engine/conditions';
import { ligneDeTexte } from '../../engine/journal';
import { blessuresDeBase, blessuresSurLeProfil, combattantDeTest } from '../../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc({ desFixes: true }); });

/** #4911 — tout État posé à 0 Blessure a sa ligne, une fois, après la perte et avant « hors de combat » ;
 *  l'État que la prose de son producteur dit déjà (l'Hémorragie d'une passe de Chirurgie) n'a pas de ligne de plus.
 *  LDB 18 l.15 ; LDB 16 l.105 ; LDB 14 l.219 ; LDB 10 l.184. */

const CHARS = { 'capacite-de-combat': 45, 'capacite-de-tir': 45, force: 40, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const GRIFFES = { label: 'Griffes', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] } as unknown as Weapon;

const combattant = (p: Partial<Combatant>): Combatant =>
  (blessuresSurLeProfil({
    characteristics: CHARS, wounds: blessuresDeBase(15), advantage: 0, conditions: [], movement: 4, skills: [], talents: [],
    engagedWith: [], pos: { x: 0, y: 0 }, size: 'moyenne', weapons: [GRIFFES], items: [], fate: 0, traumas: [], critEntriesSuffered: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, bodyShape: 'humanoide',
    ...p,
  }) as unknown as Combatant);

/** « Hardi », héros sans État. */
const hardi = (avantage = 0) => combattant({ id: 'h1', label: 'Hardi', kind: 'heros', advantage: avantage });
/** « Gobelin saignant », ennemi important (hors Mort subite, LDB 18 l.46) à 3 PB, 1 Hémorragique. */
const gobelinSaignant = () => combattant({ id: 'e1', label: 'Gobelin', kind: 'ennemi', pos: { x: 1, y: 0 }, wounds: blessuresDeBase(12, 3), conditions: [{ id: 'hemorragique', value: 1 }], important: true } as Partial<Combatant>);

function combat(combatants: Combatant[]): void {
  const battle = {
    combatants, order: combatants.map((c) => c.id), baseOrder: combatants.map((c) => c.id),
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  banc.setState({ battle, mode: 'battle', scene: emptyScene('scene-test'), gameTime: 12 * 60, pendingCascade: null, pendingFateSave: null });
}

describe('#4911 — les États posés à 0 Blessure ont leur ligne', () => {
  it('coup Critique sur un porteur d’Hémorragique : À Terre et Inconscient une fois chacun, après la touche, avant « hors de combat »', () => {
    seedBattleRng(1);
    const h = hardi();
    const g = gobelinSaignant();
    combat([h, g]);
    const coup: AttackResult = { hit: true, attackerRoll: 30, netSL: 3, location: 'corps', damage: 6, woundsLost: 4, critical: false, advantageTo: null, defenderDefeated: false, log: 'Hardi touche le Gobelin.' };
    applyAttackResult(banc.getState, banc.setState, h, g, GRIFFES, coup);
    draineEtLit(banc.getState);
    const journal = banc.getState().battle!.log.map((l) => l.entree.texte);
    const rang = (ligne: string) => journal.indexOf(ligne);
    expect(journal.filter((l) => l === 'Gobelin reçoit 1 État À Terre.'), 'À Terre une fois').toHaveLength(1);
    expect(journal.filter((l) => l === 'Gobelin reçoit 1 État Inconscient.'), 'Inconscient une fois').toHaveLength(1);
    expect(rang('Hardi touche le Gobelin.')).toBeGreaterThanOrEqual(0);
    expect(rang('Gobelin reçoit 1 État À Terre.')).toBeGreaterThan(rang('Hardi touche le Gobelin.'));
    expect(rang('Gobelin reçoit 1 État Inconscient.')).toBeGreaterThan(rang('Gobelin reçoit 1 État À Terre.'));
    expect(rang('Gobelin est mis hors de combat !')).toBeGreaterThan(rang('Gobelin reçoit 1 État Inconscient.'));
  });

  it('Critique dont le Test inline pose l’Inconscient avant la clôture du coup : À Terre posé et dit (LDB 18 l.15)', () => {
    seedBattleRng(1);
    const h = hardi();
    const g = gobelinSaignant();
    combat([h, g]);
    // Dé 33 : un double, Critique « Entaille douloureuse » dont le Test de Résistance raté pose l'Inconscient.
    const coup: AttackResult = { hit: true, attackerRoll: 33, netSL: 3, location: 'corps', damage: 6, woundsLost: 4, critical: true, advantageTo: null, defenderDefeated: false, log: 'Hardi touche le Gobelin.' };
    applyAttackResult(banc.getState, banc.setState, h, g, GRIFFES, coup);
    draineEtLit(banc.getState);
    const gobelin = banc.getState().battle!.combatants.find((c) => c.id === 'e1')!;
    expect(hasCondition(gobelin, 'inconscient')).toBe(true);
    expect(hasCondition(gobelin, 'a-terre'), 'À Terre posé malgré l’Inconscient').toBe(true);
    expect(banc.getState().battle!.log.filter((l) => l.entree.texte === 'Gobelin reçoit 1 État À Terre.'), 'À Terre dit une fois').toHaveLength(1);
  });

  it('chute : la ligne de chute, puis les lignes de ses États, une fois chacune (LDB 15 l.84)', () => {
    const g = gobelinSaignant();
    g.shipStation = 'greement' as never;
    const coque = combattantDeTest({ id: 'hull', bodyShape: 'vehicule', creatureId: 'bateau-de-patrouille', upgrades: [{ id: 'nid-de-pie' }] });
    const des = new Map([[cleDeDe(0, 'hauteur'), 6], [cleDeDe(0, 'degats'), 9]]);
    expect(applyOps(g, [{ op: 'fall', hauteur: { table: { id: 'tomberDuGreement' } } } as never], { idNeuf: idsDeTest, rng: desDuTest, hull: coque, des }).lignes)
      .toEqual([
        'Gobelin — Tomber du gréement : chute de 6 m, 3 Blessure(s).',
        'Gobelin reçoit 1 État À Terre.',
        'Gobelin reçoit 1 État Inconscient.',
      ]);
  });

  it('suffocation : la perte, puis les lignes d’État, puis l’évanouissement (LDB 18 l.346)', () => {
    const h = hardi();
    h.wounds.current = 1;
    h.activeEffects = [{ label: 'Ombres étrangleuses', bonus: 0, duration: { scale: 'rounds', left: 8 }, suffocates: true }];
    expect(suffocationTick(h)).toEqual([
      'Hardi suffoque (−1 PB).',
      'Hardi reçoit 1 État À Terre.',
      'Hardi reçoit 1 État Inconscient.',
      'Hardi s\'évanouit, privé d\'air — mort dans 4 Round(s).',
    ]);
  });

  it('suffocation déjà à 0 Blessure : la ligne d’Inconscient, puis le décompte (LDB 18 l.346)', () => {
    const h = hardi();
    h.wounds.current = 0;
    h.activeEffects = [{ label: 'Ombres étrangleuses', bonus: 0, duration: { scale: 'rounds', left: 8 }, suffocates: true }];
    expect(suffocationTick(h)).toEqual(['Hardi reçoit 1 État Inconscient.', 'Hardi suffoque — mort dans 4 Round(s).']);
  });

  it('Oups ! « se blesse » : la Blessure perdue emporte l’Avantage (LDB 14 l.219)', () => {
    seedBattleRng(1);
    const h = hardi(3);
    combat([h, gobelinSaignant()]);
    applyOups(banc.getState, banc.setState, h, GRIFFES, { roll: 5, kind: 'selfWound', label: 'Blessé' });
    expect(h.wounds.current).toBe(14);
    expect(h.advantage).toBe(0);
  });
});

describe('#4911 — la passe de Chirurgie dit son Hémorragique par sa prose, une fois (LDB 10 l.184)', () => {
  it('patient à 1 PB porteur d’1 Hémorragique : la passe manquée le met à 0, Hémorragique nommé une fois, À Terre et Inconscient une fois chacun', () => {
    const docteur = combattant({ id: 'doc', label: 'Doc', kind: 'heros', skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }], talents: [{ talentId: 'chirurgie', times: 1 }] } as Partial<Combatant>);
    const patient = combattant({ id: 'p', label: 'Patient', kind: 'heros', pos: { x: 1, y: 0 }, wounds: blessuresDeBase(12, 1), conditions: [{ id: 'hemorragique', value: 1, unlockBy: 'surgery' }] } as Partial<Combatant>);
    banc.setState({ mode: 'exploration', battle: null, party: [docteur, patient], pendingHeal: null, pendingSurgery: null, medic: null, journal: [] });
    banc.getState().ouvrirLeMedecin('p');
    banc.getState().jetRegler('soins', 'mode', 'chirurgie');
    banc.getState().jetLancer('soins');
    banc.getState().jetLancer('chirurgie');
    banc.getState().jetImposerLeResultat('chirurgie', 85); // la cible manquée
    banc.getState().jetValider('chirurgie');
    expect(banc.getState().party.find((c) => c.id === 'p')!.conditions.find((c) => c.id === 'hemorragique')?.value, 'la passe pose son Hémorragique').toBe(2);
    expect(banc.getState().journal.slice(1), 'après la ligne du dé imposé').toEqual([
      'Doc opère Patient — passe : DR -2 (total 0/7), 6 PB + 1 Hémorragie.',
      'Patient reçoit 1 État À Terre.',
      'Patient reçoit 1 État Inconscient.',
      'Patient sombre sur la table — l\'opération est interrompue (stabilisez-le d\'abord).',
    ].map(ligneDeTexte));
  });
});
