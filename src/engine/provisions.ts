/**
 * Provisions & Faim — Livre de base, « Faim et Soif » (LDB 18 l.337-343).
 *
 * RAW modélisé (rien d'inventé) :
 *  - « Les Tests de Résistance pour supporter la faim … sont de plus en plus difficiles
 *    (-10 % de plus pour chaque Test) » (LDB 18 l.338) → modificateur −10 × (Tests déjà tentés).
 *  - « Les Personnages qui n'ont ni nourriture ni boisson ne peuvent pas récupérer de Points
 *    de Blessure ou se débarrasser de l'État Exténué de manière naturelle » (LDB 18 l.338) → `isStarving`
 *    est lu par `rest.ts` (lève la dette documentée là-bas).
 *  - Nourriture (LDB 18 l.342) : « lorsque vous n'avez plus de nourriture, vous devez effectuer un Test
 *    de Résistance tous les deux jours. Sur un premier échec, vous subissez une pénalité de –10 en
 *    Force et Endurance. À partir du deuxième échec, toutes les autres Caractéristiques sont
 *    réduites de -10 et vous subissez 1d10 Dégâts, qui ignore les PA, avec un minimum de 1
 *    Blessure. » Lecture : les Dégâts ignorent les PA mais restent réduits par le Bonus
 *    d'Endurance (le « minimum de 1 » serait sinon sans objet — même formulation que l'Exposition).
 *  - Talent « Brouet » (LDB 10 l.139) : « subsister avec la moitié de la nourriture
 *    nécessaire » (1 ration / 2 jours) et « Test concernant la faim tous les 3 jours et pas 2 ».
 *  - SOIF / privation d'eau (LDB 18 l.340) : « chaque jour sans eau nécessite un Test de Résistance. Sur un
 *    premier échec, vous subissez une pénalité de −10 en Intelligence, Force Mentale et Sociabilité.
 *    À partir du deuxième échec, toutes les autres Caractéristiques sont réduites de −10 et vous
 *    subissez 1d10 Dégâts, qui ignore les PA, avec un minimum de 1 Blessure. » Modélisée par
 *    `dailyWaterUpkeep`, sur le MÊME patron que la Faim (Tests de plus en plus durs LDB 18 l.338, dégâts
 *    réduits du BE min 1). L'accès à l'eau est décidé par l'APPELANT (`hasWater`) : abondante par
 *    défaut au Reikland (rivières/puits/auberges) ; à sec en mer (`vessel.waterLitres` épuisé, MDG
 *    ch.14) ou sous la règle optionnelle `water-scarcity` (siège, désert, souterrain). « Ni nourriture
 *    ni boisson … ne peuvent pas récupérer » (LDB 18 l.338) → `isDeprived` = affamé OU assoiffé, lu par `rest.ts`.
 *
 * La nourriture = objets « Ration (1 jour) » (trappings LDB 66 l.20) dans l'inventaire du héros.
 * CHOIX documenté (canon muet sur la résorption) : manger à nouveau remet les compteurs ET les
 * malus de faim à zéro.
 *
 * Cycle d'import évité comme `disease.ts`/`trauma.ts` : `characteristics.ts` importe
 * `hungerCharPenalties` d'ici → ce module n'importe NI characteristics NI conditions ; la valeur
 * de Résistance (`resVal`) et le Bonus d'Endurance (`be`) sont passés par l'appelant, qui applique
 * lui-même les dégâts (via `loseWounds`).
 */
import { Combatant, CharKey, ItemInstance, UpkeepDeferTest } from './types';
import { RNG, defaultRNG, d10 } from './dice';
import { rollTest } from './tests';
import { hasActiveFlag } from './activeFlags';
import { itemCapability } from './capabilities';
import { dailyWaterLitres } from './seaWeather';
import { findTraitById, refLabel } from '../data';
import { RULE_REF, type CodexTarget } from './ruleRefs';
import { traceLineOf } from './traceLine';
import type { ModFamille } from './types';
import { t } from '../i18n';

