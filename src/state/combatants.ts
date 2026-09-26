/**
 * RECHERCHE d'un combattant par id — les deux primitives partagées (`docs/primitives.md`) : `actorIn`
 * (combat OU groupe) et `inBattleId` (en combat seulement). Pure lecture d'état.
 *
 * Module VOLONTAIREMENT LÉGER (patron `targetingHolder`, #1054) : aucun import runtime vers
 * `src/state`, le type de l'état seulement. INVARIANT — `netOwnership` ne demande que « qui est ce
 * combattant ? » et doit pouvoir s'importer seul (énumérer `ROUTES` dans un script ou une garde CI
 * légère) ; or `combatOrParty` importe `targetingModes` pour son affordance de clic, donc le moteur
 * de combat, donc `store.ts` — chaîne runtime MESURÉE par la sonde (c) de
 * `netownership-import-isole.test.ts`. Ces primitives descendent donc ici, et la dépendance va du
 * LOURD vers le LÉGER : `combatOrParty` consomme ce module, jamais l'inverse. Le SEUL import runtime
 * admis vise `src/engine` (couche PURE, qui n'atteint jamais `src/state` — CLAUDE.md règle 3) : y
 * ajouter un import de `src/state` rouvre la chaîne et rend cette garde ROUGE.
 */
import { isOutOfAction } from '../engine/conditions';
import type { Combatant } from '../engine/types';
import type { Dir8 } from './dir8';
import type { GameState } from './store';

/**
 * TAILLE MAXIMALE du groupe — les quatre aventuriers de la campagne. Constante CANONIQUE : elle
 * vivait en `4` littéral sur cinq sites (recrutement, créateur, écran d'équipe) sans nom ; toute
 * borne d'emplacement de héros la cite désormais, jamais un chiffre.
 */
export const PARTY_MAX = 4;

/** Une valeur que son PRODUCTEUR garantit (acteur d'une étape, siège d'une table, arme d'un set, entrée
 *  de catalogue citée par un id fixe) : absente, c'est un défaut interne, levé en NOMMANT ce qu'on
 *  cherchait (`quoi`) et sous quel id (#1906) — jamais un affichage. */
export function garanti<T>(valeur: T | undefined | null, id: string | number | undefined, quoi: string): T {
  if (valeur === undefined || valeur === null) throw new Error(`[${quoi}] « ${String(id)} » introuvable alors que son producteur le garantit (#1906)`);
  return valeur;
}

/** Acteur d'une action joueur résolu dans le bon ensemble : file de combat si en combat, sinon le groupe. */
export function actorIn(state: GameState, id: string): Combatant | undefined {
  return (state.battle?.combatants ?? state.party).find((c) => c.id === id);
}

/**
 * Combattant EN COMBAT (`battle.combatants`) par id — distinct d'`actorIn` (combat OU groupe).
 * `battle` prend le type du champ `GameState['battle']` (nullable) : la plupart des call-sites tiennent
 * déjà un `battle` non-null en main (narrowed en amont), mais accepter le nullable rend la migration
 * mécanique (`inBattleId(battle, id)` remplace `battle.combatants.find(...)` sans changer les gardes
 * d'appel) plutôt que d'imposer un narrowing supplémentaire à chaque site. `id` accepte aussi
 * `undefined` (plusieurs sites cherchent un id OPTIONNEL, ex. `sourceId?`) — même repli honnête que
 * `.find` sur une valeur absente : ne matche jamais, retourne `undefined`.
 */
export function inBattleId(battle: GameState['battle'], id: string | undefined): Combatant | undefined {
  return id == null ? undefined : battle?.combatants.find((c) => c.id === id);
}

/**
 * COQUE par id — un navire vit dans la file de COMBAT quand il se bat (2026-07-16, verbatim
 * utilisateur : « Les navires sont des combattants oui, c’est déjà le cas non ? », fiche
 * `.claude/memory/user-arbitrage-navires-combattants.md`), et dans le PLAN DE TRAJET pendant un voyage
 * (`travelPlan.vehicle`, la coque transitoire qui encaisse les incidents). Ces deux hôtes sont les
 * seuls : `actorIn` couvre le premier, le second est hors du groupe. Sert la reconstitution du
 * contexte d'une étape de cascade née d'un Critique de coque (`meta.hullId` → `OpsCtx.hull`).
 */
export function coqueParId(state: GameState, id: string): Combatant | undefined {
  const vehicule = state.travelPlan?.vehicle;
  return actorIn(state, id) ?? (vehicule?.id === id ? vehicule : undefined);
}

/**
 * DEBOUT : le héros tient encore sur ses jambes. Composé du canonique du moteur `isOutOfAction`
 * (`engine/conditions.ts`, qui attrape mort, `outOfRencontre` et l'État Inconscient) et des Blessures
 * restantes — un héros à 0 Blessure reste EN JEU (À Terre, LDB 18 l.15) mais ne marche plus. Une
 * seconde définition de « hors d'action » ferait mener, pivoter et grimper un Inconscient. Prédicat
 * CANONIQUE de l'ÉLECTION DU MENEUR. Garde : `src/state/hero-debout-guard.test.ts`.
 */
