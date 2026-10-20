/**
 * Poursuite — mécanique de « Distance » (Livre de base, Déplacement, LDB 15 l.86-108). Rien d'inventé :
 *
 *  1. Le MJ fixe la Distance de départ (1 = presque à portée … 8 = presque hors de portée).
 *  2. Chaque participant effectue un Test de Mouvement (Conduite d'Attelages / Chevaucher / Athlétisme
 *     selon les circonstances — la Compétence est passée en donnée, aucun nom en dur).
 *  3. « On compare le DR le plus PETIT obtenu par les poursuivis au plus HAUT DR obtenu par les
 *     poursuivants, et la différence est ajoutée à la Distance si les poursuivis l'ont emporté et
 *     retranchée si ce sont les poursuivants qui l'ont emporté » ⇒ Distance += (min DR fuyards − max DR
 *     poursuivants).
 *  4. Distance ≤ 0 → rattrapés ; Distance ≥ 10 → semés ; sinon la poursuite continue (l.94).
 *  5. Modificateur de Mouvement (l.104-108) : un participant plus rapide gagne autant de DR bonus que sa
 *     différence de Mouvement avec le plus lent de la course (M8/M7/M9 → +1 / 0 / +2 relatifs au plus lent).
 *  6. Rattrapés (l.94) : trois décisions de camp + un recalcul de Distance — cf. `PursuitPolicy` et
 *     `pursuitLaggard` ci-dessous, et la fiche `docs/raw/4e/deplacement.md` (§ Poursuites, Étape 4).
 *
 * La résolution d'issue (`pursuitOutcome`) est la PRIMITIVE PARTAGÉE terrestre/navale (la poursuite navale
 * MDG 13 calcule son « gain » de Distance différemment — en mètres — mais franchit les MÊMES seuils).
 * PUR : ne mute rien, ne roule rien — les jets se tiennent chez l'appelant (`noyau/pursuitFlow`), qui les
 * surface. Ce module est LA source des jugements de poursuite.
 */

/** Seuil d'évasion terrestre RAW : « Si la Distance atteint 10+, les poursuivants ont perdu leur proie » (l.94). */
export const PURSUIT_ESCAPE_DISTANCE = 10;

/** Issue d'un Round de poursuite selon la Distance courante — SOURCE UNIQUE partagée terrestre/navale. */
export function pursuitOutcome(distance: number, escapeAt: number = PURSUIT_ESCAPE_DISTANCE): 'caught' | 'escaped' | 'ongoing' {
  if (distance <= 0) return 'caught';
  if (distance >= escapeAt) return 'escaped';
  return 'ongoing';
}

/** Bonus de DR de vitesse (l.104-108) : différence de Mouvement avec le plus lent de la course. */
export function pursuitMoveBonus(movement: number, slowestMovement: number): number {
  return Math.max(0, movement - slowestMovement);
}

/** UN coureur, réduit à ce dont les jugements ont besoin : qui il est, son Mouvement, son DR total de
 *  manche (Test + bonus de vitesse). `label` est de l'AFFICHAGE — aucune logique ne s'y key. */
export interface PursuitRunner {
  id: string;
  label: string;
  movement: number;
  total: number;
}

/** Un adversaire de la poursuite (côté opposé au groupe) — Mouvement (bonus de DR de vitesse, l.105-108)
 *  et valeur de Test de Mouvement. `label` = affichage (aucune logique keyée dessus) ; `id` est posé à
 *  l'ouverture (l'auteur n'a pas à en écrire un) et sert aux décisions de camp (l.94). */
export interface PursuitFoe {
  id?: string;
  label: string;
  movement: number;
  skill: number;
}

/** « le plus lent d'entre eux » (l.94) : le coureur au plus petit Mouvement du camp ; à Mouvement égal,
 *  le plus petit DR de la manche (il traîne le plus). `undefined` sur un camp vide ou d'un seul coureur
 *  — sacrifier le dernier fuyard ne laisserait personne à qui profiter de la manœuvre. */
