/**
 * LES ÉLÉMENTS DE LA VUE (#3328), communs aux hôtes qui dessinent la partie : ce qu'un écran montre, en éléments typés
 * d'une union fermée, nommés par forme de donnée et jamais par fenêtre. Chaque élément porte un `id` stable dans sa
 * zone, ses textes déjà traduits et son ton ; un hôte range chaque type dans un composant à lui et n'écrit aucun
 * libellé. Les gestes sont des éléments aussi : chacun porte l'intention qu'il joue (`Jeu`), prête à envoyer.
 */
import type { CreatorDraft, GesteDEdition, GesteDuBrouillon, IdDeCouche, PageDeCreation } from '../noyau/index';
import type { ArgumentDuGeste, GesteDeLaFenetre } from './gestes';
import type { AnySlot, SaveSlot } from './sauvegardes';
import { coupeAuMot } from '../lib/coupeAuMot.mjs';

/** Le ton d'un élément : le nom d'une variation du thème de l'hôte. */
export type Ton = 'neutre' | 'reussite' | 'echec' | 'alerte';

/** Une ligne de texte. `detail` : ce qu'elle tait, montré à la demande. */
export interface Ligne { type: 'ligne'; id: string; ton: Ton; texte: string; detail: string | null }

/** Une puce : un libellé et sa valeur (un État et son nombre, un modificateur et son signe). `detail` : ce qu'elle
 *  change, montré à la demande. */
export interface Puce { type: 'puce'; id: string; ton: Ton; libelle: string; valeur: string | null; detail: string | null }

/** Une jauge : sa valeur courante sur son maximum, et ce qu'elle dit. */
export interface Jauge { type: 'jauge'; id: string; ton: Ton; libelle: string; courant: number; max: number; texte: string }

/** Un jet : un Test, un tirage sur table ou un dé nu. Chaque partie est déjà dite (`null` : sans objet, `resultat`
 *  avant le dé) ; le ton dit le verdict. À l'écran, le nombre à atteindre, le dé et ses modificateurs ; `detail` : la
 *  composition de la cible (base, Difficulté et ses paliers, écrêtage) et ce que le dé deviendrait, montrés à la
 *  demande, une ligne par part. */
export interface Jet {
  type: 'jet';
  id: string;
  ton: Ton;
  qui: string | null;
  libelle: string;
  cible: string | null;
  resultat: string | null;
  dr: string | null;
  verdict: string | null;
  modificateurs: Puce[];
  detail: string | null;
}

/** Une entité de jeu et ce qui la décrit. */
export interface Entite { type: 'entite'; id: string; ton: Ton; nom: string; elements: Element[] }

/** Un verbe de la partie et ses arguments. */
export interface Appel { type: string; args: unknown[] }

/** La fiche qu'un hôte montre, en statbloc : le combattant qu'elle décrit (`porteurParId` : un héros du groupe, ou
 *  tout combattant en combat), par son id, et la possession qu'il a choisie (`objet`, l'`uid` qui la désigne,
 *  `PossessionDeLaFiche`). Un état de l'hôte, jamais de la partie. */
export interface FicheOuverte { porteur: string; objet?: string }

/** La création d'un héros qu'un hôte tient : son brouillon et la page ouverte. Un état de l'hôte, jamais de la partie. */
export interface CreationOuverte { brouillon: CreatorDraft; page: PageDeCreation }

/** Le panneau qu'un hôte tient ouvert par-dessus la partie, un seul à la fois : la fiche d'un combattant ou la
 *  création d'un héros ; `null` sans panneau. */
export type PanneauDeLHote = { fiche: FicheOuverte } | { creation: CreationOuverte } | null;

/** Un geste de la création : l'ouvrir sur un brouillon neuf, jouer un geste de son brouillon, aller à une page,
 *  engager le héros dans le groupe. */
export type GesteDeLaCreation = { geste: 'ouvrir'; args: [] } | { geste: 'engager'; args: [] } | { geste: 'page'; args: [PageDeCreation] } | GesteDuBrouillon;

/** Un geste sur le roster de l'hôte : recruter au groupe le héros d'une entrée, retirer l'entrée du roster, ou
 *  l'exporter en fichier, chacune par l'id de son héros ; demander le choix d'un fichier d'export à importer
 *  (`importer`), puis en importer le texte (`importe`, `null` si le joueur renonce). */
