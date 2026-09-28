import { gammeDe } from '../../../data/palette.types';
import type { PartArt, ViewSet } from './types';
import { declaredView } from '../viewArt';
import { tokensOf } from '../palette';

/**
 * DÉRIVATION des vues absentes d'un slot de CORPS (tete/torse/jambes/bras). Un def qui ne fournit que
 * le FRONT (string, ou objet sans `profile`/`back`) obtient ici une silhouette de PROFIL et de DOS
 * dérivée du front — jamais l'art de face plaqué. Les helpers peignent en JETONS (`@vet1`/`@cuir`…)
 * dérivés du tissu dominant du front → ils SUIVENT le recoloriage de carrière, cohérents pour TOUTE
 * tenue sans art dédié. Un def qui déclare ses vraies vues les garde (`toViewSet` ne dérive que l'absent).
 *
 * La résolution (`resolve.ts`) reste une pure table de priorité sur des `ViewSet` totaux : aucune
 * génération de silhouette n'y vit. Le corps de base est garanti crâne+cou (D4, #633) ; le
 * membre supérieur (D1, #633) se résout en UNITÉ dans `resolve.ts` : un art `bras` pleine longueur
 * (épaule→poignet) est DÉCOUPÉ au coude (`splitBrasSvg`) — `bras` = épaule→coude, `avantBras` =
 * coude→poignet, ce dernier posé sur une sous-couche de MATIÈRE (`avantBrasBase`, cf. `rig/PART-CONTRACT.md`).
 */

// --- Profil : silhouettes de CÔTÉ du corps (le pantin est de face ; de profil le torse/les jambes
// sont plus étroits et le buste légèrement avancé). Le jeton de tissu dominant est déduit du fragment
// FRONT (cf. `dominantCloth`). Une tenue qui fournit `profile` prime (`toViewSet` ne dérive que l'absent).
const PROFILE_TORSE = (t: string) =>
  // buste de côté (poitrine avancée +x) avec reflet avant + ombre dorsale, en jeton de tissu.
  `<path d="M-5 -28 Q3 -31 7 -26 Q8.5 -10 6 4 L5 33 Q-1 37 -6 33 L-5 4 Q-7 -13 -5 -28 Z" fill="@${t}" stroke="@${gammeDe(t, 'ombre')}" stroke-width="0.6"/>` +
  `<path d="M3 -27 Q6 -10 4.6 4 L4 30" fill="none" stroke="@${gammeDe(t, 'lumiere')}" stroke-width="0.8" opacity="0.5"/>` +
  `<path d="M-5 -2 Q-7 -13 -5 -28 Q-3 -30 -1 -29 L-1 4 Z" fill="@${gammeDe(t, 'ombre')}" opacity="0.5"/>`;
const PROFILE_JAMBE = (t: string, boot = 'cuir') =>
  // jambe de côté (jeton de tissu) + genou (renflement ~y22) + botte (bas, @boot) qui pointe
  // vers l'avant. Le jeton de botte est `cuir` pour les habillés, `peau` pour les nus.
  `<path d="M-3.2 0 Q-4 18 -2.6 30 L-2.6 30 Q-4 40 -2.4 49 L3.4 49 Q4 24 3.2 0 Z" fill="@${t}" stroke="@${gammeDe(t, 'ombre')}" stroke-width="0.5"/>` +
  `<path d="M-3.6 18 Q-5 22 -2.8 26 Q2.4 27 4.2 23 Q4.8 19 2.8 16 Q0 17 -3.6 18 Z" fill="@${gammeDe(t, 'lumiere')}" stroke="@${gammeDe(t, 'ombre')}" stroke-width="0.5" opacity="0.85"/>` +
  `<path d="M-3 32 Q-3.9 42 -2.4 49 L4.2 49 Q4.6 46 4 42 L3.7 32 Q0 34 -3 32 Z" fill="@${boot}" stroke="@${gammeDe(boot, 'ombre')}" stroke-width="0.5"/>` +
  `<path d="M3.7 34 L7.8 34 Q9 38 7.6 41 L4 41Z" fill="@${boot}" stroke="@${gammeDe(boot, 'ombre')}" stroke-width="0.4"/>`; // bout de la botte (+x)
