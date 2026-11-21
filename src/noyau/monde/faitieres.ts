/**
 * LES FAÎTIÈRES D'UNE SCÈNE TELLES QU'UN HÔTE LES POSE (#4471) : les FAÎTES des groupes de nappes, lus sur les pans
 * servis (`pansDesNappes`, `./volume/toits.ts`), seule source de leur géométrie et de leurs gradients. Les côtés des
 * pans d'un groupe se coupent aux sommets du groupe (jonctions en T) ; un segment que portent deux pans de gradients
 * G1 et G2, n1 la normale en plan qui entre dans le premier, est SAILLANT si (G1 − G2)·n1 < 0, et un segment saillant
 * horizontal est un faîte. Un faîte qui borde une facette (un pan au gradient diagonal, champ de croupe) n'en reçoit
 * aucune. Chaque faîte est servi une fois, en TRONÇONS d'une case coupés aux bords des cases (`tronconsDuFaite`) : une
 * pièce de kit couvre une case et se raccorde bout à bout. Chaque tronçon se pose comme une arête (`AreteDessinee`,
 * `./aretes.ts`) : son milieu et son sens, sa cote, le gradient moyen de ses deux pans (le cisaillement de la pièce) et
 * la demi-différence de leurs pentes (l'ouverture du V de la pièce).
 */
import type { Pt } from './path';
import type { GP } from './volume/types';
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

/** Une faîtière telle qu'un hôte la pose : sa clé, la nappe dont elle tombe (`nappeKey`, levée par `toitsLeves`), les
 *  cases qu'elle couvre (sa vision), la couverture de sa nappe, la famille de son kit (`kit` de `materials.json`), sa
 *  pièce et sa place (`seule`), sa palette (`corps` : le `ridgeCap` de la couverture) ; et ce que sa pose demande comme
 *  une arête : son milieu et son sens (repère des cases centrées, en cases), sa cote (m) à ses deux bouts (`entree`,
 *  `sortie`) et au milieu (`pied`), le bloc de sa première case (`blocDeLaCase`), le gradient moyen de ses deux pans
 *  (`gradient`, m par case vers +x et +y) et la demi-différence de leurs pentes (`ecart`, m par case). */
