// @vitest-environment jsdom
/**
 * FLAQUES DE LAMPE de l'écran de jeu volumique (#1245, L1 à L3) — cinq étages, tous nécessaires :
 *
 *  1. la DÉCISION (`stagePointLights.ts`) : ce qu'une source de lumière de la scène écrit sur une lampe
 *     (position monde, portée = rayon RAW, intensité qui COMPLÈTE le palier d'ambiance), et sur QUEL
 *     slot du pool — une source garde le sien tant qu'elle vit ;
 *  2. la MATIÈRE : ce que three fait de `decay = 0` et de `distance` — sa contribution est constante
 *     puis coupée EXACTEMENT à la portée (mesuré sur ses propres chunks de shader), et le COMPTE de
 *     lampes ponctuelles entre dans sa clé de cache de programme (d'où le pool fixe) ;
 *  3. le PROFIL : la part d'albédo qu'une flaque rend au sol, épinglée point par point, et la garde de
 *     SATURATION — three additionne les contributions sans tone mapping, donc la luminance du sol des
 *     scènes livrées ne doit dépasser 1 à aucune heure ;
 *  4. le MONTAGE réel : le compte de lampes ne bouge d'un cran ni à l'heure ni à la scène, aucune
 *     n'est jamais rendue invisible, l'écran porte la trace lisible de ses flaques (`data-lampes`), et
 *     le nombre d'ÉCRITURES sur le pool est celui d'une passe — jamais une par frame de caméra ;
 *  5. le PERSONNAGE dans la flaque (L3) : un billboard n'a pas de normale, sa lumière est donc un
 *     scalaire — celui de SA CASE, par la même loi que le sol, sans quoi le sol s'allume et les
 *     personnages restent plats.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { useGame } from '../../state/store';
import { emptyScene, heightAt, sceneMetresPerTile, type Scene } from '../../state/scene';
import { sceneLightSources } from '../../state/visionState';
import { ambientScalar, buildOpaque, computeLightField, mapLights, type LightSource } from '../../state/vision';
import { AUCUN_CHROME, TEINTE_PLEINE, poseBoards, type Board } from './boardPose';
import { ambianceLuminance } from '../catalog/ambiance';
import { lightLevels } from '../../data';
import { areneCampaign } from '../../scenes/campaign';
import { MondeDeCampagne } from './MondeDeCampagne';
import type { Dims } from '../../geometry/iso';
import { GameStage3D, setStageRendererFactory } from './GameStage3D';
import { BancRenderer, brancherArdoise, scènes, viderCaptures } from './banc-volumique';
import {
  applyPointLights,
  billboardExposure,
  createPointLightPool,
  extinctionDe,
  flaqueLuminance,
  flaquePart,
  pointLightWrites,
  FLAME_INTENSITY,
  FLAME_LIFT_M,
  FOYER_NUIT_CIBLE,
  POINT_LIGHT_BUDGET,
  type PointLightSlots,
} from './stagePointLights';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const MIDI = 12 * 60;
const NUIT = 23 * 60;

/** Scène d'extérieur portant `n` braséros (`props.json` : rayon 4 cases) à des cases distinctes. */
function avecBraseros(n: number): Scene {
  const scene = emptyScene(10, 10);
  scene.ambiance = 'exterieur';
  scene.entities = Array.from({ length: n }, (_, i) => ({
    id: `b${i}`, kind: 'prop', pos: { x: 1 + i, y: 2 }, ref: 'brasero',
  })) as unknown as Scene['entities'];
  return scene;
}

/** Scène d'extérieur portant `n` lampadaires (`props.json` : rayon 5 cases, ton `lanterne`) — la
 *  source STABLE du décor, celle dont l'intensité ne dépend que de l'heure (#1245, L4). */
function avecLampadaires(n: number): Scene {
  const scene = emptyScene(10, 10);
  scene.ambiance = 'exterieur';
  scene.entities = Array.from({ length: n }, (_, i) => ({
    id: `l${i}`, kind: 'prop', pos: { x: 1 + i, y: 2 }, ref: 'lampadaire',
  })) as unknown as Scene['entities'];
  return scene;
}

const source = (over: Partial<LightSource> = {}): LightSource => ({ pos: { x: 3, y: 4 }, radiusTiles: 4, ...over });

/** Les slots ALLUMÉS d'une table, dans l'ordre des slots. */
const allumés = (slots: PointLightSlots): { slot: number; srcId?: string }[] =>
  slots.map((w, slot) => ({ slot, w })).filter((s) => s.w && s.w.intensity > 0).map((s) => ({ slot: s.slot, srcId: s.w!.srcId }));

// ── 1. DÉCISION ─────────────────────────────────────────────────────────────────────────────────

