/**
 * PEINTRE SVG D'AUTHORING des sols (frontière du module : `authoring/project.ts`) — iso losange ·
 * edge-on · vue du dessus : dessine un élément `floor`
 * du pivot en SVG, en projetant sa géométrie GRILLE+MÈTRES via la projection partagée (`tileCenter`/
 * `diamondCorners`/`metricToLift`). La ROTATION caméra vit ENTIÈREMENT ici (le builder n'en sait rien) ;
 * l'ÉCLAIRAGE d'une paroi (face avant/arrière) est une vérité d'ÉCRAN → déduit ici de l'arête projetée.
 * Les couleurs viennent des matériaux JSON (`reliefMaterial`/`terrainGradient`) et de `shade.ts`.
 * MATÉRIAUX v2 : le fill de sol prend sa VARIANTE de teinte par tuile, une falaise porteuse d'une recette
 * reçoit le motif d'appareillage partagé (LOD ≥ 1) ; les ACCENTS seedés (touffes, cailloux, blocs) sont
 * La couche d'ACCENTS seedés est morte avec ses consommateurs (#1176 P3-4 C5b) : l'aperçu d'authoring
 * peint le sol, pas son semis — le semis vit dans le monde volumique (`backends/webgl/groundAccents`).
 */
import { Dims, depth, diamondCorners, tileCenter } from '../../geometry/iso';
import { metricToLift } from '../../noyau/monde/relief';
import { terrainGradient } from '../catalog/terrain';
import { reliefMaterial } from '../catalog/relief';
import { shade, ao, warm, spec } from '../shade';
import { projGP, type Pt2 } from './project';
import {
  detailOf,
  terrainFillGradient,
  terrainCoursesPattern,
  coursesOverlaySvg,
  type DetailOpts,
} from './detailSvg';
import type { CellSide, Face, FloorEl } from '../builders/types';

/** Pied de rampe = nez de pente × ce facteur (ombrage doux du haut vers le bas). */
const SLOPE_BOT = 0.67;
/** Largeur ÉCRAN (px) d'un PILIER de support sous un tablier (montant vertical fin). */
const PILLAR_W = 5;

/** Profondeur de tri d'un sol : sa case (base ≫ z, cf. iso.ts) + offset de couche −0.5 → juste SOUS
 *  les objets de SA case (prop +0, jeton +0.5) tout en s'interclassant avec les voisins par sa vraie
 *  position écran (un sol haut surplombe localement le bas sans recouvrir la cour devant). */
export function floorDepth(el: FloorEl, dims: Dims): number {
  return depth(el.cell.x, el.cell.y, dims, el.cell.z) - 0.5;
}

const polyPts = (pts: Pt2[]) => pts.map((p) => `${p[0]},${p[1]}`).join(' ');
const lerpP = (a: Pt2, b: Pt2, t: number): Pt2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** Un MONTANT vertical fin (PILLAR_W) du haut (dessous de dalle) au bas (surface inférieure). */
function pillarSvg(f: Face, dims: Dims): string {
  const [top, bot] = f.poly.map((p) => projGP(p, dims));
  const w = PILLAR_W / 2;
  const pts = `${top[0] - w},${top[1]} ${top[0] + w},${top[1]} ${bot[0] + w},${bot[1]} ${bot[0] - w},${bot[1]}`;
  return (
    `<polygon class="overhang-pillar" points="${pts}" fill="${reliefMaterial(f.material.id).face}" stroke="${ao(0.38)}" stroke-width="0.6"/>` +
    `<line x1="${top[0] - w}" y1="${top[1]}" x2="${bot[0] - w}" y2="${bot[1]}" stroke="${spec(0.12)}" stroke-width="0.8"/>`
  );
}

// Contrat DATA (`materials.json`, domaine `relief`) : une matière affectée à une FALAISE/tablier définit `foot`+`shadeDark`,
// à une RAMPE `slopeTop`. Ces champs sont optionnels au TYPE (ils dépendent du RÔLE de la face — porté par
// `material.part`, pas par la def) → les `!` ci-dessous sont garantis par ce contrat, pas par le compilateur.
/** Fill d'une FALAISE : face claire si son arête HAUTE est devant (plus bas à l'écran) que le centre de
 *  la case — suit la rotation caméra. PARTAGÉ par le rendu de la paroi ET la couche d'accents (mêmes tons). */
