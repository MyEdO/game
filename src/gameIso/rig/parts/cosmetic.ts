import type { PartArt } from './types';
import { baseSpeciesOf } from '../skeletons';
import { PART_BEHIND_SEP, PART_DROP_SEP } from '../bones';
import { HEADS_BY_KEY } from './heads';
import { hairstylesForSex, type HairArt } from './hairstyles';
import { MISSING_ART } from '../viewArt';
import { diagOnce, diagSubject } from '../devDiag';
import { sexeDeCoiffure } from '../../../data/schemas/grammaire/art';
import type { Sexe } from '../../../data/schemas/grammaire/valeurs';
// Têtes (visage + coiffure défaut) en heads/defs, coiffures en hairstyles/defs — CHAQUE chevelure
// porte ses 3 vues + composantes `behind` (masse qui épouse le crâne) et `drop` (chute qui dépasse
// la tête) éventuelles PAR vue (HairArt), pliées ici dans la chaîne de vue (dépliées par composeRig :
// behind → layer −2, drop → plan dorsal ; cf. splitPartBehind dans bones.ts).
// Seul le profil/dos du VISAGE reste un art GÉNÉRIQUE token ci-dessous (PROFILE_FACE / BACK_CRANE).

const foldView = (main: string, behind?: string, drop?: string) => {
  const folded = behind ? `${behind}${PART_BEHIND_SEP}${main}` : main;
  return drop ? `${drop}${PART_DROP_SEP}${folded}` : folded;
};
const foldHair = (h: HairArt): PartArt => ({
  front: foldView(h.front, h.behind?.front, h.drop?.front),
  profile: foldView(h.profile, h.behind?.profile, h.drop?.profile),
  back: foldView(h.back, h.behind?.back, h.drop?.back),
});

// Œil de secours : blanc + iris @yeux + pupille (PAS le gradient monstre g_eye).
// ANCRÉ data-eye comme les têtes générées → remplaçable par le système d'yeux
// (parts/eyes.ts : Vampire rougeoyant, œil de verre…) même sans tête dédiée.
const eye = (cx: number) =>
  `<g data-eye="${cx < 0 ? 'G' : 'D'}" data-ec="${cx} 7"><ellipse cx="${cx}" cy="7" rx="2" ry="1.3" fill="#f3ede1"/><circle cx="${cx}" cy="7" r="1.1" fill="@yeux"/><circle cx="${cx}" cy="7" r="0.6" fill="#140a06"/></g>`;

// Visage de REPLI (espèce sans tête dédiée en heads/defs, ex. Ogre) : crâne @peau + yeux ancrés.
const DEFAULT_VISAGE: string[] = [
  `<circle cx="0" cy="7" r="9" fill="@peau"/>${eye(-3)}${eye(3)}`,
  `<circle cx="0" cy="7" r="9" fill="@peauO"/>${eye(-3)}${eye(3)}`,
];

// =========================================================================================
// VUES PROFIL / DOS du VISAGE — art générique COMMUN (partagé par toutes les espèces),
// 100 % en tokens (@peau/@cheveux…) pour recoloriage correct. La FACE reste l'art détaillé
// par espèce (heads/defs) ; ici on dessine un profil/dos PROPRES qui matchent ses proportions :
// crâne ovale (x±9, y -9..16), yeux à y≈6.6, bouche à y≈12.6. Le profil regarde vers +x.
// (Les CHEVEUX, eux, portent leurs vues DANS leur def — HairArt — plus d'art générique partagé.)
// =========================================================================================

