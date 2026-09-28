import type { HairArt } from '../hairstyles/types';
import type { ViewSet } from '../types';

/**
 * Une TÊTE = un fichier `defs/<Race>-<Sexe>.ts`. Art de face du VISAGE (variantes) + coiffure par
 * DÉFAUT de l'espèce, en jetons @peau/@cheveux (recoloriés par la palette de race). Clé `key` =
 * 'Race:Sexe' (== `baseSpeciesOf(species):sex`) → auto-matché par `cosmeticPart`. `visage` est un
 * TABLEAU de variantes (≥1) choisi par seed/override (bouton « Variante » du créateur) — MÊME
 * convention que le pool de coiffures. La coiffure par défaut porte SES vues (cf. `HairArt`,
 * profil/dos/`behind` compris). `crane` (optionnel) surcharge le crâne de dos générique (cosmetic.ts)
 * pour une espèce dont la boîte crânienne diverge (ex. crâne allongé) — absent = défaut générique en
 * jetons. Le PROFIL du visage reste générique (D4 : pas de visage de dos, `PROFILE_FACE`).
 */
export type HeadDef = { key: string; visage?: string[]; cheveux?: HairArt; crane?: ViewSet };