/** La pénalité CUMULATIVE des Tests de Faim/Soif, NOMMÉE et liée à sa règle (LDB 18 l.338) — c'est
 *  le producteur qui la nomme, la couture d'entretien différé ne fait que la porter. */
function hungerThirstPenalty(value: number): { value: number; label: string; famille: ModFamille; ref: CodexTarget } {
  return { value, label: t('prov.penaltyTestsTaken'), famille: 'jet', ref: RULE_REF['faim-et-soif'] };
}

/** Ids du Test que le RAW nomme pour la Faim comme pour la Soif : `LDB 18 l.338/340/342`. Les DIRE
 *  au lieu de ne transmettre qu'un nombre laisse le monteur de ligne décomposer `resVal` en Niveau
 *  de Compétence nu + composantes nommées (un héros Empoisonné lit « −10 Empoisonné » sur l'étape). */
const RESISTANCE_TEST = { skill: 'resistance', char: 'endurance' } as const satisfies { skill: string; char: CharKey };

/** État de faim d'un personnage (absent = nourri normalement). */
export interface HungerState {
  /** Jours consécutifs sans manger. */
  days: number;
  /** Tests de faim déjà tentés (le suivant est à −10 × tests, LDB 18 l.338). */
  tests: number;
  /** Échecs cumulés : 1ᵉʳ → −10 F/E ; 2ᵉ et suivants → −10 autres caracs + 1d10 dégâts (LDB 18 l.342). */
  failures: number;
  /** Journée DÉJÀ couverte : demi-ration de Brouet (LDB 10 l.139) ou repas pris (effet `mealParty`). */
  coveredDay?: boolean;
}

/** État de soif d'un personnage (absent = désaltéré). Miroir de `HungerState` (LDB 18 l.340). */
export interface ThirstState {
  /** Jours consécutifs sans eau. */
  days: number;
  /** Tests de soif déjà tentés (le suivant est à −10 × tests, LDB 18 l.338). */
  tests: number;
  /** Échecs cumulés : 1ᵉʳ → −10 Int/FM/Soc ; 2ᵉ et suivants → −10 autres + 1d10 dégâts (LDB 18 l.340). */
  failures: number;
}

/** Talent Brouet (LDB 10 l.139) — lu sur la donnée, sans import. */
export function hasBrouet(c: Combatant): boolean {
  return (c.talents ?? []).some((t) => t.talentId === 'brouet' && (t.times ?? 1) >= 1);
}

/** Consommation de vivres/eau ×N (ADE II 2 l.708, folio 31 : « les ogres doivent manger et boire
 *  au moins deux fois plus qu'un humain en une journée ») portée par un Trait RACIAL (Ogre) — MÊME
 *  lecture ciblée sur `c.traits` que `traitEncumbranceFactor` (`combatFeatures/dispatch.ts`). Le PLUS GRAND
 *  facteur porté l'emporte (jamais cumulatif). */
export function traitConsumptionFactor(c: Combatant): number {
  return (c.traits ?? []).reduce((f, t) => Math.max(f, findTraitById(t.id)?.capabilities?.consumptionFactor ?? 1), 1);
}

/** L'objet est-il une ration de voyage (« Ration (1 jour) », LDB 66 l.20) ? Capacité par-OBJET `isRations`,
 *  NON gatée sur le port (on mange depuis le sac) — lue PAR ID dans le catalogue (≠ nom — multilangue-safe). */
export function isRation(it: ItemInstance): boolean {
  return itemCapability(it, 'isRations');
}

/** Nombre de rations portées par un héros. */
export function rationCount(c: Combatant): number {
  return (c.items ?? []).filter(isRation).length;
}

/** Sans provisions depuis ≥ 1 jour → pas de récupération naturelle (PB/Exténué), LDB 18 l.338. */
export function isStarving(c: Combatant): boolean {
  return (c.hunger?.days ?? 0) >= 1;
}

/** Sans eau depuis ≥ 1 jour (LDB 18 l.340). Comme la faim, bloque la récupération naturelle. */
export function isThirsty(c: Combatant): boolean {
  return (c.thirst?.days ?? 0) >= 1;
}

