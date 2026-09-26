import type { Slot } from '../bones';
import { pickView, type Part, type PartArt } from './types';
import type { View } from '../facing';
import { cosmeticPart } from './cosmetic';
import { genericPart } from './generic';
import { tenueFor } from './career';
import { TENUE_BAREFOOT, TENUE_FOOT_STYLE } from './tenues';
import { armourPart, weaponPart, shieldPart, isShield, type EquipCtx } from './equipment';

const BODY_SLOTS: Slot[] = ['tete', 'bras', 'torse', 'jambes'];

// --- Profil : silhouettes de CÔTÉ du corps (le pantin est de face ; de profil le
// torse/les jambes doivent être plus étroits et le buste légèrement avancé). Elles sont
// PEINTES EN TOKENS (`@vet1`/`@cuir`…) dérivés de la tenue → elles SUIVENT le recoloriage
// de carrière au lieu d'un gris muet → cohérent de profil pour TOUTE tenue sans art dédié.
// Une tenue PEUT fournir `profile` sur torse/jambes/tete pour un rendu détaillé (prioritaire,
// p.ex. Soldat). Le token de tissu dominant est déduit du fragment FRONT (cf. dominantCloth). ---
const PROFILE_TORSE = (t: string) =>
  // buste de côté (poitrine avancée +x) avec reflet avant + ombre dorsale, en token tissu.
  `<path d="M-5 -28 Q3 -31 7 -26 Q8.5 -10 6 4 L5 33 Q-1 37 -6 33 L-5 4 Q-7 -13 -5 -28 Z" fill="@${t}" stroke="@${t}O" stroke-width="0.6"/>` +
  `<path d="M3 -27 Q6 -10 4.6 4 L4 30" fill="none" stroke="@${t}H" stroke-width="0.8" opacity="0.5"/>` +
  `<path d="M-5 -2 Q-7 -13 -5 -28 Q-3 -30 -1 -29 L-1 4 Z" fill="@${t}O" opacity="0.5"/>`;
const PROFILE_JAMBE = (t: string, boot = 'cuir') =>
  // jambe de côté (token tissu) + genou (renflement ~y22) + botte (bas, @boot) qui pointe
  // vers l'avant : sinon de profil la jambe est un poteau nu sans botte ni genou. Le token de
  // botte est `cuir` pour les habillés, `peau` pour les nus (bas de jambe nu + griffes ajoutées
  // par CLAWFOOT) → pas de botte de cuir brune incohérente sur un monstre nu.
  `<path d="M-3.2 0 Q-4 18 -2.6 30 L-2.6 30 Q-4 40 -2.4 49 L3.4 49 Q4 24 3.2 0 Z" fill="@${t}" stroke="@${t}O" stroke-width="0.5"/>` +
  `<path d="M-3.6 18 Q-5 22 -2.8 26 Q2.4 27 4.2 23 Q4.8 19 2.8 16 Q0 17 -3.6 18 Z" fill="@${t}H" stroke="@${t}O" stroke-width="0.5" opacity="0.85"/>` +
  `<path d="M-3 32 Q-3.9 42 -2.4 49 L4.2 49 Q4.6 46 4 42 L3.7 32 Q0 34 -3 32 Z" fill="@${boot}" stroke="@${boot}O" stroke-width="0.5"/>` +
  `<path d="M3.7 34 L7.8 34 Q9 38 7.6 41 L4 41Z" fill="@${boot}" stroke="@${boot}O" stroke-width="0.4"/>`; // bout de la botte (+x)
// Couvre-chef de PROFIL générique : seulement si la tenue a un couvre-chef de FACE (tete non
// vide). Calotte de côté en token, couvrant le sommet, visage dégagé. Si pas de couvre-chef,
// resolveParts laisse tete vide → la tête nue (cheveux profil cosmétiques) s'affiche.
const PROFILE_TETE = (t: string) =>
  `<path d="M-8 -2 Q-8.5 -12 0 -13 Q7 -12 8 -3 Q1 -6 -8 -2Z" fill="@${t}" stroke="@${t}O" stroke-width="0.6"/>` +
  `<path d="M-7 -3 Q-7.5 -11 0 -12.4 Q3 -11.6 4 -3 Q-1 -5.6 -7 -3Z" fill="@${t}H" opacity="0.4"/>`;

