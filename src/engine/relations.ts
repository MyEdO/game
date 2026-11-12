/**
 * Camp & relation entre combattants — SOURCE UNIQUE de la notion de « camp », dérivée du `Combatant.kind`
 * (`heros` = groupe joueur, `pnj` = neutre, `ennemi` = hostile). Les comparaisons `kind` éparses
 * (psychologie, ciblage, IA) expriment la MÊME idée ; cette brique la nomme une fois pour que la donnée
 * authorée (Condition Flow `relation`) ET le code partagent un seul vocabulaire.
 */
import type { Combatant } from './types';

/** Camp ABSOLU d'un combattant (indépendant d'un observateur). */
export type Camp = 'groupe' | 'neutre' | 'hostile';
export const campOf = (c: Pick<Combatant, 'kind'>): Camp =>
  c.kind === 'heros' ? 'groupe' : c.kind === 'pnj' ? 'neutre' : 'hostile';

/** Côté d'une confrontation vu des Personnages : le leur (`allie`) ou l'autre (`ennemi`) — armée d'une bataille de
 *  masse, membre de rencontre, poste, portrait, ligne de récit. */
export type Equipe = 'allie' | 'ennemi';

/** Relation RELATIVE de `a` envers `b` : soi-même, allié (même camp) ou adversaire (camp différent).
 *  Structurel (id + camp) pour être consommable par les vues d'acteur (`ActorView`) comme par les
 *  `Combatant` (via `campOf`). */
export type Relation = 'soi' | 'allie' | 'adversaire';
export const relationBetween = (a: { id: string; camp: Camp }, b: { id: string; camp: Camp }): Relation =>
  a.id === b.id ? 'soi' : a.camp === b.camp ? 'allie' : 'adversaire';

/** `a` est-il ACTUELLEMENT hostile à `b` ? Hostilité EFFECTIVE, jamais par `kind` (arbitrage
 *  utilisateur 2026-08-03, verbatim au ticket #1029) : on ne peut contrer que le sort d'un
 *  combattant actuellement hostile. [entériné 2026-08-03] Maison. PUR. */
export const effectivelyHostile = (a: Combatant, b: Combatant): boolean =>
  relationBetween({ id: a.id, camp: campOf(a) }, { id: b.id, camp: campOf(b) }) === 'adversaire';

/** Ce combattant suit-il les règles de PERSONNAGE (#143) ? — prédicat UNIQUE, DISTINCT du camp
 *  (`campOf`, ci-dessus) et du contrôle (`pilotedByHuman`/`controlsCombatant`, netOwnership.ts).
 *  Gouverne des mécaniques écrites au Personnage dans la source, jamais étendues aux créatures
 *  génériques : Corruption (LDB 19), composant d'incantation (LDB 46 l.107-111), Tests de fin de
 *  combat Maladie/Corruption (LDB 18 l.5, LDB 20 l.14/206). Un héros l'est TOUJOURS ; tout autre
 *  combattant seulement si explicitement flagué en donnée (cf. `Combatant.followsCharacterRules`). */
export const followsCharacterRules = (c: Pick<Combatant, 'kind' | 'followsCharacterRules'>): boolean =>
  c.kind === 'heros' || c.followsCharacterRules === true;
