/**
 * REPOS — source UNIQUE de la nuit de sommeil (remplace le POC restPartyOvernight de combatFlow).
 *
 * `sleepParty` est LE moteur de nuit : horloge jusqu'à l'aube (chaque journée de repos se termine
 * à l'aube — le « temps minimum entre deux repos » est le temps lui-même), entretien quotidien #T3
 * (anti-double-comptage), récupération + cauchemars par héros, contagion de promiscuité. Consommé
 * par : la MODALE de Repos (ci-dessous), la nuit de voyage (travelFlow), la clôture d'interlude et
 * la triche de recette (`reposerLeGroupe`).
 *
 * La MODALE (pendingRest) ajoute par-dessus la phase RÉGLAGES par héros (couchage + pitance, coût
 * RAW calculé) ; « Dormir » ouvre ensuite une CHAÎNE de cascades séquentielles influençables (#347,
 * `openRestNight`/`continueRestNights`) — une nuit à la fois, jamais un jet pré-résolu, même pour un
 * repos de plusieurs jours (chaque nuit est reconstruite APRÈS que la précédente ait été validée).
 *
 * RAW :
 *  - Récupération (LDB 18 l.296) : Résistance +20 après « une bonne nuit de sommeil » → DR+BE PB,
 *    + BE/jour inconditionnel — le canon ne module PAS la récupération par la qualité du lit ;
 *  - Prix et chambres : LDB 66 l.12-16, l.28 (`CHAMBRES`, `prixDeLOffre`) ; qualité : `QUALITE_DU_REPOS` (LDB 66 l.5) ;
 *  - Offres d'un établissement : ACE 02 l.99 (`PendingRest.offres`) ;
 *  - Dehors : Exposition (LDB 18 l.327-334 — engine/exposure) selon `activeExposureSeverity` (combatFlow) ;
 *  - Faim (LDB 18 l.337-343) : un héros sans pitance ne récupère pas (engine/provisions).
 */
import type { z } from 'zod';
import type { IconId } from '../data/schemas/icons';
import type { restPlacesSchema } from '../data/schemas/defs-scenes/scene';
import type { Combatant } from '../engine/types';
import { nomDe } from '../engine/nom';
import type { RollBreakdown } from '../engine/combat';
import { ligneDeTexte, type EntreeDuJournal, type RecapTone } from '../engine/journal';
import { battleRng } from './battleRng';
import { betesHorsRencontre } from './monde/combatants';
import { touchActors } from './combatOrParty';
import { reposDeLaScene } from './monde/scene';
import { partyAssisted } from '../engine/skills';
import { designeGaranti } from './ligneDeJet';
import { soberUpDissipate, soberUpHangover } from '../engine/drunkenness';
import { addCondition, loseWounds } from '../engine/conditions';
import type { Applique } from '../engine/faits';
import { restRecovery, applyRecoveryDay, needsRecoveryRoll, applyDiseaseEnd, constatSansRecuperation, type RestRoll } from '../engine/rest';
import { diseaseDefs, contractionDue, applyDiseaseGangrene } from '../engine/disease';
import { applyOps } from '../engine/ops';
import { rule } from '../engine/policy';
import { applyFractureEnd } from '../engine/trauma';
import type { DeferredUpkeepTest } from './upkeep';
import {
  exposureTestCount,
  expireOnRespite,
  exposureShelterFromTent,
  applyExposureFailure,
  exposureCoatMods,
  heaviestPossession,
  dropHeaviestPossession,
  type ExposureSeverity,
  type ExposureKind,
} from '../engine/exposure';
import { effectiveChar, bonus } from '../engine/characteristics';
import { applyForcedMarch } from '../engine/travel';
import { startCascade, runCascadeImmediate } from './cascade';
import { nightBands, bandeDeNuit, nightRowId, genuineExposureFail, nextExposureWave, exposureWaveBand } from './nightBands';
import { EXPOSURE_BAND_KINDS } from './bandesDExposition';
import { monoStep, choiceStep, pousseSi } from './rollSeam';
import { porteursABord, type PorteurABord } from './shipCrew';
import { appliquerContagion, bandesDeContagion, type ContagionSpec } from './contagion';
import { calculerLesTestsDExposition, incubationPendantLeVoyage } from './expositionAMaladie';
import { WORLD_STEP_OWNER } from './pendings';
import { type BuiltCascadeStep } from './stepBrand';
import type { CascadeStepMeta } from './pendings';
import { isRation, feedFromMeal, applyFaimTest, applySoifTest } from '../engine/provisions';
import { toBrass, fromBrass, priceToMoney, toMoney, type Money } from '../engine/money';
import { payFromGroup, totalDesBourses } from './bourseFlow';
import { findTrappingById, nightStakeRef, refLabel, testSkillLabel, libelleOuAbsence, type StakeRef } from '../data';
import type { QualiteDeRepos } from '../data/schemas/grammaire/valeurs';
import { aubeApresNuits, MINUTES_PER_DAY, dayIndex } from '../engine/clock';
import { runDailyUpkeep } from './upkeep';
import { jouerLEntretienDesRoundsEcoules } from './outOfCombatUpkeep';
import { confierLaSuite, MAIN_RENDUE } from './combatEffects';
import { checkPartyWiped } from './partyWipe';
import { continueTravelAfterNight } from './travelFlow';
import { activeExposureSeverity } from './combatFlow';
import { bus, EVT } from './bus';
import type { Jeu } from './etat';

type SceneRestPlaces = z.output<typeof restPlacesSchema>;

export type RestKind = keyof SceneRestPlaces;
/** Une offre de chambre d'auberge. */
export type OffreDeChambre = 'chambre' | 'grande';
/** Une chambre d'auberge de la nuit, `<offre>-<numéro>` (`lireLaChambre`). */
export type IdDeChambre = string;
/** Un couchage sans chambre. */
export type CouchageSansChambre = 'commune' | 'maison' | 'dehors' | 'bord';
/** Un couchage : une chambre d'auberge, ou un couchage sans chambre. */
export type RestLodging = CouchageSansChambre | IdDeChambre;
export type RestFood = 'repas' | 'ration' | 'maison' | 'rien';

/** Lieux de repos OFFERTS par le contexte (scène, effet, halte de voyage) — combinables :
 *  un village peut offrir l'auberge ET le camp ; chaque héros choisit ENSUITE le sien. */
export interface RestPlaces extends SceneRestPlaces {
  /** MDG 03 l.71 · 09 l.87 */
  bord?: boolean;
}

/** L'offre par DÉFAUT d'un contexte nommé (`kind`, faute de `lodging` explicite fourni par
 *  l'effet `rest` / halte de voyage) — dormir dehors reste toujours possible (choix personnel :
 *  on peut manger à l'auberge et dormir à la belle étoile). */
export function placesOfKind(kind: RestKind): RestPlaces {
  return kind === 'auberge' ? { auberge: true, camp: true } : kind === 'maison' ? { maison: true, camp: true } : { camp: true };
}

/** Où le groupe passe la nuit : un lieu nommé (scène, établissement, navire), ou la route d'une halte de voyage par les
 *  ids de ses deux extrémités. */
export type LieuDuRepos = { nom: PlayerText } | { route: { de: string; vers: string } };

/** Le lieu de la scène COURANTE, pour une nuit qui s'y passe (bouton de Repos, hôtellerie de ville,
 *  effet `rest`, attente de l'aube au départ). */
export function sceneLieu(get: Get): LieuDuRepos {
  return { nom: dataLabel(garanti(get().scene, undefined, 'scène de la nuit').label) };
}

/** Le lieu d'une halte de nuit SUR LA ROUTE du voyage (terre et fleuve) : ses deux extrémités. */
export function routeLieu(plan: { fromPlaceId: string; toPlaceId: string }): LieuDuRepos {
  return { route: { de: plan.fromPlaceId, vers: plan.toPlaceId } };
}

/** Entrée du PROCÈS-VERBAL (bilan multi-jets, réutilisable : jour de mer #232, chronique de voyage…).
 *  Une ligne = un jet de ROUTINE déjà résolu (témoin), en LECTURE SEULE ; un jet de nuit de repos est une ÉTAPE de
 *  cascade influençable (`noyau/cascade.ts`, #347). */
export interface NightEntry {
  id?: string;
  actorId?: string;
  icon?: IconId;
  label: string;
  /** Le jet (base + mods = cible · d100 · DR). */
  d?: RollBreakdown;
  /** Issue / note en clair (« +7 PB », « jour 4/6 »). */
  text?: string;
  /** RUBRIQUE de la ligne : les lignes consécutives d'une MÊME rubrique (les contributeurs d'un même
   *  Test d'équipage) se lisent sous UNE rubrique, sans répéter l'en-tête. */
  group?: string;
  /** Vocabulaire PARTAGÉ (#349) — `RecapTone`, `engine/journal.ts` (même trio que le ton d'une entrée). */
  tone?: RecapTone;
  /** Type de jet HÉROS de `sleepParty` (chemin EAGER — cheat `reposerLeGroupe`, clôture d'interlude) —
   *  décoratif hors de ces deux chemins. */
  reKind?: 'recuperation' | 'cauchemar';
  /** Relance de Chance déjà consommée sur CETTE ligne (LDB 12 l.40 : une relance max par Test). */
  rerolled?: boolean;
  /** ENJEU du jet consigné (#1117 L1b) — la RÉFÉRENCE de donnée, jamais un texte : l'entrée de PV
   *  porte ce que l'ÉTAPE mettait en jeu (`CascadeStep.stake`, recopié à l'émission). Rendu UNE fois
   *  par rubrique (`group`) — l'enjeu est celui de l'étape, pas de chaque ligne. */
  stake?: StakeRef;
}

