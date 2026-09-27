import { describe, it, expect } from 'vitest';
import { findPropById, props } from '../data';
import { chebyshev } from '../engine/grid';
import { caseDe, capVolumique, empreinteDuProp, offsetAncre, placesLocalesDuProp, rotatePropLocal, type PropData } from '../data/props.types';
import { buildProps } from '../gameIso/builders/props';
import { buildPropVolumes } from '../gameIso/builders/propVolumes';
import { estPropVolumique } from '../gameIso/builders/types';
import { emptyScene, heightAt, sceneMetresPerTile, type Scene, type SceneEntity } from './scene';
import { seatSlotsOf } from './seating';
import type { Dir4 } from './dir8';

/**
 * L'ANCRE D'UNE PLACE EST CELLE DU DÉCOR (#1509 L5′).
 *
 * Une place assise se pose sur `decorAncre` (`state/footprint.ts`) — le centre de l'empreinte
 * effective du meuble — exactement comme la géométrie de sa recette (`gameIso/builders/props.ts`) et
 * comme le foyer de la lampe qu'il porte (`state/vision.ts`). Ce fichier tient les deux faces de
 * cette affirmation, sur des scènes CONSTRUITES pour ce contrat (#1709 — aucune carte de campagne
 * n'entre ici : une case déplacée sur un plan livré ne doit rougir aucun test) :
 *  1. la POPULATION posée, place par place, sur les deux décors à places du catalogue et aux quatre
 *     caps — l'ancre de CHAQUE place est celle de SON décor, mesurée sur les faces émises ;
 *  2. sur un meuble qui couvre VRAIMENT deux cases, l'ancre de ses places coïncide avec celle que la
 *     géométrie emploie — l'ancre géométrique étant MESURÉE sur les faces émises, jamais recalculée.
 */

const n6 = (v: number) => v.toFixed(6);

/**
 * ANCRE MONDE que la GÉOMÉTRIE emploie pour un décor POSÉ, MESURÉE sur les faces émises : la recette
 * bâtie à l'origine (`ancre` (0,0)) et la recette du décor posé ne diffèrent que d'une TRANSLATION
 * rigide, et cette translation EST l'ancre. Rien n'est relu de `decorAncre` ici — sinon ces contrats
 * répéteraient la formule qu'ils jugent au lieu de la confronter au monde dessiné.
 */
function ancreGeometrique(sc: Scene, entId: string): { x: number; y: number; sol: number } {
  const ent = sc.entities.find((e) => e.id === entId)!;
  const prop = findPropById(ent.ref) as PropData;
  const mpt = sceneMetresPerTile(sc);
  const el = buildProps(sc).find((e) => e.entId === entId)!;
  expect(estPropVolumique(el), `${ent.ref} doit sortir en VOLUME (sinon rien n’est mesuré)`).toBe(true);
  const posees = estPropVolumique(el) ? el.faces : [];
  const locales = buildPropVolumes(prop, { ancre: { x: 0, y: 0 }, facing: capVolumique(ent.facing)!, baseHeightM: 0 }, mpt);
  expect(posees.length).toBe(locales.length);
  const deltas = posees.flatMap((f, i) => f.poly.map((p, j) => ({ x: p.x - locales[i].poly[j].x, y: p.y - locales[i].poly[j].y, h: p.h - locales[i].poly[j].h })));
  const ecart = Math.max(...deltas.map((d) => Math.max(chebyshev(d, deltas[0]), Math.abs(d.h - deltas[0].h))));
  expect(ecart, 'la pose du décor doit être une translation RIGIDE de sa recette').toBeLessThan(1e-9);
  return { x: deltas[0].x, y: deltas[0].y, sol: deltas[0].h };
}

/** ANCRE MONDE que la PLACE emploie : sa position résolue, moins la rotation de son ancre locale au
 *  cap de l'instance (`rotatePropLocal`, la même rotation que la géométrie applique). */
