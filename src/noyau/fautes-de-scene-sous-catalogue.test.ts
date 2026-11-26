/**
 * Les fautes CROISÉES d'une scène sous le catalogue passé (#5070, `docs/plans/2026-11-25-composition-d-un-jeu.md`
 * § 5.1, point 2) : le cap d'un navire à ponts, la munition et la pièce d'un poste, la pose des ponts. Fixtures : un
 * navire à ponts, une pièce, deux munitions, présents SEULEMENT dans le catalogue de la suite (`catalogueAvec`).
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { buildScene } from './mapSpec';
import { sceneAvecLEntite } from './sceneEdit';
import { capsDeLaPose } from './sceneEditLecture';
import { catalogueAvec } from '../data/catalogueAvec.testkit';
import { catalogueDuProcessus } from '../data/catalogueDuProcessus';
import { parserSousCatalogue } from '../data/schemas/catalogue/references';
import { entreeDe } from '../data/schemas/catalogue/catalogue';
import { affinerAvecCatalogues, sousLeCatalogue } from '../data/schemas/grammaire/ref';
import { sceneEntitySchema, sceneSchema } from '../data/schemas/defs-scenes/scene';
import { garanti } from '../lib/garanti';
import type { SceneEntity } from './monde/scene';

const NAVIRE = 'navire-a-ponts-du-livre-de-test';
const PIECE = 'piece-du-livre-de-test';
const BOULET = 'boulet-du-livre-de-test';
const FLECHE = 'fleche-du-livre-de-test';

const base = catalogueDuProcessus();
const copie = <E extends { id: string }>(entrees: readonly E[], id: string, neuf: string): E => ({ ...garanti(entrees.find((e) => e.id === id), id, 'entrée copiée'), id: neuf });
/** La pièce copiée du canon moyen, sans liste de munitions : elle charge sa famille (`chargeLArme`). */
const { munitions: _munitions, ...piece } = copie(base['siege-engines.json'], 'canon-moyen', PIECE);

const CAT = catalogueAvec({
  'vehicles.json': [copie(base['vehicles.json'], 'caraque', NAVIRE)],
  'siege-engines.json': [piece],
  'trappings.json': [copie(base['trappings.json'], 'boulet-et-poudre', BOULET), copie(base['trappings.json'], 'fleche', FLECHE)],
});

const navire = (facing: SceneEntity['facing'], corps: Partial<SceneEntity> = {}): SceneEntity =>
  ({ id: 'n', kind: 'personnage', pos: { x: 10, y: 2 }, vehicule: { id: NAVIRE }, facing, ...corps });

const fautesCustom = (r: z.ZodSafeParseResult<unknown>) => (r.error?.issues ?? []).filter((i) => i.code === 'custom').map(({ path, message }) => ({ path, message }));

describe('les fautes croisées d’une entité de scène se jugent contre le catalogue passé', () => {
  it('le cap d’un navire à ponts du seul catalogue : cardinal admis, diagonal refusé à `facing`', () => {
    expect(parserSousCatalogue(sceneEntitySchema, navire('N'), CAT).success).toBe(true);
    expect(fautesCustom(parserSousCatalogue(sceneEntitySchema, navire('NE'), CAT))).toEqual([
      { path: ['facing'], message: `navire « ${NAVIRE} » au cap NE — un navire à ponts ne prend qu'un cap cardinal (N/E/S/O)` },
    ]);
  });

  it('la munition et la pièce d’un poste du seul catalogue : la munition de sa famille est chargée, une flèche refusée à son coffre', () => {
    const poste = (ammo: Record<string, number>) => navire('N', { postes: [{ engin: { id: PIECE }, ammo }] });
    expect(parserSousCatalogue(sceneEntitySchema, poste({ [BOULET]: 2 }), CAT).success).toBe(true);
    expect(fautesCustom(parserSousCatalogue(sceneEntitySchema, poste({ [BOULET]: 2, [FLECHE]: 1 }), CAT))).toEqual([
      { path: ['postes', 0, 'ammo', FLECHE], message: `munition « ${FLECHE} » que la pièce « ${PIECE} » ne charge pas` },
    ]);
  });

  it('un `safeParse` nu, hors fenêtre, juge contre le catalogue du processus : la caraque au cap diagonal est refusée', () => {
    expect(fautesCustom(sceneEntitySchema.safeParse(navire('NE', { vehicule: { id: 'caraque' } })))).toEqual([
      { path: ['facing'], message: "navire « caraque » au cap NE — un navire à ponts ne prend qu'un cap cardinal (N/E/S/O)" },
    ]);
  });
});

