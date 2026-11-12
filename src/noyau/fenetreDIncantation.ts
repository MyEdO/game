/**
 * LA FENÊTRE D'INCANTATION EN DONNÉES (#3059) — ce que la fenêtre d'incantation (`pendingCast`) montre, lu de l'état :
 * le Sort, son NI et sa Zone d'Effet, la ligne du jet (aperçu ou jet tombé), les réglages d'avant et d'après le jet
 * (ton de la Prière, forme de l'arme invoquée, effet d'Incantation Critique, Surincantation, jets sur le Tableau, pose
 * de la zone), chacun avec la raison qui le refuse, les fermetures du flux `incantation`, l'annulation et l'issue. Lecteur PUR,
 * partagé par l'écran d'incantation et par tout hôte qui lit la partie sans écran ; ses refus sont ceux que
 * les réglages du jet (`jetRegler('incantation', …)`, `reglagesDuCombat`) et la pose de la zone appliquent (`combatSlice.ts`).
 * Ses textes sortent du catalogue par `t()`.
 */
import type { Jeu } from './etat';
import type { FermeturesDuJet } from './rollFlowFactory';
import { REGLAGE_DE_L_AXE, type ReglageDu } from './reglagesDuJet';
import type { IdDeFormeConjuree } from './designations';
import { actorIn } from './monde/combatants';
import { aiDriven, influencesLocally } from './netOwnership';
import { ventsAnnonces } from './combatOrParty';
import { fermeturesDuFlux } from './verbesOuverts';
import { fermetureDuReglage } from './rollFlowSpecs';
import { castOvercastAxes, effectiveSpellOf, overcastTargetCandidates, previewCast } from './combatFlow';
import { resultLine, freeCons } from './rollSeam';
import { libelleDeLaFermeture, libelleDuReglage } from './libelles';
import { gesteDuReglage, type ChoixNomme } from './reglages';
import { libelleDIncantation } from './jetsEnVue';
import { findSpellById, findTrappingById, weaponGroupLabel } from '../data/index';
import { conjureFormOptions } from '../engine/conjuredWeapons';
import { evaluateTest } from '../engine/tests';
import {
  castAfterCrit, castInfoIsPrayer, castingNumberOf, castOvercastBudget, focusValueOf, sortInfligeDesDegats, spellTargetCount,
  type CritChoice,
} from '../engine/magic';
import { extraTargetCapacity, missileOvercastDamageBonus, overcastSourceOf, overcastStepCost, type OvercastAxis } from '../engine/overcast';
import type { ModLine } from '../engine/types';
import { t } from '../i18n';

/** Les effets d'Incantation Critique, dans l'ordre de la fenêtre. LDB 46 l.30-32 */
const EFFETS_CRITIQUES: readonly CritChoice[] = ['critique', 'puissance', 'ineluctable'];

/** Un pas de Surincantation sur un axe : les pas alloués et ce qui refuse d'en rendre ou d'en allouer un. */
interface AxeDeSurincantation { axe: OvercastAxis; pas: number; refusDeRendre: string | null; refusDAllouer: string | null }

/** La Surincantation d'un jet qui lance le Sort : le budget en pas, ce qu'il en reste, le coût d'un pas en DR, les axes
 *  que le Sort ouvre, la capacité de cibles supplémentaires et celles déjà désignées (choisies sur la carte en combat,
 *  parmi `candidats` hors combat), le bonus de Dégâts alloué, et les jets sur le Tableau. LDB 47 l.15-31 ; VDM 02 l.198 ;
 *  EDOC 13 l.276 */
interface SurincantationEnVue {
  budget: number;
  restant: number;
  coutDuPas: number;
  axes: AxeDeSurincantation[];
  cibles: { capacite: number; designees: number; surLaCarte: boolean; candidats: string[] } | null;
  bonusDeDegats: number;
  jetsSurLeTableau: { choisis: number; max: number; refusDeDecliner: string | null; refusDeRefaire: string | null } | null;
}