function ancreDeLaPlace(sc: Scene, entId: string, slotId: string): { x: number; y: number } {
  const ent = sc.entities.find((e) => e.id === entId)!;
  const prop = findPropById(ent.ref) as PropData;
  const place = seatSlotsOf(sc, entId).find((s) => s.slotId === slotId)!;
  const slot = prop.seatSlots!.find((s) => s.id === slotId)!;
  const [rx, ry] = rotatePropLocal(slot.anchor.xM / sceneMetresPerTile(sc), slot.anchor.yM / sceneMetresPerTile(sc), capVolumique(ent.facing)!);
  return { x: place.anchor.x - rx, y: place.anchor.y - ry };
}

/**
 * POPULATION DE PLACES sur une scène CONSTRUITE : les DEUX décors à places du catalogue, posés aux
 * QUATRE caps, chacun avec ses places — et la propriété qui vaut pour chacune d'elles, DÉRIVÉE du
 * décor qui la porte. Rien n'y est recopié : ni une coordonnée, ni un compte.
 */
describe('places POSÉES — chaque place tient l’ancre de SON décor (scène construite)', () => {
  const CAPS: Dir4[] = ['N', 'E', 'S', 'O'];
  /** TOUS les décors à places du catalogue, DÉRIVÉS : un troisième y entre sans toucher ce test. */
  const REFS = props.filter((p) => p.seatSlots?.length).map((p) => p.id);
  /** Un décor par (réf × cap), espacés de 4 cases : aucun ne mord sur l'abord d'un autre. */
  const POSES = REFS.flatMap((ref, i) => CAPS.map((facing, j) => ({
    id: `${ref}-${facing}`, ref, facing, pos: { x: 3 + j * 4, y: 3 + i * 4 },
  })));

  const salle = (): Scene => {
    const w = 20;
    const h = 12;
    return {
      ...emptyScene(w, h),
      id: 'fixture-places',
      layers: [{ z: 0, tiles: new Array(w * h).fill('plancher') }],
      entities: POSES.map((p) => ({ id: p.id, kind: 'prop', ref: p.ref, pos: { ...p.pos }, facing: p.facing } as SceneEntity)),
    };
  };

  it('la fixture EXERCE les deux étendues du catalogue : la ronde tient sur UNE case, la murale sur DEUX', () => {
    const sc = salle();
    const mpt = sceneMetresPerTile(sc);
    const etendues = new Set(POSES.map((p) => {
      const { w, h } = empreinteDuProp(findPropById(p.ref), p.facing, mpt);
      return `${w}x${h}`;
    }));
    // PROPRIÉTÉ, jamais la liste : il FAUT plus d'une étendue pour que l'ancre au centre se distingue
    // de l'ancre au coin NO — avec des empreintes toutes impaires, les deux coïncideraient.
    expect(etendues.size, `étendues mesurées : ${[...etendues].sort().join(', ')}`).toBeGreaterThan(1);
    // Et chaque décor posé porte bien des places : sans elles, tout ce qui suit serait vide.
    for (const p of POSES) expect(seatSlotsOf(sc, p.id).length, p.id).toBeGreaterThan(0);
  });

  it('l’ancre de CHAQUE place est celle de son décor, mesurée sur la géométrie (≤ 1e-9)', () => {
    const sc = salle();
    const ecarts: string[] = [];
    for (const p of POSES) {
      const geo = ancreGeometrique(sc, p.id);
      for (const place of seatSlotsOf(sc, p.id)) {
        const ancre = ancreDeLaPlace(sc, p.id, place.slotId);
        const d = chebyshev(ancre, geo);
        if (d > 1e-9) ecarts.push(`${p.id}/${place.slotId} : place=(${n6(ancre.x)},${n6(ancre.y)}) géométrie=(${n6(geo.x)},${n6(geo.y)}) écart=${n6(d)}`);
      }
    }
    expect(ecarts).toEqual([]);
  });

  it('le SOL de chaque place est celui du PIED de son décor', () => {
    const sc = salle();
    const ecarts: string[] = [];
    for (const p of POSES) {
      const geo = ancreGeometrique(sc, p.id);
      for (const place of seatSlotsOf(sc, p.id))
        if (Math.abs(place.ground - geo.sol) > 1e-9) ecarts.push(`${p.id}/${place.slotId} : sol=${n6(place.ground)} pied=${n6(geo.sol)}`);
    }
    expect(ecarts).toEqual([]);
  });

  it('chaque place aborde une case VOISINE de son siège, et deux places ne partagent jamais un abord', () => {
    const sc = salle();
    const abords = new Map<string, string>();
    const ecarts: string[] = [];
    for (const p of POSES) {
      for (const place of seatSlotsOf(sc, p.id)) {
        const siege = caseDe(place.anchor.x, place.anchor.y);
        const d = chebyshev(place.approach, siege);
        if (d !== 1) ecarts.push(`${p.id}/${place.slotId} : abord (${place.approach.x},${place.approach.y}) à ${d} case(s) du siège (${siege.x},${siege.y})`);
        const cle = `${place.approach.x},${place.approach.y},${place.approach.z ?? 0}`;
        const deja = abords.get(cle);
        if (deja) ecarts.push(`${p.id}/${place.slotId} : abord ${cle} déjà pris par ${deja}`);
        abords.set(cle, `${p.id}/${place.slotId}`);
      }
    }
    expect(ecarts).toEqual([]);
  });
});

