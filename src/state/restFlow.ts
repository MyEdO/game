/**
 * REPOS — source UNIQUE de la nuit de sommeil (remplace le POC restPartyOvernight de combatFlow).
 *
 * `sleepParty` est LE moteur de nuit : horloge jusqu'à l'aube (chaque journée de repos se termine
 * à l'aube — le « temps minimum entre deux repos » est le temps lui-même), entretien quotidien #T3
 * (anti-double-comptage), récupération + cauchemars par héros, contagion de promiscuité. Consommé
 * par : la MODALE de Repos (ci-dessous), la nuit de voyage (travelFlow), la clôture d'interlude et
 * la triche de recette (`restParty`).
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
 *  - Dehors : Exposition (LDB 18 l.327-334 — engine/exposure) selon la MÉTÉO de la scène ;
 *  - Faim (LDB 18 l.337-343) : un héros sans pitance ne récupère pas (engine/provisions).
 */
import type { Combatant } from '../engine/types';
import type { RNG } from '../engine/dice';
import type { RollBreakdown } from '../engine/combat';
import type { RecapTone } from './recapLine';
import { battleRng } from './battleRng';
import { partyAssisted, testValue } from '../engine/skills';
import { hasHealSkill } from '../engine/healing';
import { soberUpDissipate, soberUpHangover } from '../engine/drunkenness';
import { isOutOfAction, addCondition, loseWounds, addClockCondition } from '../engine/conditions';
import { restRecovery, applyRecoveryDay, needsRecoveryRoll, applyDiseaseEnd, type RestRoll } from '../engine/rest';
import { rollContraction, diseaseDefs, contagiousDiseases, contractionDue, applyContraction, applyDiseaseGangrene, diseaseTestModLines } from '../engine/disease';
import { applyOps } from '../engine/ops';
import { rule } from '../engine/policy';
import { type Difficulty } from '../engine/types';
import { applyFractureEnd } from '../engine/trauma';
import type { DeferredUpkeepTest } from './upkeep';
import { weatherExposure, exposureTestCount, expireOnRespite, exposureShelterFromTent, applyExposureFailure, exposureCoatMods, heaviestPossession, dropHeaviestPossession, type ExposureSeverity, type ExposureKind } from '../engine/exposure';
import { effectiveChar, bonus } from '../engine/characteristics';
import { applyForcedMarch } from '../engine/travel';
import { registerCascadeApplier, startCascade, runCascadeImmediate } from './cascade';
import { nightBands, registerNightBandApplier, nightRowId, genuineExposureFail, nextExposureWave, exposureWaveBand, EXPOSURE_BAND_KINDS } from './nightBands';
import { freeCons, testSkillLabel, monoStep, choiceStep, pousseSi, type BuiltCascadeStep } from './rollSeam';
import type { CascadeStepMeta } from './pendings';
import { isRation, feedFromMeal, applyFaimTest, applySoifTest } from '../engine/provisions';
import { toBrass, fromBrass, formatMoney, priceToMoney, type Money } from '../engine/money';
import { payFromGroup } from './bourseFlow';
import { findTrappingById, nightStakeRef, refLabel, type StakeRef } from '../data';
import { diseaseLabel } from '../data';
import { minutesUntilNext, DAWN_MINUTE, MINUTES_PER_DAY } from '../engine/clock';
import { runDailyUpkeep, dayIndex } from './upkeep';
import { continueTravelAfterNight } from './travelFlow';
import { bus, EVT } from './bus';
import type { GameState } from './store';

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

/** Entrée du PROCÈS-VERBAL (bilan multi-jets, réutilisable : jour de mer #232, chronique de voyage…).
 *  Une ligne = un jet de ROUTINE déjà résolu (témoin), rendu en LECTURE SEULE par `MultiRollList` — la
 *  nuit de repos (#347) n'en tisse plus : chaque jet de nuit est une ÉTAPE de cascade influençable
 *  (`state/cascade.ts`), pas une ligne de PV recalculée après coup. */
