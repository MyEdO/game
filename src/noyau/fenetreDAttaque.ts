/**
 * LA FENÊTRE D'ATTAQUE EN DONNÉES — ce que la modale du jet d'attaque montre, lu de l'état : l'intitulé, l'arme et
 * ses Dégâts, les options d'avant le jet (deux armes, arme, Localisation visée, postures de tir, corde, coups
 * retenus, Empoignade), la ligne de l'attaquant (aperçu ou jet), celle de la défense adverse, les entrées du cycle
 * d'influence, l'issue et l'attente d'une Défense surfacée. Lecteur PUR, partagé par l'écran web
 * (`ui/jetProps/useAttackJetProps.tsx`) et par tout hôte qui lit la partie sans écran ; ses textes sortent du
 * catalogue par `t()`, comme ceux de `jetsEnVue`.
 */
import type { Jeu } from './etat';
import { FLOWS } from './rollFlowSpecs';
import { composeRollLabel, type RollLabelRef } from './rollSeam';
import { oppositionDuCoup, type OppositionEnVue } from './jetsEnVue';
import { combatDistance } from './monde/footprint';
import { inBattleId } from './monde/combatants';
import {
  attackWeaponOf, victimeDuCoup, crowdEligible, previewAttack, previewDefense, defenseDodgeMods,
  surfacedDefensePending, heldGroundStanceBlock, intoCrowdStanceBlock,
} from './combatFlow';
import { LOCALISATIONS_DE_COUP, type Combatant, type Difficulty, type HitLocation, type ModLine, type Weapon } from '../engine/types';
import type { RollBreakdown } from '../engine/combat';
import { crowdMod, bestRangedDefense, locationLabel, peutRetenirSesCoups, attackTestOf, isHelplessTarget, issueAuJet, coupAApplique } from '../engine/combat';
import { rule } from '../engine/policy';
import { isUnarmed } from '../engine/items';
import { isInanimate } from '../engine/structures';
import { peutEtreEmpoigne } from '../engine/grapple';
import { itemCapability } from '../engine/capabilities';
import { objetSourceDeLArme } from '../engine/weaponLoad';
import { attackModesFor, offHandPenalty } from '../engine/combatFeatures/dispatch';
import { modDeRegle } from '../engine/reglesChiffrees';
import { testSkillLabel } from '../data';
import { t } from '../i18n';
import { difficultyText } from './difficultyText';
import { libelleDuJet, libelleDuVerbe } from './libelles';
import { REGLAGES_DE_L_ATTAQUE, type BasculeNommee, type ChoixNomme } from './reglages';

type ReglageDeLAttaque = (typeof REGLAGES_DE_L_ATTAQUE)[number];

const [tete, brasG, brasD, corps, jambeG, jambeD] = LOCALISATIONS_DE_COUP;
/** Les 6 localisations dans l'ordre des fenêtres de coup : la liste du moteur, permutée. */
export const LOCALISATIONS_A_L_ECRAN: readonly HitLocation[] = [tete, corps, brasD, brasG, jambeD, jambeG];


/** Une posture de tir, AFFICHÉE en lecture seule (son contrôle vit dans la console, spec HUD §1a G5) : armée sur ce
 *  coup, armée à la console mais sans objet sur ce coup, ou non armée. */
interface PostureDeTir { armee: boolean; sansObjet: boolean; etat: string; note: string }

/** La ligne de l'attaquant avant le dé : le Test, sa fiche Codex, la valeur et la cible, la Difficulté composée et son
 *  texte (`difficultyText`). */
interface AttaqueAJeter {
  label: string;
  labelRef: RollLabelRef;
  base: number;
  target: number;
  mods: ModLine[];
  difficulty: Difficulty;
  difficulte: string;
  difficultyCombined?: number;
  difficultyParts?: ModLine[];
  clamped?: number;
}

/** La défense adverse annoncée avant le jet : la compétence probable et ses modificateurs, sans la valeur, et le texte
 *  de sa Difficulté (`difficultyText`). */
type DefenseAnnoncee = ReturnType<typeof previewDefense> & { difficulte: string };

/** La vue désigne les combattants par id, comme `jetsEnVue` ; ses valeurs sont explicites (`null`, jamais une clé
 *  `undefined`) pour qu'elle traverse le JSON intacte. Chaque choix et chaque bascule nomme le verbe qui le règle
 *  (`reglages.ts`) ; une option `null` est l'argument `null` de ce verbe (au hasard, l'arme par défaut). */
