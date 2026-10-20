// @vitest-environment jsdom
/**
 * TONS DE LUMIÈRE (#1245, L4) — l'APPARENCE d'une source ponctuelle en DONNÉE. Cinq étages :
 *
 *  1. le CATALOGUE (`src/data/lightTones.json`) : ses bornes tiennent au schéma, ses ids sont uniques,
 *     et tout `tone` authoré dans la donnée livrée s'y résout — un ton fantôme est un bug de donnée ;
 *  2. le CRITÈRE N+1 : un ton FORGÉ, poussé dans le catalogue par la MÊME couture que l'éditeur
 *     (mutation en place, `data/overrides.ts`), change couleur / intensité / vacillement de la flaque
 *     SANS une ligne de code — c'est tout l'objet de ce lot ;
 *  3. le VACILLEMENT : déterministe (même graine → même série, aucun `Math.random`) et BORNÉ par le
 *     haut au calage anti-saturation — une flamme ne dépasse jamais ce que la marge de `FLAME_INTENSITY`
 *     autorise, sans quoi elle écrêterait en aplat blanc exactement ce que ce calage protège ;
 *  4. l'INSTANT PARTAGÉ : la lampe montée et le billboard qu'elle éclaire racontent la MÊME intensité
 *     de frame — un seul calcul, celui que three va rendre, jamais deux qui dérivent ;
 *  5. la NON-RÉGRESSION : une source SANS ton est exactement la source d'avant ce lot (place, portée,
 *     intensité de repos à l'octet), au vacillement neuf près — l'écart assumé et mesuré ici.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { emptyScene, sceneMetresPerTile, heightAt, type Scene } from '../../noyau/monde/scene';
import { mapLights, type LightSource } from '../../noyau/monde/vision';
import { combatantLights } from '../../noyau/monde/vision';
import { lightTones, props as propsData, trappings, type LightToneDef } from '../../data';
import { setDataset } from '../../data/overrides';
import { schema as lightTonesSchema } from '../../data/schemas/defs/lightTones';
import { ambianceLuminance } from '../catalog/ambiance';
import { AUCUN_CHROME, TEINTE_PLEINE, poseBoards, type Board } from './boardPose';
import {
  applyFlicker,
  applyPointLights,
  billboardExposure,
  createPointLightPool,
  flickerFactor,
  hasFlicker,
  pointLightWrites,
  resolveTone,
  toneHex,
  FLAME_INTENSITY,
} from './stagePointLights';

const scène = (): Scene => {
  const s = emptyScene(10, 10);
  s.ambiance = 'exterieur';
  return s;
};
const SCÈNE = scène();
const MPT = sceneMetresPerTile(SCÈNE);
const AMB_NUIT = ambianceLuminance(0.18);
const OPTS = { scene: SCÈNE, mpt: MPT, ambianceLum: AMB_NUIT };
const source = (over: Partial<LightSource> = {}): LightSource => ({ pos: { x: 3, y: 4 }, radiusTiles: 4, srcId: 's1', ...over });

/** Le ton `flamme` tel que la donnée le livre — le défaut auquel toute source muette retombe. */
const FLAMME = lightTones.find((t) => t.id === 'flamme')!;

// ── 1. LE CATALOGUE ─────────────────────────────────────────────────────────────────────────────