describe('stagePointLights — le POOL est fixe, seules les intensités bougent', () => {
  it('une lampe du pool naît éteinte, VISIBLE, sans ombre et sans atténuation physique', () => {
    const pool = createPointLightPool();
    expect(pool.length).toBe(POINT_LIGHT_BUDGET);
    for (const l of pool) {
      expect([l.isPointLight, l.intensity, l.visible, l.castShadow, l.decay]).toEqual([true, 0, true, false, 0]);
    }
  });

  it('le COMPTE ne bouge pour aucun nombre de sources — les lampes en trop retombent à 0', () => {
    const pool = createPointLightPool();
    const opts = { scene: avecBraseros(0), mpt: 2, ambianceLum: 0 };
    for (const n of [0, 1, 3, POINT_LIGHT_BUDGET, POINT_LIGHT_BUDGET + 18]) {
      const sources = Array.from({ length: n }, (_, i) => source({ pos: { x: i % 9, y: 1 }, radiusTiles: 1 + i }));
      applyPointLights(pool, pointLightWrites(sources, opts));
      expect([n, pool.length]).toEqual([n, POINT_LIGHT_BUDGET]);
      const allumées = pool.filter((l) => l.intensity > 0).length;
      expect([n, allumées]).toEqual([n, Math.min(n, POINT_LIGHT_BUDGET)]);
    }
  });

  it('`visible` n’est JAMAIS écrit (l’écrire retirerait la lampe de la passe, donc ferait varier le compte)', () => {
    const pool = createPointLightPool();
    for (const l of pool) {
      Object.defineProperty(l, 'visible', {
        configurable: true,
        get: () => true,
        set: () => { throw new Error('`visible` écrit : le compte de lampes de la clé de programme bougerait'); },
      });
    }
    const opts = { scene: avecBraseros(0), mpt: 2, ambianceLum: 0 };
    expect(() => applyPointLights(pool, pointLightWrites([source()], opts))).not.toThrow();
    expect(() => applyPointLights(pool, [])).not.toThrow();
  });
});

describe('stagePointLights — ce qu’une flaque écrit : sa place, sa portée, son intensité', () => {
  const scene = avecBraseros(0);
  const opts = { scene, mpt: 2, ambianceLum: 0 };

  it('la portée est le rayon RAW de la source, converti à l’échelle de la carte', () => {
    expect(pointLightWrites([source({ radiusTiles: 4 })], opts)[0]!.distance).toBe(4 * 2);
    expect(pointLightWrites([source({ radiusTiles: 10 })], { ...opts, mpt: 3 })[0]!.distance).toBe(10 * 3);
  });

  it('la lampe se pose sur la case de sa source, à SON étage, une flamme au-dessus du sol', () => {
    const w = pointLightWrites([source({ pos: { x: 3, y: 4 }, z: 0 })], opts)[0]!;
    expect([w.x, w.z]).toEqual([3 * 2, 4 * 2]);
    expect(w.y).toBeCloseTo(heightAt(scene, 3, 4, 0) + FLAME_LIFT_M, 9);
    // Un étage plus haut : la lampe monte avec le sol de son étage (le halo mécanique y est déjà, #1245 L0).
    const étage = pointLightWrites([source({ pos: { x: 3, y: 4 }, z: 1 })], opts)[0]!;
    expect(étage.y).toBeCloseTo(heightAt(scene, 3, 4, 1) + FLAME_LIFT_M, 9);
  });

  it('la flaque COMPLÈTE le palier : nulle en plein jour, pleine en ténèbres — sans porte par nom', () => {
    const intensité = (ambianceLum: number) => pointLightWrites([source()], { ...opts, ambianceLum })[0]!.intensity;
    expect(intensité(1)).toBe(0); // `jour` : `ambianceLuminance(1)` vaut 1, il ne reste rien à allumer
    expect(intensité(0)).toBeCloseTo(FLAME_INTENSITY * Math.PI, 9);
    // Palier `nuit` RÉEL (le plancher mesuré : `ambianceLuminance(0,18)`), pas le 0,18 du palier brut.
    expect(ambianceLuminance(0.18)).toBeCloseTo(0.3276, 4);
    expect(intensité(ambianceLuminance(0.18))).toBeCloseTo(FLAME_INTENSITY * Math.PI * (1 - 0.3276), 4);
  });

  it('chaque écriture garde l’id de son PORTEUR (la couture par laquelle une lampe suivra son sujet)', () => {
    const slots = pointLightWrites([source({ srcId: 'b0' }), source({ srcId: undefined })], opts);
    expect(slots.slice(0, 2).map((w) => w!.srcId)).toEqual(['b0', undefined]);
  });
});

