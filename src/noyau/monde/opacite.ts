import { findPropById } from '../../data';
import { propFootTiles } from './footprint';
import type { Pt } from './path';
import { METRES_PER_LEVEL } from './relief';
import { heightAt, sceneMetresPerTile, tileAt, type Scene } from './scene';
import { memoByRef } from './sceneMemo';
import { terrainOpaque, terrainSolidHeightM } from './terrain';

/** Sommet des masses opaques de chaque colonne, lu en O(1) par la vision et le tir. */
export interface GrilleDesMasses {
  g: Uint8Array;
  topH: Float64Array;
  w: number;
  h: number;
}

export function caseDansGrille({ w, h }: Scene['dimensions'], x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < w && y < h;
}

export const grilleDesMasses = memoByRef((scene: Scene): GrilleDesMasses => {
  const { w, h } = scene.dimensions;
  const g = new Uint8Array(w * h);
  const topH = new Float64Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const terrain = tileAt(scene, x, y);
      if (!terrainOpaque(terrain)) continue;
      const i = y * w + x;
      g[i] = 1;
      topH[i] = heightAt(scene, x, y) + (terrainSolidHeightM(terrain) || METRES_PER_LEVEL);
    }
  }
  const mpt = sceneMetresPerTile(scene);
  for (const e of scene.entities) {
    if (e.kind !== 'prop' || !e.decor || !findPropById(e.decor.id)?.opaque) continue;
    for (const { x, y } of propFootTiles(e.decor.id, e.pos, e.facing, mpt)) {
      if (!caseDansGrille(scene.dimensions, x, y)) continue;
      const i = y * w + x;
      const sommet = heightAt(scene, x, y) + METRES_PER_LEVEL;
      topH[i] = g[i] ? Math.max(topH[i], sommet) : sommet;
      g[i] = 1;
    }
  }
  return { g, topH, w, h };
});

export function masseOcculte(grille: GrilleDesMasses, index: number, hauteur: number): boolean {
  return !!grille.g[index] && hauteur < grille.topH[index];
}

function caseAuDepart(coord: number, pas: number): number {
  const centre = Math.round(coord);
  return pas < 0 && coord === centre - 0.5 ? centre - 1 : centre;
}

/** Cherche une case dont le rayon traverse l'intérieur, extrémités exclues. */
export function rayonTraverse(
  grille: GrilleDesMasses,
  from: Pt,
  to: Pt,
  correspond: (x: number, y: number, index: number) => boolean,
): boolean {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return false;
  const pasX = Math.sign(dx), pasY = Math.sign(dy);
  const distX = Math.abs(dx), distY = Math.abs(dy);
  let x = caseAuDepart(from.x, pasX);
  let y = caseAuDepart(from.y, pasY);
  const finX = caseAuDepart(to.x, -pasX);
  const finY = caseAuDepart(to.y, -pasY);
  if ((pasX === 0 && from.x === x - 0.5) || (pasY === 0 && from.y === y - 0.5)) return false;
  while (x !== finX || y !== finY) {
    // Temps de franchissement mis au même dénominateur. Au coin, les deux axes avancent.
    const frontX = x === finX ? Infinity : Math.abs(x + pasX / 2 - from.x) * distY;
    const frontY = y === finY ? Infinity : Math.abs(y + pasY / 2 - from.y) * distX;
    if (frontX <= frontY) x += pasX;
    if (frontY <= frontX) y += pasY;
    if (x === finX && y === finY) return false;
    if (!caseDansGrille(grille, x, y)) continue;
    if (correspond(x, y, y * grille.w + x)) return true;
  }
  return false;
}
