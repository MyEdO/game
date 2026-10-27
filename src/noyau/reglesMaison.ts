/**
 * LES RÈGLES MAISON EN PARTIE (#2942, #3041) : quand une règle optionnelle (`engine/policy`, `OPTIONAL_RULES`) peut
 * changer, et sa pose : un jeu persisté élagué puis posé, une surcharge posée ou retirée sous le verrou. Tout hôte qui
 * expose leur réglage passe par ici ; leur persistance reste à l'hôte (`hote/reglesMaison.ts`).
 */
import { t } from '../i18n';
import { loadRuleOverrides, resetRule, setRule, type RuleValue } from '../engine/policy';
import { elaguerLePersiste, rienDElague, type RetraitsDElagage } from './persistance/elagage';
import type { Jeu } from './etat';

/**
 * Les règles optionnelles sont-elles MUTABLES en cet instant, et sinon POURQUOI. Verrou de CLASSE, sans granularité par
 * entrée : tant qu'une bataille est en cours, TOUTE entrée d'`OPTIONAL_RULES` est figée — le moteur lit `rule(id)` en
 * direct, et une bascule en plein combat rétroagit sur un état déjà construit à l'ouverture (réserves d'Avantage de
 * camp, Initiative, système de Blessures…). Ce qui relève du CONFORT (rythme de résolution…) n'est pas une règle et ne
 * vit pas dans ce registre : c'est une préférence (`noyau/preferences.ts`), modifiable à tout moment, combat compris.
 */
export function reglesMaisonMutables(s: Pick<Jeu, 'battle'>): { mutable: boolean; reason: string } {
  if (!s.battle || s.battle.over) return { mutable: true, reason: '' };
  return { mutable: false, reason: t('houseRules.lockedInBattle') };
}

/** Pose le jeu de règles maison `persiste` (un dictionnaire venu d'un stockage) : les SEULES surcharges que le
 *  registre courant refuse sont retirées (`elaguerLePersiste`), les autres posées ; rend les retraits, `null` sans
 *  retrait (#1463 LD.1). */
export function poserLesReglesMaisonPersistees(persiste: Readonly<Record<string, unknown>>): RetraitsDElagage | null {
  const { regles, retraits } = elaguerLePersiste({ regles: persiste });
  loadRuleOverrides(regles);
  return rienDElague(retraits) ? null : retraits;
}

/** Surcharge la règle `id` de `valeur`, si le verrou de `s` le permet ; rend vrai si elle est posée. */
export function surchargerUneRegleMaison(s: Pick<Jeu, 'battle'>, id: string, valeur: RuleValue): boolean {
  if (!reglesMaisonMutables(s).mutable) return false;
  setRule(id, valeur);
  return true;
}

/** Remet la règle `id` à son défaut, si le verrou de `s` le permet ; rend vrai si elle est remise. */
export function retablirUneRegleMaison(s: Pick<Jeu, 'battle'>, id: string): boolean {
  if (!reglesMaisonMutables(s).mutable) return false;
  resetRule(id);
  return true;
}