// --- Dos : silhouettes de DOS génériques (même principe que le profil) — sans art `back`
// dédié, la tenue montrerait son art de FACE plaqué dans le dos (lacets, boucles, emblèmes).
// Peintes en tokens dérivés du tissu dominant → suivent le recoloriage de carrière.
const BACK_TORSE = (t: string) =>
  `<path d="M-8.5 -27 Q0 -30 8.5 -27 L9 4 Q8 16 5 33 Q0 36 -5 33 Q-8 16 -9 4 Z" fill="@${t}" stroke="@${t}O" stroke-width="0.6"/>` +
  `<path d="M0 -27 L0 33" stroke="@${t}O" stroke-width="0.7" opacity="0.55"/>` + // couture (habillé) / colonne (nu)
  `<path d="M-8.5 -24 Q0 -27 8.5 -24 L8.5 -19 Q0 -22 -8.5 -19 Z" fill="@${t}H" opacity="0.4"/>` + // carrure d'épaules
  // ceinture de dos — seulement HABILLÉ (une ceinture de cuir sur un dos nu serait incongrue)
  (t === 'peau' || t === 'corps' ? '' : `<path d="M-8.7 6 L8.7 6 L8.5 10 L-8.5 10 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.4" opacity="0.9"/>`);
const BACK_JAMBE = (t: string, boot = 'cuir') =>
  `<path d="M-3.4 0 Q-4.2 20 -2.8 32 Q-4 42 -2.6 49 L3.2 49 Q4.2 24 3.4 0 Z" fill="@${t}" stroke="@${t}O" stroke-width="0.5"/>` +
  `<path d="M-0.6 12 Q-2.2 21 -0.8 29" stroke="@${t}O" stroke-width="0.6" fill="none" opacity="0.6"/>` + // pli arrière du genou
  `<path d="M-3 33 Q-3.8 42 -2.6 49 L3.6 49 Q4 40 3.4 33 Q0 35 -3 33 Z" fill="@${boot}" stroke="@${boot}O" stroke-width="0.5"/>` +
  `<path d="M-2.7 45 L3.4 45 L3.2 49 L-2.6 49 Z" fill="@${boot}O" opacity="0.8"/>`; // talon
const BACK_TETE = (t: string) =>
  `<path d="M-8 -2 Q-8.5 -12 0 -13 Q8.5 -12 8 -2 Q0 -5.5 -8 -2 Z" fill="@${t}" stroke="@${t}O" stroke-width="0.6"/>` +
  `<path d="M-7 -4 Q0 -7 7 -4 L7 -2.6 Q0 -5.2 -7 -2.6 Z" fill="@${t}O" opacity="0.5"/>`;

/** Token de tissu DOMINANT d'un fragment de tenue (pour peindre la silhouette de profil avec
 *  la bonne famille de couleur). Compte les occurrences de @vet1/@vet2/@cuir/@metal ; défaut vet1.
 *  (Le gradient g_steel/g_robe… → metal/vet1 approximatif pour l'art non tokenisé restant.) */
function dominantCloth(svg: string): string {
  // peau/corps en DERNIER : un habit (vet/cuir/metal) gagne les égalités ; mais une tenue
  // « Nu » (100 % @peau) n'a aucun token de tissu → on retombe sur @peau (et non vet1 brun),
  // sinon le torse/jambes de profil d'un monstre nu vire au brun incohérent.
  const cand = ['vet1', 'vet2', 'cuir', 'metal', 'peau', 'corps'] as const;
  let best = 'vet1', bestN = -1;
  for (const c of cand) {
    const n = (svg.match(new RegExp(`@${c}\\b`, 'g')) ?? []).length;
    if (n > bestN) { bestN = n; best = c; }
  }
  if (bestN <= 0) {
    if (/g_steel/.test(svg)) return 'metal';
    if (/g_cloak|g_crest/.test(svg)) return 'vet1';
    if (/g_robe/.test(svg)) return 'vet2';
  }
  return best;
}
/** Une part fournit-elle sa vue de PROFIL / de DOS ? Discriminant du FORMAT de part : `string` =
 *  front-only (le rendu substitue une silhouette générique, ou plaque le front sur `bras`).
 *  Exporté : la garde de format (`tenues/part-view-format.test.ts`) l'IMPORTE au lieu de
 *  répliquer sa propre vue de l'empilage — une garde qui remodélise le pipeline diverge de lui. */
