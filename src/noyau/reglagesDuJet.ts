/**
 * LES RÉGLAGES D'UN JET EN ATTENTE (#3368) : ce qu'une fenêtre de jet règle avant ou après son dé, sans le tirer —
 * l'arme, la localisation visée, la réaction, la surincantation… Un réglage se joue par un seul verbe,
 * `jetRegler(flux, reglage, valeur[, pid])` (`VerbeDeReglage`) : `ReglagesDuJet` déclare, par flux, chaque réglage et
 * la FORME de sa valeur (une valeur absolue, jamais un incrément ni une bascule), `REGLAGES_DU_JET` sa phase, sa
 * portée et, pour l'incantation, son offre (`offreDeLIncantation`). Le générateur des verbes
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
import type { FlowKey } from './flowVerbs';
import type { Jeu } from './etat';
import type { CounterDeclaration, IssueDEmpoignade, ReactionDeBouclier } from './pendings';
import type {
  IdDAdversaireADistraire,
  IdDAdversaireDuBattement,
  IdDeChanson,
  IdDeCombattant,
  IdDeFormeConjuree,
  IdDeHeros,
  IdDeRangee,
  IdDObjet,
  IdDOptionDEtape,
} from './designations';
import { offreDeLIncantation, type ReglageOffertDeLIncantation } from './reglagesDIncantation';
import { sequenceAbandonOf } from './sequenceCore';

/** Le verbe qui règle un jet (`ActionsDuNoyau.jetRegler`). */
export const VERBE_DE_REGLAGE = 'jetRegler' as const satisfies keyof VerbeDeReglage;

