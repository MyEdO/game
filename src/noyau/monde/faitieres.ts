/**
 * LES FAÎTIÈRES D'UNE SCÈNE TELLES QU'UN HÔTE LES POSE (#4471) : les FAÎTES des groupes de nappes, lus sur les pans
 * servis (`pansDesNappes`, `./volume/toits.ts`), seule source de leur géométrie et de leurs gradients. Les côtés des
 * pans d'un groupe se coupent aux sommets du groupe (jonctions en T) ; un segment que portent deux pans de gradients
 * G1 et G2, n1 la normale en plan qui entre dans le premier, est SAILLANT si (G1 − G2)·n1 < 0, et un segment saillant
 * horizontal est un faîte. Un faîte qui borde une facette (un pan au gradient diagonal, champ de croupe) n'en reçoit
 * aucune, ni un tronçon dont un versant est plus étroit que sa pose (`posable`). Le soffite d'une rive prolonge le plan de son pan au-delà du pignon, et son faîte avec lui. Chaque faîte est
 * servi une fois, en TRONÇONS d'une case coupés aux bords des cases (`tronconsDuFaite`) : une pièce de kit couvre une
 * case et se raccorde bout à bout. Chaque tronçon se pose comme une arête (`AreteDessinee`,
 * `./aretes.ts`) : son milieu et son sens, sa cote, et la demi-différence des pentes de ses deux pans (l'ouverture du V
 * de la pièce).
 */
import type { Pt } from './path';
import type { Face, GP } from './volume/types';
import type { SceneDesToits } from './scene';
import { pansDesNappes, resolveNappes } from './volume/toits';
import { roofMaterial } from './volume/matieres';
import { blocDeLaCase } from './volume/volume';
import { memoByRef } from './sceneMemo';
import type { KitDeToit } from '../../data';
import type { PIECES_DE_TOIT } from './piecesDArete';

/** La pièce qu'un segment de toit porte, l'une de `PIECES_DE_TOIT`. */
export type PieceDeToit = (typeof PIECES_DE_TOIT)[number];

/** Écart sous lequel deux cotes, deux gradients ou deux positions se confondent. */
const EPS = 1e-6;

/** Un tronçon de bout plus court qu'une case rejoint son voisin tant que la pièce qu'ils forment n'excède pas cette
 *  longueur, en cases : l'étirement d'une pièce reste borné à la moitié de sa longueur. */
const TRONCON_MAX = 1.5;

/**
 * @contrat Vue
 * Une faîtière telle qu'un hôte la pose (méthode `aretes`, `faitieres`) : un tronçon d'un faîte, posé comme une arête.
 */
export interface Faitiere {
  /** Sa clé : `faite|<groupe de nappes>|<bout>|<bout>`. */
  cle: string;
  /** La nappe dont elle tombe (`nappeKey`), levée avec elle (`toitsLeves`). */
  nappe: string;
  /** Les cases `{ x, y, z }` qu'elle traverse, celles de sa vision. */
  cases: Required<Pt>[];
  /** La couverture de sa nappe (domaine `roof` de `materials.json`). */
  couverture: string;
  /** La famille du kit de toit de sa couverture (`kit` de `materials.json`), modèle `toit--<famille>`. */
  famille: KitDeToit;
  /** Sa pièce (`Noyau.PieceDeToit`). */
  piece: PieceDeToit;
  /** Sa place (`Noyau.Position`) : toujours `seule`. */
  position: 'seule';
  /** Sa palette : `corps`, le `ridgeCap` de sa couverture. */
  palette: { corps: string };
  /** Son milieu, en cases (repère des cases centrées). */
  milieu: Pt;
  /** Son sens, d'un bout à l'autre, en cases. */
  sens: Pt;
  /** Sa cote (m) en son milieu. */
  pied: number;
  /** Sa cote (m) à son premier bout. */
  entree: number;
  /** Sa cote (m) à son second bout. */
  sortie: number;
  /** Le bloc de sa première case (`blocDeLaCase`). */
  bloc: string;
  /** La demi-différence des pentes de ses deux pans (m par case) : l'ouverture du V de sa pièce. */
  ecart: number;
}

const cle3 = (p: GP): string => `${p.x.toFixed(5)},${p.y.toFixed(5)},${p.h.toFixed(4)}`;

/** Un pan au gradient DIAGONAL (les deux composantes non nulles) : une facette du champ de croupe. */
const facette = (p: { gx: number; gy: number }): boolean => Math.abs(p.gx) > EPS && Math.abs(p.gy) > EPS;

/** Les segments ATOMIQUES des pans `pans` : chaque côté coupé aux sommets du groupe qui s'y trouvent, une fois chacun,
 *  avec les pans qui le portent et, pour chacun, la normale en plan qui entre dans le pan. */