/** La ligne du jet du lanceur : le Test, sa valeur et ses modificateurs, la cible, et le d100 tombé (`null` avant). */
interface LigneDIncantation {
  label: string;
  base: number;
  mods: ModLine[];
  target: number;
  jet: { roll: number; target: number; sl: number; success: boolean } | null;
}

/** La vue désigne les combattants par id, comme `fenetreDAttaque` ; ses valeurs sont explicites (`null`, jamais une clé
 *  `undefined`). Un réglage absent (`null`) est fermé maintenant (`fermetureDuReglage`) ; présent, chacune de ses
 *  options porte la raison qui la refuse. */
export interface FenetreDIncantation {
  lanceurId: string;
  cibleId: string;
  sortId: string;
  sort: string;
  priere: boolean;
  intitule: string;
  /** Le NI effectif : figé au jet, sinon celui que le jet opposera (`castingNumberOf`) ; `null` pour une Prière. */
  ni: number | null;
  surSoi: boolean;
  /** Le gabarit de la Zone d'Effet (cases de côté) et s'il reste à poser. LDB 47 l.15, l.28 */
  zone: { cote: number; aPoser: boolean } | null;
  jete: boolean;
  ligne: LigneDIncantation;
  ton: ChoixNomme<boolean> | null;
  forme: ChoixNomme | null;
  critique: ChoixNomme<CritChoice> | null;
  surincantation: SurincantationEnVue | null;
  /** Les pas de Surincantation de chaque axe ouvert, en choix réglés (`REGLAGE_DE_L_AXE`) : de 0 au budget, chaque pas
   *  avec la raison qui le refuse ; vide quand le jet n'ouvre aucun pas. LDB 47 l.15-17 */
  crans: ChoixNomme<number>[];
  /** La pose de la zone après le jet (`jetRegler('incantation', 'carte', 'zone')`) : la raison qui la refuse ; `null` sans zone à poser. */
  pose: { refus: string | null } | null;
  /** Les fermetures du flux `incantation` (`FLOWS.incantation.fermetures`). */
  fermetures: FermeturesDuJet;
  /** Pourquoi l'annulation est refusée (`fermetures.cancel`), `null` si elle est offerte. */
  annulation: string | null;
  /** L'issue du jet (`issueDeLIncantation`), `''` avant le jet ou quand l'opposition l'annule. */
  issue: string;
}

/** Ce que refuse le réglage `reglage` de l'incantation maintenant, en mots du joueur ; `null` : ouvert. La fermeture
 *  est celle que `jetRegler` applique (`fermetureDuReglage` : sa phase, puis son offre) ; la fenêtre et les refus de
 *  valeur ci-dessous la lisent ici. */
export function refusDuReglage(s: Jeu, reglage: ReglageDu<'incantation'>): string | null {
  const f = fermetureDuReglage(() => s, 'incantation', reglage);
  return f ? libelleDeLaFermeture(f) : null;
}

/** Ce qui refuse l'effet d'Incantation Critique `choix` (`null` : offert) : le réglage fermé, ou la Blessure Critique
 *  d'un Sort qui n'inflige pas de Dégâts. LDB 46 l.30 ; LDB 47 l.453 */
export function refusDuChoixCritique(s: Jeu, choix: CritChoice): string | null {
  const ferme = refusDuReglage(s, 'effetCritique');
  if (ferme) return ferme;
  const sort = s.pendingCast && effectiveSpellOf(s.pendingCast);
  return choix === 'critique' && sort && !sortInfligeDesDegats(sort) ? t('incantation.refus.sansDegats') : null;
}

/** Ce qui refuse la forme d'arme invoquée `arme` (id de l'arme) : le réglage fermé, ou une forme que le lanceur
 *  n'a pas. LDB 47 */
export function refusDeLaForme(s: Jeu, arme: IdDeFormeConjuree): string | null {
  const ferme = refusDuReglage(s, 'formeConjuree');
  if (ferme) return ferme;
  const lanceur = s.pendingCast && actorIn(s, s.pendingCast.casterId);
  return lanceur && conjureFormOptions(lanceur).some((f) => f.weapon === arme) ? null : t('incantation.refus.formeNonOfferte');
}