// --- Dos : silhouettes de DOS génériques (même principe que le profil) — sans art `back` dédié, la
// tenue montrerait son art de FACE plaqué dans le dos (lacets, boucles, emblèmes). Jetons du tissu
// dominant → suivent le recoloriage de carrière.
const BACK_TORSE = (t: string) =>
  `<path d="M-8.5 -27 Q0 -30 8.5 -27 L9 4 Q8 16 5 33 Q0 36 -5 33 Q-8 16 -9 4 Z" fill="@${t}" stroke="@${gammeDe(t, 'ombre')}" stroke-width="0.6"/>` +
  `<path d="M0 -27 L0 33" stroke="@${gammeDe(t, 'ombre')}" stroke-width="0.7" opacity="0.55"/>` + // couture (habillé) / colonne (nu)
  `<path d="M-8.5 -24 Q0 -27 8.5 -24 L8.5 -19 Q0 -22 -8.5 -19 Z" fill="@${gammeDe(t, 'lumiere')}" opacity="0.4"/>` + // carrure d'épaules
  // ceinture de dos — seulement HABILLÉ (une ceinture de cuir sur un dos nu serait incongrue)
  (t === 'peau' || t === 'corps' ? '' : `<path d="M-8.7 6 L8.7 6 L8.5 10 L-8.5 10 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.4" opacity="0.9"/>`);
const BACK_JAMBE = (t: string, boot = 'cuir') =>
  `<path d="M-3.4 0 Q-4.2 20 -2.8 32 Q-4 42 -2.6 49 L3.2 49 Q4.2 24 3.4 0 Z" fill="@${t}" stroke="@${gammeDe(t, 'ombre')}" stroke-width="0.5"/>` +
  `<path d="M-0.6 12 Q-2.2 21 -0.8 29" stroke="@${gammeDe(t, 'ombre')}" stroke-width="0.6" fill="none" opacity="0.6"/>` + // pli arrière du genou
  `<path d="M-3 33 Q-3.8 42 -2.6 49 L3.6 49 Q4 40 3.4 33 Q0 35 -3 33 Z" fill="@${boot}" stroke="@${gammeDe(boot, 'ombre')}" stroke-width="0.5"/>` +
  `<path d="M-2.7 45 L3.4 45 L3.2 49 L-2.6 49 Z" fill="@${gammeDe(boot, 'ombre')}" opacity="0.8"/>`; // talon
// --- Bras : silhouettes de profil/dos dérivées, jamais le front plaqué. Gabarit du bras (épaule→poignet,
// x −4..4, y −2..+34) peint en jeton du tissu dominant du front — un bras nu (dominant `peau`) reste
// en chair, une manche suit son tissu. Le poing/poignet est peint à part (`WRIST`/`HAND` de resolve).
const PROFILE_BRAS = (t: string) =>
  // bras (épaule→coude, #633 D1) de côté : plus étroit, galbe avant éclairé, arête arrière ombrée.
  `<path d="M-2.4 -2 Q3 -3 3.2 2 Q2.9 9 2.6 16 Q2.4 18.6 -0.2 18.6 Q-2.6 18.6 -2.6 16 Q-2.8 9 -2.4 -2 Z" fill="@${t}" stroke="@${gammeDe(t, 'ombre')}" stroke-width="0.5"/>` +
  `<path d="M2.2 0 Q2.5 9 2.1 16" fill="none" stroke="@${gammeDe(t, 'lumiere')}" stroke-width="0.6" opacity="0.5"/>` + // reflet avant
  `<path d="M-2.4 -2 Q-2.8 9 -2.4 16 Q-1.4 16 -1.2 9 Q-1.2 0 -1.6 -2 Z" fill="@${gammeDe(t, 'ombre')}" opacity="0.45"/>`; // arête arrière
const BACK_BRAS = (t: string) =>
  // bras (épaule→coude) de dos : même carrure que le front, couture arrière centrale + galbe du triceps.
  `<path d="M-3 -2 Q0 -3.4 3 -2 L2.8 17 Q0 18.6 -2.8 17 Z" fill="@${t}" stroke="@${gammeDe(t, 'ombre')}" stroke-width="0.5"/>` +
  `<path d="M0 -1 L0 17" stroke="@${gammeDe(t, 'ombre')}" stroke-width="0.6" opacity="0.4"/>` + // couture / sillon dorsal
  `<path d="M-2.8 -1 Q-2.6 8 -2.4 16 Q-1.4 16 -1.2 8 Q-1.2 0 -1.6 -1 Z" fill="@${gammeDe(t, 'lumiere')}" opacity="0.3"/>`; // reflet du triceps
