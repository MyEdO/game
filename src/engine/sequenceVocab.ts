/**
 * VOCABULAIRE DE SÉQUENCE — les FORMES DE DONNÉE qu'une entrée de catalogue peut déclarer pour se
 * faire jouer en manches (#1279). Elles vivent dans le MOTEUR parce que ce sont des données de
 * RÈGLE, lues des deux côtés de la frontière : par les catalogues du moteur (`tavernGame.ts` et son
 * `tavernGames.json`) et par le contrat d'orchestrateur du store (`state/sequenceContract.ts`), qui
 * les republie dans ses `SequenceParams`. Aucune logique ici : ce fichier ne fait que DIRE.
 */
import type { CharKey, Difficulty } from './types';
import type { GameOp } from './ops';

/** UNE LIGNE de table de score par PLAGE de DR — lue par `findTableEntry` (`engine/tables.ts`).
 *  Torchon trempé (NADJ 16 l.111) : jambe 1 point, corps 2 points à partir de 3 DR, tête 3 points à
 *  partir de 6 DR. `label` est de l'AFFICHAGE (la logique lit `points`). */
export interface SequenceTableRow {
  min: number;
  max: number;
  points: number;
  label: string;
}

/** EFFETS PAR MANCHE, en DONNÉE : `winner` va au vainqueur de la manche ; `attrition` va à TOUS les
 *  participants toutes les `attritionEvery` manches — nombre fixe, ou Bonus de Caractéristique DU
 *  PORTEUR (Bras de fer NADJ 16 l.34 : « Pour chaque Bonus d'Endurance tours qui passent sans que
 *  personne n'ait gagné, vous gagnez + 1 État *Exténué* »). */
export interface SequenceRoundOps {
  winner?: readonly GameOp[];
  attrition?: readonly GameOp[];
  attritionEvery?: number | { charBonus: CharKey };
}

/** PHASES d'une séquence (mi-temps, sets) : `count` phases de `rounds` manches chacune. Middenball
 *  NADJ 16 l.119 : « Une partie dure deux mi-temps de trois tours chacune ». */
export interface SequencePhases {
  count: number;
  rounds: number;
}

/* ── FAMILLE (5) : MISE, POT, ABANDON, ÉLIMINATION ───────────────────────────────────────────────
 * Une séquence où l'on ne compte pas des DR mais de l'ARGENT : chaque joueur ALIMENTE un pot, un
 * tour de dés le fait grossir, se vider ou changer de mains, et un joueur peut en SORTIR (de son gré
 * ou contraint). Premier client : l'Al-zahr (`NADJ 16 l.17`).
 *
 * FORME — directive utilisateur du 2026-08-13 (verbatim au ticket #1279) : « Comme les games iOS
 * [GameOps], rendre le vocabulaire le plus générique et parametrable possible ». D'où : aucun champ
 * ne nomme son premier client, chaque mécanisme est PARAMÉTRÉ (combien de dés, quelle plage de
 * cible, combien de mises déplace un effet, combien de manches par joueur), et l'EFFET d'une plage
 * est un NOM ENREGISTRÉ résolu par une fonction pure — exactement le patron `GameOp` : un verbe
 * générique + ses paramètres, jamais un cas d'usage figé au type. Un jeu à enchère N+1 dont les
 * mécanismes existent déjà est une entrée JSON, zéro ligne de TS. */

/** Les DÉS d'un tour : `count` dés de `faces` faces, totalisés. */
export interface SequenceDice {
  count: number;
  faces: number;
}

/** UNE PLAGE de résultat du tour et l'EFFET qu'elle déclenche — `potEffectId` est le nom d'un effet
 *  ENREGISTRÉ (`registerSequencePotEffect`, `state/sequenceCore`), jamais un id de jeu, et `mises`
 *  le PARAMÈTRE que cet effet applique (combien de mises il déplace, défaut 1). `label` est de
 *  l'AFFICHAGE. */
export interface SequencePotRow {
  min: number;
  max: number;
  potEffectId: string;
  /** Nombre de MISES que l'effet déplace (reprise dans le pot, remise à payer) — défaut 1. */
  mises?: number;
  label: string;
}