/**
 * MEUBLE À PLACES SUR DEUX CASES — le cas, aux QUATRE caps, sur une pose CONSTRUITE qui l'exerce.
 *
 * Le corps de `table-murale-2-tabourets` mesure 3,00 m le long du mur (#1509 L9′) : il couvre deux
 * cases à l'échelle par défaut du monde (2 m/case, LDB 15 l.12) — le premier contrat ci-dessous le
 * MESURE. C'est cette empreinte paire qui sépare d'une demi-case l'ancrage au coin NO
 * (`SceneEntity.pos`) et l'ancrage au centre de l'empreinte, celui que la géométrie emploie.
 */
describe('meuble à places de DEUX cases — l’ancre des places EST celle de la géométrie', () => {
  const REF = 'table-murale-2-tabourets';
  const ID = 'murale';
  const POS = { x: 5, y: 5 };
  /** Échelle à laquelle le corps de ce meuble couvre deux cases : celle du monde par défaut. */
  const MPT = 2;
  const CAPS: Dir4[] = ['N', 'E', 'S', 'O'];

  const prop = findPropById(REF) as PropData;
  const scene = (facing: Dir4): Scene => ({
    ...emptyScene(12, 12),
    metresPerTile: MPT,
    entities: [{ id: ID, kind: 'prop', pos: { ...POS }, ref: REF, facing } as SceneEntity],
  });

  const ancreDeLaGeometrie = (facing: Dir4, sc: Scene = scene(facing)) => ancreGeometrique(sc, ID);
  const ancrePlace = (facing: Dir4, slotId: string) => ancreDeLaPlace(scene(facing), ID, slotId);

  it('la fixture EXERCE bien le cas : deux cases, et l’empreinte tourne avec le cap', () => {
    expect(CAPS.map((c) => { const { w, h } = empreinteDuProp(prop, c, MPT); return `${c}:${w}x${h}`; }))
      .toEqual(['N:2x1', 'E:1x2', 'S:2x1', 'O:1x2']);
    expect(prop.seatSlots?.map((s) => s.id)).toEqual(['place-1', 'place-2']);
  });

  it('aux quatre caps, l’ancre de chaque place coïncide avec celle de la géométrie (≤ 1e-9)', () => {
    const ecarts: string[] = [];
    for (const cap of CAPS) {
      const geo = ancreDeLaGeometrie(cap);
      for (const slot of prop.seatSlots!) {
        const place = ancrePlace(cap, slot.id);
        const d = chebyshev(place, geo);
        if (d > 1e-9) ecarts.push(`${cap}/${slot.id} : place=(${n6(place.x)},${n6(place.y)}) géométrie=(${n6(geo.x)},${n6(geo.y)}) écart=${n6(d)}`);
      }
    }
    expect(ecarts).toEqual([]);
  });

  /**
   * ABORDS SYMÉTRIQUES. Les deux places de ce meuble sont l'image l'une de l'autre par l'axe de son
   * ancre (ancres locales opposées, `xM: ±1`) : leurs cases d'abord le sont donc aussi, et leur
   * somme vaut deux fois l'ancre. C'est ce que garantit l'application de `approach` depuis la CASE du
   * siège ; appliqué depuis l'ancre FRACTIONNAIRE du meuble, l'arrondi tombe sur un demi-entier à
   * chaque place d'une empreinte paire et les départage toutes du même côté — mesuré au cap N :
   * (0,1) et (2,1), dont la somme vaut 2 pour une ancre à 0,5.
   */
  it('les abords des DEUX places sont MIROIR l’un de l’autre, aux quatre caps', () => {
    const ecarts: string[] = [];
    for (const cap of CAPS) {
      const centre = offsetAncre(empreinteDuProp(prop, cap, MPT));
      const [p1, p2] = placesLocalesDuProp(prop, cap, MPT);
      // L'AXE du miroir se lit sur les places elles-mêmes : `u` est la direction qui SÉPARE les deux
      // ancres, donc la normale de l'axe — aucune orientation n'est écrite en dur, elle tourne avec
      // le cap comme le reste.
      const d = { x: p1.ancre.x - p2.ancre.x, y: p1.ancre.y - p2.ancre.y };
      const norme = Math.hypot(d.x, d.y);
      expect(norme, `${cap} : deux places confondues, il n’y a plus de miroir à mesurer`).toBeGreaterThan(1e-9);
      const u = { x: d.x / norme, y: d.y / norme };
      const relatif = (p: { x: number; y: number }) => ({ x: p.x - centre.x, y: p.y - centre.y });
      const a = relatif(p1.abord), b = relatif(p2.abord);
      const dot = a.x * u.x + a.y * u.y;
      const reflechi = { x: a.x - 2 * dot * u.x, y: a.y - 2 * dot * u.y };
      if (Math.abs(reflechi.x - b.x) > 1e-9 || Math.abs(reflechi.y - b.y) > 1e-9) {
        ecarts.push(`${cap} : abord de « ${p1.slot.id} » réfléchi = (${n6(reflechi.x + centre.x)},${n6(reflechi.y + centre.y)})`
          + ` mais « ${p2.slot.id} » aborde en (${p2.abord.x},${p2.abord.y})`);
      }
    }
    expect(ecarts).toEqual([]);
  });

  /**
   * ALTITUDE. Le sol d'une place est celui que la GÉOMÉTRIE pose sous la recette — mesuré ici comme la
   * translation VERTICALE des faces émises, jamais relu de `heightAt`. La fixture porte une marche
   * SOUS la seconde case de l'empreinte : lire le sol à la case du siège au lieu du pied du décor
   * décollerait le corps de l'un des deux tabourets dessinés.
   */
  it('le sol d’une place est celui du PIED du décor, marche sous l’empreinte comprise', () => {
    const cap: Dir4 = 'N';
    const sc = scene(cap);
    const marche = sc.layers[0];
    marche.height = new Array(sc.dimensions.w * sc.dimensions.h).fill(0);
    marche.height[POS.y * sc.dimensions.w + POS.x + 1] = 1.5; // la SECONDE case du 2×1
    expect(heightAt(sc, POS.x, POS.y, 0)).not.toBe(heightAt(sc, POS.x + 1, POS.y, 0)); // la marche MORD
    const geo = ancreDeLaGeometrie(cap, sc);
    const sols = seatSlotsOf(sc, ID).map((p) => p.ground);
    expect(sols).toEqual([geo.sol, geo.sol]);
  });

  it('LA MORSURE : sur ce meuble, l’ancre de la géométrie N’EST PAS `pos` — une demi-case l’en sépare', () => {
    const ecarts = CAPS.map((cap) => {
      const geo = ancreDeLaGeometrie(cap);
      return `${cap}:${n6(geo.x - POS.x)},${n6(geo.y - POS.y)}`;
    });
    // Le coin NO d'une empreinte 2×1 est à une demi-case de son centre, sur l'axe étendu : c'est
    // exactement l'écart qu'une place ancrée sur `SceneEntity.pos` porterait, et que le contrat
    // ci-dessus mesure à zéro.
    expect(ecarts).toEqual(['N:0.500000,0.000000', 'E:0.000000,0.500000', 'S:0.500000,0.000000', 'O:0.000000,0.500000']);
  });
});