// Crâne arrière PLEIN (#633 P2, décision D4 : pas de visage de dos — le crâne + le cou + les
// cheveux portent le dos). MÊME empreinte que le disque visage front (`DEFAULT_VISAGE`, cy7 r9) :
// couvre tout l'arrière du crâne jusqu'à la nuque, INDÉPENDANT de la coiffure (une coiffure vient
// PAR-DESSUS, layer cheveux > crâne, sur le même os `tete`) : le dôme couvre l'ENTIER arrière du
// crâne, sans zone chauve ni flottante.
const BACK_CRANE =
  // silhouette pleine (galbe arrondi haut, tapered vers la nuque bas) — couverture entière, inchangée
  '<path d="M-9 6.6 Q-9.4 -2 0 -2.6 Q9.4 -2 9 6.6 Q8.6 12.4 4.8 16 Q0 17.6 -4.8 16 Q-8.6 12.4 -9 6.6Z" fill="@peau"/>' +
  // ombré des bords : croissants VERTICAUX qui épousent tout le pourtour du crâne (sommet→nuque),
  // continus le long de l'arête — modelé radial du dôme, aucun accent horizontal apparié
  '<path d="M0 -2.6 Q-9.4 -2 -9 6.6 Q-8.6 12.4 -4.8 16 Q-6.4 11.4 -6.3 5.4 Q-6.2 0.4 0 -2.6Z" fill="@peauO" opacity="0.34"/>' +
  '<path d="M0 -2.6 Q9.4 -2 9 6.6 Q8.6 12.4 4.8 16 Q6.4 11.4 6.3 5.4 Q6.2 0.4 0 -2.6Z" fill="@peauO" opacity="0.34"/>' +
  // reflet de la bosse occipitale : lentille VERTICALE centrée (protubérance sous la lumière du sommet)
  '<path d="M0 -1.6 Q3 -0.4 2.7 6 Q2.1 11 0 12.4 Q-2.1 11 -2.7 6 Q-3 -0.4 0 -1.6Z" fill="@peauH" opacity="0.34"/>' +
  // nappe d'ombre de la base du crâne, VERTICALE, en fondu vers la nuque puis le cou (jamais un arc)
  '<path d="M-3 8.4 Q0 9.4 3 8.4 Q2.3 13.2 0 17.4 Q-2.3 13.2 -3 8.4Z" fill="@peauO" opacity="0.3"/>';

// VISAGE de PROFIL générique (tokens) : silhouette de côté propre — front, arête du nez, lèvres,
// menton, un œil, une oreille. Remplace l'art headViews profil (hardcodé, déformé). Regarde +x.
const PROFILE_FACE =
  // contour du visage : crâne arrière arrondi (-x) → front (+x) → nez → lèvres → menton → mâchoire
  '<path d="M-8.5 5 Q-9 -2 -1 -2.2 ' + // sommet du crâne
  'Q5 -2 7.2 2.4 ' +                    // front bombé vers l'avant
  'Q8 4 7 5.2 ' +                       // arête au-dessus du nez
  'Q9.2 6.4 8.3 8.2 ' +                 // pointe du nez (saillie +x)
  'Q7.6 9.2 6.4 9.3 ' +                 // base du nez
  'Q7 10.6 5.8 11.4 ' +                 // lèvre supérieure
  'Q6.4 12.6 5.4 13.6 ' +               // menton avancé
  'Q3 16.4 -1 15.6 ' +                  // mâchoire / sous le menton
  'Q-7 14.5 -8.5 5Z" fill="@peau"/>' +
  // joue/tempe en ombre (côté arrière) pour le volume
  '<path d="M-8.5 5 Q-9 -2 -1 -2.2 Q-5 -1.4 -6.4 4 Q-7.4 9.5 -3.4 14.6 Q-7 13.4 -8.5 5Z" fill="@peauO" opacity="0.55"/>' +
  // reflet sur le front/nez (lumière de face)
  '<path d="M2 -1.6 Q6 -1 7.2 2.4 Q8 4 7 5.2 Q5.4 3 2.6 2.2 Q1.4 0 2 -1.6Z" fill="@peauH" opacity="0.5"/>' +
  // sourcil
  '<path d="M2.2 3.6 Q4.6 2.6 6.4 3.8" stroke="@cheveuxO" stroke-width="0.9" fill="none" stroke-linecap="round"/>' +
  // œil (de profil : amande, iris vers l'avant)
  '<ellipse cx="3.9" cy="5.9" rx="1.5" ry="1.15" fill="#f3ede1"/>' +
  '<circle cx="4.6" cy="6" r="1" fill="@yeux"/><circle cx="4.7" cy="6.1" r="0.6" fill="#140a06"/>' +
  // narine + bouche + ligne du menton
  '<path d="M7.4 8.4 Q6.6 8.8 6.2 8.2" stroke="@peauO" stroke-width="0.5" fill="none" stroke-linecap="round"/>' +
  '<path d="M5 11.8 Q6 12 6.2 11.4" stroke="#8a4a3a" stroke-width="0.7" fill="none" stroke-linecap="round"/>' +
  // oreille (côté arrière, vers -x)
  '<path d="M-2.6 6.4 Q-4.6 5.6 -4.8 7.8 Q-4.6 9.8 -2.4 9.4 Q-3.4 8 -2.6 6.4Z" fill="@peau" stroke="@peauO" stroke-width="0.45"/>' +
  '<path d="M-3.6 7.2 Q-4 8 -3.4 8.6" stroke="@peauO" stroke-width="0.4" fill="none"/>';

/** Pool de coiffures d'une espèce×sexe : [coiffure par défaut de la tête (si présente), ...coiffures du
 *  sexe (hairstyles/defs, triées par `order`)]. CHAQUE entrée porte ses 3 vues + `behind`/`drop` (HairArt).
 *  SOURCE UNIQUE consommée par `cosmeticPart` (choix par idx) ET `hairIndexById` (imposition par id). */
