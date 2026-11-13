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
 *  - Prix (LDB 66 l.5-28) : chambre commune 10 sc/pers · privée 10 pa pour 2 (la grande pour 4
 *    coûte le double → regrouper par paires est équivalent, coût auto) · repas 1 pa ; PIÈTRE = ½
 *    prix, et la nourriture piètre expose à la Courante galopante (10 %, LDB 66 l.5) ;
 *  - Dehors : Exposition (LDB 18 l.327-334 — engine/exposure) selon `activeExposureSeverity` (combatFlow) ;
 *  - Faim (LDB 18 l.337-343) : un héros sans pitance ne récupère pas (engine/provisions).
 */
import type { IconId } from '../data/icons';
import type { Combatant } from '../engine/types';
import type { RNG } from '../engine/dice';
import type { RollBreakdown } from '../engine/combat';
import type { RecapTone } from './recapLine';
import { battleRng } from './battleRng';
import { reposDeScene } from './monde/scene';
import { partyAssisted, peutTenter, testValue } from '../engine/skills';
import { HEAL_SKILL } from '../engine/healing';
import { soberUpDissipate, soberUpHangover } from '../engine/drunkenness';
import { addCondition, loseWounds } from '../engine/conditions';
import { restRecovery, applyRecoveryDay, needsRecoveryRoll, applyDiseaseEnd, type RestRoll } from '../engine/rest';
import { rollContraction, diseaseDefs, contagiousDiseases, contractionDue, applyContraction, applyDiseaseGangrene, diseaseTestModLines } from '../engine/disease';
import { applyOps } from '../engine/ops';
import { rule } from '../engine/policy';
import { type Difficulty } from '../engine/types';
import { applyFractureEnd } from '../engine/trauma';
import type { DeferredUpkeepTest } from './upkeep';
import { exposureTestCount, expireOnRespite, exposureShelterFromTent, applyExposureFailure, exposureCoatMods, heaviestPossession, dropHeaviestPossession, type ExposureSeverity, type ExposureKind } from '../engine/exposure';
import { effectiveChar, bonus } from '../engine/characteristics';
import { applyForcedMarch } from '../engine/travel';
import { startCascade, runCascadeImmediate } from './cascade';
import { nightBands, bandeDeNuit, nightRowId, genuineExposureFail, nextExposureWave, exposureWaveBand } from './nightBands';
import { EXPOSURE_BAND_KINDS } from './bandesDExposition';
import { freeCons, monoStep, choiceStep, pousseSi } from './rollSeam';
import { type BuiltCascadeStep } from './stepBrand';
import type { CascadeStepMeta } from './pendings';
import { isRation, feedFromMeal, applyFaimTest, applySoifTest } from '../engine/provisions';
import { toBrass, fromBrass, priceToMoney, type Money } from '../engine/money';
import { payFromGroup, totalDesBourses } from './bourseFlow';
import { findTrappingById, nightStakeRef, refLabel, testSkillLabel, libelleOuAbsence, type StakeRef } from '../data';
import { diseaseLabel } from '../data';
import { aubeApresNuits, MINUTES_PER_DAY, dayIndex } from '../engine/clock';
import { runDailyUpkeep } from './upkeep';
import { continueTravelAfterNight } from './travelFlow';
import { activeExposureSeverity } from './combatFlow';
import { bus, EVT } from './bus';
import type { Jeu } from './etat';

export type RestKind = 'auberge' | 'maison' | 'camp';
export type RestLodging = 'commune' | 'privee' | 'maison' | 'dehors' | 'bord';
export type RestFood = 'repas' | 'ration' | 'maison' | 'rien';

/** Lieux de repos OFFERTS par le contexte (scène, effet, halte de voyage) — combinables :
 *  un village peut offrir l'auberge ET le camp ; chaque héros choisit ENSUITE le sien. */
export interface RestPlaces {
  auberge?: boolean;
  maison?: boolean;
  camp?: boolean;
  /** À bord du navire de campagne (hamacs/quartiers, MDG 03 l.71 · 09 l.87) — couchage ABRITÉ (pas
   *  d'Exposition de plein air) ; en mer c'est le seul couchage (l'offre `camp`/`dehors` s'efface). */
  bord?: boolean;
}

/** L'offre par DÉFAUT d'un contexte nommé (`kind`, faute de `lodging` explicite fourni par
 *  l'effet `rest` / halte de voyage) — dormir dehors reste toujours possible (choix personnel :
 *  on peut manger à l'auberge et dormir à la belle étoile). */
export function placesOfKind(kind: RestKind): RestPlaces {
  return kind === 'auberge' ? { auberge: true, camp: true } : kind === 'maison' ? { maison: true, camp: true } : { camp: true };
}

/** Le lieu de la scène COURANTE, pour une nuit qui s'y passe (bouton de Repos, hôtellerie de ville,
 *  effet `rest`, attente de l'aube au départ). */
export function sceneLieu(get: Get): PlayerText {
  return dataLabel(garanti(get().scene, undefined, 'scène de la nuit').label);
}