describe('lightTones.json — le catalogue livré, et les bornes qui le tiennent', () => {
  it('le catalogue livré VALIDE son schéma, ses ids sont uniques, et `flamme` (le défaut) y est', () => {
    expect(lightTonesSchema.safeParse(lightTones).success).toBe(true);
    expect(new Set(lightTones.map((t) => t.id)).size).toBe(lightTones.length);
    expect(lightTones.map((t) => t.id)).toContain('flamme');
  });

  it('zod REFUSE chaque borne violée — couleur, intensité, amplitude, fréquence', () => {
    const base = { id: 'x', type: 'lightTones', label: 'X', color: '#ffffff', intensity: 1 };
    const refusé = (entrée: unknown) => lightTonesSchema.safeParse([entrée]).success;
    expect(refusé(base)).toBe(true);
    expect(refusé({ ...base, color: 'orange' })).toBe(false);       // ni nom CSS…
    expect(refusé({ ...base, color: '#FFF' })).toBe(false);         // …ni forme courte…
    expect(refusé({ ...base, color: '#FFAA33' })).toBe(false);      // …ni majuscules
    expect(refusé({ ...base, intensity: 0 })).toBe(false);          // 0 = une lampe éteinte, pas un ton
    expect(refusé({ ...base, intensity: 1.2 })).toBe(false);        // > 1 = au-dessus du calage anti-saturation
    expect(refusé({ ...base, flicker: { amplitude: 0.6, hz: 2 } })).toBe(false);
    expect(refusé({ ...base, flicker: { amplitude: 0.2, hz: 0 } })).toBe(false);
    expect(refusé({ ...base, flicker: { amplitude: 0.2, hz: 9 } })).toBe(false);
    expect(refusé({ ...base, flicker: { amplitude: 0.2, hz: 2 } })).toBe(true);
    expect(refusé({ ...base, teinte: '#fff' })).toBe(false);        // strictObject : aucun champ en trop
  });

  it('tout `tone` AUTHORÉ dans la donnée livrée se résout — un ton fantôme est un bug de donnée', () => {
    const ids = new Set(lightTones.map((t) => t.id));
    const authorés: [string, string][] = [];
    for (const p of propsData) if (p.light?.tone) authorés.push([`props/${p.id}`, p.light.tone]);
    for (const t of trappings)
      for (const op of t.passive ?? []) if (op.op === 'light' && op.tone) authorés.push([`trappings/${t.id}`, op.tone]);
    expect(authorés.length).toBeGreaterThan(0); // sinon ce garde ne mesure rien
    expect(authorés.filter(([, tone]) => !ids.has(tone))).toEqual([]);
  });

  it('un ton HORS catalogue retombe sur `flamme` et se SIGNALE — jamais un repli muet', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveTone('ton-qui-nexiste-pas').id).toBe('flamme');
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});

// ── 2. LE CRITÈRE N+1 : un ton forgé, zéro ligne de code ────────────────────────────────────────

describe('Un ton FORGÉ change l’apparence de la flaque SANS une ligne de code (#1245 L4)', () => {
  /** Pousse un ton dans le catalogue LIVE par le SEAM d'écriture (`setDataset`, `data/overrides.ts`) —
   *  la seule porte : elle mute le tableau en place ET versionne l'édition. */
  function forger(ton: LightToneDef): void {
    setDataset('lightTones', [...lightTones, ton]);
  }
  const TONS_LIVRES = [...lightTones];
  afterEach(() => {
    setDataset('lightTones', TONS_LIVRES);
  });

  it('couleur, part d’intensité et vacillement de la lampe écrite viennent TOUS du ton', () => {
    forger({ id: 'feu-verdatre', type: 'lightTones', label: 'Feu verdâtre', color: '#3ad18c', intensity: 0.5, flicker: { amplitude: 0.4, hz: 7 } });
    const w = pointLightWrites([source({ tone: 'feu-verdatre' })], OPTS)[0]!;
    expect(w.color).toBe(0x3ad18c);
    expect(w.flicker).toEqual({ amplitude: 0.4, hz: 7 });
    // L'intensité du ton MODULE le calage, elle ne le remplace pas : moitié de ce qu'une flamme donne.
    const flamme = pointLightWrites([source()], OPTS)[0]!;
    expect(w.intensity).toBeCloseTo(flamme.intensity * (0.5 / FLAMME.intensity), 12);
  });

  it('…et la lampe MONTÉE porte cette couleur : la chaîne va jusqu’à three', () => {
    forger({ id: 'braise-pourpre', type: 'lightTones', label: 'Braise pourpre', color: '#a03cff', intensity: 1 });
    const pool = createPointLightPool();
    applyPointLights(pool, pointLightWrites([source({ tone: 'braise-pourpre' })], OPTS));
    expect(pool[0].color.getHexString()).toBe(new THREE.Color(0xa03cff).getHexString());
  });

  it('un ton SANS `flicker` fige la lampe : la lanterne du catalogue ne bat pas d’un cran', () => {
    const lanterne = pointLightWrites([source({ tone: 'lanterne' })], OPTS);
    expect(lanterne[0]!.flicker).toBeUndefined();
    expect(hasFlicker(lanterne)).toBe(false);
    const pool = createPointLightPool();
    applyPointLights(pool, lanterne);
    const repos = pool[0].intensity;
    for (const t of [0, 0.13, 1.7, 42]) {
      applyFlicker(pool, lanterne, t);
      expect(pool[0].intensity).toBe(repos);
    }
  });

  it('la LANTERNE est plus PÂLE que le FEU — le reproche de recette, tranché en donnée', () => {
    const feu = pointLightWrites([source()], OPTS)[0]!;
    const lanterne = pointLightWrites([source({ tone: 'lanterne' })], OPTS)[0]!;
    expect(lanterne.intensity).toBeLessThan(feu.intensity);       // moins forte…
    expect(lanterne.color).not.toBe(feu.color);                   // …et d'une autre couleur
    // Saturation : la lanterne tire vers le blanc, le feu vers l'orange (écart rouge↔bleu).
    const écart = (hex: number) => ((hex >> 16) & 0xff) - (hex & 0xff);
    expect(écart(lanterne.color)).toBeLessThan(écart(feu.color));
  });
});

