/**
 * #2948 — ce que le SCHÉMA de `apparences.json` tient au parse : une entrée sans `forme` est une racine
 * (`id` + `label`, aucune étiquette), une entrée avec `forme` est une variante d'une RACINE, et ses
 * étiquettes de naissance sont des ids existants.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { schema } from './apparences';
import apparencesJson from '../../apparences.json';
import { poserRegimeVivant } from '../grammaire/idsVivants';
import { IDS_PAR_ESPACE } from '../_ids.generated';

type Entree = { id: string; type: string; label: string; [k: string]: unknown };
const VARIANTE: Entree = { id: 'epee-raffinee', type: 'apparences', label: 'Épée raffinée', forme: 'epee', especes: ['humains-reiklander'], classes: ['courtisans'], qualites: ['raffine'] };
const avec = (...entrees: Entree[]): Entree[] => [...(structuredClone(apparencesJson) as Entree[]), ...entrees];
const refus = (doc: unknown): string => {
  const r = schema.safeParse(doc);
  expect(r.success, 'le document a parsé alors qu’il devait être REFUSÉ').toBe(false);
  return r.success ? '' : r.error.issues.map((i) => i.message).join(' ');
};

afterEach(() => {
  poserRegimeVivant(undefined);
});

describe('apparences.json — racines et variantes (#2948)', () => {
  it('le document réel parse', () => {
    expect(schema.safeParse(apparencesJson).success).toBe(true);
  });

  it('une variante d’une racine, à étiquettes existantes, parse', () => {
    expect(schema.safeParse(avec(VARIANTE)).success).toBe(true);
  });

  it('une variante d’une forme inconnue est refusée, nommément', () => {
    expect(refus(avec({ ...VARIANTE, forme: 'forme-inexistante' }))).toMatch(/« forme-inexistante » est absent du catalogue des apparences/);
  });

  it('une variante d’une VARIANTE est refusée : `forme` vise une racine', () => {
    // Régime vivant : la variante `epee-raffinee` existe et porte le marqueur `forme`.
    poserRegimeVivant((cle) =>
      cle === 'apparences.json'
        ? new Set([...IDS_PAR_ESPACE['apparences.json'], VARIANTE.id])
        : cle === 'apparences.json?forme'
          ? new Set([VARIANTE.id])
          : undefined,
    );
    const petite = { id: 'epee-raffinee-courte', type: 'apparences', label: 'Épée raffinée courte', forme: VARIANTE.id };
    expect(refus(avec(VARIANTE, petite))).toMatch(/« epee-raffinee » porte le marqueur « forme »/);
  });

  it('une racine qui porte une étiquette de naissance est refusée, nommément', () => {
    const doc = avec();
    doc[0].especes = ['humains-reiklander'];
    expect(refus(doc)).toMatch(new RegExp(`« ${doc[0].id} » est une racine \\(sans \`forme\`\\) — l’étiquette « especes »`));
  });

  it.each([
    ['espèce', { especes: ['espece-inexistante'] }, /« espece-inexistante » est absent du catalogue des espèces/],
    ['classe', { classes: ['classe-inexistante'] }, /« classe-inexistante » est absent du catalogue des classes de carrière/],
    ['qualité hors naissance', { qualites: ['rapide'] }, /« rapide » \(epee-raffinee\) n’est pas une qualité de naissance/],
  ])('une étiquette de %s invalide est refusée', (_cas, etiquette, motif) => {
    expect(refus(avec({ ...VARIANTE, ...etiquette }))).toMatch(motif);
  });
});