export function hairPool(species: string, sex: Sexe): HairArt[] {
  const head = HEADS_BY_KEY[`${baseSpeciesOf(species)}:${sex}`];
  return [...(head?.cheveux != null ? [head.cheveux] : []), ...hairstylesForSex(sex)];
}

/** Position de la coiffure NOMMÉE `id` dans le pool espèce×sexe, `-1` hors du pool. La coiffure par
 *  DÉFAUT de la tête (HairArt sans `id`) ne matche jamais : imposer vise les coiffures NOMMÉES. */
function rangDeCoiffure(species: string, sex: Sexe, id: string): number {
  return hairPool(species, sex).findIndex((h) => (h as { id?: string }).id === id);
}

/** Chevelure d'ERREUR (#223, `MISSING_ART`) d'une coiffure imposée hors du pool : la faute se VOIT, elle
 *  ne prend jamais l'art d'une autre coiffure. */
export const COIFFURE_HORS_POOL: string = MISSING_ART.profile!();

/** Index dans le pool de la coiffure d'`id` — IMPOSITION par id (#637, `appearance.hairstyle`, donnée
 *  d'AUTEUR). Hors du pool espèce×sexe : `undefined` et un diagnostic qui nomme l'id ; l'appelant rend
 *  `COIFFURE_HORS_POOL`. */
export function hairIndexById(species: string, sex: Sexe, id: string): number | undefined {
  const i = rangDeCoiffure(species, sex, id);
  if (i >= 0) return i;
  // `?.` : le rig est importé par les scripts tsx (galeries QC), où `import.meta.env` n'existe pas.
  if (import.meta.env?.DEV)
    diagOnce(`rig:coiffure:${diagSubject()}:${species}:${sex}:${id}`, () => console.warn(`[rig] coiffure « ${id} » hors du pool (espèce ${species}, sexe ${sex}) — chevelure d'erreur visible, donnée à corriger.`));
  return undefined;
}

/** Apparence d'AUTEUR dont la coiffure imposée RETOMBE (champ retiré) quand le sexe posé n'est plus
 *  le sien (`sexeDeCoiffure`) — patron `propRefPatch` : un geste d'édition ne crée pas de faute. Une
 *  coiffure inconnue ou sans sexe posé reste : le schéma la nomme. PURE. */
export function coiffureRetombee<T extends { sex?: Sexe; hairstyle?: string }>(a: T): T {
  if (a.hairstyle == null || a.sex == null) return a;
  const sexe = sexeDeCoiffure(a.hairstyle);
  if (sexe === undefined || sexe === a.sex) return a;
  const sans = { ...a };
  delete sans.hairstyle;
  return sans;
}

/** Patch d'auteur du CHOIX d'une coiffure : elle pose son sexe avec elle (`sexeDeCoiffure`) ; aucune
 *  coiffure choisie la retire. PURE. */
export function coiffureChoisie(id: string | undefined): { hairstyle?: string; sex?: Sexe } {
  const sex = id === undefined ? undefined : sexeDeCoiffure(id);
  return sex ? { hairstyle: id, sex } : { hairstyle: undefined };
}

/** Part cosmétique (toujours espèce×sexe). slot ∈ {visage, cheveux}.
 *  Priorité à la tête dédiée (heads/defs, art LDB) ; sinon visage de repli générique.
 *  CHEVEUX : choix dans le pool partagé (`hairPool`) via idx (pins.cheveux / seed / id résolu). */
export function cosmeticPart(slot: 'visage' | 'cheveux', species: string, sex: Sexe, idx: number): PartArt {
  const head = HEADS_BY_KEY[`${baseSpeciesOf(species)}:${sex}`];
  if (slot === 'cheveux') {
    const entries = hairPool(species, sex);
    if (!entries.length) return ''; // aucun pool (jamais atteint : le pool par sexe est non vide)
    return foldHair(entries[((idx % entries.length) + entries.length) % entries.length]);
  }
  // Visage : art de tête dédié (dos = crâne PLEIN, jamais un visage — D4 — surchargeable par
  // `head.crane` pour une espèce à boîte crânienne divergente ; profil = silhouette générique
  // commune à toutes les espèces), sinon repli générique (espèce sans tête, ex. Ogre). `idx`
  // (override/seed) choisit la variante dans le pool de la tête — même convention que les cheveux.
  const pool = head?.visage?.length ? head.visage : DEFAULT_VISAGE;
  const visage = pool[((idx % pool.length) + pool.length) % pool.length];
  return { front: visage, back: head?.crane?.back ?? BACK_CRANE, profile: PROFILE_FACE };
}