export const hasProfileView = (p: PartArt | null | undefined): boolean => typeof p === 'object' && p != null && !!p.profile;
export const hasBackView = (p: PartArt | null | undefined): boolean => typeof p === 'object' && p != null && !!p.back;

// Pied DIRECTIONNEL (repère os `pied`, origine = cheville, +y descend). Dessiné
// par-dessus le bas de jambe → un pied de profil pointe vers l'avant (botte de côté),
// de face un bout arrondi, de dos un talon. C'est ce qui manquait : les pieds changent
// enfin selon la direction.
// Main (poing) directionnelle, repère os `main` (origine = poignet, +y descend).
// MOIGNON DE POIGNET : le pivot à 14 (skeletons.ts) ne suffit PAS — mesuré sur les 117 tenues,
// l'art de bras finit souvent AVANT le poignet FK (4-6 unités : familles skaven ; jusqu'à 12 :
// manche large tombante du Prophète gris) → le poing seul lisait comme un disque flottant. Un
// cylindre `@peau` remonte donc du poing jusque SOUS le coude (y=-12 ; coude à -14) : sous une
// manche qui atteint le poignet il disparaît dessous (la main est peinte SOUS l'art de bras,
// cf. zOverride mainG/mainD de composeRig) ; sous une manche courte il est l'avant-bras nu qui
// en émerge ; sur bras nu il est la continuité de l'avant-bras (même `@peau`).
const WRIST = (dx: number, fill: string) =>
  `<path d="M${(-2.3 + dx).toFixed(1)} -12 Q${dx} -12.8 ${(2.3 + dx).toFixed(1)} -12 L${(2.3 + dx).toFixed(1)} 1.5 Q${dx} 2.6 ${(-2.3 + dx).toFixed(1)} 1.5 Z" fill="${fill}" stroke="@peauO" stroke-width="0.5"/>`;