// ── 3. LE VACILLEMENT : déterministe et borné ───────────────────────────────────────────────────

describe('flickerFactor — déterministe, borné, et propre à chaque source', () => {
  const FL = { amplitude: 0.4, hz: 3 };

  it('même graine + même instant → MÊME valeur, à l’octet, autant de fois qu’on demande', () => {
    const série = (n: number) => Array.from({ length: n }, (_, i) => flickerFactor('b0', i / 60, FL));
    expect(série(120)).toEqual(série(120));
  });

  it('deux sources DIFFÉRENTES ne battent pas ensemble (la graine est l’id)', () => {
    const à = Array.from({ length: 60 }, (_, i) => flickerFactor('b0', i / 60, FL));
    const b = Array.from({ length: 60 }, (_, i) => flickerFactor('b1', i / 60, FL));
    expect(à).not.toEqual(b);
  });

  it('BORNÉ dans [1 − amplitude, 1] : jamais au-dessus du calage anti-saturation', () => {
    for (const amplitude of [0.05, 0.14, 0.32, 0.5]) {
      const f = { amplitude, hz: 8 };
      let min = Infinity;
      let max = -Infinity;
      for (const id of ['b0', 'b1', 'brasero-arene-4', 'h1']) {
        for (let i = 0; i < 4000; i++) {
          const v = flickerFactor(id, i / 200, f);
          min = Math.min(min, v);
          max = Math.max(max, v);
        }
      }
      expect(max).toBeLessThanOrEqual(1);
      expect(min).toBeGreaterThanOrEqual(1 - amplitude);
      expect(max).toBeGreaterThan(min); // …et ça bouge vraiment
    }
  });

  it('sans `flicker` (ou à amplitude nulle), le facteur vaut exactement 1', () => {
    expect(flickerFactor('b0', 3.14, undefined)).toBe(1);
    expect(flickerFactor('b0', 3.14, { amplitude: 0, hz: 4 })).toBe(1);
  });

  it('la flamme du catalogue BOUGE réellement dans une seconde de jeu, et jamais au-dessus du repos', () => {
    const pool = createPointLightPool();
    const slots = pointLightWrites([source()], OPTS); // ton absent = flamme
    applyPointLights(pool, slots);
    const repos = pool[0].intensity;
    const vus: number[] = [];
    for (let i = 0; i < 60; i++) {
      applyFlicker(pool, slots, i / 60);
      vus.push(pool[0].intensity);
    }
    expect(Math.max(...vus)).toBeLessThanOrEqual(repos);
    expect(Math.max(...vus) - Math.min(...vus)).toBeGreaterThan(0.01);
    expect(hasFlicker(slots)).toBe(true);
  });

  it('une lampe ÉTEINTE le reste : de jour, le vacillement n’allume rien', () => {
    const jour = pointLightWrites([source()], { ...OPTS, ambianceLum: ambianceLuminance(1) });
    expect(hasFlicker(jour)).toBe(false); // pas de boucle de rendu permanente en plein jour
    const pool = createPointLightPool();
    applyPointLights(pool, jour);
    applyFlicker(pool, jour, 0.37);
    expect(pool[0].intensity).toBe(0);
  });
});

