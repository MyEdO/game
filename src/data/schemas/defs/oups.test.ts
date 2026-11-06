/**
 * `oups.json` — UNE forme de ligne, la disjonction portée par la charge par `kind` (#1467 L1b V-UNION).
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

/** Bande minimale, et l'Incident de Tir — mêmes formes que la donnée réelle. */
const SOURCE = { book: 'livre-de-base', page: 160, note: 'Tableau des Oups !, LDB 14 l.21-30' } as const;
const BANDE = { id: 'bande', min: 1, max: 20, kind: 'selfWound', label: 'Vous vous blessez.', source: SOURCE } as const;
const MISFIRE = { id: 'misfire', kind: 'misfire', label: 'Incident de Tir !', source: SOURCE } as const;
/** Le document mono-table qui porte `lignes`. */
const table = (...lignes: object[]) => ({ id: 'tableau-des-oups', type: 'oups', label: 'Tableau des Oups !', die: 'd100', source: SOURCE, entries: lignes });

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

describe('oups.json — une ligne est une BANDE du dé ou l’Incident de Tir, jamais entre les deux', () => {
  it('TÉMOIN : le dataset RÉEL est accepté, et le couple minimal aussi', () => {
    expect(schema.safeParse(oupsJson).success).toBe(true);
    expect(schema.safeParse(table(BANDE, MISFIRE)).success).toBe(true);
  });

  it('C1 — `misfire` AVEC une bande : refusé, en nommant la borne hors de son cas', () => {
    expect(refus(table({ ...MISFIRE, min: 1, max: 20 }))).toMatch(/« min » n’appartient qu’au\(x\) cas kind « .*selfWound.* » — refusée sur « misfire » \(kind « misfire »\)/);
  });

  it('C2 — bande SANS `min` ni `max` : refusée, en nommant le `kind` fautif', () => {
    const message = refus(table(sans(sans(BANDE, 'min'), 'max')));
    expect(message).toContain('« bande » (kind « selfWound ») exige « min »');
    expect(message).toContain('« bande » (kind « selfWound ») exige « max »');
  });

  it('C3 — bande avec `min` SEUL : refusée (la borne haute manque)', () => {
    expect(refus(table(sans(BANDE, 'max')))).toContain('exige « max »');
  });

  it('C4 — `misfire` avec `min` SEUL : refusé (une seule borne suffit à le mettre dans la table)', () => {
    expect(refus(table({ ...MISFIRE, min: 1 }))).toContain('« min » n’appartient qu’au(x) cas kind');
  });

  it('un `kind` hors catalogue est refusé — le moteur ne sait jouer que les 8 déclarés', () => {
    expect(schema.safeParse(table({ ...BANDE, kind: 'exploseLaTete' })).success).toBe(false);
  });

  it('une ligne SANS `source` est refusée, et l’erreur nomme le chemin `entries.[i].source`', () => {
    const r = schema.safeParse(table(BANDE, sans(MISFIRE, 'source')));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.some((i) => i.path.join('.') === 'entries.1.source')).toBe(true);
  });

  it('le document SANS `die` est refusé : le dé de la table est une donnée (LDB 14 l.23-30)', () => {
    expect(schema.safeParse(sans(table(BANDE), 'die')).success).toBe(false);
  });
});