export interface FenetreDAttaque {
  attaquantId: string;
  cibleId: string;
  intitule: string;
  sousTitre: string;
  /** L'arme RÉELLEMENT employée (`attackWeaponOf`) et, avant le jet, ses Dégâts. */
  enTete: string;
  jete: boolean;
  /** L'arme et la Localisation visée se règlent avant le jet ; `null` une fois jeté. */
  deuxArmes: BasculeNommee | null;
  choixDArme: ChoixNomme | null;
  localisation: ChoixNomme<HitLocation> | null;
  tirDansLeTas: PostureDeTir | null;
  tirImmobile: PostureDeTir | null;
  sansLaCorde: BasculeNommee | null;
  retenirSesCoups: BasculeNommee | null;
  empoigner: BasculeNommee | null;
  /** Pourquoi aucun jet n'est possible (ligne de vue, portée), `null` sinon. */
  bloque: string | null;
  /** La ligne de l'attaquant : le jet tombé, ou l'aperçu à jeter ; `null` quand le coup est bloqué ou que le jet
   *  n'a pas de détail. */
  jet: { d: RollBreakdown } | { pending: AttaqueAJeter } | null;
  /** La ligne de la défense adverse : le jet subi, ou l'annonce d'avant le jet ; `null` sans défense. */
  defense: { d: RollBreakdown } | { pending: DefenseAnnoncee } | null;
  /** Les entrées du cycle d'influence de l'attaquant ; ses fenêtres se jugent par les prédicats de
   *  `rollFlowFactory` (`fermetureDeLaRelance`, `fermetureDuPacte`, `fermetureDeLaResilience`). */
  influences: {
    relancee: boolean;
    /** Le Sombre Pacte est offert : le jet n'est pas imposé (`FLOWS.attack.fermetures`). */
    sombrePacte: boolean;
    /** La rangée n'offre aucun dé forcé (`noForcedDie` du web). LDB 16 l.113 ; LDB 17 l.68 */
    sansDeForce: boolean;
    /** L'inversion offerte et son issue (`FLOWS.attack.reversePreview`), `null` sinon. LDB 23 l.209 ; LDB 10 */
    inversion: { apercu: ReturnType<typeof FLOWS.attack.reversePreview> } | null;
  };
  /** Test opposé tranché (`oppositionDuCoup`). */
  opposition: OppositionEnVue | null;
  /** L'issue du coup, la ligne de touche du moteur (`issueAuJet`) ; `null` avant le jet ou quand une Défense
   *  surfacée va s'interposer (#1004). */
  issue: { genre: 'crit' | 'damage' | 'attack'; ligne: string } | null;
  /** Une Défense surfacée va s'interposer avant l'application (`surfacedDefensePending`). */
  defenseAttendue: boolean;
  attente: string | null;
  /** La Localisation du Coup Critique d'un jet forcé, à choisir ; `null` sinon. LDB 17 l.68 */
  critiqueALocaliser: ChoixNomme<HitLocation> | null;
}

/** Fiche Codex du NOM du jet d'attaque, même source que son libellé (`attackTestOf`) : la Caractéristique qui
 *  résout une Résolution alternative, sinon la Compétence lancée. */
function refDuNomDuJet(attaquant: Combatant, arme: Weapon | undefined, kind: 'melee' | 'ranged'): RollLabelRef {
  const test = attackTestOf(attaquant, arme, kind);
  const label = testSkillLabel(test);
  return 'char' in test
    ? { category: 'characteristics', id: test.char, label }
    : { category: 'skills', id: test.skill, label };
}

