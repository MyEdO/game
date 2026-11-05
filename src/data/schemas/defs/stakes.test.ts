/**
 * #1681 — ce que le SCHÉMA de `stakes.json` tient au parse, sur le document RÉEL : ses invariants
 * d'entrée, rendus par cascade (`schemas/defs/stakes.ts`).
 */
import { describe, expect, it } from 'vitest';
import { schema } from './stakes';
import stakesJson from '../../stakes.json';

type Entree = { id: string; cascade: string; cle: string; [k: string]: unknown };
const clone = (): Entree[] => structuredClone(stakesJson) as unknown as Entree[];
const uneDe = (doc: Entree[], cascade: string, filtre: (e: Entree) => boolean = () => true): Entree => {
  const e = doc.find((x) => x.cascade === cascade && filtre(x));
  expect(e, `aucune entrée de cascade « ${cascade} » — la fixture ne mesure rien`).toBeDefined();
  return e!;
};
/** Message(s) d'erreur du parse, à plat. */
const refus = (doc: unknown): string => {
  const r = schema.safeParse(doc);
  expect(r.success, 'le document a parsé alors qu’il devait être REFUSÉ').toBe(false);
  return r.success ? '' : r.error.issues.map((i) => i.message).join(' ');
};

describe('stakes.json — une collection, quatre cascades, leurs invariants gardés au parse', () => {
  it('TÉMOIN : le document RÉEL parse', () => {
    expect(schema.safeParse(stakesJson).success).toBe(true);
  });

  it('`form` et `template` vont ensemble', () => {
    const doc = clone();
    delete uneDe(doc, 'night').form;
    expect(refus(doc)).toMatch(/la forme qualifie le gabarit/);
  });

  it('une cascade à PORTE refuse une entrée sans foyer ni catégorie d’entrée ; le voyage l’admet', () => {
    const nuit = clone();
    delete uneDe(nuit, 'night').rule;
    expect(refus(nuit)).toMatch(/ni foyer \(rule\) ni catégorie d’entrée/);
    const voyage = clone();
    delete uneDe(voyage, 'voyage', (e) => !!e.rule).rule;
    expect(schema.safeParse(voyage).success).toBe(true);
  });

  it('une clé de CHARGE d’une autre cascade est refusée, en nommant la cascade', () => {
    const doc = clone();
    uneDe(doc, 'night').entryCategory = 'symptoms';
    expect(refus(doc)).toMatch(/« entryCategory » n’appartient qu’au\(x\) cas cascade « flow, combat »/);
  });

  it('deux entrées d’une même cascade ne servent pas la même clé', () => {
    const doc = clone();
    const [a, b] = doc.filter((e) => e.cascade === 'combat');
    b.cle = a.cle;
    expect(refus(doc)).toMatch(new RegExp(`servent la même clé combat/${a.cle}`));
  });

  it('la même clé dans deux cascades est admise : la clé de consommation vit DANS sa cascade', () => {
    const doc = clone();
    uneDe(doc, 'combat').cle = uneDe(doc, 'night').cle;
    expect(schema.safeParse(doc).success).toBe(true);
  });

  it('la clé d’un jet de modale est son identifiant (`FlowStakeId`)', () => {
    const doc = clone();
    uneDe(doc, 'flow').cle = 'autre-cle';
    expect(refus(doc)).toMatch(/la clé d’un jet de modale est son identifiant/);
  });
});