export interface PendingRest extends PendingBase {
  places: RestPlaces;
  /** Les offres d'auberge de la nuit, résolues à l'ouverture (`ouvrirLeRepos`) ; aucune hors d'une auberge. */
  offres: readonly OffreDuRepos[];
  /** OÙ le groupe passe la nuit, dit par l'APPELANT d'`ouvrirLeRepos` (route de la halte, navire, scène courante,
   *  établissement). */
  lieu: LieuDuRepos;
  /** Qualité de la chambre et du repas (`QUALITE_DU_REPOS`). */
  quality: QualiteDeRepos;
  days: number;
  perHero: Record<string, { lodging: RestLodging; food: RestFood }>;
  phase: 'setup';
  /** COOP : ✓ par siège avant de dormir (l'hôte dort à l'unanimité). */
  readyBySeat?: Record<number, boolean>;
  /** Halte de NUIT d'un voyage (travelFlow) : portée par la DERNIÈRE cascade de nuit du séjour
   *  (`openRestNight`) — sa clôture reprend la route (`dispatchCascadeDone`, `combatSlice.ts`). */
  travelHalt?: boolean;
  /** HALTE de voyage À PIED au-delà des heures RAW : héros à tester en MARCHE FORCÉE (LDB 51 l.195) — leurs
   *  jets ouvrent la cascade de la nuit (influençables), avant l'abri/la récupération. */
  travelMarch?: string[];
}

import type { Get, Set } from './flowTypes';
import type { PendingBase } from './rollFlowFactory';
import { dataLabel } from '../data';
import { listeEt, t, type MsgKey } from '../i18n';
import { lieuDuGroupe, offresDeLAubergeDeScene, type OffreDuRepos } from './worldMap';
import { hebergementsDuLieu, refusDuServiceFerme } from './lieuFlow';
import { refuserGeste } from './refusVisible';
import { garanti } from '../lib/garanti';
import { libelleDuLitteral } from './libelles';
import type { PlayerText } from '../i18n/playerText';
import type { FabriqueDuNoyau } from './machinerieDuNoyau';
import type { GesteFermable } from './actionsDuNoyau';
import type { SortiesDeFenetre } from './sortieDeFenetre';
import type { ValidationsDeFenetre } from './validationDeFenetre';
import type { CorpsDesChoix } from './choixDesFenetres';
import { tableTotale } from '../lib/tableTotale';
import { type FragmentDeTables, type PartDeTable } from './tablesPosees';

/** Libellé de la Compétence lancée, lu à la DONNÉE par id STABLE — jamais un littéral au call-site (#1341). */
const SKILL_RESISTANCE = (): string => refLabel('skills', { id: 'resistance' });
const SKILL_CALME = (): string => refLabel('skills', { id: 'calme' });

/**
 * LE moteur de nuit (sans modale) : avance l'horloge à l'aube (× days), entretien #T3, récupération
 * + cauchemars, contagion. Renvoie le bilan structuré ; écrit aussi le journal.
 */
export function sleepParty(
  get: Get,
  set: Set,
  days = 1,
  opts: { fedDaily?: boolean } = {},
): NightEntry[] {
  if (get().battle) return [];
  const n = Math.max(1, Math.floor(days));
  const rng = battleRng();
  const entries: NightEntry[] = [];
  const journal: EntreeDuJournal[] = [];

  // La nuit passe — chaque journée de repos se termine à l'AUBE, UNE NUIT À LA FOIS : n nuits dormies
  // sont n RÉVEILS (`lastNightDay` posé à chaque aube atteinte, avant l'entretien de cette journée-là),
  // donc n émissions d'`onWake`. Un séjour de 7 nuits qui n'aurait sauté qu'à l'aube finale ne
  // réveillerait le groupe qu'une fois (Désespoir, VDM 09 l.280).
  const from = get().gameTime;
  const firstNight = aubeApresNuits(from, 1) - from;
  for (let night = 0; night < n; night++) {
    const minutes = night === 0 ? firstNight : MINUTES_PER_DAY;
    const dormeurs = porteursABord(get, set).filter(({ id }) => id !== WORLD_STEP_OWNER);
    const contagion = calculerLesTestsDExposition(get, set, minutes, [dormeurs]);
    get().avancerLHorloge(minutes);
    set({ lastNightDay: dayIndex(get().gameTime) }); // nuit JOUÉE (#340) — désamorce la privation de sommeil
    // Les Tests d'entretien de la journée (faim, soif, maladie, convalescence, dessoûlage) sont MONTÉS
    // par la porte, comme dans la nuit interactive : ce chemin les résout d'office (`runCascadeImmediate`
    // — branche I du seam), il ne les roule pas lui-même et ne saute aucune fenêtre qui existerait.
    const deferred: DeferredUpkeepTest[] = [];
    const entretien = runDailyUpkeep(get, set, { fedDaily: opts.fedDaily, onDeferTest: (d) => deferred.push(d) });
    const idsDuGroupe = new Set(get().party.map((h) => h.id));
    for (const { actorId, entree } of entretien) {
      entries.push({
        actorId: actorId !== undefined && idsDuGroupe.has(actorId) ? actorId : undefined,
        icon: 'temps/calendrier', label: 'Entretien quotidien', text: entree.texte, tone: 'neutre',
      });
    }
    const steps = nightBands(deferredUpkeepSteps(get().party, deferred));
    steps.push(...bandesDeContagion(get, set, contagion));
    const resolues = steps.length ? runCascadeImmediate(get, set, steps) : [];
    if (!resolues) return entries;
    for (const step of resolues) {
      if (step.kind !== 'contagion') continue;
      for (const row of step.participants ?? []) {
        if (!row.outcome?.length) continue;
        entries.push({
          actorId: row.id, icon: 'medical/infection', label: garanti(step.label, step.id, 'bande de Contraction'),
          text: row.outcome.map((l) => l.entree.texte).join(' '), tone: 'echec',
        });
      }
    }
  }

  // Récupération + cauchemars, héros par héros puis bête par bête (jets structurés pour le bilan). LDB 18 l.296 ; #4804
  const dormeurs = [...get().party, ...betesHorsRencontre(get())];
  for (const h of dormeurs) {
    if (h.dead) continue;
    const jets: RestRoll[] = [];
    const notes: string[] = [];
    const log = restRecovery(h, rng, n, { jets, notes });
    jets.forEach((r, ri) => {
      entries.push({
        id: `${h.id}-${r.kind}-${ri}`,
        actorId: h.id,
        icon: r.kind === 'recuperation' ? 'repos/lit' : 'creature/hurlement',
        label: r.kind === 'recuperation' ? t('step.recuperation') : t('rf.nightmaresLabel'),
        // Mêmes Difficultés que les étapes de la cascade de nuit (chemin influençable) — la ligne les DIT.
        d: { label: r.kind === 'recuperation' ? SKILL_RESISTANCE() : SKILL_CALME(), base: r.base, difficulty: r.kind === 'recuperation' ? 'accessible' : 'facile', modifier: r.target - r.base, target: r.target, roll: r.roll, success: r.success, sl: r.sl },
        tone: r.success ? 'reussite' : 'echec',
        reKind: r.kind,
      });
    });
    for (const text of notes) entries.push({ actorId: h.id, icon: 'repos/lit', label: t('rf.nuit'), text, tone: 'neutre' });
    journal.push(...log.map((l) => ligneDeTexte(l)));
  }

  const title = n > 1 ? t('rf.titleDays', { n }) : t('rf.titleNight');
  set(touchActors(get()));
  get().ecrireAuJournal([ligneDeTexte(title), ...journal]);
  bus.emit(EVT.SCENE_DIRTY);
  return entries;
}

/** LDB 20 l.206 ; LDB 66 l.28 ; MDG 14 l.208 */
function groupesDeLaNuit(get: Get, set: Set, p: PendingRest): PorteurABord[][] {
  const parCouchage = new Map<RestLodging, PorteurABord[]>();
  for (const porteur of porteursABord(get, set)) {
    const couchage = porteur.id === WORLD_STEP_OWNER ? 'bord' : p.perHero[porteur.id]?.lodging;
    if (!couchage) continue;
    const groupe = parCouchage.get(couchage) ?? [];
    groupe.push(porteur);
    parCouchage.set(couchage, groupe);
  }
  return [...parCouchage.values()];
}

// ── CASCADE de NUIT (régime SÉQUENTIEL influençable, cf. cascade.ts) : chaque jet subi devient une
//    ÉTAPE (Lancer → Chance/Résilience → Valider, qui VERROUILLE le jet avant le suivant). La
//    CONSÉQUENCE par `kind` réutilise les primitives PURES (applyRecoveryDay, applyExposureFailure…)
//    — zéro duplication de formule vs la nuit eager (sleepParty/restRecovery). Une défaillance
//    impacte la suite (escalade Exposition, abri → nombre de jets) → c'est pourquoi c'est séquentiel.

