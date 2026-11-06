/**
 * QC — MOBILIER VOLUMIQUE : ce que les recettes de `props.json` produisent réellement comme
 * géométrie monde (`buildPropVolumes`), vue aux quatre crans de caméra plus une vue de dessus.
 * La sixième colonne montre la VIGNETTE de palette (`propSvg`) — l'art de l'éditeur, jamais le corps
 * monde : les deux sont côte à côte pour juger l'écart d'un coup d'œil.
 *
 * INSTRUMENT DÉRIVÉ DE LA CUISSON (#1680 ligne 17) : cet œil ne tient AUCUNE loi propre, sinon il
 * montre un décor que le jeu ne rend pas et l'auteur corrige d'après une image fausse. Il emprunte :
 *  - la PROJECTION de production — cadence SOL par `projectStep`/`stepOf` (`geometry/iso.ts`), cadence
 *    HAUTEUR par la caméra affine (`affineScales`, `backends/webgl/cameras.ts`) ; l'égalité des deux
 *    axes avec `affineScales` est mesurée au 1e-9 par le contrat ;
 *  - le CRAN de caméra (`rotYaw` + `rotOffset` : quart de tour ENTIER, aucun résidu de trigonométrie) ;
 *  - le DEHORS d'une face (`worldTris.ts:orienterPoly`), d'où son cull ;
 *  - la TEINTE (`faceColors.ts:faceSurface`) et le MODELÉ DE FORME (`shadeFamily`/`shadeFactorOf`),
 *    ceux-là mêmes que la cuisson cuit au sommet.
 * Seul le TRI DU PEINTRE lui appartient : au jeu, c'est le tampon de profondeur du GPU qui tranche,
 * il n'y a donc rien à emprunter — cette planche trie sur la profondeur vers l'œil, et cette mesure-là
 * ne vaut que pour elle.
 *
 *   CLI : scripts/qc/render-props-volumiques.mts → public/props-volumiques.html
 *   Contrats : `src/gameIso/catalog/planche-qc-cuisson.test.ts` (loi d'orientation, projection,
 *   cliquet des littéraux) et `planche-qc-cap-identite.test.ts` (cap peint).
 */
import { buildPropVolumes } from '../../../src/noyau/monde/volume/propVolumes';
import { orienterPoly, shadeFamily, type Vec3 } from '../../../src/noyau/monde/volume/worldTris';
import { faceSurface, shadeFactorOf } from '../../../src/gameIso/backends/webgl/faceColors';
import { affineScales, rotYaw } from '../../../src/gameIso/backends/webgl/cameras';
import { projectStep, rotOffset, stepOf, type ProjKind, type Rot } from '../../../src/geometry/iso';
import { propSvg } from '../../../src/gameIso/catalog/decor';
import { findPropById, props } from '../../../src/data';
import { defsGlobaux } from '../../../src/gameIso/sprites';
import type { Face, GP } from '../../../src/noyau/monde/volume/types';
import { CAP_IDENTITE_PROP } from '../../../src/data/props.types';

/** DÉRIVÉE du catalogue : une recette de plus entre en planche par sa seule déclaration en donnée —
 *  une liste manuscrite laisserait les suivantes hors QC en silence. */
export const RECETTES = props.filter((p) => p.volume).map((p) => p.id);

/** Les deux familles de projection que la planche montre — l'edge-on est le losange tourné de 45°, il
 *  ne dirait rien de plus qu'un cran de caméra. */
export type VuePlanche = Extract<ProjKind, 'iso' | 'top'>;

/** Échelle du monde que la planche PROJETTE (m/case, celle de La Diligence) : la cadence de la caméra
 *  (`affineScales`) et le pas de sol, qui se compte en CASES (`projectStep`), en dépendent tous deux.
 *  Ce n'est pas une unité d'authoring — depuis #1507 une recette est écrite en MÈTRES. */
export const ECHELLE_PROJETEE = 2;

/** La planche n'a pas de scène : elle cuit les recettes dans un monde d'UNE case par mètre, d'où des
 *  faces déjà MÉTRIQUES. Plus aucune conversion de recette ne vit donc ici — la seule qui reste est
 *  celle de la PROJECTION (`ECHELLE_PROJETEE`), et elle appartient à la caméra, pas à la donnée. */
const CASE_METRIQUE = 1;

/** Point de la planche : mètres à l'est (x), au sud (y), en hauteur (h). */
export interface Pt3 { x: number; y: number; h: number }

/** Repère de la planche → repère three (X = est, Y = haut, Z = sud), et retour. */
const versThree = (p: Pt3): Vec3 => ({ x: p.x, y: p.h, z: p.y });
const versPlanche = (v: Vec3): Pt3 => ({ x: v.x, y: v.z, h: v.y });

/** Sommet du monde de la planche (déjà métrique sur les trois axes, cf. `CASE_METRIQUE`), tourné du
 *  cran de caméra `rot`. */