describe('stagePointLights — le SLOT d’une source est STABLE (une lampe ne saute pas de sujet)', () => {
  const opts = { scene: avecBraseros(0), mpt: 2, ambianceLum: 0 };
  const src = (id: string, x: number, carried = false) => source({ srcId: id, pos: { x, y: 1 }, carried });

  it('l’ordre de la liste ne décide plus du slot : une source GARDE le sien quand la liste bouge', () => {
    const f1 = pointLightWrites([src('a', 1), src('b', 2), src('c', 3)], opts);
    expect(allumés(f1)).toEqual([{ slot: 0, srcId: 'a' }, { slot: 1, srcId: 'b' }, { slot: 2, srcId: 'c' }]);
    // Liste renversée (et un rayon plus large en tête) : chacun reste sur SON slot.
    const f2 = pointLightWrites([src('c', 3), src('b', 2), src('a', 1)], { ...opts, prev: f1 });
    expect(allumés(f2)).toEqual([{ slot: 0, srcId: 'a' }, { slot: 1, srcId: 'b' }, { slot: 2, srcId: 'c' }]);
  });

  it('une source qui MEURT libère son slot sans déplacer les autres — la nouvelle prend le trou', () => {
    const f1 = pointLightWrites([src('a', 1), src('b', 2), src('c', 3)], opts);
    const f2 = pointLightWrites([src('a', 1), src('c', 3)], { ...opts, prev: f1 });
    expect(f2[1]).toBeNull(); // le slot de « b » s'éteint sur place
    expect(allumés(f2)).toEqual([{ slot: 0, srcId: 'a' }, { slot: 2, srcId: 'c' }]);
    const f3 = pointLightWrites([src('a', 1), src('c', 3), src('d', 4)], { ...opts, prev: f2 });
    expect(allumés(f3)).toEqual([{ slot: 0, srcId: 'a' }, { slot: 1, srcId: 'd' }, { slot: 2, srcId: 'c' }]);
  });

  it('la source qui BOUGE garde son slot : seule sa position change', () => {
    const f1 = pointLightWrites([src('a', 1, true), src('b', 2)], opts);
    const slotA = f1.findIndex((w) => w?.srcId === 'a');
    const f2 = pointLightWrites([src('a', 7, true), src('b', 2)], { ...opts, prev: f1 });
    expect(f2.findIndex((w) => w?.srcId === 'a')).toBe(slotA);
    expect(f2[slotA]!.x).toBe(7 * 2);
  });

  it('budget SATURÉ : les sources POSÉES restent allumées, ce sont les PORTÉES qui débordent', () => {
    // 13 sources pour 12 lampes : 12 braséros posés (rayon 4) + une lanterne portée de rayon 10.
    const posées = Array.from({ length: POINT_LIGHT_BUDGET }, (_, i) => src(`b${i}`, i));
    const lanterne = source({ srcId: 'h1', pos: { x: 5, y: 5 }, radiusTiles: 10, carried: true });
    const slots = pointLightWrites([lanterne, ...posées], opts);
    expect(allumés(slots).map((s) => s.srcId).sort()).toEqual(posées.map((s) => s.srcId).sort());
    expect(slots.some((w) => w?.srcId === 'h1')).toBe(false);
  });

  it('sous le budget, la portée s’allume comme les autres (la priorité ne l’éteint pas)', () => {
    const slots = pointLightWrites([source({ srcId: 'h1', carried: true }), src('b0', 0)], opts);
    expect(allumés(slots)).toEqual([{ slot: 0, srcId: 'b0' }, { slot: 1, srcId: 'h1' }]);
  });
});

// ── 2. MATIÈRE (three) ──────────────────────────────────────────────────────────────────────────

describe('Ce que three fait de `decay = 0` et de `distance` — mesuré sur ses chunks', () => {
  const chunk = THREE.ShaderChunk.lights_pars_begin.replace(/\s+/g, ' ');

  it('sans décroissance, la contribution est CONSTANTE… et coupée exactement à la portée', () => {
    // `1 / max(pow(d, 0), 0.01)` = 1 partout : aucune atténuation physique (la mécanique du jeu dégrade
    // linéairement, pas en 1/d² — `state/vision.ts`).
    expect(chunk).toContain('float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );');
    // …puis la fenêtre de coupure, qui vaut 0 dès `d = cutoffDistance` : rien au-delà du rayon RAW.
    expect(chunk).toContain('distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );');
    const coupure = (d: number, D: number) => Math.pow(Math.min(1, Math.max(0, 1 - Math.pow(d / D, 4))), 2);
    expect(coupure(8, 8)).toBe(0); // au rayon : éteint
    expect(coupure(7.99, 8)).toBeGreaterThan(0); // juste avant : encore quelque chose
    expect(coupure(9, 8)).toBe(0); // au-delà : rien
  });

  it('l’intensité écrite se relit en part d’albédo par la MÊME définition que `flaquePart`', () => {
    // Chaîne mesurée : `uniforms.color = light.color × light.intensity` (WebGLLights, aucun autre
    // facteur d'échelle), puis `irradiance = dotNL × lightColor` et `BRDF_Lambert = albédo / π`.
    const D = 8, ext = 0.5;
    const w = pointLightWrites([source({ radiusTiles: 4 })], { scene: avecBraseros(0), mpt: 2, ambianceLum: 1 - ext })[0]!;
    const parLeShader = (dM: number) => {
      const L = Math.hypot(dM, FLAME_LIFT_M);
      const coupure = Math.pow(Math.min(1, Math.max(0, 1 - Math.pow(L / D, 4))), 2);
      return (w.intensity / Math.PI) * (FLAME_LIFT_M / L) * coupure;
    };
    for (const d of [0, 1, 3, 6]) expect(parLeShader(d)).toBeCloseTo(flaquePart(d, D, ext), 12);
  });
});

// ── 3. PROFIL & SATURATION ──────────────────────────────────────────────────────────────────────

