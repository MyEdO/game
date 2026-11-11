/**
 * LES CHOIX D'UNE FENÊTRE (#3369) : ce qu'une fenêtre qui n'est pas un flux de jet fait choisir — l'issue du Sauvetage
 * par le Destin, la cible du couple monté, la paie du Conseil, le patient de l'infirmerie… Un choix se joue par un seul
 * verbe, `fenetreChoisir(fenetre, axe, valeur)` (`VerbeDeChoix`) : `ChoixDesFenetres` déclare, par fenêtre, chaque axe
 * et la FORME de sa valeur, `CHOIX_DES_FENETRES` son effet (`EffetDuChoix`) et le siège qui le joue. Le générateur des
 * verbes (`scripts/docs/lib/verbesDeLaPartie.mjs`) lit `ChoixDesFenetres` comme `ReglagesDuJet`, et les hôtes du noyau
 * contrôlent la valeur contre sa forme (`CHOIX`, `src/hote/verbes.generated.ts`). Les valeurs que l'état ouvre et le
 * corps de chaque axe vivent à `choixDeFenetre.ts` (`OUVERTS_DU_CHOIX`, `CorpsDesChoix`). Un flux de jet se règle par
 * `jetRegler` (`ReglagesDuJet`) : aucune clé n'a les deux.
 */
import type { FateSaveOption } from '../engine/fortune';
import type {
  IdDActivite, IdDActiviteEnMer, IdDAleaDeBataille, IdDArticle, IdDeChoixDePaie, IdDeCombattantPromouvable, IdDeCreatureADepecer, IdDeHeros, IdDeLigneDeButin, IdDeRangee, IdDeLigneDeRepartition, IdDePlaieDeLOperation,
  IdDeQualiteDArtisanat, IdDeReponseDeDialogue, IdDEntrainement, IdDeSort, IdDeTalent, IdDeTireurRapide, IdDeTraitPsyPorte, IdDObjet, IdDObjetDuCatalogue, IdDuCoupleMonte,
  IdDePosteDeBataille, IdDeSceneDeBataille,
  IdDOffreDeCargaison, IdDePorteurDeCargaison, IdDeCargaison, IdDePointDInteret,
} from './designations';
import type { RestFood, RestLodging } from './restFlow';
import type { ModeDeMarche } from './merchantFlow';
import type { FlowKey } from './flowVerbs';
import type { CleDeRegistre } from './modalArbiter';
import type { EffetDuChoix, PorteeDuReglage } from './reglagesDuJet';
import type { Reglage } from './reglages';
import type { Jeu } from './etat';

/** Le verbe qui choisit dans une fenêtre (`ActionsDuNoyau.fenetreChoisir`). */
export const VERBE_DE_CHOIX = 'fenetreChoisir' as const satisfies keyof VerbeDeChoix;