/** RÈGLES DE POT d'une séquence, en donnée. */
export interface SequencePotRules {
  dice: SequenceDice;
  /** Plage dans laquelle se choisit le NOMBRE CIBLE, quand la séquence en joue un. Absente : aucune
   *  cible n'est annoncée, et les effets qui la lisent ne se déclarent pas. */
  targetRange?: { min: number; max: number };
  /** Plages du tour, lues par `findTableEntry` sur le total des dés. */
  rows: readonly SequencePotRow[];
  /** Manches d'une partie PAR JOUEUR assis à la table (défaut 1 — chacun en ouvre une). */
  manchesPerPlayer?: number;
  /** TOURS qu'une manche peut prendre avant que l'anti-boucle du socle ne coupe la partie. Ce n'est
   *  PAS une règle : c'est l'unité de borne de cette famille — un tour n'y est qu'un lancer de dés,
   *  quand le socle, lui, compte des manches de Test opposé. La borne effective de la séquence s'en
   *  dérive (manches × ce nombre), sous le plafond absolu du contrat. */
  roundsPerManche?: number;
}

/** CE QUE VOIT un effet : le total des dés, la cible en cours, la mise unitaire, le pot, et le
 *  paramètre `mises` de SA plage — tout l'argent en sous de cuivre. PUR : un effet ne lit rien
 *  d'autre, et ne connaît ni joueur ni bourse. */
export interface SequencePotTurn {
  roll: number;
  target: number;
  ante: number;
  pot: number;
  mises: number;
}

/** CE QUE REND un effet — chaque champ est une CONSÉQUENCE possible d'un tour ; le réducteur du
 *  domaine les applique, l'effet ne mute rien. */
export interface SequencePotOutcome {
  /** Le joueur remporte la manche et empoche le pot. */
  wins?: boolean;
  /** Le joueur reprend ce montant (sous) du pot, la manche continue. */
  takes?: number;
  /** Le joueur quitte la manche. */
  out?: boolean;
  /** Le joueur doit trancher : payer `owes` pour rester, ou abandonner la manche. */
  choose?: boolean;
  /** Ce que coûte le maintien dans la manche (sous) — lu avec `choose`. */
  owes?: number;
  /** Nouvelle cible pour le joueur suivant. */
  target?: number;
}

/* ── FAMILLE (7) : VOLÉE — un PASSAGE de lancers en nombre fixe ──────────────────────────────────
 * Une séquence où l'on ne s'oppose pas manche par manche : chacun son PASSAGE de N lancers, chaque
 * lancer rapporte, et le total décide. Premiers clients : `NADJ 16 l.42`, `l.70`, `l.97`, `l.57`.
 *
 * FORME — directive utilisateur du 2026-08-13 (verbatim au ticket #1279) : « Comme les games iOS
 * [GameOps], rendre le vocabulaire le plus générique et parametrable possible ». D'où : aucun champ
 * ne nomme son premier client, et ce que RAPPORTE un lancer est un NOM ENREGISTRÉ résolu par une
 * fonction pure (`registerSequenceThrow`, `state/sequenceCore`) — patron `GameOp` et patron des
 * effets de pot (famille 5) : un verbe générique + ses paramètres. Un jeu de lancers N+1 dont les
 * verbes existent déjà est une entrée JSON, zéro ligne de TS.
 */

/** UNE LIGNE de volée : ce qui règle un lancer (Difficulté) et ce qu'il rapporte (points). `min`/`max`
 *  n'existent que pour les lignes DÉSIGNÉES par une grandeur (`pick: 'reserve'`, lues par
 *  `findTableEntry`) ; une ligne que le LANCEUR choisit (`pick: 'choix'`) n'a pas de plage. `label`
 *  est de l'AFFICHAGE. */
export interface SequenceVolleyRow {
  min?: number;
  max?: number;
  difficulty?: Difficulty;
  points?: number;
  label: string;
}