export interface Faitiere {
  cle: string;
  nappe: string;
  cases: Required<Pt>[];
  couverture: string;
  famille: KitDeToit;
  piece: PieceDeToit;
  position: 'seule';
  palette: { corps: string };
  milieu: Pt;
  sens: Pt;
  pied: number;
  entree: number;
  sortie: number;
  bloc: string;
  gradient: Pt;
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

/** Les tronçons du faîte axial `a`→`b` (repère des cases centrées) : coupé à chaque bord de case (coordonnée
 *  demi-entière le long de son axe), chaque tronçon long d'une case, sauf à ses bouts ; un tronçon de bout plus court
 *  rejoint son voisin si la pièce qu'ils forment tient dans `TRONCON_MAX`, sinon il garde sa longueur. */
export function tronconsDuFaite(a: GP, b: GP): [GP, GP][] {
  const selonX = Math.abs(b.x - a.x) > EPS;
  const le = (p: GP) => (selonX ? p.x : p.y);
  const [lo, hi] = [Math.min(le(a), le(b)), Math.max(le(a), le(b))];
  const coupes = [lo];
  for (let t = Math.floor(lo + 0.5 + EPS) + 0.5; t < hi - EPS; t++) coupes.push(t);
  coupes.push(hi);
  if (coupes.length > 2 && coupes[1] - coupes[0] < 1 - EPS && coupes[2] - coupes[0] <= TRONCON_MAX + EPS) coupes.splice(1, 1);
  const n = coupes.length;
  if (n > 2 && coupes[n - 1] - coupes[n - 2] < 1 - EPS && coupes[n - 1] - coupes[n - 3] <= TRONCON_MAX + EPS) coupes.splice(n - 2, 1);
  const point = (t: number): GP => (selonX ? { x: t, y: a.y, h: a.h } : { x: a.x, y: t, h: a.h });
  return coupes.slice(1).map((t, i) => [point(coupes[i]), point(t)]);
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

/** Les faîtes des pans `pans` du groupe `groupId`, et le nombre de faîtes qui bordent une facette, sans faîtière. PUR. */
export function faitesDuGroupe(groupId: string, pans: readonly PanDuGroupe[]): { faitieres: Faitiere[]; surFacette: number } {
  const faitieres: Faitiere[] = [];
  let surFacette = 0;
  for (const [, { a, b, porteurs }] of segmentsDuGroupe(pans)) {
    if (porteurs.length !== 2 || Math.abs(b.h - a.h) > EPS) continue;
    const [o1, o2] = porteurs;
    const [p1, p2] = [pans[o1.i], pans[o2.i]];
    const ecart = Math.hypot(p1.gx - p2.gx, p1.gy - p2.gy) / 2;
    if (ecart < EPS || (p1.gx - p2.gx) * o1.nx + (p1.gy - p2.gy) * o1.ny >= -EPS) continue;
    if (facette(p1) || facette(p2)) { surFacette++; continue; }
    const def = roofMaterial(p1.couverture);
    if (!def.kit || !def.ridgeCap) continue;
    for (const [ta, tb] of tronconsDuFaite(a, b)) {
      const cases = casesDuSegment(ta, tb, p1.cells, p1.z);
      faitieres.push({
        cle: `faite|${groupId}|${cle3(ta)}|${cle3(tb)}`,
        nappe: p1.nappe,
        cases,
        couverture: p1.couverture,
        famille: def.kit,
        piece: 'faitiere',
        position: 'seule',
        palette: { corps: def.ridgeCap },
        milieu: { x: (ta.x + tb.x) / 2, y: (ta.y + tb.y) / 2 },
        sens: { x: tb.x - ta.x, y: tb.y - ta.y },
        pied: ta.h,
        entree: ta.h,
        sortie: tb.h,
        bloc: blocDeLaCase(cases[0]),
        gradient: { x: (p1.gx + p2.gx) / 2, y: (p1.gy + p2.gy) / 2 },
        ecart,
      });
    }
  }
  return { faitieres, surFacette };
}

/** Les faîtes de chaque groupe de nappes de `scene` (`faitesDuGroupe` sur les pans servis, `pansDesNappes`), et le
 *  nombre de faîtes qui bordent une facette. Retenus par scène et version des datasets (`memoByRef`). */
export const faitesDeLaScene = memoByRef((scene: SceneDesToits): { faitieres: Faitiere[]; surFacette: number } => {
  const pansParCle = pansDesNappes(scene);
  const groupes = new Map<string, PanDuGroupe[]>();
  for (const [cle, nappe] of resolveNappes(scene)) {
    const groupe = groupes.get(nappe.groupId) ?? groupes.set(nappe.groupId, []).get(nappe.groupId)!;
    for (const pan of pansParCle.get(cle)!)
      groupe.push({ poly: pan.face.poly, gx: pan.gx, gy: pan.gy, nappe: cle, cells: nappe.cells, z: nappe.mass.z, couverture: nappe.mass.material.id });
  }
  const parGroupe = [...groupes].map(([groupId, pans]) => faitesDuGroupe(groupId, pans));
  return { faitieres: parGroupe.flatMap((g) => g.faitieres), surFacette: parGroupe.reduce((n, g) => n + g.surFacette, 0) };
});

/** Les faîtières de `scene` (`faitesDeLaScene`). */
export const faitieresDeLaScene = (scene: SceneDesToits): Faitiere[] => faitesDeLaScene(scene).faitieres;

/** Les faîtières de la couche `z` de `scene` (`faitieresDeLaScene`). */
export const faitieresDeLaCouche = (scene: SceneDesToits, z: number): Faitiere[] => faitieresDeLaScene(scene).filter((f) => f.cases[0].z === z);