/** Les choix de chaque fenêtre qui en a, et la forme de leur valeur. */
export interface ChoixDesFenetres {
  destin: {
    /** LDB 17 l.29-32 ; `accepter` : le héros meurt. */
    issue: FateSaveOption | 'accepter';
  };
  renier: {
    /** LDB 17 l.67 ; `false` : la mutation se développe. */
    renier: boolean;
  };
  cibleDeMonture: {
    /** LDB 14 l.181 */
    cible: IdDuCoupleMonte;
  };
  conseil: {
    paie: IdDeChoixDePaie;
  };
  relacheATerre: {
    /** MDG 15 l.245 */
    accorder: boolean;
  };
  infirmerie: {
    patient: IdDeHeros;
    abandon: true;
    /** La Blessure Critique que l'opération armée, ou le brouillon d'une opération, vise (`plaiesDeLOperation`). */
    plaie: IdDePlaieDeLOperation;
  };
  dialogue: {
    /** Une réponse visible du nœud courant (`reponsesDuNoeud`) ; décision de groupe, #1262. */
    reponse: IdDeReponseDeDialogue;
  };
  designationHeros: {
    /** EDO 02 l.91 */
    heros: IdDeHeros;
  };
  activitesEnMer: {
    /** MDG 15 l.268 ; `null` : aucune Activité. */
    activite: IdDActiviteEnMer | null;
    /** MDG 15 l.276 */
    investir: number;
    /** MDG 15 l.292 */
    cacher: number;
  };
  marchand: {
    /** Une unité de l'article au panier d'achat. */
    ajouterAuPanier: IdDArticle;
    /** Une unité de l'article ôtée du panier d'achat. */
    oterDuPanier: IdDArticle;
    /** L'article retiré du panier d'achat. */
    retirerDuPanier: IdDArticle;
    viderLePanier: true;
    /** L'objet au panier de vente. */
    ajouterALaVente: IdDObjet;
    /** L'objet retiré du panier de vente. */
    retirerDeLaVente: IdDObjet;
    viderLaVente: true;
    /** LDB 59 l.60 */
    baisserLePrix: IdDObjet;
    /** LDB 59 l.60 */
    releverLePrix: IdDObjet;
    /** L'achat payé que prend le héros de la rangée. */
    repartition: IdDeLigneDeRepartition;
    /** Le panier d'achat se paie. */
    payer: true;
    /** Le panier de vente se vend (LDB 59 l.52). */
    vendre: true;
    /** Le marché négocié de ce côté (LDB 59 l.43). */
    refuser: ModeDeMarche;
    /** LDB 59 l.43 */
    marchander: ModeDeMarche;
    /** LDB 59 l.50 */
    chercher: true;
    /** LDB 63 l.64, LDB 62 l.135 */
    reparer: IdDObjet;
    /** Un exemplaire du bien cédé, chez son porteur (LDB 59 l.64). */
    trocCeder: IdDObjet;
    trocRecevoir: IdDArticle;
    /** Les exemplaires acquis. */
    trocQuantite: number;
    /** LDB 59 l.64-76 */
    troquer: true;
  };
  butin: {
    /** La ligne du butin que prend le héros de la rangée. */
    ligne: IdDeLigneDeButin;
  };
  victoire: {
    /** La ligne du butin que prend le héros de la rangée. */
    ligne: IdDeLigneDeButin;
    /** ZI 13 : la créature vaincue que le groupe dépèce. */
    depecer: IdDeCreatureADepecer;
  };
  repos: {
    /** LDB 66 */
    couchage: RestLodging;
    /** LDB 66 */
    pitance: RestFood;
  };
  debutDuRound: {
    /** LDB 17 l.25, LDB 62 l.298-300 : le combattant qui agit en premier ce Round. */
    promouvoir: IdDeCombattantPromouvable;
    /** LDB 11 l.97-103 : le tireur dont le Tir rapide est armé ; `null` : aucun. */
    viser: IdDeTireurRapide | null;
  };
  interlude: {
    /** LDB 23 l.5 : l'Activité que compose le héros de la rangée. */
    activite: IdDActivite;
    /** LDB 23 l.66-72 */
    talent: IdDeTalent;
    /** LDB 23 l.132-136 */
    entrainement: IdDEntrainement;
    /** LDB 23 l.74-78 : l'ouvrage d'Artisanat à engager. */
    ouvrage: IdDObjetDuCatalogue;
    /** LDB 23 l.95 : un Atout ou un Défaut que vise l'ouvrage. */
    ajouterLaQualite: IdDeQualiteDArtisanat;
    /** LDB 23 l.95 */
    retirerLaQualite: IdDeQualiteDArtisanat;
    /** L'arme à maîtriser ou l'artefact à étudier. */
    objet: IdDObjet;
    /** Le sort à mémoriser. */
    sort: IdDeSort;
    /** Le Trait psychologique à éliminer. */
    traitPsychologique: IdDeTraitPsyPorte;
    /** LDB 23 l.5 : l'Activité composée se pratique. */
    pratiquer: true;
  };
  batailleDeMasse: {
    /** ADE II 08 l.116-118 : la Scène de la situation que les PJ engagent. */
    scene: IdDeSceneDeBataille;
    /** ADE II 08 l.120 */
    engager: true;
    /** ADE II 08 l.122 */
    rallier: true;
    /** ADE II 08 l.81, l.116-118 : le poste où se poste le héros de la rangée. */
    ajouterAuPoste: IdDePosteDeBataille;
    /** Le poste que quitte le héros de la rangée. */
    retirerDuPoste: IdDePosteDeBataille;
    /** ADE II 08 l.309 : la ligne de la table choisie ; `null` : le dé la tire. */
    alea: IdDAleaDeBataille | null;
  };
  port: ChoixDuMarche;
  marcheDeTerre: ChoixDuMarche;
  ecranDuLieu: {
    /** Le point d'intérêt du plan du lieu où entrer (`entreesDuLieu`). */
    entrer: IdDePointDInteret;
  };
  finDeSeance: {
    /** LDB 05 l.837 */
    ambitionCourte: boolean;
    /** LDB 05 l.841 */
    ambitionLongue: boolean;
    /** LDB 05 l.795 */
    ambitionPersonnelleCourte: boolean;
    /** LDB 05 l.799 */
    ambitionPersonnelleLongue: boolean;
    /** LDB 17 l.81 */
    motivation: boolean;
  };
}