/** Le lieu d'une halte de nuit SUR LA ROUTE du voyage (terre et fleuve), nommée par ses deux extrémités —
 *  la forme de l'en-tête de l'écran de voyage (`VoyageScreen`). */
export function routeLieu(worldMap: WorldMap, plan: { fromPlaceId: string; toPlaceId: string }): PlayerText {
  const from = libelleOuAbsence(placeById(worldMap, plan.fromPlaceId), 'lieu', plan.fromPlaceId);
  const to = libelleOuAbsence(placeById(worldMap, plan.toPlaceId), 'lieu', plan.toPlaceId);
  return t('rf.lieuRoute', { from, to });
}

/** Entrée du PROCÈS-VERBAL (bilan multi-jets, réutilisable : jour de mer #232, chronique de voyage…).
 *  Une ligne = un jet de ROUTINE déjà résolu (témoin), rendu en LECTURE SEULE par `MultiRollList` — la
 *  nuit de repos (#347) n'en tisse plus : chaque jet de nuit est une ÉTAPE de cascade influençable
 *  (`noyau/cascade.ts`), pas une ligne de PV recalculée après coup. */
export interface NightEntry {
  id?: string;
  actorId?: string;
  icon?: IconId;
  label: string;
  /** Jet affiché en RollLine (base + mods = cible · d100 · DR). */
  d?: RollBreakdown;
  /** Issue / note en clair (« +7 PB », « jour 4/6 »). */
  text?: string;
  /** RUBRIQUE de la ligne : les lignes consécutives d'une MÊME rubrique (les contributeurs d'un même
   *  Test d'équipage) se rendent sous UNE bande titrée (`Band`) au lieu de répéter l'en-tête. */
  group?: string;
  /** Vocabulaire PARTAGÉ (#349) — `RecapTone`, `noyau/recapLine.ts` (même trio que `RecapLine.tone`). */
  tone?: RecapTone;
  /** Type de jet HÉROS de `sleepParty` (chemin EAGER — cheat `reposerLeGroupe`, clôture d'interlude) —
   *  décoratif hors de ces deux chemins. */
  reKind?: 'recuperation' | 'cauchemar';
  /** Relance de Chance déjà consommée sur CETTE ligne (LDB 12 l.40 : une relance max par Test). */
  rerolled?: boolean;
  /** ENJEU du jet consigné (#1117 L1b) — la RÉFÉRENCE de donnée, jamais un texte : l'entrée de PV
   *  porte ce que l'ÉTAPE mettait en jeu (`CascadeStep.stake`, recopié à l'émission). Rendu UNE fois
   *  par rubrique (`group`) par `MultiRollList` — l'enjeu est celui de l'étape, pas de chaque ligne. */
  stake?: StakeRef;
}

