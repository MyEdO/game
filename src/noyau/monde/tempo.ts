/**
 * Tempo du combat — délais de chorégraphie CENTRALISÉS (fin des nombres magiques dispersés
 * 350/450/500/750 dans combatFlow). Un seul endroit pour régler le rythme.
 *
 * Ce sont les BASES : le Réalisateur (`combatDirector.beatHold`) les lit et les ALLONGE sur un temps
 * fort (critique / mise à mort / Peur) pour qu'on ait le temps de le lire. Valeurs recentrées vers une
 * lecture humaine (un combat doit être lisible : chaque beat visible et annoncé).
 *
 * NB : le déplacement animé NE se cale PAS sur un délai fixe mais sur la durée RÉELLE de marche
 * (`walkMs(path)` de `geometry/walk`) — c'est ce qui supprime la « téléportation » perçue
 * (la modale de défense ne s'ouvre qu'une fois l'ennemi arrivé).
 */
export const TEMPO = {
  /** Réticule de tir/sort/mêlée ennemi affiché AVANT l'action (télégraphe d'intention — lire « qui vise qui »). */
  aimTelegraph: 850,
  /** Chemin + destination d'un déplacement ennemi montrés AVANT qu'il glisse (lire « où il va »). */
  moveTelegraph: 400,
  /** Beat avant de résoudre une attaque (laisse voir l'amorce). */
  preAttack: 450,
  /** Beat après une attaque résolue, avant de passer la main (tenue du RÉSULTAT — mort/crit y atterrissent). */
  postAttack: 700,
  /** Beat après un déplacement, avant la suite (attaque ou fin de tour). */
  afterMove: 400,
  /** Passage au tour de l'IA (laisse enregistrer le changement d'actif, « au tour de X »). */
  turnHandoff: 650,
  /** Avant `advanceTurn` après une action instantanée de l'IA (incantation, reprise…). */
  enemyAdvance: 650,
  /** Cadence Rapide/Auto : beat entre deux étapes auto-résolues (jet → application), laisse lire le résultat. */
  autoResolve: 340,
} as const;
