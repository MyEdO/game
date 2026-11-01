import { describe, it, expect } from 'vitest';
import { stampCriticalEscalation, settleHealedCriticals, removeSurgicalTrauma, passiveSkillSum, surgeryTraumas } from './trauma';
import { resolveCritique } from './critical';
import { addCondition, removeCondition } from './conditions';
import { applyOps, skillDRBonus } from './ops';
import type { Combatant, HitLocation } from './types';
import type { RNG } from './dice';
import type { CritEscalation } from '../data/criticals';
import { desDuTest, desEnSuite } from './dice.testkit';
import { blessuresSurLeProfil, blessuresDeBase } from './combattantDeTest.testkit';

const C = (over: Partial<Combatant>): Combatant =>
  (blessuresSurLeProfil({
    id: 'c', label: 'C', kind: 'hero', conditions: [], skills: [],
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(10), advantage: 0,
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...over,
  }) as Combatant);

/** RNG qui débite une séquence fixe (int() ignore min/max — tests ciblés). */
const seq = (vals: number[]): RNG => desEnSuite(vals, { boucle: true });

const stamp = (loc: HitLocation, esc: CritEscalation) => {
  const traumas: Combatant['traumas'] = [];
  stampCriticalEscalation(traumas!, esc, loc, C({}), seq([5]), []);
  return traumas!;
};

describe('#192 — séquelles POST-guérison (cicatrices) : marqueur onHealGrant', () => {
  it('stampCriticalEscalation pose un marqueur de guérison (aucune cicatrice tant que la blessure n\'est pas guérie)', () => {
    const traumas = stamp('tete', { onHealGrant: { scar: 'cicatrice-spectaculaire', whenClear: ['hemorragique'] } });
    expect(traumas).toHaveLength(1);
    expect(traumas[0].onHealGrant?.scar).toBe('cicatrice-spectaculaire');
    // le marqueur de guérison ne porte aucune op passive (la cicatrice n'est octroyée qu'à la guérison)
    expect(traumas[0].ops).toBeUndefined();
  });

  it('settleHealedCriticals : rien tant qu\'un État associé est porté ; octroi une fois tous retirés', () => {
    const c = C({ criticalWounds: 1, conditions: [{ id: 'hemorragique', value: 2 }],
      traumas: [{ label: 'x (en cours de guérison)', location: 'tete', onHealGrant: { scar: 'cicatrice-spectaculaire', whenClear: ['hemorragique'] } }] });
    expect(settleHealedCriticals(c)).toEqual([]); // Hémorragique encore porté
    expect(c.traumas!.some((t) => t.onHealGrant)).toBe(true);
    c.conditions = []; // tous les États associés retirés
    const log = settleHealedCriticals(c);
    expect(log.join(' ')).toMatch(/cicatrice/i);
    expect(c.criticalWounds).toBe(0); // Blessure critique guérie ⇒ décomptée (LDB 18 l.304)
    expect(c.traumas!.some((t) => t.onHealGrant)).toBe(false); // marqueur retiré
    const scar = c.traumas!.find((t) => t.traumaId === 'cicatrice-spectaculaire');
    expect(scar).toBeTruthy();
    expect(scar!.cosmetic).toBe(true);
    // LDB 18 l.61 : canal DR (`skillDRBonus`) sur le périmètre arbitré (Intimidation), et rien sur la
    // valeur du Test (`passiveSkillSum`).
    expect(skillDRBonus(c, 'intimidation')).toBe(1);
    expect(skillDRBonus(c, 'charme')).toBe(0);
    expect(passiveSkillSum(c, 'intimidation')).toBe(0);
  });

  it('déclenchement au POINT UNIQUE de retrait d\'État (removeCondition)', () => {
    const c = C({ criticalWounds: 1,
      traumas: [{ label: 'x', location: 'tete', onHealGrant: { scar: 'cicatrice-spectaculaire', whenClear: ['hemorragique'] } }] });
    addCondition(c, 'hemorragique', 1);
    expect(c.traumas!.some((t) => t.onHealGrant)).toBe(true); // l'ajout d'État ne guérit pas
    removeCondition(c, 'hemorragique', 1); // dernier État associé tombe → guérison
    expect(c.traumas!.some((t) => t.traumaId === 'cicatrice-spectaculaire')).toBe(true);
    expect(c.traumas!.some((t) => t.onHealGrant)).toBe(false);
  });

  it('nez cassé : cicatrice ±contexte (DR +1 Intimidation / DR -1 Charme), retirée par Chirurgie sans re-décompter', () => {
    const c = C({ criticalWounds: 2, // 1 nez cassé (en cours) + 1 autre Blessure critique
      conditions: [{ id: 'hemorragique', value: 2 }, { id: 'sonne', value: 1 }],
      traumas: [{ label: 'x', location: 'tete', onHealGrant: { scar: 'cicatrice-nez-casse', whenClear: ['hemorragique', 'sonne'] } }] });
    removeCondition(c, 'hemorragique', 2);
    expect(c.traumas!.some((t) => t.onHealGrant)).toBe(true); // Sonné encore porté
    removeCondition(c, 'sonne', 1);
    const scar = c.traumas!.find((t) => t.traumaId === 'cicatrice-nez-casse');
    expect(scar).toBeTruthy();
    expect(scar!.needsSurgery).toBe(true);
    expect(c.criticalWounds).toBe(1); // la Blessure du nez est guérie (2→1), l'autre reste
    expect(skillDRBonus(c, 'intimidation')).toBe(1);
    expect(skillDRBonus(c, 'charme')).toBe(-1);
    // Chirurgie sur le nez : retire la cicatrice SANS re-décompter une Blessure critique (cosmetic)
    expect(surgeryTraumas(c).some((t) => t.traumaId === 'cicatrice-nez-casse')).toBe(true);
    const idx = surgeryTraumas(c).findIndex((t) => t.traumaId === 'cicatrice-nez-casse');
    removeSurgicalTrauma(c, idx);
    expect(c.traumas!.some((t) => t.traumaId === 'cicatrice-nez-casse')).toBe(false);
    expect(c.criticalWounds).toBe(1); // inchangé : une cicatrice n'est pas une Blessure critique
    expect(skillDRBonus(c, 'intimidation')).toBe(0);
  });

  it('flux complet via resolveCritique + applyOps + retrait d\'État (Blessure spectaculaire, tête 01-10)', () => {
    const c = C({ conditions: [], criticalWounds: 0 });
    const res = resolveCritique('ldb', c, 'tete', seq([5])); // d100=5 → Blessure spectaculaire
    expect(res.label).toBe('Blessure spectaculaire');
    c.criticalWounds = 1;
    c.traumas = res.traumas;
    applyOps(c, res.ops, { rng: desDuTest }); // applique l'Hémorragique immédiat
    expect(c.conditions.some((x) => x.id === 'hemorragique')).toBe(true);
    expect(c.traumas.some((t) => t.onHealGrant)).toBe(true);
    // guérison : on retire l'Hémorragique → cicatrice octroyée automatiquement
    const hemo = c.conditions.find((x) => x.id === 'hemorragique')!;
    removeCondition(c, 'hemorragique', hemo.value);
    expect(c.traumas.some((t) => t.traumaId === 'cicatrice-spectaculaire')).toBe(true);
    expect(c.criticalWounds).toBe(0);
  });
});