describe('Le PROFIL d’une flaque — épinglé, et calé sous la saturation', () => {
  const AMB_NUIT = ambianceLuminance(0.18);
  const D = 8; // brasero : 4 cases × 2 m

  it('l’intensité est CALÉE : le foyer d’une flaque culmine à la cible de nuit, jamais à 1', () => {
    expect(FLAME_INTENSITY).toBeCloseTo(0.7769, 4);
    expect(flaqueLuminance(AMB_NUIT, 0, D)).toBeCloseTo(FOYER_NUIT_CIBLE, 3);
    expect(flaqueLuminance(AMB_NUIT, 0, D)).toBeLessThan(1);
  });

  it('profil au sol de nuit (part d’albédo AJOUTÉE), mètre par mètre', () => {
    const ext = extinctionDe(AMB_NUIT);
    const profil = [0, 1, 2, 4, 6, 7.9, 8, 9].map((d) => +flaquePart(d, D, ext).toFixed(4));
    expect(profil).toEqual([0.5221, 0.3687, 0.2308, 0.1095, 0.0381, 0, 0, 0]);
  });

  /**
   * PROFIL D'UNE SOURCE ANCRÉE À SA PRIMITIVE (#1680 ligne 5) — l'âtre (`cheminee-interieure`, rayon 5
   * cases = 10 m) est la seule source VOLUMIQUE du catalogue : sa lampe descend de la hauteur
   * forfaitaire des billboards (1 m) au centre de son lit de braises (0,24 m, `PropPrimitive.emet`).
   *
   * Ce que cela CHANGE, mesuré : le PIC au foyer ne bouge pas (`dotNL` vaut 1 à l'aplomb, quelle que
   * soit la hauteur — c'est pourquoi `FOYER_NUIT_CIBLE` tient sans retoucher aucune constante), mais le
   * cœur clair se RESSERRE — sa demi-largeur à mi-hauteur passe de 1,725 m à 0,416 m. C'est la
   * géométrie : une flamme basse rase le sol, et le cosinus d'incidence tombe d'autant plus vite
   * qu'elle est près de lui. Aucune constante n'est retouchée ; ce test épingle la conséquence.
   */
  it('l’âtre ANCRÉ : même pic au foyer, cœur clair RESSERRÉ (profil épinglé)', () => {
    const ext = extinctionDe(AMB_NUIT);
    const D_ATRE = 10; // cheminée : 5 cases × 2 m
    const H_BRAISES = 0.24; // centre de la primitive « braises » de la recette
    const pts = [0, 0.5, 1, 2, 3, 4, 6, 8];
    expect(pts.map((d) => +flaquePart(d, D_ATRE, ext, FLAME_LIFT_M).toFixed(4)))
      .toEqual([0.5223, 0.4671, 0.3691, 0.2325, 0.1619, 0.1195, 0.064, 0.0216]);
    expect(pts.map((d) => +flaquePart(d, D_ATRE, ext, H_BRAISES).toFixed(4)))
      .toEqual([0.5224, 0.2261, 0.1219, 0.062, 0.041, 0.0297, 0.0158, 0.0054]);
    // Le PIC est le même à 1/10 000 près : la cible de nuit ne dépend pas de la hauteur du foyer.
    expect(flaquePart(0, D_ATRE, ext, H_BRAISES)).toBeCloseTo(flaquePart(0, D_ATRE, ext, FLAME_LIFT_M), 3);
    // DEMI-LARGEUR du cœur clair (rayon où la part retombe à la moitié du pic), mesurée au pas du mm.
    const demiLargeur = (liftM: number) => {
      const pic = flaquePart(0, D_ATRE, ext, liftM);
      for (let d = 0; d <= D_ATRE; d += 0.001) if (flaquePart(d, D_ATRE, ext, liftM) < pic / 2) return +d.toFixed(3);
      return D_ATRE;
    };
    expect(demiLargeur(FLAME_LIFT_M)).toBeCloseTo(1.725, 2);
    expect(demiLargeur(H_BRAISES)).toBeCloseTo(0.416, 2);
  });

  it('AUCUN palier ne sature : le foyer d’UNE flaque reste sous 1 aux cinq paliers de `lightLevels.json`', () => {
    const mesuré = lightLevels.map((l) => [l.id, +flaqueLuminance(ambianceLuminance(l.scalar), 0, D).toFixed(4)]);
    expect(mesuré).toEqual([['jour', 1], ['couvert', 0.9542], ['crepuscule', 0.8992], ['nuit', 0.8497], ['tenebres', 0.8168]]);
  });

  it('SCÈNES LIVRÉES : la luminance du sol ne dépasse 1 à aucune heure, recouvrements compris', () => {
    let pire = 0;
    let où = '';
    let recouvrements = 0;
    for (const scene of areneCampaign.scenes) {
      const src = mapLights(scene);
      if (!src.length) continue;
      const mpt = sceneMetresPerTile(scene);
      for (let h = 0; h < 24; h++) {
        const amb = ambianceLuminance(ambientScalar(scene, h * 60, null));
        const ext = extinctionDe(amb);
        if (ext === 0) continue; // plein jour : aucune flaque n'est allumée, le sol est à l'ambiance seule
        // Échantillonnage du sol au demi-mètre, dans l'emprise des flaques (ailleurs, rien n'est ajouté).
        for (const s of src) {
          const R = s.radiusTiles * mpt;
          for (let dy = -R; dy <= R; dy += 0.5)
            for (let dx = -R; dx <= R; dx += 0.5) {
              const xM = s.pos.x * mpt + dx;
              const yM = s.pos.y * mpt + dy;
              if (xM < 0 || yM < 0 || xM > scene.dimensions.w * mpt || yM > scene.dimensions.h * mpt) continue;
              let tot = amb;
              let n = 0;
              for (const o of src) {
                const p = flaquePart(Math.hypot(xM - o.pos.x * mpt, yM - o.pos.y * mpt), o.radiusTiles * mpt, ext);
                tot += p;
                if (p > 0) n++;
              }
              if (n > 1) recouvrements++;
              if (tot > pire) { pire = tot; où = `${scene.id} h${h} (${xM},${yM})`; }
            }
        }
      }
    }
    // Des flaques SE RECOUVRENT bel et bien dans les scènes livrées (deux braséros à deux cases) : c'est
    // la SOMME qui doit tenir, pas leur séparation.
    expect(recouvrements).toBeGreaterThan(0);
    // Point le plus clair des scènes livrées. Il a MIGRÉ le 2026-09-02 (#1680 ligne 5) : la zone 4
    // (0,9592, l'aplomb d'un brasero dans la flaque de son voisin) cède la place à la zone 12
    // (0,9694) — le recalage des rayons sur les étalons du canon (chandelier 3 → 5 cases, lampadaire
    // 5 → 10) et les cinq émetteurs neufs y font se recouvrir des flaques qui ne se touchaient pas.
    // L'INVARIANT, lui, ne bouge pas et reste celui qui compte : la somme tient sous 1.
    expect([où, +pire.toFixed(4)]).toEqual(['arene-zone12 h0 (28,32)', 0.9694]);
    expect(pire).toBeLessThan(1);
  });
});