/** Symptôme JOUÉ par un Test d'entretien différé, quand le producteur en nomme un — l'ENTRÉE que la
 *  clé d'enjeu doit nommer pour que le renvoi descende à SA fiche (et non à l'intro du chapitre). */
function symptomOf(meta: CascadeStepMeta | undefined): string | undefined {
  return typeof meta?.symptomId === 'string' ? meta.symptomId : undefined;
}

/** BANDE d'Exposition au froid des campeurs — PREMIÈRE vague seulement (`count` = nombre TOTAL de
 *  vagues, déroulées ensuite par `nextExposureWave`). Insérée par l'abri. */
function buildExposureBand(party: Combatant[], camperIds: string[], count: number): BuiltCascadeStep[] {
  const steps: BuiltCascadeStep[] = [];
  for (const id of camperIds) {
    const h = party.find((x) => x.id === id);
    if (!h) continue;
    // Exposition = « Test de Résistance » (`LDB 18 l.328`) : la valeur est celle de la porte
    // (`testValue`, États compris — `LDB 16 l.125`). La pénalité maison « sans manteau » pèse SUR LA
    // CIBLE, en ligne nommée (`exposureCoatMods`), plus fondue par un helper.
    const coat = exposureCoatMods(h).mods ?? [];
    const st = monoStep({ id: `expo-${id}`, kind: 'exposition-nocturne', actor: h, label: t('step.exposition'), icon: 'repos/froid',
      rollLabel: SKILL_RESISTANCE(), difficulty: 'intermediaire',
      stake: nightStakeRef('exposition-nocturne'),
      ligne: { test: { skill: { id: 'resistance' } }, surLaCible: coat } });
    pousseSi(steps, st);
  }
  return exposureWaveBand(steps, 'froid', count);
}

// LES DEUX ROUTES de l'Exposition (`EXPOSURE_BAND_KINDS`) partagent LA conséquence — une déclaration de
// plus, jamais une seconde implémentation : c'est la ROUTE qui diffère (ordres de traversée), pas la règle.
const appliquerLExposition = bandeDeNuit((_get, _set, band, row, hero) => {
  // Volet froid/chaleur (l.330/334) porté par la BANDE (`meta.kind`) — défaut froid (nuit de repos). La peau
  // de phoque (MDG 14 l.277) retient l'échec de justesse AU FROID (+1 DR) : un échec ainsi tenu ne compte
  // NI comme conséquence NI dans l'escalade — comme le chemin eager `exposureNight`.
  const kind = (band.meta?.kind as ExposureKind) ?? 'froid';
  if (!genuineExposureFail(hero, kind, row.result)) {
    const held = !row.result!.success; // échec de justesse tenu par la peau de phoque
    return { applique: { lignes: [ligneDeTexte(held
      ? t('rf.sealskinHeld', { name: nomDe(hero) })
      : t('rf.exposureEndured', { name: nomDe(hero), what: kind === 'froid' ? t('rf.cold') : t('rf.heat') }))], faits: [] } };
  }
  // Escalade CUMULATIVE (l.330/334) : le rang de l'échec est une DONNÉE DE LA RANGÉE, dotée à la
  // construction de la vague (`nextExposureWave`) — donc APRÈS les délestages de la vague précédente.
  const priorFails = Number(row.meta?.priorFails ?? 0);
  // CHALEUR (LDB 18 l.332) : « Vous débarrasser d'une Possession lourde annule 1 Test échoué » — choix
  // du JOUEUR, offert seulement s'il reste une Possession lourde à jeter (aucun seuil inventé, cf.
  // `heaviestPossession`). Sans Possession lourde (ou au FROID, silence du RAW sur ce point) : conséquence
  // immédiate, comportement inchangé.
  const heavy = kind === 'chaleur' ? heaviestPossession(hero) : undefined;
  const drop = heavy ? choiceStep({
    id: `${band.id}-${row.id}-drop`, kind: 'exposition-delestage', actorId: hero.id, icon: 'objet/divers',
    label: t('step.possessionLourde'),
    options: [{ key: 'jeter', label: t('opt.jeter', { quoi: heavy.label }) }, { key: 'garder', label: t('opt.garderPaquetage') }],
    defaultChoice: 'garder', // consommé par `runCascadeImmediate` (repos multi-jours) — `resolveRemainingCascade`
    // (« Tout résoudre ») s'arrête TOUJOURS sur ce choix depuis 249e931f, n'applique plus JAMAIS de défaut
    meta: { failNumber: priorFails + 1, cancelsRowId: nightRowId(band, row) },
  }) : undefined;
  if (heavy && drop) {
    return {
      applique: { lignes: [ligneDeTexte(t('rf.heatFailDrop', { name: nomDe(hero), item: heavy.label }))], faits: [] },
      insert: [drop],
    };
  }
  return { applique: { lignes: applyExposureFailure(hero, priorFails + 1, battleRng(), kind).log.map((x) => ligneDeTexte(x)), faits: [] } };
}, (get, _set, band, ctx, drops) => {
  // Les délestages restent MONO (un CHOIX ne se joue pas en rangée) et la vague SUIVANTE ne se
  // construit qu'APRÈS eux — c'est le dernier délestage qui la déclenche (`meta.nextWaveOf`).
  if (!drops.length) return nextExposureWave(get, band, ctx.steps);
  const last = drops[drops.length - 1];
  last.meta = { ...last.meta, nextWaveOf: String(band.id) };
  return [...drops];
});

/** Icône d'étape de cascade par `kind` de Test d'entretien différé. */
const UPKEEP_STEP_ICON: Record<string, IconId> = {
  faim: 'repos/repas-fait-maison', 'maladie-test-quotidien': 'medical/infection', 'maladie-gangrene': 'medical/infection', 'maladie-persistance': 'medical/infection',
  'convalescence-fracture': 'medical/bequille', contagion: 'medical/infection',
};

/** Convertit les Tests d'entretien DIFFÉRÉS (`runDailyUpkeep` onDeferTest — Faim/Soif/maladie/
 *  convalescence/dessoûlage) en étapes de cascade influençables, avec leur enjeu verbatim (`stakes.json`)
 *  quand il est documenté. SOURCE UNIQUE partagée par la nuit (`buildNightCascade`) et l'avance
 *  d'horloge (`avancerLeTemps`). `startIndex` = décalage d'id quand d'autres étapes précèdent (marche forcée). */
export function deferredUpkeepSteps(party: Combatant[], deferred: DeferredUpkeepTest[], startIndex = 0): BuiltCascadeStep[] {
  const steps: BuiltCascadeStep[] = [];
  for (const t of deferred) {
    const h = party.find((x) => x.id === t.heroId);
    if (!h || h.dead) continue;
    const st = monoStep({ id: `${t.kind}-${t.heroId}-${startIndex + steps.length}`, kind: t.kind, actor: h, label: dataLabel(t.label),
      // La compétence se DÉRIVE des ids quand le producteur les porte (Dessoûlage = Résistance à
      // l'alcool, LDB 09 l.485) ; sans ids, le repli reste la Résistance de l'entretien (LDB 18 l.338).
      icon: UPKEEP_STEP_ICON[t.kind] ?? 'navigation/des', rollLabel: testSkillLabel(t.test ?? {}) ?? SKILL_RESISTANCE(),
      difficulty: t.difficulty,
      // L'ENTRÉE JOUÉE (le symptôme dû ce jour) entre dans la clé : le renvoi descend à SA fiche.
      stake: nightStakeRef(t.kind, symptomOf(t.meta as CascadeStepMeta | undefined)),
      // Ligne montée par le wrapper d'entretien (`upkeep.ts`, `rollStep`) AU MOMENT du Test dû : la
      // remonter ici la calculerait sur un héros que l'entretien a changé entre-temps.
      montee: { base: t.base, ...(t.mods?.length ? { mods: t.mods } : {}), target: t.target, ...(t.clamped ? { clamped: t.clamped } : {}) },
      teste: designeGaranti(t.test ?? {}, t.kind),
      // Le JOUR rejoint le `meta` : il entre dans la CLÉ de bande (`nightBands`) — trois jours
      // franchis font trois bandes de Dessoûlage, pas trois rangées de même id dans une seule.
      meta: { ...t.meta, day: t.day } as CascadeStepMeta });
    if (!st) continue;
    steps.push(st);
  }
  return steps;
}

/**
 * Construit la cascade d'UNE nuit (single-night INTERACTIVE) : avance l'horloge à l'aube, applique
 * l'entretien et la récupération sans jet, puis monte les étapes influençables. Réutilise les calculs
 * et les bandes de Contraction communs avec `sleepParty`. Renvoie les étapes et l'horloge avant et
 * après le repos.
 */
