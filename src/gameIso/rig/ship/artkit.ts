/**
 * Boîte à outils PARTAGÉE des arts de COQUE (vague A1 du front art naval — réf planche MDG 12 p.098 :
 * Knarr / Langskip / Loup impérial / Croiseur). Un art de coque = 1 fichier `ship/defs/<id>.ts`
 * (registre auto-chargé par `scripts/gen-registry.mjs`, MÊME pattern que les engins de siège) —
 * routé par l'ID de véhicule (`vehicles.json`), le repli procédural par gréement reste dans
 * `composeShip`. Coords LOCALES : origine = quille au centre (y=0 = flottaison/contact case),
 * le navire monte en y NÉGATIF, la PROUE regarde à DROITE (le profil gauche s'obtient par MIROIR
 * dans la machinerie, jamais dans l'art). Jetons palette CONSERVÉS (recoloration Compendium) :
 * `@coque` (bois de carène), `@toileDeVoile` (voiles), `@mat` (espars/rames), `@pavillon` (flammes/
 * emblèmes) + nuances O/H dérivées par `buildTokenMap`.
 */
import type { ViewArt } from '../viewArt';

/** Def d'ART de coque = id de VÉHICULE (`vehicles.json`, `hull` présent) + art ORIENTÉ (contrat
 *  PARTAGÉ `ViewArt`). Vague A1 : `profile` (broadside, lecture navale canonique) ; front/back
 *  viendront par vagues — la couverture réelle est DÉCLARÉE (galerie QC : cases « repli »). */
export interface ShipArtDef extends ViewArt {
  id: string;
}

const n = (v: number): string => (Math.round(v * 10) / 10).toString();

/** Espar rectiligne (mât, vergue, beaupré, gouverne). */
export const spar = (x1: number, y1: number, x2: number, y2: number, w = 2.2): string =>
  `<path d="M${n(x1)} ${n(y1)} L${n(x2)} ${n(y2)}" stroke="@mat" stroke-width="${w}" stroke-linecap="round"/>`;

/** Étai/hauban (gréement dormant, trait fin sombre). */
export const stay = (x1: number, y1: number, x2: number, y2: number): string =>
  `<path d="M${n(x1)} ${n(y1)} L${n(x2)} ${n(y2)}" stroke="@matO" stroke-width="0.7" opacity="0.85" fill="none"/>`;

/** Flamme de tête de mât, flottant vers l'ARRIÈRE (gauche — la proue regarde à droite). */
export const pennant = (x: number, y: number, len = 9): string =>
  `<path d="M${n(x)} ${n(y)} l${n(-len)} 1.6 l${n(len)} 2.8 Z" fill="@pavillon"/>`;

/** Pavillon rectangulaire sur sa hampe (châteaux, tête de mât d'apparat). */
export const flag = (x: number, y: number, w = 8, h = 5): string =>
  spar(x, y, x, y - h - 4, 1)
  + `<path d="M${n(x)} ${n(y - h - 4)} l${n(-w)} 0.6 l0 ${n(h - 1.2)} l${n(w)} 0.6 Z" fill="@pavillon"/>`;

/** Voile CARRÉE gonflée sous sa vergue (vent portant → ventre vers la proue, à droite).
 *  `seams` = coutures verticales, `reefs` = bandes de ris horizontales (accents @toileDeVoileO). */
export function squareSail(cx: number, yTop: number, h: number, hw: number, opts: { seams?: number; reefs?: number } = {}): string {
  const yB = yTop + h;
  let s = spar(cx - hw - 2, yTop, cx + hw + 2, yTop, 1.8);
  s += `<path d="M${n(cx - hw)} ${n(yTop + 1)} Q${n(cx - hw + h * 0.16)} ${n(yTop + h * 0.55)} ${n(cx - hw * 0.82)} ${n(yB)}`
    + ` L${n(cx + hw * 0.9)} ${n(yB)} Q${n(cx + hw + h * 0.24)} ${n(yTop + h * 0.5)} ${n(cx + hw)} ${n(yTop + 1)} Z"`
    + ` fill="@toileDeVoile" stroke="@toileDeVoileO" stroke-width="1"/>`;
  const seams = opts.seams ?? 0;
  for (let i = 1; i <= seams; i++) {
    const x = cx - hw + (2 * hw * i) / (seams + 1);
    s += `<path d="M${n(x)} ${n(yTop + 1.5)} Q${n(x + h * 0.13)} ${n(yTop + h * 0.55)} ${n(x)} ${n(yB - 1)}" stroke="@toileDeVoileO" stroke-width="0.7" opacity="0.4" fill="none"/>`;
  }
  const reefs = opts.reefs ?? 0;
  for (let j = 1; j <= reefs; j++) {
    const y = yTop + (h * j) / (reefs + 1);
    s += `<path d="M${n(cx - hw * 0.92)} ${n(y)} Q${n(cx)} ${n(y + 2)} ${n(cx + hw * 0.95)} ${n(y)}" stroke="@toileDeVoileO" stroke-width="0.7" opacity="0.35" fill="none"/>`;
  }
  return s;
}

/** Voile LATINE : antenne du point d'amure (`tack`, bas) à la tête (`peak`, haut), triangle jusqu'au
 *  point d'écoute (`clew`) ; la chute est bombée par `bulge` [dx,dy] (offset du contrôle de courbe). */
