/**
 * LA FENÊTRE DE DÉFENSE EN DONNÉES (#2928) — ce que la fenêtre de la Défense surfacée montre autour de ses lignes de
 * jet, lu de l'état : qui attaque qui et avec quelle arme, le Test de la réaction choisie et son jet avant le dé, ses
 * choix (la réaction, l'arme de parade, la réaction de Porte-Bouclier, la Riposte), chacun nommant le verbe qui le
 * règle (`reglages.ts`), et l'issue du coup. Lecteur PUR, partagé par l'écran de défense et par tout hôte
 * qui lit la partie sans écran.
 */
import type { Jeu } from './etat';
import type { Combatant, Weapon } from '../engine/types';
import { porteurParId } from './monde/combatants';
import { spendableAdvantage } from './combat/advantagePool';
import { defenseSubOf, parryWeaponOf } from './rollFlowSpecs';
import { ligneDeDefense } from './combatFlow';
import { defenseDodgeMods } from './mount';
import { difficultyText } from './difficultyText';
import type { RollLineParts } from './ligneDeJet';
import { DEFENSE_LABEL, coupAApplique, issueAuJet, type DefenseMode } from '../engine/combat';
import { combatSubstitute } from '../engine/skillCombatApps';
import { isUnarmed } from '../engine/items';
import { refLabel } from '../data';
import { t } from '../i18n';
import { libelleDuReglage } from './libelles';
import { defenseGagneeEnMelee } from './combatFlow';
import { shieldReactionCost, contreSurDefenseGagnee, contresEpuisees } from '../engine/combatFeatures/dispatch';
import { gesteDuReglage, type ChoixNomme } from './reglages';
import type { ReglageDu } from './reglagesDuJet';
import type { ReactionDeBouclier } from './pendings';

/** La réaction de la Défense : chaque mode offert porte la cible de son jet (`ligneDeDefense`), réglé comme le réglage
 *  `defense.reaction` le pose. */
export type ChoixDeReaction = Omit<ChoixNomme<DefenseMode>, 'options'> & { options: (ChoixNomme<DefenseMode>['options'][number] & { cible: number })[] };

/** La fenêtre de la Défense : ses combattants par id, l'arme de l'attaque, le Test de la réaction, et ses choix (l'arme
 *  de parade : `null` hors d'une parade à plusieurs armes ; Porte-Bouclier : `null` hors d'une parade qui la coûte ;
 *  Riposte : `null` sans Riposte au choix). */
export interface FenetreDeDefense {
  attaquantId: string;
  defenseurId: string;
  arme: string;
  test: string;
  jete: boolean;
  /** La substitution sociale de la réaction (`combatSubstitute`), offerte en mêlée : sa Compétence. */
  social: { skillId: string; libelle: string } | null;
  /** Les armes qui parent (hors Mains nues) et celle du jet (`parryWeaponOf`). */
  armesDeParade: Weapon[];
  parade: Weapon | undefined;
  /** La réaction et l'arme de parade se règlent avant le jet ; `null` une fois jeté. */
  reaction: ChoixDeReaction | null;
  armeDeParade: ChoixNomme | null;
  /** AA 13 l.84 : son coût en Avantages dans son libellé. */
  porteBouclier: ChoixNomme<ReactionDeBouclier> | null;
  /** LDB 10 l.1037 : aucune valeur retenue quand les Ripostes du Round sont portées. */
  riposte: ChoixNomme<boolean> | null;
  /** Le jet de la réaction avant le dé, monté comme le flux le jette (`ligneDeDefense`), et le texte de sa
   *  Difficulté (`difficultyText`) ; `null` une fois jeté. */
  jet: (RollLineParts & { difficulte: string }) | null;
  /** L'issue du coup une fois jeté (`issueAuJet`), son genre et sa ligne ; `null` avant le dé. */
  issue: { genre: 'critique' | 'degats' | 'parade' | 'esquive'; ligne: string } | null;
}

/** Le libellé d'une arme de parade : la main secondaire se dit. */
const libelleDeParade = (w: Weapon): string => (w.hand === 'secondaire' ? t('defense.secondaire', { arme: w.label }) : w.label);

