/**
 * RECHERCHE d'un combattant par id — les deux primitives partagées (`docs/primitives.md`) : `actorIn`
 * (combat OU groupe) et `inBattleId` (en combat seulement). Pure lecture d'état.
 *
 * Module VOLONTAIREMENT LÉGER (patron `targetingHolder`, #1054) : AUCUN import runtime, le type de
 * l'état seulement. INVARIANT — `netOwnership` ne demande que « qui est ce combattant ? » et doit
 * pouvoir s'importer seul (énumérer `ROUTES` dans un script ou une garde CI légère) ; or
 * `combatOrParty` importe `targetingModes` pour son affordance de clic, donc le moteur de combat,
 * donc `store.ts` — chaîne runtime MESURÉE par la sonde (c) de `netownership-import-isole.test.ts`.
 * Ces deux primitives descendent donc ici, et la dépendance va du LOURD vers le LÉGER :
 * `combatOrParty` consomme ce module, jamais l'inverse. Y ajouter un import runtime rouvre la
 * chaîne et rend cette garde ROUGE.
 */
import type { Combatant } from '../engine/types';
import type { GameState } from './store';

/**
 * TAILLE MAXIMALE du groupe — les quatre aventuriers de la campagne. Constante CANONIQUE : elle
 * vivait en `4` littéral sur cinq sites (recrutement, créateur, écran d'équipe) sans nom ; toute
 * borne d'emplacement de héros la cite désormais, jamais un chiffre.
 */
export const PARTY_MAX = 4;

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
 * MENEUR du groupe hors combat : le premier héros encore debout, à défaut le premier du roster. C'est
 * lui que le jeton de groupe DESSINE et fait marcher, et
 * donc lui que suivent la caméra et les lampes portées par le groupe (`state/visionState.ts`
 * `sceneLightSources`). Définition UNIQUE : deux règles feraient marcher un jeton et éclairer l'autre.
 */
export function partyLeaderOf(party: readonly Combatant[]): Combatant | undefined {
  return party.find((h) => !h.dead && h.wounds.current > 0) ?? party[0];
}
