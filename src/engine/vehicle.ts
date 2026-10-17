/**
 * Véhicule-à-coque comme `Combatant` (le cœur du modèle unifié terre/fleuve/mer).
 *
 * Un véhicule (`vehicles.json`, facette `hull`) devient une entité À PV : il encaisse des Dégâts
 * exactement comme une créature (langue UNIQUE `GameOp`/`applyOps`). Les montures restent, elles, des
 * créatures (`creatures.json`) ; ce module ne couvre que les coques inertes (chariots, barges, navires).
 *
 * Problème de véhicule : EDOC 7 l.266-286. Tables de Localisation/Critiques de la coque
 * (`hull.locationTable`/`criticalTable`) : lues par `./shipCritical`.
 *
 * Deux formes de retour cohabitent dans ce module : les résolveurs rendent une STRUCTURE nue
 * (`forcedPaceCheck`, `forcedPaceBeastCheck`, `repairVehicleAttempt` — aucun texte), tandis
 * qu'`applyVehicleProblem` rend en plus des `lines`. Ces `lines` sont le rendu d'`applyOps` : une
 * couture d'AFFICHAGE qui traverse le moteur, jamais un second canal de résolution.
 */
import { Combatant, VehicleData, type Difficulty } from './types';
import { RNG, defaultRNG, parseDice, d10 } from './dice';
import { applyOps } from './ops';
import { inanimateCombatant } from './inanimate';
import { rollVehicleProblem, type TravelTableEntry } from './travelTables';
import { rollTest, isImpressiveFailure, isAstoundingFailure, type TestResult } from './tests';
import { COND } from './conditions';

/** Adaptateur de `inanimateCombatant` (builder UNIQUE des objets inanimés) pour une coque de véhicule
 *  depuis sa facette `hull` (Endurance + Blessures). `undefined` si le véhicule n'a pas de profil de coque
 *  (transports sans entité à PV). */
export function vehicleCombatant(v: VehicleData, id = `vehicle-${v.id}`): Combatant | undefined {
  if (!v.hull) return undefined;
  return inanimateCombatant({
    id,
    label: v.label,
    refId: v.id,
    bodyShape: v.hull.bodyShape, // 'vehicule' — Tableau de Localisation de coque (data-driven, dalle 2-3)
    hull: { e: v.hull.char.endurance, woundsB: v.hull.char.B },
    footprint: v.ship?.footprint, // EMPREINTE de grille (côté N×N) autorée — découplée de la Taille créature
  });
}

export interface VehicleProblemResult {
  entry: TravelTableEntry;
  lines: string[];
}

/** Tire un Problème de véhicule (d100) et APPLIQUE ses Dégâts à la coque (`applyOps`), si la cellule en
 *  porte (`vehicleWounds`, ex. « 1d10 »/« 2d10 »). RAW : modifiés par le Bonus d'Endurance, minimum 1. */
export function applyVehicleProblem(vehicle: Combatant, roll: number, rng: RNG = defaultRNG): VehicleProblemResult {
  const entry = rollVehicleProblem(roll);
  const lines = [`Problème de véhicule — ${entry.label}.`];
  if (entry.vehicleWounds) {
    const dice = parseDice(entry.vehicleWounds);
    if (dice) lines.push(...applyOps(vehicle, [{ op: 'wounds', amount: { dice }, ignoreTB: false, ignoreAP: true, min: 1 }], { rng }));
  }
  return { entry, lines };
}

// ── RÉPARATION DES VÉHICULES (EDOC 07 l.349-355) ──────────────────────────────────────

export interface VehicleRepairParams {
  /** Valeur TESTÉE de la Compétence Métier employée (résolue par l'appelant, `skills.testValue`). */
  valeurMetier: number;
  /** Points de Dégâts actuellement subis par la coque — plafond de ce qu'une passe peut restaurer. */
  degatsSubis: number;
  /** Trois conditions matérielles de EDOC 07 l.351, FAITS fournis par l'appelant (le moteur ne les déduit pas). */
  materiaux: boolean;
  outils: boolean;
  installations: boolean;
  difficulty?: Difficulty;
  rng?: RNG;
}

export interface VehicleRepairResult {
  /** Les trois conditions de EDOC 07 l.351 sont-elles réunies ? Sinon aucun jet n'est lancé. */
  possible: boolean;
  test?: TestResult;
  /** Points de Dégâts rendus à la coque (EDOC 07 l.353), bornés par `degatsSubis`. */
  restaure: number;
  /** Heures consommées par la TENTATIVE, réussie ou non — arbitrage MAISON (cf. `repairVehicleAttempt`). */
  heures: number;
  degatsRestants: number;
}

/**
 * Une passe de réparation terrestre — EDOC 07 l.349-353 : « Chaque réparation prend une heure et
 * restaure (1d10 + DR) points de Dégâts. » Le résolveur est PUR : il ne mute pas la coque, il rend les
 * points à rendre ; c'est l'appelant qui les pose (`applyOps`, op `heal`).
 *
 * L'heure est facturée à la TENTATIVE, échec compris — arbitrage MAISON (CLAUDE.md règle 7) : le
 * passage emploie « tenter des réparations » et « chaque réparation » pour le même geste, il ne
 * tranche pas le coût d'un jet raté ; l'attacher au seul succès rendrait la réessai gratuite et
 * illimitée, ce qui invente autant. L'absence des trois conditions matérielles (l.351), elle, ne
 * coûte rien : aucun jet n'est lancé.
 */
