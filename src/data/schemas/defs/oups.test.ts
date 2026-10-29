/**
 * `oups.json` — UNE forme d'entrée, la disjonction portée par la charge par `kind` (#1467 L1b V-UNION).
 *
 * Le RAW donne deux objets de nature différente sous le même toit (LDB 14, folio 160) : les 7 bandes
 * du Tableau des Oups ! (l.21-30), qui sont des fourchettes d100, et l'Incident de Tir (l.32-34), qui
 * est déclenché par une arme à Poudre noire sur un jet PAIR et n'a donc AUCUNE fourchette. Le schéma
 * doit refuser les deux formes bâtardes — une bande sans plage (`findTableEntry` lirait `undefined`)
 * et un Incident de Tir avec plage (il entrerait dans la table qu'il n'occupe pas).
 */
import { describe, expect, it } from 'vitest';
import { schema } from './oups';
import oupsJson from '../../oups.json';

/** Bande d100 minimale, et l'Incident de Tir — mêmes formes que la donnée réelle. */
const SOURCE = { book: 'livre-de-base', page: 160, note: 'Tableau des Oups !, LDB 14 l.21-30' } as const;
const BANDE = { id: 'bande', type: 'oups', min: 1, max: 20, kind: 'selfWound', label: 'Vous vous blessez.', source: SOURCE } as const;
const MISFIRE = { id: 'misfire', type: 'oups', kind: 'misfire', label: 'Incident de Tir !', source: SOURCE } as const;

const sans = <T extends object, K extends keyof T>(o: T, k: K): Omit<T, K> => {
  const { [k]: _, ...reste } = o;
  return reste;
};

/** Premier message d'erreur rendu par le parse — le contrat se lit AU MESSAGE, pas au seul booléen. */
const refus = (data: unknown): string => {
  const r = schema.safeParse(data);
  expect(r.success, 'le schéma a ACCEPTÉ une entrée qu’il doit refuser').toBe(false);
  return r.success ? '' : r.error.issues.map((i) => i.message).join(' | ');
};

describe('oups.json — une entrée est une BANDE d100 ou l’Incident de Tir, jamais entre les deux', () => {
  it('TÉMOIN : le dataset RÉEL est accepté, et le couple minimal aussi', () => {
    expect(schema.safeParse(oupsJson).success).toBe(true);
    expect(schema.safeParse([BANDE, MISFIRE]).success).toBe(true);
  });

  it('C1 — `misfire` AVEC une bande : refusé, en nommant la borne hors de son cas', () => {
    expect(refus([{ ...MISFIRE, min: 1, max: 20 }])).toMatch(/« min » n’appartient qu’au\(x\) cas kind « .*selfWound.* » — refusée sur « misfire » \(kind « misfire »\)/);
  });

  it('C2 — bande SANS `min` ni `max` : refusée, en nommant le `kind` fautif', () => {
    const message = refus([sans(sans(BANDE, 'min'), 'max')]);
    expect(message).toContain('« bande » (kind « selfWound ») exige « min »');
    expect(message).toContain('« bande » (kind « selfWound ») exige « max »');
  });

  it('C3 — bande avec `min` SEUL : refusée (la borne haute manque)', () => {
    expect(refus([sans(BANDE, 'max')])).toContain('exige « max »');
  });

  it('C4 — `misfire` avec `min` SEUL : refusé (une seule borne suffit à le mettre dans la table)', () => {
    expect(refus([{ ...MISFIRE, min: 1 }])).toContain('« min » n’appartient qu’au(x) cas kind');
  });

  it('un `kind` hors catalogue est refusé — le moteur ne sait jouer que les 8 déclarés', () => {
    expect(schema.safeParse([{ ...BANDE, kind: 'exploseLaTete' }]).success).toBe(false);
  });

  it('une entrée SANS `type` est refusée, et l’erreur nomme le chemin `[i].type`', () => {
    const r = schema.safeParse([BANDE, sans(MISFIRE, 'type')]);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.some((i) => i.path.join('.') === '1.type')).toBe(true);
  });

  // L'amputation POSE `maison` : le refine de PROVENANCE refuse DÉJÀ une entrée sans `source`, si bien
  // qu'un test naïf serait INERTE (rouge avec ou sans `exiges`). Provenance satisfaite, seule `exiges`
  // peut encore refuser — même piège que le describe « exigences d'enveloppe des defs ADOPTÉS » de
  // `src/data/schemas/grammaire/grammaire.test.ts`.
  it('une entrée SANS `source` est refusée — `exiges: [\'source\']` (folio 160 pour les 8)', () => {
    const sansSource = { ...sans(BANDE, 'source'), maison: 'sonde d’exigence — provenance satisfaite pour isoler `exiges`' };
    expect(schema.safeParse([sansSource]).success).toBe(false);
  });
});
