/**
 * FAVEURS — LDB 23 l.139-151, « FAITES-MOI UNE FAVEUR ! ». Noyau PUR : la forme d'une Faveur due et
 * le seuil d'Activités qui l'acquitte. Le flux (création, progression, rupture) vit dans
 * `noyau/favorFlow.ts` ; l'authoring de scène la pose par l'Effet `grantFavor`.
 */

export type FavorLevel = 'mineure' | 'majeure' | 'importante';

/** Une Faveur due par UN héros — la source parle au singulier (« vous », l.141 « votre Niveau ») :
 *  le débiteur qui a accepté la contrepartie porte la Faveur, pas le groupe. */
export interface Favor {
  id: string;
  heroId: string;
  level: FavorLevel;
  /** Qui est le créancier (PNJ, faction…). */
  owedTo: string;
  /** Nature de la Faveur (texte libre d'auteur/résolveur). */
  desc: string;
  /** Activités CONSÉCUTIVES déjà consacrées à l'acquittement (Majeure : « deux Activités
   *  consécutives ou plus », l.149) — fenêtre retenue et remise à 0 par
   *  `resetInterruptedFavorProgress` (`noyau/favorFlow.ts`). */
  progress: number;
}

/** Activités CONSÉCUTIVES requises pour acquitter par le biais d'Activités — `null` = jamais
 *  acquittable ainsi (Importante, l.151 : « jouées comme des aventures complètes »). */
export function favorRequiredActivities(level: FavorLevel): number | null {
  if (level === 'mineure') return 1; // l.147 : « vous pouvez entreprendre une Activité »
  if (level === 'majeure') return 2; // l.149 : « deux Activités consécutives ou plus »
  return null; // l.151
}
