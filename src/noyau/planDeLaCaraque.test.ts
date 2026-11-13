import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { garanti } from '../lib/garanti';
import { buildScene } from './mapSpec';
import { PLAN_DE_LA_CARAQUE } from './planDeLaCaraque';
import { reachedFloors, unreachableDescriptiveZones, zoneWalkableCells } from './mapQC';
import {
  areteOcculteEntre,
  edgeOf,
  heightAt,
  isDescriptiveZone,
  isWalkable,
  porteAuteur,
  sceneMetresPerTile,
  tileAt,
  wallBetween,
  type Scene,
  type SceneEntity,
} from './monde/scene';
import { estAbsent } from './monde/terrain';
import { reachable, tileKey } from './monde/path';
import { planClimb } from './monde/climbMove';
import { ancreDuDecor, propFootTiles } from './monde/footprint';
import { fauteDAppui, piedDuDecor, portePar } from './monde/poseDuDecor';
import { emprisePlanTournee } from '../data/props.types';
import { sceneZoneTiles } from './monde/zones';
import { findPropById, findVehicleById } from '../data';
import { GRAMMAIRE_ASCII, MOTS_DES_PONTS, grilleDesPonts } from '../data/schemas/grammaire/carte-ascii';
import { bassinDeLaCaraque } from './planDeNavire.testkit';

const scene = buildScene(PLAN_DE_LA_CARAQUE);
const caraque = garanti(findVehicleById('caraque'), 'caraque', 'véhicule');
const [cartes, hauteurs] = garanti(caraque.ponts, 'caraque', 'ponts');
const legende = garanti(PLAN_DE_LA_CARAQUE.zoneLegend, 'caraque', 'pièces du plan');
const calques = garanti(PLAN_DE_LA_CARAQUE.zoneMap, 'caraque', 'calque des pièces');

/** La première case marchable de la pièce `id`. */
const caseDe = (id: string) => zoneWalkableCells(scene, garanti(scene.effectZones?.find((zo) => zo.id === id), id, 'pièce'))[0];

describe('ponts de la caraque (MDG 12 l.286), compilés par buildScene', () => {
  it('un étage par pont, de la cale à la plage arrière, chaque case à la hauteur de son glyphe dans la source', () => {
    expect(scene.layers.map((l) => l.z)).toEqual([0, 1, 2, 3]);
    expect([[8, 2, 0], [8, 2, 1], [8, 2, 2], [2, 2, 3], [6, 2, 3], [14, 2, 3]].map(([x, y, z]) => heightAt(scene, x, y, z)))
      .toEqual([-2, 0.3, 1.95, 5.6, 5.6, 5.85]);
    const { cases } = grilleDesPonts(cartes);
    for (const c of cases) expect(heightAt(scene, c.x, c.y, c.z), `${c.x},${c.y},${c.z}`).toBe(hauteurs[c.glyphe]);
    expect(scene.layers.flatMap(({ z }) => Array.from({ length: 18 * 5 }, (_, i) => ({ x: i % 18, y: Math.floor(i / 18), z })))
      .filter((c) => !estAbsent(tileAt(scene, c.x, c.y, c.z))).length).toBe(cases.length);
  });

  it('chaque pièce de la légende des plans est une zone, sous son nom', () => {
    const zones = (scene.effectZones ?? []).filter(isDescriptiveZone);
    expect(zones.map((z) => [z.id, z.label]).sort()).toEqual(Object.values(legende).map((p) => [p.id, p.label]).sort());
  });

  it('une case de trappe est dans la pièce du pont où elle débouche, à son étage (#3815)', () => {
    const piece = (x: number, y: number, z: number) => garanti((scene.effectZones ?? []).filter(isDescriptiveZone)
      .find((zo) => (zo.z ?? 0) === z && sceneZoneTiles(zo).some((t) => t.x === x && t.y === y)), `${x},${y},${z}`, 'pièce de la case');
    expect([[3, 2, 0], [11, 2, 0], [4, 1, 1], [4, 3, 1], [10, 1, 1], [10, 3, 1], [3, 3, 2], [13, 3, 2]].map(([x, y, z]) => [piece(x, y, z).label, piece(x, y, z).z]))
      .toEqual([
        ...Array.from({ length: 2 }, () => ["Pont principal des canons/Poste d'équipage", 0]),
        ...Array.from({ length: 4 }, () => ['Pont supérieur des canons', 1]),
        ["Gaillard d'avant", 2], ['Plage arrière', 2],
      ]);
    for (const id of desTrappes) {
      const z = garanti(scene.effectZones?.find((zo) => zo.id === id), id, 'pièce des trappes').z ?? 0;
      expect(unreachableDescriptiveZones(scene, departDu(`z${z + 1}`)).map((zo) => zo.id), `${id} à pied depuis le pont z${z + 1}`).not.toContain(id);
    }
  });

  /** Une case de la première pièce du pont `etage` (hors trappes, en minuscule au calque). */
  const departDu = (etage: string) => {
    const premiere = garanti([...([] as string[]).concat(calques[etage]).join('')].find((ch) => ch in legende && ch === ch.toUpperCase()), etage, 'pièce du pont');
    return caseDe(garanti(legende[premiere].id, premiere, 'id de pièce'));
  };
  /** Les pièces des trappes, chacune à l'étage de ses trappes (minuscules du calque). */
  const desTrappes = new Set(Object.entries(legende).filter(([l]) => l !== l.toUpperCase()).map(([, p]) => p.id));

  it('à pied, chaque pont dessert ses pièces, le gaillard et la plage arrière par la passerelle, et aucune échelle ne se gravit sans geste', () => {
    Object.keys(calques).forEach((etage) => {
      const z = Number(etage.slice(1));
      const depart = departDu(etage);
      expect(unreachableDescriptiveZones(scene, depart).filter((zo) => (zo.z ?? 0) === z && !desTrappes.has(zo.id)).map((zo) => zo.id), etage).toEqual([]);
      expect(Math.max(...reachedFloors(scene, depart)), etage).toBeLessThanOrEqual(z);
    });
  });

  it('par les échelles de trappe, la cale dessert chaque case du navire jusqu’à la plage arrière', () => {
    const depart = caseDe('cale');
    const atteint = new Set([...reachable(scene, depart, 400, { blocked: new Set(), traverse: { climb: true, climbFullSpeed: true } }).keys()]
      .map((k) => (k.split(',').length === 2 ? `${k},0` : k)));
    atteint.add(`${depart.x},${depart.y},${depart.z}`);
    const isolees = scene.layers.flatMap(({ z }) => Array.from({ length: 18 * 5 }, (_, i) => ({ x: i % 18, y: Math.floor(i / 18), z })))
      .filter((c) => isWalkable(scene, c.x, c.y, c.z) && !atteint.has(`${c.x},${c.y},${c.z}`));
    expect(isolees).toEqual([]);
  });

  it('une échelle se gravit sans Test (LDB 15 l.55)', () => {
    for (const e of PLAN_DE_LA_CARAQUE.walls ?? []) {
      const z = e.z ?? 0;
      const vers = { x: e.x + (e.side === 'E' ? 1 : e.side === 'O' ? -1 : 0), y: e.y + (e.side === 'S' ? 1 : e.side === 'N' ? -1 : 0), z };
      expect(planClimb(scene, { x: e.x, y: e.y, z }, vers, false), `z${z} (${e.x},${e.y})`).toEqual({ kind: 'free' });
    }
  });
});