/** Les choix d'un marché de cargaison (MDG 15 l.319-399, MSRC 13 l.129-160) : l'achat en composition (`cargaison.ts`),
 *  sa conclusion, la vente et le bradage d'un lot. */
export interface ChoixDuMarche {
  /** L'offre dont l'achat se compose. */
  offre: IdDOffreDeCargaison;
  /** Le porteur qui charge l'achat. */
  porteur: IdDePorteurDeCargaison;
  /** L'Enc acheté. */
  encombrement: number;
  acheter: true;
  vendre: IdDeCargaison;
  jeter: IdDeCargaison;
}

/** Une fenêtre qui a des choix. */
export type FenetreAChoix = keyof ChoixDesFenetres;
/** Un axe de la fenêtre `F`. */
export type AxeDe<F extends FenetreAChoix> = keyof ChoixDesFenetres[F] & string;
/** Un axe de n'importe quelle fenêtre. */
export type AxeDuChoix = { [F in FenetreAChoix]: AxeDe<F> }[FenetreAChoix];

/** Une fenêtre à choix est une clé de registre (`MODAL_DEFS`, `HORS_MODAL`, `SURFACES_HORS_PENDING`), et aucune n'est un
 *  flux de jet, qui se règle par `jetRegler`. */
type _ClesDeRegistre = [Exclude<FenetreAChoix, CleDeRegistre>] extends [never] ? true : ['choix d’une fenêtre hors registre', Exclude<FenetreAChoix, CleDeRegistre>];
type _HorsDesFlux = [Extract<FenetreAChoix, FlowKey>] extends [never] ? true : ['choix d’un flux de jet : jetRegler', Extract<FenetreAChoix, FlowKey>];
const _domainesDisjoints: [_ClesDeRegistre, _HorsDesFlux] = [true, true];
void _domainesDisjoints;

/** La déclaration d'un choix : son effet, sa portée (`fenetre`, ou `rangee` : le choix d'un héros de la fenêtre, que
 *  désigne `pid`), et le siège qui le joue (`hote` : l'hôte seul ; `proprietaire` : le siège du propriétaire de la
 *  fenêtre, `'*'` : tout siège, ou, sur une rangée, celui de son héros ; `porteurDeLaValeur` : le siège du combattant
 *  lu sur la valeur, `netOwnership`). */
export interface DeclarationDuChoix {
  effet: EffetDuChoix;
  portee: PorteeDuReglage;
  qui: 'hote' | 'proprietaire';
  porteurDeLaValeur?: (s: Pick<Jeu, 'preemptAiming'>, valeur: unknown) => string | undefined;
}

