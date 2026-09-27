/**
 * PEINTRE SVG D'AUTHORING des toits (frontière du module : `authoring/project.ts`) — iso losange ·
 * edge-on · vue du dessus · mode plan de l'éditeur :
 * dessine un élément `roof` du pivot en SVG, en projetant ses PANS GRILLE+MÈTRES via le pont partagé
 * (`projGP`). La teinte d'un pan = SA part d'orientation (N/E/S/O de la def, une couleur PAR PAN — fini
 * le choix par-cellule) ; les lignes sémantiques du builder sont stylées ici (`line` pour faîte/arêtier/
 * égout, `detail.courses.joint` pour les rangs de tuiles). MATÉRIAUX v2 : la recette du matériau habille
 * chaque pan — bardeaux décalés (`blockWM`), nuances par bardeau (`paletteVar`, LOD 2), rangs TREMBLÉS
 * (chaume : `edgeWobble` sans blocs) et balayage de brins (`tufts`, LOD 2) — le tout CLIPPÉ au polygone
 * du pan (le motif suit la pente, jamais ne déborde l'égout/l'arêtier). Pas de couche d'accents séparée
 * comme sols/murs : une scène porte une POIGNÉE de toits (le coût vit bien dans le memo du stage).
 * La vue du DESSUS ('top') est la boîte d'empreinte (plan/planEdge) ; l'ÉDITEUR passe `{ plan: true }`
 * pour son plan par-cellule (couverture semi-transparente au travers de laquelle on voit/édite les
 * murs), étiqueté du `label` qu'il fournit — le texte est une ENTRÉE de rendu, jamais une propriété
 * de l'élément. Toute couleur vient du JSON (`materials.json`, domaine `roof`) ou de `shade`.
 */
import { diamondPath, footprintDepth, isSquareView, tileCenter, type Dims } from '../../geometry/iso';
import { roofMaterial, type RoofMaterialDef } from '../catalog/roofs';
import { ROOF_SLOPE_M } from '../builders/roofs';
import { roofCourseStepM } from '../detail/courses';
import { ISO_PX_PER_M } from '../iso';
import {
  detailOf,
  projTag,
  coursesKey,
  patternWM,
  rowBoundaries,
  N_VARIANTS,
  type Courses,
  type DetailOpts,
} from './detailSvg';
import { hash32, seedStream } from '../../data/hash';
import { matierePlan } from '../../data';
import { ACCENT_FRAC, BLOCK_INSET_M, BLOCK_SHADE_K } from '../detail/expand';
import { shade } from '../shade';
import { mix } from '../../data/couleur';
import type { DetailRecipe } from '../detail/types';
import { projGP, type Pt2 } from './project';
import { structureFaceSvg } from './wallsSvg';
import { metricToLift } from '../../state/relief';
import type { GP, RoofEl } from '../builders/types';

// Épaisseurs ÉCRAN (px) des lignes — des formes, jamais des identités de couleur.
const SEAM_W = 0.6; // liseré au ton du pan : soude les coutures anti-aliasées entre pans
const EGOUT_W = 0.8; // bord bas de la nappe
const CREST_W = 1.1; // faîte / arêtier (crêtes nettes)
const RIDGE_W = 2.2; // couronnement de faîte : base ÉPAISSE (ton `line`) — la crête a du volume
const RIDGE_CAP_W = 0.9; // liseré CLAIR (`ridgeCap`) posé sur le dessus → lit un couronnement, pas un trait

/** Ton d'une face de toit depuis la def (zéro littéral) : les faces de VOLUME d'avant-toit résolvent leur
 *  ton DÉDIÉ (`soffite` = dessous débordant ombré ; `fascia` = planche de rive sombre) ; un pan ordinaire
 *  suit son orientation N/E/S/O. */
function panFill(sh: RoofMaterialDef, part: string): string {
  if (part === 'soffite') return sh.soffite ?? sh.S ?? sh.N!;
  if (part === 'fascia') return sh.fascia ?? sh.line ?? sh.S ?? sh.N!;
  return sh[part as 'N' | 'E' | 'S' | 'O'] ?? sh.N!;
}
// Formes du détail de couverture (mètres). Le retrait et la fraction des nuances de bardeau réutilisent
// le dosage PARTAGÉ de l'appareillage mural (`BLOCK_INSET_M` / `ACCENT_FRAC`, importés de detail/expand).
const TICK_INSET_M = 0.03; // le joint vertical d'un bardeau laisse respirer les lignes de rang
const WOBBLE_STEP_M = 0.5; // échantillonnage du tremblé de rang (chaume)

