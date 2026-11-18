/**
 * LES MAQUETTES EN DONNÉE (#4411) : un fichier de `maquettes/` est un écran, la liste de ses états. Un état porte ce
 * que l'écran montre (valeurs typées, ids, états, et les mots en chaînes simples) et nomme son gabarit
 * (`../../dispositions.md` § « Par type d'écran ») ; il ne dit jamais où ni comment se dessine ce qu'il porte. La page
 * de rendu (`../rendu.js`) le dessine avec les pièces du kit (`../gestes.js`, `../../kit.md`), `../rendre.mjs` la
 * capture.
 */

/** Un écran : ses états, chacun à son nom. */
export interface Ecran {
  etats: [Etat, ...Etat[]];
}

export type Etat = EtatDeCombat | IssueDuCombat | Options | Bivouac;

/* ───────── le combat ───────── */

/** Un combattant : son nom, le buste qui le dessine (`BUSTES`, `../gestes.js`), son camp, ses Blessures, ses États. */
export interface Combattant {
  nom: string;
  buste: string;
  ennemi: boolean;
  blessures: number;
  max: number;
  etats: EtatPorte[];
}

/** Un État porté (LDB 16) : son id, son nom, ses exemplaires cumulés ; `presse`, celui que le joueur vient de presser. */
export interface EtatPorte {
  etat: 'aTerre' | 'hemorragique';
  nom: string;
  n: number;
  presse?: true;
}

/** Une ligne du journal : une phrase, ou la borne d'un round ; `commence`, celle du premier. */
export type EntreeDuJournal = string | { round: number; commence?: true };

/** Le combat sous une fenêtre : le round, le tour joué parmi les tours du round (`null` quand le round débute), les
 *  combattants à jouer (celui qui a la main en tête, s'il y a un tour), le début de l'ordre du round suivant, le journal,
 *  la plus récente en dernier. */
export interface Combat {
  round: number;
  tour: { rang: number; sur: number } | null;
  ordre: string[];
  suivant: string[];
  journal: EntreeDuJournal[];
}

/** La cour du combat (`../combat/cour.js`), à l'état qu'elle dessine, et ce que la suite du combat y marque : la cible
 *  passée au Tireur gobelin, sa case cernée, le Dôme sur lui ; `videe`, sans ses adversaires ni le voile de fin. */
export interface Cour {
  etat: string;
  marques?: ('vise' | 'cerne' | 'dome')[];
  videe?: true;
}

/** Ce qui s'ajoute au nom d'un testeur : un modificateur et sa valeur, un jet inversé, un rang parmi plusieurs. */
export type Modificateur = { nom: string; valeur?: number } | { nom: string; de: number; vers: number } | { nom: string; rang: number; sur: number };

/** Les deux d10 : la dizaine, l'unité. */
export type Des = [number, number];

/** Un jet tombé : ses dés, son DR, réussi ou non ; `critique`, le double réussi ; `reglable`, les dés que la Résilience
 *  laisse choisir (LDB 17 l.68). */
export interface JetTombe {
  des: Des;
  dr: number;
  reussite: boolean;
  critique?: true;
  reglable?: true;
}

/** Celui qui teste : le combattant, son Test et son seuil, ses modificateurs ; tombé, son jet ; les dés déjà posés d'un
 *  jet que l'on reprend. */
export interface Testeur {
  role: 'testeur';
  qui: string;
  test: string;
  seuil: number;
  modificateurs?: Modificateur[];
  jet?: JetTombe;
  des?: Des;
}

/** Le héros d'une fenêtre sans dé : ce qui le met en jeu (une réserve, sa compétence et son seuil, le Critique qu'il
 *  porte), ce que son choix coûte. */
export interface HerosSansDe {
  role: 'heros';
  qui: string;
  mise: { reserve: string; valeur: number } | { test: string; seuil: number } | { critiqueSur: string };
  cout?: string;
}

/** Celui qui subit la table qu'un jet impose : ce qui l'y mène (une table, un double), les dés et le d100 de la table
 *  tirée, l'issue du jet qui l'impose. */
export interface Subit {
  role: 'subit';
  qui: string;
  motif: string | { double: number };
  des: Des;
  tire?: number;
  issue: { critique: number } | { unites: number } | { tableau: string };
}

/** Celle qu'une Influence corruptrice expose : la combattante, l'exposition, ses Points de Corruption sur son seuil. */
export interface Expose {
  role: 'expose';
  qui: string;
  exposition: string;
  corruption: { points: number; seuil: number };
}

/** Celui qu'un jet vise sans dé : le combattant, son rôle. */
export interface Vise {
  role: 'vise';
  qui: string;
  comme: string;
}

