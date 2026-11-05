/**
 * LES RÉGLAGES D'UN JET EN ATTENTE (#3368) : ce qu'une fenêtre de jet règle avant ou après son dé, sans le tirer —
 * l'arme, la localisation visée, la réaction, la surincantation… Un réglage se joue par un seul verbe,
 * `jetRegler(flux, reglage, valeur[, pid])` (`VerbeDeReglage`) : `ReglagesDuJet` déclare, par flux, chaque réglage et
 * la FORME de sa valeur (une valeur absolue, jamais un incrément ni une bascule), `REGLAGES_DU_JET` sa phase et sa
 * portée. Module feuille : types importés seulement, une table de données ; le générateur des verbes
 * (`scripts/docs/lib/verbesDeLaPartie.mjs`) lit `ReglagesDuJet` comme `ActionsDuNoyau`, et les hôtes du noyau
 * contrôlent la valeur contre sa forme (`REGLAGES`, `src/hote/verbes.generated.ts`). Le corps de chaque réglage vit
 * chez son flux (`CorpsDesReglages`, `fabriquesDuNoyau.ts`).
 */
import type { HitLocation } from '../engine/types';
import type { NatureDInfluence } from '../data/schemas/grammaire/valeurs';
import type { HealMode, TestDeSoin } from '../engine/healing';
import type { DefenseMode } from '../engine/combat';
import type { OvercastAxis } from '../engine/overcast';
import type { FermetureDuJet } from './rollFlowFactory';
import type { Jeu } from './etat';
import type { IdDeChanson, IdDeCombattant, IdDeFormeConjuree, IdDeHeros, IdDObjet } from './designations';

/** Le verbe qui règle un jet (`ActionsDuNoyau.jetRegler`). */
export const VERBE_DE_REGLAGE = 'jetRegler' as const satisfies keyof VerbeDeReglage;

/** Les réglages de chaque flux de jet qui en a, et la forme de leur valeur. */
export interface ReglagesDuJet {
  attack: {
    /** `null` : au hasard. */
    localisation: HitLocation | null;
    /** LDB 17 l.68 */
    localisationDuCritique: HitLocation;
    /** `null` : l'arme par défaut du loadout actif. */
    arme: IdDObjet | null;
    /** LDB 10 l.767-773 */
    deuxArmes: boolean;
    /** AA 07 l.59-61 */
    retenirSesCoups: boolean;
    /** ADE II 02 l.677 */
    sansLaCorde: boolean;
    /** LDB 14 l.159 */
    empoigner: boolean;
  };
  defense: {
    /** LDB 13 l.123 ; LDB 09 l.207, l.287 */
    reaction: DefenseMode;
    /** `null` : la main principale. */
    armeDeParade: IdDObjet | null;
    /** AA 13 l.84 ; `null` : aucune. */
    porteBouclier: 'damage' | 'push' | null;
    /** LDB 10 l.1037 */
    riposte: boolean;
  };
  cast: {
    /** LDB 46 l.26-32 */
    effetCritique: 'critique' | 'puissance' | 'ineluctable';
    /** LDB 47 */
    formeConjuree: IdDeFormeConjuree;
    /** LDB 40 l.42 */
    discret: boolean;
    /** EDOC 13 l.276 */
    jetsDeTable: number;
    /** Les pas alloués à chaque axe de la Surincantation (`REGLAGE_DE_L_AXE`). LDB 47 l.15-17 ; LDB 41 l.21-27 ; VDM 02 l.201-215 */
    surincantationPortee: number;
    surincantationZone: number;
    surincantationDuree: number;
    surincantationCibles: number;
    surincantationDegats: number;
    /** LDB 47 */
    ciblesSupplementaires: readonly IdDeCombattant[];
  };
  heal: {
    mode: HealMode;
    /** LDB 74 l.41 */
    test: TestDeSoin;
    /** LDB 74 l.41 ; `null` : sans Bandages. */
    bandages: IdDeHeros | null;
  };
  corruption: {
    /** LDB 19 l.29 */
    nature: NatureDInfluence;
  };
  shanty: {
    /** MDG 09 l.32-40 */
    chanson: IdDeChanson;
  };
  maneuver: {
    /** LDB 85 l.290 */
    avantage: number;
  };
  battement: {
    /** LDB 10 l.103 */
    adversaire: IdDeCombattant;
  };
  distraire: {
    /** LDB 10 l.364 */
    adversaire: IdDeCombattant;
  };
  test: {
    testeur: IdDeCombattant;
  };
  shipManeuver: {
    /** MDG 13 ; crans d'octant. */
    virage: number;
  };
  forceDoor: {
    /** EDO 11 l.93 ; `null` : à mains nues. */
    arme: IdDObjet | null;
  };
}

/** Un flux de jet qui a des réglages. */
export type FluxRegle = keyof ReglagesDuJet;
/** Un réglage du flux `F`. */
export type ReglageDu<F extends FluxRegle> = keyof ReglagesDuJet[F] & string;
/** Un réglage de n'importe quel flux. */
export type ReglageDuJet = { [F in FluxRegle]: ReglageDu<F> }[FluxRegle];

/** Quand un réglage se joue : avant le dé du jet (`avantLeJet`), une fois le dé tombé (`apresLeJet`), ou tant que la
 *  fenêtre est ouverte, le dé n'y changeant rien (`horsDuJet`). */
export type PhaseDuReglage = 'avantLeJet' | 'apresLeJet' | 'horsDuJet';

/** Ce qu'un réglage règle : la fenêtre entière, ou une rangée d'un flux à plusieurs jets, désignée par le `pid`. */
export type PorteeDuReglage = 'fenetre' | 'rangee';