export function estDebout(h: Combatant): boolean {
  return !isOutOfAction(h) && h.wounds.current > 0;
}

/**
 * NI MORT NI À TERRE (0 Blessure, LDB 18 l.15) — la population que mesure la PORTÉE DE SAUT du groupe
 * hors combat. Distincte d'`estDebout`, qui exclut en plus l'Inconscient : là, c'est l'élection du
 * meneur qui refuse un corps incapable de mener. Ici, un Inconscient porté compte encore : population
 * non sourcée, #1879.
 */
export function niMortNiATerre(h: Combatant): boolean {
  return !h.dead && h.wounds.current > 0;
}

/**
 * MENEUR du groupe hors combat : le premier héros encore debout, à défaut le premier du roster. C'est
 * lui que le jeton de groupe DESSINE et fait marcher, donc lui que suivent la caméra, le regard de
 * première personne, l'assise, le cap d'entrée de scène et les lampes portées par le groupe
 * (`state/visionState.ts` `sceneLightSources`). Définition UNIQUE — #1362 : tout lecteur du meneur
 * dans `src/state`, `src/gameIso`, `src/ui` passe par ici ; deux règles feraient marcher un jeton,
 * éclairer l'autre et pivoter un troisième. PRIVÉ : les appelants passent par `meneurDuMonde`.
 */
function partyLeaderOf(party: readonly Combatant[]): Combatant | undefined {
  return party.find(estDebout) ?? party[0];
}

/**
 * MENEUR DEBOUT — le même meneur, mais SANS le dernier repli sur le premier du roster : rend
 * `undefined` quand le groupe entier est à terre. Pour les gestes que seul un héros valide peut
 * accomplir (escalade, chute volontaire), qui refusent plutôt que de les faire accomplir par un
 * corps à terre. PRIVÉ : les appelants passent par `meneurDeboutDuMonde`.
 */
function partyLeaderDeboutOf(party: readonly Combatant[]): Combatant | undefined {
  const meneur = partyLeaderOf(party);
  return meneur && estDebout(meneur) ? meneur : undefined;
}

/**
 * Le groupe d'un état — la part de `GameState` que l'élection du meneur consomme, et la SEULE.
 * Signature la plus ÉTROITE qui suffise. Quand le meneur deviendra ÉLU, c'est ce type qui s'élargira :
 * les appelants qui passent l'état entier ne bougeront pas ; les deux qui construisent un littéral
 * `{ party }` (`gameIso/stage/MondeDeCampagne.tsx`, `state/visionState.ts` — ils n'ont que le roster
 * en main) devront lui donner le champ neuf.
 */
export type MondeDuMeneur = Pick<GameState, 'party'>;

/** MENEUR du monde, lu sur l'ÉTAT — signature de tous les lecteurs (`state`, `gameIso`, `ui`). */
export function meneurDuMonde(monde: MondeDuMeneur): Combatant | undefined {
  return partyLeaderOf(monde.party);
}

/** MENEUR DEBOUT du monde, lu sur l'ÉTAT — même meneur, sans le dernier repli (cf. `partyLeaderDeboutOf`). */
export function meneurDeboutDuMonde(monde: MondeDuMeneur): Combatant | undefined {
  return partyLeaderDeboutOf(monde.party);
}

/**
 * CLÉ du cap de GROUPE dans la table `facing`. Le groupe est UN sujet de cap, comme une coque : son
 * jeton d'exploration porte déjà cet id (`gameIso/tokenBodyKind.tsx`, clé de routage bus/facing du
 * jeton `partyLeader`). Le cap n'est donc keyé par AUCUN héros — aucune mutation du roster (Blessure,
 * Inconscience, ajout, remplacement, retrait) ne peut le désynchroniser. Préfixée `__` comme tout
 * sujet non-combattant : aucun id de héros ne la collisionne.
 */
export const CAP_GROUPE = '__party';

/**
 * CAP D'EXPLORATION, lu sur l'état : l'orientation du regard du groupe, ou `null` si aucune n'a
 * encore été posée (avant toute entrée de scène). Les lecteurs du regard hors combat passent par ici
 * — vue subjective, pivot, pas relatif, jeton du groupe. PUR.
 */
export function capDuGroupe(monde: Pick<GameState, 'facing'>): Dir8 | null {
  return monde.facing[CAP_GROUPE] ?? null;
}

/**
 * CAP D'EXPLORATION posé : hors combat, l'orientation du regard est UNE valeur du GROUPE, stockée
 * SOUS `CAP_GROUPE` et nulle part ailleurs. ÉCRIVAIN UNIQUE du cap d'exploration — entrée de scène,
 * marche, pivot, pas relatif et assise passent par ici ; `faceToward`/`faceFromPath` restent la couture
 * des caps INDIVIDUELS du combat. Les caps des combattants et des coques présents dans la table sont
 * conservés tels quels. PUR : rend la table suivante.
 */
export function poserCapDuGroupe(facing: Record<string, Dir8>, cap: Dir8): Record<string, Dir8> {
  return { ...facing, [CAP_GROUPE]: cap };
}