function cliffFill(f: Face, el: FloorEl, dims: Dims): { fill: string; lit: boolean } {
  const [tl, tr] = f.poly.map((p) => projGP(p, dims));
  const m = reliefMaterial(f.material.id);
  const ctr = tileCenter(el.cell.x, el.cell.y, dims, metricToLift(f.poly[0].h));
  const lit = (tl[1] + tr[1]) / 2 >= ctr.cy;
  return { fill: lit ? m.face : shade(m.face, m.shadeDark!), lit };
}

/** Paroi de relief (falaise/rampe/tablier) : quad projeté [haut-gauche, haut-droit, bas-droit,
 *  bas-gauche]. Une FALAISE porteuse d'une recette (`reliefMaterial.detail`) reçoit le motif
 *  d'appareillage de son orientation (LOD ≥ 1) entre sa face et son ombre de pied. */
function reliefFaceSvg(f: Face, el: FloorEl, dims: Dims, opts?: DetailOpts): string {
  const [tl, tr, br, bl] = f.poly.map((p) => projGP(p, dims));
  const m = reliefMaterial(f.material.id);
  if (f.material.part === 'ramp') {
    // RAMPE (dénivelé ≤ STEP_MAX_M) : plan incliné LISSE — ombrage doux dégradé du haut (nez éclairé)
    // vers le bas (pied dans l'ombre), SANS marches discrètes → une pente franchissable à pied (≠ mur).
    const top = m.slopeTop!;
    const bot = shade(m.slopeTop!, SLOPE_BOT);
    const ml = lerpP(tl, bl, 0.5), mr = lerpP(tr, br, 0.5); // mi-pente (couture des deux bandes)
    return (
      `<polygon points="${polyPts([tl, tr, mr, ml])}" fill="${top}" stroke="${ao(0.16)}" stroke-width="0.4"/>` +
      `<polygon points="${polyPts([ml, mr, br, bl])}" fill="${bot}" stroke="${ao(0.16)}" stroke-width="0.4"/>` +
      `<line x1="${tl[0]}" y1="${tl[1]}" x2="${tr[0]}" y2="${tr[1]}" stroke="${warm(0.28)}" stroke-width="1.1"/>`
    );
  }
  const { fill, lit } = cliffFill(f, el, dims);
  if (f.material.part === 'deck') {
    // DALLE FINE : bord d'un TABLIER de surplomb donnant sur le vide — ≠ falaise (pleine hauteur).
    return (
      `<polygon class="overhang-deck" points="${polyPts([tl, tr, br, bl])}" fill="${fill}" stroke="${ao(0.32)}" stroke-width="0.6"/>` +
      `<line x1="${tl[0]}" y1="${tl[1]}" x2="${tr[0]}" y2="${tr[1]}" stroke="${warm(0.22)}" stroke-width="1"/>`
    );
  }
  // FALAISE : paroi VERTICALE — face (claire si avant, sombre si arrière) + motif d'appareillage (recette)
  // + ombre au pied + arête vive.
  const { lod, mpt } = detailOf(opts);
  let overlay = '';
  if (lod >= 1 && m.detail?.courses && f.side)
    overlay = coursesOverlaySvg({ recipe: m.detail, side: f.side, cell: el.cell, quad: [tl, tr, br, bl], dims, mpt });
  const foot = lit ? m.foot! : shade(m.foot!, m.shadeDark!);
  const fl = lerpP(tl, bl, 0.6), fr = lerpP(tr, br, 0.6); // bord haut de l'ombre de pied
  return (
    `<polygon class="elev-cliff" points="${polyPts([tl, tr, br, bl])}" fill="${fill}" stroke="${ao(0.3)}" stroke-width="0.6"/>` +
    overlay +
    `<polygon points="${polyPts([fl, fr, br, bl])}" fill="${foot}" opacity="0.85"/>` +
    (lit ? `<line x1="${tl[0]}" y1="${tl[1]}" x2="${tr[0]}" y2="${tr[1]}" stroke="${warm(0.22)}" stroke-width="1.1"/>` : '')
  );
}

