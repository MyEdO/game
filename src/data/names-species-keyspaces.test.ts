/**
 * Garde des espaces de clés « race » (issue #163, recalée #1467 L1b V-P4). Le repo en porte seulement UN pour les races JOUABLES : l'id `RaceKey` (`schemas/grammaire/valeurs.ts`, #313).
 *  - `species.refChar` le porte côté données de personnage ;
 *  - chaque document de `names.json` porte cet id : `generateName` retrouve la banque sans conversion ;
 *  - `raceAppearance.json` (21 races dont 14 non jouables) est keyé par le SLUG de son libellé, et
 *    les 7 races jouables y ont pour slug exactement leur `RaceKey`.
 */
import { describe, it, expect } from 'vitest';
import namesJson from './names.json';
import raceAppearanceJson from './raceAppearance.json';
import { slugId } from './slug';
import { raceKeySchema } from './schemas/grammaire/valeurs';

/** Ids des 7 DOCUMENTS de banque (#1467 L1b V-FLIP-RECORD : `names.json` est une LISTE). */
const NAMES_KEYS = (namesJson as { id: string }[]).map((n) => n.id);
const RACES = raceAppearanceJson as { id: string; label: string }[];
const RACE_IDS = RACES.map((r) => r.id);
const RACE_KEYS = raceKeySchema.options;

describe('#163 — espaces de clés « race » : names keyé RaceKey, ids de race slugués', () => {
  it('les documents de names.json portent les RaceKey — exactement les 7 ids, ni plus ni moins', () => {
    expect(new Set(NAMES_KEYS)).toEqual(new Set<string>(RACE_KEYS));
    expect(NAMES_KEYS.length).toBe(RACE_KEYS.length);
  });

  it('chaque id de race est le slug de son propre label (21/21) — l’identité ne se relit plus dans l’affichage', () => {
    for (const k of RACE_KEYS) expect(RACE_IDS, `RaceKey ${k} sans race`).toContain(k);
    const fautes = RACES.filter((r) => r.id !== slugId(r.label)).map((r) => `${r.id} ≠ slugId(${JSON.stringify(r.label)})`);
    expect(fautes, fautes.join('\n')).toEqual([]);
    expect(new Set(RACE_IDS).size).toBe(RACES.length);
  });
});
