/**
 * GRAMMAIRE d'une carte ASCII (format `walled` du `MapSpec`) — les glyphes que la LECTURE d'un plan
 * s'est réservés, et qu'aucune DONNÉE ne peut donc réclamer.
 *
 * Une carte s'écrit en box-drawing : les lignes/colonnes IMPAIRES portent les CASES, les PAIRES les
 * ARÊTES. Chaque glyphe ci-dessous est un mot de cette grammaire — il vaut la même chose dans le
 * lecteur (`noyau/monde/asciiMap.ts`), dans l'exporteur (`noyau/monde/sceneToAscii.ts`) et au schéma, qui refuse
 * qu'un terrain déclare son glyphe d'authoring (`terrains.json › ascii`) dans ce vocabulaire.
 *
 * La table vit à la GRAMMAIRE (`src/data/schemas`) parce que c'est le SCHÉMA qui la VALIDE (il refuse
 * qu'un terrain réclame un mot du plan) : un schéma se lit sans le store — il vaut au parse d'un
 * dataset, dans un test de donnée comme dans l'éditeur. La poser au lecteur (`noyau/monde/asciiMap.ts`)
 * ferait dépendre la validation d'une donnée de la couche qui la consomme.
 */

/** Les mots de la grammaire, par RÔLE — plusieurs chars quand le rôle en accepte plusieurs. */
export const GRAMMAIRE_ASCII = {
  /** Fond de l'étage : la `base` de la couche (le `.` d'écriture, l'espace des grilles rognées). */
  base: '. ',
  /** Mur plein sur une arête N (rangée paire). */
  murHorizontal: '-',
  /** Mur plein sur une arête E (colonne paire). */
  murVertical: '|',
  /** Coin de grille (intersection de deux rangées d'arêtes) — jamais porteur de sens. */
  jonction: '+',
  /** PORTE d'arête : franchissable au jeu, mur pour la lecture du plan. */
  porte: ':',
  /** FENÊTRE d'arête : mur plein serti d'une vitre (décoratif). */
  fenetre: 'o',
  /** Cloison DIAGONALE posée sur une CASE (et non sur une arête). */
  diagonales: '/\\',
} as const;

/** Le char de fond ÉCRIT par l'exporteur et les remplissages : `base` en accepte DEUX à la lecture
 *  (le `.` d'écriture et l'espace des grilles rognées), l'écriture en choisit un — celui-ci. */
export const FOND_ECRIT = GRAMMAIRE_ASCII.base[0];

/** Tous les glyphes RÉSERVÉS par la grammaire — jamais réattribués à un terrain, un matériau ou une
 *  zone, ni par la donnée (schéma de `terrains.json`) ni par l'allocateur de `sceneToAscii`. */
export const GLYPHES_RESERVES: ReadonlySet<string> = new Set(
  Object.values(GRAMMAIRE_ASCII).flatMap((mot) => mot.split('')),
);

/** Les glyphes réservés, en clair, pour un message de refus (`« . », « - », …`). */
export const glyphesReservesEnClair = (): string =>
  [...GLYPHES_RESERVES].map((c) => (c === ' ' ? '« espace »' : `« ${c} »`)).join(', ');
