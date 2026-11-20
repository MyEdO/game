import type { Echeance } from './stock.mjs';

/** Le lot appartient à l'ensemble fermé des lots de #1486. */
export interface SiteVocab extends Echeance {
  /** Chemin POSIX depuis la racine du dépôt. */
  fichier: string;
  /** Libellé de la famille qui a signalé le site — TROISIÈME composante de la clé (un commentaire à
   *  deux motifs = deux lignes de stock). */
  motif: string;
  /** Ancre de TEXTE recopiée du commentaire (jamais un numéro de ligne). */
  ancre: string;
}

export const LEGACY_VOCAB_SITES: SiteVocab[];