export type GesteDuRoster = { recruter: string } | { retirer: string } | { exporter: string } | { importer: true } | { importe: string | null };

/** Une entrée de l'accueil de l'hôte : le jeu au groupe à composer, les sauvegardes à reprendre, le combat d'un
 *  scénario de test, l'atelier, l'éditeur de carte. */
export type EntreeDeLAccueil = 'jouer' | 'reprendre' | 'combat' | 'atelier' | 'editeur';

/** L'intention qu'un geste joue : un verbe de la partie et ses arguments, celui d'une offre de l'actif compris
 *  (`Offre.geste`), une suite de verbes
 *  joués l'un après l'autre (un geste d'exploration : marcher jusqu'à une case, puis y agir), la fiche que l'hôte
 *  montre (`null` : aucune), qui ne touche pas la partie, un geste de la création d'un héros (`null` : la ferme), un
 *  geste de l'éditeur de carte (`editeur.ts`), avant toute partie, l'id du scénario de test à démarrer
 *  (`scenarios.ts`), le groupe composé, l'id de la campagne du jeu à lancer, la partie à quitter, un geste sur le
 *  roster de l'hôte (`groupe.ts`), le panneau des sauvegardes à ouvrir ou à fermer, l'emplacement à charger ou celui
 *  où sauvegarder (`sauvegardes.ts`), le panneau des réglages à ouvrir ou à fermer (`reglages.ts`), l'entrée de
 *  l'accueil à suivre (`accueil.ts`). */
export type Jeu = Appel | { suite: Appel[] } | { fiche: FicheOuverte | null } | { creation: GesteDeLaCreation | null } | { edition: GesteDEdition } | { scenario: string } | { lancer: string } | { quitter: true } | { roster: GesteDuRoster } | { sauvegardes: boolean } | { charger: AnySlot } | { sauvegarder: SaveSlot } | { reglages: boolean } | { accueil: EntreeDeLAccueil };

/** Un geste d'un clic. `presse` : la valeur courante d'un choix, ou l'offre que l'actif vise ; `focus` : le geste que
 *  la fenêtre joue à l'Entrée ; `refus` : pourquoi il ne se joue pas, dit sous lui. */
export interface Bouton { type: 'bouton'; id: string; libelle: string; jeu: Jeu; presse: boolean; focus: boolean; refus: string | null }

/** Un choix parmi des valeurs, chacune un bouton ; `liste` quand elles sont trop nombreuses pour une rangée. `focus` :
 *  la liste que la fenêtre attend maintenant (une rangée de choix ne le prend jamais) ; `refus` : pourquoi le choix ne
 *  se joue pas, chacune de ses valeurs refusée avec lui. */
export interface Choix { type: 'choix' | 'liste'; id: string; ton: Ton; libelle: string; focus: boolean; refus: string | null; valeurs: Bouton[] }

/** Une valeur d'une saisie à choix : ce qu'elle dit, ce qu'elle vaut, si elle est la valeur courante, pourquoi elle
 *  est refusée. */
export interface Valeur { libelle: string; valeur: unknown; presse: boolean; refus: string | null }

/** Une saisie d'un formulaire : sa position parmi les arguments du verbe (`nom`), et son contrôle. `fixe` : posée par
 *  la fenêtre, jamais saisie ; `saisieCoches` : la liste des valeurs cochées, chacune pressée quand elle l'est déjà ;
 *  `saisieMultiligne` : un texte sur plusieurs lignes, saisi tel quel. */
export type Saisie =
  | { type: 'fixe'; id: string; nom: string; optionnel: boolean; valeur: unknown }
  | { type: 'saisieChoix' | 'saisieCoches'; id: string; ton: Ton; nom: string; optionnel: boolean; libelle: string; valeurs: Valeur[] }
  | { type: 'saisieNombre'; id: string; ton: Ton; nom: string; optionnel: boolean; libelle: string; valeur: number; min: number; max: number; pas: number }
  | { type: 'saisieTexte' | 'saisieMultiligne' | 'saisieJson'; id: string; ton: Ton; nom: string; optionnel: boolean; libelle: string; valeur: string }
  | { type: 'saisieObjet'; id: string; ton: Ton; nom: string; optionnel: boolean; libelle: string; champs: Saisie[] };

