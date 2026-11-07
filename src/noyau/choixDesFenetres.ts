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
  IdDActiviteEnMer, IdDArticle, IdDeChoixDePaie, IdDeHeros, IdDeLigneDeButin, IdDeLigneDeRepartition, IdDePlaieDeLOperation, IdDeReponseDeDialogue,
  IdDObjet, IdDuCoupleMonte,
} from './designations';
import type { RestFood, RestLodging } from './restFlow';
import type { FlowKey } from './flowVerbs';
import type { CleDeRegistre } from './modalArbiter';
import type { EffetDuChoix, PorteeDuReglage } from './reglagesDuJet';
import type { Reglage } from './reglages';
import type { Jeu } from './etat';

/** Le verbe qui choisit dans une fenêtre (`ActionsDuNoyau.fenetreChoisir`). */
export const VERBE_DE_CHOIX = 'fenetreChoisir' as const satisfies keyof VerbeDeChoix;

/** Les choix de chaque fenêtre qui en a, et la forme de leur valeur. */
export interface ChoixDesFenetres {
  fateSave: {
    /** LDB 17 l.29-32 ; `accept` : le héros meurt. */
    issue: FateSaveOption | 'accept';
  };
  renounce: {
    /** LDB 17 l.67 ; `false` : la mutation se développe. */
    renier: boolean;
  };
  mountTarget: {
    /** LDB 14 l.181 */
    cible: IdDuCoupleMonte;
  };
  council: {
    paie: IdDeChoixDePaie;
  };
  shoreLeave: {
    /** MDG 15 l.245 */
    accorder: boolean;
  };
  medic: {
    patient: IdDeHeros;
    abandon: true;
    /** La Blessure Critique que l'opération armée vise (`plaiesDeLOperation`). */
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
  seaActivities: {
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
  };
  loot: {
    /** La ligne du butin que prend le héros de la rangée. */
    ligne: IdDeLigneDeButin;
  };
  victory: {
    /** La ligne du butin que prend le héros de la rangée. */
    ligne: IdDeLigneDeButin;
  };
  rest: {
    /** LDB 66 */
    couchage: RestLodging;
    /** LDB 66 */
    pitance: RestFood;
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
 *  fenêtre, `'*'` : tout siège, ou, sur une rangée, celui de son héros). */
export interface DeclarationDuChoix {
  effet: EffetDuChoix;
  portee: PorteeDuReglage;
  qui: 'hote' | 'proprietaire';
}

const clot = { effet: 'clot', portee: 'fenetre', qui: 'proprietaire' } as const;
const clotParLHote = { effet: 'clot', portee: 'fenetre', qui: 'hote' } as const;
const reprenable = { effet: 'reprenable', portee: 'fenetre', qui: 'proprietaire' } as const;
const duHeros = { effet: 'reprenable', portee: 'rangee', qui: 'proprietaire' } as const;
const reprenableParLHote = { effet: 'reprenable', portee: 'fenetre', qui: 'hote' } as const;
const duHerosParLHote = { effet: 'reprenable', portee: 'rangee', qui: 'hote' } as const;

/** La déclaration de chaque choix, table TOTALE sur `ChoixDesFenetres`. */
export const CHOIX_DES_FENETRES = {
  fateSave: { issue: clot },
  renounce: { renier: clot },
  mountTarget: { cible: clot },
  council: { paie: clotParLHote },
  shoreLeave: { accorder: clotParLHote },
  medic: { patient: reprenable, abandon: clot, plaie: reprenable },
  dialogue: { reponse: clot },
  designationHeros: { heros: clot },
  seaActivities: { activite: duHeros, investir: duHeros, cacher: duHeros },
  // Le panier et la vente se composent au siège du propriétaire de l'échoppe (l'hôte), et dans l'état d'un invité (#3059) ;
  // la répartition des achats payés est à l'hôte.
  marchand: {
    ajouterAuPanier: reprenable, oterDuPanier: reprenable, retirerDuPanier: reprenable, viderLePanier: reprenable,
    ajouterALaVente: reprenable, retirerDeLaVente: reprenable, viderLaVente: reprenable,
    baisserLePrix: reprenable, releverLePrix: reprenable, repartition: duHerosParLHote,
  },
  loot: { ligne: duHerosParLHote },
  victory: { ligne: duHeros },
  rest: { couchage: duHeros, pitance: duHeros },
  finDeSeance: { ambitionCourte: reprenableParLHote, ambitionLongue: reprenableParLHote, ambitionPersonnelleCourte: duHerosParLHote, ambitionPersonnelleLongue: duHerosParLHote, motivation: duHerosParLHote },
} as const satisfies { [F in FenetreAChoix]: { [A in AxeDe<F>]: DeclarationDuChoix } };

/** La fenêtre `fenetre` (une donnée de frontière) a-t-elle des choix ? */
export const estFenetreAChoix = (fenetre: unknown): fenetre is FenetreAChoix => typeof fenetre === 'string' && Object.prototype.hasOwnProperty.call(CHOIX_DES_FENETRES, fenetre);

/** La déclaration du choix `axe` de la fenêtre `fenetre`, deux données de frontière ; `null` : la fenêtre ne le déclare
 *  pas. */
export function declarationDuChoix(fenetre: unknown, axe: unknown): DeclarationDuChoix | null {
  if (!estFenetreAChoix(fenetre) || typeof axe !== 'string') return null;
  const table: Readonly<Record<string, DeclarationDuChoix>> = CHOIX_DES_FENETRES[fenetre];
  return Object.prototype.hasOwnProperty.call(table, axe) ? table[axe] : null;
}

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
  [F in FenetreAChoix]: { [A in AxeDe<F>]: [fenetre: F, axe: A, valeur: ChoixDesFenetres[F][A], pid?: IdDeHeros] }[AxeDe<F>];
}[FenetreAChoix];

/** Le corps de chaque choix, table TOTALE sur `ChoixDesFenetres` : il reçoit la valeur, que `fenetreChoisir` n'a admise
 *  que parmi les valeurs ouvertes de l'axe (`OuvertsDuChoix`), et le héros d'un choix de rangée. */
export type CorpsDesChoix = { readonly [F in FenetreAChoix]: { readonly [A in AxeDe<F>]: (valeur: ChoixDesFenetres[F][A], pid: IdDeHeros) => void } };

/** Les valeurs que l'état ouvre à chaque choix, table TOTALE sur `ChoixDesFenetres` : le réglage de l'argument
 *  `valeur` (son libellé, sa valeur courante, chaque valeur avec la raison qui la ferme, ou ses bornes), sur le héros
 *  `pid` d'un choix de rangée, que lisent le refus du verbe et les hôtes du noyau. Aucune valeur hors de ce réglage ne se
 *  joue. */
export type OuvertsDuChoix = { readonly [F in FenetreAChoix]: { readonly [A in AxeDe<F>]: (s: Jeu, pid: IdDeHeros | undefined) => Reglage } };