export function enMetres(p: GP, rot: Rot): Pt3 {
  const t = rotOffset(rotYaw(rot), { x: p.x, y: p.y });
  return { x: t.x, y: t.y, h: p.h };
}

/** Projection ÉCRAN (px) d'un point métrique. La cadence SOL est celle de l'affine de production
 *  (`projectStep`/`stepOf`, en TUILES), la cadence HAUTEUR celle de la caméra (`sy·cos(pitch)`) : ce
 *  sont les deux cadences INDÉPENDANTES dont `affineScales` est faite, jamais un pitch uniforme. La
 *  vue du dessus regarde à la verticale — son pitch droit y annule la hauteur, sans branchement. */
export function projeterPlanche(p: Pt3, vue: VuePlanche): { sx: number; sy: number } {
  const { sy, pitch } = affineScales(vue, ECHELLE_PROJETEE);
  const sol = projectStep(stepOf(vue), { x: p.x / ECHELLE_PROJETEE, y: p.y / ECHELLE_PROJETEE });
  return { sx: sol.dx, sy: sol.dy - p.h * sy * Math.cos(pitch) };
}

/** Direction VERS L'ŒIL, unitaire, dans les axes de la planche : le NOYAU de la projection — un
 *  déplacement le long d'elle ne bouge aucun des deux axes d'écran. Elle se DÉRIVE du pitch de la
 *  caméra de production : l'iso regarde la diagonale du sol sous ce pitch, le dessus est à la
 *  verticale. Sert à la FRONTALITÉ (cull) comme à la PROFONDEUR (tri du peintre). */
export function versOeilDe(vue: VuePlanche): Pt3 {
  const { pitch } = affineScales(vue, ECHELLE_PROJETEE);
  const sol = Math.cos(pitch) * Math.SQRT1_2;
  return { x: sol, y: sol, h: Math.sin(pitch) };
}

const versOeil = (p: Pt3, v: Pt3): number => p.x * v.x + p.y * v.y + p.h * v.h;

/** CENTRE DE CARTE servi à la loi d'orientation : la planche n'a qu'une case, à l'origine. La loi n'en
 *  a besoin que pour une surface OUVERTE verticale, et une recette volumique n'en produit aucune
 *  (`noyau/monde/volume/propVolumes.ts` déclare chaque face `oriented: true`). */
const CENTRE_PLANCHE = { x: 0, z: 0 };

/** Ancrage de PLANCHE : la recette au CAP D'IDENTITÉ (`CAP_IDENTITE_PROP`, jamais un cap littéral —
 *  une planche à un autre cap montrerait chaque décor tourné par rapport à ce que la donnée écrit et à
 *  ce qu'une scène sans cap montre), origine de grille, sol à 0 m — aucune scène.
 *  Contrat : `src/gameIso/catalog/planche-qc-cap-identite.test.ts`. */
export const ancrageDePlanche = { ancre: { x: 0, y: 0 }, facing: CAP_IDENTITE_PROP, baseHeightM: 0 };

/** Le `metresPerTile` sous lequel la planche cuit ses recettes — exporté pour que ses contrats cuisent
 *  la MÊME géométrie qu'elle, jamais un second réglage. */
export const MPT_DE_PLANCHE = CASE_METRIQUE;

/** Une face passée par les lois de la cuisson, prête à peindre. */
export interface FacePreparee {
  face: Face;
  /** Sommets en mètres, au cran de caméra demandé. */
  metrique: Pt3[];
  /** Normale TELLE QUE LA LOI D'ORIENTATION LA PRÉSENTE ; `null` pour un polygone dégénéré. */
  normale: Pt3 | null;
  /** Face tournée vers l'œil (cull du peintre). */
  visible: boolean;
  /** Profondeur vers l'œil du barycentre — mesure LOCALE au peintre, sans canonique côté GPU. */
  profondeur: number;
}

/** Les faces d'une recette passées aux lois de la cuisson pour UNE vue — toutes, pas seulement les
 *  visibles : c'est cet état que le contrat compare à la loi. */
export function preparerVue(faces: readonly Face[], rot: Rot, vue: VuePlanche): FacePreparee[] {
  const oeil = versOeilDe(vue);
  return faces.map((face) => {
    const metrique = face.poly.map((p) => enMetres(p, rot));
    const { normale } = orienterPoly(metrique.map(versThree), face.oriented, CENTRE_PLANCHE);
    const n = normale ? versPlanche(normale) : null;
    return {
      face,
      metrique,
      normale: n,
      visible: !!n && versOeil(n, oeil) > 0,
      profondeur: metrique.reduce((acc, p) => acc + versOeil(p, oeil) / metrique.length, 0),
    };
  });
}

/** Couleur du matériau, assombrie ou éclaircie d'un facteur. */
function teinte(couleur: string, facteur: number): string {
  const v = parseInt(couleur.slice(1), 16);
  const c = [(v >> 16) & 255, (v >> 8) & 255, v & 255]
    .map((k) => Math.max(0, Math.min(255, Math.round(k * facteur))).toString(16).padStart(2, '0'));
  return `#${c.join('')}`;
}