export function buildNightCascade(get: Get, set: Set, p: PendingRest, opts: { fedDaily?: boolean; extraContagion?: ContagionSpec[] } = {}): { steps: BuiltCascadeStep[]; slept: { from: number; to: number } } {
  const log: EntreeDuJournal[] = [];
  const from = get().gameTime;
  // La nuit passe — une journée de repos se termine à l'AUBE.
  const minutes = aubeApresNuits(from, 1) - from;
  const contagion = calculerLesTestsDExposition(
    get, set, minutes, groupesDeLaNuit(get, set, p), p.travelHalt ? incubationPendantLeVoyage(get) : undefined,
  );
  get().avancerLHorloge(minutes);
  set({ lastNightDay: dayIndex(get().gameTime) }); // nuit JOUÉE (#340) — désamorce la privation de sommeil
  // Entretien quotidien (#T3) — la partie SANS jet est eager (rations consommées, jours décomptés) ;
  // TOUT Test de Résistance (Faim LDB 18 l.342, maladie l.110/135/162, convalescence LDB 18 l.202) est DIFFÉRÉ en
  // étape influençable (sinon il serait pré-résolu dans le journal AVANT que le joueur n'agisse).
  const deferred: DeferredUpkeepTest[] = [];
  // `runDailyUpkeep` journalise ses propres lignes (#216) : `log` ne porte que ce qui suit l'entretien.
  runDailyUpkeep(get, set, { fedDaily: opts.fedDaily, onDeferTest: (t) => deferred.push(t) });
  // `party` lu APRÈS l'entretien : `runDailyUpkeep` a pu débiter les gages (`tickCampaignVesselWeek` → clone
  // `withBourseMoney` du/des héros ponctionnés) — toute la suite (mutations eager de récupération/
  // cauchemars, `expireOnRespite`) doit opérer sur ces réfs à jour, pas sur celles PÉRIMÉES
  // d'avant l'entretien (sinon perdues au `set({party:[...get().party]})` de clôture, l.551).
  const party = get().party;

  const steps: BuiltCascadeStep[] = [];
  // MARCHE FORCÉE de la journée de voyage (LDB 51 l.195) : un jet par héros — la chaîne ouvre la cascade.
  for (const id of p.travelMarch ?? []) {
    const h = party.find((x) => x.id === id);
    if (!h || h.dead) continue;
    const st = monoStep({ id: `march-${id}`, kind: 'marche-forcee', actor: h, label: t('step.marcheForcee'), icon: 'voyage/a-pied',
      rollLabel: SKILL_RESISTANCE(), difficulty: 'intermediaire',
      stake: nightStakeRef('marche-forcee'),
      ligne: { test: { skill: { id: 'resistance' }, characteristic: 'endurance' } } });
    pousseSi(steps, st);
  }
  // Tests d'entretien DIFFÉRÉS (faim, soif, maladie, convalescence, dessoûlage) → étapes influençables.
  steps.push(...deferredUpkeepSteps(party, deferred, steps.length));
  // LDB 20 l.206 ; MDG 14 l.208 ; LDB 66 l.5
  steps.push(...bandesDeContagion(get, set, [...contagion, ...(opts.extraContagion ?? [])]));
  // Campement : Exposition (intempéries) — abri de fortune (STEP) → insère les jets d'Exposition.
  const campers = party.filter((h) => !h.dead && p.perHero[h.id]?.lodging === 'dehors');
  const severity = activeExposureSeverity(get);
  if (campers.length && severity !== 'clement') {
    const camperIds = campers.map((h) => h.id);
    if (exposureShelterFromTent(party)) {
      log.push(ligneDeTexte(t('rf.tentUp')));
      const count = exposureTestCount(severity, true); // tente : extrême → rythme difficile, difficile → 0
      if (count > 0) steps.push(...buildExposureBand(party, camperIds, count));
    } else {
      const best = partyAssisted(party, { skill: { id: 'survie-en-exterieur' } }); // Soutien (LDB 12)
      if (best) {
        const st = monoStep({ id: 'abri', kind: 'abri-de-fortune', actor: best.actor, label: t('step.abriDeFortune'), icon: 'repos/campement',
          rollLabel: refLabel('skills', { id: 'survie-en-exterieur' }), difficulty: 'intermediaire',
          stake: nightStakeRef('abri-de-fortune'),
          // `best.value` porte le Soutien FONDU : le monteur le ressort en ligne NOMMÉE (LDB 12 l.187-200),
          // et décompose le reste en Niveau de Compétence nu + composantes.
          ligne: { test: { skill: { id: 'survie-en-exterieur' } }, valeur: best.value, soutien: best.support },
          meta: { severity, campers: camperIds.join(',') } });
        pousseSi(steps, st);
      } else {
        const count = exposureTestCount(severity, false);
        if (count > 0) steps.push(...buildExposureBand(party, camperIds, count));
      }
    }
    for (const h of campers) expireOnRespite(h, get().gameTime + Number(rule('exposition-dissipation-heures')) * 60); // dissipation maison
  }

  // Récupération + cauchemars : un jet = une étape ; sans jet (PB plein/affamé/instable) → eager, et la nuit dit
  // pourquoi un dormeur ne récupère pas (`constatSansRecuperation`).
  for (const h of [...party, ...betesHorsRencontre(get())]) {
    if (h.dead) continue;
    if (needsRecoveryRoll(h)) {
      // Récupération = « Test de Résistance Accessible (+20) » (`LDB 18 l.296`) : valeur de la porte.
      const st = monoStep({ id: `recov-${h.id}`, kind: 'recuperation', actor: h, label: t('step.recuperation'), icon: 'repos/lit',
        rollLabel: SKILL_RESISTANCE(), difficulty: 'accessible',
        stake: nightStakeRef('recuperation'),
        ligne: { test: { skill: { id: 'resistance' } } } });
      pousseSi(steps, st);
    } else {
      const before = h.wounds.current;
      const sans = constatSansRecuperation(h);
      const sortie: Applique = { lignes: [], faits: [] };
      const { wokeUp } = applyRecoveryDay(h, null, sortie);
      if (h.wounds.current - before > 0) log.push(ligneDeTexte(t('rf.recovered', { name: nomDe(h), n: h.wounds.current - before })));
      if (wokeUp) log.push(ligneDeTexte(t('heal.awake', { name: nomDe(h) })));
      log.push(...sortie.lignes);
      if (sans) log.push(ligneDeTexte(t(sans.cle, { ...sans.params, name: nomDe(h) })));
    }
    if (h.nightmares) {
      const st = monoStep({ id: `nm-${h.id}`, kind: 'cauchemar', actor: h, label: t('step.cauchemars'), icon: 'creature/hurlement',
        rollLabel: SKILL_CALME(), difficulty: 'facile',
        stake: nightStakeRef('cauchemar'),
        // Cauchemars = « Test de Calme Facile (+40) » (`LDB 21 l.95`) : valeur de la porte, États compris.
        ligne: { test: { skill: { id: 'calme' } } } });
      pousseSi(steps, st);
    }
  }

  // BANDES (#1117 L3) : les Tests qui répondent à la MÊME entrée de règle le MÊME jour font UNE
  // fenêtre, une rangée par héros appelé — 1er des TROIS bâtisseurs à passer par la fabrique.
  const banded = nightBands(steps);

  // Journal : le titre de nuit + tout ce qui s'est ajouté APRÈS l'entretien (tente, récupération sans
  // jet…) — l'entretien lui-même est déjà dans le journal (`runDailyUpkeep`, écriture unique, #216).
  set({ party: [...get().party] });
  get().ecrireAuJournal([ligneDeTexte(t('rf.titleNight')), ...log]);
  bus.emit(EVT.SCENE_DIRTY);
  return { steps: banded, slept: { from, to: get().gameTime } };
}

/** Prix RAW de l'hébergement et du repas d'auberge (LDB 66 l.12-16) — SOURCE UNIQUE le catalogue
 *  `trappings.json` (ids de service), lu par `PRIX_DU_LIVRE`. */
function serviceBrass(id: string): number {
  const t = findTrappingById(id);
  if (!t) throw new Error(`restCost : tarif de service introuvable au catalogue "${id}" (trappings.json).`);
  return toBrass(priceToMoney(t.price));
}

/** La qualité d'une chambre et d'un repas : facteur des prix listés, risque (en %) d'exposition à la
 *  Courante galopante du repas consommé. LDB 66 l.5 */
const QUALITE_DU_REPOS = {
  pietre: { prix: 0.5, courante: 10 },
  normale: { prix: 1, courante: 0 },
  grande: { prix: 2, courante: 0 },
} as const satisfies Record<QualiteDeRepos, { prix: number; courante: number }>;

/** Les lits et le prix (en chambres privées) de chaque offre de chambre. LDB 66 l.28 */
const CHAMBRES = { chambre: { lits: 2, prix: 1 }, grande: { lits: 4, prix: 2 } } as const satisfies Record<OffreDeChambre, { lits: number; prix: number }>;

/** Prix du livre de chaque offre d'auberge, en sous. LDB 66 l.12-16, l.28 */
const PRIX_DU_LIVRE = {
  commune: serviceBrass('chambre-commune-nuit'),
  chambre: serviceBrass('chambre-privee-nuit') * CHAMBRES.chambre.prix,
  grande: serviceBrass('chambre-privee-nuit') * CHAMBRES.grande.prix,
  repas: serviceBrass('repas-auberge'),
} as const satisfies Record<OffreDuRepos['id'], number>;

/** Le prix d'une nuit (ou d'un repas) de l'offre `offre` : son `prix` absolu, sinon le prix du livre × le facteur de
 *  la qualité `qualite`. Source UNIQUE du prix d'une offre : note du repos (`partsDuRepos`) et affichage. LDB 66 l.5 */
export function prixDeLOffre(offre: OffreDuRepos, qualite: QualiteDeRepos): Money {
  if (offre.prix) return fromBrass(toBrass(toMoney(offre.prix)));
  return fromBrass(Math.ceil(PRIX_DU_LIVRE[offre.id] * QUALITE_DU_REPOS[qualite].prix));
}