// ── 4. MONTAGE RÉEL ─────────────────────────────────────────────────────────────────────────────

let root: Root | null = null;
let hôte: HTMLDivElement | null = null;

brancherArdoise();

function démonter(): void {
  if (root) { act(() => root!.unmount()); root = null; }
  if (hôte) { hôte.remove(); hôte = null; }
}

afterEach(() => {
  démonter();
});

/** Monte l'écran de JEU (store → `MondeDeCampagne` → voie volumique) sur `scene` à l'heure `gameTime`. */
function canevas(scene: Scene, gameTime: number): HTMLCanvasElement {
  useGame.setState({
    scene, mode: 'exploration', partyPos: { x: 5, y: 5 }, party: [], battle: null, dialogue: null,
    flags: {}, gameTime, lightLevel: null,
  });
  hôte = document.createElement('div');
  document.body.appendChild(hôte);
  root = createRoot(hôte);
  act(() => root!.render(<MondeDeCampagne />));
  return hôte.querySelector('canvas.iso-stage') as HTMLCanvasElement;
}

describe('L’écran de jeu — les flaques de la scène, allumées par la nuit seule', () => {
  // jsdom n'a aucun contexte WebGL, et depuis que la voie volumique est le défaut (#1176, P3-4) un
  // contexte refusé REBASCULE l'écran en affine : sans banc, ce bloc mesurerait le repli.
  beforeAll(() => setStageRendererFactory(() => new BancRenderer()));
  afterAll(() => setStageRendererFactory(null));
  it('DEUX braséros de nuit : deux flaques allumées sur le budget monté', () => {
    expect(canevas(avecBraseros(2), NUIT).dataset.lampes).toBe(`2/${POINT_LIGHT_BUDGET}`);
  });

  it('les MÊMES braséros à midi : aucune flaque allumée (le budget, lui, ne bouge pas)', () => {
    expect(canevas(avecBraseros(2), MIDI).dataset.lampes).toBe(`0/${POINT_LIGHT_BUDGET}`);
  });

  it('une scène SANS source n’allume rien, de nuit comme de jour', () => {
    expect(canevas(avecBraseros(0), NUIT).dataset.lampes).toBe(`0/${POINT_LIGHT_BUDGET}`);
  });

  it('les sources montées sont celles du champ MÉCANIQUE (même liste, mêmes rayons)', () => {
    const scene = avecBraseros(3);
    const sources = sceneLightSources({ scene, battle: null, party: [], partyPos: { x: 5, y: 5 } });
    expect(sources.map((s) => s.srcId)).toEqual(['b0', 'b1', 'b2']);
    expect(canevas(scene, NUIT).dataset.lampes).toBe(`3/${POINT_LIGHT_BUDGET}`);
  });
});

const TAILLE = { w: 800, h: 600 };
const dimsDe = (scene: Scene): Dims => ({ w: scene.dimensions.w, h: scene.dimensions.h, rot: 0, view: 'iso' });
const props = (scene: Scene, gameTime: number) => ({
  scene,
  mpt: sceneMetresPerTile(scene),
  frame: { mode: 'plateau', dims: dimsDe(scene), cam: { x: 0, y: 0 }, zoom: 1 } as const,
  tintAt: () => 1,
  keepEl: () => true,
  els: { tokens: [], props: [] },
  actors: [],
  gameTime,
  lightLevel: null,
  lights: sceneLightSources({ scene, battle: null, party: [], partyPos: { x: 5, y: 5 } }),
});