/** Ce que permet maintenant la Surincantation du jet en attente : `null` sans jet, sans lanceur ou sans Sort. */
function etatDeLaSurincantation(s: Jeu) {
  const pc = s.pendingCast;
  const sort = pc && findSpellById(pc.spellId);
  const lanceur = pc && actorIn(s, pc.casterId);
  if (!pc?.result || !sort || !lanceur) return null;
  const budget = castOvercastBudget(sort, pc.result, pc.critChoice);
  const oc = pc.overcast ?? { range: 0, zone: 0, duration: 0, targets: 0, damage: 0 };
  const depense = oc.range + oc.zone + oc.duration + oc.targets + oc.damage;
  return { pc, sort, lanceur, budget, oc, restant: budget - depense, axes: castOvercastAxes(pc, sort) };
}

/** Ce qui refuse `pas` pas alloués à la Surincantation sur `axe` (la valeur de son réglage, `REGLAGE_DE_L_AXE`) : jet
 *  non lancé, lanceur d'un autre siège, axe que le Sort n'ouvre pas, aucun pas à rendre, budget dépassé. LDB 47
 *  l.15-17 */
export function refusDuPasDeSurincantation(s: Jeu, axe: OvercastAxis, pas: number): string | null {
  const e = etatDeLaSurincantation(s);
  if (!e) return libelleDeLaFermeture('jetNonLance');
  if (!influencesLocally(s, e.lanceur.id)) return libelleDeLaFermeture('rangeeTemoin');
  if (!e.axes.includes(axe)) return t('incantation.refus.axeFerme');
  if (!Number.isInteger(pas) || pas < 0) return t('incantation.refus.aucunPas');
  if (pas > e.oc[axe] && e.restant - (pas - e.oc[axe]) < 0) return t('incantation.refus.budgetEpuise');
  return null;
}

/** Ce qui refuse la pose de la zone (`on`) ou le retour à la fenêtre (`!on`) : aucune zone à poser hors combat, jet non
 *  lancé, Sort qui ne part pas (`castAfterCrit`), lanceur d'un autre siège. LDB 47 l.15, l.28 ; LDB 46 l.31 */
export function refusDeLaPose(s: Jeu, on: boolean): string | null {
  const pc = s.pendingCast;
  if (!pc?.zone || pc.zone.center || !s.battle) return libelleDeLaFermeture('nonOffert');
  if (!on) return pc.zone.placing ? null : libelleDeLaFermeture('nonOffert');
  if (!pc.result) return libelleDeLaFermeture('jetNonLance');
  if (!castAfterCrit(pc.result, pc.critChoice)) return t('incantation.refus.sortNonLance');
  return influencesLocally(s, pc.casterId) ? null : libelleDeLaFermeture('rangeeTemoin');
}

/** Le réglage `reglage` se montre : ouvert, ou refusé au seul siège qui ne pilote pas le lanceur (`rangeeTemoin`). */
const seMontre = (s: Jeu, reglage: ReglageDu<'incantation'>): boolean => {
  const f = fermetureDuReglage(() => s, 'incantation', reglage);
  return !f || f === 'rangeeTemoin';
};