const clot = { effet: 'clot', portee: 'fenetre', qui: 'proprietaire' } as const;
const clotParLHote = { effet: 'clot', portee: 'fenetre', qui: 'hote' } as const;
const reprenable = { effet: 'reprenable', portee: 'fenetre', qui: 'proprietaire' } as const;
const duHeros = { effet: 'reprenable', portee: 'rangee', qui: 'proprietaire' } as const;
const reprenableParLHote = { effet: 'reprenable', portee: 'fenetre', qui: 'hote' } as const;
const fige = { effet: 'fige', portee: 'fenetre', qui: 'proprietaire' } as const;
const figeParLHote = { effet: 'fige', portee: 'fenetre', qui: 'hote' } as const;
const duHerosParLHote = { effet: 'reprenable', portee: 'rangee', qui: 'hote' } as const;
const figeDuHeros = { effet: 'fige', portee: 'rangee', qui: 'proprietaire' } as const;
const marche = { offre: reprenableParLHote, porteur: reprenableParLHote, encombrement: reprenableParLHote, acheter: figeParLHote, vendre: figeParLHote, jeter: figeParLHote } as const;

/** La déclaration de chaque choix, table TOTALE sur `ChoixDesFenetres`. */
export const CHOIX_DES_FENETRES = {
  destin: { issue: clot },
  renier: { renier: clot },
  cibleDeMonture: { cible: clot },
  conseil: { paie: clotParLHote },
  relacheATerre: { accorder: clotParLHote },
  infirmerie: { patient: reprenable, abandon: clot, plaie: reprenable },
  dialogue: { reponse: clot },
  designationHeros: { heros: clot },
  activitesEnMer: { activite: duHeros, investir: duHeros, cacher: duHeros },
  // Le panier, la vente et le troc se composent au siège du propriétaire de l'échoppe (l'hôte), et dans l'état d'un
  // invité (#3059) ; ce qui touche la bourse, le stock ou les possessions est à l'hôte.
  marchand: {
    ajouterAuPanier: reprenable, oterDuPanier: reprenable, retirerDuPanier: reprenable, viderLePanier: reprenable,
    ajouterALaVente: reprenable, retirerDeLaVente: reprenable, viderLaVente: reprenable,
    baisserLePrix: reprenable, releverLePrix: reprenable, repartition: duHerosParLHote,
    payer: figeParLHote, vendre: figeParLHote, refuser: figeParLHote, marchander: figeParLHote, chercher: figeParLHote, reparer: figeParLHote,
    trocCeder: reprenable, trocRecevoir: reprenable, trocQuantite: reprenable, troquer: figeParLHote,
  },
  butin: { ligne: duHerosParLHote },
  victoire: { ligne: duHeros, depecer: figeParLHote },
  repos: { couchage: duHeros, pitance: duHeros },
  // La Chance dépensée et la visée armée sont celles du combattant que la valeur nomme ; désarmer, celles du tireur armé.
  debutDuRound: {
    promouvoir: { ...fige, porteurDeLaValeur: (_s, valeur) => (typeof valeur === 'string' ? valeur : undefined) },
    viser: { ...reprenable, porteurDeLaValeur: (s, valeur) => (typeof valeur === 'string' ? valeur : s.preemptAiming ?? undefined) },
  },
  // Chaque héros compose son Activité et la pratique, à son siège.
  interlude: {
    activite: duHeros, talent: duHeros, entrainement: duHeros, ouvrage: duHeros, ajouterLaQualite: duHeros, retirerLaQualite: duHeros,
    objet: duHeros, sort: duHeros, traitPsychologique: duHeros, pratiquer: figeDuHeros,
  },
  batailleDeMasse: { scene: figeParLHote, engager: figeParLHote, rallier: figeParLHote, ajouterAuPoste: duHerosParLHote, retirerDuPoste: duHerosParLHote, alea: figeParLHote },
  // La bourse, la cale et les porteurs du groupe sont à l'hôte.
  port: marche,
  marcheDeTerre: marche,
  ecranDuLieu: { entrer: clotParLHote },
  finDeSeance: { ambitionCourte: reprenableParLHote, ambitionLongue: reprenableParLHote, ambitionPersonnelleCourte: duHerosParLHote, ambitionPersonnelleLongue: duHerosParLHote, motivation: duHerosParLHote },
} as const satisfies { [F in FenetreAChoix]: { [A in AxeDe<F>]: DeclarationDuChoix } };