// Contrat DATA (`materials.json` domaine `roof`, cf. RoofMaterialDef) : une matière de couverture définit ses pentes
// N/E/S/O + `line` (rendu iso) et ses champs `plan*` (vue du dessus). Optionnels au TYPE, requis selon le
// MODE de rendu → les `!` de ce fichier sont garantis par ce contrat, pas par le compilateur.
/** LIFT de la nappe, en unités de niveau — dérivé de la SEULE vérité d'altitude du pivot, la cote
 *  MÉTRIQUE de l'égout (`metricToLift`, le pont qu'emprunte déjà `projGP` pour les pans). L'index de
 *  couche `el.cell.z` n'est PAS une hauteur : il désigne l'étage dont on lit le plancher, et le
 *  plancher porte du relief (`heightAt`) — une nappe posée sur une butte ou en haut d'une cage
 *  d'escalier vit plusieurs crans au-dessus de son index. */
const roofLift = (el: RoofEl): number => metricToLift(el.eaveHeightM);

/** Recul de tri d'une FERMETURE de comble, en unités de profondeur (bien en deçà d'une case, qui vaut
 *  1 : jamais de quoi passer derrière un bâtiment voisin). Le plan d'un pignon est EN RETRAIT de son
 *  avant-toit — le débord d'égout et sa planche de rive le survolent de `eaveOverhangM` — donc la
 *  fermeture se peint AVANT les pans de sa nappe. Sans ce recul, les deux profondeurs sont ÉGALES au
 *  coin proche caméra et l'ordre ne tient qu'à celui d'émission : le pignon repeindrait le retour
 *  d'égout de son propre toit. */
const CLOSURE_DEPTH_BIAS = 0.05;

/** Une fermeture de comble ne porte QUE de la matière de mur (cf. `builders/roofs.ts`) : c'est ce qui
 *  la distingue d'un pan, sans champ de plus sur l'élément. */
const isClosure = (el: RoofEl): boolean => !el.faces.some((f) => f.material.domain === 'roof');

/** Profondeur de tri d'un toit : MAX sur les 4 coins de l'empreinte à son ALTITUDE (coin proche
 *  caméra, correct aux 4 rotations) ; une fermeture de comble recule sous son propre avant-toit. */
export function roofDepth(el: RoofEl, dims: Dims): number {
  const d = footprintDepth(el.cell.x, el.cell.y, el.span.w, el.span.h, dims, roofLift(el));
  return isClosure(el) ? d - CLOSURE_DEPTH_BIAS : d;
}