/** Les réglages de chaque flux de jet qui en a, et la forme de leur valeur. */
export interface ReglagesDuJet {
  attaque: {
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
    porteBouclier: ReactionDeBouclier | null;
    /** LDB 10 l.1037 */
    riposte: boolean;
  };
  incantation: {
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
    /** Ce que la carte tient à la place de la fenêtre : la désignation des cibles supplémentaires (LDB 47), la pose de
     *  la zone ; `null` : la fenêtre. */
    carte: 'cibles' | 'zone' | null;
  };
  cascade: {
    /** L'abandon de la séquence en cours (`SequenceDef.abandon`). */
    abandon: true;
    /** La clé de l'option retenue à l'étape « choix » courante (`CascadeStep.options`). */
    choix: IdDOptionDEtape;
    /** Le nombre saisi à l'étape « quantité » courante, ramené à sa plage (`clampStepAmount`). */
    quantite: number;
  };
  contreSort: {
    /** LDB 46 l.162 ; #1042, #1059 */
    declaration: CounterDeclaration;
  };
  desengagement: {
    /** LDB 15 l.47 */
    sacrifier: true;
    /** LDB 15 l.59-61 */
    fuir: true;
  };
  auContact: {
    /** LDB 62 l.176 */
    issue: 'normal' | 'contact';
  };
  empoignade: {
    /** LDB 14 l.161 */
    briser: true;
    /** LDB 14 l.161-165 */
    issue: IssueDEmpoignade;
  };
  chute: {
    /** LDB 15 l.82 ; `false` : la chute pleine, sans Test. */
    tenter: boolean;
    /** EDO 01 l.231 */
    suspendre: boolean;
  };
  soins: {
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
  chansonDeMarin: {
    /** MDG 09 l.32-40 */
    chanson: IdDeChanson;
  };
  manoeuvre: {
    /** LDB 85 l.290 */
    avantage: number;
  };
  battement: {
    /** LDB 10 l.103 */
    adversaire: IdDAdversaireDuBattement;
  };
  distraire: {
    /** LDB 10 l.364 */
    adversaire: IdDAdversaireADistraire;
  };
  test: {
    testeur: IdDeCombattant;
  };
  manoeuvreDuNavire: {
    /** MDG 13 ; crans d'octant. */
    virage: number;
  };
  enfoncerLaPorte: {
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

/** Ce que fait un choix, réglage de jet (`jetRegler`) ou choix de fenêtre (`fenetreChoisir`) : sa valeur se change
 *  jusqu'à la clôture de la fenêtre (`reprenable`), elle se pose sans retour sur sa rangée ou sur la fenêtre, qui reste
 *  ouverte (`fige`), ou le choix applique l'issue et ferme la fenêtre (`clot`). Un choix qui ne clôt pas est une option de la fenêtre, pas un pas de sa
 *  séquence (`GesteDeLaFenetre.reglage`, `src/hote/gestes.ts`). */
export type EffetDuChoix = 'reprenable' | 'fige' | 'clot';

/** La déclaration d'un réglage : sa phase, sa portée, son effet, le siège qui le joue quand ce n'est pas le porteur du
 *  jet (`qui` : l'hôte seul ; `porteurDeLaValeur` : le combattant lu sur la valeur, `netOwnership`), et ce qui le ferme
 *  dans sa phase là où il ne change rien au jet (`offre`, `null` : il s'offre). Un réglage de rangée qui déclare
 *  `toutes` (les rangées encore à régler, de tout siège) se joue aussi sans rangée, sur chacune de celles du siège qui
 *  agit (« Tout déclarer »). */
export interface DeclarationDuReglage {
  phase: PhaseDuReglage;
  portee: PorteeDuReglage;
  effet: EffetDuChoix;
  toutes?: (s: Pick<Jeu, 'pendingCounterspell'>) => readonly string[];
  qui?: 'hote';
  porteurDeLaValeur?: (s: Pick<Jeu, 'pendingHeal'>, valeur: unknown) => string | undefined;
  offre?: (s: Jeu) => FermetureDuJet | null;
}

const avant = { phase: 'avantLeJet', portee: 'fenetre', effet: 'reprenable' } as const;
const apres = { phase: 'apresLeJet', portee: 'fenetre', effet: 'reprenable' } as const;
const horsDuJet = { phase: 'horsDuJet', portee: 'fenetre', effet: 'reprenable' } as const;
/** Le réglage `reglage` de l'incantation, de déclaration `d`, offert là où il change le Sort. */
const offertDuSort = (d: Omit<DeclarationDuReglage, 'offre'>, reglage: ReglageOffertDeLIncantation): DeclarationDuReglage =>
  ({ ...d, offre: (s) => offreDeLIncantation(s, reglage) });

/** La déclaration de chaque réglage, table TOTALE sur `ReglagesDuJet`. */
export const REGLAGES_DU_JET = {
  attaque: { localisation: avant, localisationDuCritique: apres, arme: avant, deuxArmes: avant, retenirSesCoups: avant, sansLaCorde: avant, empoigner: avant },
  defense: { reaction: avant, armeDeParade: avant, porteBouclier: avant, riposte: avant },
  incantation: {
    effetCritique: offertDuSort(apres, 'effetCritique'), formeConjuree: offertDuSort(horsDuJet, 'formeConjuree'),
    discret: offertDuSort(avant, 'discret'), jetsDeTable: offertDuSort(apres, 'jetsDeTable'),
    surincantationPortee: apres, surincantationZone: apres, surincantationDuree: apres, surincantationCibles: apres, surincantationDegats: apres,
    ciblesSupplementaires: apres,
    carte: horsDuJet,
  },
  cascade: {
    abandon: { ...horsDuJet, effet: 'clot', qui: 'hote', offre: (s) => (sequenceAbandonOf(() => s) ? null : 'nonOffert') },
    choix: { ...horsDuJet, portee: 'rangee' },
    quantite: { ...horsDuJet, portee: 'rangee' },
  },
  contreSort: {
    declaration: { ...horsDuJet, portee: 'rangee', effet: 'fige', toutes: (s) => (s.pendingCounterspell?.participants ?? []).filter((x) => !x.declared && x.interactive).map((x) => x.id) },
  },
  desengagement: {
    sacrifier: { ...horsDuJet, effet: 'clot', offre: (s) => (s.pendingDisengage?.phase === 'choix' && s.pendingDisengage.canSacrifice ? null : 'nonOffert') },
    fuir: { ...horsDuJet, effet: 'clot', offre: (s) => (s.pendingDisengage?.phase === 'choix' && s.pendingDisengage.canFuir !== false ? null : 'nonOffert') },
  },
  auContact: { issue: { ...horsDuJet, effet: 'clot', offre: (s) => (s.pendingAuContact?.phase === 'choix' && s.pendingAuContact.result === 'reussite' ? null : 'nonOffert') } },
  empoignade: {
    briser: { ...horsDuJet, effet: 'clot', offre: (s) => (s.pendingGrapple?.phase === 'jet' && !s.pendingGrapple.def && s.pendingGrapple.canBreak ? null : 'nonOffert') },
    issue: { ...horsDuJet, effet: 'clot', offre: (s) => (s.pendingGrapple?.phase === 'options' && s.pendingGrapple.result === 'reussite' ? null : 'nonOffert') },
  },
  chute: {
    tenter: { ...horsDuJet, portee: 'rangee', effet: 'fige' },
    suspendre: { ...horsDuJet, portee: 'rangee', effet: 'fige', offre: (s) => (s.pendingFall?.suspendu !== undefined ? null : 'nonOffert') },
  },
  soins: {
    mode: avant, test: avant,
    // LDB 74 l.41 ; `user-arbitrage-coop-inventaire-par-proprietaire-bg3`
    bandages: { ...avant, porteurDeLaValeur: (s, valeur) => (typeof valeur === 'string' ? valeur : s.pendingHeal?.bandagesDe ?? undefined) },
  },
  corruption: { nature: avant },
  chansonDeMarin: { chanson: avant },
  manoeuvre: { avantage: avant },
  battement: { adversaire: avant },
  distraire: { adversaire: avant },
  test: { testeur: avant },
  manoeuvreDuNavire: { virage: horsDuJet },
  enfoncerLaPorte: { arme: { ...avant, portee: 'rangee' } },
} as const satisfies { [F in FluxRegle]: { [K in ReglageDu<F>]: DeclarationDuReglage } };

/** Le réglage de la Surincantation de chaque axe. */
export const REGLAGE_DE_L_AXE = {
  range: 'surincantationPortee', zone: 'surincantationZone', duration: 'surincantationDuree', targets: 'surincantationCibles', damage: 'surincantationDegats',
} as const satisfies Record<OvercastAxis, ReglageDu<'incantation'>>;

/** Le flux `flux` (une donnée de frontière) a-t-il des réglages ? */
export const estFluxRegle = (flux: unknown): flux is FluxRegle => typeof flux === 'string' && Object.prototype.hasOwnProperty.call(REGLAGES_DU_JET, flux);

/** Le réglage `reglage` (une donnée de frontière) est-il déclaré par un flux ? */
const estReglageDuJet = (reglage: unknown): reglage is ReglageDuJet =>
  typeof reglage === 'string' && Object.values(REGLAGES_DU_JET).some((table) => Object.prototype.hasOwnProperty.call(table, reglage));

/** La déclaration du réglage `reglage` du flux `flux` ; `null` : le flux ne le déclare pas. */
export function declarationDuReglageNomme(flux: FlowKey, reglage: ReglageDuJet): DeclarationDuReglage | null {
  if (!estFluxRegle(flux)) return null;
  const table: Readonly<Record<string, DeclarationDuReglage>> = REGLAGES_DU_JET[flux];
  return Object.prototype.hasOwnProperty.call(table, reglage) ? table[reglage] : null;
}

/** La déclaration du réglage `reglage` du flux `flux`, deux données de frontière (`declarationDuReglageNomme`) ;
 *  `null` : le flux ne le déclare pas. */
export const declarationDuReglage = (flux: unknown, reglage: unknown): DeclarationDuReglage | null =>
  (estFluxRegle(flux) && estReglageDuJet(reglage) ? declarationDuReglageNomme(flux, reglage) : null);

/** Les réglages du flux `flux`, dans leur ordre de déclaration ; aucun pour un flux qui n'en a pas. */
export const reglagesDuFlux = (flux: string): readonly ReglageDuJet[] => (estFluxRegle(flux) ? Object.keys(REGLAGES_DU_JET[flux]) as ReglageDuJet[] : []);

/** Ce qui ferme maintenant un réglage de phase `phase`, d'après ce qui ferme le lancer de son jet (`lancer`, `null` :
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
  [F in FluxRegle]: { [K in ReglageDu<F>]: [flux: F, reglage: K, valeur: ReglagesDuJet[F][K], pid?: IdDeRangee] }[ReglageDu<F>];
}[FluxRegle];

/** Le corps de chaque réglage, table TOTALE sur `ReglagesDuJet` : il reçoit la valeur, et la rangée d'un réglage de
 *  rangée. Le verbe ne l'appelle que dans sa phase (`fermetureDeLaPhase`). */
export type CorpsDesReglages = { readonly [F in FluxRegle]: { readonly [K in ReglageDu<F>]: (valeur: ReglagesDuJet[F][K], pid?: string) => void } };

/** Les cibles supplémentaires `courantes`, `id` retirée si elle y est, ajoutée sinon : la liste que règle un clic de
 *  désignation (la carte, la fenêtre hors combat). */
export const ciblesBasculees = (courantes: readonly string[] | undefined, id: string): string[] =>
  ((courantes ?? []).includes(id) ? (courantes ?? []).filter((x) => x !== id) : [...(courantes ?? []), id]);
