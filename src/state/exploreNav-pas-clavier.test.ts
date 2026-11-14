/**
 * LIAISON WEB du pas clavier d'exploration (#792) : `exploreStepDest` (noyau) sous la projection d'écran du curseur
 * (`screenStepDot`), sur le losange iso par défaut.
 */
import { describe, it, expect } from 'vitest';
import { emptyScene, isWalkable, type Scene } from '../noyau/monde/scene';
import { exploreStepDest } from '../noyau/monde/exploreNav';
import { screenStepDot, type ScreenDir } from './combatCursor';

describe('exploreStepDest — pas clavier, seuil d’alignement (#792 refuse le snap latéral/zigzag)', () => {
  // Mesuré empiriquement (losange iso par défaut, camRot=0) depuis le centre d'une scène plate ouverte :
  // le voisin IDÉAL de chaque cardinal (pas DIAGONAL de grille) colle à dot=1.0 ; le repêchage hors-axe
  // (pas SIMPLE-axe de grille) tombe soit à ~0.4472 (up/down — quasi perpendiculaire, ratio TW/TH 2:1),
  // soit à ~0.8944 (left/right — encore bien aligné). ALIGN_MIN=0.6 sépare exactement ces deux paliers.
  const IDEAL: Record<'haut' | 'bas' | 'gauche' | 'droite', { x: number; y: number }> = {
    haut: { x: 4, y: 4 },
    bas: { x: 6, y: 6 },
    gauche: { x: 4, y: 6 },
    droite: { x: 6, y: 4 },
  };
  const dims = { w: 10, h: 10 };
  const from = { x: 5, y: 5 };
  /** Le pas de `stepPartyDir` : la projection d'écran du curseur, sur le losange iso par défaut. */
  const pas = (sc: Scene, dir: ScreenDir) => exploreStepDest(sc, from, (voisin) => screenStepDot(sc, from, voisin, dir, dims));

  it('champ libre : chaque cardinal renvoie son voisin idéal (diagonal de grille, dot≈1.0)', () => {
    const sc = emptyScene('scene-test', 10, 10);
    for (const dir of ['haut', 'bas', 'gauche', 'droite'] as const) {
      expect(pas(sc, dir)).toEqual(IDEAL[dir]);
    }
  });

  it('8-connectivité en champ libre préservée : les 4 voisins idéaux (un par cardinal) restent tous atteignables après le seuil', () => {
    const sc = emptyScene('scene-test', 10, 10);
    const reached = (['haut', 'bas', 'gauche', 'droite'] as const).map((dir) => pas(sc, dir));
    expect(reached.every((d) => d !== null)).toBe(true);
    // 4 destinations distinctes (les 4 diagonales de grille autour du départ) — aucune collision.
    const keys = new Set(reached.map((d) => `${d!.x},${d!.y}`));
    expect(keys.size).toBe(4);
  });

  it('idéal bloqué (up), seuls des voisins hors-axe (~0.45, < ALIGN_MIN) ouverts → bloqué (null), pas de rabattement latéral', () => {
    const sc = emptyScene('scene-test', 10, 10);
    const idx = (x: number, y: number) => y * 10 + x;
    sc.layers[0].tiles[idx(4, 4)] = 'mur'; // voisin idéal de 'haut' (dot=1.0) : mur
    // Les hors-axe (0,-1)=(5,4) et (-1,0)=(4,5) restent marchables (dot≈0.4472 < 0.6) — SANS le seuil,
    // l'ancien code s'y rabattait silencieusement (le zigzag #792). Avec le seuil : bloqué.
    expect(isWalkable(sc, 5, 4)).toBe(true);
    expect(isWalkable(sc, 4, 5)).toBe(true);
    expect(pas(sc, 'haut')).toBeNull();
  });

  it('idéal bloqué (down), même garde symétrique', () => {
    const sc = emptyScene('scene-test', 10, 10);
    const idx = (x: number, y: number) => y * 10 + x;
    sc.layers[0].tiles[idx(6, 6)] = 'mur'; // voisin idéal de 'bas'
    expect(pas(sc, 'bas')).toBeNull();
  });

  it('idéal bloqué (left/right) : le voisin hors-axe reste bien ALIGNÉ (~0.89 ≥ ALIGN_MIN) et est accepté — pas un zigzag, un vrai second chemin', () => {
    const sc = emptyScene('scene-test', 10, 10);
    const idx = (x: number, y: number) => y * 10 + x;
    sc.layers[0].tiles[idx(4, 6)] = 'mur'; // voisin idéal de 'gauche' (4,6)
    const dest = pas(sc, 'gauche');
    expect(dest).not.toBeNull();
    expect(dest).not.toEqual({ x: 4, y: 6 });
  });
});