function segmentsDuGroupe(pans: readonly PanDuGroupe[]) {
  const sommets = pans.flatMap((p) => p.poly);
  const atomes = new Map<string, { a: GP; b: GP; porteurs: { i: number; nx: number; ny: number }[] }>();
  pans.forEach((pan, i) => {
    const n = pan.poly.length;
    let aire = 0;
    for (let j = 0; j < n; j++) { const a = pan.poly[j], b = pan.poly[(j + 1) % n]; aire += a.x * b.y - b.x * a.y; }
    for (let j = 0; j < n; j++) {
      const a = pan.poly[j], b = pan.poly[(j + 1) % n];
      const dx = b.x - a.x, dy = b.y - a.y, dh = b.h - a.h, L = Math.hypot(dx, dy);
      if (L < EPS) continue;
      const ts = [0, 1];
      for (const v of sommets) {
        const t = ((v.x - a.x) * dx + (v.y - a.y) * dy) / (L * L);
        if (t > EPS && t < 1 - EPS && Math.abs(a.x + dx * t - v.x) < EPS && Math.abs(a.y + dy * t - v.y) < EPS && Math.abs(a.h + dh * t - v.h) < 1e-4) ts.push(t);
      }
      ts.sort((p, q) => p - q);
      const signe = aire < 0 ? -1 : 1;
      const nx = (-dy / L) * signe, ny = (dx / L) * signe;
      for (let m = 0; m + 1 < ts.length; m++) {
        if (ts[m + 1] - ts[m] < EPS) continue;
        const pa = { x: a.x + dx * ts[m], y: a.y + dy * ts[m], h: a.h + dh * ts[m] };
        const pb = { x: a.x + dx * ts[m + 1], y: a.y + dy * ts[m + 1], h: a.h + dh * ts[m + 1] };
        const [u, v] = cle3(pa) < cle3(pb) ? [pa, pb] : [pb, pa];
        const cle = `${cle3(u)}|${cle3(v)}`;
        (atomes.get(cle) ?? atomes.set(cle, { a: u, b: v, porteurs: [] }).get(cle)!).porteurs.push({ i, nx, ny });
      }
    }
  });
  return [...atomes.entries()];
}

/** Les tronçons du faîte axial `a`→`b` (repère des cases centrées) dont les cases couvrent, le long de son axe,
 *  l'étendue `couverte` : coupé à chaque bord de case intérieur à cette étendue (coordonnée demi-entière), chaque
 *  tronçon long d'une case, sauf à ses bouts, si bien que le débord d'une rive va au tronçon de bout et que chaque
 *  tronçon traverse une case ; un tronçon de bout plus court qu'une case rejoint son voisin si la pièce qu'ils forment
 *  tient dans `TRONCON_MAX`, sinon il garde sa longueur. */
export function tronconsDuFaite(a: GP, b: GP, couverte: readonly [number, number]): [GP, GP][] {
  const selonX = Math.abs(b.x - a.x) > EPS;
  const le = (p: GP) => (selonX ? p.x : p.y);
  const [lo, hi] = [Math.min(le(a), le(b)), Math.max(le(a), le(b))];
  const coupes = [lo];
  for (let t = Math.floor(Math.max(lo, couverte[0]) + 0.5 + EPS) + 0.5; t < Math.min(hi, couverte[1]) - EPS; t++) coupes.push(t);
  coupes.push(hi);
  if (coupes.length > 2 && coupes[1] - coupes[0] < 1 - EPS && coupes[2] - coupes[0] <= TRONCON_MAX + EPS) coupes.splice(1, 1);
  const n = coupes.length;
  if (n > 2 && coupes[n - 1] - coupes[n - 2] < 1 - EPS && coupes[n - 1] - coupes[n - 3] <= TRONCON_MAX + EPS) coupes.splice(n - 2, 1);
  const point = (t: number): GP => (selonX ? { x: t, y: a.y, h: a.h } : { x: a.x, y: t, h: a.h });
  return coupes.slice(1).map((t, i) => [point(coupes[i]), point(t)]);
}

/** L'étendue, le long de l'axe du faîte `a`→`b`, des cases de `cells` que touche sa droite (repère des cases centrées). */
function etendueCouverte(a: GP, b: GP, cells: ReadonlySet<string>): [number, number] {
  const selonX = Math.abs(b.x - a.x) > EPS;
  const le = [Infinity, -Infinity] as [number, number];
  for (const cle of cells) {
    const [x, y] = cle.split(',').map(Number);
    if (Math.abs((selonX ? y - a.y : x - a.x)) > 0.5 + EPS) continue;
    le[0] = Math.min(le[0], (selonX ? x : y) - 0.5);
    le[1] = Math.max(le[1], (selonX ? x : y) + 0.5);
  }
  return le;
}

