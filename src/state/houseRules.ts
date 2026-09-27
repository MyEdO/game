/**
 * Règles maison — PERSISTANCE du store de surcharge des règles optionnelles (engine/policy).
 *
 * Le moteur reste pur : c'est la couche state qui lit/écrit le localStorage et pousse les surcharges
 * dans le registre via `loadRuleOverrides`/`setRule`. À appeler une fois au démarrage de l'app
 * (`loadHouseRules`) ; le panneau in-game écrit via `setHouseRule`/`resetHouseRule` (persistance
 * immédiate). Même patron que `projectLibrary` / roster.
 *
 * COUTURE UNIQUE d'écriture JOUEUR — et donc le point où vit le VERROU de combat (`houseRulesMutability`) :
 * `engine/policy.setRule` reste la primitive PURE (persistance, tests du moteur) et ne connaît pas la
 * partie ; tout chemin joueur (panneau du menu principal, onglet Options en jeu) passe ici.
 */
import { ruleOverrides, loadRuleOverrides, setRule, resetRule, type RuleValue } from '../engine/policy';
import { useGame } from './store';
import { t } from '../i18n';
import { stockageLocal } from '../lib/stockageLocal';

const KEY = 'wfrp4.house-rules.v1';

/** Charge les règles maison persistées vers le registre du moteur (démarrage de l'app). */
export function loadHouseRules(): void {
  try {
    const raw = stockageLocal()?.getItem(KEY);
    if (raw) loadRuleOverrides(JSON.parse(raw) as Record<string, RuleValue>);
  } catch {
    /* localStorage indisponible ou JSON corrompu : on garde les défauts RAW. */
  }
}

/** Persiste l'état courant des surcharges. */
export function saveHouseRules(): void {
  try {
    stockageLocal()?.setItem(KEY, JSON.stringify(ruleOverrides()));
  } catch {
    /* ignore (mode privé, quota…) */
  }
}

/**
 * Les règles optionnelles sont-elles MUTABLES en cet instant, et sinon POURQUOI — contrat unique
 * consommé par la couche d'écriture (ci-dessous) ET par l'écran des règles (qui en compose
 * `GatedAction` : `enabled={mutable}`, `reason={reason}`).
 *
 * Verrou de CLASSE, SANS exception ni granularité par entrée (d'où l'absence de paramètre : aucune
 * réponse ne dépend d'un id) : tant qu'une bataille est en cours, TOUTE entrée d'`OPTIONAL_RULES`
 * est figée — le moteur lit `rule(id)` en direct, et une bascule en plein combat rétroagit sur un état
 * déjà construit à l'ouverture (réserves d'Avantage de camp, Initiative, système de Blessures…). Ce qui
 * relève du CONFORT (rythme de résolution…) n'est pas une règle et ne vit pas dans ce registre : c'est
 * une préférence (`state/preferences.ts`), modifiable à tout moment, combat compris.
 */
export function houseRulesMutability(): { mutable: boolean; reason: string } {
  const battle = useGame.getState().battle;
  if (!battle || battle.over) return { mutable: true, reason: '' };
  return { mutable: false, reason: t('houseRules.lockedInBattle') };
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
