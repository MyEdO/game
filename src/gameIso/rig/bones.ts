/** Os du squelette humanoïde (boîte locale 120×150, pieds en (60,150)). */
export type BoneId =
  | 'bassin' | 'torse' | 'cou' | 'tete'
  | 'epauleG' | 'avantBrasG' | 'mainG'
  | 'epauleD' | 'avantBrasD' | 'mainD'
  | 'cuisseG' | 'tibiaG' | 'piedG'
  | 'cuisseD' | 'tibiaD' | 'piedD'
  | 'arme' | 'bouclier';

export const BONE_IDS: BoneId[] = [
  'bassin', 'torse', 'cou', 'tete',
  'epauleG', 'avantBrasG', 'mainG',
  'epauleD', 'avantBrasD', 'mainD',
  'cuisseG', 'tibiaG', 'piedG',
  'cuisseD', 'tibiaD', 'piedD',
  'arme', 'bouclier',
];

export interface Bone {
  id: BoneId;
  parent: BoneId | null;
  /** attache dans le repère LOCAL du parent. */
  pivot: { x: number; y: number };
  /** longueur/épaisseur (morphologie). */
  length: number;
  thickness: number;
  /** angle au repos (degrés), surchargé par la Pose. */
  angle: number;
  /** tri inter-os (peintre) : plus grand = devant. */
  z: number;
}

export type Skeleton = Record<BoneId, Bone>;

/** Parts visuelles interchangeables. */
export type Slot =
  | 'visage' | 'cheveux'
  | 'tete' | 'cou' | 'bras' | 'torse' | 'jambes' | 'pied' | 'main'
  | 'arme' | 'bouclier';

/** Os porteur(s) d'un slot. Le 2e os d'une paire (…D) est rendu en miroir. */
export const SLOT_BONES: Record<Slot, BoneId[]> = {
  visage: ['tete'], cheveux: ['tete'], tete: ['tete'], cou: ['cou'],
  torse: ['torse'],
  bras: ['epauleG', 'epauleD'],
  jambes: ['cuisseG', 'cuisseD'],
  pied: ['piedG', 'piedD'],
  main: ['mainG', 'mainD'], // mains : agrippent l'arme/le bouclier (sinon l'arme « flotte »)
  arme: ['arme'], bouclier: ['bouclier'],
};

/** Ordre de calque d'un slot À L'INTÉRIEUR d'un même os (petit = dessous). */
export const SLOT_LAYER: Record<Slot, number> = {
  jambes: 0, torse: 1, bras: 2, pied: 0, main: 0,
  visage: 0, cheveux: 1, tete: 2, cou: 0,
  bouclier: 0, arme: 0,
};

/** Calque d'un overlay de tête qui DÉPASSE des cheveux (ex. oreilles pointues d'elfe) mais doit
 *  rester COUVERT par une coiffe de tenue (heaume/capuche) : entre `cheveux` et `tete` (la coiffe).
 *  Réel (pas un rang entier) — le tri du peintre (`composeRig.tsx`) compare des `number`, aucune
 *  contrainte d'entier ; nommé pour éviter le nombre magique qui n'a pas de place entière ici. */
export const LAYER_OVER_CHEVEUX_UNDER_COIFFE = (SLOT_LAYER.cheveux + SLOT_LAYER.tete) / 2;

/** Une part de slot peut porter DEUX composantes optionnelles pliées dans la MÊME chaîne SVG
 *  (elles traversent ainsi la résolution par vue sans champ dédié) :
 *  `chute` + SEP_CHUTE + `arrière` + SEP_BEHIND + `principal`.
 *  - ARRIÈRE : masse qui épouse le crâne, peinte au layer −2 — DERRIÈRE la part de visage,
 *    même sémantique que `RigOverlay.behind` ;
 *  - CHUTE : cheveux qui DÉPASSENT la tête (chute longue, queue, rideau) — routée par le
 *    compositeur sur le PLAN dorsal (cf. parts/dorsal.ts) : `fond` de face, `avant` de dos,
 *    layer −2 ancré au crâne de profil.
 *  Un consommateur qui ne splitte pas rend les composantes d'affilée (dégradation sans trou :
 *  les séparateurs sont des commentaires SVG légaux). Producteur : cosmeticPart (cheveux). */
export const PART_BEHIND_SEP = '<!--@behind-->';
export const PART_DROP_SEP = '<!--@chute-->';
export function splitPartBehind(svg: string): { drop?: string; behind?: string; main: string } {
  let drop: string | undefined;
  let rest = svg;
  const d = rest.indexOf(PART_DROP_SEP);
  if (d >= 0) { drop = rest.slice(0, d) || undefined; rest = rest.slice(d + PART_DROP_SEP.length); }
  const i = rest.indexOf(PART_BEHIND_SEP);
  if (i < 0) return { drop, main: rest };
  return { drop, behind: rest.slice(0, i) || undefined, main: rest.slice(i + PART_BEHIND_SEP.length) };
}

/** Calque cosmétique additionnel attaché à un os (mutations, accessoires).
 *  Rendu PAR-DESSUS les parts, dans le repère local (échellé) de l'os. */
export interface RigOverlay {
  bone: BoneId;
  svg: string;
  /** dessiné DERRIÈRE la part de l'os (cornes derrière la tête, queue derrière le bassin,
   *  ventre derrière le torse) au lieu de par-dessus. */
  behind?: boolean;
  /** calque limité à une vue (détail de visage : groin, langue pendante… — de dos il
   *  flotterait sur la nuque). Absent = toutes vues. */
  view?: import('./facing').View;
  /** REMPLACE la part de l'os au lieu de se superposer (membre muté : bras → tentacule).
   *  `svg` vide = efface la part (le poing au bout d'un tentacule). */
  replace?: boolean;
  /** PLAN dédié dans le tri du peintre, dans le repère de l'os hôte : `fond` = derrière TOUT
   *  le corps (ailes de face — sinon le z inégal des bras en cache une), `avant` = devant tout
   *  (ailes vues de dos). Ignore `behind`/`replace`. */
  plane?: 'fond' | 'avant';
  /** id du registre APPENDAGES (cornes/queue MULTI-VUES) — quand présent, REMPLACE `svg`, résolu
   *  par vue via pickView. Même source/résolution que les features et monsterInjection. */
  appendage?: string;
}
