/**
 * LES PIÈCES DE TOIT D'UNE SCÈNE TELLES QU'UN HÔTE LES POSE (#4471) : les FAÎTES, ARÊTIERS et NOUES des groupes de nappes,
 * lus sur les pans servis (`pansDesNappes`, `./volume/toits.ts`), seule source de leur géométrie et de leurs gradients.
 * Les côtés des pans d'un groupe se coupent aux sommets du groupe (jonctions en T) ; un segment que portent deux pans de
 * gradients G1 et G2, n1 la normale en plan qui entre dans le premier, est SAILLANT si (G1 − G2)·n1 < 0, RENTRANT s'il
 * est positif : un segment saillant horizontal est un faîte, saillant montant un arêtier, rentrant montant une noue.
 * Une arête qui borde une facette (un pan au gradient diagonal) n'en reçoit aucune, ni un tronçon dont un versant est
 * plus étroit que sa pose (`posable`). Le soffite d'une rive prolonge le plan de son pan au-delà du pignon, et son faîte
 * avec lui ; un arêtier se prolonge sur le débord vers le coin des deux soffites d'égout. À un NŒUD, chaque arête qui
 * y aboutit recule de ce dont sa pose y déborderait sur la voisine (`reculAuNoeud`). Chaque arête est servie en
 * TRONÇONS coupés aux bords des cases de son axe dominant (`tronconsDeLArete`) : une pièce de kit couvre une case et se
 * raccorde bout à bout. Chaque tronçon se pose comme une arête (`AreteDessinee`, `./aretes.ts`) : son milieu et son
 * sens, ses cotes, la demi-différence des pentes de ses deux pans (l'ouverture du V) et leur gradient moyen (son
 * cisaillement).
 */
import type { Pt } from './path';
import type { Face, GP } from './volume/types';
import { sceneMetresPerTile, type SceneDesToits } from './scene';
import { pansDesNappes, resolveNappes } from './volume/toits';
import { roofMaterial } from './volume/matieres';
import { blocDeLaCase } from './volume/volume';
import { memoByRef } from './sceneMemo';
import type { KitDeToit } from '../../data';
import { DEMI_LARGEUR_DE_POSE_M, type PIECES_DE_TOIT } from './piecesDArete';

/** La pièce qu'un segment de toit porte, l'une de `PIECES_DE_TOIT`. */
export type PieceDeToit = (typeof PIECES_DE_TOIT)[number];

/** Écart sous lequel deux cotes, deux gradients ou deux positions se confondent. */
const EPS = 1e-6;

/** Un tronçon de bout plus court qu'une case rejoint son voisin tant que la pièce qu'ils forment n'excède pas cette
 *  longueur, en cases : l'étirement d'une pièce reste borné à la moitié de sa longueur. */
const TRONCON_MAX = 1.5;

/**
 * @contrat Vue
 * Une pièce de toit telle qu'un hôte la pose (méthode `aretes`, `piecesDeToit`) : un tronçon d'un faîte, d'un arêtier ou
 * d'une noue, posé comme une arête.
 */
export interface PieceDeToitPosee {
  /** Sa clé : `<pièce>|<groupe de nappes>|<bout>|<bout>`. */
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
  /** Son sens, d'un bout à l'autre, en cases, en plan ; du bas vers le haut d'un arêtier ou d'une noue. */
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
  /** Le gradient moyen de ses deux pans (m par case, en plan) : le cisaillement de sa pièce, sa montée le long de son
   *  `sens` comme son travers. */
  gradient: Pt;
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

/** L'axe dominant d'une arête `a`→`b` en plan : celui que son tracé franchit le plus de fois. */
const axeDominant = (a: GP, b: GP): 'x' | 'y' => (Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? 'x' : 'y');

/** Le point de l'arête `a`→`b` à la coordonnée `t` de son axe dominant, sa cote comprise. */
function pointA(a: GP, b: GP, t: number): GP {
  const axe = axeDominant(a, b);
  const k = (t - a[axe]) / (b[axe] - a[axe]);
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, h: a.h + (b.h - a.h) * k };
}

/** Les tronçons de l'arête `a`→`b` (repère des cases centrées) dont les cases couvrent, le long de son axe dominant,
 *  l'étendue `couverte` : coupée à chaque bord de case de cet axe intérieur à cette étendue (coordonnée demi-entière),
 *  chaque tronçon traversant une case de cet axe, sauf à ses bouts, si bien que le débord d'une rive ou d'un égout va
 *  au tronçon de bout et que chaque tronçon traverse une case ; un tronçon de bout plus court qu'une case rejoint son
 *  voisin si la pièce qu'ils forment tient dans `TRONCON_MAX`, sinon il garde sa longueur. */
