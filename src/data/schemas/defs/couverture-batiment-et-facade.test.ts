/**
 * #2968 L12 — la matière de couverture, le type de bâtiment et la structure de façade par défaut se désignent par
 * `ref(type)` (`{ id }` refiné au parse contre l'index des ids). Fixtures : référence connue, inconnue, écrite en
 * id nu, hors de sa sous-liste, et liste.
 */
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { schema as schemaBuildings } from './buildings';
import { schema as schemaSemences } from './semences-de-scene';
import { sceneSchema } from '../defs-scenes/scene';
import buildingsJson from '../../buildings.json';
import semencesJson from '../../semences-de-scene.json';
import areneProjet from '../../../scenes/arene/arene-projet.json';

type Entree = Record<string, unknown>;

const messages = (schema: z.ZodType, doc: unknown): string => {
  const r = schema.safeParse(doc);
  expect(r.success, 'le document a parsé alors qu’il devait être REFUSÉ').toBe(false);
  return r.success ? '' : r.error.issues.map((i) => i.message).join(' ');
};

/** La première scène de l'Arène qui porte un corps architectural, ce corps passé par `corps`. */
const sceneAuCorps = (corps: (c: Entree) => Entree): Entree => {
  const s = areneProjet.scenes.find((x) => x.architecture?.length);
  expect(s, 'aucune scène de l’Arène ne porte de corps : le cas n’est plus exerçable').toBeDefined();
  const scene: Entree = structuredClone(s ?? {});
  const [premier, ...autres] = (scene.architecture ?? []) as Entree[];
  return { ...scene, architecture: [corps(premier), ...autres] };
};

/** Les masses de `c`, chacune passée par `masse`. */
const masses = (c: Entree, masse: (m: Entree, i: number) => Entree): Entree => ({ ...c, masses: (c.masses as Entree[]).map(masse) });

const COUVERTURE = 'est hors de la sous-liste « roof » du catalogue des matières';

const PORTEURS = [
  { porteur: 'buildings.json › roofMaterial', schema: schemaBuildings, doc: (v: unknown) => buildingsJson.map((b) => (b.id === 'forge' ? { ...structuredClone(b), roofMaterial: v } : b)), connue: 'chaume', refus: COUVERTURE },
  { porteur: 'semences-de-scene.json › roofDefaults.material', schema: schemaSemences, doc: (v: unknown) => ({ ...semencesJson, roofDefaults: { ...semencesJson.roofDefaults, material: v } }), connue: 'tuile', refus: COUVERTURE },
  { porteur: 'semences-de-scene.json › facade', schema: schemaSemences, doc: (v: unknown) => ({ ...semencesJson, facade: v }), connue: 'mur-en-pierre', refus: 'est absent du catalogue des structures' },
  { porteur: 'arene-projet.json › scenes[].roofDefaults.material', schema: sceneSchema, doc: (v: unknown) => ({ ...areneProjet.scenes[0], roofDefaults: { ...areneProjet.scenes[0].roofDefaults, material: v } }), connue: 'chaume', refus: COUVERTURE },
  { porteur: 'arene-projet.json › scenes[].architecture[].roofDefaults.material', schema: sceneSchema, doc: (v: unknown) => sceneAuCorps((c) => ({ ...c, roofDefaults: { material: v } })), connue: 'chaume', refus: COUVERTURE },
  { porteur: 'arene-projet.json › scenes[].architecture[].masses[].material', schema: sceneSchema, doc: (v: unknown) => sceneAuCorps((c) => masses(c, (m, i) => (i === 0 ? { ...m, material: v } : m))), connue: 'chaume', refus: COUVERTURE },
  { porteur: 'arene-projet.json › scenes[].architecture[].style', schema: sceneSchema, doc: (v: unknown) => sceneAuCorps((c) => ({ ...c, style: v })), connue: 'taverne', refus: 'est absent du catalogue des bâtiments' },
];

describe('#2968 L12 — couverture, type de bâtiment et façade désignés par `ref(type)`', () => {
  it('les documents réels parsent', () => {
    expect(schemaBuildings.safeParse(buildingsJson).success).toBe(true);
    expect(schemaSemences.safeParse(semencesJson).success).toBe(true);
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

  it.each(PORTEURS.filter((p) => p.refus === COUVERTURE))('$porteur : une matière hors de la toiture est refusée, sa sous-liste nommée', ({ schema, doc }) => {
    expect(messages(schema, doc({ id: 'terre' }))).toContain(`« terre » ${COUVERTURE}`);
  });

  it('liste des masses d’un corps : chaque masse est jugée, une seule couverture inconnue refuse le corps', () => {
    const scene = sceneAuCorps((c) => masses(c, (m, i) => ({ ...m, material: { id: i === 1 ? 'cible-inexistante' : 'tuile' } })));
    expect(((scene.architecture as Entree[])[0].masses as Entree[]).length, 'un corps à une seule masse ne fait pas une liste').toBeGreaterThan(1);
    expect(messages(sceneSchema, scene)).toContain(`« cible-inexistante » ${COUVERTURE}`);
    expect(sceneSchema.safeParse(sceneAuCorps((c) => masses(c, (m) => ({ ...m, material: { id: 'tuile' } })))).success).toBe(true);
  });
});