/** Une vue d'un décor : ses faces peintes par l'algorithme du peintre (les plus lointaines d'abord),
 *  chacune de la couleur que la cuisson lui donne — surface du matériau × modelé de forme. */
export function vueSvg(faces: readonly Face[], rot: Rot, vue: VuePlanche): { svg: string; peintes: number } {
  const visibles = preparerVue(faces, rot, vue)
    .filter((p) => p.visible)
    .sort((a, b) => a.profondeur - b.profondeur);
  const corps = visibles.map(({ metrique, normale, face }) => {
    const fill = teinte(faceSurface(face).color, shadeFactorOf(shadeFamily(normale ? versThree(normale) : null)));
    const d = metrique.map((p) => projeterPlanche(p, vue)).map(({ sx, sy }) => `${sx.toFixed(1)},${sy.toFixed(1)}`).join(' ');
    return `<polygon points="${d}" fill="${fill}" stroke="${teinte(fill, 0.7)}" stroke-width="0.5"/>`;
  }).join('');
  return { svg: corps, peintes: visibles.length };
}

/** Fenêtre de dessin (px de l'affine) et taille d'affichage d'une cellule : le GROSSISSEMENT est un
 *  réglage de VIGNETTE (viewBox → width/height), jamais une échelle de projection — les pixels peints
 *  restent ceux du jeu. */
const VB_W = 112, VB_H = 140, VB_Y = -100, CELL_W = 230, CELL_H = 250;

export const COLONNES: { titre: string; rot: Rot; vue: VuePlanche }[] = [
  { titre: 'rot0', rot: 0, vue: 'iso' },
  { titre: 'rot1', rot: 1, vue: 'iso' },
  { titre: 'rot2', rot: 2, vue: 'iso' },
  { titre: 'rot3', rot: 3, vue: 'iso' },
  { titre: 'top', rot: 0, vue: 'top' },
];

/** La planche entière, plus la liste des vues SANS aucune face peinte (défaut à signaler). */
export function construireHtml(): { html: string; vides: string[] } {
  const vides: string[] = [];
  const lignes = RECETTES.map((id) => {
    const prop = findPropById(id);
    if (!prop?.volume) throw new Error(`recette absente : ${id}`);
    const faces = buildPropVolumes(prop, ancrageDePlanche, CASE_METRIQUE);
    const cellules = COLONNES.map(({ titre, rot, vue }) => {
      const { svg, peintes } = vueSvg(faces, rot, vue);
      if (peintes === 0) vides.push(`${id}/${titre}`);
      return `<td><div class="vue"><svg viewBox="${-VB_W / 2} ${VB_Y} ${VB_W} ${VB_H}" width="${CELL_W}" height="${CELL_H}">${svg}</svg>` +
        `<span class="meta">${titre} — ${peintes} faces</span></div></td>`;
    }).join('');
    const vignette = `<td><div class="vue vignette"><svg viewBox="0 0 120 150" width="120" height="150"><defs>${defsGlobaux()}</defs>${propSvg(id, CAP_IDENTITE_PROP, 0)}</svg>` +
      `<span class="meta">vignette palette</span></div></td>`;
    return `<tr><th>${id}<br><small>${prop.volume.primitives.length} primitives · ${prop.seatSlots?.length ?? 0} place(s)</small></th>${cellules}${vignette}</tr>`;
  }).join('\n');

  const html = `<!doctype html><html lang="fr"><meta charset="utf-8"><title>QC — mobilier volumique</title>
<style>
 body { background:#15171f; color:#e8e0cc; font:14px/1.4 system-ui, sans-serif; padding:16px; }
 table { border-collapse:collapse; }
 th, td { border:1px solid #333a4a; padding:6px; vertical-align:top; }
 th { text-align:left; max-width:180px; }
 .vue { display:flex; flex-direction:column; align-items:center; background:#1e2130; }
 .vue svg { background:#20243a; }
 .meta { font-size:11px; opacity:0.75; padding:2px 0; }
</style>
<h1>Mobilier volumique — géométrie monde des recettes de <code>props.json</code></h1>
<p>Quatre crans de caméra + vue de dessus, peintes depuis les <code>Face[]</code> réelles de
<code>buildPropVolumes</code> (cap d'identité <code>${CAP_IDENTITE_PROP}</code>, sol à 0 m, case de ${ECHELLE_PROJETEE} m), à la
projection, au dehors et au modelé de forme de la CUISSON. Dernière colonne : la vignette SVG de
palette, qui n'est jamais le corps monde.</p>
<table><thead><tr><th>ref</th>${COLONNES.map((c) => `<th>${c.titre}</th>`).join('')}<th>vignette</th></tr></thead>
<tbody>
${lignes}
</tbody></table>
</html>`;
  return { html, vides };
}
