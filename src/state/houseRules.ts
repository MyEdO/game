/**
 * Règles maison — PERSISTANCE du store de surcharge des règles optionnelles (engine/policy).
 *
 * Le moteur reste pur : c'est la couche state qui lit/écrit le localStorage et pousse les surcharges
 * dans le registre via `loadRuleOverrides`/`setRule`. À appeler une fois au démarrage de l'app
 * (`loadHouseRules`) ; le panneau in-game écrit via `setHouseRule`/`resetHouseRule` (persistance
 * immédiate). Même patron que `projectLibrary` / roster.
 *
 * COUTURE UNIQUE d'écriture JOUEUR — et donc le point où se lit le VERROU de combat (`houseRulesMutability`) :
 * `engine/policy.setRule` reste la primitive PURE (persistance, tests du moteur) et ne connaît pas la
 * partie ; tout chemin joueur (panneau du menu principal, onglet Options en jeu) passe ici.
 */
import { ruleOverrides, loadRuleOverrides, setRule, resetRule, type RuleValue } from '../engine/policy';
import { elaguerLePersiste, rienDElague, type RetraitsDElagage } from './elagage';
import { useGame } from './store';
import { reglesMaisonMutables } from '../noyau/reglesMaison';
import { lireDictionnaire, stockageWeb } from '../web/stockageWeb';

/** Clé du magasin des règles maison dans le `localStorage`. */
export const HOUSE_RULES_STORAGE_KEY = 'wfrp4.house-rules';

/** Témoin des règles maison persistées que le registre courant refuse, retirées du stockage — posé par
 *  `loadHouseRules`, consommé par le panneau des règles (`ui/HouseRulesModal`). */
let reglesRetirees: RetraitsDElagage | null = null;

/** Consomme le témoin de retrait des règles maison persistées (et le remet à zéro). */
export function takeHouseRulesNotice(): RetraitsDElagage | null {
  const r = reglesRetirees;
  reglesRetirees = null;
  return r;
}

/** Charge les règles maison persistées vers le registre du moteur (démarrage de l'app). Les SEULES surcharges que
 *  le registre courant refuse sont retirées (`elaguerLePersiste`) ; les autres restent appliquées, le stockage est
 *  réécrit élagué, témoin posé (#1463 LD.1). */
export function loadHouseRules(): void {
  const o = lireDictionnaire('localStorage', HOUSE_RULES_STORAGE_KEY);
  if (!o) return;
  const { regles, retraits } = elaguerLePersiste({ regles: o });
  loadRuleOverrides(regles);
  if (rienDElague(retraits)) return;
  reglesRetirees = retraits;
  saveHouseRules();
}

/** Persiste l'état courant des surcharges. */
export function saveHouseRules(): void {
  try {
    stockageWeb('localStorage')?.setItem(HOUSE_RULES_STORAGE_KEY, JSON.stringify(ruleOverrides()));
  } catch {
    /* ignore (mode privé, quota…) */
  }
}

/** Le verrou des règles maison du noyau (`reglesMaisonMutables`) sur la partie du store : contrat consommé par la
 *  couche d'écriture (ci-dessous) ET par l'écran des règles (`GatedAction` : `enabled={mutable}`, `reason={reason}`). */
export function houseRulesMutability(): { mutable: boolean; reason: string } {
  return reglesMaisonMutables(useGame.getState());
}

/** Surcharge une règle (depuis le panneau) ET persiste. Refusée tant qu'un combat est en cours. */
export function setHouseRule(id: string, value: RuleValue): void {
  if (!houseRulesMutability().mutable) return;
  setRule(id, value);
  saveHouseRules();
}

/** Réinitialise une règle au défaut RAW ET persiste. Refusée tant qu'un combat est en cours. */
export function resetHouseRule(id: string): void {
  if (!houseRulesMutability().mutable) return;
  resetRule(id);
  saveHouseRules();
}