/** La Surincantation en vue, `null` quand le jet n'ouvre aucun pas. */
function surincantationEnVue(s: Jeu): SurincantationEnVue | null {
  const e = etatDeLaSurincantation(s);
  // Le moteur alloue seul la Surincantation du lanceur qu'il conduit (`aiOvercastPlan`).
  if (!e || e.budget <= 0 || !e.axes.length || aiDriven(s, e.lanceur)) return null;
  const { pc, sort, lanceur, oc } = e;
  const source = overcastSourceOf(sort);
  const capacite = extraTargetCapacity(source, oc.targets, spellTargetCount(sort, lanceur));
  const pool = s.battle?.combatants ?? s.party;
  const tableau = refusDuReglage(s, 'jetsDeTable');
  const choisis = pc.chosenTableRolls ?? oc.duration;
  return {
    budget: e.budget,
    restant: e.restant,
    coutDuPas: overcastStepCost(source),
    axes: e.axes.map((axe) => ({
      axe, pas: oc[axe], refusDeRendre: refusDuPasDeSurincantation(s, axe, oc[axe] - 1), refusDAllouer: refusDuPasDeSurincantation(s, axe, oc[axe] + 1),
    })),
    cibles: e.axes.includes('targets') && capacite > 0
      ? {
          capacite, designees: pc.extraTargetIds?.length ?? 0, surLaCarte: !!s.battle,
          candidats: overcastTargetCandidates(pool, lanceur, pc.targetId, sort, !!pc.missile, source, oc.range).map((c) => c.id),
        }
      : null,
    bonusDeDegats: missileOvercastDamageBonus(source, oc.damage),
    jetsSurLeTableau: !seMontre(s, 'jetsDeTable')
      ? null
      : {
          choisis, max: oc.duration,
          refusDeDecliner: tableau ?? (choisis > 0 ? null : t('incantation.refus.aucunJetADecliner')),
          refusDeRefaire: tableau ?? (choisis < oc.duration ? null : t('incantation.refus.tousLesJetsFaits')),
        },
  };
}

/** La fenêtre d'incantation ouverte (`pendingCast`), `null` sans incantation en attente. PUR. */
export function fenetreDIncantation(s: Jeu): FenetreDIncantation | null {
  const pc = s.pendingCast;
  if (!pc) return null;
  const lanceur = actorIn(s, pc.casterId);
  const cible = actorIn(s, pc.targetId);
  const sort = findSpellById(pc.spellId);
  if (!lanceur || !cible || !sort) return null;
  const res = pc.result;
  const priere = castInfoIsPrayer(sort);
  const montre = (reglage: ReglageDu<'incantation'>): boolean => seMontre(s, reglage);
  const choix = <V extends string | number | boolean>(reglage: ReglageDu<'incantation'>, choisie: V | null, options: ChoixNomme<V>['options']): ChoixNomme<V> =>
    ({ geste: gesteDuReglage('incantation', reglage), libelle: libelleDuReglage('incantation', reglage), choisie, options });
  const zoneAPoser = !!pc.zone && !pc.zone.center;
  const apercu = previewCast(lanceur, sort, { missile: pc.missile, focused: pc.focused, jete: !!res, ctx: { s, target: cible, skipWard: zoneAPoser } });
  const formes = conjureFormOptions(lanceur);
  const refusDeForme = refusDuReglage(s, 'formeConjuree');
  const fermetures = fermeturesDuFlux(s, 'incantation');
  const surincantation = surincantationEnVue(s);
  return {
    lanceurId: lanceur.id,
    cibleId: cible.id,
    sortId: sort.id,
    sort: sort.label,
    priere,
    intitule: t(priere ? 'incantation.titrePriere' : 'incantation.titre'),
    ni: priere ? null : res?.niRequired ?? castingNumberOf(effectiveSpellOf(pc) ?? sort, pc.focused, {}, [], lanceur),
    surSoi: lanceur.id === cible.id,
    zone: pc.zone ? { cote: pc.zone.radius * 2 + 1, aPoser: zoneAPoser } : null,
    jete: !!res,
    ligne: {
      label: libelleDIncantation(pc.spellId),
      base: apercu.base,
      mods: apercu.mods,
      target: apercu.target,
      jet: res ? { roll: res.roll, target: res.target, sl: res.sl, success: evaluateTest(res.roll, res.target).success } : null,
    },
    // LDB 40 l.40-42
    ton: montre('discret')
      ? choix('discret', !!pc.discreet, [
          { valeur: false, libelle: t('incantation.ton.aVoixHaute'), refus: refusDuReglage(s, 'discret') },
          { valeur: true, libelle: t('incantation.ton.discretement'), refus: refusDuReglage(s, 'discret') },
        ])
      : null,
    // LDB 47
    forme: montre('formeConjuree')
      ? choix('formeConjuree', pc.conjureForm?.weapon ?? formes[0]?.weapon ?? null, formes.map((f) => ({
          valeur: f.weapon, libelle: t('incantation.forme', { arme: findTrappingById(f.weapon)?.label ?? f.weapon, groupe: weaponGroupLabel(f.group) }), refus: refusDeForme,
        })))
      : null,
    // LDB 46 l.26-32 : aucun effet n'est retenu tant que le lanceur n'a pas choisi.
    critique: montre('effetCritique')
      ? choix('effetCritique', pc.critChoice ?? null, EFFETS_CRITIQUES.map((c) => ({
          valeur: c, libelle: t(`valeur.${c}`), refus: refusDuChoixCritique(s, c),
        })))
      : null,
    surincantation,
    crans: (surincantation?.axes ?? []).map(({ axe, pas }) => choix(REGLAGE_DE_L_AXE[axe], pas, Array.from({ length: surincantation!.budget + 1 }, (_, n) => ({
      valeur: n, libelle: String(n), refus: refusDuPasDeSurincantation(s, axe, n),
    })))),
    pose: zoneAPoser && res && s.battle ? { refus: refusDeLaPose(s, true) } : null,
    fermetures,
    annulation: fermetures.annuler ? libelleDeLaFermeture(fermetures.annuler) : null,
    issue: issueDeLIncantation(s),
  };
}

