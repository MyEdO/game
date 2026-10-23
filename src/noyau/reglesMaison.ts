/**
 * LES RÈGLES MAISON EN PARTIE (#2942) : quand une règle optionnelle (`engine/policy`, `OPTIONAL_RULES`) peut changer.
 * Tout hôte qui expose leur réglage lit ce verrou ; leur persistance reste à l'hôte.
 */
import { t } from '../i18n';
import type { Jeu } from './etat';

/**
 * Les règles optionnelles sont-elles MUTABLES en cet instant, et sinon POURQUOI. Verrou de CLASSE, sans granularité par
 * entrée : tant qu'une bataille est en cours, TOUTE entrée d'`OPTIONAL_RULES` est figée — le moteur lit `rule(id)` en
 * direct, et une bascule en plein combat rétroagit sur un état déjà construit à l'ouverture (réserves d'Avantage de
 * camp, Initiative, système de Blessures…). Ce qui relève du CONFORT (rythme de résolution…) n'est pas une règle et ne
 * vit pas dans ce registre : c'est une préférence de l'hôte, modifiable à tout moment, combat compris.
 */
export function reglesMaisonMutables(s: Pick<Jeu, 'battle'>): { mutable: boolean; reason: string } {
  if (!s.battle || s.battle.over) return { mutable: true, reason: '' };
  return { mutable: false, reason: t('houseRules.lockedInBattle') };
}