describe('Le pool MONTÉ — un compte que rien ne fait varier (la clé de cache de three)', () => {
  beforeAll(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => TAILLE.w });
    Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => TAILLE.h });
    setStageRendererFactory(() => new BancRenderer());
  });
  afterAll(() => setStageRendererFactory(null));

  /** Les lampes ponctuelles de la DERNIÈRE frame dessinée. */
  function lampesDeLaFrame(): THREE.PointLight[] {
    const scene = scènes[scènes.length - 1];
    const out: THREE.PointLight[] = [];
    scene.traverse((o) => { if ((o as THREE.PointLight).isPointLight) out.push(o as THREE.PointLight); });
    return out;
  }

  function monter(scene: Scene, gameTime: number): void {
    viderCaptures();
    hôte = document.createElement('div');
    document.body.appendChild(hôte);
    root = createRoot(hôte);
    act(() => root!.render(<GameStage3D {...props(scene, gameTime)} />));
  }

  it('même compte de lampes de nuit et à midi, avec ou sans source — et toutes VISIBLES', () => {
    for (const [scene, t] of [[avecBraseros(2), NUIT], [avecBraseros(2), MIDI], [avecBraseros(0), NUIT]] as const) {
      monter(scene, t);
      const lampes = lampesDeLaFrame();
      expect(lampes.length).toBe(POINT_LIGHT_BUDGET);
      expect(lampes.every((l) => l.visible)).toBe(true);
      expect(lampes.every((l) => l.decay === 0 && !l.castShadow)).toBe(true);
      démonter();
    }
  });

  it('de nuit, DEUX lampes sont allumées, posées sur la case de leur brasero et coupées à son rayon', () => {
    const scene = avecBraseros(2);
    const mpt = sceneMetresPerTile(scene);
    monter(scene, NUIT);
    const allumées = lampesDeLaFrame().filter((l) => l.intensity > 0);
    expect(allumées.length).toBe(2);
    expect(allumées.map((l) => [l.position.x, l.position.z]).sort()).toEqual([[1 * mpt, 2 * mpt], [2 * mpt, 2 * mpt]].sort());
    expect(allumées.every((l) => l.distance === 4 * mpt)).toBe(true); // brasero : 4 cases (props.json)
  });

  it('…et à midi, les mêmes lampes sont là, toutes à intensité NULLE', () => {
    monter(avecBraseros(2), MIDI);
    const lampes = lampesDeLaFrame();
    expect(lampes.length).toBe(POINT_LIGHT_BUDGET);
    expect(lampes.filter((l) => l.intensity > 0).length).toBe(0);
  });
});

describe('Le pool ÉCRIT — une passe par changement de lumière ; par frame, la seule flamme qui bat', () => {
  /** Compte TOUTE écriture d'intensité sur une lampe ponctuelle, construction comprise. */
  let écritures = 0;
  beforeAll(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => TAILLE.w });
    Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => TAILLE.h });
    setStageRendererFactory(() => new BancRenderer());
    Object.defineProperty(THREE.PointLight.prototype, 'intensity', {
      configurable: true,
      get(this: { __i?: number }) { return this.__i ?? 0; },
      set(this: { __i?: number }, v: number) { écritures++; this.__i = v; },
    });
  });
  afterAll(() => {
    setStageRendererFactory(null);
    delete (THREE.PointLight.prototype as unknown as Record<string, unknown>).intensity;
  });

  it('sources STABLES : la caméra n’écrit RIEN, l’heure écrit UNE passe, la même heure rien', () => {
    // Lampadaires (ton `lanterne`, aucun vacillement) : le régime où l'intensité ne dépend QUE de
    // l'heure et du palier — celui d'avant #1245 L4, invariant compris.
    const scene = avecLampadaires(2);
    const p = props(scene, NUIT);
    viderCaptures();
    hôte = document.createElement('div');
    document.body.appendChild(hôte);
    root = createRoot(hôte);

    écritures = 0;
    act(() => root!.render(<GameStage3D {...p} />));
    // 12 constructions de lampe (le pool) + 12 écritures de la première passe.
    expect(écritures).toBe(2 * POINT_LIGHT_BUDGET);

    // Rendus de CAMÉRA : ni la translation ni le zoom ne touchent la lumière.
    écritures = 0;
    act(() => root!.render(<GameStage3D {...p} frame={{ ...p.frame, cam: { x: 40, y: 12 }, zoom: 1.5 }} />));
    act(() => root!.render(<GameStage3D {...p} frame={{ ...p.frame, cam: { x: 80, y: 24 }, zoom: 2 }} />));
    expect(écritures).toBe(0);

    // Changement d'HEURE : une seule passe sur le pool (12 lampes), jamais un remontage.
    écritures = 0;
    act(() => root!.render(<GameStage3D {...p} gameTime={MIDI} />));
    expect(écritures).toBe(POINT_LIGHT_BUDGET);

    // La MÊME heure re-rendue : rien à réécrire.
    écritures = 0;
    act(() => root!.render(<GameStage3D {...p} gameTime={MIDI} />));
    expect(écritures).toBe(0);
  });

  it('sources qui VACILLENT (#1245 L4) : UNE écriture par flamme et par frame, et rien de plus', () => {
    // C'est le coût ASSUMÉ de la flamme : son intensité EST fonction de l'instant. Ce qui reste
    // invariant, c'est qu'elle n'écrit QUE l'intensité, et QUE sur les lampes qui vacillent — la
    // 3ᵉ lampe du décor, stable, ne se réécrit pas parce que ses voisines battent.
    const scene = avecBraseros(2);          // brasero : ton par défaut `flamme`, donc vacillant
    scene.entities = [
      ...scene.entities,
      { id: 'l0', kind: 'prop', pos: { x: 6, y: 6 }, ref: 'lampadaire' },
    ] as unknown as Scene['entities'];
    const p = props(scene, NUIT);
    viderCaptures();
    hôte = document.createElement('div');
    document.body.appendChild(hôte);
    root = createRoot(hôte);
    act(() => root!.render(<GameStage3D {...p} />));

    // Deux frames de CAMÉRA : 2 flammes × 2 frames. Le lampadaire n'est pas du lot.
    écritures = 0;
    act(() => root!.render(<GameStage3D {...p} frame={{ ...p.frame, cam: { x: 40, y: 12 }, zoom: 1.5 }} />));
    act(() => root!.render(<GameStage3D {...p} frame={{ ...p.frame, cam: { x: 80, y: 24 }, zoom: 2 }} />));
    expect(écritures).toBe(2 * 2);

    // À MIDI les flaques s'éteignent : plus une seule flamme allumée, donc plus une écriture de frame
    // (et la boucle de vacillement, elle non plus, ne bat pas).
    act(() => root!.render(<GameStage3D {...p} gameTime={MIDI} />));
    écritures = 0;
    act(() => root!.render(<GameStage3D {...p} gameTime={MIDI} frame={{ ...p.frame, cam: { x: 12, y: 3 } }} />));
    expect(écritures).toBe(0);
  });

  it('le slot d’une source SURVIT au changement d’heure (la table se relit, elle ne se rebat pas)', () => {
    const scene = avecBraseros(3);
    const p = props(scene, NUIT);
    viderCaptures();
    hôte = document.createElement('div');
    document.body.appendChild(hôte);
    root = createRoot(hôte);
    act(() => root!.render(<GameStage3D {...p} />));
    const posesDeNuit = () => {
      const s = scènes[scènes.length - 1];
      const out: [number, number][] = [];
      s.traverse((o) => { if ((o as THREE.PointLight).isPointLight) out.push([(o as THREE.PointLight).position.x, (o as THREE.PointLight).position.z]); });
      return out;
    };
    const avant = posesDeNuit();
    act(() => root!.render(<GameStage3D {...p} gameTime={MIDI} />));
    expect(posesDeNuit()).toEqual(avant); // chaque lampe est restée sur SA case, seule l'intensité est tombée
  });
});