/** La ligne du jet de Focalisation en attente (`pendingFocus`) : le NI que la Focalisation vise (`castingNumberOf`), la
 *  valeur du Test que le résolveur jette (`focusValueOf`), les Vents qu'elle annonce (`ventsAnnonces`) et la cible.
 *  `null` sans Focalisation. LDB 46 l.128-132, l.179-190 */
export function ligneDeFocalisation(s: Jeu): { ni: number; base: number; mods: ModLine[]; target: number } | null {
  const pf = s.pendingFocus;
  const lanceur = pf && actorIn(s, pf.casterId);
  const sort = pf && findSpellById(pf.spellId);
  if (!pf || !lanceur || !sort) return null;
  const base = focusValueOf(lanceur, sort) ?? 0;
  const vents = ventsAnnonces(s.battle, !!pf.result);
  return { ni: castingNumberOf(sort, false, {}, [], lanceur), base, mods: vents ? [vents] : [], target: base + (vents?.value ?? 0) };
}

/** Issue de l'incantation : le Sort lancé (la ligne de touche du moteur pour un Projectile qui touche), la Maladresse, la
 *  réussite sous le NI, l'échec. `''` avant le jet, et pour un Sort lancé que l'opposition peut encore annuler ou a
 *  annulé : un Contre-sort à jouer ou qui dissipe, la cible principale qui résiste (#1004). LDB 46 l.22-32, l.156 */
function issueDeLIncantation(s: Pick<Jeu, 'pendingCast' | 'pendingCastOpposition' | 'pendingCounterspell'>): string {
  const pc = s.pendingCast;
  const res = pc?.result;
  if (!pc || !res) return '';
  const contre = s.pendingCounterspell;
  const primaire = s.pendingCastOpposition?.participants.find((p) => p.id === pc.targetId);
  const annule = res.cast && (
    (!!contre && contre.participants.some((p) => !p.result || p.result.dispelled))
    || (!!primaire && (!primaire.result || primaire.result.resisted)));
  if (annule) return '';
  if (res.cast) return pc.missile && res.hit ? res.log : resultLine(freeCons([t(res.isCritical ? 'incantation.issue.lanceCritique' : 'incantation.issue.lance')]));
  return resultLine(freeCons([
    res.isFumble
      ? t('incantation.issue.maladresse')
      : evaluateTest(res.roll, res.target).success ? t('incantation.issue.tropFaible', { dr: res.sl, ni: res.niRequired ?? 0 }) : t('incantation.issue.echec'),
  ]));
}