/** La fenêtre de la Défense en attente (`pendingDefense`), `null` sans Défense. PUR. */
export function fenetreDeDefense(s: Jeu): FenetreDeDefense | null {
  const pd = s.pendingDefense;
  if (!pd) return null;
  const attaquant: Combatant | undefined = porteurParId(s, pd.attackerId);
  const defenseur: Combatant | undefined = porteurParId(s, pd.defenderId);
  if (!attaquant || !defenseur) return null;
  const jete = !!pd.result;
  // LDB 09 l.207, l.287
  const substitut = pd.weapon.type === 'melee' ? combatSubstitute(defenseur, attaquant, 'defense') : null;
  const social = substitut ? { skillId: substitut.skillId, libelle: refLabel('skills', { id: substitut.skillId }) } : null;
  const armesDeParade = defenseur.weapons.filter((w) => !isUnarmed(w) && !!w.uid);
  const parade = parryWeaponOf(defenseur, pd);
  const ouvert = (m: 'parade' | 'esquive') => !pd.modes || pd.modes.includes(m);
  const dodgeMods = defenseDodgeMods(s, defenseur);
  // Le jet du mode `mode`, sa Compétence sociale posée comme le réglage `defense.reaction` la pose.
  const ligneDu = (mode: DefenseMode) => ligneDeDefense(defenseur, {
    mode, parryWeapon: parade, vsWeapon: pd.weapon, dodgeMods,
    socialBase: defenseSubOf(defenseur, mode === pd.mode ? pd : { ...pd, mode, substituteSkillId: social?.skillId })?.base,
  });
  const reactions: ChoixDeReaction['options'] = [
    ...(['parade', 'esquive'] as const).filter(ouvert).map((m) => ({ valeur: m, libelle: DEFENSE_LABEL[m], cible: ligneDu(m).target })),
    ...(social ? [{ valeur: 'social' as const, libelle: social.libelle, cible: ligneDu('social').target }] : []),
  ];
  const choix = <V extends string | boolean>(reglage: ReglageDu<'defense'>, choisie: V | null, options: ChoixNomme<V>['options'], libelle = libelleDuReglage('defense', reglage)): ChoixNomme<V> => ({ geste: gesteDuReglage('defense', reglage), libelle, choisie, options });
  const res = pd.result;
  const gagnee = !!res && defenseGagneeEnMelee(attaquant, defenseur, pd.weapon, res);
  const jetLance = t('defense.refus.jetLance');
  // AA 13 l.84 ; LDB 13 l.123
  const coutDuBouclier = pd.mode === 'parade' ? shieldReactionCost(defenseur, parade) : 0;
  const refusDuBouclier = (genre: ReactionDeBouclier): string | null => {
    if (res) return genre === 'degats' && !gagnee ? t('defense.refus.degatsSansDefenseGagnee') : jetLance;
    if (pd.shieldReaction === genre) return null;
    if (defenseur.usedShieldReactionRound) return t('defense.refus.bouclierUtilise');
    const avantage = spendableAdvantage(s.battle, defenseur);
    return avantage < coutDuBouclier ? t('defense.refus.avantages', { cout: coutDuBouclier, nom: defenseur.label, avantage }) : null;
  };
  // LDB 10 l.1037
  const contre = pd.mode === 'parade' ? contreSurDefenseGagnee(defenseur, parade) : null;
  const portees = contre ? contresEpuisees(defenseur, contre) : null;
  const plafond = contre?.plafond;
  const refusDeLaRiposte = portees != null && plafond != null ? t('defense.refus.ripostesPortees', { n: portees, plafond }) : null;
  const coup = res ? issueAuJet(defenseur, coupAApplique(res, pd.suite.mode === 'pilotee' ? pd.suite.pa.grapple : pd.suite.coup.grapple, defenseur), pd.weapon, attaquant) : null;
  const ligne = res ? null : ligneDu(pd.mode);
  return {
    attaquantId: attaquant.id,
    defenseurId: defenseur.id,
    arme: pd.weapon.label,
    test: pd.mode === 'social' ? refLabel('skills', { id: pd.substituteSkillId ?? social?.skillId ?? 'intimidation' }) : DEFENSE_LABEL[pd.mode],
    jete,
    social,
    armesDeParade,
    parade,
    reaction: res ? null : { geste: gesteDuReglage('defense', 'reaction'), libelle: libelleDuReglage('defense', 'reaction'), choisie: pd.mode, options: reactions },
    armeDeParade: !res && pd.mode === 'parade' && armesDeParade.length >= 2
      ? choix('armeDeParade', pd.parryWeaponUid ?? parade?.uid ?? null, armesDeParade.map((w) => ({ valeur: w.uid!, libelle: libelleDeParade(w) })))
      : null,
    porteBouclier: coutDuBouclier > 0
      ? choix('porteBouclier', pd.shieldReaction ?? null, [
        { valeur: null, libelle: t('valeur.aucun'), refus: res ? jetLance : null },
        ...(['degats', 'repousser'] as const).map((genre) => ({ valeur: genre, libelle: t(`valeur.${genre}`), refus: refusDuBouclier(genre) })),
      ], t('defense.porteBouclier', { cout: coutDuBouclier }))
      : null,
    riposte: contre?.choisie
      ? choix('riposte', refusDeLaRiposte ? null : pd.riposte !== false, [
        { valeur: true, libelle: t('valeur.oui'), refus: refusDeLaRiposte ?? (res ? (gagnee ? jetLance : t('defense.refus.riposteSansDefenseGagnee')) : null) },
        { valeur: false, libelle: t('valeur.non'), refus: refusDeLaRiposte ?? (res ? jetLance : null) },
      ])
      : null,
    jet: ligne && { ...ligne, difficulte: difficultyText(ligne.difficulty, ligne.difficultyCombined) },
    issue: res && coup ? { genre: coup.compte.critiques.length ? 'critique' : res.hit ? 'degats' : pd.mode === 'parade' ? 'parade' : 'esquive', ligne: coup.ligne } : null,
  };
}