/** Un formulaire : ses saisies dans l'ordre des arguments du verbe, puis son bouton ; `refus` : pourquoi il ne se joue
 *  pas. */
export interface Formulaire { type: 'formulaire'; id: string; libelle: string; verbe: string; focus: boolean; refus: string | null; champs: Saisie[] }

/**
 * @contrat Vue
 * Un curseur : un nombre réglé en glissant ou saisi, sans bouton (#4081).
 */
export interface Curseur {
  /** `curseur`. */
  type: 'curseur';
  /** stable dans sa zone. */
  id: string;
  /** la variation du thème de son libellé. */
  ton: Ton;
  /** ce qu'il règle. */
  libelle: string;
  /** sa valeur courante. */
  valeur: number;
  /** sa borne basse. */
  min: number;
  /** sa borne haute. */
  max: number;
  /** l'écart entre deux valeurs voisines. */
  pas: number;
  /**
   * le verbe du geste joué à chaque valeur que le joueur lui donne :
   * `{ type: verbe, args: [...arguments, valeur] }`.
   */
  verbe: string;
  /** les arguments de son geste, avant la valeur. */
  arguments: unknown[];
  /** pourquoi il ne se règle pas, `null` s'il se règle. */
  refus: string | null;
}

/** Un point du plan : son nom, sa position dans le cadre du plan (0..1 sur chaque axe), son ton, et les éléments
 *  qui se posent sous lui. */
export interface PointDuPlan { type: 'point'; id: string; nom: string; x: number; y: number; ton: Ton; elements: Element[] }

/** Un trait du plan, d'un point à l'autre (leurs ids), à son ton. */
export interface TraitDuPlan { id: string; de: string; vers: string; ton: Ton }

/** Un plan : des points nommés posés dans un cadre, et les traits qui les relient. */
export interface Plan { type: 'plan'; id: string; points: PointDuPlan[]; traits: TraitDuPlan[] }

/** Le portrait d'un combattant : son corps, celui que l'hôte monte au plateau (`combattant`, son id), vu en buste. */
export interface Portrait { type: 'portrait'; id: string; combattant: string }

/** Une icône : son id au registre des icônes (`src/data/icons`), dont l'hôte tient le dessin. */
export interface Icone { type: 'icone'; id: string; icone: string }

/** Un fond d'ambiance : son id au registre des fonds (`src/data/fonds`), dont l'hôte tient le dessin. */
export interface Fond { type: 'fond'; id: string; fond: string }

/** Un paysage : ses couches, de la plus lointaine à la plus proche, chacune l'id d'un dessin du registre des paysages
 *  (`src/data/paysages`), dont l'hôte tient le dessin et qu'il trace l'une sur l'autre. */
export interface Paysage { type: 'paysage'; id: string; paysage: IdDeCouche[] }

/** Un élément de la vue. */
export type Element = Ligne | Puce | Jauge | Jet | Entite | Plan | Portrait | Icone | Fond | Paysage | Bouton | Choix | Curseur | Formulaire | Saisie;

/** Les bornes d'une saisie de nombre sans réglage : tout entier sur 32 bits, qu'un contrôle au pas de 1 tient
 *  exactement (le pas se cale sur l'écart à la borne, en réels). */
export const SANS_BORNE = { min: -(2 ** 31), max: 2 ** 31 - 1, pas: 1 };

/** Les caractères au plus d'une description au détail d'un élément : son premier paragraphe, coupé au mot. */
const DESCRIPTION_AU_DETAIL = 300;

/** Le premier paragraphe d'une description, coupé au mot (`coupeAuMot`) : le détail se lit d'un coup d'œil. */
export const resume = (desc: string | null): string | null => desc && coupeAuMot(desc.split(/\n\s*\n/)[0], DESCRIPTION_AU_DETAIL);

/** Une ligne. */
export const ligne = (id: string, texte: string, ton: Ton = 'neutre', detail: string | null = null): Ligne => ({ type: 'ligne', id, ton, texte, detail });

