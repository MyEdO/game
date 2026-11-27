/**
 * Les fautes CROISÉES d'une scène sous le catalogue passé (#5070, `docs/plans/2026-11-25-composition-d-un-jeu.md`
 * § 5.1, point 2) : le cap d'un navire à ponts, la munition et la pièce d'un poste, la pose des ponts, la carrière et le
 * profil, la Cible d'individu. Fixtures déclarées par la suite, présentes SEULEMENT dans son catalogue : un navire à
 * ponts, une pièce et deux munitions de familles d'armes forgées, deux créatures, l'une au Groupe skaven, un Trait à
 * Cible.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { buildScene } from './mapSpec';
import { sceneAvecLEntite } from './sceneEdit';
import { capsDeLaPose, type ProjetDEdition } from './sceneEditLecture';
import { catalogueAvec } from '../data/catalogueAvec.testkit';
import { catalogueDuProcessus } from '../data/catalogueDuProcessus';
import { catalogueDeTest, type LivreDeTest } from '../data/schemas/catalogue/catalogueDeTest.testkit';
import { idDeFixture } from '../data/idDeFixture.testkit';
import { datasetArray, resetData, setDataset } from '../data/overrides';
import { parserSousCatalogue } from '../data/schemas/catalogue/references';
import { entreeDe } from '../data/schemas/catalogue/catalogue';
import { affinerAvecCatalogues, sousLeCatalogue } from '../data/schemas/grammaire/ref';
import { sceneEntitySchema, sceneSchema } from '../data/schemas/defs-scenes/scene';
import { NAVIRE, navire, navireDuLivreDeTest } from './navireDuLivreDeTest.testkit';
import { ouvrirLEdition, editer } from './edition/session';
import { emptyNarratif } from './monde/campaignNarratif';
import { emptyScene, type Scene, type SceneEntity } from './monde/scene';
import { flowFromEffects } from './monde/flow';
import { validateScene } from './validateScene';
import type { Catalogue } from '../data/schemas/catalogue/catalogue';
import type { CustomStatblock } from '../engine/statblock';
import { inspecteurDeLaSession } from '../hote/editeur';
import { dotationsDuPnj, emplacementsDeDotation } from '../engine/trappingChoices';

afterEach(() => resetData());

const PIECE = 'piece-du-livre-de-test';
const BOULET = 'boulet-du-livre-de-test';
const FLECHE = 'fleche-du-livre-de-test';
const SKAVEN = 'skaven-du-livre-de-test';
const HUMAIN = 'humain-du-livre-de-test';
/** La famille d'armes de la pièce et de sa munition, et une autre famille. */
const FAMILLE = idDeFixture('weaponGroup', 'famille-du-livre-de-test');
const AUTRE_FAMILLE = idDeFixture('weaponGroup', 'autre-famille-du-livre-de-test');
const SOURCE = { book: 'livre-du-catalogue-de-test', page: 1 };
/** Le Groupe auquel le canon ratling est réservé. */
const GROUPE_SKAVEN = idDeFixture('groupe', 'skaven');

/** La pièce, sans liste de munitions : elle charge sa famille (`chargeLArme`). */
const piece: NonNullable<LivreDeTest['siege-engines.json']>[number] = { id: PIECE, type: 'siege-engines', label: 'Pièce', categorie: 'distance', subType: { id: FAMILLE }, qualities: [], availability: 'commune', price: { gold: 0, silver: 0, brass: 0 }, source: SOURCE };
/** La munition `id` de la famille `famille`. */
const munition = (id: string, famille: typeof FAMILLE): NonNullable<LivreDeTest['trappings.json']>[number] => ({ id, type: 'trappings', label: id, categorie: 'ammunition', subType: { id: famille }, qualities: [], availability: 'commune', price: { gold: 0, silver: 0, brass: 0 }, source: SOURCE });

const CAT = catalogueDeTest({
  'vehicles.json': [navireDuLivreDeTest()],
  'siege-engines.json': [piece],
  'trappings.json': [munition(BOULET, FAMILLE), munition(FLECHE, AUTRE_FAMILLE)],
});
/** La créature `id` à Blessures (`char.B`), aux Groupes `groupes`. */
const creatureAuxGroupes = (id: string, groupes: (typeof GROUPE_SKAVEN)[]): NonNullable<LivreDeTest['creatures.json']>[number] => ({
  id, type: 'creatures', label: id, source: SOURCE, title: null, folder: null, char: { B: 10 },
  traits: [], optionals: [], skills: [], talents: [], trappings: [], spells: [], grantGroups: groupes, appearance: { species: 'humain' },
});
/** Les deux créatures déclarées, l'une au Groupe skaven, l'autre sans Groupe, sur la base vivante, qui porte encore la carrière du Soldat et le canon ratling
 *  (`levelsForCareer`, `dotationsDuPnj`, #5076). */