/** RÈGLES DE VOLÉE d'une séquence, en donnée. */
export interface SequenceVolleyRules {
  /** Lancers d'un passage. */
  throws: number;
  /** RÉSERVE d'un passage — ce qu'il reste à prendre. Un effet ÉCRÊTANT y borne son gain, et la
   *  réserve décroît d'autant ; épuisée, le passage s'arrête (il n'y a plus rien à prendre).
   *  Absente : aucune réserve, aucun écrêtage. */
  reserve?: number;
  /** Ce qui DÉSIGNE la ligne d'un lancer : la RÉSERVE restante (`findTableEntry`), ou le LANCEUR. */
  pick?: 'reserve' | 'choix';
  rows?: readonly SequenceVolleyRow[];
  /** Effet ENREGISTRÉ d'un lancer ORDINAIRE (`registerSequenceThrow`). */
  gain: string;
  /** Effet ENREGISTRÉ d'une réussite EXCEPTIONNELLE — un double sur un Test réussi (`NADJ 16 l.7`). */
  critique?: string;
  /** Effet ENREGISTRÉ d'un échec EXCEPTIONNEL — un double sur un Test raté (`NADJ 16 l.7`). */
  maladresse?: string;
  /** PLAGE d'un gain que le lanceur fixe LIBREMENT (lue par l'effet qui l'offre). */
  libre?: { min: number; max: number };
  /** TOTAL EXACT visé : le camp qui l'atteint conclut, et un gain qui le DÉPASSE déclenche
   *  `depassement`. Absent : aucune cible exacte, les totaux se comparent au bout des manches. */
  exact?: number;
  /** Effet ENREGISTRÉ du gain qui dépasse `exact`. Absent : le gain passe tel quel. */
  depassement?: string;
  /** Passages complets PRÉVUS par la règle. */
  manches?: number;
  /** ORDRE de passage : DÉCLARÉ (le challenger ouvre) ou TIRÉ AU SORT (`NADJ 16 l.97` : « jetez une
   *  pièce de monnaie pour déterminer qui joue en premier »). */
  ordre?: 'declare' | 'tirage';
  /** BORNE en passages, quand la règle n'en fixe aucun (séquence à cible EXACTE). Ce n'est PAS une
   *  règle : c'est l'unité de borne de cette famille — un tour n'y est qu'UN lancer d'UN joueur,
   *  quand le socle, lui, compte des manches. La borne effective s'en dérive (passages × lanceurs ×
   *  lancers), sous le plafond absolu du contrat. */
  manchesBorne?: number;
}

/** CE QUE VOIT un effet de lancer — le jet, son DR (plafond et Bonus déjà appliqués), ses formes
 *  exceptionnelles, la réserve restante, le score acquis, la ligne désignée et la plage libre. PUR :
 *  un effet ne lit rien d'autre, et ne connaît ni joueur ni camp. */
export interface SequenceThrowTurn {
  roll: number;
  sl: number;
  success: boolean;
  critique: boolean;
  maladresse: boolean;
  reserve?: number;
  points: number;
  row?: SequenceVolleyRow;
  rowIndex?: number;
  rows: readonly SequenceVolleyRow[];
  libre?: { min: number; max: number };
  /** Gain DÉJÀ calculé, quand l'effet est rappelé pour en juger (dépassement de la cible exacte). */
  gain?: number;
}

/** CE QUE REND un effet de lancer — le réducteur du domaine l'applique, l'effet ne mute rien. */
export interface SequenceThrowOutcome {
  /** Ce que le lancer rapporte. */
  gain?: number;
  /** Le passage du lanceur s'arrête là (ses lancers restants ne sont pas joués). */
  ends?: boolean;
  /** Le LANCEUR tranche son gain parmi ces valeurs (le RAW lui en laisse la main). */
  choix?: readonly number[];
  /** Le LANCEUR fixe LIBREMENT son gain dans cette PLAGE (« autant de points que vous le souhaitez,
   *  entre 1 et 100 points », `NADJ 16 l.97`) — distinct de `choix` : une plage n'est pas une liste
   *  de valeurs, et l'énumérer en ferait 100 boutons. Le domaine la sert en SAISIE numérique
   *  (interaction `'quantite'` de la coquille de cascade). */
  libre?: { min: number; max: number };
}

/* ── FAMILLE (8) : CAMPS ASYMÉTRIQUES — chacun sa CONVERSION et sa prise ─────────────────────────
 * Une séquence où les deux camps ne jouent pas le même jeu : le total d'une manche s'y CONVERTIT en
 * prises sur l'adversaire, selon un diviseur propre au camp, et la partie se gagne quand un camp a
 * pris plus de la moitié des pièces d'en face (`NADJ 16 l.25-28`). */
export interface SequenceSide {
  /** Id du camp (donnée : écrit dans les saves). */
  id: string;
  label: string;
  /** PIÈCES du camp — ce que l'ADVERSAIRE doit lui prendre. */
  pieces: number;
  /** DIVISEUR du total de manche pour obtenir la prise (arrondi au SUPÉRIEUR). */
  div: number;
  /** MULTIPLICATEUR du dé des unités dans la condition de victoire exceptionnelle. */
  mult: number;
}