export function repairVehicleAttempt(p: VehicleRepairParams): VehicleRepairResult {
  if (!p.materiaux || !p.outils || !p.installations) {
    return { possible: false, restaure: 0, heures: 0, degatsRestants: p.degatsSubis };
  }
  const test = rollTest(p.valeurMetier, p.difficulty ?? 'intermediaire', p.rng ?? defaultRNG);
  const restaure = test.success ? Math.min(p.degatsSubis, d10(p.rng ?? defaultRNG) + test.sl) : 0;
  return { possible: true, test, restaure, heures: 1, degatsRestants: p.degatsSubis - restaure };
}

// ── COURSE FORCÉE D'UN ATTELAGE (EDOC 07 l.229, l.253) ────────────────────────────────

/** Pénalité cumulative au Test de Conduite d'attelage, par kilomètre déjà parcouru au pas de course
 *  (EDOC 07 l.229). */
export const FORCED_PACE_PENALTY_PER_KM = -10;

export interface ForcedPaceAnimal {
  /** Valeur TESTÉE de Résistance de la bête. */
  valeurResistance: number;
  /** Bonus d'Endurance de la bête, réducteur des Blessures de EDOC 07 l.253. */
  be?: number;
}

export interface ForcedPaceAnimalOutcome {
  resistance: TestResult;
  /** États octroyés, par id STABLE (`COND.extenue`) — un élément par pion. */
  etats: string[];
  /** Blessures à infliger à la bête (EDOC 07 l.253), 0 hors Échec Stupéfiant. */
  blessures: number;
}

export interface ForcedPaceResult {
  conduite: TestResult;
  /** Modificateur appliqué au Test de Conduite d'attelage (cumul des kilomètres déjà courus). */
  modificateur: number;
  /** Échec du conducteur : les bêtes repassent au pas (EDOC 07 l.229). */
  retourAuPas: boolean;
  /** Vide tant que le conducteur réussit — les bêtes ne sont éprouvées qu'à son échec. */
  animaux: ForcedPaceAnimalOutcome[];
}

/**
 * Modificateur du Test de Conduite d'attelage au kilomètre courant — EDOC 07 l.229 : « une pénalité de
 * -10 par kilomètre déjà parcouru au pas de course ». SOURCE UNIQUE : toute surface qui annonce ou qui
 * roule ce Test passe par ici (sans la branche à zéro, le premier kilomètre rendrait `-0`).
 */
export function forcedPaceModifier(kmDejaCourus = 0): number {
  return kmDejaCourus === 0 ? 0 : kmDejaCourus * FORCED_PACE_PENALTY_PER_KM;
}

/**
 * Le Test de Résistance d'UNE bête de l'attelage, une fois le conducteur en échec — EDOC 07 l.229 :
 * « chacun doit réussir un Test de Résistance Intermédiaire (+0) ou acquérir un État *Exténué* », et
 * EDOC 07 l.253 : « Un Échec Impressionnant ou pire sur n'importe quel Test de Résistance d'un animal
 * impose un État *Exténué* supplémentaire, et un Échec Stupéfiant coûte à la bête 1d10 Blessures en
 * plus (modifié par le Bonus d'Endurance, avec un minimum de 1). »
 *
 * SOURCE UNIQUE du jet de bête : les deux surfaces du voyage (repli synchrone et cascade joueur)
 * l'appellent, aucune ne rejoue le `rollTest` à la main. PUR : RNG injecté, aucun État posé (les ids
 * sont RENDUS, l'appelant les applique).
 */
export function forcedPaceBeastCheck(a: ForcedPaceAnimal, rng: RNG = defaultRNG): ForcedPaceAnimalOutcome {
  const resistance = rollTest(a.valeurResistance, 'intermediaire', rng);
  const etats: string[] = [];
  if (!resistance.success) etats.push(COND.extenue);
  if (isImpressiveFailure(resistance.success, resistance.sl)) etats.push(COND.extenue);
  const blessures = isAstoundingFailure(resistance.success, resistance.sl)
    ? Math.max(1, d10(rng) - (a.be ?? 0))
    : 0;
  return { resistance, etats, blessures };
}

/**
 * Le kilomètre suivant au pas de course — EDOC 07 l.229 : « Le conducteur doit effectuer un Test de
 * **Conduite d'attelage Intermédiaire (+0)** tous les kilomètres, avec une pénalité de -10 par
 * kilomètre déjà parcouru au pas de course. En cas d'échec, les animaux repasseront au pas, et chacun
 * doit réussir un Test de **Résistance Intermédiaire (+0)** ou acquérir un État *Exténué*. »
 * L'aggravation de l.253 vient de `forcedPaceBeastCheck`. PUR : RNG injecté, aucun État posé.
 */
export function forcedPaceCheck(p: {
  valeurConduite: number;
  /** Kilomètres DÉJÀ parcourus au pas de course avant celui-ci. */
  kmDejaCourus?: number;
  animaux: ForcedPaceAnimal[];
  rng?: RNG;
}): ForcedPaceResult {
  const rng = p.rng ?? defaultRNG;
  const modificateur = forcedPaceModifier(p.kmDejaCourus);
  const conduite = rollTest(p.valeurConduite, 'intermediaire', rng, modificateur);
  if (conduite.success) return { conduite, modificateur, retourAuPas: false, animaux: [] };
  return { conduite, modificateur, retourAuPas: true, animaux: p.animaux.map((a) => forcedPaceBeastCheck(a, rng)) };
}