export interface NightEntry {
  id?: string;
  actorId?: string;
  icon?: string;
  label: string;
  /** Jet affiché en RollLine (base + mods = cible · d100 · DR). */
  d?: RollBreakdown;
  /** Issue / note en clair (« +7 PB », « jour 4/6 »). */
  text?: string;
  /** RUBRIQUE de la ligne : les lignes consécutives d'une MÊME rubrique (les contributeurs d'un même
   *  Test d'équipage) se rendent sous UNE bande titrée (`Band`) au lieu de répéter l'en-tête. */
  group?: string;
  /** Vocabulaire PARTAGÉ (#349) — `RecapTone`, `state/recapLine.ts` (même trio que `RecapLine.tone`). */
  tone?: RecapTone;
  /** Type de jet HÉROS de `sleepParty` (chemin EAGER — cheat `restParty`, clôture d'interlude) —
   *  décoratif hors de ces deux chemins. */
  reKind?: 'recovery' | 'nightmare';
  /** Relance de Chance déjà consommée sur CETTE ligne (LDB 12 l.40 : une relance max par Test). */
  rerolled?: boolean;
  /** ENJEU du jet consigné (#1117 L1b) — la RÉFÉRENCE de donnée, jamais un texte : l'entrée de PV
   *  porte ce que l'ÉTAPE mettait en jeu (`CascadeStep.stake`, recopié à l'émission). Rendu UNE fois
   *  par rubrique (`group`) par `MultiRollList` — l'enjeu est celui de l'étape, pas de chaque ligne. */
  stake?: StakeRef;
}

export interface PendingRest extends PendingBase {
  places: RestPlaces;
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
  /** HALTE de voyage : le RAPPORT DU JOUR (km, jets, péripéties) — affiché en tête de la modale
   *  (la journée se lit le soir même, le recap final ne re-déroule plus tout le trajet). */
  travelDay?: import('./travelFlow').TravelRecapDay;
  /** HALTE de voyage À PIED au-delà des heures RAW : héros à tester en MARCHE FORCÉE (LDB 51 l.195) — leurs
   *  jets ouvrent la cascade de la nuit (influençables), avant l'abri/la récupération. */
  travelMarch?: string[];
}

import type { Get, Set } from './flowTypes';
import type { PendingBase } from './rollFlowFactory';
import { dataLabel } from '../data';
import { t } from '../i18n';
import { stepPrecision } from './rollSeam';

/** Libellé de la Compétence lancée, lu à la DONNÉE par id STABLE — jamais un littéral au call-site (#1341). */
const SKILL_RESISTANCE = (): string => refLabel('skills', { id: 'resistance' });
const SKILL_CALME = (): string => refLabel('skills', { id: 'calme' });