export type Zone = 'tete' | 'corps' | 'brasD' | 'brasG' | 'jambeD' | 'jambeG';

/** Celui qu'un Critique touche : le combattant, la zone et ce qu'elle dit, les Blessures perdues. */
export interface Touche {
  role: 'touche';
  qui: string;
  zone: Zone;
  atteinte: string;
  blessures: number;
}

/** Une ligne du détail d'une carte : des mots, un Test et son seuil (contre un autre), un Niveau d'incantation, les DR
 *  d'un Test étendu, la distance d'un combattant et la portée. */
export type LigneDeCarte = string | { test: string; seuil: number; contre?: number } | { ni: number } | { aCumuler: number } | { qui: string; distance: number; portee: number };

/** Une carte de choix : son nom, ou le combattant qu'elle nomme ; son détail ligne à ligne et sa marque ; choisie ou
 *  non, sa raison de refus ; `funeste`, celle qui condamne. */
export interface Carte {
  nom?: string;
  qui?: string;
  detail: LigneDeCarte[];
  marque?: { nom: string; valeur?: number };
  choisie?: true;
  refus?: string;
  funeste?: true;
}

/** Un groupe de cartes, sous son libellé quand le choix en a plusieurs. */
export interface GroupeDeCartes {
  libelle?: string;
  cartes: Carte[];
}

/** Un réglage d'un jet avant le dé : son libellé, ses valeurs, celle qui est tenue. */
export interface Reglage {
  libelle: string;
  valeurs: string[];
  tenue: number;
}

/** Un réglage qui s'allume ou s'éteint. */
export interface Bascule {
  libelle: string;
  allumee: boolean;
}

/** Ce sur quoi porte un jet : l'arme ou le Sort, la cible. */
export interface Porte {
  arme: string;
  cible: string;
}

/** Une réaction de Défense et son seuil. */
export interface Reaction {
  nom: string;
  seuil: number;
}

/** Ce qu'un Test décide : son libellé, une issue et son effet par ligne, celle que le dé désigne. */
export interface Enjeu {
  libelle: string;
  issues: { issue: string; effet: string }[];
  tombee: number | null;
}

/** Un axe de Surincantation : son nom ; ses pas alloués sur ses pas et ce qu'ils donnent, ou sans objet. */
export type AxeDeSurincantation = { nom: string; alloues: number; sur: number; effet: { cibles: number } | { facteur: number } } | { nom: string; sansObjet: true };

/** Le centre d'une fenêtre, selon ce qu'elle résout. */
export type Centre =
  /** Le verdict des jets opposés tombés : sur quoi ils portent, le jet relancé, le DR net, la phrase d'issue. */
  | { role: 'verdict'; porte: Porte; relance?: number; drNet: number; issue: string }
  /** Les réglages d'une attaque : la localisation (la zone choisie et son malus, « Au hasard » offert), les réglages,
   *  les bascules, la note de ce qu'ils font. */
  | { role: 'attaque'; porte: Porte; localisation: { libelle: string; zone: { id: Zone; nom: string } | null; malus: number | null; hasard: boolean }; reglages: Reglage[]; bascules: Bascule[]; note?: string }
  /** La réaction d'une Défense avant le dé, ses réglages ; `sociale`, ce qui la permet à la place du Corps à corps. */
  | { role: 'defense'; porte: Porte; reactions: Reaction[]; tenue: number; reglages: Reglage[]; sociale?: string }
  /** Un choix en cartes, sous l'annonce de ce qui l'ouvre : le round qui débute, le Sort qu'un lanceur incante. */
  | { role: 'choix'; annonce?: { round: number; sous: string } | { sort: string; lanceur: string; cible: string }; groupes: GroupeDeCartes[] }
  /** La consigne d'un geste à poser sur le champ. */
  | { role: 'consigne'; consigne: string }
  /** L'effet d'un Coup Critique. */
  | { role: 'critique'; nom: string; effet: string }
  /** Une table qu'un jet impose : son nom, la table, sa règle ou l'effet tiré ; son d100, `null` à tirer. */
  | { role: 'table'; nom: string; table: string; texte: string; tire?: number | null }
  /** Un Sort lancé : son Niveau d'incantation, son nom, la phrase d'issue. */
  | { role: 'sort'; ni: number; sort: string; issue: string }
  /** La Surincantation d'un Sort tombé : les cibles supplémentaires choisies, les pas alloués, chaque axe, les cibles. */
  | { role: 'surincantation'; ni: number; sort: string; supplementaires: { choisies: number; sur: number }; pas: { alloues: number; sur: number }; axes: AxeDeSurincantation[]; cibles: { qui: string; comme: string }[] }
  /** Un Test étendu : le Niveau d'incantation à atteindre, le Sort, le cumul de ses DR, la phrase ; ce qu'il décide. */
  | { role: 'etendu'; ni: number; sort: string; cumul: number; phrase: string; enjeu?: Enjeu }
  /** La nature d'une Influence corruptrice, à choisir avant le dé, et ce que le Test décide. */
  | { role: 'nature'; libelle: string; cartes: Carte[]; enjeu: Enjeu }
  /** Le Test de Corruption tombé : l'Influence, les Points de Corruption, les Points gagnés, la phrase, ce que le Test
   *  décide. */
  | { role: 'corruption'; influence: string; corruption: { points: number; seuil: number }; gain: number; issue: string; enjeu: Enjeu };

