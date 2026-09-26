/**
 * OPACITÉ D'ARÊTE — contrat POSITIF de `areteOcculte` (#1680 ligne 15-B).
 *
 * Aucune Structure n'est dite transparente ni opaque par le canon (LDB 14 l.86, LDB 85 l.329) : le dépôt
 * lit l'opacité d'une arête sur un champ DÉCLARÉ (`occulte` de `structures.json`), et jamais sur une
 * hauteur de rendu ou une apparence. La raison de chaque `occulte: false` vit dans le `maison` de sa
 * ligne de donnée, pas ici.
 *
 * Ce banc verrouille les trois choses qu'une régression casserait sans bruit : QUI voit à travers
 * (liste nominative), que le PASSAGE n'a pas bougé pour autant, et que les DEUX lecteurs de l'opacité
 * (combat et vision) rendent le même verdict sur la même arête.
 */
import { describe, it, expect } from 'vitest';
import { emptyScene, areteOcculte, wallBetween, wallIsOpen, setDoorOpen, setStructureDown, type Scene, type WallSeg } from './scene';
import { wallOnSight, couvertDArete } from './lineOfSight';
import { buildOpaque } from './vision';
import { structures, findStructureById } from '../data';
import diligenceCampaign from '../scenes/diligence/diligence-projet.json';
import { schema as schemaStructures } from '../data/schemas/defs/structures';
import { refsInLine } from '../../scripts/guards/lib/rawRefIntegrity.mjs';

/** Scène 3×3 avec UNE arête `E` en (0,1) — l'arête qui sépare (0,1) de (1,1). */
const sceneAvec = (seg: Partial<WallSeg>): Scene => {
  const s = emptyScene(3, 3);
  return { ...s, walls: [{ x: 0, y: 1, side: 'E', ...seg } as WallSeg] };
};
const ARETE = (s: Scene): WallSeg => s.walls![0];

describe('areteOcculte — la liste de CE QUI LAISSE VOIR est nominative et sourcée', () => {
  it('exactement trois Structures sont déclarées non occultantes, et chacune porte son `maison`', () => {
    const transparentes = structures.filter((s) => s.occulte === false).map((s) => s.id).sort();
    // Verrou NOMINATIF : un ajout futur passe par CE test, jamais par un `occulte: false` discret.
    expect(transparentes).toEqual(['cloture-en-clayonnage', 'garde-corps', 'herse']);
    // Contrat du schéma (`schemas/defs/structures.ts`) : `occulte: false` ne cite aucun folio, il porte
    // son `maison`, qui NOMME le passage dont la décision est tirée. Le passage se reconnaît à la
    // graphie des réfs RAW du dépôt — `refsInLine`, seul lecteur TYPÉ (`.d.mts`) consommable depuis `src`, dérivé de `scripts/raw/_lib.mjs` :
    // aucun sigle de livre ni numéro de chapitre n'est écrit ici, sans quoi le banc verrouillerait une
    // attribution au lieu d'un contrat.
    for (const s of structures.filter((s) => s.occulte === false))
      expect(
        [...refsInLine(s.maison ?? '')].map((r) => r.ref),
        `${s.id} : \`occulte: false\` dont le \`maison\` ne nomme aucun passage en graphie de réf RAW`,
      ).not.toHaveLength(0);
  });

  it('toutes les AUTRES Structures occultent — aucune n’est muette par omission de lecture', () => {
    const occultantes = structures.filter((s) => s.occulte !== false);
    expect(occultantes.length).toBe(structures.length - 3);
    for (const s of occultantes) expect(areteOcculte(emptyScene(1, 1), { x: 0, y: 0, side: 'E', structure: s.id } as WallSeg)).toBe(true);
  });
});