// ── 4. L'INSTANT PARTAGÉ : une seule vérité de l'intensité de la frame ──────────────────────────

const CAMERA = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100);

/** Un billboard monté tel que la passe de pose le manipule (quad + matériau, aucune texture). */
function boardDe(anchor: THREE.Vector3): Board {
  const material = new THREE.MeshBasicMaterial();
  const sub = {
    identity: 'sonde', cid: undefined, kind: 'personnage', anchor, facing: 'S',
    scaleK: 1, cell: { x: 0, y: 0, z: 0 }, box: { w: 120, h: 150 }, svg: () => '',
  };
  return {
    sub: sub as unknown as Board['sub'],
    quad: { widthM: 2, heightM: 3, centerLiftM: 1.5 },
    mesh: new THREE.Mesh(new THREE.PlaneGeometry(2, 3), material),
    material,
  };
}

describe('Le billboard et la lampe partagent l’intensité de l’INSTANT (#1245 L4)', () => {
  const CASE = { x: 3, y: 4 };
  const slots = pointLightWrites([source({ pos: CASE })], OPTS);

  it('l’exposition d’un quad SUIT le vacillement de la lampe, sans second calcul', () => {
    const pool = createPointLightPool();
    applyPointLights(pool, slots);
    const b = boardDe(new THREE.Vector3(CASE.x * MPT, heightAt(SCÈNE, CASE.x, CASE.y, 0), CASE.y * MPT));
    const paires: [number, number][] = [];
    for (let i = 0; i < 40; i++) {
      applyFlicker(pool, slots, i / 40);
      poseBoards([b], CAMERA, () => null, { pool, slots, surfaceLuminance: AMB_NUIT }, AUCUN_CHROME, TEINTE_PLEINE);
      paires.push([pool[0].intensity, b.material.color.r]);
    }
    // La clarté du quad bouge — donc elle suit bien la flamme…
    const clartés = paires.map(([, c]) => c);
    expect(Math.max(...clartés) - Math.min(...clartés)).toBeGreaterThan(0.01);
    // …et c'est bien LA lampe de l'instant qu'elle relit — monotone : plus la lampe est forte à cet
    // instant, plus le quad est clair. Deux calculs qui dériveraient casseraient cet ordre.
    const triées = [...paires].sort((a, b2) => a[0] - b2[0]);
    for (let i = 1; i < triées.length; i++) expect(triées[i][1]).toBeGreaterThanOrEqual(triées[i - 1][1] - 1e-12);
  });

  it('la valeur du quad est EXACTEMENT `billboardExposure` du pool de l’instant (pas une approximation)', () => {
    const pool = createPointLightPool();
    applyPointLights(pool, slots);
    const ancre = new THREE.Vector3(CASE.x * MPT, heightAt(SCÈNE, CASE.x, CASE.y, 0), CASE.y * MPT);
    const b = boardDe(ancre);
    for (const t of [0, 0.21, 0.63]) {
      applyFlicker(pool, slots, t);
      poseBoards([b], CAMERA, () => null, { pool, slots, surfaceLuminance: AMB_NUIT }, AUCUN_CHROME, TEINTE_PLEINE);
      expect(b.material.color.r).toBeCloseTo(billboardExposure(ancre, pool, AMB_NUIT), 12);
    }
  });
});

