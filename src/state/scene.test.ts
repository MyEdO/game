import { describe, it, expect } from 'vitest';
import { emptyScene, isWalkable, tileAt, heightAt, surfaceLink, layerTiles, normalizeAmbiance, isIndoor } from './scene';
import { evalCondition } from './flow';
import type { Scene, Terrain } from './scene';

describe('evalCondition flag — conditions de flag (triggers + dialogues, source unique)', () => {
  const ok = (expr: string, flags: Record<string, boolean>) => evalCondition({ kind: 'flag', expr }, { flags, gameTime: 0 });
  it('flag simple + négation', () => {
    expect(ok('a', { a: true })).toBe(true);
    expect(ok('a', {})).toBe(false);
    expect(ok('!a', {})).toBe(true);
    expect(ok('!a', { a: true })).toBe(false);
  });
  it('flags composés = ET (« v1,!v2 »), pour enchaîner des étapes (ex. vagues d’arène)', () => {
    expect(ok('v1,!v2', { v1: true })).toBe(true); // v1 fait, v2 pas encore
    expect(ok('v1,!v2', { v1: true, v2: true })).toBe(false); // v2 fait → masqué
    expect(ok('v1,!v2', {})).toBe(false); // v1 pas encore
    expect(ok(' v1 , !v2 ', { v1: true })).toBe(true); // tolère les espaces
  });
});

describe('scene + terrain registre', () => {
  it('isWalkable suit le registre terrain', () => {
    const s = emptyScene(3, 3); // rempli d'herbe
    s.layers[0].tiles[0] = 'pave';
    s.layers[0].tiles[1] = 'eau';
    expect(isWalkable(s, 0, 0)).toBe(true); // pave
    expect(isWalkable(s, 1, 0)).toBe(false); // eau
  });
  it('hors-grille → mur (bloqué)', () => {
    const s = emptyScene(3, 3);
    expect(tileAt(s, -1, 0)).toBe('mur');
    expect(isWalkable(s, -1, 0)).toBe(false);
  });
  it('layerTiles rend la grille de la couche z (repli 1ʳᵉ couche si z absent)', () => {
    const s = emptyScene(2, 1);
    s.layers.push({ z: 1, tiles: ['plancher', 'vide'] as Terrain[] });
    expect(layerTiles(s, 1)[0]).toBe('plancher');
    expect(layerTiles(s, 9)[0]).toBe('herbe'); // couche inexistante → repli 1ʳᵉ couche (comme tileAt)
    expect(tileAt(s, 1, 0, 1)).toBe('vide');
    expect(isWalkable(s, 0, 0, 1)).toBe(true); // plancher marchable à l'étage
    expect(isWalkable(s, 1, 0, 1)).toBe(false); // « vide » d'étage : rien à fouler
  });
});

describe('relief — heightAt (hauteur métrique par case, ex-élévation)', () => {
  it('heightAt = 0 par défaut (pas de tableau height)', () => {
    const s = emptyScene(3, 3);
    expect(heightAt(s, 1, 1)).toBe(0);
  });
  it('heightAt lit Layer.height[y*w+x] (surélévation + contrebas, en MÈTRES)', () => {
    const s = emptyScene(3, 3);
    s.layers[0].height = new Array(9).fill(0);
    s.layers[0].height![1 * 3 + 1] = 4; // muret / surface surélevée à 4 m
    s.layers[0].height![2 * 3 + 0] = -1.5; // fosse à −1,5 m
    expect(heightAt(s, 1, 1)).toBe(4);
    expect(heightAt(s, 0, 2)).toBe(-1.5);
    expect(heightAt(s, 0, 0)).toBe(0);
  });
  it('heightAt hors-grille → 0 (pas de débordement)', () => {
    const s = emptyScene(3, 3);
    s.layers[0].height = new Array(9).fill(3);
    expect(heightAt(s, -1, 0)).toBe(0);
    expect(heightAt(s, 3, 0)).toBe(0);
  });
  it('heightAt respecte la couche z (couche manquante → repli 1ʳᵉ couche, comme tileAt)', () => {
    const s = emptyScene(3, 3);
    s.layers[0].height = new Array(9).fill(2);
    expect(heightAt(s, 1, 1, 0)).toBe(2);
    expect(heightAt(s, 1, 1, 5)).toBe(2); // repli 1ʳᵉ couche
  });
});

describe('surfaceLink — auto-connexion des surfaces voisines (flat/ramp/cliff)', () => {
  it('classe le lien 4-voisin selon |Δhauteur| vs STEP_MAX (1 m) ; drop = hauteur de b − a', () => {
    const s = emptyScene(4, 1);
    s.layers[0].height = [0, 1, 2.5, 2.5];
    expect(surfaceLink(s, { x: 2, y: 0 }, { x: 3, y: 0 })).toEqual({ grade: 'flat', drop: 0 }); // 2,5 → 2,5
    expect(surfaceLink(s, { x: 0, y: 0 }, { x: 1, y: 0 })).toEqual({ grade: 'ramp', drop: 1 }); // 0 → 1 (= STEP_MAX)
    expect(surfaceLink(s, { x: 1, y: 0 }, { x: 2, y: 0 })).toEqual({ grade: 'cliff', drop: 1.5 }); // 1 → 2,5
    expect(surfaceLink(s, { x: 0, y: 0 }, { x: 2, y: 0 })).toBeNull(); // non 4-adjacentes
  });
});

describe('ambiance — intérieur vs extérieur (jour/nuit vient de l’horloge, #T1c)', () => {
  it('normalizeAmbiance : interieur conservé ; exterieur/undefined → exterieur', () => {
    expect(normalizeAmbiance('interieur')).toBe('interieur');
    expect(normalizeAmbiance('exterieur')).toBe('exterieur');
    expect(normalizeAmbiance(undefined)).toBe('exterieur');
  });
  it('isIndoor', () => {
    expect(isIndoor({ ambiance: 'interieur' } as Scene)).toBe(true);
    expect(isIndoor({ ambiance: 'exterieur' } as Scene)).toBe(false);
    expect(isIndoor({ ambiance: undefined } as Scene)).toBe(false);
  });
});
