/**
 * Garde des espaces de clés « race » (issue #163, recalée #1467 L1b V-P4). Le repo en porte seulement UN pour les races JOUABLES : l'id `RaceKey` (`schemas/grammaire/valeurs.ts`, #313).
 *  - `species.refChar` le porte côté données de personnage ;
 *  - chaque document de `names.json` porte cet id : `generateName` retrouve la banque sans conversion ;
 *  - `raceAppearance.json` (espace « rig », 21 races dont 14 non jouables) est keyé par le SLUG de
 *    son libellé, et les 7 races jouables y ont pour slug exactement leur `RaceKey`.
 * `speciesRace.json` (via `baseSpeciesOf`) reste le pont species→rig ; ce que cette garde verrouille
 * n'est plus une SÉPARATION mais la CONVERGENCE mesurée : le pont ramène chaque `refChar` sur l'id de
 * rig de même nom, et un id de rig qui cesserait d'être le slug de son libellé casserait la relation.
 */
import { describe, it, expect } from 'vitest';
import namesJson from './names.json';
import raceAppearanceJson from './raceAppearance.json';
import speciesJson from './species.json';
import { slugId } from './slug';
import { raceKeySchema, type RaceKey } from './schemas/grammaire/valeurs';
import { baseSpeciesOf } from '../gameIso/rig/skeletons';

type Species = { label: string; refChar: RaceKey };
const SPECIES = speciesJson as Species[];
/** Ids des 7 DOCUMENTS de banque (#1467 L1b V-FLIP-RECORD : `names.json` est une LISTE). */
const NAMES_KEYS = (namesJson as { id: string }[]).map((n) => n.id);
const RIG = raceAppearanceJson as { id: string; label: string }[];
const RIG_IDS = RIG.map((r) => r.id);
const RACE_KEYS = raceKeySchema.options;

describe('#163 — espaces de clés « race » : names keyé RaceKey, pont species→rig 1:1, ids de rig slugués', () => {
  it('les documents de names.json portent les RaceKey — exactement les 7 ids, ni plus ni moins', () => {
    expect(new Set(NAMES_KEYS)).toEqual(new Set<string>(RACE_KEYS));
    expect(NAMES_KEYS.length).toBe(RACE_KEYS.length);
  });

  it('pont species→rig 1:1 : chaque refChar mappe (via baseSpeciesOf) vers exactement UN id de rig existant', () => {
    const rigIds = new Set(RIG_IDS);
    const bridge = new Map<string, Set<string>>();
    for (const s of SPECIES) {
      const rig = baseSpeciesOf(s.label);
      expect(rigIds, `baseSpeciesOf(${JSON.stringify(s.label)}) = ${JSON.stringify(rig)} absent de raceAppearance.json`).toContain(rig);
      (bridge.get(s.refChar) ?? bridge.set(s.refChar, new Set()).get(s.refChar)!).add(rig);
    }
    const ambiguous = [...bridge].filter(([, rigs]) => rigs.size > 1).map(([refChar, rigs]) => `${refChar} → ${[...rigs].join(', ')}`);
    expect(ambiguous, 'refChar(s) pontant vers PLUSIEURS races de rig — le pont species→rig doit rester 1:1').toEqual([]);
  });

  it('convergence des deux espaces : le pont ramène chaque refChar sur l’id de rig de MÊME nom', () => {
    // Ce que la garde verrouillait avant #1467 L1b V-P4 était la SÉPARATION label⇄id ; l'identité est
    // la relation vraie — un préfixe de `speciesRace.json` mal placé la casse aussitôt.
    const ecarts = SPECIES.filter((s) => baseSpeciesOf(s.label) !== s.refChar)
      .map((s) => `${s.label} : refChar ${s.refChar} ⇄ rig ${baseSpeciesOf(s.label)}`);
    expect(ecarts, 'refChar(s) dont le pont ne rejoint pas l’id de rig homonyme').toEqual([]);
    for (const k of RACE_KEYS) expect(RIG_IDS, `RaceKey ${k} sans race de rig`).toContain(k);
  });

  it('chaque id de rig est le slug de son propre label (21/21) — l’identité ne se relit plus dans l’affichage', () => {
    const fautes = RIG.filter((r) => r.id !== slugId(r.label)).map((r) => `${r.id} ≠ slugId(${JSON.stringify(r.label)})`);
    expect(fautes, fautes.join('\n')).toEqual([]);
    expect(new Set(RIG_IDS).size).toBe(RIG.length);
  });
});
