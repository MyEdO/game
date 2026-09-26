import { describe, it, expect } from 'vitest';
import { emptyScene, isWalkable, sceneMetresPerTile, type Scene, type SceneEntity } from './scene';
import { seatSlotsOf, seatIsOccupiable, type ResolvedSeatSlot } from './seating';
import { decorAncre } from './footprint';
import { findPropById } from '../data';
import { capVolumique, empreinteDuProp, empriseLocaleM, placeAssiseDe, rotatePropLocal } from '../data/props.types';
import { buildPropVolumes } from '../gameIso/builders/propVolumes';
import { chebyshev } from '../engine/grid';

/**
 * IMPLANTATION DU MOBILIER — les PROPRIÉTÉS que toute pose de meuble doit tenir, prouvées sur des
 * scènes CONSTRUITES pour ce contrat (#1443, #1709) : aucune carte de campagne n'entre ici.
 *
 * Ce que ce fichier tient, cas par cas et chacun avec sa CONTRE-ÉPREUVE :
 *  1. le CORPS d'un meuble tient dans son EMPREINTE (`empreinteDuProp`) — une case pour un meuble
 *     1×1, deux pour une table murale au cap E — et seuls ses tabourets en débordent ;
 *  2. deux meubles posés sur des cases distinctes ne se recoupent pas, deux meubles sur la MÊME case
 *     si ;
 *  3. deux modules de comptoir adjacents forment une chaîne — jour NUL au joint, FER (donc face de
 *     service) du même côté — et un cap retourné retourne la façade ;
 *  4. une place assise s'aborde depuis une case VOISINE, marchable, et une CLOISON posée entre le
 *     siège et son abord la lui retire ;
 *  5. une table murale 1×2 assoit une place PAR CASE, et une table ronde dont un côté est fermé par
 *     un comptoir assoit quand même ses quatre convives.
 *
 * Ce qui relève d'un DÉFAUT DE CONTENU d'une carte (un meuble hors de toute pièce, un meuble sur un
 * seuil de porte, une place dont l'abord est hors de la composante jouable) n'est PAS ici : ce sont
 * des familles de `state/planDefects.ts` (`PLAN_DEFECT_FAMILIES`) à poser, montrées à l'auteur dans
 * l'éditeur — jamais un test qui photographie une carte livrée.
 */

interface Boite { x0: number; x1: number; y0: number; y1: number; h0: number; h1: number }

/** Scène-fixture : plain-pied de plancher, sans mur, aux dimensions demandées. */
function salle(w = 20, h = 16): Scene {
  return { ...emptyScene(w, h), id: 'fixture-mobilier', layers: [{ z: 0, tiles: new Array(w * h).fill('plancher') }] };
}

/** Pose un meuble : ancre, réf de catalogue, cap. */
const meuble = (id: string, ref: string, x: number, y: number, facing: SceneEntity['facing']): SceneEntity =>
  ({ id, kind: 'prop', ref, pos: { x, y }, facing } as SceneEntity);

const avec = (sc: Scene, ...meubles: SceneEntity[]): Scene => ({ ...sc, entities: [...sc.entities, ...meubles] });

/** Une CLOISON entre deux cases voisines en cardinal (arête canonique, `edgeOf`). */
function avecCloison(sc: Scene, ax: number, ay: number, bx: number, by: number): Scene {
  const seg = by === ay ? { x: Math.min(ax, bx), y: ay, side: 'E' as const } : { x: ax, y: Math.max(ay, by), side: 'N' as const };
  return { ...sc, walls: [...(sc.walls ?? []), seg] };
}

const MPT = sceneMetresPerTile(salle());

/** Ancrage MONDE d'un meuble posé : le CENTRE de son empreinte (`decorAncre`, la règle unique que
 *  `gameIso/builders/props.ts` applique), son cap, le sol qu'il touche. */
const ancrageDe = (ent: SceneEntity) => ({
  ancre: decorAncre(ent.pos, empreinteDuProp(findPropById(ent.ref), ent.facing, MPT)),
  facing: capVolumique(ent.facing, ent.id),
  baseHeightM: 0,
  entId: ent.id,
});

