/**
 * Garde des CLÉS de `REF_FIELD` (`ui/compendium/refField/RefField.tsx`) — une clé qui ne désigne AUCUN champ
 * réel ne casse rien : `refFieldCfg` retombe simplement sur `undefined` et le picker Codex DISPARAÎT
 * en silence (le champ retombe sur la saisie générique). Un renommage de champ en donnée
 * (`qualities.type` → `qualities.polarite`, #1467 L1b V-P5) laissait donc une config ORPHELINE
 * qu'aucune assertion de la suite ne voyait.
 *
 * Le champ est cherché LÀ OÙ IL EST DÉCLARÉ — dans le def zod du dataset —, pas seulement là où il
 * est peuplé : un champ déclaré mais qu'aucune entrée ne porte encore reste une config légitime.
 * La déclaration se MESURE par SONDE de parse (aucun accès aux internes de zod) : on repose sur une
 * entrée réelle une valeur qu'aucun schéma de champ n'accepte, et on lit le verdict —
 *  - `unrecognized_keys` (le `strictObject` du def refuse la clé) ⇒ champ NON déclaré ;
 *  - toute autre plainte, portée par le CHEMIN du champ ⇒ champ déclaré.
 * Un dataset sans schéma registré retombe sur la projection d'atelier (`inferFields`, celle de
 * `CodexEdit`) — jamais un laissez-passer.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { CODEX } from '../registry';
import { inferFields } from '../editFields';
import { REF_FIELD } from './RefField';
import { isEditableCategory, editableEntries } from '../../editor/codex/CodexEdit';
import { schemaForFile } from '../../../data/schemas/validate';

/** Valeur qu'aucun schéma de champ de la base n'accepte — sert d'appât au parse. */
const SONDE = Symbol('sonde-ref-field');

describe('REF_FIELD — chaque clé désigne un champ RÉEL du Codex', () => {
  const editable = CODEX.filter((c) => isEditableCategory(c.key));
  /** Champs PEUPLÉS par catégorie éditable — la projection de `CodexEdit`, jamais une liste tenue à la main. */
  const peuples = new Map<string, Set<string>>(
    editable.map((c) => [c.key, new Set(inferFields(editableEntries(c.key) as Record<string, unknown>[]).map((f) => f.key))]),
  );

  /** Le def du dataset DÉCLARE-t-il ce champ ? `undefined` = pas de schéma registré (repli appelant). */
  function declare(categorie: string, champ: string): boolean | undefined {
    const schema = schemaForFile(`${categorie}.json`);
    const entrees = editableEntries(categorie) as Record<string, unknown>[];
    if (!schema || !Array.isArray(entrees) || !entrees.length) return undefined;
    const sonde = entrees.map((e, i) => (i === 0 ? { ...e, [champ]: SONDE } : e));
    const r = schema.safeParse(sonde);
    if (r.success) return undefined; // le champ passe tel quel (schéma permissif) — non concluant
    const issues = (r.error as z.ZodError).issues;
    const refuseLaCle = issues.some((iss) => iss.code === 'unrecognized_keys' && `keys` in iss && (iss as { keys: string[] }).keys.includes(champ));
    return !refuseLaCle;
  }

  it('la sonde de déclaration DISCRIMINE (un champ inventé est refusé, un champ connu ne l’est pas)', () => {
    expect(declare('qualities', 'champ-qui-nexiste-pas')).toBe(false);
    expect(declare('qualities', 'polarite')).toBe(true);
  });

  it('aucune clé ORPHELINE (catégorie inconnue, ou champ absent du def)', () => {
    expect(Object.keys(REF_FIELD).length).toBeGreaterThan(0);
    expect(editable.length).toBeGreaterThan(0);
    const orphelines: string[] = [];
    for (const cle of Object.keys(REF_FIELD)) {
      const point = cle.indexOf('.');
      if (point < 0) {
        // Repli GLOBAL par nom de champ : il suffit qu'une catégorie éditable le porte.
        if (![...peuples.values()].some((champs) => champs.has(cle))) {
          orphelines.push(`${cle} — repli global : AUCUNE catégorie éditable ne porte ce champ`);
        }
        continue;
      }
      const cat = cle.slice(0, point);
      const champ = cle.slice(point + 1);
      const champs = peuples.get(cat);
      if (!champs) { orphelines.push(`${cle} — catégorie « ${cat} » inconnue ou non éditable`); continue; }
      if (champs.has(champ)) continue; // peuplé : rien à prouver de plus
      const declared = declare(cat, champ);
      if (declared === false) orphelines.push(`${cle} — champ « ${champ} » ni peuplé ni déclaré par le def de ${cat}.json`);
      else if (declared === undefined) orphelines.push(`${cle} — champ « ${champ} » non peuplé et INVÉRIFIABLE (pas de schéma registré pour ${cat}.json)`);
    }
    expect(orphelines, `config(s) REF_FIELD orpheline(s) — le picker Codex a disparu en silence :\n${orphelines.join('\n')}`).toEqual([]);
  });
});