/** « Ni nourriture ni boisson … ne peuvent pas récupérer » (LDB 18 l.338) : affamé OU assoiffé bloque le repos. */
export function isDeprived(c: Combatant): boolean {
  return isStarving(c) || isThirsty(c);
}

/** Pénalités de Caractéristique dues à la SOIF (LDB 18 l.340), injectées dans le pool non-cumul
 *  d'`effectiveChar` (kind `faim`, même privation) : 1ᵉʳ échec → −10 Int/FM/Soc ; dès le 2ᵉ → −10 le reste. */
export function thirstCharPenalties(c: Combatant, key: CharKey): number[] {
  const f = c.thirst?.failures ?? 0;
  const first = key === 'intelligence' || key === 'force-mentale' || key === 'sociabilite';
  if (f >= 1 && first) return [-10];
  if (f >= 2 && !first) return [-10];
  return [];
}

/** Repas pris (auberge, hôte — effet `mealParty`) : nourri pour la journée SANS ration, et les
 *  compteurs/malus de faim se dissipent (choix documenté : manger efface la faim). Mute `c`. */
export function feedFromMeal(c: Combatant): void {
  c.hunger = { days: 0, tests: 0, failures: 0, coveredDay: true };
}

/** Pénalités de Caractéristique dues à la faim (LDB 18 l.342), injectées dans le pool non-cumul
 *  d'`effectiveChar` : 1ᵉʳ échec → −10 Force et Endurance ; dès le 2ᵉ → −10 toutes les autres. */
export function hungerCharPenalties(c: Combatant, key: CharKey): number[] {
  const f = c.hunger?.failures ?? 0;
  if (f >= 1 && (key === 'force' || key === 'endurance')) return [-10];
  if (f >= 2 && key !== 'force' && key !== 'endurance') return [-10];
  return [];
}

export interface FoodUpkeepResult {
  /** A mangé aujourd'hui (ration consommée, ou jour « gratuit » de Brouet). */
  ate: boolean;
  /** Une ration a été retirée de l'inventaire. */
  rationConsumed: boolean;
  /** Dégâts NETS à appliquer par l'appelant (ignorant les PA — via `loseWounds`). */
  damage: number;
  /** Journal (Tests de faim, malus — la consommation silencieuse est agrégée par l'appelant). */
  log: string[];
}

/**
 * Entretien quotidien de nourriture d'UN personnage (une journée écoulée). Mute `c` (rations,
 * compteur de faim). `resVal` = valeur du Test de Résistance ; `be` = Bonus d'Endurance — passés
 * par l'appelant (cycle d'import, cf. en-tête). L'appelant applique `damage` via `loseWounds`.
 */
/**
 * Applique le RÉSULTAT d'un Test de Faim DIFFÉRÉ (différé/influençable en cascade de nuit) : compte
 * le Test (LDB 18 l.338), et sur un échec applique les pénalités (LDB 18 l.342 : 1ᵉʳ → −10 F/E ; 2ᵉ+ → −10 autres
 * + 1d10 Dégâts réduits du BE, min 1). Mute `c.hunger` ; renvoie le journal + les Dégâts à appliquer
 * (via `loseWounds` par l'appelant). Partagé avec `dailyFoodUpkeep` (roll eager) — zéro duplication.
 */
export function applyFaimTest(c: Combatant, success: boolean, be: number, rng: RNG = defaultRNG): { log: string[]; damage: number } {
  const h: HungerState = c.hunger ?? { days: 0, tests: 0, failures: 0 };
  h.tests += 1;
  const log: string[] = [];
  let damage = 0;
  if (!success) {
    h.failures += 1;
    if (h.failures === 1) log.push(t('prov.starving', { name: c.label }));
    else {
      damage = Math.max(1, d10(rng) - be); // 1d10 Dégâts, ignore les PA, min 1 (LDB 18 l.342)
      log.push(t('prov.wasting', { name: c.label, dmg: damage }));
    }
  } // réussite : aucune conséquence (le jet a déjà été montré dans l'étape — pas de bruit de journal)
  c.hunger = h;
  return { log, damage };
}