describe('la pose des ponts d’une scène se juge contre le catalogue passé', () => {
  /** Le bassin, son navire du seul catalogue au cap O, en (`x`, 2) : la case 7 est le bord exact, la case 6 déborde (#3994). */
  const bassin = (x: number) => {
    const scene = buildScene({ id: 'bassin', label: 'Bassin', size: [24, 24], terrain: 'eau', entities: [{ id: 'c1', kind: 'personnage', vehicule: { id: 'caraque' }, pos: { x: 7, y: 2 }, facing: 'O' }] });
    return { ...scene, entities: scene.entities.map((e) => ({ ...e, vehicule: { id: NAVIRE }, pos: { x, y: 2 } })) };
  };
  const pontsHorsDeLaCarte = (r: z.ZodSafeParseResult<unknown>) => fautesCustom(r).filter((f) => f.message.startsWith('ponts du navire hors de la carte'));

  it('au bord exact les ponts se posent, une case de trop les fait déborder, dit à la position du navire', () => {
    expect(parserSousCatalogue(sceneSchema, bassin(7), CAT).success).toBe(true);
    expect(pontsHorsDeLaCarte(parserSousCatalogue(sceneSchema, bassin(6), CAT))).toEqual([
      { path: ['entities', 0, 'pos'], message: expect.stringContaining('carte 24×24') },
    ]);
  });
});

describe('l’éditeur juge l’entité écrite sous le catalogue reçu (`sceneAvecLEntite`)', () => {
  it('le cap diagonal d’un navire à ponts du seul catalogue est refusé sous lui, admis sous le catalogue du processus', () => {
    const avant = navire('N');
    const scene = { ...buildScene({ id: 'bassin', label: 'Bassin', size: [24, 24], terrain: 'eau' }), entities: [avant] };
    expect(sceneAvecLEntite(scene, avant, { ...avant, facing: 'NE' }, CAT)).toEqual({ ok: false, refus: { regle: `navire « ${NAVIRE} » au cap NE — un navire à ponts ne prend qu'un cap cardinal (N/E/S/O)` } });
    expect(sceneAvecLEntite(scene, avant, { ...avant, facing: 'NE' }, catalogueDuProcessus()).ok).toBe(true);
  });
});

describe('l’inspecteur offre les caps sous le catalogue reçu (`capsDeLaPose`)', () => {
  it('un navire à ponts du seul catalogue n’est offert qu’aux caps cardinaux', () => {
    const ent = navire('N');
    const scene = { ...buildScene({ id: 'bassin', label: 'Bassin', size: [24, 24], terrain: 'eau' }), entities: [ent] };
    expect(capsDeLaPose(scene, ent, CAT).caps.map((c) => c.cap)).toEqual(['N', 'E', 'S', 'O']);
  });
});

describe('la fenêtre `{ ids, cat }` est bornée à son appel', () => {
  /** Une sonde qui dit si le catalogue jugé porte le navire du livre de test (`catalogueLu`). */
  const sonde = affinerAvecCatalogues(z.string(), (lire) => {
    const cat = lire.catalogueLu('vehicle');
    return (_, ctx) => {
      if (entreeDe('vehicles', NAVIRE, cat())) ctx.addIssue({ code: 'custom', message: 'vu' });
    };
  });
  const voit = (r: z.ZodSafeParseResult<unknown>) => !r.success;
  const aucunId = () => new Set<string>();

  it('hors fenêtre le catalogue du processus, sous elle le sien, l’imbrication rendue à l’englobante', () => {
    expect(voit(sonde.safeParse('x'))).toBe(false);
    expect(voit(parserSousCatalogue(sonde, 'x', CAT))).toBe(true);
    expect(sousLeCatalogue(aucunId, CAT, () => [voit(sonde.safeParse('x')), voit(parserSousCatalogue(sonde, 'x', base)), voit(sonde.safeParse('x'))])).toEqual([true, false, true]);
    expect(voit(sonde.safeParse('x'))).toBe(false);
  });

  it('une levée sous la fenêtre la rend à la précédente', () => {
    expect(() => sousLeCatalogue(aucunId, CAT, () => { throw new Error('levée du livre de test'); })).toThrow('levée du livre de test');
    expect(voit(sonde.safeParse('x'))).toBe(false);
  });
});