const PROFILE_AVANTBRAS = (t: string) =>
  // avant-bras (coude→poignet, #633 D1) de côté : fuselé vers le poignet, galbe avant, arête arrière.
  `<path d="M-2.3 0 Q2.7 -0.6 2.9 2 Q2.6 8 2.2 14 Q2 16.4 -0.2 16.4 Q-2.4 16.4 -2.4 14 Q-2.6 8 -2.3 0 Z" fill="@${t}" stroke="@${gammeDe(t, 'ombre')}" stroke-width="0.5"/>` +
  `<path d="M2 1 Q2.3 8 1.8 14" fill="none" stroke="@${gammeDe(t, 'lumiere')}" stroke-width="0.6" opacity="0.5"/>` + // reflet avant
  `<path d="M-2.3 0 Q-2.6 8 -2.3 14 Q-1.3 14 -1.1 8 Q-1.1 1 -1.5 0 Z" fill="@${gammeDe(t, 'ombre')}" opacity="0.45"/>`; // arête arrière
const BACK_AVANTBRAS = (t: string) =>
  // avant-bras de dos : même carrure que le front, sillon central + galbe.
  `<path d="M-2.8 0 Q0 -1.2 2.8 0 L2.6 15 Q0 16.8 -2.6 15 Z" fill="@${t}" stroke="@${gammeDe(t, 'ombre')}" stroke-width="0.5"/>` +
  `<path d="M0 1 L0 15" stroke="@${gammeDe(t, 'ombre')}" stroke-width="0.6" opacity="0.4"/>` + // sillon dorsal
  `<path d="M-2.6 1 Q-2.4 8 -2.2 14 Q-1.3 14 -1.1 8 Q-1.1 1 -1.5 1 Z" fill="@${gammeDe(t, 'lumiere')}" opacity="0.3"/>`; // reflet

/** Jeton de tissu DOMINANT d'un fragment de part (pour peindre la silhouette dérivée avec la bonne
 *  gamme). Compte les jetons EXACTS (`tokensOf`) @vet1/@vet2/@cuir/@metal/@peau/@corps ; défaut vet1.
 *  peau/corps en DERNIER : un habit gagne les égalités ; une part 100 % @peau (nue) retombe sur @peau.
 *  Sans jeton de tissu, la matière d'une tenue se lit sur ses dégradés fixes (#1903). */
export function dominantCloth(svg: string): string {
  const cand = ['vet1', 'vet2', 'cuir', 'metal', 'peau', 'corps'] as const;
  const jetons = tokensOf(svg);
  let best = 'vet1', bestN = -1;
  for (const c of cand) {
    const n = jetons.filter((k) => k === c).length;
    if (n > bestN) { bestN = n; best = c; }
  }
  if (bestN <= 0) {
    if (/g_steel/.test(svg)) return 'metal';
    if (/g_cloak|g_crest/.test(svg)) return 'vet1';
    if (/g_robe/.test(svg)) return 'vet2';
  }
  return best;
}

// --- Scission du bras au COUDE (#633 D1). L'art `bras` d'une tenue est authoré PLEINE LONGUEUR dans
// le repère de l'os épaule (épaule→poignet, y ~ -2..34) ; le squelette scinde le membre en 2 os
// (`epaule*` length 18 = épaule→coude ; `avantBras*` length 18, pivot y=18 = coude→poignet). Pour
// répartir ce fragment sur les deux os, on le CLIPPE au coude : le haut reste dans le repère épaule,
// le bas est rebasé (translate -ELBOW_Y) dans le repère avant-bras. Les clipPaths `rigCutBras*` vivent
// dans les DEFS partagés (`rig/fxGradients.ts`) en `userSpaceOnUse` — leur repère est celui de l'art
// (y=18=coude), pas l'écran (cf. l'injection `composeRig` : PART sous `<g matrix><g scale>`).
export const ELBOW_Y = 18;        // coude = pivot avantBras dans le repère épaule (SKELETON-CONTRACT)
export const ELBOW_OVERLAP = 2;   // bande de recouvrement anti-pincement au coude

/** Scinde un fragment SVG de bras PLEINE LONGUEUR (repère épaule, y ~ -2..34) au coude.
 *  - haut : garde y <= ELBOW_Y, reste dans le repère épaule.
 *  - bas  : garde y >= ELBOW_Y - ELBOW_OVERLAP, REBASÉ (translate -ELBOW_Y) dans le repère avant-bras. */