export interface PendingRest extends PendingBase {
  places: RestPlaces;
  /** OÙ le groupe passe la nuit, nommé par l'APPELANT d'`ouvrirLeRepos` (relais ou bivouac de la route,
   *  bord du bateau, scène courante) — seul lieu du titre de la modale. */
  lieu: PlayerText;
  /** Piètre : ½ prix, nourriture à risque (Courante galopante 10 %) — LDB 66. */
  quality: 'normale' | 'pietre';
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
import { t } from '../i18n';
import { lieuDuGroupe, placeById, placeServices, type WorldMap } from './worldMap';
import { sceneDuRegistre } from './monde/registreDesScenes';
import { garanti } from '../lib/garanti';
import { stepPrecision } from './rollSeam';
import type { PlayerText } from '../i18n/playerText';
import type { FabriqueDuNoyau } from './machinerieDuNoyau';
import type { SortiesDeFenetre } from './sortieDeFenetre';
import type { ValidationsDeFenetre } from './validationDeFenetre';
import type { CorpsDesChoix } from './choixDesFenetres';
import { tableTotale } from '../lib/tableTotale';
import { type FragmentDeTables, type PartDeTable } from './tablesPosees';
import { nomDe } from '../engine/nom';

/** Libellé de la Compétence lancée, lu à la DONNÉE par id STABLE — jamais un littéral au call-site (#1341). */
const SKILL_RESISTANCE = (): string => refLabel('skills', { id: 'resistance' });
const SKILL_CALME = (): string => refLabel('skills', { id: 'calme' });

/**
 * LE moteur de nuit (sans modale) : avance l'horloge à l'aube (× days), entretien #T3, récupération
 * + cauchemars, contagion. Renvoie le bilan structuré ; écrit aussi le journal.
 * NB : on n'avance PAS l'horloge minute par minute (avancerLeTemps rejouerait l'entretien de Round —
 * hémorragie/poison/feu tueraient le dormeur ; LDB 16 l.105 : le repos suppose des États stabilisés,
 * restRecovery refuse d'ailleurs un héros Hémorragique/En flammes/Empoisonné).
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
  const journal: string[] = [];

  // Soins prolongés (LDB 09) : présence d'un soignant valide (Guérison) → −1 jour/jour par maladie.
  const caredFor = get().party.some((h) => peutTenter(h, { skill: { id: HEAL_SKILL } }));
  // La nuit passe — chaque journée de repos se termine à l'AUBE, UNE NUIT À LA FOIS : n nuits dormies
  // sont n RÉVEILS (`lastNightDay` posé à chaque aube atteinte, avant l'entretien de cette journée-là),
  // donc n émissions d'`onWake`. Un séjour de 7 nuits qui n'aurait sauté qu'à l'aube finale ne
  // réveillerait le groupe qu'une fois (Désespoir, VDM 09 l.280).
  // Le bilan de nuit LISTE l'entretien quotidien (rations/faim, maladies, convalescence) — le
  // journal seul ne suffit pas. Portrait attribué par préfixe « Nom… » quand la ligne le porte.
  const from = get().gameTime;
  const firstNight = aubeApresNuits(from, 1) - from;
  for (let night = 0; night < n; night++) {
    get().avancerLHorloge(night === 0 ? firstNight : MINUTES_PER_DAY);
    set({ lastNightDay: dayIndex(get().gameTime) }); // nuit JOUÉE (#340) — désamorce la privation de sommeil
    // Les Tests d'entretien de la journée (faim, soif, maladie, convalescence, dessoûlage) sont MONTÉS
    // par la porte, comme dans la nuit interactive : ce chemin les résout d'office (`runCascadeImmediate`
    // — branche I du seam), il ne les roule pas lui-même et ne saute aucune fenêtre qui existerait.
    const deferred: DeferredUpkeepTest[] = [];
    for (const text of runDailyUpkeep(get, set, { caredFor, fedDaily: opts.fedDaily, onDeferTest: (d) => deferred.push(d) })) {
      entries.push({ actorId: get().party.find((h) => text.startsWith(h.label))?.id, icon: 'temps/calendrier', label: 'Entretien quotidien', text, tone: 'neutre' });
    }
    const steps = nightBands(deferredUpkeepSteps(get().party, deferred));
    if (steps.length && !runCascadeImmediate(get, set, steps)) return entries;
  }

  // Récupération + cauchemars, héros par héros (jets structurés pour le bilan).
  const party = get().party;
  for (const h of party) {
    if (h.dead) continue;
    const rolls: RestRoll[] = [];
    const log = restRecovery(h, rng, n, rolls);
    rolls.forEach((r, ri) => {
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
    for (const line of log) entries.push({ actorId: h.id, icon: 'repos/lit', label: t('rf.nuit'), text: line.replace(`${h.label} `, ''), tone: 'neutre' });
    journal.push(...log);
  }

  // Contagion de promiscuité (chambrée/campement — Toux et éternuements, LDB 20 l.206) : 1 Test de Contraction par nuit de repos.
  // Règle optionnelle « Utilisation des Maladies » : désactivée si maladie-mode = off.
  for (const c of rule('maladie-mode') === 'off' ? [] : runContagion(party, n, rng)) {
    entries.push({ actorId: c.actorId, icon: 'medical/infection', label: t('rf.contagionLabel', { disease: diseaseLabel(c.dz) }), text: c.log.join(' '), tone: 'echec' });
    journal.push(...c.log);
  }

  const title = n > 1 ? t('rf.titleDays', { n }) : t('rf.titleNight');
  set({ party: [...get().party] });
  get().ecrireAuJournal([title, ...journal]);
  bus.emit(EVT.SCENE_DIRTY);
  return entries;
}

/** Contagion de promiscuité (Toux et éternuements, LDB 20 l.206 ; 1 Test/nuit) — chemin EAGER (sleepParty,
 *  multi-jours), roule le Test. La cascade utilise `collectContagion` (jet différé en étape). */
function runContagion(party: Combatant[], n: number, rng: RNG): { actorId: string; dz: string; log: string[] }[] {
  const out: { actorId: string; dz: string; log: string[] }[] = [];
  for (const sick of party) {
    for (const dz of contagiousDiseases(sick)) {
      for (const other of party) {
        if (other === sick || other.dead) continue;
        const def = diseaseDefs()[dz.id];
        for (let d = 0; d < n; d++) {
          const log = rollContraction(other, dz.id, testValue(other, { skill: { id: 'resistance' } }), def?.contractDifficulty ?? 'accessible', rng);
          if (log.length) out.push({ actorId: other.id, dz: dz.id, log });
        }
      }
    }
  }
  return out;
}

/** Un Test de Contraction d'entretien différé (contagion de promiscuité OU tambouille piètre). */
interface ContagionSpec { heroId: string; diseaseName: string; difficulty: Difficulty; }

/** RECENSE les Tests de Contraction de promiscuité DÛS (sans les rouler) — pour la cascade de nuit :
 *  chaque héros sain résiste à la maladie contagieuse d'un compagnon (1 jet par paire, dédoublonné). */
function collectContagion(party: Combatant[]): ContagionSpec[] {
  const out: ContagionSpec[] = [];
  const seen = new Set<string>();
  for (const sick of party) {
    for (const dz of contagiousDiseases(sick)) {
      for (const other of party) {
        if (other === sick || other.dead) continue;
        const key = `${other.id}:${dz.id}`;
        if (seen.has(key) || !contractionDue(other, dz.id)) continue;
        seen.add(key);
        out.push({ heroId: other.id, diseaseName: dz.id, difficulty: diseaseDefs()[dz.id]?.contractDifficulty ?? 'accessible' });
      }
    }
  }
  return out;
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
    return { consequences: freeCons([held
      ? t('rf.sealskinHeld', { name: nomDe(hero) })
      : t('rf.exposureEndured', { name: nomDe(hero), what: kind === 'froid' ? t('rf.cold') : t('rf.heat') })]) };
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
      consequences: freeCons([t('rf.heatFailDrop', { name: nomDe(hero), item: heavy.label })]),
      insert: [drop],
    };
  }
  return { consequences: freeCons(applyExposureFailure(hero, priorFails + 1, battleRng(), kind).log) };
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
 * l'entretien quotidien + la contagion + la récupération SANS jet (PB plein/affamé) en EAGER (journal),
 * et DIFFÈRE en ÉTAPES influençables : abri de fortune (→ insère l'Exposition), Exposition (escalade),
 * récupération (Résistance +20), cauchemars (Calme +40). Réutilise les primitives pures (zéro
 * duplication vs sleepParty). Renvoie les étapes + le journal eager + l'horloge avant/après.
 */
export function buildNightCascade(get: Get, set: Set, p: PendingRest, opts: { fedDaily?: boolean; extraContagion?: ContagionSpec[] } = {}): { steps: BuiltCascadeStep[]; log: string[]; slept: { from: number; to: number } } {
  let party = get().party;
  const log: string[] = [];
  const from = get().gameTime;
  // La nuit passe — une journée de repos se termine à l'AUBE.
  get().avancerLHorloge(aubeApresNuits(from, 1) - from);
  set({ lastNightDay: dayIndex(get().gameTime) }); // nuit JOUÉE (#340) — désamorce la privation de sommeil
  // Entretien quotidien (#T3) — la partie SANS jet est eager (rations consommées, jours décomptés) ;
  // TOUT Test de Résistance (Faim LDB 18 l.342, maladie l.110/135/162, convalescence LDB 18 l.202) est DIFFÉRÉ en
  // étape influençable (sinon il serait pré-résolu dans le journal AVANT que le joueur n'agisse).
  const caredFor = party.some((h) => peutTenter(h, { skill: { id: HEAL_SKILL } }));
  const deferred: DeferredUpkeepTest[] = [];
  // `runDailyUpkeep` journalise DÉJÀ ses propres lignes (upkeep.ts, source unique anti-double-comptage,
  // #216) : on les garde dans `log` (retourné pour le bilan/la modale de cascade) SANS les re-journaliser
  // plus bas — `upkeepCount` marque la frontière entre ce qui est déjà écrit et le reste de cette fonction.
  const upkeep = runDailyUpkeep(get, set, { caredFor, fedDaily: opts.fedDaily, onDeferTest: (t) => deferred.push(t) });
  log.push(...upkeep);
  const upkeepCount = upkeep.length;
  // `party` RAFRAÎCHI : `runDailyUpkeep` a pu débiter les gages (`tickCampaignVesselWeek` → clone
  // `withBourseMoney` du/des héros ponctionnés) — toute la suite (mutations eager de récupération/
  // cauchemars, `expireOnRespite`) doit opérer sur ces réfs à jour, pas sur celles PÉRIMÉES
  // d'avant l'entretien (sinon perdues au `set({party:[...get().party]})` de clôture, l.551).
  party = get().party;

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
  // CONTAGION (promiscuité — Toux et éternuements, LDB 20 l.206 + tambouille piètre) → un jet de Résistance influençable par héros exposé.
  for (const c of [...collectContagion(party), ...(opts.extraContagion ?? [])]) {
    const h = party.find((x) => x.id === c.heroId);
    if (!h || h.dead) continue;
    const st = monoStep({ id: `contagion-${c.heroId}-${steps.length}`, kind: 'contagion', actor: h, label: stepPrecision(t('step.contagion'), diseaseLabel(c.diseaseName)), icon: 'medical/infection',
      rollLabel: SKILL_RESISTANCE(), difficulty: c.difficulty,
      stake: nightStakeRef('contagion'),
      // Contraction = « Test de Résistance » (`LDB 20 l.25`) : valeur de la porte, et les bonus d'effet
      // SCOPÉS à cette maladie (Fleur de lune, Tonique digestif) en lignes NOMMÉES sur la cible.
      ligne: { test: { skill: { id: 'resistance' } }, surLaCible: diseaseTestModLines(h, c.diseaseName) },
      meta: { diseaseName: c.diseaseName },
      menace: 'maladie' }); // Test de Contraction = « résister à la Maladie » (Résistance (Menace), LDB 10)
    pousseSi(steps, st);
  }
  // Campement : Exposition (intempéries) — abri de fortune (STEP) → insère les jets d'Exposition.
  const campers = party.filter((h) => !h.dead && p.perHero[h.id]?.lodging === 'dehors');
  const severity = activeExposureSeverity(get);
  if (campers.length && severity !== 'clement') {
    const camperIds = campers.map((h) => h.id);
    if (exposureShelterFromTent(party)) {
      log.push(t('rf.tentUp'));
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

  // Récupération + cauchemars : un jet = une étape ; sans jet (PB plein/affamé/instable) → eager.
  for (const h of party) {
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
      const { wokeUp } = applyRecoveryDay(h, null);
      if (h.wounds.current - before > 0) log.push(t('rf.recovered', { name: nomDe(h), n: h.wounds.current - before }));
      if (wokeUp) log.push(t('heal.awake', { name: nomDe(h) }));
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
  get().ecrireAuJournal([t('rf.titleNight'), ...log.slice(upkeepCount)]);
  bus.emit(EVT.SCENE_DIRTY);
  return { steps: banded, log, slept: { from, to: get().gameTime } };
}

/** Prix RAW de l'hébergement et du repas d'auberge (LDB 66 l.12-16) — SOURCE UNIQUE le catalogue
 *  `trappings.json` (ids de service), plus AUCUNE constante dupliquée : le hub de ville (#343) et
 *  `restCost` lisent le MÊME tarif. Piètre = ½ (appliqué par `restCost`). */
function serviceBrass(id: string): number {
  const t = findTrappingById(id);
  if (!t) throw new Error(`restCost : tarif de service introuvable au catalogue "${id}" (trappings.json).`);
  return toBrass(priceToMoney(t.price));
}
const PRICE_BRASS = {
  commune: serviceBrass('chambre-commune-nuit'),
  privee: serviceBrass('chambre-privee-nuit'),
  repas: serviceBrass('repas-auberge'),
} as const;

/** Tarif d'un service d'auberge en monnaie (LDB 66 l.12-16, source unique catalogue) — affiché par le
 *  panneau d'auberge du hub de ville (#343), aligné au débit de `restCost`. */
export function restServicePrice(kind: keyof typeof PRICE_BRASS): Money {
  return fromBrass(PRICE_BRASS[kind]);
}

/** Couchages proposés par l'offre du lieu — PAR HÉROS ensuite (choix personnels). */
export function lodgingOptions(places: RestPlaces): RestLodging[] {
  const out: RestLodging[] = [];
  if (places.auberge) out.push('privee', 'commune');
  if (places.maison) out.push('maison');
  if (places.bord) out.push('bord'); // à bord = hamacs (MDG 03 l.71) ; par défaut si offert
  if (places.camp || places.auberge || places.maison) out.push('dehors'); // la belle étoile reste un choix
  return out;
}

/** Pitances qu'offre le lieu (repas d'auberge, table de la maison), communes à toute la troupe. */
const pitancesDuLieu = (places: RestPlaces): RestFood[] => [...(places.auberge ? ['repas' as const] : []), ...(places.maison ? ['maison' as const] : [])];

/** Pitances proposées à un héros (orthogonales au couchage : manger à l'auberge et dormir dehors est permis).
 *  « ration » seulement si le héros en a une. */
export function foodOptions(places: RestPlaces, hero: Combatant): RestFood[] {
  return [...pitancesDuLieu(places), ...((hero.items ?? []).some(isRation) ? ['ration' as const] : []), 'rien'];
}

/** Pitances du choix « pour toute la troupe » : celles du lieu, sans la ration, qui dépend du sac de chacun. */
export function nourrituresDeTroupe(places: RestPlaces): RestFood[] {
  return [...pitancesDuLieu(places), 'rien'];
}

/** Part de chaque héros vivant réglé dans la note du repos, par nuit × days : une chambre privée loge 2
 *  invités (LDB 66 l.28), sa part est sa moitié (valeur d'ingénierie, la source ne partage pas la
 *  chambre) ; chambre commune et repas par convive. La somme des parts EST `restCost`. */
export function partsDuRepos(p: PendingRest, party: Combatant[]): Record<string, Money> {
  const half = p.quality === 'pietre' ? 0.5 : 1;
  const heroes = party.filter((h) => !h.dead && p.perHero[h.id]);
  const enPrivee = heroes.filter((h) => p.perHero[h.id].lodging === 'privee');
  const parts: Record<string, Money> = {};
  for (const h of heroes) {
    const { lodging, food } = p.perHero[h.id];
    const i = enPrivee.indexOf(h);
    const seul = i === enPrivee.length - 1 && i % 2 === 0;
    const chambre = lodging === 'privee' ? (seul ? PRICE_BRASS.privee : i % 2 === 0 ? Math.ceil(PRICE_BRASS.privee / 2) : Math.floor(PRICE_BRASS.privee / 2))
      : lodging === 'commune' ? PRICE_BRASS.commune : 0;
    const brass = chambre + (food === 'repas' ? PRICE_BRASS.repas : 0);
    parts[h.id] = fromBrass(Math.ceil(brass * half) * Math.max(1, p.days));
  }
  return parts;
}

/** Coût total du repos : la somme des `partsDuRepos`. */
export function restCost(p: PendingRest, party: Combatant[]): Money {
  return fromBrass(Object.values(partsDuRepos(p, party)).reduce((n, m) => n + toBrass(m), 0));
}

/** Offre de repos À LA POSITION DU GROUPE : zone de repos (rect d'auteur) prioritaire, sinon
 *  réglage de scène, sinon camp (défaut). PARAMÉTRABLE SUR LA ZONE dans l'éditeur. */
export function restPlacesHere(st: Jeu): { places: RestPlaces; quality: 'normale' | 'pietre' } | null {
  const sc = st.scene;
  if (!sc) return null;
  const pos = st.partyPos;
  const zone = pos ? [...(sc.restZones ?? [])].reverse().find((z) =>
    pos.x >= z.rect.x && pos.x < z.rect.x + z.rect.w && pos.y >= z.rect.y && pos.y < z.rect.y + z.rect.h
    && (z.rect.z ?? 0) === (pos.z ?? 0)) : undefined;
  const places = zone?.places ?? reposDeScene(sc);
  if (!places.auberge && !places.maison && !places.camp) return null; // repos interdit ici
  return { places, quality: zone?.quality ?? sc.rest?.quality ?? 'normale' };
}

/** Options d'`ouvrirLeRepos` : l'APPELANT dit où le groupe dort (`places` = l'offre, `lieu` = son nom). */
export interface OpenRestOpts {
  lieu: PlayerText;
  places?: RestPlaces;
  quality?: 'normale' | 'pietre';
  days?: number;
  travelHalt?: boolean;
  /** Le jour de voyage CLOS par cette halte — rejoint `travelPlan.log`, sa seule demeure. */
  travelDay?: import('./travelFlow').TravelRecapDay;
  travelMarch?: string[];
}

/** Le repos qu'offre l'endroit où se tient le groupe : à un lieu de la carte, l'auberge de ses services
 *  (`placeServices`), à la qualité de la scène du lieu ; ailleurs, la scène à la position du groupe
 *  (`restPlacesHere`) ; `null` : aucun. */
export function reposDuLieu(get: Get): OpenRestOpts | null {
  const s = get();
  const ici = lieuDuGroupe(s);
  if (ici) {
    const scene = sceneDuRegistre(ici.scene.id);
    const auberge = placeServices(ici, scene).find((svc) => svc.category === 'auberge' && svc.rest);
    const quality = scene?.rest?.quality;
    return auberge?.rest ? { places: auberge.rest, lieu: libelleOuAbsence(ici, 'lieu', ici.id), ...(quality ? { quality } : {}) } : null;
  }
  const scene = restPlacesHere(s);
  return scene && { places: scene.places, lieu: sceneLieu(get), quality: scene.quality };
}

/** Ouvre la modale de Repos avec une OFFRE de lieux (effet, halte de voyage, bouton de Repos). */
export function ouvrirLeRepos(get: Get, set: Set, opts: OpenRestOpts): void {
  const st = get();
  if (st.battle || st.pendingRest) return;
  const places = opts.places ?? { maison: true, camp: true };
  const perHero: PendingRest['perHero'] = {};
  for (const h of st.party) {
    if (h.dead) continue;
    perHero[h.id] = { lodging: lodgingOptions(places)[0], food: foodOptions(places, h)[0] };
  }
  // CHRONIQUE de voyage (#333) : une halte de voyage porte le jour FINALISÉ — on l'accumule sur le plan
  // (même `set` que la modale) pour que l'écran-hub (`VoyageScreen`) en tienne le journal (une carte par
  // jour passé), source unique (STRUCTURE `TravelRecapDay`, jamais une chaîne recomposée). No-op hors halte.
  const logPatch = opts.travelDay && st.travelPlan
    ? { travelPlan: { ...st.travelPlan, log: [...(st.travelPlan.log ?? []), opts.travelDay] } }
    : {};
  set({ ...logPatch, pendingRest: { places, lieu: opts.lieu, quality: opts.quality ?? 'normale', days: Math.max(1, opts.days ?? 1), perHero, phase: 'setup', travelHalt: opts.travelHalt, travelMarch: opts.travelMarch } });
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

/** Dormir : paie (RAW ch.66), nourrit, puis ouvre la CHAÎNE de cascades de nuit (#347, `openRestNight`). Corps de la
 *  validation du repos (`fenetreValider('repos')`), que l'hôte joue au quorum, la note couverte. */
function dormir(get: Get, set: Set): void {
  const p = get().pendingRest!;
  const rng = battleRng();

  // 1. La note d'auberge (LDB 66) — dépense de BANDE (aucun bénéficiaire unique) tirée gloutonnement des
  //    bourses, couverte par la validation (`FERMETURES_DE_LA_VALIDATION.rest`).
  const cost = restCost(p, get().party);
  if (toBrass(cost) > 0) payFromGroup(get, set, cost, { purpose: 'auberge' });

  // 2. Pitance AVANT la nuit (un héros nourri n'est plus affamé). La tambouille PIÈTRE (ch.66 l.51,
  //    10 %) expose à un Test de Résistance vs Courante Galopante — DIFFÉRÉ en étape de cascade.
  //    `party` est relu APRÈS le débit : `payFromGroup` remplace les objets héros des bourses ponctionnées,
  //    et `feedFromMeal` mute EN PLACE — nourrir un objet héros périmé laisserait le dormeur affamé.
  const party = get().party;
  const extraContagion: ContagionSpec[] = [];
  for (const h of party) {
    const cfg = p.perHero[h.id];
    if (!cfg || h.dead) continue;
    if (cfg.food === 'repas' || cfg.food === 'maison') {
      feedFromMeal(h);
      if (cfg.food === 'repas' && p.quality === 'pietre' && rng.int(1, 100) <= 10 && contractionDue(h, 'courante-galopante')) {
        extraContagion.push({ heroId: h.id, diseaseName: 'courante-galopante', difficulty: diseaseDefs()['courante-galopante']?.contractDifficulty ?? 'accessible' });
      }
    }
    // 'ration' : consommée par l'entretien quotidien (#T3) ; 'rien' : la Faim suivra son cours.
  }

  // 3. Nuit(s) → CHAÎNE de cascades séquentielles influençables (#347, patron #253) : CHAQUE jet subi
  //    (faim, maladie, convalescence, contagion, abri, Exposition, récupération, cauchemars) est une
  //    ÉTAPE qu'on lance, influence (Chance/Résilience) puis VERROUILLE avant la suivante — AUCUN jet
  //    pré-résolu. Un repos de PLUSIEURS jours n'est PAS pré-construit d'un coup (l'entretien de la
  //    nuit N+1 lit l'état MUTÉ par la nuit N — compteurs de faim/soif, jours de maladie…) : chaque
  //    nuit est reconstruite APRÈS que la précédente ait été validée, chaînée par `dispatchCascadeDone`
  //    (`combatSlice.ts`, `done.restNights`) — une nuit UNIQUE est le cas `days=1` de la même primitive.
  //    Le report de voyage du jour a déjà été lu en phase RÉGLAGES (RestModal).
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
  return lodgings.some((l) => l === 'privee' || l === 'commune') ? 'auberge'
    : lodgings.some((l) => l === 'maison') ? 'maison'
    : lodgings.some((l) => l === 'bord') ? 'bord'
    : 'campement';
}

/** Titre de la nuit, d'après son toit (`toitDeLaNuit`). */
export function nightTitle(p: PendingRest, party: Combatant[]): string {
  return t(({ auberge: 'rf.nightInn', maison: 'rf.nightHome', bord: 'rf.nightAboard', campement: 'rf.nightCamp' } as const)[toitDeLaNuit(p, party)]);
}

/** Ouvre (ou enchaîne) UNE nuit de repos (#347) : reconstruit `buildNightCascade` pour CETTE nuit et
 *  l'ouvre en cascade influençable, en portant `nightsLeft` (nuits ENCORE à enchaîner après celle-ci)
 *  sur la cascade — sa clôture (`continueRestNights`, appelée par `dispatchCascadeDone`) reprend alors
 *  la nuit suivante. `extraContagion` (tambouille piètre) ne s'applique qu'à la nuit d'ARRIVÉE (repas
 *  du soir posé une fois en amont par `dormir`).
 */
export function openRestNight(get: Get, set: Set, p: PendingRest, nightsLeft: number, extraContagion: ContagionSpec[] = []): void {
  const { steps, log } = buildNightCascade(get, set, p, { extraContagion });
  const remaining = nightsLeft - 1;
  // La halte de voyage (travelHalt) reprend la route à la clôture — SEULEMENT sur la DERNIÈRE nuit du
  // séjour (`remaining === 0`) : une nuit intermédiaire d'un repos multi-jours ne doit PAS re-déclencher
  // la reprise du voyage avant que les nuits suivantes n'aient eu lieu.
  const isLast = remaining <= 0;
  if (steps.length) {
    startCascade(get, set, {
      title: nightTitle(p, get().party), icon: 'temps/nuit', purpose: isLast && p.travelHalt ? 'travel' : 'night',
      travelHalt: isLast ? p.travelHalt : undefined, steps, log, restNights: { p, nightsLeft: remaining },
    });
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
    ouvrirLeRepos: () => {
      const repos = reposDuLieu(get);
      if (repos) ouvrirLeRepos(get, set, repos);
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
  appliers: {
    ...tableTotale(EXPOSURE_BAND_KINDS, () => appliquerLExposition),
    recuperation: bandeDeNuit((_get, _set, _band, row, hero) => {
      const before = hero.wounds.current;
      const { wokeUp } = applyRecoveryDay(hero, { sl: row.result!.sl, success: row.result!.success });
      const j: string[] = [];
      const healed = hero.wounds.current - before;
      if (healed > 0) j.push(t('rf.recovered', { name: nomDe(hero), n: healed }));
      else j.push(t('rf.noRecovery', { name: nomDe(hero) }));
      if (wokeUp) j.push(t('heal.awake', { name: nomDe(hero) }));
      return { consequences: freeCons(j) };
    }),
    cauchemar: bandeDeNuit((_get, _set, _band, row, hero) => {
      if (row.result!.success) return { consequences: freeCons([t('rf.dreamless', { name: nomDe(hero) })]) };
      addCondition(hero, 'extenue'); // LDB 21 l.95 : Calme +40 raté → Exténué
      return { consequences: freeCons([t('rf.nightmareFail', { name: nomDe(hero) })]) };
    }),
    'abri-de-fortune': bandeDeNuit((get, _set, _band, row, hero) => {
      const sheltered = row.result!.success; // Survie en extérieur réussie → abri qui tient (ch.09 l.559)
      const severity = (row.meta?.severity ?? 'difficile') as ExposureSeverity;
      const camperIds = String(row.meta?.campers ?? '').split(',').filter(Boolean);
      const count = exposureTestCount(severity, sheltered);
      return {
        consequences: freeCons([sheltered ? t('rf.shelterOk', { name: nomDe(hero) }) : t('rf.shelterKo')]),
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
        return { consequences: freeCons([t('rf.dropped', { name: nomDe(hero), what: name ?? t('rf.fragHeaviest') })]), insert };
      }
      return { consequences: freeCons(applyExposureFailure(hero, Number(step.meta?.failNumber ?? 1), battleRng(), 'chaleur').log), insert };
    },
    'marche-forcee': bandeDeNuit((_get, _set, _band, row, hero) => {
      return { consequences: freeCons([applyForcedMarch(hero, row.result!.success).line]) }; // LDB 51 l.195 : échec → +Exténué
    }),
    faim: bandeDeNuit((_get, _set, _band, row, hero) => {
      const r = applyFaimTest(hero, row.result!.success, bonus(effectiveChar(hero, 'endurance')), battleRng());
      if (r.damage > 0) loseWounds(hero, r.damage); // 1d10 ignore les PA (LDB 18 l.342)
      return { consequences: freeCons(r.log) };
    }),
    soif: bandeDeNuit((_get, _set, _band, row, hero) => {
      const r = applySoifTest(hero, row.result!.success, bonus(effectiveChar(hero, 'endurance')), battleRng());
      if (r.damage > 0) loseWounds(hero, r.damage); // 1d10 ignore les PA (LDB 18 l.340)
      return { consequences: freeCons(r.log) };
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
      return { consequences: freeCons(d.log), insert: hangover ? [hangover] : [] };
    }),
    'dessoulage-gueule-de-bois': bandeDeNuit((get, _set, _band, row, hero) => {
      // 2ᵉ Test du dessoûlage (l.485), désormais influençable : le DR fixe la durée de la gueule de bois.
      return { consequences: freeCons(soberUpHangover(hero, get().gameTime, row.result!.sl).log) };
    }),
    'convalescence-fracture': bandeDeNuit((_get, _set, _band, row, hero) => {
      return { consequences: freeCons(applyFractureEnd(hero, row.result!.success, String(row.meta?.severity ?? 'mineur'), String(row.meta?.location ?? ''), String(row.meta?.traumaLabel ?? t('rf.fractureFallback')))) };
    }),
    'maladie-test-quotidien': bandeDeNuit((get, _set, _band, row, hero) => {
      // Échec d'un Test de cycle quotidien → applique ses ops d'échec (`meta.opsEchec`), via applyOps. Couvre
      // les DEUX porteurs de ce canal : le Test d'un SYMPTÔME (`onTick` — Blessé → contractDisease
      // 'blessure-purulente', Toxine, Vers) ET le Test porté par la MALADIE (`DiseaseDef.dailyTest` —
      // pneumonie, EDOC 08 l.104-108). Donnée-driven : aucun id n'est nommé ici.
      if (row.result!.success) return { consequences: [] };
      const opsEchec = row.meta?.opsEchec ?? [];
      // `sl` (DR négatif de l'échec) → alimente `rollTable{addNegativeSL}` (Vers de carie : « ajoutez le
      // nombre de DR négatifs », MSRC 16 l.90) et les échelles `perSL` de ces ops.
      // La MALADIE est l'entité SOURCE de ce qu'elle inflige : tout effet actif posé par ces ops (Trait
      // octroyé, État durable) porte son ancrage de règle, donc sa fiche à l'écran.
      const source = { kind: 'maladie' as const, id: String(row.meta?.diseaseName ?? '') };
      return { consequences: freeCons(applyOps(hero, opsEchec, { idNeuf: get().forgerUnId, rng: battleRng(), sl: row.result!.sl, source })) };
    }),
    'maladie-gangrene': bandeDeNuit((_get, _set, _band, row, hero) => {
      return { consequences: freeCons(applyDiseaseGangrene(hero, String(row.meta?.diseaseName ?? ''), row.result!.success, Number(row.meta?.be ?? 0))) };
    }),
    'maladie-persistance': bandeDeNuit((_get, _set, _band, row, hero) => {
      // Fin de Durée : résolution ET réconciliation des États portés par un passif (LDB 20 l.188) en UN geste —
      // `applyDiseaseEnd` (engine/rest) est le foyer unique, ici comme dans toute autre voie.
      return { consequences: freeCons(applyDiseaseEnd(hero, String(row.meta?.diseaseName ?? ''), row.result!.success, row.result!.sl, battleRng())) };
    }),
    contagion: bandeDeNuit((_get, _set, _band, row, hero) => {
      return { consequences: freeCons(applyContraction(hero, String(row.meta?.diseaseName ?? ''), row.result!.success, battleRng())) };
    }),
  } satisfies PartDeTable<'appliers', typeof GENRES_D_ETAPE>,
} satisfies FragmentDeTables;