const HAND: PartArt = {
  front: `${WRIST(0, '@peau')}<ellipse cx="0" cy="2.6" rx="2.8" ry="3.2" fill="@peau" stroke="@peauO" stroke-width="0.5"/><path d="M-1.4 1.6 h2.8 M-1.4 3.2 h2.8" stroke="@peauO" stroke-width="0.4" opacity="0.5"/>`,
  back: `${WRIST(0, '@peauO')}<ellipse cx="0" cy="2.6" rx="2.8" ry="3.2" fill="@peauO" stroke="@peauO" stroke-width="0.5"/>`,
  profile: `${WRIST(0.6, '@peau')}<ellipse cx="0.6" cy="2.6" rx="2.6" ry="3.2" fill="@peau" stroke="@peauO" stroke-width="0.5"/>`,
};
// Cou : cylindre de chair @peau reliant le sommet du torse (os `torse`) au bas du crâne (os
// `tete`) — repère LOCAL de l'os `cou` (référence longueur=6/épaisseur=6, cf. skeletons.ts).
// Toujours résolu (comme visage/cheveux), quelle que soit la tenue : un col de tenue le recouvre
// naturellement (dessiné au torse/tête, calque au-dessus) ; nu ou en chauve, il ferme le volume
// entre tête et torse dans les TROIS vues, seams qui manquaient à `HEAD_BACK_SKULL`/`FOOT` seuls.
const NECK: PartArt = {
  front: `<path d="M-3.6 -6.6 Q0 -8 3.6 -6.6 L4 2.6 Q0 5 -4 2.6 Z" fill="@peau"/>` +
    `<path d="M-1.6 -6 Q0 -6.6 1.6 -6 L1.8 1.6 Q0 2.6 -1.8 1.6Z" fill="@peauH" opacity="0.3"/>` +
    `<path d="M-3.6 -6.6 L-4 2.6 Q-3 1 -2.6 -4 Z" fill="@peauO" opacity="0.3"/>` +
    `<path d="M3.6 -6.6 L4 2.6 Q3 1 2.6 -4 Z" fill="@peauO" opacity="0.3"/>`,
  back: `<path d="M-3.8 -6.4 Q0 -7.8 3.8 -6.4 L4.2 2.8 Q0 5.2 -4.2 2.8 Z" fill="@peau"/>` +
    `<path d="M-3.8 -6.4 Q0 -7 3.8 -6.4 Q3.4 -5.4 0 -5.2 Q-3.4 -5.4 -3.8 -6.4Z" fill="@peauO" opacity="0.45"/>` +
    `<path d="M-0.9 -5 Q0 -5.4 0.9 -5 Q1 -1 0.6 2 L-0.6 2 Q-1 -1 -0.9 -5Z" fill="@peauH" opacity="0.35"/>` +
    `<path d="M-2.4 1 Q0 2.2 2.4 1" stroke="@peauO" stroke-width="0.4" fill="none" opacity="0.3"/>`,
  profile: `<path d="M-3 -6.4 Q1.5 -7.4 4.4 -4.6 L4.6 2.6 Q0 5 -3.6 2.6 Z" fill="@peau"/>` +
    `<path d="M-3 -6.4 Q-3.6 -1 -3.6 2.6 Q-4.4 -1.4 -3 -6.4Z" fill="@peauO" opacity="0.35"/>` +
    `<path d="M1.5 -7.2 Q4 -6 4.4 -4.6 Q3.4 -5.6 1.2 -6.2Z" fill="@peauH" opacity="0.4"/>`,
};

// Botte SYSTÈME : peinte en JETONS de la famille `botte` (cuir `@botte` + contour `@botteO`,
// `@semelle`, et `@botteDos`/`@botteDosO` pour le cuir dorsal que l'art assombrit à la main) —
// une tenue pilote donc la couleur de ses bottes par sa `palette` (`botte`, cf. tenues/types.ts).
// Défauts (art d'origine) et expansion de la famille : `footPalette` (career.ts), empilée sous la
// palette portée (espèce ∪ tenue) par `rigStoredPalette` — la SEULE construction de cet empilage.
const FOOT: PartArt = {
  front: `<path d="M-3.4 -1 Q-4.4 7 0 8 Q4.4 7 3.4 -1 Z" fill="@botte" stroke="@botteO" stroke-width="0.6"/><path d="M-3.6 6.5 Q0 8.6 3.6 6.5 L3.4 8 Q0 9.4 -3.4 8 Z" fill="@semelle"/>`,
  back: `<path d="M-3.2 -1 Q-3.8 6 0 6.5 Q3.8 6 3.2 -1 Z" fill="@botteDos" stroke="@botteDosO" stroke-width="0.5"/>`,
  profile: `<path d="M-3 -1 L-3 5 Q-3 7.4 0 7.4 L8.6 7.4 Q10.6 7.4 9.4 4 L5.4 1 Z" fill="@botte" stroke="@botteO" stroke-width="0.6"/><path d="M-3 6.4 L9.6 6.4 L9.8 8 Q4 9 -3 8 Z" fill="@semelle"/>`,
};
// Pied NU GRIFFU (espèces nues : squelette/goule/troll…) — chair/os/pelage `@peau` + griffes
// `@griffe` (au lieu de la botte, incohérente sur un monstre nu).
const CLAWFOOT: PartArt = {
  front: `<path d="M-3.4 -1 Q-4.2 6 0 7 Q4.2 6 3.4 -1 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/><path d="M-2.4 6 l-0.5 2.7 M0 6.6 l0 2.9 M2.4 6 l0.5 2.7" stroke="@griffe" stroke-width="0.9" stroke-linecap="round"/>`,
  back: `<path d="M-3.2 -1 Q-3.7 5 0 5.6 Q3.7 5 3.2 -1 Z" fill="@peauO" stroke="@peauO" stroke-width="0.4"/>`,
  profile: `<path d="M-3 -1 L-3 4.6 Q-3 6.8 0 6.8 L8 6.8 Q9.8 6.8 8.8 3.6 L5 1 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/><path d="M3.6 6.8 l0.3 2.6 M6.2 6.6 l1.4 2.4 M8 6.4 l1.8 2.1" stroke="@griffe" stroke-width="0.9" stroke-linecap="round"/>`,
};
// Pied NU LISSE (civilisés va-nu-pieds : halfling, humain sans chaussure…) — même géométrie que
// CLAWFOOT (chair `@peau`), plante + orteils suggérés, SANS griffe (#481 : un civilisé nu-pieds
// n'est pas un monstre).
const PLAINFOOT: PartArt = {
  front: `<path d="M-3.4 -1 Q-4.2 6 0 7 Q4.2 6 3.4 -1 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/><path d="M-2.4 6.4 Q0 7.6 2.4 6.4" fill="none" stroke="@peauO" stroke-width="0.4" opacity="0.6"/>`,
  back: `<path d="M-3.2 -1 Q-3.7 5 0 5.6 Q3.7 5 3.2 -1 Z" fill="@peauO" stroke="@peauO" stroke-width="0.4"/>`,
  profile: `<path d="M-3 -1 L-3 4.6 Q-3 6.8 0 6.8 L8 6.8 Q9.8 6.8 8.8 3.6 L5 1 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/><path d="M3.6 7.2 Q6 7.8 8.4 6.6" fill="none" stroke="@peauO" stroke-width="0.4" opacity="0.6"/>`,
};