/**
 * `dailyFoodUpkeep` : mange une ration (ou couvre la journée), sinon installe la faim. `deferTest`
 * (cascade de nuit) : si un Test de Faim TOMBE ce jour, on NE le roule PAS — on appelle `deferTest`
 * avec la pénalité cumulative (−10 × Tests déjà tentés, LDB 18 l.338) pour qu'il devienne une ÉTAPE
 * influençable (résolue par `applyFaimTest`). Sans `deferTest` (contextes eager), le jet est roulé ici.
 */
export function dailyFoodUpkeep(c: Combatant, resVal: number, be: number, rng: RNG = defaultRNG, deferTest?: UpkeepDeferTest): FoodUpkeepResult {
  const res: FoodUpkeepResult = { ate: false, rationConsumed: false, damage: 0, log: [] };
  if (c.dead) return res;
  // Sustentation magique (Graisse de la terre, LDB 48 : « n'a pas besoin de manger ou de boire ») :
  // la Faim est suspendue — pas de ration consommée, compteurs purgés, tant que l'effet dure.
  if (hasActiveFlag(c, 'noHunger')) {
    res.ate = true;
    c.hunger = undefined;
    return res;
  }
  const brouet = hasBrouet(c);
  const h: HungerState = c.hunger ?? { days: 0, tests: 0, failures: 0 };

  // 1. Manger : journée déjà couverte (demi-ration de Brouet, repas d'auberge), sinon `traitConsumptionFactor`
  // ration(s) (ogre ADE II 2 l.708 : « les ogres doivent manger … au moins deux fois plus » — 2 rations/jour).
  if (h.coveredDay) {
    res.ate = true;
  } else {
    const need = traitConsumptionFactor(c);
    const idxs: number[] = [];
    (c.items ?? []).forEach((it, i) => { if (idxs.length < need && isRation(it)) idxs.push(i); });
    if (idxs.length >= need) {
      for (const i of [...idxs].reverse()) c.items!.splice(i, 1);
      res.ate = true;
      res.rationConsumed = true;
    }
  }

  if (res.ate) {
    if (h.days > 0 || h.failures > 0) res.log.push(t('prov.fedAgain', { name: c.label }));
    // Brouet : demi-ration → le jour suivant est couvert (LDB 10 l.139). Sinon, plus d'état de faim.
    c.hunger = brouet && res.rationConsumed ? { days: 0, tests: 0, failures: 0, coveredDay: true } : undefined;
    return res;
  }

  // 2. Pas de nourriture : la faim s'installe (LDB 18 l.342 — Test tous les 2 jours ; Brouet : 3).
  h.coveredDay = undefined;
  h.days += 1;
  const interval = brouet ? 3 : 2;
  if (h.days % interval === 0) {
    const penalty = -10 * h.tests || 0; // LDB 18 l.338 : chaque Test est plus dur (cumulatif ; évite −0)
    if (deferTest) {
      // Cascade de nuit : le Test devient une ÉTAPE influençable (résolue par `applyFaimTest`).
      c.hunger = h; // days++ enregistré ; tests/échecs appliqués à la validation de l'étape
      deferTest({ kind: 'faim', label: t('prov.faim'), base: resVal, test: RESISTANCE_TEST, difficulty: 'intermediaire', mods: [hungerThirstPenalty(penalty)] });
      return res;
    }
    const t2 = rollTest(resVal, 'intermediaire', rng, penalty);
    h.tests += 1;
    // Test résolu SANS fenêtre (entretien du jour) : sa ligne se DÉRIVE (`traceLineOf`).
    res.log.push(traceLineOf({
      who: c.label, label: t('prov.testLabel', { kind: t('prov.faim'), skill: refLabel('skills', { id: RESISTANCE_TEST.skill }), malus: h.tests > 1 ? t('prov.fragTestMalus', { n: (h.tests - 1) * 10 }) : '' }),
      roll: t2.roll, target: t2.target, sl: t2.sl, success: t2.success, issue: t2.success ? t('prov.holdsOn') : t('prov.fail'),
    }));
    if (!t2.success) {
      h.failures += 1;
      if (h.failures === 1) {
        res.log.push(t('prov.starving', { name: c.label }));
      } else {
        res.damage = Math.max(1, d10(rng) - be); // 1d10 Dégâts, ignore les PA, min 1 (LDB 18 l.342)
        res.log.push(t('prov.wasting', { name: c.label, dmg: res.damage }));
      }
    }
  }
  c.hunger = h;
  return res;
}

