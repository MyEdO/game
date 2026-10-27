/**
 * LES RÈGLES MAISON du web (#3041) : la procédure de l'hôte (`hote/reglesMaison.ts`) sur le stockage du web et l'état
 * de son store, seule couture de ses consommateurs (panneau, harnais de recette, tests du store).
 */
import type { RuleValue } from '../engine/policy';
import type { Stockage } from '../lib/stockage';
import type { RetraitsDElagage } from '../noyau/persistance/elagage';
import { stockageWeb } from '../web/stockageWeb';
import { chargerLesReglesMaison, prendreLeTemoinDesReglesMaison, reglerUneRegleMaison, remettreUneRegleMaison } from '../hote/reglesMaison';
import { useGame } from './store';

/** Le stockage des règles maison du web : `localStorage`, relu à chaque appel. */
const stockageDesReglesMaison = (): Stockage | null => stockageWeb('localStorage');

/** Pose les règles maison persistées du web (`chargerLesReglesMaison`). */
export const chargerLesReglesMaisonWeb = (): void => chargerLesReglesMaison(stockageDesReglesMaison());

/** Le témoin des règles retirées du web, consommé (`prendreLeTemoinDesReglesMaison`). */
export const prendreLeTemoinDesReglesMaisonWeb = (): RetraitsDElagage | null => prendreLeTemoinDesReglesMaison(stockageDesReglesMaison());

/** Le geste JOUEUR qui surcharge la règle `id`, sous le verrou de l'état du store (`reglerUneRegleMaison`). */
export const reglerUneRegleMaisonWeb = (id: string, valeur: RuleValue): void =>
  reglerUneRegleMaison(stockageDesReglesMaison(), useGame.getState(), id, valeur);

/** Le geste JOUEUR qui remet la règle `id` à son défaut, sous le verrou de l'état du store (`remettreUneRegleMaison`). */
export const remettreUneRegleMaisonWeb = (id: string): void => remettreUneRegleMaison(stockageDesReglesMaison(), useGame.getState(), id);