/** Les cases de `cells` (couche `z`) que traverse le segment `a`→`b` (repère des cases centrées), ses bouts exclus. */
function casesDuSegment(a: GP, b: GP, cells: ReadonlySet<string>, z: number): Required<Pt>[] {
  const out = new Map<string, Required<Pt>>();
  const pas = Math.max(1, Math.ceil(2 * Math.hypot(b.x - a.x, b.y - a.y)));
  for (let k = 0; k < pas; k++) {
    const x = a.x + ((b.x - a.x) * (k + 0.5)) / pas + 0.5, y = a.y + ((b.y - a.y) * (k + 0.5)) / pas + 0.5;
    for (const cx of new Set([Math.ceil(x) - 1, Math.floor(x)]))
      for (const cy of new Set([Math.ceil(y) - 1, Math.floor(y)]))
        if (cells.has(`${cx},${cy}`)) out.set(`${cx},${cy}`, { x: cx, y: cy, z });
  }
  return [...out.values()];
}

/** Un pan d'un groupe de nappes : sa boucle (repère des cases centrées, cotes en m), son gradient, sa nappe
 *  (`nappeKey`), les cases et la couche de sa masse, sa couverture. */
export interface PanDuGroupe { poly: readonly GP[]; gx: number; gy: number; nappe: string; cells: ReadonlySet<string>; z: number; couverture: string }

/** Les faîtes des pans `pans` du groupe `groupId`, en tronçons (`tronconsDuFaite`). Les segments saillants horizontaux
 *  d'une même droite, d'une même cote, d'une même nappe et d'un même écart qui se touchent ne font qu'un faîte : le
 *  débord d'une rive prolonge celui de son pan. PUR. */
export function faitesDuGroupe(groupId: string, pans: readonly PanDuGroupe[]): Faitiere[] {
  const faites = new Map<string, { pan: PanDuGroupe; versants: [PanDuGroupe, PanDuGroupe]; ecart: number; selonX: boolean; lo: number; hi: number; a: GP }[]>();
  for (const [, { a, b, porteurs }] of segmentsDuGroupe(pans)) {
    if (porteurs.length !== 2 || Math.abs(b.h - a.h) > EPS) continue;
    const [o1, o2] = porteurs;
    const [p1, p2] = [pans[o1.i], pans[o2.i]];
    const ecart = Math.hypot(p1.gx - p2.gx, p1.gy - p2.gy) / 2;
    if (ecart < EPS || (p1.gx - p2.gx) * o1.nx + (p1.gy - p2.gy) * o1.ny >= -EPS || facette(p1) || facette(p2)) continue;
    const selonX = Math.abs(b.x - a.x) > EPS;
    const [u, v] = selonX ? [a.x, b.x] : [a.y, b.y];
    const droite = `${p1.nappe}|${ecart.toFixed(6)}|${selonX ? `y${a.y.toFixed(5)}` : `x${a.x.toFixed(5)}`}|${a.h.toFixed(4)}`;
    (faites.get(droite) ?? faites.set(droite, []).get(droite)!).push({ pan: p1, versants: [p1, p2], ecart, selonX, lo: Math.min(u, v), hi: Math.max(u, v), a });
  }
  const bouts: { pan: PanDuGroupe; versants: [PanDuGroupe, PanDuGroupe]; ecart: number; a: GP; b: GP }[] = [];
  for (const segments of faites.values()) {
    segments.sort((p, q) => p.lo - q.lo);
    const { pan, versants, ecart, selonX, a } = segments[0];
    const point = (t: number): GP => (selonX ? { x: t, y: a.y, h: a.h } : { x: a.x, y: t, h: a.h });
    let [lo, hi] = [segments[0].lo, segments[0].hi];
    for (const s of segments.slice(1)) {
      if (s.lo <= hi + EPS) hi = Math.max(hi, s.hi);
      else { bouts.push({ pan, versants, ecart, a: point(lo), b: point(hi) }); [lo, hi] = [s.lo, s.hi]; }
    }
    bouts.push({ pan, versants, ecart, a: point(lo), b: point(hi) });
  }
  return bouts.flatMap(({ pan, versants, ecart, a, b }) => {
    const def = roofMaterial(pan.couverture);
    if (!def.kit || !def.ridgeCap) return [];
    const { kit, ridgeCap } = def;
    return tronconsDuFaite(a, b, etendueCouverte(a, b, pan.cells)).filter(([ta, tb]) => posable(pans, versants, ta, tb)).map(([ta, tb]): Faitiere => {
      const cases = casesDuSegment(ta, tb, pan.cells, pan.z);
      return {
        cle: `faite|${groupId}|${cle3(ta)}|${cle3(tb)}`,
        nappe: pan.nappe,
        cases,
        couverture: pan.couverture,
        famille: kit,
        piece: 'faitiere',
        position: 'seule',
        palette: { corps: ridgeCap },
        milieu: { x: (ta.x + tb.x) / 2, y: (ta.y + tb.y) / 2 },
        sens: { x: tb.x - ta.x, y: tb.y - ta.y },
        pied: ta.h,
        entree: ta.h,
        sortie: tb.h,
        bloc: blocDeLaCase(cases[0]),
        ecart,
      };
    });
  });
}