export interface WaterUpkeepResult {
  /** A bu aujourd'hui (accès à l'eau). */
  drank: boolean;
  /** Dégâts NETS à appliquer par l'appelant (ignorant les PA — via `loseWounds`). */
  damage: number;
  log: string[];
}

/**
 * Applique le RÉSULTAT d'un Test de Soif DIFFÉRÉ (cascade de nuit) : compte le Test (LDB 18 l.338), et sur un
 * échec applique les pénalités (LDB 18 l.340 : 1ᵉʳ → −10 Int/FM/Soc ; 2ᵉ+ → −10 le reste + 1d10 Dégâts réduits
 * du BE, min 1). Mute `c.thirst` ; renvoie le journal + les Dégâts. Miroir de `applyFaimTest`.
 */
export function applySoifTest(c: Combatant, success: boolean, be: number, rng: RNG = defaultRNG): { log: string[]; damage: number } {
  const s: ThirstState = c.thirst ?? { days: 0, tests: 0, failures: 0 };
  s.tests += 1;
  const log: string[] = [];
  let damage = 0;
  if (!success) {
    s.failures += 1;
    if (s.failures === 1) log.push(t('prov.parched', { name: c.label }));
    else {
      damage = Math.max(1, d10(rng) - be); // 1d10 Dégâts, ignore les PA, min 1 (LDB 18 l.340)
      log.push(t('prov.dehydrating', { name: c.label, dmg: damage }));
    }
  }
  c.thirst = s;
  return { log, damage };
}

/**
 * Entretien QUOTIDIEN d'eau d'UN personnage (LDB 18 l.340). `hasWater` = l'accès à l'eau ce jour, décidé par
 * l'appelant (Reikland : toujours vrai sauf règle `water-scarcity` ; mer : `vessel.waterLitres` > 0).
 * A de l'eau → boit, la soif se dissipe. Sinon : Test QUOTIDIEN (LDB 18 l.340), de plus en plus dur (−10 ×
 * Tests, LDB 18 l.338). `deferTest` : le Test devient une ÉTAPE de cascade (résolu par `applySoifTest`).
 * Mute `c.thirst`. `resVal`/`be` passés par l'appelant (cycle d'import, cf. en-tête).
 */
export function dailyWaterUpkeep(c: Combatant, hasWater: boolean, resVal: number, be: number, rng: RNG = defaultRNG, deferTest?: UpkeepDeferTest): WaterUpkeepResult {
  const res: WaterUpkeepResult = { drank: false, damage: 0, log: [] };
  if (c.dead) return res;
  // Sustentation magique (Graisse de la terre, LDB 48 : « n'a pas besoin de manger ou de BOIRE ») :
  // la Soif est suspendue au même titre que la Faim (drapeau `noHunger`), compteurs purgés.
  if (hasWater || hasActiveFlag(c, 'noHunger')) {
    res.drank = true;
    if (c.thirst && (c.thirst.days > 0 || c.thirst.failures > 0)) res.log.push(t('prov.quenched', { name: c.label }));
    c.thirst = undefined;
    return res;
  }
  const s: ThirstState = c.thirst ?? { days: 0, tests: 0, failures: 0 };
  s.days += 1; // chaque JOUR sans eau nécessite un Test (LDB 18 l.340)
  const penalty = -10 * s.tests || 0; // LDB 18 l.338 : chaque Test est plus dur (cumulatif ; évite −0)
  if (deferTest) {
    c.thirst = s; // days++ enregistré ; tests/échecs appliqués à la validation de l'étape
    deferTest({ kind: 'soif', label: t('prov.soif'), base: resVal, test: RESISTANCE_TEST, difficulty: 'intermediaire', mods: [hungerThirstPenalty(penalty)] });
    return res;
  }
  const t2 = rollTest(resVal, 'intermediaire', rng, penalty);
  s.tests += 1;
  res.log.push(traceLineOf({
    who: c.label, label: t('prov.testLabel', { kind: t('prov.soif'), skill: refLabel('skills', { id: RESISTANCE_TEST.skill }), malus: s.tests > 1 ? t('prov.fragTestMalus', { n: (s.tests - 1) * 10 }) : '' }),
    roll: t2.roll, target: t2.target, sl: t2.sl, success: t2.success, issue: t2.success ? t('prov.holdsOn') : t('prov.fail'),
  }));
  if (!t2.success) {
    s.failures += 1;
    if (s.failures === 1) res.log.push(t('prov.parched', { name: c.label }));
    else {
      res.damage = Math.max(1, d10(rng) - be); // 1d10 Dégâts, ignore les PA, min 1 (LDB 18 l.340)
      res.log.push(t('prov.dehydrating', { name: c.label, dmg: res.damage }));
    }
  }
  c.thirst = s;
  return res;
}