/** L'offre `id` de la nuit `p`, `undefined` si elle n'y est pas offerte. */
const offreDuRepos = (p: Pick<PendingRest, 'offres'>, id: OffreDuRepos['id']): OffreDuRepos | undefined => p.offres.find((o) => o.id === id);

/** L'offre de chambre de l'appariement de troupe (`appariementEnChambres`) : la chambre, sinon la grande chambre, si la
 *  nuit l'offre. */
export const chambreDeTroupe = (p: Pick<PendingRest, 'offres'>): OffreDeChambre | undefined => OFFRES_DE_CHAMBRE.find((o) => offreDuRepos(p, o));
const OFFRES_DE_CHAMBRE = Object.keys(CHAMBRES) as OffreDeChambre[];
/** Le libellé d'une chambre prise et d'une chambre neuve, par offre. */
const LIBELLES_DE_CHAMBRE = {
  chambre: { prise: 'rf.chambre', neuve: 'rf.chambreNeuve' },
  grande: { prise: 'rf.grandeChambre', neuve: 'rf.grandeChambreNeuve' },
} as const satisfies Record<OffreDeChambre, { prise: MsgKey; neuve: MsgKey }>;
const ID_DE_CHAMBRE = new RegExp(`^(${OFFRES_DE_CHAMBRE.join('|')})-([1-9]\\d*)$`);

/** L'offre et le numéro de la chambre `id` ; `null` : `id` n'est pas une chambre. */
function lireLaChambre(id: string): { offre: OffreDeChambre; numero: number } | null {
  const m = ID_DE_CHAMBRE.exec(id);
  return m ? { offre: m[1] as OffreDeChambre, numero: Number(m[2]) } : null;
}
const idDeChambre = (offre: OffreDeChambre, numero: number): IdDeChambre => `${offre}-${numero}`;

/** Une chambre de la nuit : son id, son offre, son numéro et ses occupants. */
export interface ChambreDuRepos { id: IdDeChambre; offre: OffreDeChambre; numero: number; occupants: string[] }

/** Les chambres de la nuit, dérivées du couchage de chaque héros vivant réglé, par offre puis par numéro. PUR. */
export function chambresDuRepos(p: PendingRest, party: Combatant[]): ChambreDuRepos[] {
  const parId = new Map<string, ChambreDuRepos>();
  for (const h of party) {
    const id = !h.dead ? p.perHero[h.id]?.lodging : undefined;
    const lue = id === undefined ? null : lireLaChambre(id);
    if (!id || !lue) continue;
    const c = parId.get(id) ?? { id, ...lue, occupants: [] };
    c.occupants.push(h.id);
    parId.set(id, c);
  }
  return [...parId.values()].sort((a, b) => OFFRES_DE_CHAMBRE.indexOf(a.offre) - OFFRES_DE_CHAMBRE.indexOf(b.offre) || a.numero - b.numero);
}

/** Une chambre offerte au dormeur : son offre, son numéro, ses lits, ceux qui y dorment, et si elle est pleine sans lui. */
interface ChambreOfferte { offre: OffreDeChambre; numero: number; lits: number; occupants: string[]; pleine: boolean }

/** Un couchage que la nuit offre au dormeur `pid` (`undefined` : hors de toute rangée) : son id, son libellé, sa
 *  chambre (`null` hors chambre) et sa raison de fermeture (`refus`) ou `null`. */
export interface CouchageDeLaNuit { id: RestLodging; libelle: string; chambre: ChambreOfferte | null; refus: string | null }

/** Les chambres que la nuit offre au dormeur `pid` : une chambre prise, fermée s'il n'y dort pas et que ses lits sont
 *  tous occupés, ou la chambre neuve d'une offre de la nuit (numéro libre suivant). PUR. */
function chambresOffertes(p: PendingRest, party: Combatant[], pid?: string): CouchageDeLaNuit[] {
  const prises = chambresDuRepos(p, party);
  const nom = (id: string) => party.find((h) => h.id === id)?.label ?? id;
  const ouvertes = prises.map((c) => {
    const lits = CHAMBRES[c.offre].lits;
    const chambre = t(LIBELLES_DE_CHAMBRE[c.offre].prise, { n: c.numero, lits });
    const autres = c.occupants.filter((o) => o !== pid).map(nom);
    const pleine = c.occupants.length >= lits && !c.occupants.includes(pid ?? '');
    return {
      id: c.id, libelle: autres.length ? t('rf.chambreAvec', { chambre, noms: listeEt(autres) }) : chambre,
      chambre: { offre: c.offre, numero: c.numero, lits, occupants: c.occupants, pleine }, refus: pleine ? t('rf.chambrePleine') : null,
    };
  });
  const neuves = OFFRES_DE_CHAMBRE.filter((offre) => offreDuRepos(p, offre)).map((offre) => {
    let numero = 1;
    while (prises.some((c) => c.id === idDeChambre(offre, numero))) numero++;
    const lits = CHAMBRES[offre].lits;
    return { id: idDeChambre(offre, numero), libelle: t(LIBELLES_DE_CHAMBRE[offre].neuve, { lits }), chambre: { offre, numero, lits, occupants: [], pleine: false }, refus: null };
  });
  return [...ouvertes, ...neuves];
}

/** Les couchages que la nuit offre au dormeur `pid` : les chambres d'une auberge, puis les couchages sans chambre
 *  (`lodgingOptions`). PUR. LDB 66 */
export function couchagesDeLaNuit(p: PendingRest, party: Combatant[], pid?: string): CouchageDeLaNuit[] {
  return [
    ...chambresOffertes(p, party, pid),
    ...lodgingOptions(p).map((id) => ({ id, libelle: garanti(libelleDuLitteral(id, 'couchage'), id, 'couchage sans chambre'), chambre: null, refus: null })),
  ];
}

/** L'appariement par défaut en chambres de l'offre `offre` : les héros vivants de `heros`, dans leur ordre, par lits
 *  de la chambre, vers l'id de leur chambre. LDB 66 l.28 PUR. */
export function appariementEnChambres(heros: Combatant[], offre: OffreDeChambre): Record<string, IdDeChambre> {
  return Object.fromEntries(heros.filter((h) => !h.dead).map((h, i) => [h.id, idDeChambre(offre, Math.floor(i / CHAMBRES[offre].lits) + 1)]));
}

/** Couchages sans chambre que propose la nuit — PAR HÉROS ensuite (choix personnels) ; avec les chambres
 *  d'une auberge : `couchagesDeLaNuit`. */
export function lodgingOptions(p: Pick<PendingRest, 'places' | 'offres'>): CouchageSansChambre[] {
  const { places } = p;
  const out: CouchageSansChambre[] = [];
  if (offreDuRepos(p, 'commune')) out.push('commune');
  if (places.maison) out.push('maison');
  if (places.bord) out.push('bord'); // à bord = hamacs (MDG 03 l.71) ; par défaut si offert
  if (places.camp || places.auberge || places.maison) out.push('dehors'); // la belle étoile reste un choix
  return out;
}

/** Pitances qu'offre la nuit (repas d'auberge, table de la maison), communes à toute la troupe. */
const pitancesDuLieu = (p: Pick<PendingRest, 'places' | 'offres'>): RestFood[] => [...(offreDuRepos(p, 'repas') ? ['repas' as const] : []), ...(p.places.maison ? ['maison' as const] : [])];

/** Pitances proposées à un héros (orthogonales au couchage : manger à l'auberge et dormir dehors est permis).
 *  « ration » seulement si le héros en a une. */
export function foodOptions(p: Pick<PendingRest, 'places' | 'offres'>, hero: Combatant): RestFood[] {
  return [...pitancesDuLieu(p), ...((hero.items ?? []).some(isRation) ? ['ration' as const] : []), 'rien'];
}

/** Pitances du choix « pour toute la troupe » : celles du lieu, sans la ration, qui dépend du sac de chacun. */
export function nourrituresDeTroupe(p: Pick<PendingRest, 'places' | 'offres'>): RestFood[] {
  return [...pitancesDuLieu(p), 'rien'];
}

/** Part de chaque héros vivant réglé dans la note du repos, par nuit × days, au prix de chaque offre prise
 *  (`prixDeLOffre`) ; d'une chambre partagée, un sou du reste à chacun de ses premiers occupants (ingénierie). La somme
 *  des parts EST `restCost`. LDB 66 l.12-16, l.28 */
export function partsDuRepos(p: PendingRest, party: Combatant[]): Record<string, Money> {
  const prixDe = (id: OffreDuRepos['id']) => toBrass(prixDeLOffre(garanti(offreDuRepos(p, id), id, 'offre de la nuit'), p.quality));
  const enChambre = new Map<string, number>();
  for (const c of chambresDuRepos(p, party)) {
    const prix = prixDe(c.offre);
    c.occupants.forEach((id, i) => enChambre.set(id, Math.floor(prix / c.occupants.length) + (i < prix % c.occupants.length ? 1 : 0)));
  }
  const parts: Record<string, Money> = {};
  for (const h of party.filter((x) => !x.dead && p.perHero[x.id])) {
    const { lodging, food } = p.perHero[h.id];
    const brass = (lodging === 'commune' ? prixDe('commune') : 0) + (food === 'repas' ? prixDe('repas') : 0);
    parts[h.id] = fromBrass(((enChambre.get(h.id) ?? 0) + brass) * Math.max(1, p.days));
  }
  return parts;
}

