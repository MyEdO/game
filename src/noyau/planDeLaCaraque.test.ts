import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { garanti } from '../lib/garanti';
import { buildScene } from './mapSpec';
import { PLAN_DE_LA_CARAQUE } from './planDeLaCaraque';
import { reachedFloors, unreachableDescriptiveZones, zoneWalkableCells } from './mapQC';
import { areteOcculteEntre, edgeOf, heightAt, isDescriptiveZone, isWalkable, porteAuteur, sceneMetresPerTile, tileAt, wallBetween, type Scene, type SceneEntity } from './monde/scene';
import { estAbsent } from './monde/terrain';
import { reachable, tileKey } from './monde/path';
import { planClimb } from './monde/climbMove';
import { ancreDuDecor, propFootTiles } from './monde/footprint';
import { fauteDAppui, piedDuDecor, portePar } from './monde/poseDuDecor';
import { emprisePlanTournee } from '../data/props.types';
import { sceneZoneTiles } from './monde/zones';
import { findPropById, findVehicleById } from '../data';
import { grilleDesPonts } from '../data/schemas/grammaire/carte-ascii';
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
  const decor = meubles.filter((e) => new RegExp(`^${e.ref}-\\d+$`).test(e.id));
  /** Les meubles d'une pièce : ceux dont l'id est le sien suivi de leur `ref` et de leur rang. */
  const meublesDe = (piece: string) => meubles.filter((e) => new RegExp(`^${piece}-${e.ref}-\\d+$`).test(e.id));
  /** Les cases qu'un meuble couvre, sur son pont. */
  const casesDu = (e: (typeof meubles)[number]) =>
    propFootTiles(e.ref, e.pos, e.facing, sceneMetresPerTile(scene)).map((t) => ({ ...t, z: e.z ?? 0 }));
  /** Les deux cases de chaque arête de porte ou d'échelle : une trappe et le pied de son échelle, les deux côtés d'une porte. */
  const libres = new Set((scene.walls ?? []).filter((w) => porteAuteur(w) || w.climb).flatMap((w) => {
    const z = w.z ?? 0;
    return [{ x: w.x, y: w.y, z }, w.side === 'N' ? { x: w.x, y: w.y - 1, z } : { x: w.x + 1, y: w.y, z }].map(k);
  }));

  /** Les cases que le navire atteint depuis la cale, par ses échelles, sans passer par `sauf`. */
  const atteintes = (sauf?: { x: number; y: number; z: number }) => reachable(scene, caseDe('cale'), 400, {
    blocked: new Set(sauf ? [tileKey(sauf.x, sauf.y, sauf.z)] : []), traverse: { climb: true, climbFullSpeed: true },
  }).size;

  it('chaque pièce intérieure est meublée, sauf celle dont chaque case est celle d’une porte, d’une échelle, d’un poste ou le seul passage vers d’autres', () => {
    const toutes = atteintes();
    const passages = pieces.flatMap((p) => sceneZoneTiles(p).map((t) => ({ x: t.x, y: t.y, z: t.z ?? p.z ?? 0 })))
      .filter((c) => isWalkable(scene, c.x, c.y, c.z) && atteintes(c) < toutes - 1);
    const occupees = new Set([...libres, ...postes.map(k), ...passages.map(k)]);
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
        expect(findPropById(e.ref), e.id).toBeDefined();
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
    const c = garanti(emprisePlanTournee(garanti(findPropById(e.ref), e.id, 'décor'), e.facing ?? 'S', () => true), e.id, 'corps');
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

  /** La case de chaque poste du modèle commité, où se monte une pièce (`postes` de son manifeste, et ceux qu'une
   *  Amélioration ajoute, `selon`) : la case des ponts à la hauteur de son plancher dont l'emprise libre le contient, à
   *  une épaisseur de cloison près. Un point glTF (x, y, z) est au plan en (W/2 − z/mpt − ½, H/2 + x/mpt − ½). */
  const postes = (() => {
    const { w, h, cases } = grilleDesPonts(cartes);
    const mpt = sceneMetresPerTile(scene);
    return [manifeste.postes, ...Object.values(manifeste.selon).map((v) => v.postes ?? {})].flatMap((l) => Object.values(l).flat()).map(([gx, gy, gz]) => {
      const [x, y] = [w / 2 - gz / mpt - 0.5, h / 2 + gx / mpt - 0.5];
      const siennes = cases.filter((c) => hauteurs[c.glyphe] === gy).filter((c) => {
        const r = libre(c.x, c.y, c.z);
        return r.x0 - TOLERANCE <= x && x <= r.x1 + TOLERANCE && r.y0 - TOLERANCE <= y && y <= r.y1 + TOLERANCE;
      });
      expect(siennes.length, `poste ${gx},${gy},${gz}`).toBe(1);
      return { x: siennes[0].x, y: siennes[0].y, z: siennes[0].z };
    });
  })();

  it('aucun meuble ni décor dans l’emprise libre de la case d’un poste (#3815)', () => {
    expect(meubles.flatMap((e) => postes.filter((c) => c.z === (e.z ?? 0)).filter((c) => {
      const [p, q] = [corpsDu(e), libre(c.x, c.y, c.z)];
      return Math.min(p.x1, q.x1) - Math.max(p.x0, q.x0) > TOLERANCE && Math.min(p.y1, q.y1) - Math.max(p.y0, q.y0) > TOLERANCE;
    }).map((c) => `${e.id} × poste ${k(c)}`))).toEqual([]);
  });

  it('chaque meuble tient dans l’emprise libre que le modèle laisse à ses cases, à une épaisseur de cloison près (#3767)', () => {
    const hors = meubles.flatMap((e) => {
      const c = corpsDu(e);
      const le = (a: number, b: number) => Array.from({ length: Math.floor((b - a - 2 * TOLERANCE) / PAS) + 1 }, (_, i) => a + TOLERANCE + i * PAS);
      const dehors = le(c.x0, c.x1).flatMap((x) => le(c.y0, c.y1).map((y) => ({ x, y }))).filter(({ x, y }) =>
        ![Math.floor(x + 0.5), Math.ceil(x - 0.5)].some((cx) => [Math.floor(y + 0.5), Math.ceil(y - 0.5)].some((cy) => {
          const r = libre(cx, cy, e.z ?? 0);
          return r.x0 - 1e-9 <= x && x <= r.x1 + 1e-9 && r.y0 - 1e-9 <= y && y <= r.y1 + 1e-9;
        })));
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
    expect(arete(bassinDeLaCaraque('O', []), [9, 2], [9, 1], 1)).toMatchObject({ side: 'N' });
    expect(arete(bassinDeLaCaraque('O', []), [9, 2], [9, 1], 1)?.window).toBeUndefined();
    expect(arete(bassinDeLaCaraque('O', ['sabord']), [9, 2], [9, 1], 1)).toMatchObject({ window: true, shuttered: true });
    // au cap E, le sabord (6, 0) tribord du plan passe en x = 3 + 17 - 6, au sud : y = 2 + 4
    expect(arete(bassinDeLaCaraque('E', ['sabord']), [14, 6], [14, 7], 1)).toMatchObject({ window: true, shuttered: true });
  });

  it('une Amélioration inconnue est refusée', () => {
    expect(() => bassinDeLaCaraque('O', ['voile-magique'])).toThrow(/voile-magique/);
  });
});