/** Manifeste d'avitaillement AU DÉPART (#241/#245) : vivres/eau disponibles vs requis pour couvrir
 *  `joursEstimes` de voyage, sur la POPULATION EMBARQUÉE ENTIÈRE (héros + effectif PNJ, MDG 14 l.238).
 *  PUR — aucune mutation, aucune consommation. `waterLitres` = tonneaux du navire (`CampaignVessel.waterLitres`,
 *  absent = ravitaillement réputé assuré, cf. en-tête) ; l'eau requise suit le régime de bord médian
 *  (`dailyWaterLitres('mediane')`, MDG 14 l.242 — la bande de Température réelle n'est tirée qu'en mer).
 *  `crew` (optionnel, #245) = effectif PNJ nominal présent (`count`) et ses vivres de cale (`provisions`,
 *  rations en jours-homme) : l'équipage mange 1 ration/jour (pas de Brouet), les héros suivent Brouet
 *  (LDB 10 l.139 : 1 ration / 2 jours) sur leurs rations portées. Rations disponibles = celles des héros + vivres
 *  de cale (le port avitaille les deux). Absent = seuls les héros comptent (rétro-compat). */
export interface ProvisioningManifest {
  joursEstimes: number;
  /** Population embarquée totale (héros vivants + effectif PNJ) — l'eau se calcule dessus. */
  souls: number;
  rationsDispo: number;
  rationsRequises: number;
  eauDispoLitres: number | null;
  eauRequiseLitres: number;
  suffisant: boolean;
}

export function provisioningManifest(
  party: Combatant[], waterLitres: number | undefined, joursEstimes: number,
  crew: { count?: number; provisions?: number } = {},
): ProvisioningManifest {
  const alive = party.filter((h) => !h.dead);
  const days = Math.max(0, joursEstimes);
  const crewCount = Math.max(0, crew.count ?? 0);
  const souls = alive.length + crewCount;
  const rationsDispo = alive.reduce((sum, h) => sum + rationCount(h), 0) + Math.max(0, crew.provisions ?? 0);
  // Ogre (ADE II 2 l.708) : facteur ×2 sur les vivres/eau requis, PAR TÊTE — `traitConsumptionFactor`.
  const rationsRequises =
    alive.reduce((sum, h) => sum + (hasBrouet(h) ? Math.ceil(days / 2) : days) * traitConsumptionFactor(h), 0) + crewCount * days;
  const eauRequiseLitres =
    alive.reduce((sum, h) => sum + traitConsumptionFactor(h) * days * dailyWaterLitres('mediane'), 0) + crewCount * days * dailyWaterLitres('mediane');
  const eauDispoLitres = waterLitres ?? null;
  const suffisant = rationsDispo >= rationsRequises && (eauDispoLitres == null || eauDispoLitres >= eauRequiseLitres);
  return { joursEstimes: days, souls, rationsDispo, rationsRequises, eauDispoLitres, eauRequiseLitres, suffisant };
}