// ── 5. LE PERSONNAGE DANS LA FLAQUE (#1245, L2/L3) ──────────────────────────────────────────────

/** Combattant porteur d'une lanterne, RANGÉE ou en main — le gate de port est celui du champ mécanique. */
const porteurDeLanterne = (equipped: boolean) => ({
  id: 'h1', kind: 'hero', pos: { x: 4, y: 4 },
  items: [{ uid: 'i1', trappingId: 'lanterne', equipped }],
});

describe('La lampe d’un PORTEUR — celle du champ mécanique, gate de port compris (#1245 L2)', () => {
  it('une lanterne EN MAIN allume une lampe nommée par son porteur ; RANGÉE, elle n’allume rien', () => {
    const scene = avecBraseros(0);
    const opts = { scene, mpt: sceneMetresPerTile(scene), ambianceLum: ambianceLuminance(0.18) };
    const lampes = (equipped: boolean) => {
      const sources = sceneLightSources({
        scene,
        battle: { combatants: [porteurDeLanterne(equipped)] } as never,
        party: [],
        partyPos: { x: 0, y: 0 },
      });
      return pointLightWrites(sources, opts).filter((w) => w && w.intensity > 0);
    };
    expect(lampes(true).map((w) => [w!.srcId, w!.x, w!.z])).toEqual([['h1', 4 * opts.mpt, 4 * opts.mpt]]);
    expect(lampes(false)).toEqual([]);
  });
});

describe('billboardExposure — le personnage raconte la MÊME flaque que sa case (#1245 L3)', () => {
  const AMB_NUIT = ambianceLuminance(0.18);
  const scene = avecBraseros(1); // un brasero (rayon 4 cases) en (1,2)
  const mpt = sceneMetresPerTile(scene);
  const D = 4 * mpt;

  /** Le pool MONTÉ sur les sources de `scene` au palier `ambianceLum` — la chaîne réelle, pas un forgé. */
  function poolDe(ambianceLum: number): THREE.PointLight[] {
    const pool = createPointLightPool();
    applyPointLights(pool, pointLightWrites(mapLights(scene), { scene, mpt, ambianceLum }));
    return pool;
  }

  /** Ancre d'un billboard aux PIEDS, à `dCases` cases de l'aplomb du brasero. */
  const ancre = (dCases: number) => ({
    x: (1 + dCases) * mpt,
    y: heightAt(scene, 1 + dCases, 2, 0),
    z: 2 * mpt,
  });

  it('au FOYER, le billboard est strictement plus clair qu’à six cases (où la flaque ne porte plus)', () => {
    const pool = poolDe(AMB_NUIT);
    const foyer = billboardExposure(ancre(0), pool, AMB_NUIT);
    const loin = billboardExposure(ancre(6), pool, AMB_NUIT);
    expect(foyer).toBeGreaterThan(loin);
    expect([+foyer.toFixed(4), +loin.toFixed(4)]).toEqual([0.8497, 0.3276]);
  });

  it('le billboard et SA CASE racontent la même flaque : son exposition EST la luminance du sol', () => {
    const pool = poolDe(AMB_NUIT);
    for (const dCases of [0, 1, 2, 3.5]) {
      expect(billboardExposure(ancre(dCases), pool, AMB_NUIT)).toBeCloseTo(flaqueLuminance(AMB_NUIT, dCases * mpt, D), 12);
    }
  });

  it('AU-DESSUS de la flamme, le billboard reçoit ce que reçoit son propre sol : RIEN', () => {
    const pool = poolDe(AMB_NUIT);
    const aplomb = ancre(0);
    // Le sol d'un étage au-dessus d'une torche reste noir (`dotNL` ≤ 0) : le personnage qui s'y tient
    // ne peut pas briller. Un mètre au-dessus de la flamme suffit, cent mètres aussi.
    expect(billboardExposure({ ...aplomb, y: FLAME_LIFT_M + 1 }, pool, AMB_NUIT)).toBe(AMB_NUIT);
    expect(billboardExposure({ ...aplomb, y: 100 }, pool, AMB_NUIT)).toBe(AMB_NUIT);
    // …et l'aplomb au SOL, lui, reçoit bien le foyer : le chemin n'est pas éteint pour tout le monde.
    expect(billboardExposure(aplomb, pool, AMB_NUIT)).toBeGreaterThan(AMB_NUIT);
  });

  it('HORS de toute source, l’exposition est EXACTEMENT celle de la frame (non-régression à l’octet)', () => {
    const pool = poolDe(AMB_NUIT);
    // Au-delà du rayon RAW, et sur une scène sans la moindre source : le même nombre, bit pour bit.
    expect(billboardExposure(ancre(9), pool, AMB_NUIT)).toBe(AMB_NUIT);
    expect(billboardExposure(ancre(0), createPointLightPool(), 0.4217)).toBe(0.4217);
    // À MIDI, les lampes sont éteintes (intensité 0) : le foyer lui-même retrouve l’exposition nue.
    const jour = poolDe(ambianceLuminance(1));
    expect(billboardExposure(ancre(0), jour, 0.87)).toBe(0.87);
  });
});