export function tronconsDeLArete(a: GP, b: GP, couverte: readonly [number, number]): [GP, GP][] {
  const axe = axeDominant(a, b);
  const [lo, hi] = [Math.min(a[axe], b[axe]), Math.max(a[axe], b[axe])];
  const coupes = [lo];
  for (let t = Math.floor(Math.max(lo, couverte[0]) + 0.5 + EPS) + 0.5; t < Math.min(hi, couverte[1]) - EPS; t++) coupes.push(t);
  coupes.push(hi);
  if (coupes.length > 2 && coupes[1] - coupes[0] < 1 - EPS && coupes[2] - coupes[0] <= TRONCON_MAX + EPS) coupes.splice(1, 1);
  const n = coupes.length;
  if (n > 2 && coupes[n - 1] - coupes[n - 2] < 1 - EPS && coupes[n - 1] - coupes[n - 3] <= TRONCON_MAX + EPS) coupes.splice(n - 2, 1);
  const enOrdre = a[axe] <= b[axe] ? coupes : [...coupes].reverse();
  return enOrdre.slice(1).map((t, i) => [pointA(a, b, enOrdre[i]), pointA(a, b, t)]);
}

/** L'étendue, le long de l'axe dominant de l'arête `a`→`b`, des cases de `cells` que traverse sa droite (repère des
 *  cases centrées), un simple coin touché ne comptant pas. */
