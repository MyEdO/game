import { describe, expect, it } from 'vitest';
import { SLOT_OPACITY, TILE_INSET_K, buildHighlightMesh } from './highlightMeshes';
import { WALK_TINT } from '../../highlightTints';

/**
 * GRILLE LISIBLE SOUS UNE PLAQUE DE ZONE (#1176, correctif du juge vision du 2026-08-13) — la
 * doctrine de la vue tactique demande que le joueur COMPTE SES CASES dans sa portée (arbitrage du
 * 2026-08-12) ; le juge a mesuré l'inverse sur les captures co-registrées : dans une zone de Marche,
 * 4 coutures de case par 190 px en affine, ZÉRO en volumique.
 *
 * Ce que cette garde mesure : la COMPOSITION d'une rangée de cases surlignées, telle que la
 * géométrie RÉELLEMENT MONTÉE la produit, jugée au détecteur de coutures du juge (une vallée de
 * luminance de flancs égaux, creusée d'au moins `SEUIL_CREUX`). Les deux voies y sont composées
 * selon leur nature :
 *  - EN SVG : un `<path>` par case, donc N composites SUCCESSIFS — au
 *    pixel de frontière, deux couvertures partielles se suivent et l'alpha résultant tombe sous
 *    l'alpha du plein ;
 *  - VOLUMIQUE : un `InstancedMesh` de quads DISJOINTS, donc UN composite par pixel à la couverture
 *    de l'instance qui le recouvre.
 *
 * CE QU'ELLE NE MESURE PAS (angle mort déclaré) : le sol est ici une CONSTANTE. Les coutures que
 * porte le sol lui-même (appareillage, bords de tuile cuits) sont hors sujet — la garde isole ce que
 * la PLAQUE fait ou défait. Et elle juge une rangée de cases sur un axe de grille : la couture qu'un
 * lacet de caméra rend oblique n'est pas dans son cadre.
 */

/** Pas de case ÉCRAN retenu : le pas mesuré par le juge sur ses captures (45–52 px). */
const PAS_PX = 48;
/** Rangée surlignée mesurée. */
const CASES = 8;
/** Luminance du SOL, telle que le juge l'a mesurée sur la scène volumique (l'affine, elle,
 *  s'assombrit avec la scène : 24). */
const SOL = 73;
/** Creux minimal d'une couture — le seuil du juge. */
const SEUIL_CREUX = 1.5;
/** PHASE de la grille dans la trame de pixels : une frontière de case tombe au MILIEU d'un pixel.
 *  C'est le cas le plus favorable à l'affine — sa couture n'existe QUE parce qu'un pixel se partage
 *  entre deux chemins, et le partage est maximal (0,5 / 0,5) là. Sur une frontière alignée sur la
 *  trame, l'affine n'en produit aucune : la garde se pose donc sur son meilleur témoin. */
const PHASE_PX = 0.5;

const rvb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const lum = ([r, g, b]: [number, number, number]) => (r + g + b) / 3;

/** Coutures d'un profil : vallée (de largeur quelconque) dont les deux flancs dépassent le fond d'au
 *  moins `SEUIL_CREUX`, et dont les flancs sont ÉGAUX (leur écart reste sous le creux). La forme
 *  3-taps du juge en est le cas de largeur 1 ; un liseré de 2 px et plus a un fond PLAT, qu'elle
 *  raterait. */
export function coutures(L: readonly number[], seuil = SEUIL_CREUX): { x: number; creux: number }[] {
  const out: { x: number; creux: number }[] = [];
  let x = 1;
  while (x < L.length - 1) {
    let fin = x;
    while (fin + 1 < L.length - 1 && L[fin + 1] === L[x]) fin++;
    const g = L[x - 1];
    const d = L[fin + 1];
    const creux = Math.min(g, d) - L[x];
    if (creux >= seuil && Math.abs(g - d) <= creux) out.push({ x: (x + fin) / 2, creux });
    x = fin + 1;
  }
  return out;
}

/** Recouvrement du pixel `[x, x+1)` par le segment `[a, b)`. */
const couverture = (x: number, a: number, b: number) => Math.max(0, Math.min(x + 1, b) - Math.max(x, a));

/** Un composite alpha : `alpha` pondéré par la couverture du pixel. */
const composer = (fond: number, teinte: number, alpha: number, cov: number) => fond + alpha * cov * (teinte - fond);

/** Demi-côté du quad monté d'un slot, en fraction de case — lu sur la GÉOMÉTRIE, jamais redéclaré. */
function demiCote(slot: 'deplacement'): number {
  const p = buildHighlightMesh(slot, 1).geometry.getAttribute('position');
  let m = 0;
  for (let i = 0; i < p.count; i++) m = Math.max(m, Math.abs(p.getX(i)), Math.abs(p.getZ(i)));
  return m;
}

/** Profil de luminance d'une rangée de `CASES` cases surlignées, voie par voie. */
function profil(voie: 'affine' | 'volumique'): number[] {
  const teinte = lum(rvb(WALK_TINT));
  const alpha = SLOT_OPACITY.deplacement;
  const h = voie === 'volumique' ? demiCote('deplacement') : 0.5;
  const L: number[] = [];
  for (let x = 0; x < CASES * PAS_PX; x++) {
    // VOLUMIQUE : les instances d'un pool sont DISJOINTES — un échantillon du pixel appartient à une
    // seule d'entre elles et n'est mélangé QU'UNE fois. Les couvertures s'additionnent donc avant
    // l'unique composite. AFFINE : chaque `<path>` est composité à son tour sur ce que le précédent a
    // laissé, et deux couvertures partielles ne rendent pas l'alpha du plein.
    let couvertureTotale = 0;
    let v = SOL;
    for (let c = 0; c < CASES; c++) {
      const centre = (c + 0.5) * PAS_PX + PHASE_PX;
      const cov = couverture(x, centre - h * PAS_PX, centre + h * PAS_PX);
      if (cov <= 0) continue;
      if (voie === 'volumique') couvertureTotale += cov;
      else v = composer(v, teinte, alpha, cov);
    }
    L.push(voie === 'volumique' ? composer(SOL, teinte, alpha, Math.min(1, couvertureTotale)) : v);
  }
  return L;
}

const médiane = (t: number[]) => (t.length ? [...t].sort((a, b) => a - b)[Math.floor(t.length / 2)] : 0);

describe('Marques de case — la GRILLE reste comptable DANS la zone surlignée', () => {
  const affine = coutures(profil('affine'));
  const volumique = coutures(profil('volumique'));

  it('le témoin AFFINE porte bien une couture par frontière de case (sinon la garde ne pèse rien)', () => {
    // 8 cases jointives : 7 frontières intérieures, plus les 2 bords de la rangée.
    expect(affine.length).toBeGreaterThanOrEqual(CASES - 1);
  });

  it('à état égal, la voie VOLUMIQUE ne montre pas moins de coutures que l’affine', () => {
    expect(volumique.length).toBeGreaterThanOrEqual(affine.length - 1);
  });

  it('et elle les creuse PLUS FORT : le liseré de sol pèse un ordre de grandeur de plus', () => {
    expect(médiane(volumique.map((c) => c.creux))).toBeGreaterThan(médiane(affine.map((c) => c.creux)));
  });

  it('chaque couture tombe sur une FRONTIÈRE de case, jamais au milieu d’une plaque', () => {
    for (const c of volumique) {
      const u = c.x % PAS_PX;
      expect(Math.min(u, PAS_PX - u), `couture à ${c.x} px, hors frontière`).toBeLessThanOrEqual(1 + TILE_INSET_K * PAS_PX);
    }
  });
});