const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const lineSvg = (a: Pt2, b: Pt2, color: string, w: number) =>
  `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;

// ── Détail de couverture (matériaux v2) ──────────────────────────────────────────────────────────────
/** (x,y) DANS le polygone d'un pan (xy grille, ray-cast pair-impair) — assigne un rang à SON pan. */
function inPanXY(x: number, y: number, poly: GP[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > y !== b.y > y && x < a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y)) inside = !inside;
  }
  return inside;
}

/** Gradient du PLAN d'un pan (montée h par unité de grille en +x/+y), depuis 3 sommets non colinéaires
 *  — le backend re-dérive la pente de la géométrie du pivot, sans champ stocké. */
function panGrad(poly: GP[]): { gx: number; gy: number } | null {
  const [p0, p1] = poly;
  for (let j = 2; j < poly.length; j++) {
    const p2 = poly[j];
    const det = (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
    if (!det) continue;
    return {
      gx: ((p1.h - p0.h) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.h - p0.h)) / det,
      gy: ((p1.x - p0.x) * (p2.h - p0.h) - (p1.h - p0.h) * (p2.x - p0.x)) / det,
    };
  }
  return null;
}

const n1 = (v: number) => String(Math.round(v * 10) / 10);

interface Pan {
  poly: GP[];
  pts: Pt2[];
  fill: string;
  near: number;
}

/** DÉTAIL des pans (LOD ≥ 1) : par pan — CLIPPÉ à son polygone — bardeaux (joints verticaux décalés
 *  par rang, bornes seedées PARTAGÉES avec l'appareillage mural via `rowBoundaries`), nuances de
 *  bardeau (LOD 2), rangs tremblés (chaume) et brins de paille (LOD 2). Les positions sont ancrées à
 *  la coordonnée MONDE le long de la courbe de niveau → un rang scindé entre segments garde ses
 *  bardeaux alignés, et le seed vient de l'identité MONDE de l'élément (`seedScope` 'instance'). */
function roofDetailSvg(el: RoofEl, pans: Pan[], det: DetailRecipe, dims: Dims, lod: 1 | 2, mpt: number): string {
  const c = det.courses as Courses;
  const rangs = el.lines.filter((l) => l.kind === 'rang');
  if (!rangs.length) return '';
  const step = roofCourseStepM(el.pitch, c.hM, ROOF_SLOPE_M);
  const h0 = Math.min(...rangs.map((r) => r.a.h));
  const seed = hash32('roof', el.cell.x, el.cell.y, el.cell.z);
  const variant = seed % N_VARIANTS;
  const key = coursesKey(c);
  const W = patternWM(c);
  let svg = '';

  pans.forEach((pan, pi) => {
    const g = panGrad(pan.poly);
    if (!g) return;
    const gm = Math.hypot(g.gx, g.gy);
    if (gm < 1e-9) return; // pan plat : aucun rang
    const down: Pt2 = [-g.gx / gm, -g.gy / gm]; // direction DESCENDANTE (grille)
    const lvl: Pt2 = [-g.gy / gm, g.gx / gm]; // direction le long des courbes de niveau
    const sOf = (p: GP) => (p.x * lvl[0] + p.y * lvl[1]) * mpt; // coordonnée MONDE (m) le long du rang
    let ticks = '';
    let wobble = '';
    let light = '';
    let dark = '';
    let straw = '';
    for (const ln of rangs) {
      const mx = (ln.a.x + ln.b.x) / 2;
      const my = (ln.a.y + ln.b.y) / 2;
      if (!inPanXY(mx, my, pan.poly)) continue;
      const sa = sOf(ln.a);
      const sb = sOf(ln.b);
      if (Math.abs(sb - sa) < 0.05) continue;
      const s0 = Math.min(sa, sb);
      const s1 = Math.max(sa, sb);
      const k = Math.round((ln.a.h - h0) / step);
      /** Point du pan à la coordonnée de rang `s` (m), décalé de `dv` mètres VERS LE BAS de la pente. */
      const at = (s: number, dv: number): string => {
        const t = (s - sa) / (sb - sa);
        const p = projGP(
          { x: ln.a.x + (ln.b.x - ln.a.x) * t + (down[0] * dv) / gm, y: ln.a.y + (ln.b.y - ln.a.y) * t + (down[1] * dv) / gm, h: ln.a.h - dv },
          dims,
        );
        return `${n1(p[0])},${n1(p[1])}`;
      };
      if (c.blockWM) {
        // BARDEAUX : bornes du motif périodique par parité de rang, ancrées MONDE le long du rang.
        const bounds = rowBoundaries(c, key, variant, (((k % 2) + 2) % 2) as 0 | 1);
        const edges: number[] = [s0];
        for (let n = Math.floor(s0 / W); n * W <= s1; n++)
          for (const bd of bounds) {
            const pos = n * W + bd;
            if (pos > s0 + 0.05 && pos < s1 - 0.05) edges.push(pos);
          }
        edges.sort((p, q) => p - q);
        edges.push(s1);
        for (let i = 1; i + 1 < edges.length; i++) ticks += `M${at(edges[i], TICK_INSET_M)}L${at(edges[i], step - TICK_INSET_M)}`;
        if (lod >= 2 && c.paletteVar) {
          for (let i = 0; i + 1 < edges.length; i++) {
            const u0 = edges[i] + BLOCK_INSET_M;
            const u1 = edges[i + 1] - BLOCK_INSET_M;
            if (u1 - u0 < 0.08) continue;
            const rv = seedStream(hash32(seed, 'brd', k, Math.round(edges[i] * 20)))();
            if (rv >= ACCENT_FRAC && rv <= 1 - ACCENT_FRAC) continue;
            const sub = `M${at(u0, BLOCK_INSET_M)}L${at(u1, BLOCK_INSET_M)}L${at(u1, step - BLOCK_INSET_M)}L${at(u0, step - BLOCK_INSET_M)}Z`;
            if (rv < ACCENT_FRAC) light += sub;
            else dark += sub;
          }
        }
      } else if (c.edgeWobble) {
        // CHAUME : le rang droit devient une ligne ORGANIQUE — offsets seedés à la coordonnée MONDE
        // arrondie (un rang scindé entre deux segments tremble pareil des deux côtés).
        const off = (s: number) => (seedStream(hash32(seed, 'wob', k, Math.round(s * 8)))() * 2 - 1) * c.edgeWobble!;
        wobble += `M${at(s0, off(s0))}`;
        for (let s = Math.ceil(s0 / WOBBLE_STEP_M) * WOBBLE_STEP_M; s < s1; s += WOBBLE_STEP_M) wobble += `L${at(s, off(s))}`;
        wobble += `L${at(s1, off(s1))}`;
      }
      if (lod >= 2 && det.tufts) {
        // BALAYAGE de brins (paille) : petits traits le long de la pente, semés depuis chaque rang.
        const t = det.tufts;
        const rs = seedStream(hash32(seed, 'straw', k, Math.round(s0 * 10)));
        const n = Math.round(t.perM2 * (s1 - s0) * step);
        for (let i = 0; i < n; i++) {
          const s = s0 + rs() * (s1 - s0);
          const len = t.hM[0] + rs() * (t.hM[1] - t.hM[0]);
          straw += `M${at(s, -0.15 * len)}L${at(s + (rs() * 2 - 1) * 0.15, 0.85 * len)}`;
        }
      }
    }
    let inner = '';
    if (ticks) inner += `<path d="${ticks}" fill="none" stroke="${c.joint}" stroke-width="${n1(c.jointW * ISO_PX_PER_M)}"/>`;
    if (wobble)
      inner += `<path d="${wobble}" fill="none" stroke="${c.joint}" stroke-width="${n1(c.jointW * ISO_PX_PER_M)}" stroke-linejoin="round" opacity="0.85"/>`;
    if (light) inner += `<path d="${light}" fill="${shade(pan.fill, 1 + (c.paletteVar ?? 0) * BLOCK_SHADE_K)}"/>`;
    if (dark) inner += `<path d="${dark}" fill="${shade(pan.fill, 1 - (c.paletteVar ?? 0) * BLOCK_SHADE_K)}"/>`;
    if (straw) {
      // Teinte des brins ANCRÉE au fill du pan (mix vers la couleur de la recette) : la paille reste
      // de la paille sur le pan éclairé comme sur le pan dans l'ombre, sans rayures qui claquent.
      const t = det.tufts!;
      const col = mix(pan.fill, t.colors[hash32(seed, 'strawcol', pi) % t.colors.length], 0.55);
      inner += `<path d="${straw}" fill="none" stroke="${col}" stroke-width="0.7" stroke-linecap="round" opacity="0.55"/>`;
    }
    if (!inner) return;
    // CLIP au polygone du pan : les bardeaux du dernier rang meurent à l'égout, jamais au-delà —
    // id étiqueté par projection + identité de l'élément (planches QC multi-panneaux).
    const cid = `rfc-${projTag(dims)}-${el.key.replace(/[^a-zA-Z0-9_-]/g, '-')}-${pi}`;
    svg += `<clipPath id="${cid}"><path d="M${pan.pts.map((q) => `${q[0]},${q[1]}`).join(' L')} Z"/></clipPath><g clip-path="url(#${cid})">${inner}</g>`;
  });
  return svg;
}

/** Nappe iso/edge-on : pans projetés, triés ARRIÈRE→AVANT à l'écran — en iso le pan opposé à la caméra
 *  est presque de chant et REPLIE d'un cheveu par-dessus le faîte (montée 17 px > pas de profondeur
 *  16 px) ; le pan proche, peint après, recouvre ce repli. Rangs de tuiles (leur couleur/épaisseur vient
 *  de la recette du matériau), détail de couverture (LOD ≥ 1), puis crêtes par-dessus. */
function pansSvg(el: RoofEl, dims: Dims, opts?: DetailOpts): string {
  const sh = roofMaterial(el.material);
  const { lod, mpt } = detailOf(opts);
  const detailLod = el.simplifiedCourses ? 0 : lod;
  const c = sh.detail?.courses;
  // FERMETURE DE COMBLE : une face de la nappe dont la matière est celle du MUR qu'elle prolonge
  // (`domain:'structure'`, cf. `builders/roofs.ts`) — peinte par le backend des MURS, la source unique
  // de l'appareillage et du colombage. Elle vit dans la nappe pour en suivre le dégagement, pas pour en
  // prendre la couverture.
  const structure = el.faces
    .filter((f) => f.material.domain === 'structure')
    .map((f, i) => structureFaceSvg(f, `${el.key}-${i}`, el.cell, dims, opts))
    .join('');
  const pans: Pan[] = el.faces
    .filter((f) => f.material.domain !== 'structure')
    .map((f) => {
      const pts = f.poly.map((p) => projGP(p, dims));
      return { poly: f.poly, pts, fill: panFill(sh, f.material.part!), near: Math.max(...pts.map((p) => p[1])) };
    })
    .sort((a, b) => a.near - b.near);
  let svg = structure;
  for (const p of pans)
    svg += `<path d="M${p.pts.map((q) => `${q[0]},${q[1]}`).join(' L')} Z" fill="${p.fill}" stroke="${p.fill}" stroke-width="${SEAM_W}" stroke-linejoin="round"/>`;
  // Rangs DROITS (lignes de niveau du builder) — le chaume les remplace par son tremblé dès le LOD 1.
  const wobbly = detailLod >= 1 && !!c && !c.blockWM && !!c.edgeWobble;
  if (c && !wobbly)
    for (const ln of el.lines) {
      if (ln.kind !== 'rang') continue;
      svg += lineSvg(projGP(ln.a, dims), projGP(ln.b, dims), c.joint, c.jointW * ISO_PX_PER_M);
    }
  if (detailLod >= 1 && sh.detail?.courses) svg += roofDetailSvg(el, pans, sh.detail, dims, detailLod as 1 | 2, mpt);
  for (const ln of el.lines) {
    if (ln.kind === 'rang') continue;
    const a = projGP(ln.a, dims);
    const b = projGP(ln.b, dims);
    if (ln.kind === 'faite' && sh.ridgeCap) {
      // COURONNEMENT : trait de base épais (ton `line`) + liseré clair par-dessus → crête volumique.
      svg += lineSvg(a, b, sh.line!, RIDGE_W);
      svg += lineSvg(a, b, sh.ridgeCap, RIDGE_CAP_W);
    } else {
      svg += lineSvg(a, b, sh.line!, ln.kind === 'egout' ? EGOUT_W : CREST_W);
    }
  }
  return svg;
}

/** Vue du DESSUS : l'extrusion iso n'a pas de sens → cellules exactes, couleurs de la def 'plan'. */
function planBoxSvg(el: RoofEl, dims: Dims): string {
  const plan = matierePlan();
  return el.cells
    .map((cell) => `<path d="${diamondPath(cell.x, cell.y, dims, roofLift(el))}" fill="${plan.planBody!}" stroke="${plan.planEdge!}" stroke-width="1"/>`)
    .join('');
}

/** Mode PLAN de l'ÉDITEUR : couverture PAR-CELLULE, semi-transparente (on voit/édite les murs
 *  au travers), teintée par le matériau de couverture. Tracée à l'ALTITUDE de la nappe (`roofLift`,
 *  la même cote métrique que les pans en iso et que les murs du même canevas) : sans elle, la nappe
 *  d'un bâtiment à étage ou d'une masse sur relief se pose au sol, par-dessus le rez qu'on édite.
 *  Le `label` est une ENTRÉE de rendu fournie par l'appelant : sans lui, aucun texte n'est peint. */
function planCellsSvg(el: RoofEl, dims: Dims, label?: string): string {
  const sh = roofMaterial(el.material);
  const plan = matierePlan();
  let svg = '';
  for (const cell of el.cells)
    svg += `<path d="${diamondPath(cell.x, cell.y, dims, roofLift(el))}" fill="${sh.O ?? plan.planBody!}" opacity="0.7" stroke="${plan.planEdge!}" stroke-width="0.5"/>`;
  if (label) {
    const { cx, cy } = tileCenter(el.cell.x + (el.span.w - 1) / 2, el.cell.y + (el.span.h - 1) / 2, dims, roofLift(el));
    svg +=
      `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-size="11" font-weight="bold" fill="${plan.planText!}" stroke="${plan.planEdge!}" stroke-width="0.5">${escapeXml(label)}</text>`;
  }
  return svg;
}

/** SVG d'un élément de toit : `{ plan: true }` = plan de l'éditeur, étiqueté du `label` que l'appelant
 *  fournit ; vue du dessus = empreinte exacte ; sinon nappe en pans continus (+ détail de couverture
 *  selon `zoom`/LOD). L'opacité de CUTAWAY est une décoration du stage. */
export function roofSvg(el: RoofEl, dims: Dims, opts?: DetailOpts & { plan?: boolean; label?: string }): string {
  // Une FERMETURE de comble (aucune face de couverture) n'a rien à dire VU DU DESSUS : elle est
  // verticale, et les cases qu'elle borde sont déjà peintes par les pans de sa nappe.
  if (opts?.plan) return isClosure(el) ? '' : planCellsSvg(el, dims, opts.label);
  if (isSquareView(dims.view)) return isClosure(el) ? '' : planBoxSvg(el, dims);
  return pansSvg(el, dims, opts);
}
