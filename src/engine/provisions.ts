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
 *    ch.14) ou sous la règle optionnelle `penurie-d-eau` (siège, désert, souterrain). « Ni nourriture
 *    ni boisson … ne peuvent pas récupérer » (LDB 18 l.338) → `isDeprived` = affamé OU assoiffé, lu par `rest.ts`.
 *
 * La nourriture vient du garde-manger (`GardeManger`) choisi par l'appelant : les objets `isRations` du sac
 * (`rationsDuSac`, LDB 66 l.20), ou la cale du navire à bord en mer (`upkeep.ts`).
 * CHOIX documenté (canon muet sur la résorption) : manger à nouveau remet les compteurs ET les
 * malus de faim à zéro.
 *
 * Le collecteur `passiveMods` lit les pénalités dans `passifsDePrivation`.
 */
import { nomDe } from './nom';
import { Combatant, ItemInstance, UpkeepDeferTest, type TestIds } from './types';
import { RNG, d10 } from './dice';
import { rollTest } from './tests';
import { hasActiveFlag } from './activeFlags';
import { itemCapability } from './capabilities';
import { findDiseaseById, findTraitById, findTrappingById, refLabel } from '../data';
import { garanti } from '../lib/garanti';
import { rule } from './policy';
import { dayIndex, MINUTES_PER_DAY } from './clock';
import { VIVRES_DE_CALE } from './seaNavigation';
import { RULE_REF, type CodexTarget } from './ruleRefs';
import { traceLineOf } from './traceLine';
import type { Id } from '../data/schemas/grammaire/ref';
import type { ModFamille } from './types';
import type { PorteurDeMaladies } from './disease';
import { t } from '../i18n';
import { effectiveTalents } from './talentEffects';

export { hungerCharPenalties, thirstCharPenalties } from './passifsDePrivation';

/** La pénalité CUMULATIVE des Tests de Faim/Soif, NOMMÉE et liée à sa règle (LDB 18 l.338) — c'est
 *  le producteur qui la nomme, la couture d'entretien différé ne fait que la porter. */
function hungerThirstPenalty(value: number): { value: number; label: string; famille: ModFamille; ref: CodexTarget } {
  return { value, label: t('prov.penaltyTestsTaken'), famille: 'jet', ref: RULE_REF['faim-et-soif'] };
}

/** Ids du Test que le RAW nomme pour la Faim comme pour la Soif : `LDB 18 l.338/340/342`. Les DIRE
 *  au lieu de ne transmettre qu'un nombre laisse le monteur de ligne décomposer `resVal` en Niveau
 *  de Compétence nu + composantes nommées (un héros Empoisonné lit « −10 Empoisonné » sur l'étape). */
const RESISTANCE_TEST = Object.freeze({ skill: { id: 'resistance' }, characteristic: 'endurance' } as const satisfies TestIds); // #2097