export function splitBrasSvg(svg: string): { haut: string; bas: string } {
  if (!svg) return { haut: '', bas: '' };
  return {
    haut: `<g clip-path="url(#rigCutBrasHaut)">${svg}</g>`,
    bas: `<g transform="translate(0,${-ELBOW_Y})"><g clip-path="url(#rigCutBrasBas)">${svg}</g></g>`,
  };
}

/** Slots de corps dont les vues se dérivent. */
export type BodyDeriveSlot = 'tete' | 'torse' | 'jambes' | 'bras' | 'avantBras';

/** Options de dérivation. `boot` = jeton du bas de jambe (jambes) : `'cuir'` habillé / `'peau'` nu. */
export interface DeriveOpts { boot?: string }

/** Vue de DOS + de PROFIL dérivées d'un fragment de FRONT, pour un slot de corps. AUTHORING helper :
 *  matérialisé dans un def qui déclare ses vues, appelé par `toViewSet` pour les vues qu'un `PartArt` de
 *  corps ne déclare pas (#2000). */
export function deriveViews(slot: BodyDeriveSlot, frontSvg: string, opts: DeriveOpts = {}): { back: string; profile: string } {
  const t = dominantCloth(frontSvg);
  switch (slot) {
    case 'torse':  return { back: BACK_TORSE(t), profile: PROFILE_TORSE(t) };
    case 'jambes': { const boot = opts.boot ?? 'cuir'; return { back: BACK_JAMBE(t, boot), profile: PROFILE_JAMBE(t, boot) }; }
    // Coiffe (slot `tete`) front-only : AUCUNE calotte dérivée (#633 — le crâne garanti de
    // `cosmeticPart` couvre déjà la tête dessous ; une coiffe sans art dédié dos/profil reste
    // simplement absente à ces vues plutôt qu'une calotte sous-dimensionnée plaquée dessus).
    case 'tete':   return { back: '', profile: '' };
    case 'bras':      return { back: deriveBackBras(frontSvg), profile: deriveProfileBras(frontSvg) };
    case 'avantBras': return { back: deriveBackAvantBras(frontSvg), profile: deriveProfileAvantBras(frontSvg) };
  }
}

/** Silhouette de DOS d'un bras (épaule→coude), dérivée du tissu dominant de son front. */
export function deriveBackBras(frontSvg: string): string { return BACK_BRAS(dominantCloth(frontSvg)); }
/** Silhouette de PROFIL d'un bras (épaule→coude), dérivée du tissu dominant de son front. */
export function deriveProfileBras(frontSvg: string): string { return PROFILE_BRAS(dominantCloth(frontSvg)); }
/** Silhouette de DOS d'un avant-bras (coude→poignet, #633 D1), dérivée du tissu dominant de son front. */
export function deriveBackAvantBras(frontSvg: string): string { return BACK_AVANTBRAS(dominantCloth(frontSvg)); }
/** Silhouette de PROFIL d'un avant-bras (coude→poignet), dérivée du tissu dominant de son front. */
export function deriveProfileAvantBras(frontSvg: string): string { return PROFILE_AVANTBRAS(dominantCloth(frontSvg)); }

/** Sous-couche de COUVERTURE de l'avant-bras (#633 D1) : silhouette anatomique 3 vues REMPLIE
 *  d'un jeton de MATIÈRE (celle dominante du bras gagnant — manche/armure). Peinte SOUS le détail
 *  dérivé `.bas` → l'avant-bras est couvert jusqu'au poignet dans la matière du bras. Jeton `peau`
 *  (bras de chair : Nu/monstre) → l'avant-bras reste chair. Front = gabarit générique d'avant-bras. */
export function avantBrasBase(token: string): ViewSet {
  return {
    front: `<rect x="-3" y="-3" width="6" height="19" rx="3" fill="@${token}"/>`,
    back: BACK_AVANTBRAS(token),
    profile: PROFILE_AVANTBRAS(token),
  };
}

/** Ingestion d'un `PartArt` de CORPS (tenue/armure/générique/override) par `resolveParts` (#2000) : le
 *  `ViewSet` TOTAL dont la face est l'art fourni, le dos et le profil ceux que l'art déclare
 *  (`declaredView`), sinon DÉRIVÉS du front (`deriveViews`). */
export function toViewSet(slot: BodyDeriveSlot, art: PartArt | null | undefined, opts: DeriveOpts = {}): ViewSet {
  const front = declaredView(art, 'front') ?? '';
  const d = front === '' ? { back: '', profile: '' } : deriveViews(slot, front, opts);
  return { front, back: declaredView(art, 'back') ?? d.back, profile: declaredView(art, 'profile') ?? d.profile };
}