/**
 * LE moteur de nuit (sans modale) : avance l'horloge à l'aube (× days), entretien #T3, récupération
 * + cauchemars, contagion. Renvoie le bilan structuré ; écrit aussi le journal.
 * NB : on n'avance PAS l'horloge minute par minute (advanceTime rejouerait l'entretien de Round —
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
  const caredFor = get().party.some((h) => hasHealSkill(h) && !h.dead && !isOutOfAction(h));
  // La nuit passe — chaque journée de repos se termine à l'AUBE, UNE NUIT À LA FOIS : n nuits dormies
  // sont n RÉVEILS (`lastNightDay` posé à chaque aube atteinte, avant l'entretien de cette journée-là),
  // donc n émissions d'`onWake`. Un séjour de 7 nuits qui n'aurait sauté qu'à l'aube finale ne
  // réveillerait le groupe qu'une fois (Désespoir, VDM 09 l.280).
  // Le bilan de nuit LISTE l'entretien quotidien (rations/faim, maladies, convalescence) — le
  // journal seul ne suffit pas. Portrait attribué par préfixe « Nom… » quand la ligne le porte.
  const from = get().gameTime;
  const toDawn = minutesUntilNext(from, DAWN_MINUTE);
  const firstNight = toDawn === 0 ? MINUTES_PER_DAY : toDawn;
  for (let night = 0; night < n; night++) {
    const before = get().gameTime;
    set({ gameTime: night === 0 ? from + firstNight : before + MINUTES_PER_DAY });
    bus.emit(EVT.TIME_ADVANCED, { minutes: get().gameTime - before });
    set({ lastNightDay: dayIndex(get().gameTime) }); // nuit JOUÉE (#340) — désamorce la privation de sommeil
    // Les Tests d'entretien de la journée (faim, soif, maladie, convalescence, dessoûlage) sont MONTÉS
    // par la porte, comme dans la nuit interactive : ce chemin les résout d'office (`runCascadeImmediate`
    // — branche I du seam), il ne les roule pas lui-même et ne saute aucune fenêtre qui existerait.
    const deferred: DeferredUpkeepTest[] = [];
    for (const text of runDailyUpkeep(get, set, { caredFor, fedDaily: opts.fedDaily, onDeferTest: (d) => deferred.push(d) })) {
      entries.push({ actorId: get().party.find((h) => text.startsWith(h.label))?.id, icon: 'time/calendar', label: 'Entretien quotidien', text, tone: 'info' });
    }
    const steps = nightBands(deferredUpkeepSteps(get().party, deferred));
    if (steps.length) runCascadeImmediate(get, set, steps);
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
        icon: r.kind === 'recovery' ? 'rest/bed' : 'creature/scream',
        label: r.kind === 'recovery' ? t('step.recuperation') : t('rf.nightmaresLabel'),
        // Mêmes Difficultés que les étapes de la cascade de nuit (chemin influençable) — la ligne les DIT.
        d: { label: r.kind === 'recovery' ? SKILL_RESISTANCE() : SKILL_CALME(), base: r.base, difficulty: r.kind === 'recovery' ? 'accessible' : 'facile', modifier: r.target - r.base, target: r.target, roll: r.roll, success: r.success, sl: r.sl },
        tone: r.success ? 'ok' : 'bad',
        reKind: r.kind,
      });
    });
    for (const line of log) entries.push({ actorId: h.id, icon: 'rest/bed', label: t('rf.nuit'), text: line.replace(`${h.label} `, ''), tone: 'info' });
    journal.push(...log);
  }

  // Contagion de promiscuité (chambrée/campement — Toux et éternuements, LDB 20 l.206) : 1 Test de Contraction par nuit de repos.
  // Règle optionnelle « Utilisation des Maladies » : désactivée si disease-mode = off.
  for (const c of rule('disease-mode') === 'off' ? [] : runContagion(party, n, rng)) {
    entries.push({ actorId: c.actorId, icon: 'medical/infection', label: t('rf.contagionLabel', { disease: diseaseLabel(c.dz) }), text: c.log.join(' '), tone: 'bad' });
    journal.push(...c.log);
  }

  const title = n > 1 ? t('rf.titleDays', { n }) : t('rf.titleNight');
  set({ party: [...get().party] });
  get().log([title, ...journal]);
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
          const log = rollContraction(other, dz.id, testValue(other, 'resistance'), def?.contractDifficulty ?? 'accessible', rng);
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
    const st = monoStep({ id: `expo-${id}`, kind: 'exposure', actor: h, label: t('step.exposition'), icon: 'rest/cold',
      rollLabel: SKILL_RESISTANCE(), difficulty: 'intermediaire',
      stake: nightStakeRef('exposure'),
      ligne: { test: { skill: 'resistance' }, surLaCible: coat } });
    pousseSi(steps, st);
  }
  return exposureWaveBand(steps, 'froid', count);
}

registerNightBandApplier('recovery', (_get, _set, _band, row, hero) => {
  const before = hero.wounds.current;
  const { wokeUp } = applyRecoveryDay(hero, { sl: row.result!.sl, success: row.result!.success });
  const j: string[] = [];
  const healed = hero.wounds.current - before;
  if (healed > 0) j.push(t('rf.recovered', { name: hero.label, n: healed }));
  else j.push(t('rf.noRecovery', { name: hero.label }));
  if (wokeUp) j.push(t('heal.awake', { name: hero.label }));
  return { consequences: freeCons(j) };
});

registerNightBandApplier('nightmare', (_get, _set, _band, row, hero) => {
  if (row.result!.success) return { consequences: freeCons([t('rf.dreamless', { name: hero.label })]) };
  addCondition(hero, 'extenue'); // LDB 21 l.95 : Calme +40 raté → Exténué
  return { consequences: freeCons([t('rf.nightmareFail', { name: hero.label })]) };
});

registerNightBandApplier('shelter', (get, _set, _band, row, hero) => {
  const sheltered = row.result!.success; // Survie en extérieur réussie → abri qui tient (ch.09 l.559)
  const severity = (row.meta?.severity ?? 'difficile') as ExposureSeverity;
  const camperIds = String(row.meta?.campers ?? '').split(',').filter(Boolean);
  const count = exposureTestCount(severity, sheltered);
  return {
    consequences: freeCons([sheltered ? t('rf.shelterOk', { name: hero.label }) : t('rf.shelterKo')]),
    insert: count > 0 ? buildExposureBand(get().party, camperIds, count) : [],
  };
});

// LES DEUX ROUTES de l'Exposition (`EXPOSURE_BAND_KINDS`) partagent LA conséquence — une déclaration de
// plus, jamais une seconde implémentation : c'est la ROUTE qui diffère (ordres de traversée), pas la règle.
for (const kindExposition of EXPOSURE_BAND_KINDS) registerNightBandApplier(kindExposition, (_get, _set, band, row, hero) => {
  // Volet froid/chaleur (l.330/334) porté par la BANDE (`meta.kind`) — défaut froid (nuit de repos). La peau
  // de phoque (MDG 14 l.277) retient l'échec de justesse AU FROID (+1 DR) : un échec ainsi tenu ne compte
  // NI comme conséquence NI dans l'escalade — comme le chemin eager `exposureNight`.
  const kind = (band.meta?.kind as ExposureKind) ?? 'froid';
  if (!genuineExposureFail(hero, kind, row.result)) {
    const held = !row.result!.success; // échec de justesse tenu par la peau de phoque
    return { consequences: freeCons([held
      ? t('rf.sealskinHeld', { name: hero.label })
      : t('rf.exposureEndured', { name: hero.label, what: kind === 'froid' ? t('rf.cold') : t('rf.heat') })]) };
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
    id: `${band.id}-${row.id}-drop`, kind: 'exposure-heat-drop', actorId: hero.id, icon: 'item/misc',
    label: t('step.possessionLourde'),
    options: [{ key: 'jeter', label: t('opt.jeter', { quoi: heavy.label }) }, { key: 'garder', label: t('opt.garderPaquetage') }],
    defaultChoice: 'garder', // consommé par `runCascadeImmediate` (repos multi-jours) — `resolveRemainingCascade`
    // (« Tout résoudre ») s'arrête TOUJOURS sur ce choix depuis 249e931f, n'applique plus JAMAIS de défaut
    meta: { failNumber: priorFails + 1, cancelsRowId: nightRowId(band, row) },
  }) : undefined;
  if (heavy && drop) {
    return {
      consequences: freeCons([t('rf.heatFailDrop', { name: hero.label, item: heavy.label })]),
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

registerCascadeApplier('exposure-heat-drop', (get, _set, step, hero, ctx) => {
  if (!hero || step.chosen == null) return;
  const band = ctx.steps.find((s) => s.id === step.meta?.nextWaveOf);
  const insert = band ? nextExposureWave(get, band, ctx.steps.map((s) => (s.id === step.id ? { ...s, chosen: step.chosen } : s))) : [];
  if (step.chosen === 'jeter') {
    const name = dropHeaviestPossession(hero);
    return { consequences: freeCons([t('rf.dropped', { name: hero.label, what: name ?? t('rf.fragHeaviest') })]), insert };
  }
  return { consequences: freeCons(applyExposureFailure(hero, Number(step.meta?.failNumber ?? 1), battleRng(), 'chaleur').log), insert };
});

registerNightBandApplier('forcedMarch', (_get, _set, _band, row, hero) => {
  return { consequences: freeCons([applyForcedMarch(hero, row.result!.success).line]) }; // LDB 51 l.195 : échec → +Exténué
});

registerNightBandApplier('faim', (_get, _set, _band, row, hero) => {
  const r = applyFaimTest(hero, row.result!.success, bonus(effectiveChar(hero, 'endurance')), battleRng());
  if (r.damage > 0) loseWounds(hero, r.damage); // 1d10 ignore les PA (LDB 18 l.342)
  return { consequences: freeCons(r.log) };
});

registerNightBandApplier('soif', (_get, _set, _band, row, hero) => {
  const r = applySoifTest(hero, row.result!.success, bonus(effectiveChar(hero, 'endurance')), battleRng());
  if (r.damage > 0) loseWounds(hero, r.damage); // 1d10 ignore les PA (LDB 18 l.340)
  return { consequences: freeCons(r.log) };
});

registerNightBandApplier('dessoulage', (_get, _set, band, row, hero) => {
  // Dessoûlage (LDB 09 l.485) : le 1ᵉʳ Test INFLUENÇABLE fixe la dissipation (10−DR h). Le 2ᵉ Test — « Une
  // fois tous les effets dissipés, effectuez un nouveau Test » — devient sa PROPRE rangée influençable
  // (patron `insert`, re-bandée par la fabrique) : plus AUCUN jet silencieux (#253), et la gueule de bois
  // est due par TOUTE rangée du dessoûlage, pas seulement par les perdantes.
  const d = soberUpDissipate(hero, row.result!.sl);
  const alcool = { skill: 'resistance-a-l-alcool', char: 'endurance' } as const;
  const hangover = monoStep({
    id: `dessoulageHangover-${hero.id}`, kind: 'dessoulageHangover', actor: hero, icon: 'time/night',
    rollLabel: testSkillLabel(alcool) ?? SKILL_RESISTANCE(), label: t('step.gueuleDeBois'), difficulty: 'intermediaire',
    stake: nightStakeRef('dessoulageHangover'),
    ligne: { test: alcool },
    ...(band.meta?.day !== undefined ? { meta: { day: band.meta.day } } : {}),
  });
  return { consequences: freeCons(d.log), insert: hangover ? [hangover] : [] };
});

registerNightBandApplier('dessoulageHangover', (get, _set, _band, row, hero) => {
  // 2ᵉ Test du dessoûlage (l.485), désormais influençable : le DR fixe la durée de la gueule de bois.
  const h = soberUpHangover(hero, get().gameTime, row.result!.sl);
  addClockCondition(hero, h.hangover.id, h.hangover.value, h.hangover.until);
  return { consequences: freeCons(h.log) };
});

registerNightBandApplier('traumaFracture', (_get, _set, _band, row, hero) => {
  return { consequences: freeCons(applyFractureEnd(hero, row.result!.success, String(row.meta?.severity ?? 'mineur'), String(row.meta?.location ?? ''), String(row.meta?.traumaLabel ?? t('rf.fractureFallback')))) };
});

registerNightBandApplier('diseaseTick', (_get, _set, _band, row, hero) => {
  // Échec d'un Test de cycle quotidien → applique sa conséquence GameOp `onFail`, via applyOps. Couvre
  // les DEUX porteurs de ce canal : le Test d'un SYMPTÔME (`onTick` — Blessé → contractDisease
  // 'blessure-purulente', Toxine, Vers) ET le Test porté par la MALADIE (`DiseaseDef.dailyTest` —
  // pneumonie, EDOC 08 l.104-108). Donnée-driven : aucun id n'est nommé ici.
  if (row.result!.success) return { consequences: [] };
  const onFail = (row.meta?.onFail ?? []) as import('../engine/ops').GameOp[];
  // `sl` (DR négatif de l'échec) → alimente `rollTable{addNegativeSL}` (Vers de carie : « ajoutez le
  // nombre de DR négatifs », MSRC 16 l.90) et les échelles `perSL` d'un `onFail`.
  // La MALADIE est l'entité SOURCE de ce qu'elle inflige : tout effet actif posé par `onFail` (Trait
  // octroyé, État durable) porte son ancrage de règle, donc sa fiche à l'écran.
  const source = { kind: 'disease' as const, id: String(row.meta?.diseaseName ?? '') };
  return { consequences: freeCons(applyOps(hero, onFail, { rng: battleRng(), sl: row.result!.sl, source })) };
});

registerNightBandApplier('diseaseGangrene', (_get, _set, _band, row, hero) => {
  return { consequences: freeCons(applyDiseaseGangrene(hero, String(row.meta?.diseaseName ?? ''), row.result!.success, Number(row.meta?.be ?? 0))) };
});

registerNightBandApplier('diseasePersist', (_get, _set, _band, row, hero) => {
  // Fin de Durée : résolution ET réconciliation des États portés par un passif (LDB 20 l.188) en UN geste —
  // `applyDiseaseEnd` (engine/rest) est le foyer unique, ici comme dans toute autre voie.
  return { consequences: freeCons(applyDiseaseEnd(hero, String(row.meta?.diseaseName ?? ''), row.result!.success, row.result!.sl, battleRng())) };
});

registerNightBandApplier('contagion', (_get, _set, _band, row, hero) => {
  return { consequences: freeCons(applyContraction(hero, String(row.meta?.diseaseName ?? ''), row.result!.success, battleRng())) };
});

/** Icône d'étape de cascade par `kind` de Test d'entretien différé. */
const UPKEEP_STEP_ICON: Record<string, string> = {
  faim: 'rest/feast', diseaseTick: 'medical/infection', diseaseGangrene: 'medical/infection', diseasePersist: 'medical/infection',
  traumaFracture: 'medical/crutch', contagion: 'medical/infection',
};

