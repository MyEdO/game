/**
 * La pose d'AUTEUR d'un état psychologique (op `beginPsych` d'un effet) et la pose née d'un Test : le
 * schéma refuse ce qu'aucune pose ne peut nommer, l'upsert ne garde d'une entrée que ce que la pose ne
 * redit pas (#1463, #3045). Entrées de donnée choisies par leur forme, jamais par leur nom.
 */
import { describe, it, expect } from 'vitest';
import {
  psychBranchOps, sousPeur, isAfflictionActive, endEncounterPsych, type PsychAffliction, type PsychType,
} from './psychology';
import { applyOps } from './ops';
import { opPsy } from './psych/opsPsy';
import { ciblePsy } from './psych/ciblage';
import type { Combatant } from './types';
import { desDuTest } from './dice.testkit';
import { gameOpSchema } from '../data/schemas/grammaire/mecanique';
import { groups, psychologies } from '../data';

const porteur = (psychState: PsychAffliction[] = []): Combatant => ({
  id: 'h1', label: 'h1', kind: 'hero', advantage: 0, conditions: [], characteristics: {} as never, psychState, psychTraits: [],
  groups: [], weapons: [], armour: {} as never, skills: [], talents: [], movement: 4, wounds: { current: 10, max: 10 },
} as unknown as Combatant);

const devenant = psychologies.find((p) => !!p.becomes);
const devenue = psychologies.find((p) => p.id === devenant?.becomes);
const etendue = psychologies.find((p) => p.resolution === 'extended');
const ciblee = psychologies.find((p) => p.targeted && !p.targetCauses);
const nonCiblee = psychologies.find((p) => !p.targeted && !p.becomes);
const groupe = groups[0];

describe('préconditions de forme', () => {
  it('la donnée porte une entrée qui en devient une autre, une Peur étendue, un type ciblé et un non ciblé', () => {
    expect(devenant).toBeDefined();
    expect(devenue).toBeDefined();
    expect(etendue).toBeDefined();
    expect(ciblee).toBeDefined();
    expect(nonCiblee).toBeDefined();
    expect(groupe).toBeDefined();
  });
});

describe('schéma de la pose d’auteur (LDB 21 l.56, l.17-19)', () => {
  const parse = (op: unknown) => gameOpSchema.safeParse(op);

  it('refuse une entrée qui en devient une autre (`becomes`), jamais posée telle quelle', () => {
    const refus = parse(opPsy.pose(devenant!.id));
    expect(refus.success).toBe(false);
    expect(JSON.stringify(refus.error?.issues)).toMatch(/becomes/);
    expect(parse(opPsy.pose(devenue!.id)).success).toBe(true);
  });

  it('une Cible n’est admise que sur un type ciblé, pour la pose comme pour l’octroi', () => {
    const cible = ciblePsy.groupe(groupe.id);
    expect(parse(opPsy.pose(ciblee!.id, { cible })).success).toBe(true);
    expect(parse(opPsy.octroi(ciblee!.id, cible)).success).toBe(true);
    expect(parse(opPsy.pose(nonCiblee!.id, { cible })).success).toBe(false);
    expect(parse(opPsy.octroi(nonCiblee!.id, cible)).success).toBe(false);
  });

  it('un type hors du registre des psychologies, ou une Cible hors du registre des Groupes, est refusé au parse', () => {
    expect(parse(opPsy.pose('psychologie-fantome')).success).toBe(false);
    expect(parse(opPsy.fin('psychologie-fantome')).success).toBe(false);
    expect(parse(opPsy.octroi('psychologie-fantome')).success).toBe(false);
    expect(parse(opPsy.retrait('psychologie-fantome')).success).toBe(false);
    expect(parse(opPsy.octroi(ciblee!.id, ciblePsy.groupe('groupe-fantome'))).success).toBe(false);
  });

  it('une référence à plat (id nu au lieu de `{ id }`) est refusée : un seul dialecte (#1468)', () => {
    expect(parse({ op: 'beginPsych', type: nonCiblee!.id }).success).toBe(false);
    expect(parse({ op: 'endPsych', type: nonCiblee!.id }).success).toBe(false);
    expect(parse({ op: 'removePsychTrait', psychType: nonCiblee!.id }).success).toBe(false);
    expect(parse({ ...opPsy.octroi(ciblee!.id), cible: groupe.id }).success).toBe(false);
  });

  it('les champs de RÉSOLUTION ne s’écrivent pas en donnée', () => {
    for (const champ of [{ sourceId: 'x' }, { calmeDR: 1 }, { surmontee: true }, { lastTestRound: 1 }, { fromTest: true }]) {
      expect(parse({ ...opPsy.pose(etendue!.id), ...champ }).success, JSON.stringify(champ)).toBe(false);
    }
  });
});

describe('upsert de la pose (LDB 21 l.9, l.25, l.54-56)', () => {
  const type = () => etendue!.id as PsychType;

  it('une pose d’auteur remet sous la Peur une Peur surmontée, et son Test étendu repart de zéro', () => {
    const c = porteur([{ type: type(), indice: 2, calmeDR: 2, surmontee: true }]);
    applyOps(c, [opPsy.pose(type(), { indice: 2 })], { rng: desDuTest });
    expect(c.psychState).toHaveLength(1);
    expect(sousPeur(c.psychState![0])).toBe(true);
    expect(c.psychState![0].calmeDR).toBeUndefined();
  });

  it('une pose d’auteur sur une entrée née d’un Test n’est pas bornée à la rencontre', () => {
    const c = porteur([{ type: type(), indice: 2, fromTest: true }]);
    applyOps(c, [opPsy.pose(type(), { indice: 2 })], { rng: desDuTest });
    endEncounterPsych(c);
    expect(c.psychState).toHaveLength(1);
  });

  it('la Peur héritée, fusionnée sur une entrée née d’un Test de même source, garde la mémoire « déjà affrontée »', () => {
    const c = porteur([{ type: devenue!.id as PsychType, sourceId: 'src', indice: 1, calmeDR: 0, surmontee: false, fromTest: true }]);
    applyOps(c, psychBranchOps({ kind: devenant!.id as PsychType, sourceId: 'src', indice: 3 }, { success: true }), { rng: desDuTest, sl: 1 });
    expect(c.psychState).toHaveLength(1);
    expect(c.psychState![0].fromTest).toBeUndefined();
    endEncounterPsych(c);
    expect(c.psychState, 'la Peur héritée traverse la borne de rencontre').toHaveLength(1);
  });

  it('la pose d’un Test garde sa provenance et son cumul', () => {
    const c = porteur();
    applyOps(c, psychBranchOps({ kind: type(), sourceId: 'src', indice: 3 }, { success: false, calmeDR: 1, surmontee: false }), { rng: desDuTest });
    expect(c.psychState![0]).toMatchObject({ fromTest: true, calmeDR: 1, surmontee: false });
  });

  it('une pose d’auteur d’un Trait ciblé le fait subir', () => {
    const c = porteur();
    applyOps(c, [opPsy.pose(ciblee!.id, { cible: ciblePsy.groupe(groupe.id) })], { rng: desDuTest });
    expect(isAfflictionActive(c.psychState![0])).toBe(true);
  });

  it('une pose ciblée qui dit `active: false` reste un marqueur résisté', () => {
    const c = porteur();
    applyOps(c, [opPsy.pose(ciblee!.id, { cible: ciblePsy.groupe(groupe.id), active: false })], { rng: desDuTest });
    expect(isAfflictionActive(c.psychState![0])).toBe(false);
  });
});