describe('areteOcculte — les défauts OCCULTENT, seul un arbitrage déclaré laisse voir', () => {
  it.each([
    ['sans structure (mur nu d’authoring)', {}, true],
    ['structure inconnue du dataset', { structure: 'structure-qui-n-existe-pas' }, true],
    ['mur d’habitation (aucun champ `occulte`)', { structure: 'mur-a-ossature-en-bois' }, true],
    ['clôture en clayonnage (`occulte: false`)', { structure: 'cloture-en-clayonnage' }, false],
    ['herse (`occulte: false`)', { structure: 'herse' }, false],
    ['garde-corps (`occulte: false`)', { structure: 'garde-corps' }, false],
  ])('%s → occulte = %s', (_nom, seg, attendu) => {
    const s = sceneAvec(seg as Partial<WallSeg>);
    expect(areteOcculte(s, ARETE(s))).toBe(attendu);
  });

  it('une PORTE FERMÉE occulte ; OUVERTE elle laisse voir (les deux modes d’ouverture restent ceux de `wallIsOpen`)', () => {
    // `closed: true` est REQUIS : une porte authorée sans lui est OUVERTE par défaut (`doorIsOpen`,
    // scene.ts:542) — la fermeture est l'état explicite, pas l'inverse.
    const fermee = sceneAvec({ door: true, closed: true });
    expect(areteOcculte(fermee, ARETE(fermee))).toBe(true);
    const ouverte = setDoorOpen(fermee, 0, 1, 'E', 0, true);
    expect(wallIsOpen(ouverte, ARETE(ouverte))).toBe(true);
    expect(areteOcculte(ouverte, ARETE(ouverte))).toBe(false);
  });

  it('une structure ABATTUE laisse voir, même si elle occultait debout', () => {
    const debout = sceneAvec({ structure: 'mur-a-ossature-en-bois' });
    expect(areteOcculte(debout, ARETE(debout))).toBe(true);
    const abattue = setStructureDown(debout, 0, 1, 'E', 0, true);
    expect(areteOcculte(abattue, ARETE(abattue))).toBe(false);
  });
});

describe('OPACITÉ ≠ FRANCHISSABILITÉ — on voit à travers une herse, on ne la traverse pas', () => {
  it.each(['cloture-en-clayonnage', 'herse'])('%s : non occultante ET infranchissable', (structure) => {
    const s = sceneAvec({ structure });
    expect(areteOcculte(s, ARETE(s))).toBe(false);
    // `wallBetween` ne lit PAS l'opacité : l'arête tient, donc elle barre le pas.
    expect(wallBetween(s, 0, 1, 1, 1, 0)).toBe(true);
  });

  it('ABATTUE, la même arête cesse AUSSI de barrer le passage (le seul cas où les deux tombent ensemble)', () => {
    const s = sceneAvec({ structure: 'cloture-en-clayonnage' });
    const bas = setStructureDown(s, 0, 1, 'E', 0, true);
    expect(wallBetween(bas, 0, 1, 1, 1, 0)).toBe(false);
  });
});

describe('PARITÉ des deux lecteurs — combat et vision ne divergent jamais sur une arête', () => {
  it.each([
    ['mur-a-ossature-en-bois', true],
    ['cloture-en-clayonnage', false],
    ['herse', false],
  ])('%s : `wallOnSight` (défaut) et le Set d’opacité de la vision disent la même chose', (structure, bloque) => {
    const s = sceneAvec({ structure });
    // Lecteur 1 — défaut d'`edgeBlocks` de `wallOnSight` (combat), sur le couple de cases que l'arête sépare.
    expect(wallOnSight(s, { x: 0, y: 1 }, { x: 1, y: 1 }, 0)).toBe(bloque);
    // Lecteur 2 — Set d'arêtes précalculé de `buildOpaque` (vision/brouillard), MÊME arête.
    expect(buildOpaque(s).walls.has('0,1,E')).toBe(bloque);
  });
});

/**
 * LES SIX SÉPARATIONS DE BOX DES ÉCURIES (migration 2026-09-04) — ce que change RÉELLEMENT le passage
 * de `mur-a-ossature-en-bois` à `cloture-en-clayonnage` sur la carte livrée. Le profil AA se prend en
 * ENTIER : l'opacité tombe, mais le couvert et la solidité tombent AUSSI. Ce banc les mesure sur la
 * scène réelle et les compare à la structure d'avant, pour qu'aucun des quatre deltas ne passe muet.
 */