/** La déclaration d'un réglage : sa phase, sa portée, et, quand son siège n'est pas le porteur du jet, le combattant
 *  dont le siège le joue, lu sur la valeur (`porteurDeLaValeur`, `netOwnership`). */
export interface DeclarationDuReglage {
  phase: PhaseDuReglage;
  portee: PorteeDuReglage;
  porteurDeLaValeur?: (s: Pick<Jeu, 'pendingHeal'>, valeur: unknown) => string | undefined;
}

const avant = { phase: 'avantLeJet', portee: 'fenetre' } as const;
const apres = { phase: 'apresLeJet', portee: 'fenetre' } as const;

/** La déclaration de chaque réglage, table TOTALE sur `ReglagesDuJet`. */
export const REGLAGES_DU_JET = {
  attack: { localisation: avant, localisationDuCritique: apres, arme: avant, deuxArmes: avant, retenirSesCoups: avant, sansLaCorde: avant, empoigner: avant },
  defense: { reaction: avant, armeDeParade: avant, porteBouclier: avant, riposte: avant },
  cast: {
    effetCritique: apres, formeConjuree: avant, discret: avant, jetsDeTable: apres,
    surincantationPortee: apres, surincantationZone: apres, surincantationDuree: apres, surincantationCibles: apres, surincantationDegats: apres,
    ciblesSupplementaires: apres,
  },
  heal: {
    mode: avant, test: avant,
    // LDB 74 l.41 ; `user-arbitrage-coop-inventaire-par-proprietaire-bg3`
    bandages: { ...avant, porteurDeLaValeur: (s, valeur) => (typeof valeur === 'string' ? valeur : s.pendingHeal?.bandagesDe ?? undefined) },
  },
  corruption: { nature: avant },
  shanty: { chanson: avant },
  maneuver: { avantage: avant },
  battement: { adversaire: avant },
  distraire: { adversaire: avant },
  test: { testeur: avant },
  shipManeuver: { virage: { phase: 'horsDuJet', portee: 'fenetre' } },
  forceDoor: { arme: { phase: 'avantLeJet', portee: 'rangee' } },
} as const satisfies { [F in FluxRegle]: { [K in ReglageDu<F>]: DeclarationDuReglage } };

/** Le réglage de la Surincantation de chaque axe. */
export const REGLAGE_DE_L_AXE = {
  range: 'surincantationPortee', zone: 'surincantationZone', duration: 'surincantationDuree', targets: 'surincantationCibles', damage: 'surincantationDegats',
} as const satisfies Record<OvercastAxis, ReglageDu<'cast'>>;

/** Le flux `flux` (une donnée de frontière) a-t-il des réglages ? */
export const estFluxRegle = (flux: unknown): flux is FluxRegle => typeof flux === 'string' && Object.prototype.hasOwnProperty.call(REGLAGES_DU_JET, flux);

/** La déclaration du réglage `reglage` du flux `flux`, deux données de frontière ; `null` : le flux ne le déclare pas. */
export function declarationDuReglage(flux: unknown, reglage: unknown): DeclarationDuReglage | null {
  if (!estFluxRegle(flux) || typeof reglage !== 'string') return null;
  const table: Readonly<Record<string, DeclarationDuReglage>> = REGLAGES_DU_JET[flux];
  return Object.prototype.hasOwnProperty.call(table, reglage) ? table[reglage] : null;
}

/** Les réglages du flux `flux`, dans leur ordre de déclaration ; aucun pour un flux qui n'en a pas. */
export const reglagesDuFlux = (flux: string): readonly ReglageDuJet[] => (estFluxRegle(flux) ? Object.keys(REGLAGES_DU_JET[flux]) as ReglageDuJet[] : []);

/** Ce qui ferme maintenant un réglage de phase `phase`, d'après ce qui ferme le lancer de son jet (`roll`, `null` :
 *  le dé reste à lancer) ; `null` : il se joue. */
export function fermetureDeLaPhase(phase: PhaseDuReglage, roll: FermetureDuJet | null): FermetureDuJet | null {
  if (roll === 'sansJet') return roll;
  if (phase === 'avantLeJet') return roll;
  if (phase === 'apresLeJet') return roll === 'jetLance' ? null : 'jetNonLance';
  return null;
}

/** Le verbe qui règle un jet : le réglage `reglage` du flux `flux` prend la valeur `valeur`, sur la rangée `pid` d'un
 *  réglage de rangée. */
export interface VerbeDeReglage {
  jetRegler: (...args: ArgumentsDuReglage) => void;
}

/** Les arguments du verbe, union corrélée sur chaque réglage : la valeur suit son réglage jusque dans une intention
 *  (`Parameters<ActionsDuNoyau['jetRegler']>`). */
export type ArgumentsDuReglage = {
  [F in FluxRegle]: { [K in ReglageDu<F>]: [flux: F, reglage: K, valeur: ReglagesDuJet[F][K], pid?: string] }[ReglageDu<F>];
}[FluxRegle];

/** Le corps de chaque réglage, table TOTALE sur `ReglagesDuJet` : il reçoit la valeur, et la rangée d'un réglage de
 *  rangée. Le verbe ne l'appelle que dans sa phase (`fermetureDeLaPhase`). */
export type CorpsDesReglages = { readonly [F in FluxRegle]: { readonly [K in ReglageDu<F>]: (valeur: ReglagesDuJet[F][K], pid?: string) => void } };

/** Les cibles supplémentaires `courantes`, `id` retirée si elle y est, ajoutée sinon : la liste que règle un clic de
 *  désignation (la carte, la fenêtre hors combat). */
export const ciblesBasculees = (courantes: readonly string[] | undefined, id: string): string[] =>
  ((courantes ?? []).includes(id) ? (courantes ?? []).filter((x) => x !== id) : [...(courantes ?? []), id]);