// ── 5. NON-RÉGRESSION : sans ton, c'est la source d'avant le lot ────────────────────────────────

describe('Absence de `tone` = `flamme`, et le reste ne bouge pas d’un octet (#1245 L4)', () => {
  it('place, portée et intensité de REPOS sont celles d’avant le lot (`flamme.intensity` = 1)', () => {
    expect(FLAMME.intensity).toBe(1);
    const w = pointLightWrites([source()], OPTS)[0]!;
    // La formule d'AVANT ce lot, recopiée telle quelle : le ton n'y ajoute qu'un facteur 1.
    const avant = FLAME_INTENSITY * Math.PI * (1 - AMB_NUIT);
    expect(w.intensity).toBe(avant);
    expect([w.x, w.z, w.distance]).toEqual([3 * MPT, 4 * MPT, 4 * MPT]);
    // ÉCART ASSUMÉ (le seul) : la lampe naît désormais ORANGE et VACILLANTE au lieu de blanche et fixe.
    expect(w.color).toBe(toneHex(FLAMME));
    expect(w.flicker).toEqual(FLAMME.flicker);
  });

  it('le TON d’un prop s’hérite du type, et une instance peut le surcharger champ par champ', () => {
    const s = { ...SCÈNE, entities: [
      { id: 'p0', kind: 'prop', pos: { x: 1, y: 1 }, ref: 'chandelier' },
      { id: 'p1', kind: 'prop', pos: { x: 2, y: 1 }, ref: 'chandelier', light: { radiusM: 18 } },
      { id: 'p2', kind: 'prop', pos: { x: 3, y: 1 }, ref: 'chandelier', light: { radiusM: 6, tone: 'magique' } },
      { id: 'p3', kind: 'prop', pos: { x: 4, y: 1 }, ref: 'brasero' },
    ] } as unknown as Scene;
    // Les rayons de la DONNÉE sont en MÈTRES (#1507) ; `mapLights` les rend en CASES, à l'échelle de
    // la scène — 10 m d'étalon de bougie font 5 cases à 2 m/case.
    expect(mapLights(s).map((l) => [l.srcId, l.radiusTiles, l.tone])).toEqual([
      ['p0', 5, 'chandelle'],            // hérité du type (rayon recalé sur l’étalon de la bougie, #1680 ligne 5)
      ['p1', 9, 'chandelle'],            // rayon surchargé (18 m), TON conservé
      ['p2', 3, 'magique'],              // ton surchargé
      ['p3', 4, undefined],              // le brasero reste MUET : son défaut EST `flamme`
    ]);
    expect(resolveTone(mapLights(s)[3].tone).id).toBe('flamme');
  });

  it('le ton d’un PORTEUR suit l’émetteur RETENU (le plus grand rayon), pas le dernier vu', () => {
    // Bougie (10 m, `chandelle`) ET lanterne (20 m, `lanterne`) en main : c'est la lanterne
    // qui fait la source — donc c'est SON apparence que le porteur émet.
    const l = combatantLights({
      id: 'h1',
      pos: { x: 2, y: 2 },
      items: [
        { uid: 'i1', trappingId: 'bougie', equipped: true },
        { uid: 'i2', trappingId: 'lanterne', equipped: true },
      ],
    }, MPT);
    expect(l.map((x) => [x.radiusTiles, x.tone])).toEqual([[10, 'lanterne']]);
  });

  it('un SORT porte son ton jusqu’à la lampe (`ActiveEffect.light`, chemin de l’op)', () => {
    const l = combatantLights({ id: 'h1', pos: { x: 2, y: 2 }, activeEffects: [{ light: { radiusM: 20, tone: 'magique' } }] }, MPT);
    expect(l[0].tone).toBe('magique');
    const ton = resolveTone(l[0].tone);
    expect(ton.flicker).toBeUndefined();        // une lueur magique ne vacille pas
    expect(toneHex(ton) & 0xff).toBeGreaterThan((toneHex(ton) >> 16) & 0xff); // …et tire vers le bleu
  });
});
