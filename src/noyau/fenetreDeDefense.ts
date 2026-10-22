/**
 * LA FENÊTRE DE DÉFENSE EN DONNÉES (#2928) — ce que la fenêtre de la Défense surfacée montre autour de ses lignes de
 * jet, lu de l'état : qui attaque qui et avec quelle arme, le Test de la réaction choisie, et les deux choix d'avant le
 * jet (la réaction, l'arme de parade), chacun nommant le verbe qui le règle (`reglages.ts`). Lecteur PUR, partagé par
 * l'écran web (`ui/jetProps/useDefenseJetProps.tsx`) et par tout hôte qui lit la partie sans écran.
 */
import type { Jeu } from './etat';
import type { Combatant, Weapon } from '../engine/types';
import { inBattleId } from './monde/combatants';
import { parryWeaponOf } from './rollFlowSpecs';
import { DEFENSE_LABEL } from '../engine/combat';
import { combatSubstitute } from '../engine/skillCombatApps';
import { isUnarmed } from '../engine/items';
import { refLabel } from '../data';
import { t } from '../i18n';
import { libelleDuVerbe } from './libelles';
import type { ChoixNomme } from './reglages';

/** La fenêtre de la Défense : ses combattants par id, l'arme de l'attaque, le Test de la réaction, et ses choix d'avant
 *  le jet (l'arme de parade : `null` hors d'une parade à plusieurs armes). */
export interface FenetreDeDefense {
  attaquantId: string;
  defenseurId: string;
  arme: string;
  test: string;
  jete: boolean;
  /** La substitution sociale de la réaction (`combatSubstitute`), offerte en mêlée : sa Compétence et sa valeur. */
  social: { skillId: string; libelle: string; valeur: number } | null;
  /** Les armes qui parent (hors Mains nues) et celle du jet (`parryWeaponOf`). */
  armesDeParade: Weapon[];
  parade: Weapon | undefined;
  reaction: ChoixNomme;
  armeDeParade: ChoixNomme | null;
}

/** Le libellé d'une arme de parade : la main secondaire se dit. */
const libelleDeParade = (w: Weapon): string => (w.hand === 'off' ? t('defense.secondaire', { arme: w.label }) : w.label);

/** La fenêtre de la Défense en attente (`pendingDefense`), `null` sans Défense. PUR. */
export function fenetreDeDefense(s: Jeu): FenetreDeDefense | null {
  const pd = s.pendingDefense;
  const battle = s.battle;
  if (!pd || !battle) return null;
  const attaquant: Combatant | undefined = inBattleId(battle, pd.attackerId);
  const defenseur: Combatant | undefined = inBattleId(battle, pd.defenderId);
  if (!attaquant || !defenseur) return null;
  const jete = !!pd.result;
  // LDB 09 l.207, l.287
  const substitut = pd.weapon.type === 'melee' ? combatSubstitute(defenseur, attaquant, 'defense') : null;
  const social = substitut ? { skillId: substitut.skillId, libelle: refLabel('skills', { id: substitut.skillId }), valeur: substitut.value } : null;
  const armesDeParade = defenseur.weapons.filter((w) => !isUnarmed(w) && !!w.uid);
  const parade = parryWeaponOf(defenseur, pd);
  const ouvert = (m: 'parade' | 'esquive') => !pd.modes || pd.modes.includes(m);
  const reactions = [
    ...(['parade', 'esquive'] as const).filter(ouvert).map((m) => ({ valeur: m, libelle: DEFENSE_LABEL[m] })),
    ...(social ? [{ valeur: 'social', libelle: social.libelle }] : []),
  ];
  const choix = (verbe: ChoixNomme['verbe'], choisie: string | null, options: ChoixNomme['options']): ChoixNomme => ({ verbe, libelle: libelleDuVerbe(verbe)!, choisie, options });
  return {
    attaquantId: attaquant.id,
    defenseurId: defenseur.id,
    arme: pd.weapon.label,
    test: pd.mode === 'social' ? refLabel('skills', { id: pd.substituteSkillId ?? social?.skillId ?? 'intimidation' }) : DEFENSE_LABEL[pd.mode],
    jete,
    social,
    armesDeParade,
    parade,
    reaction: choix('defenseSetMode', pd.mode, reactions),
    armeDeParade: pd.mode === 'parade' && armesDeParade.length >= 2
      ? choix('defenseSetParryWeapon', pd.parryWeaponUid ?? parade?.uid ?? null, armesDeParade.map((w) => ({ valeur: w.uid!, libelle: libelleDeParade(w) })))
      : null,
  };
}