/**
 * Choisit une part par slot, par priorité :
 *   override éditeur > équipement porté > tenue de carrière > générique.
 * visage/cheveux : toujours (cosmétique espèce×sexe), variante via overrides/seed.
 * `view` choisit la vue (front/back/profile) de chaque part, avec fallback front.
 */
export function resolveParts(
  species: string,
  sex: 'M' | 'F',
  tenueKey: string | undefined,
  equip: EquipCtx,
  overrides: Partial<Record<Slot, number>>,
  seed: number,
  view: View = 'front',
): Record<Slot, Part | null> {
  const tenue = tenueFor(tenueKey);
  // Corps non chaussé (flag bareFoot du def : 'Nu', squelette décharné, tenues de MONSTRE) — pieds
  // griffus et substitutions dos/profil en chair plutôt qu'en botte/tissu. SOURCE UNIQUE : le flag
  // du def, clé par ID stable de garde-robe.
  const tenueId = tenueKey ?? '';
  const bareFoot = TENUE_BAREFOOT.has(tenueId);
  const footStyle = TENUE_FOOT_STYLE.get(tenueId) ?? 'boot';
  const out = {} as Record<Slot, Part | null>;
  const P = (art: PartArt | null | undefined): Part => ({ svg: pickView(art, view) });

  // Cosmétique (toujours). overrides priment, sinon variante dérivée du seed.
  out.visage = P(cosmeticPart('visage', species, sex, overrides.visage ?? seed % 2));
  out.cheveux = P(cosmeticPart('cheveux', species, sex, overrides.cheveux ?? (seed >> 2)));
  out.cou = P(NECK);

  // Corps : override → armure équipée → carrière → générique.
  // art RÉEL par slot (pour gater la substitution profil/dos ci-dessous sur l'art effectif, pas la tenue).
  let teteArt: PartArt | null | undefined;
  let torseArt: PartArt | null | undefined;
  let jambesArt: PartArt | null | undefined;
  for (const slot of BODY_SLOTS) {
    const tenuePart = tenue[slot as 'torse' | 'jambes' | 'bras' | 'tete'];
    let art: PartArt | null | undefined;
    if (overrides[slot] != null) {
      art = tenuePart ?? genericPart(slot);
    } else {
      const armed = equip.armour.map((it) => armourPart(it, slot)).find((p) => p != null);
      art = armed ?? tenuePart ?? (slot === 'tete' ? '' : genericPart(slot));
    }
    if (slot === 'tete') teteArt = art;
    else if (slot === 'torse') torseArt = art;
    else if (slot === 'jambes') jambesArt = art;
    out[slot] = P(art);
  }

  // Profil : remplace torse/jambes par la silhouette de côté EN TOKENS (sauf si la tenue
  // fournit déjà une vue `profile` détaillée). Suit le recoloriage de carrière.
  if (view === 'profile') {
    if (!hasProfileView(torseArt) && out.torse?.svg) out.torse = { svg: PROFILE_TORSE(dominantCloth(out.torse.svg)) };
    if (!hasProfileView(jambesArt) && out.jambes?.svg) out.jambes = { svg: PROFILE_JAMBE(dominantCloth(out.jambes.svg), bareFoot ? 'peau' : 'cuir') };
    // Couvre-chef : silhouette de profil seulement s'il y en a un de face (sinon tête nue +
    // cheveux de profil cosmétiques). Évite l'art de face plaqué qui « s'enfonce » dans le crâne.
    // On teste l'art RÉEL de la tête (teteArt), pas la tenue : l'armure équipée (art front-only
    // historiquement, désormais directionnel) peut couvrir la tête à la place de la tenue.
    if (!hasProfileView(teteArt) && out.tete?.svg) out.tete = { svg: PROFILE_TETE(dominantCloth(out.tete.svg)) };
  }
  // Dos : MÊME principe — sans art `back` dédié, l'art de FACE serait plaqué dans le dos
  // (lacets, boucles, emblèmes). Silhouette dorsale en tokens (couture, carrure, ceinture,
  // talons de botte) ; les 64 tenues de carrière générées ont leur vrai dos (prioritaire).
  if (view === 'back') {
    if (!hasBackView(torseArt) && out.torse?.svg) out.torse = { svg: BACK_TORSE(dominantCloth(out.torse.svg)) };
    if (!hasBackView(jambesArt) && out.jambes?.svg) out.jambes = { svg: BACK_JAMBE(dominantCloth(out.jambes.svg), bareFoot ? 'peau' : 'cuir') };
    // Tête : art RÉEL (teteArt) et non la tenue — l'armure équipée porte désormais son propre dos.
    if (!hasBackView(teteArt) && out.tete?.svg) out.tete = { svg: BACK_TETE(dominantCloth(out.tete.svg)) };
  }

  // Pieds : botte de cuir, pied nu griffu (monstre) ou pied nu lisse (civilisé) — footStyle, dérivé
  // par défaut de bareFoot pour rétro-compat (#481).
  out.pied = P(footStyle === 'claw' ? CLAWFOOT : footStyle === 'plain' ? PLAINFOOT : FOOT);

  // Mains : petit poing à chaque poignet → agrippe l'arme/le bouclier (sinon l'arme
  // « flotte dans le vide » au bout de la manche). Sous l'arme (z) = la main tient.
  out.main = P(HAND);

  // Mains : arme principale (1re non-bouclier) à l'os `arme` ; main secondaire (os `bouclier`) =
  // bouclier si présent, sinon la 2e arme tenue (dual-wield non-bouclier : dague, main-gauche…) —
  // détectée par `hand:'off'`. Ainsi épée+bouclier ET épée+dague s'affichent (plus seulement la principale).
  const mainWeapon = equip.weapons.find((w) => !isShield(w));
  const offWeapon = equip.weapons.find((w) => w.hand === 'off' && !isShield(w) && w !== mainWeapon);
  out.arme = P(mainWeapon ? weaponPart(mainWeapon) : '');
  out.bouclier = P(equip.shield ? shieldPart(equip.shield) : offWeapon ? weaponPart(offWeapon) : '');

  return out;
}