describe('le mobilier des pièces de la caraque (#3686)', () => {
  const k = (c: { x: number; y: number; z: number }) => `${c.x},${c.y},${c.z}`;
  const pieces = (scene.effectZones ?? []).filter(isDescriptiveZone);
  /** Les décors posés, mobilier des pièces et décor du navire (`DECOR`, sous son `ref` suivi de son rang). */
  const meubles = scene.entities.filter((e) => e.kind === 'prop');
  const decor = meubles.filter((e) => new RegExp(`^${e.decor?.id}-\\d+$`).test(e.id));
  /** Les meubles d'une pièce : ceux dont l'id est le sien suivi de leur `ref` et de leur rang. */
  const meublesDe = (piece: string) => meubles.filter((e) => new RegExp(`^${piece}-${e.decor?.id}-\\d+$`).test(e.id));
  /** Les cases qu'un meuble couvre, sur son pont. */
  const casesDu = (e: (typeof meubles)[number]) =>
    propFootTiles(e.decor?.id, e.pos, e.facing, sceneMetresPerTile(scene)).map((t) => ({ ...t, z: e.z ?? 0 }));
  /** Les deux cases de chaque arête de porte ou d'échelle : une trappe et le pied de son échelle, les deux côtés d'une porte. */
  const libres = new Set((scene.walls ?? []).filter((w) => porteAuteur(w) || w.climb).flatMap((w) => {
    const z = w.z ?? 0;
    return [{ x: w.x, y: w.y, z }, w.side === 'N' ? { x: w.x, y: w.y - 1, z } : { x: w.x + 1, y: w.y, z }].map(k);
  }));

  /** Les cases que le navire atteint depuis la cale, par ses échelles, sans passer par `sauf`. */
  const atteintes = (sauf?: { x: number; y: number; z: number }) => reachable(scene, caseDe('cale'), 400, {
    blocked: new Set(sauf ? [tileKey(sauf.x, sauf.y, sauf.z)] : []), traverse: { climb: true, climbFullSpeed: true },
  }).size;

  /** Ce que le rectangle `r` laisse hors du rectangle `f`, en rectangles. */
  const hors = (r: Rect, f: Rect): Rect[] => (!recouvre(r, f) ? [r] : [
    { ...r, x1: Math.min(r.x1, f.x0) }, { ...r, x0: Math.max(r.x0, f.x1) },
    { x0: Math.max(r.x0, f.x0), x1: Math.min(r.x1, f.x1), y0: r.y0, y1: Math.min(r.y1, f.y0) },
    { x0: Math.max(r.x0, f.x0), x1: Math.min(r.x1, f.x1), y0: Math.max(r.y0, f.y1), y1: r.y1 },
  ].filter((q) => q.x1 > q.x0 && q.y1 > q.y0));

  it('chaque pièce intérieure est meublée, sauf celle dont chaque case est celle d’une porte, d’une échelle, d’un poste dont la pièce ne laisse place à aucun meuble, ou le seul passage vers d’autres', () => {
    const toutes = atteintes();
    const passages = pieces.flatMap((p) => sceneZoneTiles(p).map((t) => ({ x: t.x, y: t.y, z: t.z ?? p.z ?? 0 })))
      .filter((c) => isWalkable(scene, c.x, c.y, c.z) && atteintes(c) < toutes - 1);
    /** Le plus petit côté d'un meuble posé au sol. */
    const cote = Math.min(...meubles.filter((e) => !e.sur).map(corpsDu).map((c) => Math.min(c.x1 - c.x0, c.y1 - c.y0)));
    const armees = postes.filter((p) => postes.filter((q) => k(q.case) === k(p.case))
      .reduce((reste, q) => reste.flatMap((r) => hors(r, q.emprise)), [libre(p.case.x, p.case.y, p.case.z)])
      .every((r) => Math.min(r.x1 - r.x0, r.y1 - r.y0) < cote)).map((p) => p.case);
    const occupees = new Set([...libres, ...armees.map(k), ...passages.map(k)]);
    const vides = new Set(pieces.filter((p) => sceneZoneTiles(p).every((t) => occupees.has(k({ x: t.x, y: t.y, z: t.z ?? p.z ?? 0 })))).map((p) => p.id));
    expect(pieces.filter((p) => meublesDe(p.id).length > 0).map((p) => p.id).sort())
      .toEqual(pieces.filter((p) => p.presentation === 'interior' && !vides.has(p.id)).map((p) => p.id).sort());
    expect(pieces.flatMap((p) => meublesDe(p.id)).length, 'meuble sans pièce').toBe(meubles.length - decor.length);
  });

  it('le décor du navire est le fanal du couronnement, sur la plage arrière (#3815)', () => {
    expect(decor.map((e) => [e.id, e.z])).toEqual([['fanal-1', 3]]);
  });

  it('chaque meuble est un décor du catalogue, dans les cases de sa pièce, sans boucher porte, trappe ni pied d’échelle', () => {
    for (const piece of pieces) {
      const siennes = new Set(sceneZoneTiles(piece).map((t) => k({ x: t.x, y: t.y, z: t.z ?? piece.z ?? 0 })));
      for (const e of meublesDe(piece.id)) {
        expect(findPropById(e.decor?.id), e.id).toBeDefined();
        expect(casesDu(e).filter((c) => !siennes.has(k(c))), `${e.id} hors de sa pièce`).toEqual([]);
        expect(casesDu(e).filter((c) => libres.has(k(c))), `${e.id} bouche un passage`).toEqual([]);
      }
    }
  });

  it('chaque meuble couvre des cases des ponts de la source', () => {
    const emprise = new Set(grilleDesPonts(cartes).cases.map(k));
    expect(meubles.flatMap((e) => casesDu(e).filter((c) => !emprise.has(k(c))).map((c) => `${e.id} ${k(c)}`))).toEqual([]);
  });

  /** Le corps d'un meuble au plan, en cases : l'emprise de sa recette tournée, autour de son ancre calée. */
  const corpsDu = (e: (typeof meubles)[number]) => {
    const mpt = sceneMetresPerTile(scene);
    const a = ancreDuDecor(e, mpt);
    const c = garanti(emprisePlanTournee(garanti(findPropById(e.decor?.id), e.id, 'décor'), e.facing ?? 'S', () => true), e.id, 'corps');
    return { x0: a.x + c.x0 / mpt, x1: a.x + c.x1 / mpt, y0: a.y + c.y0 / mpt, y1: a.y + c.y1 / mpt };
  };

  /** L'emprise libre, en cases centrées sur l'entier, de chaque case des ponts que rogne le modèle commité de la caraque
   *  (`cases` de son manifeste, #3767) ; la case entière sinon. */
  const manifeste = JSON.parse(readFileSync(new URL('../../hotes/godot/projet/modeles/vehicule--caraque.manifeste.json', import.meta.url), 'utf8')) as {
    cases: Record<string, number[]>;
    postes: Record<string, number[][]>;
    selon: Record<string, { postes?: Record<string, number[][]> }>;
  };
  const libre = (x: number, y: number, z: number) => {
    const [x0, y0, x1, y1] = manifeste.cases[`${x},${y},${z}`] ?? [x, y, x + 1, y + 1];
    return { x0: x0 - 0.5, y0: y0 - 0.5, x1: x1 - 0.5, y1: y1 - 0.5 };
  };
  /** Une épaisseur de cloison (0,1 m), en cases ; le pas des points sondés dans un corps. */
  const [TOLERANCE, PAS] = [0.05, 0.025];

  /** La pièce montée aux postes de chaque bord, celle de la revue (`REVUE.aux_postes` de la caraque) : `vehicule--pierrier`,
   *  les bombardes du gaillard, à la proue, `vehicule--canon-moyen` ailleurs ; sa demi-largeur et sa longueur devant et
   *  derrière son origine, en mètres (bornes de son GLB, sa bouche vers son bord), et de même son affût, ce qui pose au
   *  sol (ses bornes sous 0,3 m) ; derrière sa culasse, la place d'un servant, la carrure d'un adulte (0,5 m, #3767). */
  const CANON_MOYEN = { demiLargeur: 0.86, devant: 1.73, derriere: 1.74, affut: { demiLargeur: 0.755, devant: 0.761, derriere: 1.735 } };
  const PIECE: Record<string, typeof CANON_MOYEN> = {
    proue: { demiLargeur: 0.587, devant: 0.87, derriere: 0.87, affut: { demiLargeur: 0.587, devant: 0.35, derriere: 0.68 } },
    tribord: CANON_MOYEN, babord: CANON_MOYEN, poupe: CANON_MOYEN,
  };
  const SERVANT = 0.5;
  /** Le sens, au plan, vers lequel une pièce montée au bord `bord` pointe sa bouche. */
  const CAP: Record<string, readonly [number, number]> = { tribord: [0, -1], babord: [0, 1], proue: [-1, 0], poupe: [1, 0] };
  type Rect = { x0: number; y0: number; x1: number; y1: number };
  const recouvre = (p: Rect, q: Rect) => Math.min(p.x1, q.x1) - Math.max(p.x0, q.x0) > TOLERANCE && Math.min(p.y1, q.y1) - Math.max(p.y0, q.y0) > TOLERANCE;

  /** Chaque poste du modèle commité, où se monte une pièce (`postes` de son manifeste, et ceux qu'une Amélioration
   *  ajoute, `selon`) : son nom, sa case, une de celles d'un seul pont, à la hauteur de son plancher, dont l'emprise
   *  libre le contient à une épaisseur de cloison près (sur la limite de deux, la première), son plancher, et, en cases
   *  centrées sur l'entier, l'emprise au sol de la pièce montée et de son servant, cette emprise en deçà du bord de sa
   *  case vers lequel elle pointe (sa bouche passe le sabord ou le plat-bord), et celle de son affût et de son servant.
   *  Un point glTF (x, y, z) est au plan en (W/2 − z/mpt − ½, H/2 + x/mpt − ½). */
  const { w: W, h: H, cases: CASES, aretes: ARETES } = grilleDesPonts(cartes);
  const posteDu = (nom: string, bord: string, [gx, gy, gz]: readonly number[]) => {
    const mpt = sceneMetresPerTile(scene);
    const [x, y] = [W / 2 - gz / mpt - 0.5, H / 2 + gx / mpt - 0.5];
    const siennes = CASES.filter((c) => hauteurs[c.glyphe] === gy).filter((c) => {
      const r = libre(c.x, c.y, c.z);
      return r.x0 - TOLERANCE <= x && x <= r.x1 + TOLERANCE && r.y0 - TOLERANCE <= y && y <= r.y1 + TOLERANCE;
    });
    expect(siennes.length > 0 && new Set(siennes.map((c) => c.z)).size, `poste ${nom}`).toBe(1);
    const [dx, dy] = garanti(CAP[bord], bord, 'cap du bord');
    const piece = garanti(PIECE[bord], bord, 'pièce du bord');
    /** Le rectangle de `derriere` mètres derrière l'origine (servant compris) à `devant` mètres devant, `demiLargeur` de part et d'autre. */
    const au = ({ demiLargeur, devant, derriere }: typeof piece.affut): Rect => {
      const [arriere, avant, cote] = [-(derriere + SERVANT) / mpt, devant / mpt, demiLargeur / mpt];
      const [ax, bx] = dx ? [x + dx * arriere, x + dx * avant] : [x - cote, x + cote];
      const [ay, by] = dy ? [y + dy * arriere, y + dy * avant] : [y - cote, y + cote];
      return { x0: Math.min(ax, bx), x1: Math.max(ax, bx), y0: Math.min(ay, by), y1: Math.max(ay, by) };
    };
    const [c, emprise] = [siennes[0], au(piece)];
    const limite = dx ? c.x + dx / 2 : c.y + dy / 2;
    const dedans: Rect = dx > 0 ? { ...emprise, x1: Math.min(emprise.x1, limite) } : dx < 0 ? { ...emprise, x0: Math.max(emprise.x0, limite) }
      : dy > 0 ? { ...emprise, y1: Math.min(emprise.y1, limite) } : { ...emprise, y0: Math.max(emprise.y0, limite) };
    return { nom: `${nom} ${k(c)}`, case: { x: c.x, y: c.y, z: c.z }, plancher: gy, emprise, dedans, affut: au(piece.affut) };
  };
  /** Les postes en vigueur quand la caraque porte les Améliorations `ameliorations` : ceux du manifeste, chaque bord que
   *  nomme une Amélioration remplacé par les siens (MDG 12 l.362), comme `postesEnVigueur` de l'hôte Godot. */
  const enVigueur = (ameliorations: readonly string[]) => Object.entries(Object.assign({}, ...[
    ...Object.entries(manifeste.postes).map(([bord, points]) => ({ [bord]: points.map((p, i) => posteDu(`postes.${bord}[${i}]`, bord, p)) })),
    ...ameliorations.map((a) => Object.fromEntries(Object.entries(manifeste.selon[a].postes ?? {})
      .map(([bord, points]) => [bord, points.map((p, i) => posteDu(`selon.${a}.${bord}[${i}]`, bord, p))]))),
  ]) as Record<string, ReturnType<typeof posteDu>[]>).flatMap(([, l]) => l);
  /** Chaque configuration des postes : la base, chaque Amélioration qui en ajoute, et toutes ensemble. */
  const avecPostes = Object.keys(manifeste.selon).filter((a) => manifeste.selon[a].postes);
  const configurations = [[], ...avecPostes.map((a) => [a]), avecPostes];
  const postes = [...new Map(configurations.flatMap(enVigueur).map((p) => [p.nom, p])).values()];

  /** Le fût de chaque mât, à chaque pont qu'il traverse depuis la case de son pied (`GLYPHES["pieds"]`,
   *  `scripts/personnage-3d/vehicule/caraque/donnees.py`) : au milieu de la case, jusqu'à l'emprise libre que le modèle
   *  lui laisse. */
  const futs = CASES.filter((c) => 'ijl'.includes(c.glyphe)).flatMap((pied) => CASES
    .filter((c) => c.x === pied.x && c.y === pied.y && c.z >= pied.z).map((c) => {
      const r = libre(c.x, c.y, c.z);
      const d = Math.max(r.x0 - c.x, c.x - r.x1, r.y0 - c.y, c.y - r.y1);
      expect(d, `fût du mât ${k(c)} hors de l'emprise libre`).toBeGreaterThan(0);
      return { nom: `mât ${k(c)}`, cle: k(c), z: c.z, corps: { x0: c.x - d, x1: c.x + d, y0: c.y - d, y1: c.y + d } };
    }));
  /** Les ouvertures de chaque pont, en cases entières : la trappe de chaque échelle, au pont de sa case et à celui du
   *  dessus, dont elle perce le plancher ; chaque écoutille, cases sans plancher que celles du pont enclosent. */
  const caseDu = (x: number, y: number, z: number) => CASES.some((c) => c.x === x && c.y === y && c.z === z);
  const trappes = (scene.walls ?? []).filter((w) => w.climb).flatMap((w) => {
    const z = w.z ?? 0;
    const [a, b] = [{ x: w.x, y: w.y }, w.side === 'N' ? { x: w.x, y: w.y - 1 } : { x: w.x + 1, y: w.y }];
    const t = heightAt(scene, a.x, a.y, z) > heightAt(scene, b.x, b.y, z) ? a : b;
    return [{ ...t, z }, { ...t, z: z + 1 }];
  });
  const ecoutilles = scene.layers.flatMap(({ z }) => {
    const vides = Array.from({ length: W * H }, (_, i) => ({ x: i % W, y: Math.floor(i / W), z })).filter((c) => !caseDu(c.x, c.y, z));
    const dehors = new Set<string>();
    const pile = vides.filter((c) => c.x === 0 || c.y === 0 || c.x === W - 1 || c.y === H - 1);
    for (let c = pile.pop(); c; c = pile.pop()) {
      if (dehors.has(k(c))) continue;
      dehors.add(k(c));
      pile.push(...vides.filter((v) => Math.abs(v.x - c.x) + Math.abs(v.y - c.y) === 1));
    }
    return vides.filter((c) => !dehors.has(k(c)));
  });
  const ouvertures = [...new Map([...trappes, ...ecoutilles].map((c) => [k(c), {
    nom: `ouverture ${k(c)}`, z: c.z, corps: { x0: c.x - 0.5, x1: c.x + 0.5, y0: c.y - 0.5, y1: c.y + 0.5 },
  }])).values()];
  /** L'échelle de chaque trappe, à cheval sur son arête (`ECHELLE` de `scripts/personnage-3d/vehicule/caraque/donnees.py`,
   *  `echelle` de `navire.py`) : sa largeur le long de l'arête, sa course au sol en travers, de la trappe à son pied. */
  const ECHELLE = { largeur: 0.5, pente: 72 };
  const echelles = (scene.walls ?? []).filter((w) => w.climb).map((w) => {
    const z = w.z ?? 0;
    const mpt = sceneMetresPerTile(scene);
    const [a, b] = [{ x: w.x, y: w.y }, w.side === 'N' ? { x: w.x, y: w.y - 1 } : { x: w.x + 1, y: w.y }];
    const course = Math.abs(heightAt(scene, a.x, a.y, z) - heightAt(scene, b.x, b.y, z)) / Math.tan((ECHELLE.pente * Math.PI) / 180) / mpt / 2;
    const [m, l] = [{ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, ECHELLE.largeur / mpt / 2];
    const [cx, cy] = w.side === 'N' ? [l, course] : [course, l];
    return { nom: `échelle ${w.x},${w.y},${z} ${w.side}`, z, corps: { x0: m.x - cx, x1: m.x + cx, y0: m.y - cy, y1: m.y + cy } };
  });

  it('la pièce montée à chaque poste, et son servant, ne recouvre aucun meuble ni décor de son pont, aucun fût de mât, aucune trappe, écoutille ni échelle, ni la pièce d’un autre poste en vigueur avec lui (#3815)', () => {
    const obstacles = [
      ...meubles.map((e) => ({ nom: e.id, z: e.z ?? 0, corps: corpsDu(e) })), ...futs, ...ouvertures, ...echelles,
    ];
    const heurts = new Set([
      ...postes.flatMap((p) => obstacles.filter((o) => o.z === p.case.z && recouvre(o.corps, p.emprise)).map((o) => `${p.nom} × ${o.nom}`)),
      ...configurations.flatMap((a) => {
        const l = enVigueur(a);
        return l.flatMap((p, i) => l.slice(i + 1).filter((q) => q.case.z === p.case.z && recouvre(p.emprise, q.emprise)).map((q) => `${p.nom} × ${q.nom}`));
      }),
    ]);
    expect([...heurts]).toEqual([]);
  });

  it('la pièce montée à chaque poste et son servant, en deçà du bord de sa case, ne franchissent ni mur, ni porte, ni échelle de son pont (#3815)', () => {
    const bords = new Set<string>([GRAMMAIRE_ASCII.murHorizontal, GRAMMAIRE_ASCII.murVertical, GRAMMAIRE_ASCII.porte, MOTS_DES_PONTS.echelle]);
    const franchies = postes.flatMap(({ nom, case: c, dedans: r }) => ARETES.filter((a) => a.z === c.z && bords.has(a.glyphe)).filter((a) => (a.sens === 't'
      ? r.x0 + TOLERANCE < a.x - 0.5 && a.x - 0.5 < r.x1 - TOLERANCE && Math.min(r.y1, a.y + 0.5) - Math.max(r.y0, a.y - 0.5) > TOLERANCE
      : r.y0 + TOLERANCE < a.y - 0.5 && a.y - 0.5 < r.y1 - TOLERANCE && Math.min(r.x1, a.x + 0.5) - Math.max(r.x0, a.x - 0.5) > TOLERANCE))
      .map((a) => `${nom} × ${a.sens}(${a.x},${a.y}) ${a.glyphe}`));
    expect(franchies).toEqual([]);
  });

  /** Les points sondés dans le corps `c`, au pas `PAS`, à une épaisseur de cloison de ses bords. */
  const points = (c: Rect) => {
    const le = (a: number, b: number) => Array.from({ length: Math.floor((b - a - 2 * TOLERANCE) / PAS) + 1 }, (_, i) => a + TOLERANCE + i * PAS);
    return le(c.x0, c.x1).flatMap((x) => le(c.y0, c.y1).map((y) => ({ x, y })));
  };
  const dans = (r: Rect, { x, y }: { x: number; y: number }) => r.x0 - 1e-9 <= x && x <= r.x1 + 1e-9 && r.y0 - 1e-9 <= y && y <= r.y1 + 1e-9;

  it('l’affût de la pièce montée à chaque poste et son servant reposent sur son plancher : l’emprise libre des cases de son pont à sa hauteur, la case d’un mât hors de son fût (#3815)', () => {
    const sansAppui = postes.flatMap(({ nom, case: c, plancher, affut }) => {
      const pont = futs.filter((f) => f.z === c.z);
      const sols = CASES.filter((s) => s.z === c.z && hauteurs[s.glyphe] === plancher)
        .map((s) => (pont.some((f) => f.cle === k(s)) ? { x0: s.x - 0.5, x1: s.x + 0.5, y0: s.y - 0.5, y1: s.y + 0.5 } : libre(s.x, s.y, s.z)));
      const vides = points(affut).filter((p) => !sols.some((r) => dans(r, p)) || pont.some((f) => dans(f.corps, p)));
      return vides.length ? [`${nom} (${vides.length} points, dont ${vides[0].x.toFixed(3)},${vides[0].y.toFixed(3)})`] : [];
    });
    expect(sansAppui).toEqual([]);
  });

  it('chaque meuble tient dans l’emprise libre que le modèle laisse à ses cases, à une épaisseur de cloison près (#3767)', () => {
    const hors = meubles.flatMap((e) => {
      const dehors = points(corpsDu(e)).filter(({ x, y }) =>
        ![Math.floor(x + 0.5), Math.ceil(x - 0.5)].some((cx) => [Math.floor(y + 0.5), Math.ceil(y - 0.5)].some((cy) => dans(libre(cx, cy, e.z ?? 0), { x, y }))));
      return dehors.length ? [`${e.id} (${dehors.length} points, dont ${dehors[0].x.toFixed(3)},${dehors[0].y.toFixed(3)})`] : [];
    });
    expect(hors).toEqual([]);
  });

  it('deux meubles ne s’interpénètrent pas, sauf l’objet et ce qui le porte', () => {
    const heurts = meubles.flatMap((a, i) => meubles.slice(i + 1).filter((b) => {
      if ((a.z ?? 0) !== (b.z ?? 0) || portePar(scene, a, b.id) || portePar(scene, b, a.id)) return false;
      const [p, q] = [corpsDu(a), corpsDu(b)];
      return Math.min(p.x1, q.x1) - Math.max(p.x0, q.x0) > 1e-6 && Math.min(p.y1, q.y1) - Math.max(p.y0, q.y0) > 1e-6;
    }).map((b) => `${a.id} × ${b.id}`));
    expect(heurts).toEqual([]);
  });

  it('chaque objet posé tient sur le dessus de son support, plus haut que lui', () => {
    const poses = meubles.filter((e) => e.sur);
    expect(poses.map((e) => e.id).sort()).toEqual([
      'cale-caisse-5',
    ]);
    for (const e of poses) {
      const support = garanti(meubles.find((s) => s.id === e.sur), e.id, 'support');
      expect(fauteDAppui(scene, e), e.id).toBeUndefined();
      expect(piedDuDecor(scene, e), e.id).toBeGreaterThan(piedDuDecor(scene, support));
    }
  });
});

describe('la caraque posée dans une scène (poserLesNavires)', () => {

  it('au cap O, ses ponts se posent tels quels, à leurs hauteurs, décalés de leur coin', () => {
    const s = bassinDeLaCaraque('O');
    for (const z of [0, 1, 2, 3])
      for (let y = 0; y < 5; y++)
        for (let x = 0; x < 18; x++)
          if (!estAbsent(tileAt(scene, x, y, z))) expect(heightAt(s, 3 + x, 2 + y, z), `${x},${y},${z}`).toBe(heightAt(scene, x, y, z));
    expect(tileAt(s, 0, 0, 0)).toBe('eau');
  });

  it('au cap N, la proue au nord et tribord à l’est ; ses pièces prennent l’id du navire', () => {
    const s = bassinDeLaCaraque('N');
    // la case de cale (8, 2) du plan, au centre : x = 3 + (5 - 1 - 2), y = 2 + 8
    expect(heightAt(s, 5, 10, 0)).toBe(-2);
    // l'infirmerie, à tribord de la cale (y = 1 du plan), passe à l'est (x = 3 + 3)
    const infirmerie = garanti(s.effectZones?.find((z) => z.id === 'c1-infirmerie'), 'c1-infirmerie', 'pièce posée');
    expect(new Set(infirmerie.tiles!.map((t) => t.x))).toEqual(new Set([6]));
  });

  it('à tout cap, chaque meuble garde son calage tourné avec le pont et son appui : l’objet posé reste sur son support', () => {
    const mpt = sceneMetresPerTile(scene);
    /** Le décalage de l'ancre d'un décor depuis le centre de son empreinte, en cases : ce que son calage déplace. */
    const decalage = (e: SceneEntity) => {
      const [a, centre] = [ancreDuDecor(e, mpt), ancreDuDecor({ ...e, calage: undefined }, mpt)];
      return { x: a.x - centre.x, y: a.y - centre.y };
    };
    const meubles = scene.entities.filter((e) => e.kind === 'prop');
    // un quart horaire par quart du cap, depuis le cap O où les ponts se posent tels quels
    const quarts = { O: 0, N: 1, E: 2, S: 3 } as const;
    for (const cap of ['N', 'E', 'S', 'O'] as const) {
      const s = bassinDeLaCaraque(cap);
      for (const e of meubles) {
        const pose = garanti(s.entities.find((p) => p.id === `c1-${e.id}`), `${cap} ${e.id}`, 'meuble posé');
        expect(pose.sur, `${cap} ${e.id}`).toBe(e.sur && `c1-${e.sur}`);
        expect(fauteDAppui(s, pose), `${cap} ${e.id}`).toBeUndefined();
        expect(piedDuDecor(s, pose), `${cap} ${e.id}`).toBeCloseTo(piedDuDecor(scene, e), 9);
        let attendu = decalage(e);
        for (let q = 0; q < quarts[cap]; q++) attendu = { x: -attendu.y, y: attendu.x };
        const d = decalage(pose);
        expect(d.x, `${cap} ${e.id}`).toBeCloseTo(attendu.x, 9);
        expect(d.y, `${cap} ${e.id}`).toBeCloseTo(attendu.y, 9);
      }
    }
    // au cap N, la proue au nord et bâbord à l'ouest : le coffre de l'infirmerie reste plaqué à la proue et à bâbord
    expect(garanti(bassinDeLaCaraque('N').entities.find((e) => e.id === 'c1-infirmerie-coffre-1'), 'N', 'coffre').calage).toEqual({ x: -1, y: -1 });
  });

  it('à tout cap, les échelles mènent encore de la cale à la plage arrière', () => {
    for (const cap of ['N', 'E', 'S', 'O'] as const) {
      const s = bassinDeLaCaraque(cap);
      const piece = (id: string) => zoneWalkableCells(s, garanti(s.effectZones?.find((zo) => zo.id === id), id, 'pièce'))[0];
      const haut = piece('c1-plage-arriere');
      const atteint = reachable(s, piece('c1-cale'), 400, { blocked: new Set(), traverse: { climb: true, climbFullSpeed: true } });
      expect([...atteint.keys()], cap).toContain(`${haut.x},${haut.y},${haut.z}`);
    }
  });
});

describe('les Améliorations de la caraque à bord (pontsDuNavire)', () => {
  /** L'arête entre deux cases voisines du pont `z`, si elle porte un mur. */
  const arete = (s: Scene, a: [number, number], b: [number, number], z: number) => {
    const e = garanti(edgeOf(...a, ...b), `${a}|${b}`, 'arête');
    return (s.walls ?? []).find((w) => w.x === e.x && w.y === e.y && w.side === e.side && (w.z ?? 0) === z);
  };

  it('depuis l’embelle découverte, on voit la mer par-dessus le plat-bord, sans le franchir', () => {
    expect(areteOcculteEntre(scene, 6, 0, 6, -1, 2)).toBe(false);
    expect(wallBetween(scene, 6, 0, 6, -1, 2)).toBe(true);
  });

  it('Nid-de-pie : la case du grand mât monte à la hune, qui se gagne par l’échelle des haubans, à tout cap', () => {
    // la case du grand mât (9, 2) du plan, au cap O en (3 + 9, 2 + 2)
    expect(heightAt(bassinDeLaCaraque('O', []), 12, 4, 2)).toBe(1.95);
    expect(heightAt(bassinDeLaCaraque('O', ['nid-de-pie']), 12, 4, 2)).toBe(hauteurs.n);
    for (const cap of ['N', 'E', 'S', 'O'] as const) {
      const s = bassinDeLaCaraque(cap, ['nid-de-pie']);
      const hune = garanti(s.layers.flatMap(({ z }) => Array.from({ length: 24 * 24 }, (_, i) => ({ x: i % 24, y: Math.floor(i / 24), z })))
        .find((c) => isWalkable(s, c.x, c.y, c.z) && heightAt(s, c.x, c.y, c.z) > 20), cap, 'hune');
      const cale = zoneWalkableCells(s, garanti(s.effectZones?.find((zo) => zo.id === 'c1-cale'), cap, 'cale'))[0];
      const atteint = reachable(s, cale, 600, { blocked: new Set(), traverse: { climb: true, climbFullSpeed: true } });
      expect([...atteint.keys()], cap).toContain(`${hune.x},${hune.y},${hune.z}`);
    }
  });

  it('Embarcation de bord : le canot occupe deux cases au-dessus de l’embelle, sur les poutres de la passerelle, tourné avec le navire', () => {
    expect(bassinDeLaCaraque('O', []).entities.some((e) => e.id === 'c1-embarcation-de-bord')).toBe(false);
    const canot = (cap: 'N' | 'O') => garanti(bassinDeLaCaraque(cap, ['embarcation-de-bord']).entities.find((e) => e.id === 'c1-embarcation-de-bord'), cap, 'canot');
    expect(canot('O')).toMatchObject({ pos: { x: 9, y: 5 }, z: 3, facing: 'S' });
    // au cap N, la case (6..7, 3) du plan passe en x = 3 + (4 - 3), y = 2 + 6..7
    expect(canot('N')).toMatchObject({ pos: { x: 4, y: 8 }, z: 3, facing: 'O' });
  });

  it('Sabord : sans lui la coque de la batterie est pleine ; avec, ses sabords sont des fenêtres closes', () => {
    expect(arete(bassinDeLaCaraque('O', []), [10, 2], [10, 1], 1)).toMatchObject({ side: 'N' });
    expect(arete(bassinDeLaCaraque('O', []), [10, 2], [10, 1], 1)?.window).toBeUndefined();
    expect(arete(bassinDeLaCaraque('O', ['sabord']), [10, 2], [10, 1], 1)).toMatchObject({ window: true, shuttered: true });
    // au cap E, le sabord (7, 0) tribord du plan passe en x = 3 + 17 - 7, au sud : y = 2 + 4
    expect(arete(bassinDeLaCaraque('E', ['sabord']), [13, 6], [13, 7], 1)).toMatchObject({ window: true, shuttered: true });
  });

  it('une Amélioration inconnue est refusée', () => {
    expect(() => bassinDeLaCaraque('O', ['voile-magique'])).toThrow(/voile-magique/);
  });
});
