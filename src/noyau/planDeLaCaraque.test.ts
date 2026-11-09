import { describe, it, expect } from 'vitest';
import { garanti } from '../lib/garanti';
import { buildScene } from './mapSpec';
import { PLAN_DE_LA_CARAQUE } from './planDeLaCaraque';
import { reachedFloors, unreachableDescriptiveZones, zoneWalkableCells } from './mapQC';
import { areteOcculteEntre, edgeOf, heightAt, isDescriptiveZone, isWalkable, porteAuteur, sceneMetresPerTile, tileAt, wallBetween, type Scene } from './monde/scene';
import { estAbsent } from './monde/terrain';
import { reachable } from './monde/path';
import { planClimb } from './monde/climbMove';
import { propFootTiles } from './monde/footprint';
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
    expect([[8, 2, 0], [8, 2, 1], [8, 2, 2], [1, 2, 3], [6, 2, 3], [14, 2, 3]].map(([x, y, z]) => heightAt(scene, x, y, z)))
      .toEqual([-2, 0.3, 1.95, 5.6, 5.6, 5.85]);
    const { cases } = grilleDesPonts(cartes);
    for (const c of cases) expect(heightAt(scene, c.x, c.y, c.z), `${c.x},${c.y},${c.z}`).toBe(hauteurs[c.glyphe]);
    expect(scene.layers.flatMap(({ z }) => Array.from({ length: 18 * 5 }, (_, i) => ({ x: i % 18, y: Math.floor(i / 18), z })))
      .filter((c) => !estAbsent(tileAt(scene, c.x, c.y, c.z))).length).toBe(cases.length);
  });

  it('chaque pièce de la légende des plans est une zone, sous son nom', () => {
    const zones = (scene.effectZones ?? []).filter(isDescriptiveZone);
    expect(zones.map((z) => z.label).sort()).toEqual(Object.values(legende).map((p) => p.label).sort());
  });

  it('à pied, chaque pont dessert ses pièces, le gaillard et la plage arrière par la passerelle, et aucune échelle ne se gravit sans geste', () => {
    Object.entries(calques).forEach(([etage, rangees]) => {
      const z = Number(etage.slice(1));
      const premiere = garanti([...([] as string[]).concat(rangees).join('')].find((ch) => ch in legende), etage, 'pièce du pont');
      const depart = caseDe(garanti(legende[premiere].id, premiere, 'id de pièce'));
      expect(unreachableDescriptiveZones(scene, depart).filter((zo) => (zo.z ?? 0) === z).map((zo) => zo.id), etage).toEqual([]);
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
  const meubles = scene.entities.filter((e) => e.kind === 'prop');
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

  it('chaque pièce intérieure est meublée, sauf celle dont la seule case est celle de sa porte', () => {
    const vides = new Set(pieces.filter((p) => sceneZoneTiles(p).every((t) => libres.has(k({ x: t.x, y: t.y, z: t.z ?? p.z ?? 0 })))).map((p) => p.id));
    expect(pieces.filter((p) => meublesDe(p.id).length > 0).map((p) => p.id).sort())
      .toEqual(pieces.filter((p) => p.presentation === 'interior' && !vides.has(p.id)).map((p) => p.id).sort());
    expect(pieces.flatMap((p) => meublesDe(p.id)).length, 'meuble sans pièce').toBe(meubles.length);
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

  it('chaque meuble couvre des cases des ponts de la source, dans la coque', () => {
    const emprise = new Set(grilleDesPonts(cartes).cases.map(k));
    expect(meubles.flatMap((e) => casesDu(e).filter((c) => !emprise.has(k(c))).map((c) => `${e.id} ${k(c)}`))).toEqual([]);
  });

  it('deux meubles ne se chevauchent pas', () => {
    const cases = meubles.flatMap((e) => casesDu(e).map(k));
    expect(cases.filter((c, i) => cases.indexOf(c) !== i)).toEqual([]);
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

  it('Embarcation de bord : le canot occupe deux cases de l’embelle, tourné avec le navire', () => {
    expect(bassinDeLaCaraque('O', []).entities.some((e) => e.id === 'c1-embarcation-de-bord')).toBe(false);
    const canot = (cap: 'N' | 'O') => garanti(bassinDeLaCaraque(cap, ['embarcation-de-bord']).entities.find((e) => e.id === 'c1-embarcation-de-bord'), cap, 'canot');
    expect(canot('O')).toMatchObject({ pos: { x: 10, y: 4 }, z: 2, facing: 'S' });
    // au cap N, la case (7..8, 2) du plan passe en x = 3 + 2, y = 2 + 7..8
    expect(canot('N')).toMatchObject({ pos: { x: 5, y: 9 }, z: 2, facing: 'O' });
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
