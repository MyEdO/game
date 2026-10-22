/**
 * LA FENÊTRE DE DÉFENSE EN DONNÉES (#2928) — ce que la fenêtre de la Défense surfacée montre autour de ses lignes de
 * jet, lu de l'état : qui attaque qui et avec quelle arme, le Test de la réaction choisie, et ses choix (la réaction,
 * l'arme de parade, la réaction de Porte-Bouclier, la Riposte), chacun nommant le verbe qui le règle (`reglages.ts`). Lecteur PUR, partagé par
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
import { defenseGagneeEnMelee } from './combatFlow';
import { shieldReactionCost, contreSurDefenseGagnee, contresEpuisees } from '../engine/combatFeatures/dispatch';
import { REGLAGES_DE_LA_DEFENSE, type ChoixNomme } from './reglages';

/** La fenêtre de la Défense : ses combattants par id, l'arme de l'attaque, le Test de la réaction, et ses choix (l'arme
 *  de parade : `null` hors d'une parade à plusieurs armes ; Porte-Bouclier : `null` hors d'une parade qui la coûte ;
 *  Riposte : `null` sans Riposte au choix). */
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
  /** AA 13 l.84 : son coût en Avantages dans son libellé. */
  porteBouclier: ChoixNomme<'damage' | 'push'> | null;
  /** LDB 10 l.1037 : aucune valeur retenue quand les Ripostes du Round sont portées. */
  riposte: ChoixNomme<boolean> | null;
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
  const choix = <V extends string | boolean>(verbe: (typeof REGLAGES_DE_LA_DEFENSE)[number], choisie: V | null, options: ChoixNomme<V>['options'], libelle = libelleDuVerbe(verbe)!): ChoixNomme<V> => ({ verbe, libelle, choisie, options });
  const res = pd.result;
  const gagnee = !!res && defenseGagneeEnMelee(attaquant, defenseur, pd.weapon, res);
  const jetLance = t('defense.refus.jetLance');
  // AA 13 l.84 ; LDB 13 l.123
  const coutDuBouclier = pd.mode === 'parade' ? shieldReactionCost(defenseur, parade) : 0;
  const refusDuBouclier = (genre: 'damage' | 'push'): string | null => {
    if (res) return genre === 'damage' && !gagnee ? t('defense.refus.degatsSansDefenseGagnee') : jetLance;
    if (pd.shieldReaction === genre) return null;
    if (defenseur.usedShieldReactionRound) return t('defense.refus.bouclierUtilise');
    const avantage = defenseur.advantage ?? 0;
    return avantage < coutDuBouclier ? t('defense.refus.avantages', { cout: coutDuBouclier, nom: defenseur.label, avantage }) : null;
  };
  // LDB 10 l.1037
  const contre = pd.mode === 'parade' ? contreSurDefenseGagnee(defenseur, parade) : null;
  const portees = contre ? contresEpuisees(defenseur, contre) : null;
  const plafond = contre?.plafond;
  const refusDeLaRiposte = portees != null && plafond != null ? t('defense.refus.ripostesPortees', { n: portees, plafond }) : null;
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
    porteBouclier: coutDuBouclier > 0
      ? choix('defenseSetShieldReaction', pd.shieldReaction ?? null, [
        { valeur: null, libelle: t('valeur.aucun'), refus: res ? jetLance : null },
        ...(['damage', 'push'] as const).map((genre) => ({ valeur: genre, libelle: t(`valeur.${genre}`), refus: refusDuBouclier(genre) })),
      ], t('defense.porteBouclier', { cout: coutDuBouclier }))
      : null,
    riposte: contre?.choisie
      ? choix('defenseSetRiposte', refusDeLaRiposte ? null : pd.riposte !== false, [
        { valeur: true, libelle: t('valeur.oui'), refus: refusDeLaRiposte ?? (res ? (gagnee ? jetLance : t('defense.refus.riposteSansDefenseGagnee')) : null) },
        { valeur: false, libelle: t('valeur.non'), refus: refusDeLaRiposte ?? (res ? jetLance : null) },
      ])
      : null,
  };
}
