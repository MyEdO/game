/**
 * Groupes composites et Groupes de Sans Peur (Ennemi) (#1463, #3045) : un composite (`GroupData.inclut`) vise tout
 * membre de l'un des Groupes qu'il inclut (Q13 A) ; Cavalerie se dérive de la monture (AA 04 l.204) ; Sans Peur
 * prend son Ennemi dans `groups.json` hors des Groupes relatifs (LDB 10 l.1051). Composites choisis par leur forme.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { groupMatch, groupesDe } from './groups';
import { sansPeurVs } from './psychology';
import { groups, SPEC_SOURCES, talents, type GroupData } from '../data';
import { datasetArray, resetData, setDataset } from '../data/overrides';
import type { Combatant } from './types';
import { blessuresSurLeProfil, blessuresDeBase, profilDeTest } from './combattantDeTest.testkit';

afterEach(() => resetData());

const mk = (o: Partial<Combatant> = {}): Combatant => (blessuresSurLeProfil({
  id: 'c', label: 'c', kind: 'enemy', advantage: 0, conditions: [],
  characteristics: profilDeTest({ 'force-mentale': 35 }), psychState: [], psychTraits: [], groups: [],
  weapons: [], armour: {} as never, skills: [], talents: [], movement: 4, wounds: blessuresDeBase(10), ...o,
}) as Combatant);

const composites = groups.filter((g) => g.inclut?.length);
const ordinaire = groups.find((g) => !g.inclut && !g.matchesAll && !g.relatif && !composites.some((c) => c.inclut!.includes(g.id)))!;
const sansPeur = talents.find((t) => t.combat?.fearImmune && t.specsSource)!;
const groupe = (id: string, o: Partial<GroupData> = {}): GroupData => ({ id, type: 'groups', label: id, ...o });

describe('Groupe composite (`inclut`)', () => {
  it('précondition : la donnée porte des composites, un Groupe ordinaire hors de tout composite, Sans Peur à source', () => {
    expect(composites.length).toBeGreaterThan(1);
    expect(ordinaire).toBeDefined();
    expect(sansPeur).toBeDefined();
  });

  it('vise le membre de chacun des Groupes qu’il inclut, et lui seul', () => {
    for (const c of composites) {
      for (const g of c.inclut!) expect(groupMatch(c.id, [g]), `${c.id} ← ${g}`).toBe(true);
      expect(groupMatch(c.id, [ordinaire.id]), c.id).toBe(false);
      expect(groupMatch(c.id, [c.id]), `${c.id} ne se déclare pas`).toBe(false);
    }
  });

  it('un composite d’un composite se résout ; un cycle d’`inclut` ne correspond pas et termine', () => {
    const [c] = composites;
    setDataset('groups', [...datasetArray('groups'), groupe('sur-composite', { inclut: [c.id] }), groupe('cycle-a', { inclut: ['cycle-b'] }), groupe('cycle-b', { inclut: ['cycle-a'] })] as never);
    expect(groupMatch('sur-composite', [c.inclut![0]])).toBe(true);
    expect(groupMatch('cycle-a', [ordinaire.id])).toBe(false);
  });

  it('un joker qui retranche un composite retranche les membres des Groupes qu’il inclut', () => {
    const [c] = composites;
    setDataset('groups', [...datasetArray('groups'), groupe('tout-sauf', { matchesAll: true, exceptGroups: [c.id] })] as never);
    expect(groupMatch('tout-sauf', [c.inclut![0]])).toBe(false);
    expect(groupMatch('tout-sauf', [ordinaire.id])).toBe(true);
  });
});

describe('Cavalerie, dérivée de la monture (AA 04 l.204 ; Q13 A)', () => {
  const cavalerie = groups.find((g) => g.id === 'cavalerie')!;

  it('un combattant monté la porte, un combattant à pied non', () => {
    expect(cavalerie).toBeDefined();
    expect(groupesDe(mk({ mountId: 'cheval' }))).toContain(cavalerie.id);
    expect(groupesDe(mk())).not.toContain(cavalerie.id);
  });

  it('Sans Peur (Cavalerie) vaut contre un cavalier, pas contre un fantassin', () => {
    const brave = mk({ id: 'b', talents: [{ talentId: sansPeur.id, spec: cavalerie.id, times: 1 }] });
    expect(sansPeurVs(brave, mk({ id: 'f', mountId: 'cheval' }))).toBe(true);
    expect(sansPeurVs(brave, mk({ id: 'f' }))).toBe(false);
  });
});

describe('Sans Peur (Ennemi) : l’Ennemi est un Groupe de `groups.json` hors des Groupes relatifs (LDB 10 l.1051)', () => {
  it('le pool de sa source porte chaque composite et aucun Groupe relatif', () => {
    const pool = SPEC_SOURCES[sansPeur.specsSource!].pool();
    for (const c of composites) expect(pool, c.id).toContain(c.id);
    for (const r of groups.filter((g) => g.relatif)) expect(pool, r.id).not.toContain(r.id);
  });

  it('Sans Peur d’un composite vaut contre le membre d’un Groupe inclus', () => {
    for (const c of composites) {
      const brave = mk({ id: 'b', talents: [{ talentId: sansPeur.id, spec: c.id, times: 1 }] });
      expect(sansPeurVs(brave, mk({ id: 'f', groups: [c.inclut![0]] })), c.id).toBe(true);
      expect(sansPeurVs(brave, mk({ id: 'f', groups: [ordinaire.id] })), c.id).toBe(false);
    }
  });
});