const SOUS_LES_CREATURES = catalogueAvec({ 'creatures.json': [creatureAuxGroupes(SKAVEN, [GROUPE_SKAVEN]), creatureAuxGroupes(HUMAIN, [])] });

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

  it('un `safeParse` nu, hors fenêtre, juge contre le catalogue du processus : le navire posé au seam, au cap diagonal, est refusé', () => {
    setDataset('vehicles', [...datasetArray('vehicles'), navireDuLivreDeTest()]);
    expect(fautesCustom(sceneEntitySchema.safeParse(navire('NE')))).toEqual([
      { path: ['facing'], message: `navire « ${NAVIRE} » au cap NE — un navire à ponts ne prend qu'un cap cardinal (N/E/S/O)` },
    ]);
  });
});

describe('la pose des ponts d’une scène se juge contre le catalogue passé', () => {
  /** Le bassin, son navire du seul catalogue au cap O, en (`x`, 2) : la case 7 est le bord exact, la case 6 déborde,
   *  par son pont de 17 cases sur l'empreinte 3 de sa coque (#3994). */
  const bassin = (x: number) => ({ ...emptyScene('bassin', 24, 24), entities: [navire('O', { pos: { x, y: 2 } })] });
  const pontsHorsDeLaCarte = (r: z.ZodSafeParseResult<unknown>) => fautesCustom(r).filter((f) => f.message.startsWith('ponts du navire hors de la carte'));

  it('au bord exact les ponts se posent, une case de trop les fait déborder, dit à la position du navire', () => {
    expect(pontsHorsDeLaCarte(parserSousCatalogue(sceneSchema, bassin(7), CAT))).toEqual([]);
    expect(pontsHorsDeLaCarte(parserSousCatalogue(sceneSchema, bassin(6), CAT))).toEqual([
      { path: ['entities', 0, 'pos'], message: expect.stringContaining('carte 24×24') },
    ]);
  });
});

describe('l’éditeur juge l’entité écrite sous le catalogue reçu (`sceneAvecLEntite`)', () => {
  it('le cap diagonal d’un navire à ponts du seul catalogue est refusé sous lui, admis sous le catalogue du processus', () => {
    const avant = navire('N');
    const scene = { ...emptyScene('bassin', 24, 24), entities: [avant] };
    expect(sceneAvecLEntite(scene, avant, { ...avant, facing: 'NE' }, CAT)).toEqual({ ok: false, refus: { regle: `navire « ${NAVIRE} » au cap NE — un navire à ponts ne prend qu'un cap cardinal (N/E/S/O)` } });
    expect(sceneAvecLEntite(scene, avant, { ...avant, facing: 'NE' }, catalogueDuProcessus()).ok).toBe(true);
  });
});

describe('l’inspecteur offre les caps sous le catalogue reçu (`capsDeLaPose`)', () => {
  it('un navire à ponts du seul catalogue n’est offert qu’aux caps cardinaux', () => {
    const ent = navire('N');
    const scene = { ...emptyScene('bassin', 24, 24), entities: [ent] };
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
    expect(sousLeCatalogue(aucunId, CAT, () => [voit(sonde.safeParse('x')), voit(parserSousCatalogue(sonde, 'x', catalogueDeTest({}))), voit(sonde.safeParse('x'))])).toEqual([true, false, true]);
    expect(voit(sonde.safeParse('x'))).toBe(false);
  });

  it('une levée sous la fenêtre la rend à la précédente', () => {
    expect(() => sousLeCatalogue(aucunId, CAT, () => { throw new Error('levée du livre de test'); })).toThrow('levée du livre de test');
    expect(voit(sonde.safeParse('x'))).toBe(false);
  });
});