function etendueCouverte(a: GP, b: GP, cells: ReadonlySet<string>): [number, number] {
  const axe = axeDominant(a, b);
  const autre = axe === 'x' ? 'y' : 'x';
  const pente = (b[autre] - a[autre]) / (b[axe] - a[axe]);
  const le = [Infinity, -Infinity] as [number, number];
  for (const cle of cells) {
    const [x, y] = cle.split(',').map(Number);
    const c = { x, y };
    // La droite traverse la case sur [t0, t1] de l'axe dominant : dans sa bande, et dans celle de l'autre axe.
    let t0 = c[axe] - 0.5, t1 = c[axe] + 0.5;
    if (Math.abs(pente) > EPS) {
      const u = (c[autre] - 0.5 - a[autre]) / pente + a[axe], v = (c[autre] + 0.5 - a[autre]) / pente + a[axe];
      t0 = Math.max(t0, Math.min(u, v)); t1 = Math.min(t1, Math.max(u, v));
    } else if (Math.abs(a[autre] - c[autre]) > 0.5 + EPS) continue;
    if (t1 - t0 <= EPS) continue;
    le[0] = Math.min(le[0], t0);
    le[1] = Math.max(le[1], t1);
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
 *  (`nappeKey`), les cases et la couche de sa masse, sa couverture, la cote de son égout (m) et son débord (cases). */
export interface PanDuGroupe {
  poly: readonly GP[];
  gx: number;
  gy: number;
  nappe: string;
  cells: ReadonlySet<string>;
  z: number;
  couverture: string;
  egout: number;
  debord: number;
}

/** Une arête de toit droite d'un groupe, avant sa coupe en tronçons : sa pièce (aucune pour une noue horizontale, qui
 *  ne borne que les nœuds), le pan qui la nomme, ses deux versants, son écart et son gradient moyen, ses bouts (du bas
 *  vers le haut d'un arêtier ou d'une noue). */
interface ArreteDeToit { piece: PieceDeToit | null; pan: PanDuGroupe; versants: [PanDuGroupe, PanDuGroupe]; ecart: number; gradient: Pt; a: GP; b: GP }

/** Les arêtes droites des pans `pans` d'un groupe : les segments atomiques saillants ou rentrants que portent deux pans
 *  (`segmentsDuGroupe`), un faîte (saillant horizontal), un arêtier (saillant montant), une noue (rentrante montante)
 *  ou une noue horizontale (rentrante horizontale, sans pièce, qui ne borne que les nœuds), bout à bout sur une même droite, d'une même pièce, d'une même nappe et d'un même écart, ne faisant qu'une arête : le
 *  débord d'une rive prolonge celui de son pan. */
function aretesDuGroupe(pans: readonly PanDuGroupe[]): ArreteDeToit[] {
  const droites = new Map<string, { arete: ArreteDeToit; lo: number; hi: number }[]>();
  for (const [, { a, b, porteurs }] of segmentsDuGroupe(pans)) {
    if (porteurs.length !== 2) continue;
    const [o1, o2] = porteurs;
    const [p1, p2] = [pans[o1.i], pans[o2.i]];
    const ecart = Math.hypot(p1.gx - p2.gx, p1.gy - p2.gy) / 2;
    if (ecart < EPS || facette(p1) || facette(p2)) continue;
    const saillant = (p1.gx - p2.gx) * o1.nx + (p1.gy - p2.gy) * o1.ny < -EPS;
    const montant = Math.abs(b.h - a.h) > EPS;
    const piece: PieceDeToit | null = !montant ? (saillant ? 'faitiere' : null) : saillant ? 'aretier' : 'noue';
    // Une droite : sa direction (du bas vers le haut ; pour un faîte, l'axe qu'il suit), son décalage en plan et sa
    // cote à l'origine de l'axe ; ses bouts dans le sens de sa direction.
    const [m0, m1] = montant && a.h > b.h ? [b, a] : [a, b];
    const L0 = Math.hypot(m1.x - m0.x, m1.y - m0.y);
    const [dx, dy] = montant ? [(m1.x - m0.x) / L0, (m1.y - m0.y) / L0] : Math.abs(m1.x - m0.x) >= Math.abs(m1.y - m0.y) ? [1, 0] : [0, 1];
    const t = (p: GP) => p.x * dx + p.y * dy;
    const [bas, haut] = t(m0) <= t(m1) ? [m0, m1] : [m1, m0];
    const L = Math.hypot(haut.x - bas.x, haut.y - bas.y);
    const pente = (haut.h - bas.h) / L;
    const droite = `${piece}|${p1.nappe}|${ecart.toFixed(6)}|${dx.toFixed(5)},${dy.toFixed(5)}|${(bas.x * dy - bas.y * dx).toFixed(5)}|${(bas.h - pente * t(bas)).toFixed(4)}`;
    const arete: ArreteDeToit = { piece, pan: p1, versants: [p1, p2], ecart, gradient: { x: (p1.gx + p2.gx) / 2, y: (p1.gy + p2.gy) / 2 }, a: bas, b: haut };
    (droites.get(droite) ?? droites.set(droite, []).get(droite)!).push({ arete, lo: Math.min(t(bas), t(haut)), hi: Math.max(t(bas), t(haut)) });
  }
  const aretes: ArreteDeToit[] = [];
  for (const segments of droites.values()) {
    segments.sort((p, q) => p.lo - q.lo);
    let cur = { ...segments[0].arete };
    let hi = segments[0].hi;
    for (const s of segments.slice(1)) {
      if (s.lo <= hi + EPS) {
        const loin = (p: GP) => p.x * (cur.b.x - cur.a.x) + p.y * (cur.b.y - cur.a.y);
        for (const p of [s.arete.a, s.arete.b]) if (loin(p) > loin(cur.b)) cur = { ...cur, b: p };
        hi = Math.max(hi, s.hi);
      } else { aretes.push(cur); cur = { ...s.arete }; hi = s.hi; }
    }
    aretes.push(cur);
  }
  return aretes;
}

/** Le bas d'un arêtier né à l'égout, prolongé sur le débord vers le coin des deux soffites d'égout qui s'y croisent :
 *  le long de sa droite, jusqu'à ce que son axe dominant ait franchi le débord de son pan, moins le recul que ce coin
 *  impose à une pose large de `demi` (cases) de chaque côté (`reculAuNoeud`, à l'angle que l'arêtier fait avec les rives
 *  du débord). */
function prolongeSurLeDebord(arete: ArreteDeToit, demi: number): ArreteDeToit {
  const { a, b, pan } = arete;
  if (arete.piece !== 'aretier' || Math.abs(a.h - pan.egout) > 1e-4 || pan.debord <= EPS) return arete;
  const L = Math.hypot(b.x - a.x, b.y - a.y);
  const ux = (b.x - a.x) / L, uy = (b.y - a.y) / L;
  const [petit, grand] = [Math.min(Math.abs(ux), Math.abs(uy)), Math.max(Math.abs(ux), Math.abs(uy))];
  const k = pan.debord / grand - reculAuNoeud(Math.atan2(petit, grand), demi);
  return { ...arete, a: { x: a.x - ux * k, y: a.y - uy * k, h: a.h - ((b.h - a.h) / L) * k } };
}

/** Le recul (cases, en plan) d'une arête à un nœud, quand elle y fait l'angle `angle` (radians, en plan) avec la plus
 *  proche des lignes de toit qui y aboutissent : ce dont sa pose, large de `demi` de chaque côté, y déborderait sur le
 *  pan de la voisine ; nul passé l'angle droit. */
export const reculAuNoeud = (angle: number, demi: number): number => (angle >= Math.PI / 2 - EPS ? 0 : demi / Math.tan(angle));

/** Les arêtes `aretes` coupées et reculées à leurs NŒUDS, les points où une arête rencontre une autre ligne de toit (son
 *  bout, ou un point de son tracé, qui s'y coupe) : chaque bout qui touche un nœud recule de `reculAuNoeud`, à l'angle
 *  que sa direction y fait avec la plus proche des autres, pour une pose large de `demi` (cases) de chaque côté. Un bout
 *  libre (une rive, un égout) ne recule pas ; une arête que ses reculs mangent disparaît. */
function reculeesAuxNoeuds(aretes: readonly ArreteDeToit[], demi: number): ArreteDeToit[] {
  const memePoint = (p: GP, q: GP) => Math.hypot(p.x - q.x, p.y - q.y) < 1e-4;
  const sur = (p: GP, r: ArreteDeToit) => {
    const L = Math.hypot(r.b.x - r.a.x, r.b.y - r.a.y);
    const t = ((p.x - r.a.x) * (r.b.x - r.a.x) + (p.y - r.a.y) * (r.b.y - r.a.y)) / (L * L);
    return t > EPS && t < 1 - EPS && Math.abs((p.x - r.a.x) * (r.b.y - r.a.y) - (p.y - r.a.y) * (r.b.x - r.a.x)) / L < 1e-4;
  };
  // Les arêtes coupées à chaque point d'une autre qui tombe sur leur tracé.
  let coupees: ArreteDeToit[] = [...aretes];
  for (const autre of aretes)
    for (const p of [autre.a, autre.b])
      coupees = coupees.flatMap((r) => {
        if (!sur(p, r)) return [r];
        const L = Math.hypot(r.b.x - r.a.x, r.b.y - r.a.y);
        const k = Math.hypot(p.x - r.a.x, p.y - r.a.y) / L;
        const m = { x: p.x, y: p.y, h: r.a.h + (r.b.h - r.a.h) * k };
        return [{ ...r, b: m }, { ...r, a: m }];
      });
  // Les directions (en plan, depuis le nœud) de chaque ligne qui part de chaque point.
  const directions = (p: GP) => coupees.flatMap((r) => [[r.a, r.b], [r.b, r.a]].filter(([d]) => memePoint(d, p))
    .map(([d, f]) => { const L = Math.hypot(f.x - d.x, f.y - d.y); return { x: (f.x - d.x) / L, y: (f.y - d.y) / L }; }));
  const recul = (bout: GP, autreBout: GP) => {
    const L = Math.hypot(autreBout.x - bout.x, autreBout.y - bout.y);
    const u = { x: (autreBout.x - bout.x) / L, y: (autreBout.y - bout.y) / L };
    const autres = directions(bout).filter((d) => Math.abs(d.x - u.x) > 1e-6 || Math.abs(d.y - u.y) > 1e-6);
    if (!autres.length) return 0;
    const angle = Math.min(...autres.map((d) => Math.acos(Math.max(-1, Math.min(1, d.x * u.x + d.y * u.y)))));
    return reculAuNoeud(angle, demi);
  };
  return coupees.flatMap((r) => {
    const L = Math.hypot(r.b.x - r.a.x, r.b.y - r.a.y);
    const [ra, rb] = [recul(r.a, r.b), recul(r.b, r.a)];
    if (ra + rb >= L - EPS) return [];
    const en = (k: number): GP => ({ x: r.a.x + (r.b.x - r.a.x) * k, y: r.a.y + (r.b.y - r.a.y) * k, h: r.a.h + (r.b.h - r.a.h) * k });
    return [{ ...r, a: en(ra / L), b: en(1 - rb / L) }];
  });
}

/** Les pièces de toit des pans `pans` du groupe `groupId`, à `metresParCase` mètres par case : ses arêtes
 *  (`aretesDuGroupe`), l'arêtier prolongé sur le débord, reculées à leurs nœuds pour la pose large de
 *  `DEMI_LARGEUR_DE_POSE_M`, puis en tronçons (`tronconsDeLArete`). PUR. */
export function piecesDuGroupe(groupId: string, pans: readonly PanDuGroupe[], metresParCase: number): PieceDeToitPosee[] {
  const demi = DEMI_LARGEUR_DE_POSE_M / metresParCase;
  const aretes = reculeesAuxNoeuds(aretesDuGroupe(pans).map((a) => prolongeSurLeDebord(a, demi)), demi);
  return aretes.flatMap(({ piece, pan, versants, ecart, gradient, a, b }) => {
    const def = roofMaterial(pan.couverture);
    if (!piece || !def.kit || !def.ridgeCap) return [];
    const { kit, ridgeCap } = def;
    return tronconsDeLArete(a, b, etendueCouverte(a, b, pan.cells)).filter(([ta, tb]) => posable(pans, versants, ta, tb, demi)).map(([ta, tb]): PieceDeToitPosee => {
      const cases = casesDuSegment(ta, tb, pan.cells, pan.z);
      return {
        cle: `${piece}|${groupId}|${cle3(ta)}|${cle3(tb)}`,
        nappe: pan.nappe,
        cases,
        couverture: pan.couverture,
        famille: kit,
        piece,
        position: 'seule',
        palette: { corps: ridgeCap },
        milieu: { x: (ta.x + tb.x) / 2, y: (ta.y + tb.y) / 2 },
        sens: { x: tb.x - ta.x, y: tb.y - ta.y },
        pied: (ta.h + tb.h) / 2,
        entree: ta.h,
        sortie: tb.h,
        bloc: blocDeLaCase(cases[0]),
        ecart,
        gradient,
      };
    });
  });
}

/** La pièce d'un tronçon `ta`→`tb` est posable : en l'un de ses bouts ou en son milieu, à `demi` (cases, la demi-largeur
 *  de pose `DEMI_LARGEUR_DE_POSE_M` convertie) de part et d'autre du faîte, l'un des pans les plus hauts des pans `pans` du groupe doit être l'un des `versants` du faîte (même
 *  plan). Sinon un autre pan passe au-dessus de la pose sur toute sa longueur, là où les versants se resserrent (le faîte
 *  d'une enveloppe qui rejoint la croupe commune) ; un croisement de faîtes ne la retire pas. */
function posable(pans: readonly PanDuGroupe[], versants: readonly [PanDuGroupe, PanDuGroupe], ta: GP, tb: GP, demi: number): boolean {
  const m = { x: (ta.x + tb.x) / 2, y: (ta.y + tb.y) / 2 };
  const l = Math.hypot(tb.x - ta.x, tb.y - ta.y);
  const n = { x: -(tb.y - ta.y) / l, y: (tb.x - ta.x) / l };
  const plan = (p: PanDuGroupe, q: Pt) => p.poly[0].h + p.gx * (q.x - p.poly[0].x) + p.gy * (q.y - p.poly[0].y);
  const memePlan = (p: PanDuGroupe, v: PanDuGroupe) => Math.abs(p.gx - v.gx) < EPS && Math.abs(p.gy - v.gy) < EPS && Math.abs(plan(p, m) - plan(v, m)) < EPS;
  return [ta, m, tb].some((o) => [-1, 1].every((cote) => {
    const q = { x: o.x + cote * demi * n.x, y: o.y + cote * demi * n.y };
    const sous = pans.filter((p) => dansLePan(p.poly, q));
    const haut = Math.max(...sous.map((p) => plan(p, q)));
    return sous.some((p) => plan(p, q) > haut - EPS && versants.some((v) => memePlan(p, v)));
  }));
}

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

/** Les pièces de toit de chaque groupe de nappes de `scene` (`piecesDuGroupe`), lues sur les pans servis
 *  (`pansDesNappes`), chacun avec les soffites de ses rives, qui prolongent son plan au-delà du pignon. Retenues par scène
 *  et version des datasets (`memoByRef`). */
export const piecesDeToitDeLaScene = memoByRef((scene: SceneDesToits): PieceDeToitPosee[] => {
  const pansParCle = pansDesNappes(scene);
  const metresParCase = sceneMetresPerTile(scene);
  const groupes = new Map<string, PanDuGroupe[]>();
  for (const [cle, nappe] of resolveNappes(scene)) {
    const groupe = groupes.get(nappe.groupId) ?? groupes.set(nappe.groupId, []).get(nappe.groupId)!;
    const couverture = nappe.mass.material.id;
    const debord = (roofMaterial(couverture).eaveOverhangM ?? 0) / metresParCase;
    for (const pan of pansParCle.get(cle)!)
      for (const face of [pan.face, ...pan.faces.filter(soffiteDeRive)])
        groupe.push({ poly: face.poly, gx: pan.gx, gy: pan.gy, nappe: cle, cells: nappe.cells, z: nappe.mass.z, couverture, egout: nappe.field.shape.eaveHeightM, debord });
  }
  return [...groupes].flatMap(([groupId, pans]) => piecesDuGroupe(groupId, pans, metresParCase));
});