/** La fenêtre `fenetre` (une donnée de frontière) a-t-elle des choix ? */
export const estFenetreAChoix = (fenetre: unknown): fenetre is FenetreAChoix => typeof fenetre === 'string' && Object.prototype.hasOwnProperty.call(CHOIX_DES_FENETRES, fenetre);

/** L'axe `axe` (une donnée de frontière) est-il un choix de la fenêtre `fenetre` ? */
export const estAxeDe = (fenetre: FenetreAChoix, axe: unknown): axe is AxeDuChoix =>
  typeof axe === 'string' && Object.prototype.hasOwnProperty.call(CHOIX_DES_FENETRES[fenetre], axe);

/** La déclaration du choix `axe` de la fenêtre `fenetre` ; `null` : la fenêtre ne le déclare pas. */
export function declarationDuChoixNomme(fenetre: CleDeRegistre, axe: AxeDuChoix): DeclarationDuChoix | null {
  if (!estFenetreAChoix(fenetre) || !estAxeDe(fenetre, axe)) return null;
  const table: Readonly<Record<string, DeclarationDuChoix>> = CHOIX_DES_FENETRES[fenetre];
  return table[axe];
}

/** La déclaration du choix `axe` de la fenêtre `fenetre`, deux données de frontière (`declarationDuChoixNomme`) ;
 *  `null` : la fenêtre ne le déclare pas. */
export const declarationDuChoix = (fenetre: unknown, axe: unknown): DeclarationDuChoix | null =>
  (estFenetreAChoix(fenetre) && estAxeDe(fenetre, axe) ? declarationDuChoixNomme(fenetre, axe) : null);

/** Les axes de la fenêtre `cle`, dans leur ordre de déclaration ; aucun pour une fenêtre qui n'en a pas. */
export const axesDeLaFenetre = (cle: string): readonly AxeDuChoix[] => (estFenetreAChoix(cle) ? Object.keys(CHOIX_DES_FENETRES[cle]) as AxeDuChoix[] : []);

/** Le verbe qui choisit dans une fenêtre : l'axe `axe` de la fenêtre `fenetre` prend la valeur `valeur`, pour le héros
 *  `pid` d'un choix de rangée. */
export interface VerbeDeChoix {
  fenetreChoisir: (...args: ArgumentsDuChoix) => void;
}

/** Les arguments du verbe, union corrélée sur chaque axe : la valeur suit son axe jusque dans une intention
 *  (`Parameters<ActionsDuNoyau['fenetreChoisir']>`). */
export type ArgumentsDuChoix = {
  [F in FenetreAChoix]: { [A in AxeDe<F>]: [fenetre: F, axe: A, valeur: ChoixDesFenetres[F][A], pid?: IdDeRangee] }[AxeDe<F>];
}[FenetreAChoix];

/** Le corps de chaque choix, table TOTALE sur `ChoixDesFenetres` : il reçoit la valeur, que `fenetreChoisir` n'a admise
 *  que parmi les valeurs ouvertes de l'axe (`OuvertsDuChoix`), et le héros d'un choix de rangée. */
export type CorpsDesChoix = { readonly [F in FenetreAChoix]: { readonly [A in AxeDe<F>]: (valeur: ChoixDesFenetres[F][A], pid: IdDeRangee) => void } };

/** Les valeurs que l'état ouvre à chaque choix, table TOTALE sur `ChoixDesFenetres` : le réglage de l'argument
 *  `valeur` (son libellé, sa valeur courante, chaque valeur avec la raison qui la ferme, ou ses bornes), sur le héros
 *  `pid` d'un choix de rangée, que lisent le refus du verbe et les hôtes du noyau. Aucune valeur hors de ce réglage ne se
 *  joue. */
export type OuvertsDuChoix = { readonly [F in FenetreAChoix]: { readonly [A in AxeDe<F>]: (s: Jeu, pid: IdDeRangee | undefined) => Reglage } };