/** Convertit les Tests d'entretien DIFFÉRÉS (`runDailyUpkeep` onDeferTest — Faim/Soif/maladie/
 *  convalescence/dessoûlage) en étapes de cascade influençables, avec leur enjeu verbatim (NIGHT_STAKES)
 *  quand il est documenté. SOURCE UNIQUE partagée par la nuit (`buildNightCascade`) et l'avance
 *  d'horloge (`advanceTime`). `startIndex` = décalage d'id quand d'autres étapes précèdent (marche forcée). */
export function deferredUpkeepSteps(party: Combatant[], deferred: DeferredUpkeepTest[], startIndex = 0): BuiltCascadeStep[] {
  const steps: BuiltCascadeStep[] = [];
  for (const t of deferred) {
    const h = party.find((x) => x.id === t.heroId);
    if (!h || h.dead) continue;
    const st = monoStep({ id: `${t.kind}-${t.heroId}-${startIndex + steps.length}`, kind: t.kind, actor: h, label: dataLabel(t.label),
      // La compétence se DÉRIVE des ids quand le producteur les porte (Dessoûlage = Résistance à
      // l'alcool, LDB 09 l.485) ; sans ids, le repli reste la Résistance de l'entretien (LDB 18 l.338).
      icon: UPKEEP_STEP_ICON[t.kind] ?? 'nav/dice', rollLabel: testSkillLabel(t.test ?? {}) ?? SKILL_RESISTANCE(),
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
  const toDawn = minutesUntilNext(from, DAWN_MINUTE);
  set({ gameTime: from + (toDawn === 0 ? MINUTES_PER_DAY : toDawn) });
  bus.emit(EVT.TIME_ADVANCED, { minutes: get().gameTime - from });
  set({ lastNightDay: dayIndex(get().gameTime) }); // nuit JOUÉE (#340) — désamorce la privation de sommeil
  // Entretien quotidien (#T3) — la partie SANS jet est eager (rations consommées, jours décomptés) ;
  // TOUT Test de Résistance (Faim LDB 18 l.342, maladie l.110/135/162, convalescence LDB 18 l.202) est DIFFÉRÉ en
  // étape influençable (sinon il serait pré-résolu dans le journal AVANT que le joueur n'agisse).
  const caredFor = party.some((h) => hasHealSkill(h) && !h.dead && !isOutOfAction(h));
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
    const st = monoStep({ id: `march-${id}`, kind: 'forcedMarch', actor: h, label: t('step.marcheForcee'), icon: 'travel/foot',
      rollLabel: SKILL_RESISTANCE(), difficulty: 'intermediaire',
      stake: nightStakeRef('forcedMarch'),
      ligne: { test: { skill: 'resistance', char: 'endurance' } } });
    pousseSi(steps, st);
  }
  // Tests d'entretien DIFFÉRÉS (faim, soif, maladie, convalescence, dessoûlage) → étapes influençables.
  steps.push(...deferredUpkeepSteps(party, deferred, steps.length));
  // CONTAGION (promiscuité — Toux et éternuements, LDB 20 l.206 + tambouille piètre) → un jet de Résistance influençable par héros exposé.
  for (const c of [...collectContagion(party), ...(opts.extraContagion ?? [])]) {
    const h = party.find((x) => x.id === c.heroId);
    if (!h || h.dead) continue;
    const st = monoStep({ id: `contagion-${c.heroId}-${steps.length}`, kind: 'contagion', actor: h, label: stepPrecision(t('step.contagion'), dataLabel(c.diseaseName)), icon: 'medical/infection',
      rollLabel: SKILL_RESISTANCE(), difficulty: c.difficulty,
      stake: nightStakeRef('contagion'),
      // Contraction = « Test de Résistance » (`LDB 20 l.25`) : valeur de la porte, et les bonus d'effet
      // SCOPÉS à cette maladie (Fleur de lune, Tonique digestif) en lignes NOMMÉES sur la cible.
      ligne: { test: { skill: 'resistance' }, surLaCible: diseaseTestModLines(h, c.diseaseName) },
      meta: { diseaseName: c.diseaseName },
      menace: 'maladie' }); // Test de Contraction = « résister à la Maladie » (Résistance (Menace), LDB 10)
    pousseSi(steps, st);
  }
  // Campement : Exposition (intempéries) — abri de fortune (STEP) → insère les jets d'Exposition.
  const campers = party.filter((h) => !h.dead && p.perHero[h.id]?.lodging === 'dehors');
  const severity = weatherExposure(get().scene?.weather);
  if (campers.length && severity !== 'clement') {
    const camperIds = campers.map((h) => h.id);
    if (exposureShelterFromTent(party)) {
      log.push(t('rf.tentUp'));
      const count = exposureTestCount(severity, true); // tente : extrême → rythme difficile, difficile → 0
      if (count > 0) steps.push(...buildExposureBand(party, camperIds, count));
    } else {
      const best = partyAssisted(party.filter((h) => !h.dead), 'survie-en-exterieur'); // Soutien (LDB 12)
      if (best) {
        const st = monoStep({ id: 'abri', kind: 'shelter', actor: best.actor, label: t('step.abriDeFortune'), icon: 'rest/camp',
          rollLabel: refLabel('skills', { id: 'survie-en-exterieur' }), difficulty: 'intermediaire',
          stake: nightStakeRef('shelter'),
          // `best.value` porte le Soutien FONDU : le monteur le ressort en ligne NOMMÉE (LDB 12 l.187-200),
          // et décompose le reste en Niveau de Compétence nu + composantes.
          ligne: { test: { skill: 'survie-en-exterieur' }, valeur: best.value, soutien: best.support },
          meta: { severity, campers: camperIds.join(',') } });
        pousseSi(steps, st);
      } else {
        const count = exposureTestCount(severity, false);
        if (count > 0) steps.push(...buildExposureBand(party, camperIds, count));
      }
    }
    for (const h of campers) expireOnRespite(h, get().gameTime + Number(rule('exposure-expire-hours')) * 60); // dissipation maison
  }

  // Récupération + cauchemars : un jet = une étape ; sans jet (PB plein/affamé/instable) → eager.
  for (const h of party) {
    if (h.dead) continue;
    if (needsRecoveryRoll(h)) {
      // Récupération = « Test de Résistance Accessible (+20) » (`LDB 18 l.296`) : valeur de la porte.
      const st = monoStep({ id: `recov-${h.id}`, kind: 'recovery', actor: h, label: t('step.recuperation'), icon: 'rest/bed',
        rollLabel: SKILL_RESISTANCE(), difficulty: 'accessible',
        stake: nightStakeRef('recovery'),
        ligne: { test: { skill: 'resistance' } } });
      pousseSi(steps, st);
    } else {
      const before = h.wounds.current;
      const { wokeUp } = applyRecoveryDay(h, null);
      if (h.wounds.current - before > 0) log.push(t('rf.recovered', { name: h.label, n: h.wounds.current - before }));
      if (wokeUp) log.push(t('heal.awake', { name: h.label }));
    }
    if (h.nightmares) {
      const st = monoStep({ id: `nm-${h.id}`, kind: 'nightmare', actor: h, label: t('step.cauchemars'), icon: 'creature/scream',
        rollLabel: SKILL_CALME(), difficulty: 'facile',
        stake: nightStakeRef('nightmare'),
        // Cauchemars = « Test de Calme Facile (+40) » (`LDB 21 l.95`) : valeur de la porte, États compris.
        ligne: { test: { skill: 'calme' } } });
      pousseSi(steps, st);
    }
  }

  // BANDES (#1117 L3) : les Tests qui répondent à la MÊME entrée de règle le MÊME jour font UNE
  // fenêtre, une rangée par héros appelé — 1er des TROIS bâtisseurs à passer par la fabrique.
  const banded = nightBands(steps);

  // Journal : le titre de nuit + tout ce qui s'est ajouté APRÈS l'entretien (tente, récupération sans
  // jet…) — l'entretien lui-même est déjà dans le journal (`runDailyUpkeep`, écriture unique, #216).
  set({ party: [...get().party] });
  get().log([t('rf.titleNight'), ...log.slice(upkeepCount)]);
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

/** Pitances proposées (orthogonales au couchage : manger à l'auberge et dormir dehors est permis).
 *  « ration » seulement si le héros en a une. */
export function foodOptions(places: RestPlaces, hero: Combatant): RestFood[] {
  const out: RestFood[] = [];
  if (places.auberge) out.push('repas');
  if (places.maison) out.push('maison');
  if ((hero.items ?? []).some(isRation)) out.push('ration');
  out.push('rien');
  return out;
}

/** Coût total du repos (chambres regroupées par 2, repas par convive), par nuit × days. */
export function restCost(p: PendingRest, party: Combatant[]): Money {
  const half = p.quality === 'pietre' ? 0.5 : 1;
  let brass = 0;
  const heroes = party.filter((h) => !h.dead && p.perHero[h.id]);
  const nPrivee = heroes.filter((h) => p.perHero[h.id].lodging === 'privee').length;
  const nCommune = heroes.filter((h) => p.perHero[h.id].lodging === 'commune').length;
  const nRepas = heroes.filter((h) => p.perHero[h.id].food === 'repas').length;
  brass += Math.ceil(nPrivee / 2) * PRICE_BRASS.privee; // chambre pour 2 (grande pour 4 = ×2, équivalent)
  brass += nCommune * PRICE_BRASS.commune;
  brass += nRepas * PRICE_BRASS.repas;
  return fromBrass(Math.ceil(brass * half) * Math.max(1, p.days));
}

/** Offre de repos À LA POSITION DU GROUPE : zone de repos (rect d'auteur) prioritaire, sinon
 *  réglage de scène, sinon camp (défaut). PARAMÉTRABLE SUR LA ZONE dans l'éditeur. */
export function restPlacesHere(st: GameState): { places: RestPlaces; quality: 'normale' | 'pietre' } | null {
  const sc = st.scene;
  if (!sc) return null;
  const pos = st.partyPos;
  const zone = pos ? [...(sc.restZones ?? [])].reverse().find((z) =>
    pos.x >= z.rect.x && pos.x < z.rect.x + z.rect.w && pos.y >= z.rect.y && pos.y < z.rect.y + z.rect.h
    && (z.rect.z ?? 0) === (pos.z ?? 0)) : undefined;
  const places = zone?.places ?? sc.rest ?? { camp: true };
  if (!places.auberge && !places.maison && !places.camp) return null; // repos interdit ici
  return { places, quality: zone?.quality ?? sc.rest?.quality ?? 'normale' };
}

/** Ouvre la modale de Repos avec une OFFRE de lieux (effet, halte de voyage, bouton de Repos). */
export function openRest(get: Get, set: Set, opts?: { places?: RestPlaces; quality?: 'normale' | 'pietre'; days?: number; travelHalt?: boolean; travelDay?: import('./travelFlow').TravelRecapDay; travelMarch?: string[] }): void {
  const st = get();
  if (st.battle || st.pendingRest) return;
  const places = opts?.places ?? { maison: true, camp: true };
  const perHero: PendingRest['perHero'] = {};
  for (const h of st.party) {
    if (h.dead) continue;
    perHero[h.id] = { lodging: lodgingOptions(places)[0], food: foodOptions(places, h)[0] };
  }
  // CHRONIQUE de voyage (#333) : une halte de voyage porte le jour FINALISÉ — on l'accumule sur le plan
  // (même `set` que la modale) pour que l'écran-hub (`VoyageScreen`) en tienne le journal (une carte par
  // jour passé), source unique (STRUCTURE `TravelRecapDay`, jamais une chaîne recomposée). No-op hors halte.
  const logPatch = opts?.travelDay && st.travelPlan
    ? { travelPlan: { ...st.travelPlan, log: [...(st.travelPlan.log ?? []), opts.travelDay] } }
    : {};
  set({ ...logPatch, pendingRest: { places, quality: opts?.quality ?? 'normale', days: Math.max(1, opts?.days ?? 1), perHero, phase: 'setup', travelHalt: opts?.travelHalt, travelDay: opts?.travelDay, travelMarch: opts?.travelMarch } });
}

export function restSet(get: Get, set: Set, heroId: string, patch: Partial<{ lodging: RestLodging; food: RestFood }>): void {
  const p = get().pendingRest;
  if (!p || p.phase !== 'setup' || !p.perHero[heroId]) return;
  const hero = get().party.find((h) => h.id === heroId);
  if (!hero) return;
  if (patch.lodging && !lodgingOptions(p.places).includes(patch.lodging)) return;
  if (patch.food && !foodOptions(p.places, hero).includes(patch.food)) return;
  set({ pendingRest: { ...p, perHero: { ...p.perHero, [heroId]: { ...p.perHero[heroId], ...patch } } } });
}

export function restReady(get: Get, set: Set, seat: number): void {
  const p = get().pendingRest;
  if (!p || p.phase !== 'setup') return;
  set({ pendingRest: { ...p, readyBySeat: { ...(p.readyBySeat ?? {}), [seat]: true } } });
}

export function restCancel(get: Get, set: Set): void {
  const p = get().pendingRest;
  if (!p || p.phase !== 'setup') return;
  set({ pendingRest: null });
}

/** Dormir : paie (RAW ch.66), nourrit, puis ouvre la CHAÎNE de cascades de nuit (#347, `openRestNight`). */
export function restSleep(get: Get, set: Set): void {
  const p = get().pendingRest;
  if (!p || p.phase !== 'setup' || get().battle) return;
  const rng = battleRng();

  // 1. La note d'auberge (LDB 66) — dépense de BANDE (aucun bénéficiaire unique) tirée gloutonnement des
  //    bourses ; refus (aucune ponction) si le total du groupe ne suffit pas.
  const cost = restCost(p, get().party);
  if (toBrass(cost) > 0 && !payFromGroup(get, set, cost, { purpose: 'auberge' })) {
    get().log(t('rf.notEnoughMoney', { money: formatMoney(cost) }));
    return;
  }

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

/** Titre de la nuit — le couchage RÉELLEMENT choisi (pas l'OFFRE du lieu) : tout le monde dehors →
 *  Campement, même si une auberge était dispo (le joueur a choisi la belle étoile). Identique pour
 *  toutes les nuits d'un repos multi-jours (les choix de couchage ne changent pas en cours de séjour). */
function nightTitle(p: PendingRest, party: Combatant[]): string {
  const lodgings = party.filter((h) => !h.dead && p.perHero[h.id]).map((h) => p.perHero[h.id].lodging);
  return lodgings.some((l) => l === 'privee' || l === 'commune') ? t('rf.nightInn')
    : lodgings.some((l) => l === 'maison') ? t('rf.nightHome')
    : lodgings.some((l) => l === 'bord') ? t('rf.nightAboard')
    : t('rf.nightCamp');
}

/** Ouvre (ou enchaîne) UNE nuit de repos (#347) : reconstruit `buildNightCascade` pour CETTE nuit et
 *  l'ouvre en cascade influençable, en portant `nightsLeft` (nuits ENCORE à enchaîner après celle-ci)
 *  sur la cascade — sa clôture (`continueRestNights`, appelée par `dispatchCascadeDone`) reprend alors
 *  la nuit suivante. `extraContagion` (tambouille piètre) ne s'applique qu'à la nuit d'ARRIVÉE (repas
 *  du soir posé une fois en amont par `restSleep`).
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
      title: nightTitle(p, get().party), icon: 'time/night', purpose: isLast && p.travelHalt ? 'travel' : 'night',
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