/* ── FAMILLE (9) : TEST COMBINÉ À CONSÉQUENCES DISTINCTES ────────────────────────────────────────
 * UN seul dé, DEUX lectures, et chacune sa conséquence propre (`LDB 12 l.202-208` : « Faire un seul Test, en
 * comparant donc un unique jet de pourcentage avec la valeur de ces deux Compétences » ; `NADJ 16 l.90`). La première lecture
 * est le Test que la séquence joue déjà (Compétence/Difficulté de l'entrée) ; la seconde est déclarée
 * ici, avec ce qu'elle coûte quand elle échoue et le RYTHME auquel ce coût se paie. */
export interface SequenceCombinedRules {
  /** La SECONDE valeur confrontée au même dé (Compétence ou Caractéristique). */
  second: { skill?: string; spec?: string; char?: CharKey };
  /** Tous les combien d'échecs de la SECONDE lecture les `ops` se paient (`NADJ 16 l.90` : « Pour
   *  chaque 3 Tests d'Initiative auxquels vous échouez »). 0/absent : à chaque échec. */
  failEvery?: number;
  /** Tous les combien de MARQUES effacées les `ops` se paient (`l.90` : « pour chaque 2 chouettes que
   *  vous effacez »). */
  eraseEvery?: number;
  /** Ce que coûte l'échéance (échecs cumulés, ou marques effacées) — appliqué au porteur. */
  ops?: readonly GameOp[];
  /** Le camp qui obtient le MOINS de DR à la première lecture prend une MARQUE (`l.90`). */
  markLoser?: boolean;
  /** État dont l'apparition ARRÊTE la partie avant terme — id d'`etats.json`, DÉCLARÉ (le code ne
   *  nomme aucun État). Cerevis l.88 : « peuvent envoyer même les buveurs les plus chevronnés rouler
   *  sous la table ». */
  stopCondition?: string;
  /** TOURS de la partie. ARBITRAGE MAISON ÉDITABLE : la source ne dit PAS quand la partie s'arrête
   *  (`l.90` s'achève sur le Tableau Ivre) — ce nombre est de la donnée, jamais du RAW. */
  tours?: number;
}

/* ── FAMILLE (10) : SANCTION DU LANCEUR QUI MANQUE ───────────────────────────────────────────────
 * Une manche à UN lanceur (`roundShape: 'thrower'`) dont le coup manqué se paie : un Test de plus,
 * ce que son échec applique au lanceur, et ce qu'il coûte à son camp (`NADJ 16 l.111`). Rien ici ne
 * nomme son premier client — un second jeu à lanceurs dont la sanction diffère est une entrée JSON.
 */
export interface SequenceThrowerPenalty {
  /** Le Test que doit passer le lanceur qui a manqué (« un Test de **Résistance à l'alcool
   *  Intermédiaire (+0)** », `NADJ 16 l.111`). */
  test: { skill?: string; spec?: string; char?: CharKey };
  difficulty: Difficulty;
  /** Intitulé du geste qui accompagne ce Test — AFFICHAGE (« Descendre une pinte »). */
  label?: string;
  /** Points RETIRÉS au camp du lanceur quand ce Test échoue (l.111 : « votre équipe perd 1 point »).
   *  Absent/0 : l'échec ne coûte aucun point. */
  points?: number;
  /** Ce que l'échec applique au LANCEUR (`GameOp[]`). */
  ops?: readonly GameOp[];
  /** BALAYAGE FINAL (l.111) — points RETIRÉS à son camp par chaque lanceur qui n'a pas roulé sur le
   *  Tableau d'Ivresse à la fin de la partie. Le PRÉDICAT reste au moteur (`engine/drunkenness`) :
   *  ce nombre en est le prix, et son absence éteint le balayage. */
  sobrietyPoints?: number;
  /** LE RÉCIT de la sanction, en DONNÉE — gabarits interpolés par le socle i18n (`interpolate`), au
   *  même titre que les `label` des autres familles (`SequencePotRow`, `SequenceVolleyRow`). Sans
   *  eux, un second jeu à lanceurs raconterait la pinte de bière du premier. Chaque gabarit reçoit
   *  les paramètres de SA situation :
   *   · `manque`   — le coup manqué : `{who}` ;
   *   · `reussite` — le Test de sanction RÉUSSI : `{who}` ;
   *   · `echec`    — le Test ÉCHOUÉ : `{who}`, `{points}`, `{s}` (marque du pluriel) ;
   *   · `balayage` — le balayage final : `{mien}`, `{sien}`, `{perteMien}`, `{perteSien}`.
   *  Un gabarit absent : la situation ne se raconte pas (aucune ligne inventée). */
  lines?: { manque?: string; reussite?: string; echec?: string; balayage?: string };
}