describe('le parcours de carrière d’une entité se juge au profil de sa créature du catalogue passé', () => {
  /** Le joker nu du Soldat de Niveau 2 : le canon ratling y est une valeur pour un skaven, pas pour un humain
   *  (arbitrage #4110, 2026-11-16, `src/engine/pnjDeCarriere.test.ts`). */
  const joker = emplacementsDeDotation(dotationsDuPnj('soldat', 2)).find((e) => e.sorte === 'joker' && e.ref.groupe === undefined)!;
  const soldat = (creature: string): SceneEntity => ({ id: 'r', kind: 'personnage', creature: { id: creature }, pos: { x: 1, y: 1 }, carrieres: { soldat: 2 }, dotationsDeCarriere: { [joker.adresse]: 'canon-ratling' } });

  it('le canon ratling du joker est admis au skaven du seul catalogue, refusé à l’humain du seul catalogue', () => {
    expect(parserSousCatalogue(sceneEntitySchema, soldat(SKAVEN), SOUS_LES_CREATURES).success).toBe(true);
    expect(fautesCustom(parserSousCatalogue(sceneEntitySchema, soldat(HUMAIN), SOUS_LES_CREATURES))).toEqual([
      { path: ['carrieres'], message: `« canon-ratling » n’est pas une valeur de l’emplacement de dotation « ${joker.adresse} ».` },
    ]);
  });

  it('l’inspecteur de l’hôte offre le canon ratling au joker du skaven du seul catalogue, pas à celui de l’humain', () => {
    const offerts = (creature: string) => {
      const scene = { ...buildScene({ id: 'caserne', label: 'Caserne', size: [8, 8], terrain: 'herbe' }), entities: [soldat(creature)] };
      const projet = { id: 'p', type: 'projet', label: 'P', versionContenu: 1, maison: 'catalogue', scenes: [scene], narratif: emptyNarratif() };
      const s = editer(ouvrirLEdition(projet as ProjetDEdition, { duDepot: true }, SOUS_LES_CREATURES), { geste: 'selectionner', porteur: { sorte: 'entite', id: 'r' } });
      const dotation = inspecteurDeLaSession(s).find((el) => el.id === `carriere/dotation/${joker.adresse}`);
      return dotation && 'valeurs' in dotation ? dotation.valeurs.map((v) => v.id).filter((id) => id.endsWith('/canon-ratling')) : undefined;
    };
    expect(offerts(SKAVEN)).toEqual([`carriere/dotation/${joker.adresse}/canon-ratling`]);
    expect(offerts(HUMAIN)).toEqual([]);
  });
});

describe('la Cible d’individu d’une scène (`individusNommes`) se lit dans le catalogue passé', () => {
  /** L'entrée minimale qui fait de l'`arg` d'un Trait une Cible psy, sa `specsSource`, et les champs qu'exige son type. */
  const TRAIT_A_CIBLE = 'trait-a-cible-du-livre-de-test';
  const SOUS_LE_TRAIT = catalogueAvec({ 'traits.json': [{ id: TRAIT_A_CIBLE, type: 'traits', label: 'Trait à Cible', specsSource: 'ciblesPsy', source: { book: 'livre-extrait-de-test', page: 1 } }] });
  /** Un statbloc dont le Trait à Cible porte l'argument `arg`. */
  const statbloc = (label: string, arg: string): CustomStatblock => ({ type: 'statblock', label, char: {}, traits: [{ id: TRAIT_A_CIBLE, arg }] });
  const nomme: SceneEntity = { id: 'p', kind: 'personnage', pos: { x: 2, y: 1 }, statblock: { type: 'statblock', label: 'Nommé', char: {} } };
  /** La scène où le PNJ `pnj` nomme `arg` par son Trait, avec le personnage `p`. */
  const parLEntite = (arg: string): Scene => ({ ...emptyScene('s', 6, 6), entities: [{ id: 'pnj', kind: 'personnage', pos: { x: 1, y: 1 }, statblock: statbloc('PNJ', arg) }, nomme] });
  /** La scène où un déclencheur donne une bête qui nomme `arg` par son Trait, avec le personnage `p`. */
  const parLaScene = (arg: string): Scene => ({
    ...emptyScene('s', 6, 6),
    entities: [nomme],
    triggers: [{ id: 'don', rect: { x: 0, y: 0, w: 1, h: 1 }, flow: flowFromEffects([{ type: 'givePossession', nature: 'bete', ref: { custom: statbloc('Chien', arg) } }]) }],
  });
  const individus = (s: Scene, cat: Catalogue) => validateScene([s], undefined, undefined, cat)
    .filter((w) => w.level === 'error' && w.message.includes('aucun personnage de la scène ne porte cet id'))
    .map((w) => `${w.refId ?? w.scope} | ${w.message}`);

  it('un individu absent nommé par l’entité, par un Trait à Cible du seul catalogue, est refusé sous lui', () => {
    expect(individus(parLEntite('@absent'), SOUS_LE_TRAIT)).toEqual(['pnj | PNJ → Cible psy « absent » : aucun personnage de la scène ne porte cet id.']);
    expect(individus(parLEntite('@p'), SOUS_LE_TRAIT)).toEqual([]);
  });

  it('un individu absent nommé hors des entités de la scène, par un Trait à Cible du seul catalogue, est refusé sous lui', () => {
    expect(individus(parLaScene('@absent'), SOUS_LE_TRAIT)).toEqual(['scene | Cible psy « absent » : aucun personnage de la scène ne porte cet id.']);
    expect(individus(parLaScene('@p'), SOUS_LE_TRAIT)).toEqual([]);
  });
});