// ── 6. LA LAMPE DU GROUPE EN EXPLORATION (#1245) ─────────────────────────────────────────────────

const CAMERA = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100);

/** Un billboard MONTÉ tel que la passe de pose le manipule (quad + matériau, aucune texture). */
function boardDe(cid: string, anchor: THREE.Vector3): Board {
  const material = new THREE.MeshBasicMaterial();
  const sub = {
    identity: `sonde:${cid}`, cid, kind: 'personnage', anchor, facing: 'S',
    scaleK: 1, cell: { x: 0, y: 0, z: 0 }, box: { w: 120, h: 150 }, svg: () => '',
  };
  return {
    sub: sub as unknown as Board['sub'],
    quad: { widthM: 2, heightM: 3, centerLiftM: 1.5 },
    mesh: new THREE.Mesh(new THREE.PlaneGeometry(2, 3), material),
    material,
  };
}

/** Héros de roster : ce que le meneur se choisit dessus (vivant, Blessures) et ce que le gate de port lit. */
const héros = (id: string, items: { uid: string; trappingId: string; equipped: boolean }[] = []) => ({
  id, kind: 'hero', dead: false, wounds: { current: 3, max: 3 }, conditions: [], traits: [], talents: [], items,
});

describe('La lampe du GROUPE en exploration — portée par le MENEUR (#1245)', () => {
  const scene = avecBraseros(0);
  const mpt = sceneMetresPerTile(scene);
  const AMB_NUIT = ambianceLuminance(0.18);
  const CASE = { x: 4, y: 4 };
  // La lanterne est au SECOND héros : l'agrégat reste UN (les émetteurs de tous les héros à la case du
  // groupe, jamais additionnés), et c'est le jeton qui MARCHE — le meneur — qui le porte.
  const party = [héros('h1'), héros('h2', [{ uid: 'i1', trappingId: 'lanterne', equipped: true }])];
  const sourcesDuGroupe = (): LightSource[] =>
    sceneLightSources({ scene, battle: null, party: party as never, partyPos: CASE });

  it('UNE seule source pour tout le groupe, PORTÉE, et nommée par le meneur', () => {
    const s = sourcesDuGroupe();
    expect(s.map((x) => [x.srcId, x.carried, x.pos])).toEqual([['h1', true, CASE]]);
    expect(s[0].radiusTiles).toBeGreaterThan(0);
  });

  it('nommer le porteur ne touche RIEN au champ mécanique : la vision est la même, case par case', () => {
    const amb = ambientScalar(scene, NUIT, null);
    const champ = (src: LightSource[]) => computeLightField(scene, amb, src, [], buildOpaque(scene));
    const avec = champ(sourcesDuGroupe());
    const sans = champ(sourcesDuGroupe().map(({ srcId: _porteur, ...reste }) => reste));
    for (let y = 0; y < scene.dimensions.h; y++)
      for (let x = 0; x < scene.dimensions.w; x++) expect([x, y, avec.at(x, y)]).toEqual([x, y, sans.at(x, y)]);
    expect([...avec.sourceLit!].sort()).toEqual([...sans.sourceLit!].sort());
  });

  it('le meneur qui MARCHE ne traverse plus sa propre flaque : son quad ne pulse pas du pas', () => {
    const pool = createPointLightPool();
    const slots = pointLightWrites(sourcesDuGroupe(), { scene, mpt, ambianceLum: AMB_NUIT });
    applyPointLights(pool, slots);
    const f = { pool, slots, surfaceLuminance: AMB_NUIT };
    const b = boardDe('h1', new THREE.Vector3(CASE.x * mpt, heightAt(scene, CASE.x, CASE.y, 0), CASE.y * mpt));
    const clartés: number[] = [];
    for (let i = 0; i <= 8; i++) {
      poseBoards([b], CAMERA, () => ({ dx: (i / 8) * mpt, dy: 0, dz: 0 }), f, AUCUN_CHROME, TEINTE_PLEINE);
      clartés.push(b.material.color.r);
    }
    expect(Math.max(...clartés) - Math.min(...clartés)).toBeLessThan(0.01);
    // …et la flaque du groupe éclaire bel et bien son porteur (sans quoi l'écart serait nul par vide).
    expect(clartés[0]).toBeGreaterThan(AMB_NUIT);
  });
});