/** La pièce d'un tronçon `ta`→`tb` couvre une case : à son milieu, une demi-case de part et d'autre du faîte, l'un des
 *  pans les plus hauts des pans `pans` du groupe doit être l'un des `versants` du faîte (même plan). Sinon un autre pan
 *  passe au-dessus de la pose, là où les versants se resserrent (le faîte d'une enveloppe qui rejoint la croupe commune). */
function posable(pans: readonly PanDuGroupe[], versants: readonly [PanDuGroupe, PanDuGroupe], ta: GP, tb: GP): boolean {
  const m = { x: (ta.x + tb.x) / 2, y: (ta.y + tb.y) / 2 };
  const l = Math.hypot(tb.x - ta.x, tb.y - ta.y);
  const n = { x: -(tb.y - ta.y) / l, y: (tb.x - ta.x) / l };
  const plan = (p: PanDuGroupe, q: Pt) => p.poly[0].h + p.gx * (q.x - p.poly[0].x) + p.gy * (q.y - p.poly[0].y);
  const memePlan = (p: PanDuGroupe, v: PanDuGroupe) => Math.abs(p.gx - v.gx) < EPS && Math.abs(p.gy - v.gy) < EPS && Math.abs(plan(p, m) - plan(v, m)) < EPS;
  return [-1, 1].every((cote) => {
    const q = { x: m.x + cote * DEMI_POSE * n.x, y: m.y + cote * DEMI_POSE * n.y };
    const sous = pans.filter((p) => dansLePan(p.poly, q));
    const haut = Math.max(...sous.map((p) => plan(p, q)));
    return sous.some((p) => plan(p, q) > haut - EPS && versants.some((v) => memePlan(p, v)));
  });
}

/** La demi-largeur (cases) que couvre la pièce d'un tronçon de part et d'autre de son faîte. */
const DEMI_POSE = 0.5;

/** Le point `q` est-il dans le polygone `poly` (repère des cases centrées), bord compris ? */
function dansLePan(poly: readonly GP[], q: Pt): boolean {
  let dedans = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (Math.abs((b.x - a.x) * (q.y - a.y) - (b.y - a.y) * (q.x - a.x)) < EPS
      && q.x >= Math.min(a.x, b.x) - EPS && q.x <= Math.max(a.x, b.x) + EPS && q.y >= Math.min(a.y, b.y) - EPS && q.y <= Math.max(a.y, b.y) + EPS) return true;
    if ((a.y > q.y) !== (b.y > q.y) && q.x < ((b.x - a.x) * (q.y - a.y)) / (b.y - a.y) + a.x) dedans = !dedans;
  }
  return dedans;
}

/** Une face d'un pan servi est un soffite de RIVE : un soffite dont le bord intérieur suit la pente du rampant. */
const soffiteDeRive = (face: Face): boolean => face.material.part === 'soffite' && Math.abs(face.poly[1].h - face.poly[0].h) > EPS;

/** Les faîtières de chaque groupe de nappes de `scene` (`faitesDuGroupe`), lues sur les pans servis (`pansDesNappes`),
 *  chacun avec les soffites de ses rives, qui prolongent son plan au-delà du pignon. Retenues par scène et version des
 *  datasets (`memoByRef`). */
export const faitieresDeLaScene = memoByRef((scene: SceneDesToits): Faitiere[] => {
  const pansParCle = pansDesNappes(scene);
  const groupes = new Map<string, PanDuGroupe[]>();
  for (const [cle, nappe] of resolveNappes(scene)) {
    const groupe = groupes.get(nappe.groupId) ?? groupes.set(nappe.groupId, []).get(nappe.groupId)!;
    for (const pan of pansParCle.get(cle)!)
      for (const face of [pan.face, ...pan.faces.filter(soffiteDeRive)])
        groupe.push({ poly: face.poly, gx: pan.gx, gy: pan.gy, nappe: cle, cells: nappe.cells, z: nappe.mass.z, couverture: nappe.mass.material.id });
  }
  return [...groupes].flatMap(([groupId, pans]) => faitesDuGroupe(groupId, pans));
});