/** Losange de base. Coins recomputés par `diamondCorners` (ordre ÉCRAN top→right→bot→left, invariant
 *  par rotation — le poly GRILLE tournerait son point de départ avec la caméra) : parité flottante
 *  exacte avec la projection historique ; les backends non-affines projettent `poly` directement.
 *  LOD ≥ 1 : le dégradé prend sa VARIANTE de teinte par tuile (recette `tintVar`) — même coût — et un
 *  terrain APPAREILLÉ (recette `courses` : pavés/dalles/lattes) pose PAR-DESSUS le motif de joints
 *  CONTINU du plan du sol (+1 nœud par tuile, les pierres coulent d'une tuile à l'autre). */
function groundFaceSvg(f: Face, el: FloorEl, dims: Dims, opts?: DetailOpts): string {
  const { top, right, bot, left } = diamondCorners(el.cell.x, el.cell.y, dims, metricToLift(f.poly[0].h));
  const { lod, mpt } = detailOf(opts);
  const grad = terrainFillGradient(f.material.id, el.cell, lod) ?? terrainGradient(f.material.id);
  const d = `M${top[0]},${top[1]} L${right[0]},${right[1]} L${bot[0]},${bot[1]} L${left[0]},${left[1]} Z`;
  let svg = `<path d="${d}" fill="url(#${grad})" stroke="${ao(0.16)}"/>`;
  if (lod >= 1) {
    const pat = terrainCoursesPattern(f.material.id, dims, mpt);
    if (pat) svg += `<path d="${d}" fill="url(#${pat})"/>`;
  }
  return svg;
}

const SCREEN_EDGE_IDX: Record<CellSide, number> = { N: 0, E: 1, S: 2, O: 3 };

/** Wedge de raccord de terrain. Le voisin est repéré en GRILLE (`side`), mais `diamondCorners` garde la
 *  tuile orientée-ÉCRAN (la rotation ne bouge que le centre) → on décale de `rot` crans (arêtes en ordre
 *  horaire depuis le haut-droit) pour que l'arête écran portant le wedge SUIVE la rotation caméra. */
function wedgeSvg(f: Face, el: FloorEl, dims: Dims): string {
  const { cx, cy, top, right, bot, left } = diamondCorners(el.cell.x, el.cell.y, dims, metricToLift(f.poly[0].h));
  const SCREEN_EDGES: Pt2[][] = [[top, right], [right, bot], [bot, left], [left, top]];
  const rot = dims.rot ?? 0;
  const [a, b] = SCREEN_EDGES[(SCREEN_EDGE_IDX[f.side!] - rot + 4) % 4];
  const ia = [a[0] + (cx - a[0]) * 0.4, a[1] + (cy - a[1]) * 0.4];
  const ib = [b[0] + (cx - b[0]) * 0.4, b[1] + (cy - b[1]) * 0.4];
  const d = `M${a[0]},${a[1]} L${b[0]},${b[1]} L${ib[0]},${ib[1]} L${ia[0]},${ia[1]} Z`;
  return `<path d="${d}" fill="url(#${terrainGradient(f.material.id)})" opacity="0.7"/>`;
}

/** SVG d'un élément de sol : faces dessinées DANS L'ORDRE du builder (piliers → parois → base → wedges). */
export function floorSvg(el: FloorEl, dims: Dims, opts?: DetailOpts): string {
  let svg = '';
  for (const f of el.faces) {
    if (f.material.domain === 'relief') svg += f.material.part === 'pilier' ? pillarSvg(f, dims) : reliefFaceSvg(f, el, dims, opts);
    else svg += f.material.part === 'wedge' ? wedgeSvg(f, el, dims) : groundFaceSvg(f, el, dims, opts);
  }
  return svg;
}