/** État de faim d'un personnage (absent = nourri normalement). */
export interface HungerState {
  /** Jours consécutifs sans manger. */
  days: number;
  /** Tests de faim déjà tentés (le suivant est à −10 × tests, LDB 18 l.338). */
  tests: number;
  /** Échecs cumulés : 1ᵉʳ → −10 F/E ; 2ᵉ et suivants → −10 autres caracs + 1d10 dégâts (LDB 18 l.342). */
  failures: number;
  /** Journée DÉJÀ couverte : `true` pour un repas pris (effet `mealParty`), la seconde moitié de la demi-ration
   *  de Brouet sinon (LDB 10 l.139), avec le vivre qui la fait (`RepasDuJour`). */
  coveredDay?: true | { repas: RepasDuJour };
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
function hasBrouet(c: Combatant): boolean {
  return effectiveTalents(c).some((t) => t.talentId === 'brouet' && (t.times ?? 1) >= 1);
}

/** Consommation de vivres/eau ×N (ADE II 2 l.755, folio 31 : « les ogres doivent manger et boire
 *  au moins deux fois plus qu'un humain en une journée ») portée par un Trait RACIAL (Ogre) — MÊME
 *  lecture ciblée sur `c.traits` que `traitEncumbranceFactor` (`combatFeatures/dispatch.ts`). Le PLUS GRAND
 *  facteur porté l'emporte (jamais cumulatif). */
export function traitConsumptionFactor(c: Combatant): number {
  return (c.traits ?? []).reduce((f, t) => Math.max(f, findTraitById(t.id)?.capabilities?.consumptionFactor ?? 1), 1);
}

/** L'objet est-il une ration de voyage (LDB 66 l.20) ? Capacité par-OBJET `isRations`,
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

/** Repas pris (auberge, hôte — effet `mealParty`) : nourri pour la journée SANS ration, et les
 *  compteurs/malus de faim se dissipent (choix documenté : manger efface la faim). Mute `c`. */
export function feedFromMeal(c: Combatant): void {
  c.hunger = { days: 0, tests: 0, failures: 0, coveredDay: true };
}

export interface FoodUpkeepResult {
  /** A mangé aujourd'hui (ration consommée, ou jour « gratuit » de Brouet). */
  ate: boolean;
  /** Le garde-manger a fourni le repas (et non une journée déjà couverte). */
  rationConsumed: boolean;
  /** Dégâts NETS à appliquer par l'appelant (ignorant les PA — via `loseWounds`). */
  damage: number;
  /** Journal (Tests de faim, malus — la consommation silencieuse est agrégée par l'appelant). */
  log: string[];
}

/**
 * Applique le RÉSULTAT d'un Test de Faim DIFFÉRÉ (différé/influençable en cascade de nuit) : compte
 * le Test (LDB 18 l.338), et sur un échec applique les pénalités (LDB 18 l.342 : 1ᵉʳ → −10 F/E ; 2ᵉ+ → −10 autres
 * + 1d10 Dégâts réduits du BE, min 1). Mute `c.hunger` ; renvoie le journal + les Dégâts à appliquer
 * (via `loseWounds` par l'appelant). Partagé avec `dailyFoodUpkeep` (roll eager) — zéro duplication.
 */
export function applyFaimTest(c: Combatant, success: boolean, be: number, rng: RNG): { log: string[]; damage: number } {
  const h: HungerState = c.hunger ?? { days: 0, tests: 0, failures: 0 };
  h.tests += 1;
  const log: string[] = [];
  let damage = 0;
  if (!success) {
    h.failures += 1;
    if (h.failures === 1) log.push(t('prov.starving', { name: nomDe(c) }));
    else {
      damage = Math.max(1, d10(rng) - be); // 1d10 Dégâts, ignore les PA, min 1 (LDB 18 l.342)
      log.push(t('prov.wasting', { name: nomDe(c), dmg: damage }));
    }
  } // réussite : aucune conséquence (le jet a déjà été montré dans l'étape — pas de bruit de journal)
  c.hunger = h;
  return { log, damage };
}

/**
/** Source des vivres d'un repas : prend `besoin` rations et rend le vivre qui a nourri (`RepasDuJour`), ou `null`
 *  sans rien prendre s'il n'y en a pas assez. */
export type GardeManger = (besoin: number) => RepasDuJour | null;

/** Le sac du héros : ses objets `isRations`, dans l'ordre de l'inventaire. LDB 66 l.20 */
export function rationsDuSac(c: Combatant): GardeManger {
  return (besoin) => {
    const idxs: number[] = [];
    (c.items ?? []).forEach((it, i) => { if (idxs.length < besoin && isRation(it)) idxs.push(i); });
    if (idxs.length < besoin) return null;
    const vivres = new Set(idxs.map((i) => c.items![i].trappingId));
    const [seul] = vivres;
    for (const i of [...idxs].reverse()) c.items!.splice(i, 1);
    return vivres.size === 1 && seul !== undefined ? seul as Id<'trapping'> : undefined;
  };
}

/**
 * `dailyFoodUpkeep` : mange sur `gardeManger` (ou couvre la journée), sinon installe la faim. `deferTest`
 * (cascade de nuit) : si un Test de Faim TOMBE ce jour, on NE le roule PAS — on appelle `deferTest`
 * avec la pénalité cumulative (−10 × Tests déjà tentés, LDB 18 l.338) pour qu'il devienne une ÉTAPE
 * influençable (résolue par `applyFaimTest`). Sans `deferTest` (contextes eager), le jet est roulé ici.
 */
export function dailyFoodUpkeep(c: Combatant, gardeManger: GardeManger, resVal: number, be: number, rng: RNG, deferTest?: UpkeepDeferTest): FoodUpkeepResult {
  const res: FoodUpkeepResult = { ate: false, rationConsumed: false, damage: 0, log: [] };
  if (c.dead) return res;
  // Sustentation magique (Graisse de la terre, LDB 48 : « n'a pas besoin de manger ou de boire ») :
  // la Faim est suspendue — pas de ration consommée, compteurs purgés, tant que l'effet dure.
  if (hasActiveFlag(c, 'noHunger')) {
    res.ate = true;
    c.hunger = undefined;
    noterLeRepas(c, undefined);
    return res;
  }
  const brouet = hasBrouet(c);
  const h: HungerState = c.hunger ?? { days: 0, tests: 0, failures: 0 };

  // 1. Manger : journée déjà couverte (demi-ration de Brouet, repas d'auberge), sinon `traitConsumptionFactor`
  // ration(s) (ogre ADE II 2 l.755 : « les ogres doivent manger … au moins deux fois plus » — 2 rations/jour).
  let repas: RepasDuJour;
  if (h.coveredDay) {
    res.ate = true;
    repas = h.coveredDay === true ? 'repas' : h.coveredDay.repas;
  } else {
    const pris = gardeManger(traitConsumptionFactor(c));
    if (pris !== null) {
      repas = pris;
      res.ate = true;
      res.rationConsumed = true;
    }
  }
  noterLeRepas(c, repas);

  if (res.ate) {
    if (h.days > 0 || h.failures > 0) res.log.push(t('prov.fedAgain', { name: nomDe(c) }));
    // Brouet : demi-ration → le jour suivant est couvert (LDB 10 l.139). Sinon, plus d'état de faim.
    c.hunger = brouet && res.rationConsumed ? { days: 0, tests: 0, failures: 0, coveredDay: { repas } } : undefined;
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
    const t2 = rollTest({ porteur: c.id, teste: { skill: RESISTANCE_TEST.skill } }, resVal, 'intermediaire', rng, penalty);
    h.tests += 1;
    // Test résolu SANS fenêtre (entretien du jour) : sa ligne se DÉRIVE (`traceLineOf`).
    res.log.push(traceLineOf({
      who: nomDe(c), label: t('prov.testLabel', { kind: t('prov.faim'), skill: refLabel('skills', RESISTANCE_TEST.skill), malus: h.tests > 1 ? t('prov.fragTestMalus', { n: (h.tests - 1) * 10 }) : '' }),
      roll: t2.roll, target: t2.target, sl: t2.sl, success: t2.success, issue: t2.success ? t('prov.holdsOn') : t('prov.fail'),
    }));
    if (!t2.success) {
      h.failures += 1;
      if (h.failures === 1) {
        res.log.push(t('prov.starving', { name: nomDe(c) }));
      } else {
        res.damage = Math.max(1, d10(rng) - be); // 1d10 Dégâts, ignore les PA, min 1 (LDB 18 l.342)
        res.log.push(t('prov.wasting', { name: nomDe(c), dmg: res.damage }));
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
export function applySoifTest(c: Combatant, success: boolean, be: number, rng: RNG): { log: string[]; damage: number } {
  const s: ThirstState = c.thirst ?? { days: 0, tests: 0, failures: 0 };
  s.tests += 1;
  const log: string[] = [];
  let damage = 0;
  if (!success) {
    s.failures += 1;
    if (s.failures === 1) log.push(t('prov.parched', { name: nomDe(c) }));
    else {
      damage = Math.max(1, d10(rng) - be); // 1d10 Dégâts, ignore les PA, min 1 (LDB 18 l.340)
      log.push(t('prov.dehydrating', { name: nomDe(c), dmg: damage }));
    }
  }
  c.thirst = s;
  return { log, damage };
}

/**
 * Entretien QUOTIDIEN d'eau d'UN personnage (LDB 18 l.340). `hasWater` = l'accès à l'eau ce jour, décidé par
 * l'appelant (Reikland : toujours vrai sauf règle `penurie-d-eau` ; mer : `vessel.waterLitres` > 0).
 * A de l'eau → boit, la soif se dissipe. Sinon : Test QUOTIDIEN (LDB 18 l.340), de plus en plus dur (−10 ×
 * Tests, LDB 18 l.338). `deferTest` : le Test devient une ÉTAPE de cascade (résolu par `applySoifTest`).
 * Mute `c.thirst`. `resVal`/`be` passés par l'appelant (cycle d'import, cf. en-tête).
 */
export function dailyWaterUpkeep(c: Combatant, hasWater: boolean, resVal: number, be: number, rng: RNG, deferTest?: UpkeepDeferTest): WaterUpkeepResult {
  const res: WaterUpkeepResult = { drank: false, damage: 0, log: [] };
  if (c.dead) return res;
  // Sustentation magique (Graisse de la terre, LDB 48 : « n'a pas besoin de manger ou de BOIRE ») :
  // la Soif est suspendue au même titre que la Faim (drapeau `noHunger`), compteurs purgés.
  if (hasWater || hasActiveFlag(c, 'noHunger')) {
    res.drank = true;
    if (c.thirst && (c.thirst.days > 0 || c.thirst.failures > 0)) res.log.push(t('prov.quenched', { name: nomDe(c) }));
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
  const t2 = rollTest({ porteur: c.id, teste: { skill: RESISTANCE_TEST.skill } }, resVal, 'intermediaire', rng, penalty);
  s.tests += 1;
  res.log.push(traceLineOf({
    who: nomDe(c), label: t('prov.testLabel', { kind: t('prov.soif'), skill: refLabel('skills', RESISTANCE_TEST.skill), malus: s.tests > 1 ? t('prov.fragTestMalus', { n: (s.tests - 1) * 10 }) : '' }),
    roll: t2.roll, target: t2.target, sl: t2.sl, success: t2.success, issue: t2.success ? t('prov.holdsOn') : t('prov.fail'),
  }));
  if (!t2.success) {
    s.failures += 1;
    if (s.failures === 1) res.log.push(t('prov.parched', { name: nomDe(c) }));
    else {
      res.damage = Math.max(1, d10(rng) - be); // 1d10 Dégâts, ignore les PA, min 1 (LDB 18 l.340)
      res.log.push(t('prov.dehydrating', { name: nomDe(c), dmg: res.damage }));
    }
  }
  c.thirst = s;
  return res;
}

/** Contenance d'un tonneau d'eau douce, en litres. MDG 14 l.242 */
export const LITRES_PAR_TONNEAU = 145;

/** Un lot de la cale : `rations` jours-homme d'un vivre (`sea-navigation.json` `longsVoyages.vivresDeCale`)
 *  embarqués à la minute `entre` (`gameTime`). MDG 14 l.238, l.245-252, l.263 */
export interface LotDeVivres { vivre: Id<'trapping'>; entre: number; rations: number }

/** Quantités de vivres demandées, en jours-homme par vivre (commande d'avitaillement). MDG 14 l.248-252 */
export type QuantitesDeVivres = Partial<Record<Id<'trapping'>, number>>;

/** Total des rations (jours-homme) de la cale, tous vivres et lots confondus. */
export function rationsDeCale(lots: readonly LotDeVivres[] | undefined): number {
  return (lots ?? []).reduce((s, l) => s + l.rations, 0);
}

/** Rations (jours-homme) de la cale d'un seul vivre, tous lots confondus. */
export function rationsDuVivre(lots: readonly LotDeVivres[] | undefined, vivre: Id<'trapping'>): number {
  return rationsDeCale((lots ?? []).filter((l) => l.vivre === vivre));
}

/** Le vivre pourrit-il (il n'est pas une ration `isRations` prévue pour tenir en mer) ? MDG 14 l.238, l.263 */
export function vivrePerissable(vivre: Id<'trapping'>): boolean {
  return !itemCapability(garanti(findTrappingById(vivre), vivre, 'vivre de la cale'), 'isRations');
}

/** Le lot a-t-il pourri à la minute `now` : vivre périssable embarqué depuis la durée de la règle
 *  `mer-vivres-frais-peremption-jours` (maison). MDG 14 l.238 ; LDB 47 l.93-97 */
export function lotPerime(lot: LotDeVivres, now: number): boolean {
  return vivrePerissable(lot.vivre) && dayIndex(now) - dayIndex(lot.entre) >= rule('mer-vivres-frais-peremption-jours');
}

/** Embarque `rations` jours-homme de `vivre` à la minute `now` : le lot rejoint celui du même vivre embarqué le même jour. */
export function embarquerDesVivres(lots: readonly LotDeVivres[], vivre: Id<'trapping'>, rations: number, now: number): LotDeVivres[] {
  if (rations <= 0) return [...lots];
  const i = lots.findIndex((l) => l.vivre === vivre && dayIndex(l.entre) === dayIndex(now));
  if (i < 0) return [...lots, { vivre, entre: now, rations }];
  return lots.map((l, j) => j === i ? { ...l, rations: l.rations + rations } : l);
}

/** Retire `n` jours-homme de `vivre`, du lot le plus vieux au plus jeune ; un lot vidé sort de la cale. */
export function retirerDuVivre(lots: readonly LotDeVivres[], vivre: Id<'trapping'>, n: number): LotDeVivres[] {
  let reste = Math.max(0, n);
  const pris = new Map<LotDeVivres, number>();
  for (const l of [...lots].filter((x) => x.vivre === vivre).sort((a, b) => a.entre - b.entre)) {
    const m = Math.min(reste, l.rations);
    pris.set(l, m);
    reste -= m;
  }
  return lots.map((l) => ({ ...l, rations: l.rations - (pris.get(l) ?? 0) })).filter((l) => l.rations > 0);
}

/** Ce que des bouches ont mangé de la cale (`mangerLaCale`) : lots restants, jours-homme manquants, et le repas de
 *  chaque jour, dans l'ordre (`RepasDuJour` : le vivre qui a nourri seul toutes les bouches, absent si mêlé ou à court). */
export interface RepasDeLaCale { lots: LotDeVivres[]; manque: number; repas: (Id<'trapping'> | undefined)[] }

/** Le repas qui fait le jour d'un porteur : le vivre qui l'a nourri en entier, `'repas'` pour un repas pris
 *  (auberge, hôte : `feedFromMeal`), absent s'il n'a pas mangé ou a mêlé plusieurs vivres. */
export type RepasDuJour = Id<'trapping'> | 'repas' | undefined;

/** Écrit le régime de bord d'un porteur pour UN jour où il a mangé `repas` : un vivre frais remet le mois à zéro, sinon
 *  un jour de plus sans frais, et de soupe si le vivre porte `scurvyGuard`. Le porteur d'une maladie à `dureeAuFrais`
 *  acquiert un jour de vivre frais à décompter (`minutesAuFrais`, consommé par `avancerLesMaladies`) ; sans elle, il
 *  n'en garde aucun. Geste unique des deux mangeurs, `dailyFoodUpkeep` (PJ, au sac ou à la cale) et
 *  `consumeCrewProvisions` (équipage). MDG 14 l.230-232 */
export function noterLeRepas(p: Pick<PorteurDeMaladies, 'regimeDeBord' | 'diseases'>, repas: RepasDuJour): void {
  const frais = repas === 'repas' || (repas !== undefined && vivrePerissable(repas));
  const soupe = !frais && repas !== undefined && itemCapability(garanti(findTrappingById(repas), repas, 'vivre mangé'), 'scurvyGuard');
  const r = p.regimeDeBord;
  const auFrais = (p.diseases ?? []).some((d) => findDiseaseById(d.id)?.dureeAuFrais)
    ? (r?.minutesAuFrais ?? 0) + (frais ? MINUTES_PER_DAY : 0)
    : 0;
  p.regimeDeBord = {
    joursSansVivreFrais: frais ? 0 : (r?.joursSansVivreFrais ?? 0) + 1,
    joursDeSoupe: frais ? 0 : (r?.joursDeSoupe ?? 0) + (soupe ? 1 : 0),
    ...(auFrais ? { minutesAuFrais: auFrais } : {}),
  };
}

/** `bouches` rations par jour pendant `jours` jours depuis la minute `now` : chaque jour, vivre après vivre dans
 *  l'ordre de `VIVRES_DE_CALE.vivres`, du lot le plus vieux au plus jeune, sans toucher un lot pourri ce
 *  jour-là (`lotPerime`). PUR. MDG 14 l.166, l.171, l.238, l.263 */
export function mangerLaCale(lots: readonly LotDeVivres[], bouches: number, jours: number, now: number): RepasDeLaCale {
  const rang = (l: LotDeVivres) => VIVRES_DE_CALE.vivres.indexOf(l.vivre);
  const cale = [...lots].sort((a, b) => rang(a) - rang(b) || a.entre - b.entre).map((l) => ({ ...l }));
  let manque = 0;
  const repas: RepasDeLaCale['repas'] = [];
  for (let k = 0; k < jours; k++) {
    const jour = now + k * MINUTES_PER_DAY;
    let reste = bouches;
    const manges = new Set<Id<'trapping'>>();
    for (const l of cale) {
      if (reste === 0) break;
      if (l.rations === 0 || lotPerime(l, jour)) continue;
      const m = Math.min(reste, l.rations);
      l.rations -= m;
      reste -= m;
      manges.add(l.vivre);
    }
    manque += reste;
    repas.push(reste === 0 && manges.size === 1 ? [...manges][0] : undefined);
  }
  return { lots: cale.filter((l) => l.rations > 0), manque, repas };
}

/** La cale du navire comme garde-manger d'une bouche, le jour de la minute `now` (`mangerLaCale`) : chaque repas
 *  remplace `cale.lots` par les lots restants. MDG 14 l.238, l.263 */
export function rationsDeLaCale(cale: { lots: LotDeVivres[] }, now: number): GardeManger {
  return (besoin) => {
    const r = mangerLaCale(cale.lots, besoin, 1, now);
    if (r.manque > 0) return null;
    cale.lots = r.lots;
    return r.repas[0];
  };
}