/** Coût total du repos : la somme des `partsDuRepos`. */
export function restCost(p: PendingRest, party: Combatant[]): Money {
  return fromBrass(Object.values(partsDuRepos(p, party)).reduce((n, m) => n + toBrass(m), 0));
}

/** Offre de repos À LA POSITION DU GROUPE : la scène résolue (`reposDeLaScene`) à la zone de repos (rect d'auteur)
 *  qui l'y couvre, prioritaire, sinon à la scène entière. PARAMÉTRABLE SUR LA ZONE dans l'éditeur. */
export function restPlacesHere(st: Jeu): ReturnType<typeof reposDeLaScene> | null {
  const sc = st.scene;
  if (!sc) return null;
  const pos = st.partyPos;
  const zone = pos ? [...(sc.restZones ?? [])].reverse().find((z) =>
    pos.x >= z.rect.x && pos.x < z.rect.x + z.rect.w && pos.y >= z.rect.y && pos.y < z.rect.y + z.rect.h
    && (z.rect.z ?? 0) === (pos.z ?? 0)) : undefined;
  const repos = reposDeLaScene(sc, zone);
  const { places } = repos;
  return places.auberge || places.maison || places.camp ? repos : null;
}

/** Options d'`ouvrirLeRepos` : l'APPELANT dit où le groupe dort (`places` = l'offre, `lieu` = où). */
export interface OpenRestOpts {
  lieu: LieuDuRepos;
  places?: RestPlaces;
  quality?: QualiteDeRepos;
  /** Les offres d'auberge de la nuit : celles de l'établissement résolues par `placeServices`, ou celles que la scène
   *  déclare (`Scene.rest.offres`, `restPlacesHere`) ; absentes : celles d'une auberge de scène (`offresDeLAubergeDeScene`). */
  offres?: readonly OffreDuRepos[];
  days?: number;
  travelHalt?: boolean;
  /** Le jour de voyage CLOS par cette halte — rejoint `travelPlan.log`, sa seule demeure. */
  travelDay?: import('./travelFlow').TravelRecapDay;
  travelMarch?: string[];
}

/** Le repos qu'offre l'endroit où se tient le groupe : à un lieu de la carte, l'établissement d'hébergement
 *  `hebergementId` (`hebergementsDuLieu`), son offre de repos (places, qualité, offres d'auberge) et son nom d'auteur (le
 *  nom du lieu sans lui) ; ailleurs, la scène à la position du groupe (`restPlacesHere`) ; `null` : aucun. */
export function reposDuLieu(get: Get, hebergementId?: string): OpenRestOpts | null {
  const s = get();
  const ici = lieuDuGroupe(s);
  if (ici) {
    const etablissement = hebergementsDuLieu(s).find((svc) => svc.id === hebergementId);
    if (!etablissement) return null;
    const nom = etablissement.nommeParLAuteur ? dataLabel(etablissement.label) : libelleOuAbsence(ici, 'lieu', ici.id);
    return { ...etablissement.rest, lieu: { nom } };
  }
  const scene = restPlacesHere(s);
  return scene && { ...scene, lieu: sceneLieu(get) };
}

/** Le repos ne s'ouvre ni en combat ni sur une nuit qui attend encore son règlement : la garde de toute ouverture
 *  (`ouvrirLeRepos`), et le premier motif du refus du verbe (`refusDuRepos`). PUR. */
const motifDuReposClos = (s: Pick<Jeu, 'battle' | 'pendingRest'>): MsgKey | null =>
  (s.battle ? 'repos.refus.enCombat' : s.pendingRest ? 'repos.refus.nuitARegler' : null);

/** Refus du verbe `ouvrirLeRepos` : le repos clos (`motifDuReposClos`), l'hébergement `hebergementId` fermé
 *  (`refusDuServiceFerme`) ou inconnu au lieu de la carte, ou, hors lieu, aucun repos là où se tient le groupe
 *  (`restPlacesHere`) ; `null` : il s'ouvre. Verdict UNIQUE du verbe et de son offre (`gesteDuRepos`). PUR. */
function refusDuRepos(s: Jeu, hebergementId?: string): string | null {
  const clos = motifDuReposClos(s);
  if (clos) return t(clos);
  const ferme = refusDuServiceFerme(s, hebergementId);
  if (ferme) return ferme;
  if (lieuDuGroupe(s)) return hebergementsDuLieu(s).some((svc) => svc.id === hebergementId) ? null : t('lieu.hebergementInconnu', { service: hebergementId ?? '' });
  return restPlacesHere(s) ? null : t('repos.refus.aucunIci');
}

/** L'offre de dormir là où se tient le groupe, à l'hébergement `hebergementId` d'un lieu de la carte (`ouvrirLeRepos`) :
 *  son refus, `refusDuRepos`. PUR. */
export function gesteDuRepos(s: Jeu, hebergementId?: string): GesteFermable {
  return { geste: { verbe: 'ouvrirLeRepos', args: hebergementId === undefined ? [] : [hebergementId] }, refus: refusDuRepos(s, hebergementId) };
}

/** Ouvre la modale de Repos avec une OFFRE de lieux (effet, halte de voyage, bouton de Repos). */
export function ouvrirLeRepos(get: Get, set: Set, opts: OpenRestOpts): void {
  const st = get();
  if (motifDuReposClos(st)) return;
  const places = { ...(opts.places ?? { maison: true, camp: true }) }; // #2097
  const nuit = { places, offres: places.auberge ? structuredClone(opts.offres ?? offresDeLAubergeDeScene()) : [] };
  // Le couchage par défaut : la chambre de troupe si la nuit en offre une, sinon le premier couchage hors chambre.
  const offre = chambreDeTroupe(nuit);
  const chambres = offre ? appariementEnChambres(st.party, offre) : {};
  const perHero: PendingRest['perHero'] = {};
  for (const h of st.party.filter((x) => !x.dead)) {
    perHero[h.id] = { lodging: chambres[h.id] ?? lodgingOptions(nuit)[0], food: foodOptions(nuit, h)[0] };
  }
  // CHRONIQUE de voyage (#333) : une halte de voyage porte le jour FINALISÉ — on l'accumule sur le plan
  // (même `set` que la nuit à régler) pour que le trajet en vue (`voyageEnVue`) en tienne le journal (une journée par
  // jour passé), source unique (STRUCTURE `TravelRecapDay`, jamais une chaîne recomposée). No-op hors halte.
  const logPatch = opts.travelDay && st.travelPlan
    ? { travelPlan: { ...st.travelPlan, log: [...(st.travelPlan.log ?? []), opts.travelDay] } }
    : {};
  set({ ...logPatch, pendingRest: { ...nuit, lieu: opts.lieu, quality: opts.quality ?? 'normale', days: Math.max(1, opts.days ?? 1), perHero, phase: 'setup', travelHalt: opts.travelHalt, travelMarch: opts.travelMarch } });
}

/** Le dormeur `pid` de la nuit à régler : un héros du groupe qui dort ici, tant que la nuit n'est pas réglée. */
export const dormeurDuRepos = (s: Pick<Jeu, 'pendingRest' | 'party'>, pid: string | undefined): Combatant | undefined =>
  (s.pendingRest?.phase === 'setup' && pid !== undefined && s.pendingRest.perHero[pid] ? s.party.find((h) => h.id === pid) : undefined);

/** Les choix de la nuit à régler (`CorpsDesChoix`) : le couchage et la pitance du dormeur de la rangée. */
export function choixDuRepos(get: Get, set: Set) {
  const regler = (pid: string, patch: Partial<PendingRest['perHero'][string]>) => {
    const p = garanti(get().pendingRest, pid, 'nuit à régler');
    set({ pendingRest: { ...p, perHero: { ...p.perHero, [pid]: { ...p.perHero[pid], ...patch } } } });
  };
  return {
    repos: {
      couchage: (lodging, pid) => regler(pid, { lodging }),
      pitance: (food, pid) => regler(pid, { food }),
    },
  } satisfies Partial<CorpsDesChoix>;
}

/** Les bourses du groupe couvrent-elles la note de la halte réglée (`restCost`) ? Vrai sans halte. LDB 66 */
export function noteDAubergeCouverte(s: Pick<Jeu, 'pendingRest' | 'party'>): boolean {
  return !s.pendingRest || toBrass(restCost(s.pendingRest, s.party)) <= toBrass(totalDesBourses(s.party));
}

/** Les risques d'exposition des offres que prend un dormeur réglé `cfg` : le `risque` de chaque offre prise (ACE 02
 *  l.99), le repas sans risque propre exposant à la Courante galopante de la qualité (LDB 66 l.5). PUR. */
function risquesDesOffres(p: PendingRest, cfg: PendingRest['perHero'][string]): { maladie: string; pourcent: number }[] {
  const couchage = cfg.lodging === 'commune' ? 'commune' : lireLaChambre(cfg.lodging)?.offre;
  // Chaque offre prise, et la Courante galopante de la qualité à défaut de risque propre (le repas seul, LDB 66 l.5).
  const prises: [OffreDuRepos['id'] | undefined, number][] = [[cfg.food === 'repas' ? 'repas' : undefined, QUALITE_DU_REPOS[p.quality].courante], [couchage, 0]];
  return prises.flatMap(([id, courante]): { maladie: string; pourcent: number }[] => {
    const offre = id ? offreDuRepos(p, id) : undefined;
    if (!offre) return [];
    if (offre.risque) return [{ maladie: offre.risque.maladie.id, pourcent: offre.risque.pourcent }];
    return courante > 0 ? [{ maladie: 'courante-galopante', pourcent: courante }] : [];
  });
}