/** Les arguments du geste `g`, l'argument `nom` valant `valeur` : chaque argument posé par la fenêtre, puis la valeur
 *  courante de chaque argument requis ; un argument optionnel sans valeur clôt la liste. */
function argumentsAvec(g: GesteDeLaFenetre, nom: string, valeur: unknown): unknown[] {
  const args: unknown[] = [];
  for (const a of g.arguments) {
    if (a.nom === nom) args.push(valeur);
    else if (a.saisie === 'fixe' || !a.optionnel) args.push(a.valeur);
    else break;
  }
  return args;
}

/** Les valeurs de l'argument à choisir `a` du geste `g`, chacune un bouton qui joue le geste avec elle, refusée avec
 *  le geste. */
const valeursDuChoix = (g: GesteDeLaFenetre, a: ArgumentDuGeste): Bouton[] =>
  (a.valeurs ?? []).map((v, i): Bouton => ({
    type: 'bouton', id: `${g.cle}/${i}`, libelle: v.libelle, jeu: { type: g.verbe, args: argumentsAvec(g, a.nom, v.valeur) },
    presse: v.valeur === a.valeur, focus: false, refus: v.refus ?? g.raison,
  }));

/** La saisie de l'argument `a`, sous l'id `id`. */
function saisie(id: string, a: ArgumentDuGeste): Saisie {
  const base = { id, nom: a.nom, optionnel: a.optionnel };
  const dite = { ...base, ton: 'neutre' as const, libelle: a.libelle ?? a.nom };
  switch (a.saisie) {
    case 'fixe': return { ...base, type: 'fixe', valeur: a.valeur };
    case 'choix': return { ...dite, type: 'saisieChoix', valeurs: (a.valeurs ?? []).map((v) => ({ libelle: v.libelle, valeur: v.valeur, presse: v.valeur === a.valeur, refus: v.refus })) };
    case 'nombre': return { ...dite, type: 'saisieNombre', valeur: typeof a.valeur === 'number' ? a.valeur : 0, ...(a.bornes ? { min: a.bornes.min, max: a.bornes.max, pas: a.bornes.pas ?? 1 } : SANS_BORNE) };
    case 'objet': return { ...dite, type: 'saisieObjet', champs: (a.champs ?? []).map((c) => saisie(`${id}/${c.nom}`, c)) };
    case 'texte': return { ...dite, type: 'saisieTexte', valeur: a.valeur == null ? '' : String(a.valeur) };
    case 'multiligne': return { ...dite, type: 'saisieMultiligne', valeur: a.valeur == null ? '' : String(a.valeur) };
    case 'json': return { ...dite, type: 'saisieJson', valeur: a.valeur == null ? '' : JSON.stringify(a.valeur) };
  }
}

/** Les gestes ouverts de la fenêtre, chacun en élément d'après son rendu, refusé avec sa raison. Le geste que la
 *  politique de la fenêtre joue maintenant prend le focus quand il en prend un (une rangée de choix n'en prend pas), à
 *  défaut le premier bouton qui n'est pas un réglage. */
export function elementsDesGestes(gestes: readonly GesteDeLaFenetre[]): (Bouton | Choix | Formulaire)[] {
  const ouverts = gestes.filter((g) => g.ouvert);
  const focus = ouverts.find((g) => g.attendu && g.rendu !== 'choix') ?? ouverts.find((g) => g.rendu === 'bouton' && !g.reglage);
  return ouverts.map((g) => {
    const enFocus = g === focus;
    switch (g.rendu) {
      case 'bouton': return { type: 'bouton', id: g.cle, libelle: g.libelle, jeu: { type: g.verbe, args: argumentsAvec(g, '', null) }, presse: false, focus: enFocus, refus: g.raison };
      case 'choix':
      case 'liste': return { type: g.rendu, id: g.cle, ton: 'neutre', libelle: g.libelle, focus: enFocus, refus: g.raison, valeurs: valeursDuChoix(g, g.arguments.find((a) => a.nom === g.aChoisir)!) };
      case 'formulaire': return { type: 'formulaire', id: g.cle, libelle: g.libelle, verbe: g.verbe, focus: enFocus, refus: g.raison, champs: g.arguments.map((a) => saisie(`${g.cle}/${a.nom}`, a)) };
    }
  });
}