export function pursuitLaggard(runners: readonly PursuitRunner[]): PursuitRunner | undefined {
  if (runners.length < 2) return undefined;
  return [...runners].sort((a, b) => a.movement - b.movement || a.total - b.total)[0];
}

/**
 * POLITIQUE DE CAMP PNJ (valeur MAISON, éditable à l'Effet `startPursuit`) — le RAW l.94 laisse ces
 * trois décisions AUX CAMPS ; un camp tenu par le jeu doit donc trancher sans MJ (règle 7). Les valeurs
 * par défaut sont dans `PURSUIT_POLICY_DEFAUT` (`noyau/pursuitFlow`), et chaque scène peut les changer.
 */
export interface PursuitPolicy {
  /** Les poursuivis PNJ sacrifient leur plus lent : `toujours` (DÉFAUT — la voie de l'exemple
   *  canonique, l.100), `jamais` (un camp qui ne lâche aucun des siens), ou `si-ecart` (retenue :
   *  seulement quand le plus lent a `ecartM` points de Mouvement de retard sur le plus rapide de son
   *  camp). Le sacrifice ne s'explique PAS par l'allègement du camp : il sert « à ralentir les
   *  poursuivants » (l.94) — le retardataire OCCUPE la chasse pendant que les autres fuient, ce qui
   *  vaut quelles que soient les vitesses. */
  sacrifice?: 'jamais' | 'toujours' | 'si-ecart';
  /** Écart de Mouvement qui déclenche le sacrifice en mode `si-ecart` (retenue opt-in). */
  ecartM?: number;
  /** Le poursuivant PNJ qui s'arrête pour affronter le sacrifié : le plus lent du camp (les plus
   *  rapides restent en chasse), ou aucun (tous continuent). */
  arret?: 'le-plus-lent' | 'aucun';
  /** Ids des CIBLES PRIORITAIRES de la poursuite (l.94 : « Si le pauvre retardataire n'est pas une
   *  cible prioritaire, il se peut qu'il soit purement et simplement ignoré ! »). Liste ABSENTE ou vide
   *  = aucune priorité déclarée, donc personne n'est ignoré. */
  prioritaires?: string[];
}

/** Décision (a) d'un camp de poursuivis PNJ, l.94 : sacrifier le plus lent, ou s'arrêter et affronter. */
export function npcSacrificeChoice(policy: PursuitPolicy, laggard: PursuitRunner | undefined, camp: readonly PursuitRunner[]): 'sacrifier' | 'affronter' {
  if (!laggard) return 'affronter';
  const mode = policy.sacrifice ?? 'toujours';
  if (mode === 'jamais') return 'affronter';
  if (mode === 'toujours') return 'sacrifier';
  const rapide = Math.max(...camp.map((r) => r.movement));
  return rapide - laggard.movement >= (policy.ecartM ?? 1) ? 'sacrifier' : 'affronter';
}

/** Décisions (b)+(c) d'un camp de poursuivants PNJ, l.94 : qui s'arrête pour affronter le sacrifié —
 *  ou le retardataire est IGNORÉ (il n'est pas une cible prioritaire) et tous continuent. */
export function npcPursuerChoice(
  policy: PursuitPolicy,
  laggard: PursuitRunner,
  camp: readonly PursuitRunner[],
): { go: 'ignorer' } | { go: 'arreter'; who: PursuitRunner } {
  const prioritaires = policy.prioritaires ?? [];
  if (prioritaires.length && !prioritaires.includes(laggard.id)) return { go: 'ignorer' };
  if ((policy.arret ?? 'le-plus-lent') === 'aucun' || !camp.length) return { go: 'ignorer' };
  const who = [...camp].sort((a, b) => a.movement - b.movement)[0];
  return { go: 'arreter', who };
}
