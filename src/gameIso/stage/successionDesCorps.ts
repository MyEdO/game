/**
 * SUCCESSION DES CORPS (#1396, #2097, design n°11) — fonction PURE, sans React : ce que la passe de
 * montage de `GameStage3D` montre, tient en sursis et libère, rejouée après CHAQUE évènement (passe,
 * montage d'un sujet, rejet de sa cuisson). Instance, par composante d'occupants, du double tampon de
 * `choisirFrame` : la configuration précédente reste à l'écran tant que la suivante n'est pas cuite.
 *
 * Invariants (banc exhaustif `successionDesCorps.test.ts`) :
 *  - I1 : au plus un board visible par occupant.
 *  - I2 : un occupant visible avant un évènement, et couvert après lui par un sujet voulu (monté ou en
 *    attente), reste visible. Exception : `memeBase` faux.
 *  - I3 (repos) : aucune attente ⇒ aucun sursis, et les boards montés sont exactement les entrants,
 *    tous visibles.
 *  - I4 : tout board en sursis appartient à la configuration précédente d'une composante qui a au moins
 *    un sujet en attente, et couvre au moins un occupant montrable (couvert par un entrant ou un sujet
 *    en attente).
 *  - I5 : un entrant est visible dès que sa composante n'a aucun sujet en attente.
 */
import type { BillboardSubject } from '../backends/webgl/sceneMeshes';

/** Ce que la succession lit d'un sujet : son identité et les êtres qu'il couvre. */
export type SujetDeSuccession = Pick<BillboardSubject, 'identity' | 'cid' | 'cavalier' | 'eid'>;

/** Id ESPACÉ de l'occupant d'un combattant (cavalier compris). */
export const occupantCombattant = (cid: string): string => `c:${cid}`;

/** Occupants d'un sujet, en ids espacés : `c:<cid>` (combattant, cavalier) et `e:<eid>` (figurant).
 *  Vide pour un décor. */
export function occupantsDe(sub: Pick<BillboardSubject, 'cid' | 'cavalier' | 'eid'>): string[] {
  const occ: string[] = [];
  if (sub.cid !== undefined) occ.push(occupantCombattant(sub.cid));
  if (sub.cavalier !== undefined) occ.push(occupantCombattant(sub.cavalier));
  if (sub.eid !== undefined) occ.push(`e:${sub.eid}`);
  return occ;
}

export interface EtatDeSuccession<S extends SujetDeSuccession, B extends { sub: S }> {
  /** Boards montés. */
  boards: readonly B[];
  /** Sujets voulus, par identité. */
  voulus: ReadonlyMap<string, S>;
  /** Sujets voulus ni montés ni rejetés. */
  attente: readonly S[];
  /** La base de montage n'a pas changé. */
  memeBase: boolean;
  /** Boards visibles AVANT l'évènement. */
  configurationPrécédente: ReadonlySet<B>;
}

export interface Succession<B> {
  visibles: Set<B>;
  /** Sortants de la configuration précédente d'une composante qui attend encore. */
  sursis: Set<B>;
  libérés: B[];
}

/**
 * Deux occupants sont reliés par un board ENTRANT ou de la configuration précédente qui les couvre
 * tous deux, ou par un sujet en attente. Par composante : si elle attend, sa configuration précédente
 * reste visible (ses sortants en sursis), un entrant ne se montre que s'il ne croise aucun de ses
 * boards, les autres sortants sont libérés ; sinon elle SUCCÈDE — entrants visibles, sortants libérés.
 */
export function succession<S extends SujetDeSuccession, B extends { sub: S }>(e: EtatDeSuccession<S, B>): Succession<B> {
  const visibles = new Set<B>();
  const sursis = new Set<B>();
  if (!e.memeBase) return { visibles, sursis, libérés: [...e.boards] };

  const parent = new Map<string, string>();
  const racine = (x: string): string => {
    let r = x;
    while (parent.has(r) && parent.get(r) !== r) r = parent.get(r)!;
    parent.set(x, r);
    return r;
  };
  const relier = (ids: readonly string[]): void => {
    for (const id of ids) if (!parent.has(id)) parent.set(id, id);
    for (let i = 1; i < ids.length; i++) parent.set(racine(ids[i]), racine(ids[0]));
  };
  const entrant = (b: B): boolean => e.voulus.has(b.sub.identity);
  for (const b of e.boards) if (entrant(b) || e.configurationPrécédente.has(b)) relier(occupantsDe(b.sub));
  for (const s of e.attente) relier(occupantsDe(s));
  const composante = (sub: S): string | undefined => {
    const occ = occupantsDe(sub);
    return occ.length ? racine(occ[0]) : undefined;
  };
  const enAttente = new Set(e.attente.map(composante).filter((k): k is string => k !== undefined));
  const précédents = e.boards.filter((b) => e.configurationPrécédente.has(b));

  const libérés: B[] = [];
  for (const b of e.boards) {
    const k = composante(b.sub);
    if (k === undefined || !enAttente.has(k)) {
      if (entrant(b)) visibles.add(b);
      else libérés.push(b);
      continue;
    }
    if (e.configurationPrécédente.has(b)) {
      visibles.add(b);
      if (!entrant(b)) sursis.add(b);
      continue;
    }
    if (!entrant(b)) {
      libérés.push(b);
      continue;
    }
    const occ = occupantsDe(b.sub);
    if (!précédents.some((p) => occupantsDe(p.sub).some((o) => occ.includes(o)))) visibles.add(b);
  }
  return { visibles, sursis, libérés };
}