/** Un geste de la fenêtre : son libellé ; `principal`, celui qui la fait avancer ; sa raison de refus, lue au survol. */
export interface Geste {
  libelle: string;
  principal?: true;
  refus?: string;
  survol?: true;
}

/** Une réserve que les gestes dépensent : son nom, sa valeur ; `porteur`, le combattant qui la porte quand elle est
 *  seule. */
export interface Reserve {
  nom: string;
  valeur: number;
  porteur?: string;
}

/** Une fenêtre du bas : son titre, le héros à gauche, l'autre à droite, son centre, ses gestes et les réserves qu'ils
 *  dépensent. */
export interface Fenetre {
  titre: string;
  heros?: Testeur | HerosSansDe | Subit | Expose;
  autre?: Testeur | Vise | Touche;
  centre: Centre;
  gestes: Geste[];
  reserves: Reserve[];
}

/** Un état du combat : la fenêtre du bas posée sur la cour et, en combat, sur le tour qui se joue. */
export interface EtatDeCombat {
  nom: string;
  gabarit: 'fenetre-du-bas';
  cour: Cour;
  combattants: Record<string, Combattant>;
  combat: Combat | null;
  fenetre: Fenetre;
}

/** L'issue d'un combat : son titre, sa suite, l'action unique, sur la cour. */
export interface IssueDuCombat {
  nom: string;
  gabarit: 'recit';
  cour: Cour;
  titre: string;
  suite: string | null;
  action: string;
}

/* ───────── les options ───────── */

/** Une préférence : son nom, sa valeur (oui ou non, un pourcentage, une valeur parmi d'autres), son aide. */
export type Preference = { nom: string; aide?: string } & ({ oui: boolean } | { pourcent: number } | { valeurs: string[]; tenue: number });

/** Une règle maison : son nom, sa référence, sa valeur ; `maison`, une valeur maison ; `modifiee`, écartée du défaut ;
 *  son aide, son action. */
export type RegleMaison = { nom: string; ref: string; maison?: true; modifiee?: true; aide?: string; action?: string } & (
  | { oui: boolean }
  | { valeur: number; min: number; max: number; signe?: true }
  | { valeurs: string[]; tenue: number }
  | { liste: string }
);

/** Un domaine des règles maison : son nom, ses règles, celles qui sont modifiées. */
export interface Domaine {
  nom: string;
  regles: number;
  modifiees: number;
}

/** Les options : le titre, les préférences (le son puis le jeu), les domaines, le domaine ouvert et son premier
 *  feuillet, à deux pages. */
export interface Options {
  nom: string;
  gabarit: 'gestion';
  titre: { nom: string; sous: string };
  son: Preference[];
  jeu: Preference[];
  domaines: Domaine[];
  ouvert: { domaine: string; feuillet: number; feuillets: number; gauche: RegleMaison[]; droite: RegleMaison[] };
}

/* ───────── le bivouac ───────── */

/** Un héros du bivouac : son id (son buste), son nom, sa carrière, ses Blessures, son couchage, sa nourriture. */
export interface HerosDuBivouac {
  id: string;
  nom: string;
  carriere: string;
  blessures: number;
  max: number;
  couchage: string;
  nourriture: { valeurs: string[]; tenue: number };
}

/** La halte du soir : le titre, la date, le moment et le temps, le lieu et son récit, le campement, ce que la nuit
 *  jouera, l'action, le retour, le groupe. */
export interface Bivouac {
  nom: string;
  gabarit: 'lieu-et-voyage';
  titre: string;
  date: { jour: number; mois: string };
  moment: string;
  meteo: { temps: 'gel'; ciel: string };
  lieu: string;
  recit: string;
  abri: { nom: string; detail: string };
  temps: string;
  nuit: { id: 'froid' | 'repos'; nom: string; jet: string }[];
  action: string;
  retour: string;
  groupe: HerosDuBivouac[];
}