/** Dormir : paie (RAW ch.66), nourrit, puis ouvre la CHAÎNE de cascades de nuit (#347, `openRestNight`). Corps de la
 *  validation du repos (`fenetreValider('repos')`), que l'hôte joue au quorum, la note couverte. */
function dormir(get: Get, set: Set): void {
  const p = get().pendingRest!;
  const rng = battleRng();

  // 1. La note d'auberge (LDB 66) — dépense de BANDE (aucun bénéficiaire unique) tirée gloutonnement des
  //    bourses, couverte par la validation (`FERMETURES_DE_LA_VALIDATION.rest`).
  const cost = restCost(p, get().party);
  if (toBrass(cost) > 0) payFromGroup(get, set, cost, { purpose: 'auberge' });

  // 2. Pitance AVANT la nuit (un héros nourri n'est plus affamé). Chaque offre prise expose au risque de son
  //    établissement (`risquesDesOffres`, ACE 02 l.99), le repas sans risque propre à celui de sa qualité
  //    (`QUALITE_DU_REPOS`, LDB 66 l.5) — Test DIFFÉRÉ en étape de cascade.
  //    `party` est relu APRÈS le débit : `payFromGroup` remplace les objets héros des bourses ponctionnées,
  //    et `feedFromMeal` mute EN PLACE — nourrir un objet héros périmé laisserait le dormeur affamé.
  const party = get().party;
  const extraContagion: ContagionSpec[] = [];
  for (const h of party) {
    const cfg = p.perHero[h.id];
    if (!cfg || h.dead) continue;
    if (cfg.food === 'repas' || cfg.food === 'maison') feedFromMeal(h);
    // 'ration' : consommée par l'entretien quotidien (#T3) ; 'rien' : la Faim suivra son cours.
    for (const { maladie, pourcent } of risquesDesOffres(p, cfg)) {
      if (rng.int(1, 100) <= pourcent && contractionDue(h, maladie)) {
        extraContagion.push({ porteurId: h.id, diseaseName: maladie, difficulty: diseaseDefs()[maladie]?.contractDifficulty ?? 'accessible', nombre: 1 });
      }
    }
  }

  // 3. Nuit(s) → CHAÎNE de cascades séquentielles influençables (#347, patron #253) : CHAQUE jet subi
  //    (faim, maladie, convalescence, contagion, abri, Exposition, récupération, cauchemars) est une
  //    ÉTAPE qu'on lance, influence (Chance/Résilience) puis VERROUILLE avant la suivante — AUCUN jet
  //    pré-résolu. Un repos de PLUSIEURS jours n'est PAS pré-construit d'un coup (l'entretien de la
  //    nuit N+1 lit l'état MUTÉ par la nuit N — compteurs de faim/soif, jours de maladie…) : chaque
  //    nuit est reconstruite APRÈS que la précédente ait été validée, chaînée par `dispatchCascadeDone`
  //    (`combatSlice.ts`, `done.restNights`) — une nuit UNIQUE est le cas `days=1` de la même primitive.
  //    Le report de voyage du jour a déjà été lu en phase RÉGLAGES (`voyageEnVue`).
  set({ pendingRest: null });
  openRestNight(get, set, p, p.days, extraContagion);
}

/** Le toit d'une nuit : l'auberge, un logis, le bord, ou le campement. */
export type ToitDeLaNuit = 'auberge' | 'maison' | 'bord' | 'campement';

/** Le toit de la nuit — le couchage RÉELLEMENT choisi (pas l'OFFRE du lieu) : tout le monde dehors →
 *  campement, même si une auberge était dispo (le joueur a choisi la belle étoile). Identique pour
 *  toutes les nuits d'un repos multi-jours (les choix de couchage ne changent pas en cours de séjour). */
export function toitDeLaNuit(p: PendingRest, party: Combatant[]): ToitDeLaNuit {
  const lodgings = party.filter((h) => !h.dead && p.perHero[h.id]).map((h) => p.perHero[h.id].lodging);
  return lodgings.some((l) => l === 'commune' || lireLaChambre(l)) ? 'auberge'
    : lodgings.some((l) => l === 'maison') ? 'maison'
    : lodgings.some((l) => l === 'bord') ? 'bord'
    : 'campement';
}

/** Le titre de la nuit, par son toit (`toitDeLaNuit`). */
export const TITRE_DE_LA_NUIT = { auberge: 'rf.nightInn', maison: 'rf.nightHome', bord: 'rf.nightAboard', campement: 'rf.nightCamp' } as const satisfies Record<ToitDeLaNuit, MsgKey>;

/** Ouvre (ou enchaîne) UNE nuit de repos (#347) : reconstruit `buildNightCascade` pour CETTE nuit et
 *  l'ouvre en cascade influençable, en portant `nightsLeft` (nuits ENCORE à enchaîner après celle-ci)
 *  sur la cascade — sa clôture (`continueRestNights`, appelée par `dispatchCascadeDone`) reprend alors
 *  la nuit suivante. `extraContagion` (repas de la qualité à risque) ne s'applique qu'à la nuit d'ARRIVÉE (repas
 *  du soir posé une fois en amont par `dormir`).
 */
export function openRestNight(get: Get, set: Set, p: PendingRest, nightsLeft: number, extraContagion: ContagionSpec[] = [], apresLesRounds?: true): void {
  // Les Rounds de la nuit, joués avant elle : LDB 16 l.105.
  if (!apresLesRounds) {
    const minutes = aubeApresNuits(get().gameTime, 1) - get().gameTime;
    if (jouerLEntretienDesRoundsEcoules(get, set, minutes) === MAIN_RENDUE) {
      confierLaSuite(set, [{ verbe: 'reprendreLaNuit', p, nightsLeft, extraContagion }]);
      return;
    }
  }
  const { steps } = buildNightCascade(get, set, p, { extraContagion });
  const remaining = nightsLeft - 1;
  // La halte de voyage (travelHalt) reprend la route à la clôture — SEULEMENT sur la DERNIÈRE nuit du
  // séjour (`remaining === 0`) : une nuit intermédiaire d'un repos multi-jours ne doit PAS re-déclencher
  // la reprise du voyage avant que les nuits suivantes n'aient eu lieu.
  const isLast = remaining <= 0;
  if (steps.length) {
    startCascade(get, set, {
      title: t(TITRE_DE_LA_NUIT[toitDeLaNuit(p, get().party)]), icon: 'temps/nuit', purpose: isLast && p.travelHalt ? 'travel' : 'night',
      travelHalt: isLast ? p.travelHalt : undefined, steps, restNights: { p, nightsLeft: remaining },
    });
  } else if (checkPartyWiped(get, set)) {
    return;
  } else if (remaining > 0) {
    // `buildNightCascade` a DÉJÀ journalisé le titre + tout ce qui suit l'entretien (#216) — rien à
    // influencer cette nuit-ci (PB pleins, pas de campement) → enchaîne directement la suivante.
    openRestNight(get, set, p, remaining, []);
  } else if (p.travelHalt) {
    continueTravelAfterNight(get, set);
  }
}

/** Reprend le repos MULTI-JOURS (#347) à la clôture d'une nuit (`dispatchCascadeDone`, `combatSlice.ts`,
 *  `done.restNights`) : ouvre la nuit SUIVANTE tant que `nightsLeft > 0`. No-op silencieux — le
 *  travelHalt de fin de séjour est repris par `openRestNight` lui-même sur la DERNIÈRE nuit. */
export function continueRestNights(get: Get, set: Set, ctx: { p: PendingRest; nightsLeft: number }): void {
  if (ctx.nightsLeft <= 0) return;
  openRestNight(get, set, ctx.p, ctx.nightsLeft, []);
}

/** Le repos se renonce hors halte de voyage (`MODAL_DEFS.repos.sortieFermee`). */
export function sortiesDuRepos(_get: Get, set: Set) {
  return { repos: () => set({ pendingRest: null }) } satisfies Partial<SortiesDeFenetre>;
}

export function validationsDuRepos(get: Get, set: Set) {
  return { repos: () => dormir(get, set) } satisfies Partial<ValidationsDeFenetre>;
}

export function creerActionsDuRepos(get: Get, set: Set) {
  return {
    ouvrirLeRepos: (hebergementId) => {
      const refus = refusDuRepos(get(), hebergementId);
      if (refus) return void refuserGeste(get, set, refus);
      ouvrirLeRepos(get, set, garanti(reposDuLieu(get, hebergementId), hebergementId, 'repos du lieu'));
    },
    offrirLeRepos: (opts) => ouvrirLeRepos(get, set, opts),
    // « Dormir » : sommeil de `days` journée(s) (défaut 1) — récup. (Exténué/Blessures) + cauchemars (LDB 16/18/21).
    reposerLeGroupe: (days = 1) => { sleepParty(get, set, days); },
  } satisfies FabriqueDuNoyau;
}

/** Les genres d'étape que ce module déclare (table `appliers`). */
export const GENRES_D_ETAPE = [
  ...EXPOSURE_BAND_KINDS, 'recuperation', 'cauchemar', 'abri-de-fortune', 'exposition-delestage', 'marche-forcee', 'faim',
  'soif', 'dessoulage', 'dessoulage-gueule-de-bois', 'convalescence-fracture', 'maladie-test-quotidien', 'maladie-gangrene',
  'maladie-persistance', 'contagion',
] as const;