/** La fenêtre d'attaque ouverte (`pendingAttack`), `null` sans attaque en attente. PUR. */
export function fenetreDAttaque(s: Jeu): FenetreDAttaque | null {
  const pa = s.pendingAttack;
  const battle = s.battle;
  if (!pa || !battle) return null;
  const attaquant = inBattleId(battle, pa.attackerId);
  const cible = inBattleId(battle, pa.targetId);
  if (!attaquant || !cible) return null;
  const get = () => s;
  const arme = attackWeaponOf(battle, attaquant, cible, pa);
  const armeTenue = !pa.freeKind;
  const intitule = armeTenue ? libelleDuJet('attack') : arme.label;
  const res = pa.result;
  const jete = !!res;
  const tir = arme.type === 'ranged';
  const auxArmes = armeTenue ? attaquant.weapons.filter((w) => !isUnarmed(w) && !!w.uid) : [];
  // LDB 14 l.78
  const penaliteSecondaire = offHandPenalty(attaquant, modDeRegle('main-secondaire', 'main-secondaire'));
  const victime = victimeDuCoup(battle, cible, pa);
  const coup = res ? issueAuJet(victime, coupAApplique(res, pa.grapple, victime), arme, attaquant) : null;
  const heros = attaquant.kind === 'hero';
  // LDB 10 l.767-773
  const deuxArmesPossibles = !res && armeTenue && heros && attackModesFor(attaquant).includes('dual-wield')
    && attaquant.weapons.some((w) => w.hand === 'main' && w.type === 'melee' && (w.hands ?? 1) === 1)
    && attaquant.weapons.some((w) => w.hand === 'off' && w.type === 'melee' && (w.hands ?? 1) === 1)
    && !pa.cleave && !pa.dualSecond;
  // LDB 14 l.106
  const auContact = !res && tir ? crowdEligible(battle, attaquant, cible) : [];
  const bonusDuTas = crowdMod(auContact.length);
  // LDB 14 l.70 ; l.106 ; l.116
  const immobileALaConsole = !!battle.stances?.[attaquant.id]?.heldGround;
  const raisonImmobile = !res && tir ? heldGroundStanceBlock(battle, attaquant, arme) : null;
  const immobileSansObjet = !pa.heldGround && immobileALaConsole && !!raisonImmobile;
  const tasALaConsole = !!battle.stances?.[attaquant.id]?.intoCrowd;
  const raisonTas = !res && tir ? intoCrowdStanceBlock(battle, attaquant, arme, cible) : null;
  const tasSansObjet = !pa.intoCrowd && tasALaConsole && !!raisonTas;
  // ADE II 02 l.677
  const objetSource = objetSourceDeLArme(attaquant, arme);
  const corde = !res && tir && heros && !!objetSource && itemCapability(objetSource, 'ropeMode');
  // LDB 18 l.30 ; AA 07 l.59, l.61
  const retenir = !res && heros && peutRetenirSesCoups(arme);
  // LDB 14 l.159
  const empoigne = !res && arme.type === 'melee' && isUnarmed(arme) && heros && peutEtreEmpoigne(cible);
  const apercu = !res ? previewAttack(get, attaquant, cible, pa.location ?? undefined, { intoCrowd: pa.intoCrowd, heldGround: pa.heldGround, weaponUid: pa.weaponUid, harpoonRopeCut: pa.harpoonRopeCut, weapon: arme }) : null;
  // LDB 13 l.135
  const defenseAuTir = !res && tir ? bestRangedDefense(attaquant, cible, arme, combatDistance(attaquant, cible)) : undefined;
  const esquive = defenseDodgeMods(s, cible);
  const annonce = res
    ? undefined
    : tir
      ? (defenseAuTir ? previewDefense(cible, { mode: defenseAuTir.mode, parryWeapon: defenseAuTir.parryWeapon, vsWeapon: arme, dodgeMods: esquive }) : undefined)
      : isInanimate(cible) ? undefined : previewDefense(cible, { vsWeapon: arme, dodgeMods: esquive });
  const defenseAnnoncee: DefenseAnnoncee | undefined = annonce && { ...annonce, difficulte: difficultyText(annonce.difficulty) };
  const inversion = FLOWS.attack.reverseAvailable(get) ? { apercu: FLOWS.attack.reversePreview(get) } : null;
  const bloque = apercu && (apercu.blocked || !apercu.inRange) ? t(apercu.blocked ? 'attaque.sansLigneDeVue' : 'attaque.horsDePortee') : null;
  const defenseAttendue = !!res && surfacedDefensePending(s, attaquant, cible, arme, pa);
  const bascule = (verbe: ReglageDeLAttaque, active: boolean, note: string | null): BasculeNommee => ({ verbe, libelle: libelleDuVerbe(verbe)!, active, note });
  const choix = <V extends string>(verbe: ReglageDeLAttaque, choisie: V | null, options: ChoixNomme<V>['options']): ChoixNomme<V> => ({ verbe, libelle: libelleDuVerbe(verbe)!, choisie, options });
  const localisations = (l: HitLocation): { valeur: HitLocation; libelle: string } => ({ valeur: l, libelle: t('attaque.lieuVise', { lieu: locationLabel(l, cible.bodyShape) }) });

  return {
    attaquantId: attaquant.id,
    cibleId: cible.id,
    intitule,
    sousTitre: composeRollLabel(attaquant, intitule, attackTestOf(attaquant, arme, tir ? 'ranged' : 'melee')),
    enTete: apercu ? `${arme.label} · ${t('attaque.degats', { dmg: apercu.dmg })}` : arme.label,
    jete,
    deuxArmes: deuxArmesPossibles ? bascule('attackSetDualMode', !!pa.dualMode, null) : null,
    choixDArme: !res && auxArmes.length >= 2 && !pa.dualMode
      ? choix('attackSetWeapon', pa.weaponUid ?? arme.uid ?? null, auxArmes.map((w) => ({
          valeur: w.uid!,
          libelle: w.hand === 'off' && penaliteSecondaire ? t('attaque.armeSecondaire', { arme: w.label, penalite: penaliteSecondaire }) : w.label,
        })))
      : null,
    localisation: res || isInanimate(cible)
      ? null
      : choix('attackSetLocation', pa.location ?? null, [{ valeur: null, libelle: t('attaque.auHasard') }, ...LOCALISATIONS_A_L_ECRAN.map(localisations)]),
    tirDansLeTas: !res && tir && (!!pa.intoCrowd || !raisonTas || tasSansObjet)
      ? {
          armee: !!pa.intoCrowd,
          sansObjet: tasSansObjet,
          etat: pa.intoCrowd
            ? (bonusDuTas ? t('attaque.tas.armeeBonus', { bonus: bonusDuTas.value }) : t('attaque.tas.armee'))
            : t(tasSansObjet ? 'attaque.tas.sansObjet' : 'attaque.tas.nonArmee'),
          note: pa.intoCrowd
            ? t('attaque.tas.noteArmee', { n: auContact.length })
            : tasSansObjet ? t('attaque.tas.noteSansObjet', { raison: raisonTas! }) : t('attaque.tas.noteNonArmee'),
        }
      : null,
    tirImmobile: !res && tir && (!!pa.heldGround || (!pa.interrupt && !raisonImmobile) || immobileSansObjet)
      ? {
          armee: !!pa.heldGround,
          sansObjet: immobileSansObjet,
          etat: t(pa.heldGround ? 'attaque.immobile.arme' : immobileSansObjet ? 'attaque.immobile.sansObjet' : 'attaque.immobile.nonArme'),
          note: pa.heldGround
            ? t('attaque.immobile.noteArme')
            : immobileSansObjet ? t('attaque.immobile.noteSansObjet', { raison: raisonImmobile! }) : t('attaque.immobile.noteNonArme'),
        }
      : null,
    sansLaCorde: corde
      ? bascule('attackSetHarpoonRopeCut', !!pa.harpoonRopeCut, t(pa.harpoonRopeCut ? 'attaque.sansLaCorde.noteCoupee' : 'attaque.sansLaCorde.noteTenue'))
      : null,
    retenirSesCoups: retenir
      ? bascule('attackSetWithhold', !!pa.withhold, pa.withhold ? t(rule('combat-aa-blessures') === 'aa' ? 'attaque.retenir.noteAa' : 'attaque.retenir.noteLdb') : null)
      : null,
    empoigner: empoigne ? bascule('attackSetGrapple', !!pa.grapple, pa.grapple ? t('attaque.empoigner.note') : null) : null,
    bloque,
    jet: res
      ? (res.attackerDetail ? { d: res.attackerDetail } : null)
      : bloque || !apercu
        ? null
        : {
            pending: {
              label: testSkillLabel(attackTestOf(attaquant, apercu.weapon, apercu.kind)),
              labelRef: refDuNomDuJet(attaquant, apercu.weapon, apercu.kind),
              base: apercu.base,
              target: Math.max(0, Math.min(100, apercu.target)),
              mods: apercu.mods,
              difficulty: apercu.difficulty, // LDB 13 l.118 ; palier composé LDB 14 l.91-96
              difficulte: difficultyText(apercu.difficulty, apercu.difficultyCombined ?? undefined),
              ...(apercu.difficultyCombined != null ? { difficultyCombined: apercu.difficultyCombined } : {}),
              ...(apercu.difficultyParts ? { difficultyParts: apercu.difficultyParts } : {}),
              ...(apercu.clamped ? { clamped: apercu.clamped } : {}),
            },
          },
    defense: res
      ? (res.defenderDetail ? { d: res.defenderDetail } : null)
      : (!bloque && defenseAnnoncee ? { pending: defenseAnnoncee } : null),
    influences: {
      relancee: !!pa.rerolled,
      sombrePacte: FLOWS.attack.fermetures(get).darkPact !== 'jetImpose',
      sansDeForce: isHelplessTarget(cible),
      inversion,
    },
    opposition: res ? oppositionDuCoup(res) : null,
    issue: res && !defenseAttendue
      ? { genre: coup?.compte.critiques.length ? 'crit' : res.hit ? 'damage' : 'attack', ligne: coup?.ligne ?? res.log }
      : null,
    defenseAttendue,
    attente: res && defenseAttendue ? t('defense.awaiting', { cible: cible.label }) : null,
    // LDB 17 l.68 ; #1595 c.6226467544, c.6228496170 R1.
    critiqueALocaliser: res && pa.forced && coup?.compte.relance
      ? choix('attackSetCritLocation', res.critLocation ?? null, LOCALISATIONS_A_L_ECRAN.map((l) => ({ valeur: l, libelle: locationLabel(l, cible.bodyShape) })))
      : null,
  };
}
