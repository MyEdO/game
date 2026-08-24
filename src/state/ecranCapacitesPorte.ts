/**
 * LA PORTE de l'écran des capacités (spec HUD combat « Zone 6 ») — UNE seule mesure pour TOUTES ses
 * surfaces d'ouverture : le bouton du rail d'outils, la touche du registre clavier, le renvoi de la
 * fiche. L'écran est la surface EXHAUSTIVE du porteur ACTIF : il ne s'ouvre donc que pour le siège
 * qui TIENT ce tour — celui qui regarde jouer n'a pas de capacités à lancer.
 *
 * Rend la RAISON du refus (elle se LIT au survol/focus, `CodexRef refus`), ou `undefined` quand
 * l'écran est offert. `pourPorteurId` = porte ouverte DEPUIS un porteur nommé (le renvoi de sa
 * fiche) : l'écran montrant l'ACTIF, une fiche d'un autre héros ne peut pas l'ouvrir.
 */
import { activeCombatant, type GameState } from './store';
import { controlsCombatant } from './netOwnership';
import { t } from '../i18n';

export function refusEcranCapacites(s: GameState, pourPorteurId?: string): string | undefined {
  const battle = s.battle;
  if (!battle || battle.over) return t('capacites.horsCombat');
  if (s.pendingRoundStart) return t('capacites.roundNonCommence');
  const active = activeCombatant(battle);
  if (!active) return t('capacites.aucunActif');
  if (!controlsCombatant(s, active)) return t('capacites.tourDunAutre', { porteur: active.label });
  // Une porte OUVERTE DEPUIS un porteur nommé (le renvoi de sa fiche) : l'écran montre l'ACTIF, il ne
  // peut donc pas s'ouvrir sur la fiche d'un AUTRE héros — il montrerait les capacités d'un tiers.
  if (pourPorteurId && pourPorteurId !== active.id) return t('capacites.pasCePorteur', { porteur: active.label });
  return undefined;
}

/** L'écran est-il OUVRABLE en l'état ? (miroir strict du refus ci-dessus — aucune 2ᵉ mesure). */
export const ecranCapacitesOffert = (s: GameState): boolean => refusEcranCapacites(s) === undefined;