export function lateenSail(peak: [number, number], tack: [number, number], clew: [number, number], bulge: [number, number] = [-4, 4]): string {
  const [px, py] = peak, [tx, ty] = tack, [cx, cy] = clew;
  const mx = (px + cx) / 2 + bulge[0], my = (py + cy) / 2 + bulge[1];
  return spar(px, py, tx, ty, 1.8)
    + `<path d="M${n(px)} ${n(py)} L${n(tx)} ${n(ty)} L${n(cx)} ${n(cy)} Q${n(mx)} ${n(my)} ${n(px)} ${n(py)} Z" fill="@toileDeVoile" stroke="@toileDeVoileO" stroke-width="1"/>`;
}

/** Voile de JONQUE lattée en éventail (plus large en tête), lattes horizontales @matO. */
export function junkSail(cx: number, yTop: number, h: number, hwTop: number, hwBot: number, battens = 4): string {
  const yB = yTop + h;
  let s = spar(cx - hwTop - 2, yTop + 1, cx + hwTop + 2, yTop, 1.6);
  s += `<path d="M${n(cx - hwTop)} ${n(yTop + 1)} L${n(cx + hwTop)} ${n(yTop)} L${n(cx + hwBot)} ${n(yB)} L${n(cx - hwBot)} ${n(yB - 1.5)} Z" fill="@toileDeVoile" stroke="@toileDeVoileO" stroke-width="1"/>`;
  for (let i = 1; i <= battens; i++) {
    const t = i / (battens + 1);
    const y = yTop + h * t;
    const hwi = hwTop + (hwBot - hwTop) * t;
    s += `<path d="M${n(cx - hwi)} ${n(y - 1)} L${n(cx + hwi)} ${n(y - 1.5)}" stroke="@matO" stroke-width="0.9" opacity="0.7"/>`;
  }
  return s;
}

/** Rang d'AVIRONS régulier, du plat-bord (`yThole`) à l'eau (y=+1), inclinés vers l'arrière. */
export function oarBank(x0: number, x1: number, count: number, yThole: number, sweep = 5): string {
  let lines = '';
  for (let i = 0; i < count; i++) {
    const x = count > 1 ? x0 + (i * (x1 - x0)) / (count - 1) : x0;
    lines += `<line x1="${n(x)}" y1="${n(yThole)}" x2="${n(x - sweep)}" y2="1"/>`;
  }
  return `<g stroke="@mat" stroke-width="1.3" stroke-linecap="round">${lines}</g>`;
}

/** Rangée de PAVOIS (boucliers ronds sur le plat-bord — langskip, patrouille norse). */
export function shieldRow(x0: number, x1: number, count: number, y: number, r = 2.6): string {
  let s = '';
  for (let i = 0; i < count; i++) {
    const x = x0 + (i * (x1 - x0)) / (count - 1);
    s += `<circle cx="${n(x)}" cy="${n(y)}" r="${r}" fill="${i % 2 ? '@toileDeVoileO' : '@pavillon'}" stroke="@coqueO" stroke-width="0.8"/>`;
  }
  return s;
}

/** CHÂTEAU crénelé (gaillard de cogue/caraque, plateforme militaire). */
export function castle(x0: number, x1: number, yTop: number, yBot: number, teeth = 4): string {
  const tw = (x1 - x0) / (teeth * 2 - 1);
  const th = 2.6;
  let d = `M${n(x0)} ${n(yBot)} L${n(x0)} ${n(yTop)}`;
  for (let i = 0; i < teeth * 2 - 1; i++) {
    const xa = x0 + i * tw, xb = x0 + (i + 1) * tw;
    const y = i % 2 ? yTop + th : yTop;
    d += ` L${n(xa)} ${n(y)} L${n(xb)} ${n(y)}`;
  }
  d += ` L${n(x1)} ${n(yBot)} Z`;
  return `<path d="${d}" fill="@coque" stroke="@coqueO" stroke-width="1.1"/>`
    + `<path d="M${n(x0 + 1.5)} ${n(yTop + th + 2.5)} L${n(x1 - 1.5)} ${n(yTop + th + 2.5)}" stroke="@coqueO" stroke-width="0.8" opacity="0.5"/>`;
}

/** Rangée de SABORDS (navires de guerre à hauts-bords). */
export function gunports(x0: number, x1: number, count: number, y: number, s = 2.8): string {
  let out = '';
  for (let i = 0; i < count; i++) {
    const x = x0 + (i * (x1 - x0)) / (count - 1);
    out += `<rect x="${n(x - s / 2)}" y="${n(y - s / 2)}" width="${s}" height="${s}" fill="@matO" opacity="0.9"/>`;
  }
  return out;
}

/** HUNE (nid-de-pie) accrochée au mât. */
export const hune = (x: number, y: number): string =>
  `<path d="M${n(x - 3.5)} ${n(y)} h7 l-1.2 4.6 h-4.6 Z" fill="@mat" stroke="@matO" stroke-width="0.8"/>`;

/** TIMON de barge (longue godille de gouverne plongeant à l'arrière). */
export const timon = (x: number, y: number): string =>
  spar(x, y, x - 13, 1, 2) + `<path d="M${n(x - 13)} 1 l-5 -1.8 l1.6 4.4 Z" fill="@mat"/>`;

/** SAFRAN d'étambot (gouvernail de poupe accroché à l'arrière, x = étambot). */
export const rudder = (x: number, yTop: number): string =>
  `<path d="M${n(x)} ${n(yTop)} L${n(x - 4)} ${n(yTop + 1.5)} L${n(x - 3.2)} -0.5 L${n(x)} -0.5 Z" fill="@coque" stroke="@coqueO" stroke-width="1"/>`;