/** AABB monde du meuble, dérivée de ses FACES réelles (`buildPropVolumes`) — jamais d'une relecture
 *  parallèle de la recette : ce que le test mesure est ce que le monde cuit. */
function propBounds(ent: SceneEntity): Boite {
  const faces = buildPropVolumes(findPropById(ent.ref)!, ancrageDe(ent), MPT);
  const pts = faces.flatMap((f) => f.poly);
  return {
    x0: Math.min(...pts.map((p) => p.x)), x1: Math.max(...pts.map((p) => p.x)),
    y0: Math.min(...pts.map((p) => p.y)), y1: Math.max(...pts.map((p) => p.y)),
    h0: Math.min(...pts.map((p) => p.h)), h1: Math.max(...pts.map((p) => p.h)),
  };
}

/**
 * AABB monde du CORPS d'un meuble — ses primitives moins ses TABOURETS (`placeAssiseDe`,
 * `data/props.types.ts`) : le seul volume qu'une recette autorise à déborder de sa case, vers l'abord
 * de sa place (`gameIso/catalog/props-volumiques.test.ts`).
 */
function corpsBounds(ent: SceneEntity): Boite {
  const prop = findPropById(ent.ref)!;
  const xs: number[] = [], ys: number[] = [];
  const ancre = ancrageDe(ent).ancre;
  for (const p of prop.volume?.primitives ?? []) {
    // Le tabouret, par la règle UNIQUE (`placeAssiseDe`) ; l'emprise, par la SEULE (`empriseLocaleM`).
    if (placeAssiseDe(prop, p)) continue;
    const e = empriseLocaleM(p);
    // Les cotes de la recette sont MÉTRIQUES : la division par l'échelle de la scène les met en CASES.
    for (const lx of [e.x0, e.x1]) for (const ly of [e.y0, e.y1]) {
      const [rx, ry] = rotatePropLocal(lx / MPT, ly / MPT, ent.facing ?? 'S');
      xs.push(ancre.x + rx);
      ys.push(ancre.y + ry);
    }
  }
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), h0: 0, h1: 0 };
}

/**
 * Décalage du FER d'un module de comptoir par rapport à son ancre, en cases. Les recettes de comptoir
 * ne portent de `fer-noirci` que du côté du SERVICE : ce décalage NOMME donc la face de service telle
 * que le monde la cuit — c'est ce que le cap de l'entité décide.
 */
function ferDuComptoir(ent: SceneEntity): { x: number; y: number } {
  const faces = buildPropVolumes(findPropById(ent.ref)!, ancrageDe(ent), MPT).filter((f) => f.material.id === 'fer-noirci');
  const pts = faces.flatMap((f) => f.poly);
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length - ent.pos.x,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length - ent.pos.y,
  };
}

/** Recouvrement STRICT : deux volumes qui se touchent joint à joint ne s'intersectent pas. */
const intersects = (a: Boite, b: Boite, eps = 1e-9) =>
  a.x0 < b.x1 - eps && b.x0 < a.x1 - eps && a.y0 < b.y1 - eps && b.y0 < a.y1 - eps && a.h0 < b.h1 - eps && b.h0 < a.h1 - eps;

/** JOUR entre deux pièces : l'écart des AABB sur chaque axe. Négatif = recouvrement, zéro = contact. */
const jour = (a: SceneEntity, b: SceneEntity) => {
  const A = propBounds(a), B = propBounds(b);
  return Math.max(Math.max(A.x0 - B.x1, B.x0 - A.x1), Math.max(A.y0 - B.y1, B.y0 - A.y1));
};

/** Boîte au sol d'une case : le monde des décors centre la case sur ses coordonnées entières. */
const caseBox = (x: number, y: number): Boite =>
  ({ x0: x - 0.5, x1: x + 0.5, y0: y - 0.5, y1: y + 0.5, h0: -Infinity, h1: Infinity });

