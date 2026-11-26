/**
 * LES MOUVEMENTS D'ÉTAT EN FAITS (#4574 lot 3) : ce qu'`applyOps` pose ou retire d'un État part en fait `etat`,
 * keyé par l'id de l'État, avec la variation de pions RÉELLEMENT appliquée — jamais par son libellé, jamais
 * pour un retrait qui n'a pas eu lieu.
 */
import { idsDeTest } from './idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import type { Combatant } from './types';
import { applyOps, type GameOp } from './ops';
import { addCondition, hasCondition, releaseConditionLocks, COND } from './conditions';
import type { FaitApplique } from './faits';
import { desDuTest } from './dice.testkit';
import { blessuresDeBase, blessuresSurLeProfil } from './combattantDeTest.testkit';

function hero(p: Partial<Combatant> = {}): Combatant {
  return blessuresSurLeProfil({
    id: 'h', label: 'Cobaye', kind: 'heros',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 35 },
    wounds: blessuresDeBase(12), advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], items: [], diseases: [],
    ...p,
  }) as Combatant;
}

const appliquer = (c: Combatant, ops: GameOp[]) => applyOps(c, ops, { idNeuf: idsDeTest, rng: desDuTest, now: 0 });
const etats = (faits: FaitApplique[]) => faits.filter((f) => f.genre === 'etat');

describe("op 'condition' → fait `etat`", () => {
  it('Sonné posé : un fait, keyé par l’id de l’État, sur son porteur', () => {
    const { lignes, faits } = appliquer(hero(), [{ op: 'condition', id: { id: COND.sonne } }]);
    expect(faits).toEqual([{ genre: 'etat', cible: 'h', camp: 'groupe', id: COND.sonne, valeur: 1 }]);
    expect(lignes).toHaveLength(1);
  });

  it('les QUATRE formes de pose (nue, Rounds, horloge, par Round) rendent chacune UN fait de leur État', () => {
    const formes: GameOp[] = [
      { op: 'condition', id: { id: COND.sonne } },
      { op: 'condition', id: { id: COND.aveugle }, durationRounds: 3 },
      { op: 'condition', id: { id: COND.empetre }, durationMinutes: 30 },
      { op: 'condition', id: { id: COND.extenue }, perRound: true },
    ];
    expect(formes.map((o) => etats(appliquer(hero(), [o]).faits).map((f) => f.id)))
      .toEqual([[COND.sonne], [COND.aveugle], [COND.empetre], [COND.extenue]]);
  });

  it("`perRound` annonce sans poser : son fait vaut 0, et le porteur ne porte rien encore", () => {
    const c = hero();
    expect(etats(appliquer(c, [{ op: 'condition', id: { id: COND.extenue }, perRound: true }]).faits))
      .toEqual([{ genre: 'etat', cible: 'h', camp: 'groupe', id: COND.extenue, valeur: 0, duree: { parRound: 1 } }]);
    expect(hasCondition(c, COND.extenue)).toBe(false);
  });
});

describe("op 'removeCondition' → fait `etat` négatif, mesuré au retrait effectif", () => {
  it('un pion d’Exténué retiré : −1', () => {
    const c = hero();
    addCondition(c, COND.extenue, 2);
    expect(etats(appliquer(c, [{ op: 'removeCondition', id: { id: COND.extenue } }]).faits))
      .toEqual([{ genre: 'etat', cible: 'h', camp: 'groupe', id: COND.extenue, valeur: -1 }]);
  });

  // LDB 16 l.76, l.78
  it('une demande de 2 sur UN seul pion : la ligne dit 1, le fait vaut −1, puis la sortie de l’État', () => {
    const c = hero();
    addCondition(c, COND.empoisonne, 1);
    const { lignes, faits } = appliquer(c, [{ op: 'removeCondition', id: { id: COND.empoisonne }, value: 2 }]);
    expect(lignes).toEqual(['Cobaye retire 1 État Empoisonné.', 'Cobaye reçoit 1 État Exténué.']);
    expect(faits).toEqual([
      { genre: 'etat', cible: 'h', camp: 'groupe', id: COND.empoisonne, valeur: -1 },
      { genre: 'etat', cible: 'h', camp: 'groupe', id: COND.extenue, valeur: 1 },
    ]);
  });

  // LDB 18 l.15
  it('un État VERROUILLÉ ne part pas : ni ligne, ni fait ; verrou tombé, la ligne et son fait sortent', () => {
    const c = hero({ wounds: blessuresDeBase(12, 0) });
    addCondition(c, COND.aTerre, 1);
    expect(appliquer(c, [{ op: 'removeCondition', id: { id: COND.aTerre } }])).toEqual({ lignes: [], faits: [] });
    expect(hasCondition(c, COND.aTerre)).toBe(true);
    c.wounds.current = 1;
    expect(etats(appliquer(c, [{ op: 'removeCondition', id: { id: COND.aTerre } }]).faits))
      .toEqual([{ genre: 'etat', cible: 'h', camp: 'groupe', id: COND.aTerre, valeur: -1 }]);
  });

  it('sans État à retirer : sans objet, ni fait', () => {
    expect(appliquer(hero(), [{ op: 'removeCondition' }]).faits).toEqual([]);
  });
});

describe('les autres sources de mouvement d’État', () => {
  it('une op sans État (Blessures) ne rend aucun fait `etat`', () => {
    expect(etats(appliquer(hero(), [{ op: 'wounds', amount: 2 }]).faits)).toEqual([]);
  });

  // LDB 18 ; LDB 16 l.109
  it('un verrou levé par un acte de soin rend la PERTE de son État, puis sa sortie', () => {
    const c = hero();
    addCondition(c, COND.hemorragique, 1, undefined, undefined, undefined, undefined, { unlockBy: 'medicalAid' });
    const { lignes, faits } = releaseConditionLocks(c, 'medicalAid');
    expect(lignes).toHaveLength(2);
    expect(faits).toEqual([
      { genre: 'etat', cible: 'h', camp: 'groupe', id: COND.hemorragique, valeur: -1, verrouLeve: true },
      { genre: 'etat', cible: 'h', camp: 'groupe', id: COND.extenue, valeur: 1 },
    ]);
  });
});