describe('La Diligence — les six box migrées prennent le profil AA du clayonnage EN ENTIER', () => {
  const BOX = [
    { x: 19, y: 31 }, { x: 19, y: 32 }, { x: 21, y: 29 },
    { x: 21, y: 30 }, { x: 23, y: 29 }, { x: 23, y: 30 },
  ];
  const scene = diligenceCampaign.scenes[0] as unknown as Scene;
  const segDe = ({ x, y }: { x: number; y: number }) =>
    scene.walls!.find((w) => w.x === x && w.y === y && w.side === 'E' && (w.z ?? 0) === 0)!;

  it('les six arêtes portent le clayonnage, et son profil AA est bien celui d’AA 10 l.41', () => {
    expect(BOX.map((b) => segDe(b)?.structure)).toEqual(new Array(6).fill('cloture-en-clayonnage'));
    const clay = findStructureById('cloture-en-clayonnage')!;
    expect({ char: clay.char, couvertPenalty: clay.couvertPenalty, encLimit: clay.encLimit, occulte: clay.occulte })
      .toEqual({ char: { BE: 2, B: 10 }, couvertPenalty: 'intermediaire', encLimit: undefined, occulte: false });
  });

  it('le couvert se PERD : la cible derrière une de ces arêtes n’est plus abritée, et la vue passe', () => {
    // Tireur et cible de part et d'autre de l'arête (21,29,E) — le couple exact que l'arête sépare.
    const from = { x: 21, y: 29 };
    const to = { x: 22, y: 29 };
    expect(couvertDArete(scene, from, to)).toBe('none');
    expect(wallOnSight(scene, from, to, 0)).toBe(false);
  });

  it('AVANT la migration, la même arête abritait la cible ET coupait la vue (delta mesuré, pas supposé)', () => {
    const avant: Scene = {
      ...scene,
      walls: scene.walls!.map((w) =>
        BOX.some((b) => b.x === w.x && b.y === w.y) && w.side === 'E' && (w.z ?? 0) === 0
          ? { ...w, structure: 'mur-a-ossature-en-bois' }
          : w),
    };
    const from = { x: 21, y: 29 };
    const to = { x: 22, y: 29 };
    expect(couvertDArete(avant, from, to)).toBe('imparfaite');
    expect(wallOnSight(avant, from, to, 0)).toBe(true);
    // Et la Structure d'avant était deux fois plus solide, avec une Limite d'Encombrement.
    const mur = findStructureById('mur-a-ossature-en-bois')!;
    expect({ char: mur.char, encLimit: mur.encLimit }).toEqual({ char: { BE: 4, B: 20 }, encLimit: 30 });
  });

  it('le PASSAGE, lui, est le même des deux côtés de la migration', () => {
    expect(wallBetween(scene, 21, 29, 22, 29, 0)).toBe(true);
  });
});

/**
 * VERROU DE SAISIE — un état, une seule graphie. « Occultante » s'écrit par l'ABSENCE du champ ; il n'y
 * a pas de second mot pour le dire. `occulte: false` est le seul écrivable, et il ne part jamais sans
 * la raison qui le porte.
 */
describe('structures.json — le schéma n’accepte qu’une graphie par état d’opacité', () => {
  const base = {
    id: 'x-banc', type: 'structures', label: 'X', kind: 'mur',
    char: { BE: 1, B: 1 }, traits: [], source: { book: 'aux-armes', page: 119 },
    // `taille` (AA 10 l.98) et `soutientEtage` (AA 10 l.127) sont EXIGÉS de toute entrée et exigent à
    // leur tour son `maison` : le banc d'opacité les porte pour n'éprouver QUE la graphie d'`occulte`.
    taille: 'grande', soutientEtage: false, maison: 'banc — Taille, étage et raison hors sujet ici',
  };
  const { maison: _raison, ...sansMaison } = base;
  const parse = (e: unknown) => (schemaStructures as { safeParse: (v: unknown) => { success: boolean; error?: { issues: { path: (string | number)[]; message: string }[] } } }).safeParse([e]);
  const refus = (e: unknown) => JSON.stringify(parse(e).error?.issues.map((i) => `${i.path.join('.')}: ${i.message}`));

  it('l’absence du champ est l’état occultant, et elle est ACCEPTÉE telle quelle', () => {
    expect(parse(base).success).toBe(true);
  });

  it('`occulte: true` est REFUSÉ — ce serait une deuxième façon d’écrire l’absence', () => {
    expect(parse({ ...base, occulte: true, maison: 'raison' }).success).toBe(false);
    expect(refus({ ...base, occulte: true, maison: 'raison' })).toContain('occulte');
  });

  it('`occulte: false` sans `maison` est REFUSÉ, nominativement', () => {
    expect(parse({ ...sansMaison, occulte: false }).success).toBe(false);
    expect(refus({ ...sansMaison, occulte: false })).toContain('x-banc');
    expect(refus({ ...sansMaison, occulte: false })).toContain('`occulte: false` sans `maison`');
  });

  it('`occulte: false` AVEC son `maison` passe', () => {
    expect(parse({ ...base, occulte: false, maison: 'AA 10 l.65 — enclos d’animaux' }).success).toBe(true);
  });
});