/** Boîte au sol de l'EMPREINTE d'un meuble posé (`empreinteDuProp`, #1509), depuis `pos` — le coin NO. */
const empreinteBox = (ent: SceneEntity): Boite => {
  const { w, h } = empreinteDuProp(findPropById(ent.ref), ent.facing, MPT);
  return { x0: ent.pos.x - 0.5, x1: ent.pos.x + w - 0.5, y0: ent.pos.y - 0.5, y1: ent.pos.y + h - 0.5, h0: -Infinity, h1: Infinity };
};

const contenu = (petit: Boite, grand: Boite, eps = 1e-9) =>
  petit.x0 >= grand.x0 - eps && petit.x1 <= grand.x1 + eps && petit.y0 >= grand.y0 - eps && petit.y1 <= grand.y1 + eps;

const caseDuCorps = (slot: ResolvedSeatSlot) => `${Math.round(slot.anchor.x)},${Math.round(slot.anchor.y)}`;
const caseDuSiege = (slot: ResolvedSeatSlot) => ({ x: Math.round(slot.anchor.x), y: Math.round(slot.anchor.y) });

describe('le CORPS d’un meuble tient dans son EMPREINTE', () => {
  it('un meuble d’une case (table ronde, armoire, comptoir) ne déborde pas de SA case', () => {
    const poses = [
      meuble('ronde', 'table-ronde-4-tabourets', 5, 5, 'S'),
      meuble('armoire', 'armoire', 8, 5, 'O'),
      meuble('comptoir', 'comptoir-droit', 11, 5, 'E'),
    ];
    expect(poses.map((e) => empreinteDuProp(findPropById(e.ref!), e.facing, MPT))).toEqual([{ w: 1, h: 1 }, { w: 1, h: 1 }, { w: 1, h: 1 }]);
    expect(poses.filter((e) => !contenu(corpsBounds(e), caseBox(e.pos.x, e.pos.y))).map((e) => e.id)).toEqual([]);
  });

  it('une table murale au cap E couvre DEUX cases — son corps sort de sa seule case, jamais de son empreinte', () => {
    const murale = meuble('murale', 'table-murale-2-tabourets', 5, 5, 'E');
    expect(empreinteDuProp(findPropById(murale.ref!), murale.facing, MPT)).toEqual({ w: 1, h: 2 });
    expect(contenu(corpsBounds(murale), empreinteBox(murale)), 'dans son EMPREINTE 1×2').toBe(true);
    // CONTRE-ÉPREUVE : la même mesure contre SA SEULE case échoue — l'empreinte est bien ce qui mesure.
    expect(contenu(corpsBounds(murale), caseBox(murale.pos.x, murale.pos.y)), 'dans sa seule case').toBe(false);
  });
});

describe('deux meubles ne se recoupent pas', () => {
  it('posés sur des cases distinctes, leurs volumes ne s’intersectent pas', () => {
    const a = meuble('a', 'table-ronde-4-tabourets', 5, 5, 'S');
    const b = meuble('b', 'armoire', 7, 5, 'O');
    expect(intersects(propBounds(a), propBounds(b))).toBe(false);
  });

  it('CONTRE-ÉPREUVE : posés sur la MÊME case, ils s’intersectent', () => {
    const a = meuble('a', 'table-ronde-4-tabourets', 5, 5, 'S');
    const b = meuble('b', 'armoire', 5, 5, 'O');
    expect(intersects(propBounds(a), propBounds(b))).toBe(true);
  });
});