/** Les tables que ce module déclare au jeu (`noyau/tablesDuJeu.ts`). */
export const TABLES = {
  clotures: {
    reprendreLaNuit: (get, set, { p, nightsLeft, extraContagion }) => openRestNight(get, set, p, nightsLeft, extraContagion, true),
  },
  appliers: {
    ...tableTotale(EXPOSURE_BAND_KINDS, () => appliquerLExposition),
    recuperation: bandeDeNuit((_get, _set, _band, row, hero) => {
      const before = hero.wounds.current;
      const sortie: Applique = { lignes: [], faits: [] };
      const { wokeUp } = applyRecoveryDay(hero, { sl: row.result!.sl, success: row.result!.success }, sortie);
      const j: string[] = [];
      const healed = hero.wounds.current - before;
      if (healed > 0) j.push(t('rf.recovered', { name: nomDe(hero), n: healed }));
      else j.push(t('rf.noRecovery', { name: nomDe(hero) }));
      if (wokeUp) j.push(t('heal.awake', { name: nomDe(hero) }));
      j.push(...sortie.lignes.map((e) => e.texte));
      return { applique: { lignes: j.map((x) => ligneDeTexte(x)), faits: [] } };
    }),
    cauchemar: bandeDeNuit((_get, _set, _band, row, hero) => {
      if (row.result!.success) return { applique: { lignes: [ligneDeTexte(t('rf.dreamless', { name: nomDe(hero) }))], faits: [] } };
      addCondition(hero, 'extenue'); // LDB 21 l.95 : Calme +40 raté → Exténué
      return { applique: { lignes: [ligneDeTexte(t('rf.nightmareFail', { name: nomDe(hero) }))], faits: [] } };
    }),
    'abri-de-fortune': bandeDeNuit((get, _set, _band, row, hero) => {
      const sheltered = row.result!.success; // Survie en extérieur réussie → abri qui tient (ch.09 l.559)
      const severity = (row.meta?.severity ?? 'difficile') as ExposureSeverity;
      const camperIds = String(row.meta?.campers ?? '').split(',').filter(Boolean);
      const count = exposureTestCount(severity, sheltered);
      return {
        applique: { lignes: [ligneDeTexte(sheltered ? t('rf.shelterOk', { name: nomDe(hero) }) : t('rf.shelterKo'))], faits: [] },
        insert: count > 0 ? buildExposureBand(get().party, camperIds, count) : [],
      };
    }),
    'exposition-delestage': (get, _set, step, hero, ctx) => {
      if (!hero || step.chosen == null) return;
      const band = ctx.steps.find((s) => s.id === step.meta?.nextWaveOf);
      const insert = band ? nextExposureWave(get, band, ctx.steps.map((s) => (s.id === step.id ? { ...s, chosen: step.chosen } : s))) : [];
      if (step.chosen === 'jeter') {
        const name = dropHeaviestPossession(hero);
        // LDB 18 l.332
        return { applique: { lignes: [ligneDeTexte(t('rf.dropped', { name: nomDe(hero), what: name ?? t('rf.fragHeaviest') }))], faits: [] }, insert };
      }
      return { applique: { lignes: applyExposureFailure(hero, Number(step.meta?.failNumber ?? 1), battleRng(), 'chaleur').log.map((x) => ligneDeTexte(x)), faits: [] }, insert };
    },
    'marche-forcee': bandeDeNuit((_get, _set, _band, row, hero) => {
      return { applique: { lignes: [ligneDeTexte(applyForcedMarch(hero, row.result!.success).line)], faits: [] } }; // LDB 51 l.195 : échec → +Exténué
    }),
    faim: bandeDeNuit((_get, _set, _band, row, hero) => {
      const r = applyFaimTest(hero, row.result!.success, bonus(effectiveChar(hero, 'endurance')), battleRng());
      const consequences: Applique = { lignes: [], faits: [] };
      loseWounds(hero, r.damage, consequences); // LDB 18 l.342
      return { applique: { lignes: [...r.log, ...consequences.lignes], faits: [] } };
    }),
    soif: bandeDeNuit((_get, _set, _band, row, hero) => {
      const r = applySoifTest(hero, row.result!.success, bonus(effectiveChar(hero, 'endurance')), battleRng());
      const consequences: Applique = { lignes: [], faits: [] };
      loseWounds(hero, r.damage, consequences); // LDB 18 l.340
      return { applique: { lignes: [...r.log, ...consequences.lignes], faits: [] } };
    }),
    dessoulage: bandeDeNuit((_get, _set, band, row, hero) => {
      // Dessoûlage (LDB 09 l.485) : le 1ᵉʳ Test INFLUENÇABLE fixe la dissipation (10−DR h). Le 2ᵉ Test — « Une
      // fois tous les effets dissipés, effectuez un nouveau Test » — devient sa PROPRE rangée influençable
      // (patron `insert`, re-bandée par la fabrique) : plus AUCUN jet silencieux (#253), et la gueule de bois
      // est due par TOUTE rangée du dessoûlage, pas seulement par les perdantes.
      const d = soberUpDissipate(hero, row.result!.sl);
      const alcool = { skill: { id: 'resistance-a-l-alcool' }, characteristic: 'endurance' } as const;
      const hangover = monoStep({
        id: `dessoulage-hangover-${hero.id}`, kind: 'dessoulage-gueule-de-bois', actor: hero, icon: 'temps/nuit',
        rollLabel: testSkillLabel(alcool) ?? SKILL_RESISTANCE(), label: t('step.gueuleDeBois'), difficulty: 'intermediaire',
        stake: nightStakeRef('dessoulage-gueule-de-bois'),
        ligne: { test: alcool },
        ...(band.meta?.day !== undefined ? { meta: { day: band.meta.day } } : {}),
      });
      return { applique: { lignes: d.log.map((x) => ligneDeTexte(x)), faits: [] }, insert: hangover ? [hangover] : [] };
    }),
    'dessoulage-gueule-de-bois': bandeDeNuit((get, _set, _band, row, hero) => {
      // 2ᵉ Test du dessoûlage (l.485), désormais influençable : le DR fixe la durée de la gueule de bois.
      return { applique: { lignes: soberUpHangover(hero, get().gameTime, row.result!.sl).log.map((x) => ligneDeTexte(x)), faits: [] } };
    }),
    'convalescence-fracture': bandeDeNuit((_get, _set, _band, row, hero) => {
      return { applique: { lignes: applyFractureEnd(hero, row.result!.success, String(row.meta?.severity ?? 'mineur'), String(row.meta?.location ?? ''), String(row.meta?.traumaLabel ?? t('rf.fractureFallback'))).map((x) => ligneDeTexte(x)), faits: [] } };
    }),
    'maladie-test-quotidien': bandeDeNuit((get, _set, _band, row, hero) => {
      // Échec d'un Test de cycle quotidien → applique ses ops d'échec (`meta.opsEchec`), via applyOps. Couvre
      // les DEUX porteurs de ce canal : le Test d'un SYMPTÔME (`onTick` — Blessé → contractDisease
      // 'blessure-purulente', Toxine, Vers) ET le Test porté par la MALADIE (`DiseaseDef.dailyTest` —
      // pneumonie, EDOC 08 l.104-108). Donnée-driven : aucun id n'est nommé ici.
      if (row.result!.success) return {};
      const opsEchec = row.meta?.opsEchec ?? [];
      // `sl` (DR négatif de l'échec) → alimente `rollTable{addNegativeSL}` (Vers de carie : « ajoutez le
      // nombre de DR négatifs », MSRC 16 l.90) et les échelles `perSL` de ces ops.
      // La MALADIE est l'entité SOURCE de ce qu'elle inflige : tout effet actif posé par ces ops (Trait
      // octroyé, État durable) porte son ancrage de règle, donc sa fiche à l'écran.
      const source = { kind: 'maladie' as const, id: String(row.meta?.diseaseName ?? '') };
      return { applique: { lignes: applyOps(hero, opsEchec, { idNeuf: get().forgerUnId, rng: battleRng(), sl: row.result!.sl, source }).lignes, faits: [] } };
    }),
    'maladie-gangrene': bandeDeNuit((_get, _set, _band, row, hero) => {
      return { applique: { lignes: applyDiseaseGangrene(hero, String(row.meta?.diseaseName ?? ''), row.result!.success, Number(row.meta?.be ?? 0)).map((x) => ligneDeTexte(x)), faits: [] } };
    }),
    'maladie-persistance': bandeDeNuit((_get, _set, _band, row, hero) => {
      // Fin de Durée : résolution ET réconciliation des États portés par un passif (LDB 20 l.188) en UN geste —
      // `applyDiseaseEnd` (engine/rest) est le foyer unique, ici comme dans toute autre voie.
      return { applique: { lignes: applyDiseaseEnd(hero, String(row.meta?.diseaseName ?? ''), row.result!.success, row.result!.sl, battleRng()).map((x) => ligneDeTexte(x)), faits: [] } };
    }),
    contagion: appliquerContagion,
  } satisfies PartDeTable<'appliers', typeof GENRES_D_ETAPE>,
} satisfies FragmentDeTables;
