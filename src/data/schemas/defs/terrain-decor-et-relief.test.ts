/**
 * #2968 L11 — le terrain, le décor de recouvrement d'un terrain et la matière de relief se désignent par
 * `ref(type)` (`{ id }` refiné au parse contre l'index des ids), une couche de tuiles par `refs('terrain')`.
 * Fixtures : référence connue, inconnue, écrite en id nu, hors de sa sous-liste, et liste.
 */
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { schema as schemaDefauts } from './defauts-de-compilation';
import { schema as schemaSemences } from './semences-de-scene';
import { schema as schemaTerrains } from './terrains';
import { schema as schemaTraits } from './traits';
import { layerSchema, sceneSchema } from '../defs-scenes/scene';
import defautsJson from '../../defauts-de-compilation.json';
import semencesJson from '../../semences-de-scene.json';
import terrainsJson from '../../terrains.json';
import traitsJson from '../../traits.json';
import areneProjet from '../../../scenes/arene/arene-projet.json';

type Entree = Record<string, unknown>;

const messages = (schema: z.ZodType, doc: unknown): string => {
  const r = schema.safeParse(doc);
  expect(r.success, 'le document a parsé alors qu’il devait être REFUSÉ').toBe(false);
  return r.success ? '' : r.error.issues.map((i) => i.message).join(' ');
};

/** L'entrée `id` de `doc`. */
const entree = (doc: readonly Entree[], id: string): Entree => {
  const e = doc.find((x) => x.id === id);
  expect(e, `${id} absent`).toBeDefined();
  return structuredClone(e ?? {});
};

/** Le document `doc` entier, son entrée `id` portant `cle` à `valeur` : un rôle de collection (`terrains.json ›
 *  absence`) se compte sur toutes les entrées. */
const avec = (doc: readonly Entree[], id: string, cle: string, valeur: unknown): Entree[] => doc.map((e) => (e.id === id ? { ...entree(doc, id), [cle]: valeur } : e));

/** Le trait `id`, son op `offTerrainMod` portant `terrain` à `valeur`. */
const horsDeSonTerrain = (id: string, valeur: unknown): Entree[] => {
  const t = entree(traitsJson, id);
  const passifs = Array.isArray(t.passive) ? t.passive : [];
  return [{ ...t, passive: passifs.map((o: Entree) => (o.op === 'offTerrainMod' ? { ...o, terrain: valeur } : o)) }];
};

/** La première scène de l'Arène, sa falaise portant `valeur`. */
const sceneAFalaise = (valeur: unknown): Entree => {
  const s: Entree = structuredClone(areneProjet.scenes[0]);
  return { ...s, reliefDefaults: { ...structuredClone(areneProjet.scenes[0].reliefDefaults), cliff: valeur } };
};

const PORTEURS = [
  { porteur: 'defauts-de-compilation.json › cheminDeRonde', schema: schemaDefauts, doc: (v: unknown) => ({ ...defautsJson, cheminDeRonde: v }), connue: 'pave', refus: 'est absent du catalogue des terrains' },
  { porteur: 'defauts-de-compilation.json › masse', schema: schemaDefauts, doc: (v: unknown) => ({ ...defautsJson, masse: v }), connue: 'roche', refus: 'est absent du catalogue des terrains' },
  { porteur: 'defauts-de-compilation.json › pont', schema: schemaDefauts, doc: (v: unknown) => ({ ...defautsJson, pont: v }), connue: 'plancher', refus: 'est absent du catalogue des terrains' },
  { porteur: 'semences-de-scene.json › terrain', schema: schemaSemences, doc: (v: unknown) => ({ ...semencesJson, terrain: v }), connue: 'terre', refus: 'est absent du catalogue des terrains' },
  { porteur: 'semences-de-scene.json › reliefDefaults.cliff', schema: schemaSemences, doc: (v: unknown) => ({ ...semencesJson, reliefDefaults: { ...semencesJson.reliefDefaults, cliff: v } }), connue: 'pierre', refus: 'est hors de la sous-liste « relief » du catalogue des matières' },
  { porteur: 'traits.json › passive[].terrain', schema: schemaTraits, doc: (v: unknown) => horsDeSonTerrain('aquatique', v), connue: 'lave', refus: 'est absent du catalogue des terrains' },
  { porteur: 'terrains.json › overlayProp', schema: schemaTerrains, doc: (v: unknown) => avec(terrainsJson, 'bois', 'overlayProp', v), connue: 'arbre', refus: 'est absent du catalogue des décors' },
  { porteur: 'terrains.json › matiere', schema: schemaTerrains, doc: (v: unknown) => avec(terrainsJson, 'mur', 'matiere', v), connue: 'terre', refus: 'est hors de la sous-liste « relief » du catalogue des matières' },
  { porteur: 'arene-projet.json › scenes[].reliefDefaults.cliff', schema: sceneSchema, doc: sceneAFalaise, connue: 'pierre', refus: 'est hors de la sous-liste « relief » du catalogue des matières' },
];

describe('#2968 L11 — terrain, décor et matière de relief désignés par `ref(type)`', () => {
  it('les documents réels parsent', () => {
    expect(schemaDefauts.safeParse(defautsJson).success).toBe(true);
    expect(schemaSemences.safeParse(semencesJson).success).toBe(true);
    expect(schemaTerrains.safeParse(terrainsJson).success).toBe(true);
    expect(schemaTraits.safeParse(traitsJson).success).toBe(true);
    for (const scene of areneProjet.scenes) expect(sceneSchema.safeParse(scene).success, scene.id).toBe(true);
  });

  it.each(PORTEURS)('$porteur : une référence connue parse', ({ schema, doc, connue }) => {
    expect(schema.safeParse(doc({ id: connue })).success).toBe(true);
  });

  it.each(PORTEURS)('$porteur : une référence inconnue est refusée, son catalogue nommé', ({ schema, doc, refus }) => {
    expect(messages(schema, doc({ id: 'cible-inexistante' }))).toContain(`« cible-inexistante » ${refus}`);
  });

  it.each(PORTEURS)('$porteur : une référence écrite en id nu est refusée', ({ schema, doc, connue }) => {
    expect(schema.safeParse(doc(connue)).success).toBe(false);
  });

  it.each(PORTEURS.filter((p) => p.refus.includes('« relief »')))('$porteur : une matière hors du relief est refusée, sa sous-liste nommée', ({ schema, doc }) => {
    expect(messages(schema, doc({ id: 'toit-ardoise' }))).toContain('« toit-ardoise » est hors de la sous-liste « relief » du catalogue des matières');
  });

  describe('`layers[].tiles` : liste de terrains (`refs`)', () => {
    it('une couche de terrains connus parse', () => {
      expect(layerSchema.safeParse({ z: 0, tiles: ['herbe', 'pave'] }).success).toBe(true);
    });

    it('un terrain inconnu dans la couche est refusé, son catalogue nommé', () => {
      expect(messages(layerSchema, { z: 0, tiles: ['herbe', 'terrain-inexistant'] })).toContain('« terrain-inexistant » est absent du catalogue des terrains');
    });
  });
});