describe('une chaîne de comptoir — jour NUL au joint, face de service alignée', () => {
  it('deux modules droits bout à bout se touchent sans jour et servent du même côté', () => {
    const m1 = meuble('c1', 'comptoir-droit', 6, 5, 'E');
    const m2 = meuble('c2', 'comptoir-droit', 6, 6, 'E');
    expect(jour(m1, m2)).toBeCloseTo(0, 9);
    expect(Math.sign(ferDuComptoir(m1).x)).toBe(Math.sign(ferDuComptoir(m2).x));
    expect(ferDuComptoir(m1).x, 'la face de service regarde l’est').toBeGreaterThan(0);
    // Les deux modules sont sur la MÊME bande de x, au millimètre.
    const [a, b] = [propBounds(m1), propBounds(m2)];
    expect(a.x0).toBeCloseTo(b.x0, 9);
    expect(a.x1).toBeCloseTo(b.x1, 9);
  });

  it('CONTRE-ÉPREUVE : un cap retourné met la face de service de l’autre côté du joint', () => {
    const m1 = meuble('c1', 'comptoir-droit', 6, 5, 'E');
    const retourne = meuble('c2', 'comptoir-droit', 6, 6, 'O');
    expect(Math.sign(ferDuComptoir(m1).x)).not.toBe(Math.sign(ferDuComptoir(retourne).x));
  });

  it('CONTRE-ÉPREUVE : un module écarté d’une case rouvre un jour d’une case pleine', () => {
    const m1 = meuble('c1', 'comptoir-droit', 6, 5, 'E');
    const ecarte = meuble('c2', 'comptoir-droit', 6, 7, 'E');
    expect(jour(m1, ecarte)).toBeGreaterThanOrEqual(1 - 1e-9);
  });
});

describe('une place assise s’aborde depuis une case voisine et libre', () => {
  const scAvecRonde = () => avec(salle(), meuble('ronde', 'table-ronde-4-tabourets', 5, 5, 'S'));

  it('chaque abord est VOISIN de son siège, marchable, exclusif, et la place est occupable', () => {
    const sc = scAvecRonde();
    const places = seatSlotsOf(sc, 'ronde');
    expect(places.length).toBeGreaterThan(0);
    expect(places.filter((s) => chebyshev(s.approach, caseDuSiege(s)) !== 1).map((s) => s.slotId)).toEqual([]);
    expect(places.filter((s) => !isWalkable(sc, s.approach.x, s.approach.y, 0)).map((s) => s.slotId)).toEqual([]);
    expect(places.filter((s) => !seatIsOccupiable(sc, s)).map((s) => s.slotId)).toEqual([]);
    // Un abord par place : deux convives ne se marchent pas dessus.
    expect(new Set(places.map((s) => `${s.approach.x},${s.approach.y}`)).size).toBe(places.length);
  });

  it('CONTRE-ÉPREUVE : une CLOISON entre le siège et son abord retire cet abord à la place', () => {
    const sc = scAvecRonde();
    const place = seatSlotsOf(sc, 'ronde').find((s) => s.approach.x !== caseDuSiege(s).x || s.approach.y !== caseDuSiege(s).y)!;
    const siege = caseDuSiege(place);
    const mure = avecCloison(sc, siege.x, siege.y, place.approach.x, place.approach.y);
    const memePlace = seatSlotsOf(mure, 'ronde').find((s) => s.slotId === place.slotId)!;
    expect(seatIsOccupiable(sc, place), 'sans cloison').toBe(true);
    expect(
      seatIsOccupiable(mure, memePlace) && memePlace.approach.x === place.approach.x && memePlace.approach.y === place.approach.y,
      'avec la cloison : ni le MÊME abord, ni occupable',
    ).toBe(false);
  });

  it('une table ronde dont un côté est fermé par un comptoir assoit quand même ses quatre convives', () => {
    const sc = avec(salle(), meuble('ronde', 'table-ronde-4-tabourets', 5, 5, 'S'), meuble('bar', 'comptoir-droit', 5, 6, 'E'));
    // Le comptoir DOIT fermer le sud de la table pour que le test morde.
    expect(isWalkable(sc, 5, 6, 0)).toBe(false);
    const places = seatSlotsOf(sc, 'ronde');
    expect(places).toHaveLength(4);
    expect(places.every((s) => seatIsOccupiable(sc, s))).toBe(true);
  });

  it('une table murale 1×2 assoit une place PAR CASE de son empreinte, du côté salle', () => {
    const sc = avec(salle(), meuble('murale', 'table-murale-2-tabourets', 5, 5, 'E'));
    const places = seatSlotsOf(sc, 'murale');
    expect(places).toHaveLength(2);
    expect(places.map(caseDuCorps)).toEqual(['5,5', '5,6']);
    expect(places.map((s) => `${s.approach.x},${s.approach.y}`)).toEqual(['4,5', '4,6']);
    expect(places.every((s) => seatIsOccupiable(sc, s))).toBe(true);
  });
});
