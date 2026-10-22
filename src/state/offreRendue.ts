/**
 * CE QU'UNE PASTILLE REND (#1687 lot 3-I-b) — l'invariant d'AFFICHAGE d'un geste offert sur son
 * porteur, indépendant de qui le produit.
 *
 * Deux producteurs, un seul consommateur : le registre des actions de COMBAT (`registreOffres`,
 * `Offre` avec son `ActionDef` et ses arguments de dispatch) et le dériveur d'EXPLORATION
 * (`noyau/interactionsDExploration.offresDExploration` + `jouerAction`, via `offresUtilisables`) projettent tous deux
 * ici ; `gameIso/stage/PastilleEntite` et le panneau borné n'en lisent rien d'autre. Un producteur
 * N+1 ne touche ni la pastille ni le panneau — il rend cette forme.
 *
 * L'ENGAGEMENT est déjà encapsulé (`onSelect`) : la pastille ne connaît ni id d'action, ni porte du
 * registre, ni store — elle peint un libellé, un coût, un verdict, et commet.
 *
 * FEUILLE : des types et rien d'autre (aucun import runtime).
 */

/** Verdict d'une offre : ouverte, ou refusée AVEC sa raison (loi du refus visible, 2026-08-19). */
export interface PorteDOffre {
  ok: boolean;
  reason?: string;
}

/** UNE offre telle qu'elle se PEINT : de quoi la lire, la refuser, et la commettre. */
export interface OffreRendue {
  /** Clé STABLE de l'offre chez son porteur (id d'action, ou action + candidat au combat). */
  id: string;
  /** Libellé de l'ACTION (« Monter », « Fouiller ») — ce que le joueur lit. */
  label: string;
  /** Icône de l'action quand elle en a une (le registre de combat en porte une ; une action authorée
   *  d'exploration n'en déclare aucune — la pastille se peint alors sans glyphe). */
  icon?: string;
  /** Coût dans l'économie du tour, en toutes lettres ; `null` quand l'acte n'en prend aucun (hors
   *  combat, aucun geste n'en prend). */
  cost?: string | null;
  gate: PorteDOffre;
  /** Nom du CANDIDAT quand un même porteur en offre plusieurs (une pièce parmi deux, un objet d'un tas). */
  candidat?: string;
  /** COMMET l'offre — la porte du producteur, déjà refermée sur ses arguments. */
  onSelect: () => void;
}

/** Les offres d'un PORTEUR, telles qu'elles se peignent au-dessus de lui. */
export interface OffresRenduesParPorteur {
  porteurId: string;
  /** Nom du porteur à l'écran — celui que l'infobulle unique du jeu affiche au survol de la pastille. */
  porteurLabel?: string;
  offres: OffreRendue[];
}
