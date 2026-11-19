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

export type Etat = EtatDeCombat | TourDeCombat | IssueDuCombat | Options | Nuit | Poursuite | BatailleDeMasse | Interlude | Soins | Commerce | Voyage | Bord | Dossier | Exploration | CarteDuMonde | Carnet | Creation | FicheDuHeros | DepenseDExperience | ChangementDeCarriere
  | Accueil | MenuDeLaPartie | Chapitre | FinDeSeance | Sauvegardes | NouvellePartie | Compendium | Coop | EditeurDeScene | EditeurDeLaCarte;

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

/** Une case de la grille du champ : sa colonne, sa rangée. */
export type Case = [number, number];

/** La mer du combat naval (`../voyage/navale.js`) : les navires sur la grille (leur case, leur cap, leur camp), les cases
 *  où l'actif peut porter son navire, celles où porte la batterie adverse. */
export interface MerDuCombat {
  navires: { case: Case; cap: 1 | -1; ennemi?: true }[];
  avance: Case[];
  batterie: Case[];
}

/** Ce qui s'ajoute au nom d'un testeur : un modificateur et sa valeur, un jet inversé, un rang parmi plusieurs, un DR
 *  qui compte plusieurs fois. */
export type Modificateur = { nom: string; valeur?: number } | { nom: string; de: number; vers: number } | { nom: string; rang: number; sur: number } | { nom: string; facteur: number };

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

/** Celui qui teste : le combattant, le poste qu'il tient, son Test et son seuil (`null`, masqué au joueur), ses
 *  modificateurs ; tombé, son jet ; les dés déjà posés d'un jet que l'on reprend ; `parmi`, les héros qui peuvent porter le
 *  Test, à désigner. */
export interface Testeur {
  role: 'testeur';
  qui: string;
  poste?: string;
  test: string;
  seuil: number | null;
  modificateurs?: Modificateur[];
  jet?: JetTombe;
  des?: Des;
  parmi?: string[];
}

/** Le héros d'une fenêtre sans dé : ce qui le met en jeu (une réserve, sa compétence et son seuil, le Critique qu'il
 *  porte, l'arme qu'il tient, son engagement : son Avantage contre celui de l'adversaire, ce qui le menace, ses Points de
 *  Corruption sur son seuil, le rôle qu'il tient pour le groupe, le Test que sa réponse portera), ce que son choix coûte,
 *  la marque de son mode. */
export interface HerosSansDe {
  role: 'heros';
  qui: string;
  mise:
    | { reserve: string; valeur: number }
    | { test: string; seuil: number }
    | { critiqueSur: string }
    | { arme: string }
    | { engagement: { avantage: number; contre: string; adverse: number } }
    | { menace: string }
    | { corruption: { points: number; seuil: number } }
    | { decidePour: string }
    | { testeur: true };
  cout?: string;
  marque?: string;
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

/** Celui à qui le héros parle : le combattant, ce qu'il est, ce qu'il dit. */
export interface Interlocuteur {
  role: 'interlocuteur';
  qui: string;
  comme: string;
  dit: string;
}

/** Une réponse que le héros peut faire : ses mots, le Test qu'elle demande (la compétence, la difficulté), ce qu'elle
 *  coûte ; `survol`, celle que le curseur survole. */
export interface Reponse {
  texte: string;
  test?: { competence: string; difficulte: string };
  prix?: Sous;
  survol?: true;
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
 *  d'un Test étendu, la distance d'un combattant et la portée, un prix, une mesure sur son maximum. */
export type LigneDeCarte = string | { test: string; seuil: number; contre?: number } | { ni: number } | { aCumuler: number } | { qui: string; distance: number; portee: number } | { prix: Sous } | { mesure: string; valeur: number; sur: number };

/** Une carte de choix : son nom, ou le combattant qu'elle nomme ; son détail ligne à ligne et sa marque ; choisie ou
 *  non, sa raison de refus, lue au survol ; `funeste`, celle qui condamne. */
export interface Carte {
  nom?: string;
  qui?: string;
  detail: LigneDeCarte[];
  marque?: { nom: string; valeur?: number };
  choisie?: true;
  refus?: string;
  funeste?: true;
  survol?: true;
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
  | { role: 'corruption'; influence: string; corruption: { points: number; seuil: number }; gain: number; issue: string; enjeu: Enjeu }
  /** Ce qu'un coup inflige au lieu d'un DR : l'arme, le coup, les États qu'il pose, la phrase d'issue. */
  | { role: 'consequence'; arme: string; coup: string; etats: { nombre: number; etat: string }; issue: string }
  /** Les Tests de plusieurs testeurs, ligne à ligne : leur nom, leur Test commun, chaque ligne, la règle qui les départage ;
   *  `somme`, le cumul de leurs DR. */
  | { role: 'tests'; nom: string; test: string; lignes: LigneDeTest[]; regle?: { texte: string; effet: string }; somme?: true }
  /** Le Marchandage avant le dé : le lot, son estimation, ce que chaque issue du Test opposé fait au prix. */
  | { role: 'marchandage'; lot: LotMarchande; estimation: Sous; enjeux: EnjeuDuMarchandage[] }
  /** Le Marchandage tombé : le lot, le DR net, l'issue et ce qu'elle fait au prix, le prix avant et après. */
  | { role: 'marche'; lot: LotMarchande; drNet: number; issue: EnjeuDuMarchandage; avant: Sous; apres: Sous }
  /** Un Test d'équipage avant le dé : ce que le navire fait, sa cible, le réglage qui vaut pour tout le bord, ce qui le
   *  modifie. */
  | { role: 'equipage'; fait: string; cible?: string; reglage: Reglage; notes: NoteDEquipage[] }
  /** Un Test simple : ce qui le pose, sa difficulté ; tombé, son DR ; la phrase de ce qu'il décide. */
  | { role: 'simple'; sur: string; difficulte?: { nom: string; valeur: number }; dr?: number; phrase: string }
  /** Les réponses d'un dialogue, la première en tête. */
  | { role: 'dialogue'; reponses: Reponse[] };

/** Ce qui modifie un Test d'équipage : un DR qui s'ajoute, les pièces d'un bord qui tirent, une règle. */
export type NoteDEquipage = { nom: string; dr: number } | { pieces: number; bord: string } | string;

/** Les autres rôles d'un Test d'équipage, chacun lancé à son tour : le héros, son poste, sa compétence, son seuil. */
export interface Rangees {
  role: 'rangees';
  rangees: { qui: string; poste: string; competence: string; seuil: number }[];
}

/** Un choix à droite de la fenêtre : son libellé, ses cartes. */
export interface ChoixADroite {
  role: 'choix';
  libelle: string;
  cartes: Carte[];
}

/** Le lot marchandé : sa denrée, son Encombrement, le sens du marché. */
export interface LotMarchande {
  nom: string;
  enc: number;
  sens: 'achat' | 'vente';
}

/** Une issue du Marchandage : son nom, le pourcentage qu'elle fait au prix ; `enPlus`, un pourcentage qui s'ajoute aux
 *  autres. */
export interface EnjeuDuMarchandage {
  issue: string;
  pourcent: number;
  enPlus?: true;
}

/** Une ligne d'un Test à plusieurs : le testeur, son poste, son Test et son seuil ; tombé, son dé et son DR ; sinon ce
 *  qu'il attend ; `double`, un DR qui compte double ; le bonus qu'un Mouvement lui donne ; `courant`, celui qui lance. */
export interface LigneDeTest {
  qui: string;
  poste?: string;
  test: string;
  seuil: number;
  de?: number;
  dr?: number;
  attente?: string;
  double?: true;
  bonus?: { mouvement: number; dr: number };
  courant?: true;
}

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
  autre?: Testeur | Vise | Touche | Rangees | ChoixADroite | Interlocuteur;
  centre: Centre;
  gestes: Geste[];
  reserves: Reserve[];
}

/** Un état du combat : la fenêtre du bas posée sur la cour et, en combat, sur le tour qui se joue. */
export interface EtatDeCombat {
  nom: string;
  gabarit: 'fenetre-du-bas';
  cour: Cour | MerDuCombat;
  combattants: Record<string, Combattant>;
  combat: Combat | null;
  fenetre: Fenetre;
}

/** Une action de la barre : son id (`src/data/actions.json` quand le jeu la nomme), son libellé ; armée, sa liste
 *  ouverte ; fermée, sa raison de refus, lue au survol. */
export interface ActionDuTour {
  id: string;
  libelle: string;
  armee?: true;
  ouverte?: true;
  fermee?: true;
  refus?: string;
  survol?: true;
}

/** Une famille d'actions de la barre, un onglet : ce qui coûte l'Action, ce que la situation ouvre, les gestes qui
 *  ouvrent un choix ; ou les emplacements rapides, un Sort ou libre chacun, celui qui est armé. */
export type FamilleDActions =
  | { id: 'action' | 'situation' | 'gestes'; nom: string; actions: ActionDuTour[] }
  | { id: 'rapides'; nom: string; sorts: (string | null)[]; arme: number | null };

/** La barre de l'actif : le combattant et son arme ; `adverse`, l'adversaire qui joue (rien ne se presse) ; ses pas
 *  restants sur ses pas, ou la charge de la pièce qu'il sert, son Action, son Avantage, sa Détermination ; ses familles
 *  d'actions, celle qui est ouverte ; les outils du tour. */
export interface BarreDeLActif {
  qui: string;
  arme: string;
  adverse?: true;
  mouvement?: { reste: number; sur: number };
  charge?: { reste: number; sur: number };
  action?: boolean;
  avantage?: number;
  determination?: number;
  familles: FamilleDActions[];
  ouverte: FamilleDActions['id'];
  outils: ActionDuTour[];
}

/** Un Sort tel que son aperçu le dit : son nom, son Niveau d'incantation, sa portée, ses cibles, sa durée, ce qu'il
 *  coûte, ce que le clic fait. */
export interface FicheDeSort {
  nom: string;
  ni: number;
  portee: string;
  cibles: number;
  duree: string;
  cout: string;
  note: string;
}

/** Une arme de la fiche : son id (son dessin), son nom, son Test, ses Dégâts (le bonus au Bonus de Force et leur
 *  total), son allonge, ses atouts. */
export interface ArmeDeLaFiche {
  id: string;
  nom: string;
  test: number;
  degats: { bonus: number; total: number };
  allonge: string;
  atouts: string[];
}

/** La fiche d'un combattant lue au clic de son portrait : qui, son peuple, sa carrière, ses réserves, ses
 *  Caractéristiques, ses sections et celle qui est ouverte, ses armes. */
export interface FicheDeCombattant {
  qui: string;
  peuple: string;
  carriere: string;
  reserves: Reserve[];
  caracteristiques: { nom: string; valeur: number }[];
  sections: string[];
  ouverte: string;
  armes: ArmeDeLaFiche[];
}

/** Ce qui se pose sur le tour : l'aperçu du Sort survolé (depuis son emplacement rapide ou la liste ouverte), l'aperçu
 *  de la cible survolée (l'attaque qu'on y porterait), le journal entier par round, la fiche d'un combattant. */
export type PoseSurLeTour =
  | { role: 'sort'; sort: FicheDeSort; depuis: 'rapide' | 'liste' }
  | { role: 'cible'; qui: string; arme: string; test: string; seuil: number; avantage: number; degats: number; oppose: string; note: string }
  | { role: 'journal'; rounds: { round: number; lignes: string[] }[] }
  | { role: 'fiche'; fiche: FicheDeCombattant };

/** Une offre que porte une entité du champ : son id (`src/data/actions.json`), son libellé, l'entité. */
export interface OffreDuChamp {
  id: string;
  libelle: string;
  sur: 'monture' | 'piece';
}

/** Le tour d'un combattant : la cour, le combat, la barre de l'actif, la liste qu'une action ouvre (son titre, ses
 *  lignes, une munition et son stock en soute, la choisie), ce qui se pose par-dessus, les offres du champ. */
export interface TourDeCombat {
  nom: string;
  gabarit: 'combat';
  cour: Cour | MerDuCombat;
  combattants: Record<string, Combattant>;
  combat: Combat;
  barre: BarreDeLActif;
  liste?: { titre: string; lignes: (string | { nom: string; enSoute: number })[]; choisie: number };
  pose?: PoseSurLeTour;
  offres?: OffreDuChamp[];
}

/** Ce que rend une victoire : l'Expérience, l'argent, les vaincus (leur nombre ; `depecer`, ceux qu'on peut dépecer),
 *  le butin, chaque objet avec les héros qui peuvent le prendre. */
export interface Butin {
  experience: number;
  argent: { shillings: number; pence: number };
  vaincus: { nom: string; nombre: number; depecer?: true }[];
  objets: { nom: string; pour: string[] }[];
}

/** L'issue d'un combat : son titre, sa suite, l'action unique, sur la cour ; le butin d'une victoire. */
export interface IssueDuCombat {
  nom: string;
  gabarit: 'recit';
  cour: Cour;
  titre: string;
  suite: string | null;
  action: string;
  butin?: Butin;
}

/* ───────── les lieux et la route ───────── */

/** Ce que dit un héros du bandeau : le poste ou l'activité qu'il tient (son id), la phrase ; `mal`, une blessure ;
 *  ou ce qui l'attend (une marque à poser), `sombre` quand rien ne le presse. */
export type Dit = { id?: string; texte: string; mal?: true } | { attend: string; sombre?: true };

/** Un héros du bandeau : son id (son buste), son nom, sa carrière, ses Blessures (sans elles, il se crée encore), sa
 *  bourse quand le lieu la montre, ce qu'il dit ; `choisi`. */
export interface HerosDuGroupe {
  id: string;
  nom: string;
  carriere: string;
  blessures?: number;
  max?: number;
  bourse?: Sous;
  dit?: Dit;
  choisi?: true;
}

/** Une journée en voyage : son nom, sa date, son rang dans le voyage, le temps ; `lumiere`, la teinte de l'arche ; la
 *  cadence du voyage tenue, là où elle a un effet. */
export interface Journee {
  jour: string;
  date: { jour: number; mois: string };
  jourDeVoyage: number;
  meteo: { temps: 'beau' | 'vent'; ciel: string };
  lumiere: 'jour' | 'soir' | 'gris';
  cadence?: 'jourParJour' | 'commande';
}

/** Le trajet sur la carte : son titre, d'où, vers où, la part faite. */
export interface Trajet {
  titre: string;
  de: string;
  vers: string;
  part: number;
}

/** Le Test d'équipage d'une journée en mer, en aperçu : son nom, son Test, chaque poste et son DR ; la Chance de ceux qui
 *  l'ont lancé. */
export interface ApercuDuTest {
  nom: string;
  test: string;
  lignes: { qui: string; poste: string; dr: number; double?: true }[];
  chance?: ChanceDe[];
}

/** La Chance qui reste à un héros. */
export interface ChanceDe {
  qui: string;
  valeur: number;
}

/** Une issue de la Distance : la Distance qui la déclenche, l'issue, la condition qui la pose. */
export interface IssueDeDistance {
  distance: number;
  issue: string;
  condition?: string;
}

/** Le panneau d'une poursuite : le poursuivant, la Distance sur ce qui sème, ce que la manche joue (un DR, un Test), les
 *  issues ; l'abandon qu'il offre. */
export interface PanneauDePoursuite {
  role: 'poursuite';
  poursuivant: string;
  distance: number;
  sur: number;
  manche: { libelle: string; dr: number } | { libelle: string; test: string };
  issues: IssueDeDistance[];
  abandon?: string;
}

/** La sommation d'un navire hostile : le navire, ses forbans, la cargaison en cale (`null`, pillée), la part pillée si
 *  l'on se soumet, valeur maison. */
export interface Sommation {
  role: 'sommation';
  navire: string;
  forbans: number;
  cargaison: number | null;
  pillage: number;
}

/** La poursuite, en mer ou à terre : le décor, le titre (une journée en mer, ou son nom et sa manche), le récit, le
 *  trajet, le panneau, la frise de Distance (la Distance sur ce qui sème, le départ, l'écart que la manche creuse),
 *  l'aperçu du Test d'équipage de la manche (chaque poste, son DR), les postes de bord à ouvrir, les combattants que la
 *  fenêtre nomme ; le groupe, ou la fenêtre qui prend sa place. */
export interface Poursuite {
  nom: string;
  gabarit: 'lieu-et-voyage';
  decor: 'mer' | 'foret';
  titre: Journee | { nom: string; sous: string };
  recit: { rubrique: string; texte: string };
  trajet?: Trajet;
  panneau: PanneauDePoursuite | Sommation;
  frise?: { distance: number; sur: number; depart: number; ecart?: number };
  apercu?: ApercuDuTest;
  postes?: string;
  combattants: Record<string, Combattant>;
  groupe?: HerosDuGroupe[];
  fenetre?: Fenetre;
}

/** L'état du navire en voyage : sa coque, le Moral de l'équipage, son eau douce en litres, ses vivres en rations. */
export interface EtatDuNavire {
  coque: { blessures: number; max: number };
  moral: number;
  eau: number;
  vivres: number;
}

/** La frise du trajet : d'où, vers où, la part faite, les nuits passées en route (leur part du trajet), ce qui reste et
 *  son unité. */
export interface FriseDuTrajet {
  de: string;
  vers: string;
  part: number;
  nuits: number[];
  reste: number;
  unite: 'km' | 'milles';
}

/** Un jet tombé en route, en billet au-dessus du héros qui l'a lancé : son Test, le héros et le poste qu'il tient, la
 *  difficulté et le seuil, le dé, le DR, ce qu'il vaut à la vitesse du voyage, la Chance qui reste au héros. */
export interface ApercuDuJet {
  role: 'jet';
  test: string;
  qui: string;
  poste?: string;
  difficulte: { nom: string; valeur: number };
  seuil: number;
  de: number;
  dr: number;
  effet?: { nom: string; vitesse: number };
  chance: number;
}

/** Un arrêt du voyage, en carton sur le décor assombri : son ruban, son titre, où il tombe (les marins du bord, le jour
 *  du voyage), le texte du livre, sa vignette, le dé tiré ; le choix qu'il ouvre (ses cartes, son geste, les parts des
 *  bourses qu'il règle). */
export interface Arret {
  ruban: string;
  titre: string;
  ou: string;
  marins?: number;
  jour?: true;
  texte: string;
  vignette: 'pont' | 'barrage' | 'port' | 'paie' | 'chaudiere';
  de?: { valeur: number; de: 'd10' | 'd100' };
  choix?: { cartes: Carte[]; geste: Geste; parts?: Part[] };
}

/** Une journée de route, de descente ou en mer : le décor, la journée, le trajet, la vapeur du navire ; le récit, l'état
 *  du navire, les écrans à ouvrir (leur id, leur libellé), la frise, le billet du jet tombé ou du Test d'équipage, l'arrêt
 *  qui suspend la journée ; les combattants que la fenêtre nomme ; le groupe, ou la fenêtre qui prend sa place. */
export interface Voyage {
  nom: string;
  gabarit: 'lieu-et-voyage';
  decor: 'route' | 'fleuve' | 'traversee';
  titre: Journee;
  trajet: Trajet;
  vapeur?: true;
  recit?: { rubrique: string; texte: string };
  navire?: { nom: string; etat: EtatDuNavire };
  ouvrir?: { id: 'dossier' | 'postes'; libelle: string }[];
  frise?: FriseDuTrajet;
  apercu?: ApercuDuJet | ApercuDuTest;
  arret?: Arret;
  combattants: Record<string, Combattant>;
  groupe?: HerosDuGroupe[];
  fenetre?: Fenetre;
}

/** Ce que la journée jouera à bord : son id (son pictogramme), son nom, qui le lance (un héros, ou les tenants d'un
 *  rôle), sa compétence. */
export interface JeuDuBord {
  id: 'progression' | 'orientation' | 'entretien';
  nom: string;
  par: { qui: string } | { tenants: string };
  competence: string;
}

/** Une Activité de la semaine en mer réglée par un héros : son poste (son id), le héros, ce qu'il y met, son plafond, la
 *  place libre en cale. */
export interface ActiviteDeLaSemaine {
  poste: string;
  qui: string;
  reglage: { libelle: string; valeur: Sous };
  plafond?: Sous;
  encLibre?: number;
}

/** Le billet d'un poste du bord survolé : un rôle (sa compétence, le Test d'équipage qu'il sert ; `essentiel`, ses DR
 *  comptent double), ou une Activité en Test étendu (les DR à cumuler, les tentatives, ce que chaque issue fait). */
export type BilletDuBord =
  | { role: 'role'; poste: string; competence: string; test: string; essentiel?: true }
  | { role: 'etendu'; poste: string; aCumuler: number; tentatives: number; issues: { issue: string; effet: string }[] };

/** Le bord : le titre (ce qu'on y règle, le navire et ses marins, le jour en mer, la règle de la page), les postes ou les
 *  Activités où l'on pose les héros, le billet du poste survolé ; à droite l'état du navire et ce que la journée jouera,
 *  ou les Activités de la semaine et leur validation ; la station à bord du héros choisi, l'écran à ouvrir, le retour, le
 *  groupe. */
export interface Bord {
  nom: string;
  gabarit: 'lieu-et-voyage';
  decor: 'bord';
  titre: { nom: string; navire: string; marins?: number; jourEnMer: number; regle?: string };
  postes: PosteDuLieu[];
  billet?: BilletDuBord;
  bord?: { etat: EtatDuNavire; jouera: JeuDuBord[] };
  semaine?: { activites: ActiviteDeLaSemaine[]; action: string };
  station?: { qui: string; stations: string[]; tenue: number; texte: string };
  ouvrir?: string;
  retour: string;
  groupe: HerosDuGroupe[];
}

/** Une Scène de bataille : son id (son pictogramme), son nom, son effet, son point de rupture ; les héros postés ; son
 *  geste ; `visee`, celle que le joueur regarde ; `place`, elle offre une place au héros choisi. */
export interface SceneDeBataille {
  id: string;
  nom: string;
  effet: string;
  rupture?: { points: number; sur: number };
  postes: string[];
  geste: string;
  visee?: true;
  place?: true;
}

/** Ce que le Round de bataille jouera, ou a joué, sur une Scène : la Scène (son id), son nom ; qui la joue (tout le
 *  groupe, ou ses postés) ; joué, la Puissance qu'elle ôte à la horde et le point de rupture qu'elle atteint, ou son
 *  échec. */
export interface JeuDuRound {
  scene: string;
  nom: string;
  qui: 'groupe' | string[];
  ote?: number;
  rupture?: { points: number; sur: number };
  echec?: true;
}

/** Une armée : son nom, sa Puissance au départ et maintenant. */
export interface Armee {
  nom: string;
  depart: number;
  puissance: number;
}

/** Une armée au Test spectaculaire de Puissance : son seuil, son dé, son DR, ce qu'elle ôte à l'autre ; à l'issue, ce
 *  qu'elle devient, `gagne`. */
export type Ost = { seuil: number; jet: number; dr: number; ote: number } | { issue: string; gagne?: true };

/** Le carton de la bataille : son titre, les deux armées, la phrase de l'issue, ses gestes. */
export interface CartonDeBataille {
  titre: string;
  allies: Ost;
  ennemis: Ost;
  phrase?: string;
  gestes: Geste[];
}

/** La bataille de masse : le round (son rang sur ses rounds, ou `null`, terminée), le terrain, les deux armées, le
 *  bonus du round aux Tests de Puissance ; ce que le round jouera ou a joué, ou les rounds joués ; les
 *  Scènes, l'aperçu de la Scène visée, le carton, les gestes du panneau, les combattants que la fenêtre nomme, le groupe,
 *  la fenêtre. */
export interface BatailleDeMasse {
  nom: string;
  gabarit: 'lieu-et-voyage';
  decor: 'champ';
  round: { rang: number; sur: number } | null;
  terrain?: string;
  armees: { allies: Armee; ennemis: Armee };
  bonus?: number;
  jeu?: { joue: boolean; scenes: JeuDuRound[] };
  rounds?: { allies: number; ennemis: number }[];
  scenes?: SceneDeBataille[];
  apercu?: { scene: string; lignes: { qui: string; comment: string }[]; regles: { libelle: string; texte: string }[] };
  carton?: CartonDeBataille;
  gestes?: Geste[];
  combattants: Record<string, Combattant>;
  groupe?: HerosDuGroupe[];
  fenetre?: Fenetre;
}

/** Un lieu de la ville : son id (son emplacement sur la carte), son nom, ce qu'on y fait, le héros qui s'y tient ;
 *  `choisi`, `fantome` (le héros choisi, s'il y va). */
export interface LieuDeLaVille {
  id: string;
  nom: string;
  quoi: string;
  heros?: string;
  choisi?: true;
  fantome?: string;
}

/** Une Activité offerte : son id (son pictogramme), son nom, son Test, ce qu'elle vaut ; `prise`, celle que le héros
 *  choisi prend ; fermée, sa raison, lue au survol. */
export interface ActiviteOfferte {
  id: string;
  nom: string;
  test?: string;
  enjeu?: string;
  prise?: true;
  refus?: string;
  survol?: true;
}

/** L'interlude en ville : la ville et ce qu'on y vit, les Activités restantes de chaque héros (son Événement, ses
 *  Activités sur trois), l'avis, les lieux de la carte, le lieu choisi (son quartier, son nom, son hôte, les forces en
 *  présence, ses Activités, l'envoi), le retour, le groupe. */
export interface Interlude {
  nom: string;
  gabarit: 'lieu-et-voyage';
  decor: 'ville';
  ville: { nom: string; sous: string };
  restantes: { qui: string; evenement: string; activites: number }[];
  avis: string;
  lieux: LieuDeLaVille[];
  lieu: { quartier: string; nom: string; hote?: HoteDuLieu; forces?: { allies: number; ennemis: number }; activites: ActiviteOfferte[]; envoi: string };
  retour: string;
  groupe: HerosDuGroupe[];
}

/* ───────── les options ───────── */

/** Une préférence : son nom, sa valeur (oui ou non, un pourcentage, une valeur parmi d'autres), son aide. */
export type Preference = { nom: string; aide?: string } & ({ oui: boolean } | { pourcent: number } | { valeurs: string[]; tenue: number });

/** Une règle maison : son nom, sa référence, sa valeur ; `maison`, une valeur maison ; `modifiee`, écartée du défaut ;
 *  son aide, son action. */
export type RegleMaison = { nom: string; maison?: true; modifiee?: true; aide?: string; action?: string } & (
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

/** Les options, sur la table : le titre, les préférences (le son puis le jeu), les domaines, le domaine ouvert et son premier
 *  feuillet, à deux pages ; `verrou`, la raison qui ferme les règles maison, lue au survol de la règle pointée. */
export interface Options {
  nom: string;
  gabarit: 'gestion';
  decor: 'table';
  titre: { nom: string; sous: string };
  son: Preference[];
  jeu: Preference[];
  domaines: Domaine[];
  ouvert: { domaine: string; feuillet: number; feuillets: number; gauche: RegleMaison[]; droite: RegleMaison[] };
  verrou?: string;
}

/* ───────── les lieux : leur hôte, leurs services, leur argent ───────── */

/** Une somme, en sous de cuivre (une couronne d'or vaut vingt pistoles, une pistole douze sous). */
export type Sous = number;

/** Le titre d'un lieu : son nom, ce qu'on y vit ; la date et le temps d'une halte. */
export interface TitreDuLieu {
  nom: string;
  sous: string;
  date?: { jour: number; mois: string };
  meteo?: { temps: 'gel' | 'beau'; ciel: string };
}

/** L'hôte d'un lieu : son buste (`BUSTES`, `../gestes.js`) ou le pictogramme de son métier, son nom, sa qualité, sa
 *  compétence et son seuil, ce qu'il dit. */
export interface HoteDuLieu {
  buste?: string;
  icone?: string;
  nom: string;
  qualite?: string;
  competence?: { nom: string; seuil: number };
  dit: string;
}

/** Le rail des services d'un lieu : son titre, chaque service (son id, son nom), celui qui est ouvert, ce qu'il dit au
 *  pied. */
export interface Rail {
  titre: string;
  services: { id: string; nom: string }[];
  ouvert: string;
  pied: string;
}

/** Ce qu'un héros règle sur la part commune : le héros, sa part, ce que sa bourse contient. */
export interface Part {
  heros: string;
  part: Sous;
  avoir: Sous;
}

/** Une voie offerte sur une page de service (un soin, une vente, un travail) : son id (son pictogramme), son nom, son
 *  Test, ce qu'elle fait, son prix ; `maison`, un prix de valeur maison ; `prise`, la voie choisie ; fermée, sa raison. */
export interface Voie {
  id: string;
  nom: string;
  test: string;
  texte?: string;
  prix?: Sous;
  maison?: true;
  prise?: true;
  refus?: string;
}

/* ───────── la nuit ───────── */

/** Une offre de l'hôte d'une auberge : son id (son pictogramme), son nom, ses lits ou son prix par tête, son prix ;
 *  `prise`. */
export interface OffreDeLAuberge {
  id: 'commune' | 'privee' | 'grande' | 'repas';
  nom: string;
  lits?: number;
  parTete?: true;
  prix: Sous;
  prise?: true;
}

/** Un poste de la scène où l'on pose un héros : son id (sa place sur le décor), son nom, ce qu'on y fait et son prix,
 *  ses titulaires (des héros ou un PNJ), `place`, il en prend un de plus ; `vise`, la place que le héros choisi prendra ;
 *  fermé, sa raison, lue au survol. */
export interface PosteDuLieu {
  id: string;
  nom: string;
  sous: string;
  prix?: Sous;
  tenants?: string[];
  place?: true;
  vise?: true;
  refus?: string;
  survol?: true;
}

/** Un abri pour la nuit : son id, son nom, ses places ; le Test qui le dresse. */
export interface Abri {
  id: 'chambre' | 'tente' | 'belle-etoile' | 'fortune';
  nom: string;
  places?: number;
  test?: string;
}

/** Qui dort où : l'abri tenu et ceux qu'on peut choisir à sa place, les héros dedans et ceux qui restent dehors, le sac
 *  de couchage (son bonus au froid, ceux qui en ont un), le temps, ce que la nuit jouera, les parts de la note,
 *  l'action. */
export interface Dortoir {
  abri: Abri;
  abris?: Abri[];
  dedans: string[];
  dehors: string[];
  sac?: { bonus: number; porteurs: string[] };
  temps?: string;
  jouera?: { id: 'froid' | 'repos'; nom: string; jet: string }[];
  parts?: Part[];
  action: string;
}

/** La partie d'un jeu de taverne : le jeu et sa règle, les jeux de la maison (leur id, leur nom), ceux qui sont à la
 *  table (leur id, ce qu'ils y sont), la mise du héros choisi, le pot, sa bourse, l'action. */
export interface PartieDeTaverne {
  jeu: { id: string; nom: string; sous: string; regle: string };
  jeux: { id: string; nom: string }[];
  table: { qui: string; nom: string; role: string }[];
  mise: { heros: string; mise: Sous; pot: Sous; joueurs: number; avoir: Sous };
  action: string;
}

/** Un héros de la nuit : celui du bandeau, et ce qu'il mangera à la halte. */
export interface HerosDeLaNuit extends HerosDuGroupe {
  nourriture?: { valeurs: string[]; tenue: number };
}

/** La nuit, écran unique de l'auberge et de la halte : le décor, le titre, le récit de la halte ; à gauche l'hôte et ses
 *  offres, ou le rail des services de la maison ; les postes de la scène ; à droite qui dort où, ou la partie d'un jeu ;
 *  le retour, le groupe. */
export interface Nuit {
  nom: string;
  gabarit: 'lieu-et-voyage';
  decor: 'auberge' | 'taverne' | 'bivouac';
  titre: TitreDuLieu;
  recit?: { lieu: string; texte: string };
  hote?: HoteDuLieu & { offres: OffreDeLAuberge[] };
  rail?: Rail;
  postes?: PosteDuLieu[];
  dortoir?: Dortoir;
  partie?: PartieDeTaverne;
  retour: string;
  groupe: HerosDeLaNuit[];
}

/* ───────── les soins ───────── */

/** Les soins, chez le médecin d'un lieu ou entre héros dans la salle : le titre, le rail du quartier, le médecin, le
 *  patient et son mal, les actes, ce qu'il paie et sa bourse, l'action et sa note, le retour, le groupe. */
export interface Soins {
  nom: string;
  gabarit: 'lieu-et-voyage';
  decor: 'cabinet' | 'salle';
  titre: TitreDuLieu;
  rail?: Rail;
  hote?: HoteDuLieu;
  patient: { qui: string; mal?: string };
  actes: Voie[];
  paiement?: { aPayer: Sous; avoir: Sous };
  action: string;
  note?: string;
  retour: string;
  groupe: HerosDuGroupe[];
}

/* ───────── le commerce ───────── */

/** Une offre d'un négociant : sa denrée (son pictogramme), son nom, son négociant, ce qu'il en a, son prix de base à
 *  l'Encombrement, l'estimation avant Marchandage, `surplus` ; `depliee`, ses mesures et ses gestes se lisent ; `choisie`. */
export interface OffreDeNegoce {
  role: 'offre';
  denree: string;
  nom: string;
  negociant: string;
  disponible: number;
  prixDeBase: Sous;
  estimation?: Sous;
  surplus?: true;
  gestes?: Geste[];
  depliee?: true;
  choisie?: true;
}

/** Un porteur du groupe : son id (son pictogramme), son nom, ce qu'il est, son Encombrement porté sur sa charge, la part
 *  prévue, le lot qu'il porte (`pris`, celui que l'on traite), les vivres et l'eau d'une cale ; `choisi`. */
export interface Porteur {
  role: 'porteur';
  id: 'mule' | 'charrette' | 'cale';
  nom: string;
  sous: string;
  porte: number;
  charge: number;
  ajout?: number;
  lot?: { denree: string; nom: string; enc: number; pris?: true };
  vivres?: { rations: number; eau: number };
  choisi?: true;
}

/** Le navire du groupe : son nom, ce qu'il est, sa coque, ses Salissures, sa cale, son équipage et l'embauche prévue. */
export interface NavireAQuai {
  role: 'navire';
  nom: string;
  sous: string;
  coque?: { blessures: number; max: number };
  salissures?: number;
  cale?: { porte: number; charge: number };
  equipage?: { abord: number; sur: number; ajout: number };
}

/** Un service sur son bâtiment : son id (son pictogramme et sa place), son nom, ce qu'on y fait ; déplié, ce que dit
 *  son hôte et les gestes qu'il offre (leur id, leur pictogramme ; leur libellé). */
export interface ServiceDuQuai {
  role: 'service';
  id: string;
  nom: string;
  sous?: string;
  accueil?: { dit: string; gestes: { id: 'entrer' | 'dormir' | 'informations'; libelle: string }[] };
}

/** Le constructeur naval : son nom, ce qu'il offre, ses Améliorations (leur nom, leur Encombrement, leur prix ; `prise`,
 *  `fermee`). */
export interface Constructeur {
  role: 'constructeur';
  nom: string;
  sous: string;
  ameliorations: { nom: string; enc: number; prix: Sous; prise?: true; fermee?: true }[];
}

/** Ce qui se pose dans la scène d'un commerce. */
export type HoteDuCommerce = OffreDeNegoce | Porteur | NavireAQuai | ServiceDuQuai | Constructeur;

/** Le détail d'une ligne de compte : un Encombrement ou un nombre et leur prix à l'unité, un pourcentage. */
export type DetailDeCompte = { enc: number; a: Sous } | { nombre: number; a: Sous } | { pourcent: number };

/** Une ligne de compte : son libellé, son détail, sa valeur (un prix, des DR et qui les prend, des mots et leur bonus). */
export interface LigneDeCompte {
  libelle: string;
  detail?: DetailDeCompte;
  valeur: { prix: Sous } | { dr: number; qui?: string } | { texte: string; plus?: number };
}

/** Un bloc d'une page de service. */
export type BlocDePage =
  /** Une phrase de la page. */
  | { bloc: 'texte'; texte: string }
  /** Les porteurs à choisir : leur id, leur nom, leur Encombrement porté sur leur charge, la part prévue ; `pris`. */
  | { bloc: 'porteurs'; porteurs: { id: Porteur['id']; nom: string; porte: number; charge: number; ajout?: number; pris?: true }[] }
  /** Une quantité réglée entre ses bornes. */
  | { bloc: 'quantite'; libelle: string; valeur: number; min: number; max: number }
  /** Des lignes de faits. */
  | { bloc: 'faits'; lignes: LigneDeCompte[] }
  /** Un compte et son total. */
  | { bloc: 'compte'; lignes: LigneDeCompte[]; total: { libelle: string; prix: Sous } }
  /** Les voies offertes. */
  | { bloc: 'voies'; voies: Voie[] }
  /** Les parts des bourses du groupe. */
  | { bloc: 'parts'; parts: Part[] }
  /** Des lignes à choisir ou à régler : leur nom, ce qu'elles sont, leur prix, ce qu'on en a ou en veut ; `reglable`, le
   *  nombre se règle ; `prise`. */
  | { bloc: 'lignes'; lignes: { nom: string; sous?: string; prix: Sous; nombre: number; prise?: true }[]; reglable?: true }
  /** Un nombre à régler. */
  | { bloc: 'nombre'; libelle: string; valeur: number };

/** La page d'un service, sur parchemin à droite : son titre, son nom et ce qu'elle traite, ses blocs, ses gestes, sa
 *  note. */
export interface PageDeService {
  titre: string;
  nom: string;
  sous: string;
  blocs: BlocDePage[];
  gestes: Geste[];
  note?: string;
}

/** Un départ : la destination, la voie, sa longueur, chaque moyen d'y aller et ses jours ; la place qu'une voiture vend,
 *  son prix et sa classe. */
export interface Depart {
  vers: string;
  par: string;
  distance: number;
  unite: 'milles' | 'km';
  moyens: { id: 'navire' | 'pied' | 'diligence'; jours: number }[];
  place?: { prix: Sous; classe: string };
}

/** Un lieu à services, la halle, le port ou le relais où l'on arrive : le décor, le titre, l'arrivée (le lieu, les heures
 *  de route), le récit ; le rail des services ; la rumeur du marché ; ce qui se pose dans la scène ; la page du service
 *  ouvert ; la carte (celle du port, ou le trajet qui part d'ici) et ses départs ; le retour ; le groupe, ou la fenêtre du
 *  Marchandage qui prend sa place, et les combattants qu'elle nomme. */
export interface Commerce {
  nom: string;
  gabarit: 'lieu-et-voyage';
  decor: 'halle' | 'quai' | 'relais';
  titre: TitreDuLieu;
  arrivee?: { lieu: string; heures: number };
  recit?: string;
  rail?: Rail;
  rumeur?: { titre: string; texte: string };
  scene: HoteDuCommerce[];
  page?: PageDeService;
  carte?: { departs: Depart[]; ouvrir: string; trajet?: Trajet };
  retour: string;
  groupe?: HerosDuGroupe[];
  fenetre?: Fenetre;
  combattants?: Record<string, Combattant>;
  main?: MainAilleurs;
}

/** Le siège d'une partie à plusieurs : le nom de son joueur ; `hote`, `vous`, `absent` (il se reconnecte). */
export interface Joueur {
  nom: string;
  hote?: true;
  vous?: true;
  absent?: true;
}

/** La main tenue par un autre siège, vue d'un invité : le joueur qui la tient, ce qu'il fait, le code de la partie, la
 *  raison qui ferme les gestes de la page ; ce que chaque héros du groupe dit de son joueur. */
export interface MainAilleurs {
  tient: Joueur;
  fait: string;
  partie: string;
  refus: string;
  joueurs: Record<string, Joueur>;
}

/* ───────── les dossiers ───────── */

/** Un bloc d'une section du dossier. */
export type BlocDuDossier =
  /** Les traits de la possession : leur id (leur pictogramme), leur nom, leur règle. */
  | { bloc: 'traits'; traits: { id: string; nom: string; texte: string }[] }
  /** Les réserves du navire : son eau douce en litres, ses vivres en rations, ses Salissures, ses avaries. */
  | { bloc: 'reserves'; eau: number; vivres: number; salissures: number; avaries: number }
  /** Le texte du livre. */
  | { bloc: 'livre'; texte: string }
  /** La cale : son Encombrement porté sur sa capacité. */
  | { bloc: 'cale'; porte: number; capacite: number }
  /** Les lots en cale : leur nom, leur Encombrement ; `choisi`. */
  | { bloc: 'lots'; lots: { nom: string; enc: number; choisi?: true }[] }
  /** Déplacer le lot choisi : vers quels porteurs (leur buste, leur maître, leur charge), combien, sur ce que le lot
   *  compte. */
  | { bloc: 'deplacer'; lot: string; vers: { genre: string; nom: string; de: string; porte: number; charge: number; choisi?: true }[]; quantite: { valeur: number; sur: number; place: number } }
  /** Les possessions à bord : leur buste, leur nom, ce qu'elles sont et leur maître, leur Encombrement ; la place prise. */
  | { bloc: 'aBord'; porte: number; capacite: number; possessions: { genre: string; nom: string; modele: string; de: string; enc: number }[] }
  /** Où se trouve la possession, les gestes qui la déplacent. */
  | { bloc: 'lieu'; ou: string; gestes: Geste[] }
  /** Embarquer sur un navire du groupe qui a la place : les navires (leur nom, leur modèle, la place prise sur leur
   *  capacité), ce qui embarque et son Encombrement. */
  | { bloc: 'embarquer'; navires: { nom: string; modele: string; porte: number; capacite: number; choisi?: true }[]; charge: number }
  /** L'abandon demandé, à confirmer. */
  | { bloc: 'abandon'; nom: string };

/** Le dossier d'une possession, au gabarit de la fiche : son buste, son nom (en saisie quand on le renomme), son modèle, sa
 *  nature et son maître, sa longueur, son prix ; ses mesures (sur leur maximum, ou sur cent), ses compteurs, son profil,
 *  ses sections et celle qui est ouverte, ses blocs ; les combattants qui le possèdent. */
export interface Dossier {
  nom: string;
  gabarit: 'fiche';
  possession: { genre: 'navire' | 'mule' | 'charrette'; nom: string; saisie?: true; modele: string; nature: string; de?: string; longueur?: number; prix: Sous };
  mesures: { nom: string; valeur: number; sur?: number; teinte: 'cire' | 'or' }[];
  compteurs: { nom: string; valeur: number }[];
  profil: { titre: string; caracs: { nom: string; valeur: number | null; signe?: true; unite?: string }[] };
  sections: string[];
  ouverte: string;
  blocs: BlocDuDossier[];
  combattants: Record<string, Combattant>;
}

/* ───────── l'exploration et le récit ───────── */

/** Le regard tenu sur la scène (`REGARDS`, `src/noyau/monde/aretes.ts`) : isométrique, du dessus, par les yeux du meneur. */
export type Regard = 'tactique' | 'plateau' | 'immersion';

/** Une chose de la scène à portée du groupe : sa place dans le décor (son id), son nom, le geste qu'elle offre (son id, son
 *  libellé) ; `survolee`, ce qu'on en sait, lu sous le curseur ou le point de mire ; `signalee`, son nom et son geste se
 *  lisent sur la scène. */
export interface ChoseDeLaScene {
  id: string;
  nom: string;
  geste: { id: 'franchir' | 'parler' | 'fouiller' | 'ramasser' | 'lire' | 'enjamber'; libelle: string };
  survolee?: string;
  signalee?: true;
}

/** Une ligne du journal hors combat : une phrase, ou la borne d'un moment. */
export type LigneDuJournal = string | { moment: string };

/** Un document remis : d'où il vient, son titre et son sous-titre, son texte par paragraphes, sa signature, le sceau qui
 *  le ferme, le héros qui le tient ; `relu`, rouvert depuis le carnet. */
export interface DocumentRemis {
  provenance: string;
  titre: string;
  sous?: string;
  paragraphes: string[];
  signature: string[];
  sceau: string;
  heros: string;
  relu?: true;
}

/** Ce qu'une fouille trouve : sur qui, le héros qui fouille, ce qu'il voit, l'argent réparti entre les bourses, la charge
 *  de chaque héros (son Encombrement porté sur ce qu'il peut porter), les objets (leur id, leur nom, leur Encombrement), le
 *  héros qui prend ce qui reste, les gestes. */
export interface Fouille {
  sur: string;
  par: string;
  texte: string;
  argent: Sous;
  charges: { qui: string; enc: number; max: number }[];
  objets: { id: string; nom: string; enc: number }[];
  reste: string;
  gestes: Geste[];
}

/** L'exploration d'un lieu, et ce qui s'y pose : le décor (la salle, la route), le titre, le regard tenu, où se tient le
 *  groupe dans la salle et la chose vers laquelle le meneur marche, les choses à portée, l'invite posée sur une chose de la
 *  scène, les gestes du groupe (leur id, leur libellé), les écrans à ouvrir, le journal (la ligne neuve en dernier), le
 *  retour ; le document remis, la fouille ; les combattants que la fenêtre nomme ; le groupe, ou la fenêtre qui prend sa
 *  place. */
export interface Exploration {
  nom: string;
  gabarit: 'lieu-et-voyage';
  decor: 'salle' | 'grand-route';
  titre: TitreDuLieu;
  regard?: Regard;
  groupeEn?: 'entree' | 'comptoir' | 'avis';
  marcheVers?: string;
  choses?: ChoseDeLaScene[];
  invite?: { sur: string; titre: string; texte: string };
  gestes?: { id: 'soigner' | 'reposer' | 'fouiller'; libelle: string }[];
  ouvrir?: { id: 'carte' | 'carnet'; libelle: string }[];
  journal?: LigneDuJournal[];
  retour?: string;
  document?: DocumentRemis;
  fouille?: Fouille;
  combattants: Record<string, Combattant>;
  groupe?: HerosDuGroupe[];
  fenetre?: Fenetre;
}

/** Un lieu connu sur la carte du monde : son id (son emplacement), son nom, ce qu'il est, sa distance ; `ici`, le groupe
 *  s'y tient ; `choisi`, la destination. */
export interface LieuDuMonde {
  id: string;
  nom: string;
  nature: string;
  distance?: number;
  ici?: true;
  choisi?: true;
}

/** Un moyen d'aller à la destination : son id (son pictogramme), ses jours, ses nuits et où elles se passent, le prix d'une
 *  place dehors et dedans, par tête ; `pris`. */
export interface MoyenDeVoyage {
  id: 'diligence' | 'pied';
  jours: number;
  nuits: { nombre: number; a: 'auberge' | 'route' };
  place?: { dehors: Sous; dedans: Sous };
  pris?: true;
}

/** La carte du monde : le titre, les lieux connus, la destination (son nom, sa voie, son texte, ses étapes et la distance
 *  de chacune depuis la précédente, ses moyens, le geste qui part), le retour ; le groupe et ses bourses, ou la fenêtre qui
 *  prend sa place. */
export interface CarteDuMonde {
  nom: string;
  gabarit: 'lieu-et-voyage';
  decor: 'reikland';
  titre: TitreDuLieu;
  lieux: LieuDuMonde[];
  destination: { nom: string; par: string; texte: string; etapes: { nom: string; km?: number }[]; moyens: MoyenDeVoyage[]; geste: Geste };
  retour: string;
  groupe: HerosDuGroupe[];
  fenetre?: Fenetre;
}

/** Une lecture d'un indice : le titre du document, ses lignes ; `manuscrite`, une lettre écrite à la main. */
export interface Lecture {
  titre: string;
  lignes: string[];
  manuscrite?: true;
}

/** Le carnet d'enquête, posé sur la salle : le titre, les indices épinglés, les affaires (leur id, leur nom, leurs indices
 *  visibles), l'affaire ouverte, les documents remis, les indices de l'affaire ouverte (leur nom ; `nouveau`, `epingle` ;
 *  leurs lectures, la dernière en tête). */
export interface Carnet {
  nom: string;
  gabarit: 'gestion';
  decor: 'salle';
  titre: { nom: string; sous: string };
  epingles: number;
  affaires: { id: string; nom: string; indices: number }[];
  ouverte: string;
  documents: string[];
  indices: { nom: string; nouveau?: true; epingle?: true; lectures: Lecture[] }[];
}

/* ───────── le héros : sa création, sa fiche, sa progression ───────── */

/** Une Caractéristique du profil, par son abréviation. */
export type Carac = 'M' | 'CC' | 'CT' | 'F' | 'E' | 'I' | 'Ag' | 'Dex' | 'Int' | 'FM' | 'Soc' | 'B';

/** Un compte sur un total. */
export interface Compte {
  n: number;
  sur: number;
}

/** Une ligne d'une liste à choisir : son nom, sa précision ; `choisie` ; fermée, sa raison, lue au survol. */
export interface Option {
  nom: string;
  precision?: string;
  choisie?: true;
  refus?: string;
  survol?: true;
}

/** Un fait lu sur une page : sa rubrique, sa valeur. */
export interface Fait {
  rubrique: string;
  valeur: string;
}

/** Ce que le héros en création a retenu à une étape : sa rubrique, ce qui est retenu (un mot, ou un compte sur un total),
 *  sa bourse, les PX qu'il vaut ; sans rien de retenu, le total des PX. */
export interface Acquis {
  rubrique: string;
  valeur?: string | Compte;
  bourse?: Sous;
  px?: number;
}

/** Le héros en création, à droite : son nom (sans nom, il n'en a pas encore), ses acquis, jusqu'où la sanguine est posée
 *  (de 0, au trait, à 1, achevé) ; `palette`, il tient la palette ; le geste qui avance. */
export interface HerosEnCreation {
  nom?: string;
  acquis: Acquis[];
  pose: number;
  palette?: true;
  geste: Geste;
}

/** Une case du profil en création : la Caractéristique, son nom, sa valeur ; ce qu'elle porte (le 2d10 tiré, ou les
 *  points répartis), ou d'où elle vient ; ses Augmentations de carrière. */
export interface CaseEnCreation {
  carac: Carac;
  nom: string;
  valeur: number;
  de?: number;
  points?: number;
  origine?: string;
  augmentations?: number;
}

/** Une répartition d'Augmentations : sa rubrique et sa note, ce qui reste sur le total ; ses lignes (la Caractéristique,
 *  le nom, les Augmentations sur leur maximum, la valeur qui en sort). */
export interface Repartition {
  rubrique: string;
  note: string;
  reste: Compte;
  lignes: { carac?: Carac; nom: string; augmentations: Compte; valeur: number }[];
}

/** Les Caractéristiques : la méthode tenue parmi les trois et ce qu'elle rapporte, les points à répartir et leurs bornes ;
 *  l'espèce et ce qu'elle ajoute, le profil, la Caractéristique pressée, sa page, ce que les dés portent quand on les
 *  réassigne ; les répartitions de carrière, de Destin et de Résilience. */
export interface PageDesCaracteristiques {
  etape: 'caracteristiques';
  methodes: { id: 'garder' | 'reassigner' | 'points'; nom: string; px?: number }[];
  methode: 'garder' | 'reassigner' | 'points';
  points?: { reste: Compte; min: number; max: number };
  espece: { nom: string; valeur: number };
  profil: CaseEnCreation[];
  pressee: Carac;
  texte?: string;
  faits: Fait[];
  jets?: { de: number; carac: Carac }[];
  repartitions: Repartition[];
}

/** Le signe astral : le d100 et le signe qu'il tire, ses PX ; les vingt signes, le signe tenu ; les variantes que le d10
 *  départage ; la page du signe (son nom de constellation, son nom classique, ses dates, ce qu'on voit au ciel, ses
 *  attributs de départ, son texte). */
export interface PageDuSigne {
  etape: 'signe';
  tirage: { de: number; px: number };
  signes: string[];
  tenu: string;
  variantes: { d10: string; nom: string }[];
  page: { constellation: string; classique: string; dates: string; ciel: string; attributs: { carac: Carac; valeur: number }[]; texte: string };
}

/** Une Compétence de race : sa Caractéristique et sa valeur, son nom, sa précision, le palier pris. */
export interface CompetenceDeRace {
  carac: Carac;
  base: number;
  nom: string;
  precision?: string;
  palier: 0 | 3 | 5;
}

/** Les Compétences de race : l'espèce, les Compétences, chaque palier et ce qui en est pris. */
export interface PageDesCompetencesDeRace {
  etape: 'competencesDeRace';
  espece: string;
  competences: CompetenceDeRace[];
  paliers: { palier: 3 | 5; pris: Compte }[];
}

/** Une Compétence de carrière : sa Caractéristique, son nom, sa précision, ses Augmentations de carrière sur leur
 *  maximum, celles de race, son Test ; `pressee`. */
export interface CompetenceDeCarriere {
  carac: Carac;
  nom: string;
  precision?: string;
  augmentations: Compte;
  race: number;
  test: number;
  pressee?: true;
}

/** Les Compétences de carrière : le niveau, les Compétences, ce qui reste à répartir ; la page de la Compétence pressée
 *  (sa Caractéristique et sa valeur, ses spécialisations, son texte). */
export interface PageDesCompetencesDeCarriere {
  etape: 'competencesDeCarriere';
  niveau: string;
  competences: CompetenceDeCarriere[];
  reste: Compte;
  page: { carac: { nom: string; valeur: number }; specialisations: string[]; texte: string[] };
}

/** Un Talent tiré au d100 : le dé, le Talent ; `utilisation`, il se précise ; déjà retenu, ce qu'il en reste et le geste
 *  qui le relance. */
export interface TalentTire {
  de: number;
  nom: string;
  precision?: string;
  utilisation?: true;
  doublon?: { raison: string; relance: string };
}

/** Les Talents : ceux de la race, acquis et au choix ; les trois tirages ; le Talent de carrière ; la page du Talent de
 *  carrière retenu (son pictogramme, son niveau, son Maxi, ses Tests, son texte), ou celle des Sorts qu'il inclut
 *  (combien, lesquels sont retenus, la raison de ceux qu'on ne peut plus prendre, son texte). */
export interface PageDesTalents {
  etape: 'talents';
  race: { acquis: string[]; auChoix: Option[] };
  tirages: TalentTire[];
  carriere: Option[];
  page:
    | { talent: string; icone: string; niveau: string; maxi: string; tests: string; texte: string }
    | { talent: string; niveau: string; reste: Compte; sorts: { nom: string; retenu?: true; survol?: true }[]; refus: string; texte: string };
}

/** Un objet du bagage : son dessin, son nom, sa note, son nombre, la somme qu'il contient ; `choisi`. */
export interface ObjetDuBagage {
  id: 'costume' | 'dague' | 'bourse' | 'pinceau' | 'pince' | 'cure' | 'peigne';
  nom: string;
  note?: string;
  nombre?: number;
  somme?: Sous;
  choisi?: true;
}

/** Les possessions : la bourse au dé (le jet, la somme, le Statut, la formule), le choix du niveau, les dotations ; le
 *  bagage, l'objet pris (son pictogramme, son nom, ce qu'il est, son prix). */
export interface PageDesPossessions {
  etape: 'possessions';
  bourse: { de: number; somme: Sous; statut: string; formule: string };
  auChoix: { niveau: string; options: Option[] };
  dotations: { rubrique: string; objets: { nom: string; precision?: string; note?: string; nombre?: number }[] }[];
  bagage: ObjetDuBagage[];
  pris: { icone: string; nom: string; sous: string; prix: Sous };
}

/** Un trait du physique tiré aux dés : le jet, son nom, sa formule, ce qu'il donne. */
export interface Physique {
  de: number;
  nom: string;
  formule: string;
  valeur: string;
}

/** L'identité : le sexe tenu, le nom, le physique ; la Motivation et les Ambitions, celle qu'on écrit ; l'espèce, la
 *  carrière, la marque de la signature. */
export interface PageDeLIdentite {
  etape: 'identite';
  sexe: { valeurs: string[]; tenue: number };
  nom: string;
  physique: Physique[];
  ecrits: { nom: string; texte: string; saisi?: true }[];
  espece: string;
  carriere: string;
  marque: string;
}

/** La présentation, le héros achevé : son buste, son nom, son espèce, sa carrière et sa Classe, son physique, ses
 *  Blessures, ses réserves, son signe, son Statut, sa bourse, sa Motivation ; son profil, ses Compétences, ses Talents. */
export interface PageDeLaPresentation {
  etape: 'presentation';
  buste: string;
  nom: string;
  espece: string;
  carriere: string;
  classe: string;
  physique: Fait[];
  blessures: Compte;
  reserves: { nom: string; valeur: number }[];
  signe: string;
  statut: string;
  bourse: Sous;
  motivation: string;
  profil: { carac: Carac; valeur: number }[];
  competences: { carac: Carac; nom: string; precision?: string; valeur: number }[];
  talents: string[];
}

/** La création d'un héros, écran à étapes posé sur le mur : les étapes et celle qui s'ouvre (son rang, de 1), sa page, le
 *  héros en création, le groupe. */
export interface Creation {
  nom: string;
  gabarit: 'fiche';
  etapes: string[];
  rang: number;
  page: PageDesCaracteristiques | PageDuSigne | PageDesCompetencesDeRace | PageDesCompetencesDeCarriere | PageDesTalents | PageDesPossessions | PageDeLIdentite | PageDeLaPresentation;
  heros: HerosEnCreation;
  groupe: HerosDuGroupe[];
}

/** Une main d'un set d'armes : l'arme (son pictogramme, son nom), ou vide. */
export type Main = { id: string; nom: string } | null;

/** Un set d'armes : ses deux mains ; `enMain`, celui que le héros tient ; `deuxMains`, l'arme prend la seconde main ;
 *  le refus de le supprimer, lu au survol. */
export interface SetDArmes {
  principale: Main;
  secondaire: Main;
  enMain?: true;
  deuxMains?: true;
  refus?: string;
  survol?: true;
}

/** Un objet du héros : son pictogramme, son nom, sa précision, où il est, ou combien il en a ; `pressee`. */
export interface ObjetDuHeros {
  id: string;
  nom: string;
  precision?: string;
  ou?: string;
  nombre?: number;
  pressee?: true;
}

/** Un geste sur l'objet ouvert : son libellé, ce vers quoi il va ; `principal` ; fermé, sa raison, lue au survol. */
export interface GesteDObjet extends Geste {
  vers?: string;
}

/** La ligne pressée, ouverte : son pictogramme, son nom, ce qu'il est ; ses faits, les Sorts auxquels le lier, les paliers
 *  d'un entraînement et les PX à dépenser, la Faveur (sa nature, son solde, ce que coûte la rompre) ; ses gestes. */
export interface ObjetOuvert {
  icone: string;
  nom: string;
  sous: string;
  faits?: Fait[];
  lier?: { nom: string; ni: number; choisi?: true }[];
  entrainement?: { px: number; paliers: { texte: string; px: number; acquis?: true }[] };
  faveur?: { nature: string; solde: Compte; rompre: string };
  gestes: GesteDObjet[];
}

/** L'identité du héros sur sa fiche : son buste, son nom, son espèce, sa carrière, ses Blessures, ses réserves. */
export interface IdentiteDuHeros {
  id: string;
  nom: string;
  espece: string;
  carriere: string;
  blessures: Compte;
  reserves: { nom: string; valeur: number }[];
}

/** La fiche du héros, ouverte sur ses possessions : l'identité, le profil, les sections ; les sets d'armes, ce qu'il porte,
 *  ce qui est en vrac ou rangé, les Faveurs dues (le créancier, le niveau, le solde), la ligne ouverte ; le groupe. */
export interface FicheDuHeros {
  nom: string;
  gabarit: 'fiche';
  identite: IdentiteDuHeros;
  profil: { carac: Carac; valeur: number }[];
  sections: string[];
  ouverte: string;
  sets: SetDArmes[];
  porte: ObjetDuHeros[];
  vrac: ObjetDuHeros[];
  faveurs?: { creancier: string; niveau: string; solde: Compte; pressee?: true }[];
  ouvert: ObjetOuvert;
  groupe: HerosDuGroupe[];
}

/** L'identité du héros qui progresse : son buste, son nom, son espèce, son niveau, sa Classe et son rang ; ses PX et ce
 *  qu'il en restera après l'achat pressé ; ce que le niveau exige pour s'achever ; ses gestes, ou le niveau achevé, et la
 *  note qui les suit. */
export interface IdentiteQuiProgresse {
  id: string;
  nom: string;
  espece: string;
  niveau: string;
  classe: string;
  rang: number;
  px: number;
  apres?: number;
  exigences: { texte: string; fait?: true; compte?: Compte }[];
  gestes?: (Geste & { px?: number })[];
  acheve?: true;
  note: string;
}

/** Une Compétence à augmenter : sa Caractéristique, son nom, sa précision, ses Augmentations, son Test, son prix ;
 *  `exigee`, elle compte déjà pour le niveau ; `pressee`. Un emplacement « (Au choix) » : `aDesigner` ; ouvert, ses
 *  spécialisations et celle retenue. */
export interface CompetenceAAugmenter {
  carac: Carac;
  nom: string;
  precision?: string;
  augmentations: number;
  test: number;
  px: number;
  exigee?: true;
  pressee?: true;
  aDesigner?: true;
  specialisations?: { noms: string[]; retenue: string };
}

/** Un Talent à prendre : son pictogramme, son nom, ce qu'il est ; son prix, ou la raison qui le ferme. */
export interface TalentAPrendre {
  icone: string;
  nom: string;
  sous: string;
  px?: number;
  refus?: string;
}

/** Un Sort à apprendre : son nom, son NI, son prix ; connu, le prix de son composant. */
export interface SortAApprendre {
  nom: string;
  ni: number;
  px?: number;
  composant?: Sous;
}

/** La dépense d'expérience, au gabarit de la fiche : l'identité, le profil (la valeur, les Augmentations, le prix de la
 *  suivante, `carriere`), les Compétences de la carrière et celles hors carrière ; l'onglet ouvert, ses Talents ou ses
 *  Sorts par liste (la rubrique, sa note) et la bourse qui paie les composants ; le groupe. */
export interface DepenseDExperience {
  nom: string;
  gabarit: 'fiche';
  identite: IdentiteQuiProgresse;
  profil: { carac: Carac; valeur: number; augmentations?: number; px?: number; carriere?: true }[];
  competences: CompetenceAAugmenter[];
  horsCarriere: number;
  ouvert: 'Talents' | 'Sorts';
  talents?: { rubrique: string; note: string; talents: TalentAPrendre[] };
  sorts?: { listes: { rubrique: string; note: string; sorts: SortAApprendre[] }[]; bourse: { heros: string; avoir: Sous } };
  groupe: HerosDuGroupe[];
}

/** Une station du chemin de carrière : son nom, son niveau, son Statut ; `tenu`, `acheve` ; son état (passée ou tenue,
 *  visée, ouverte par la règle des sauts, hors d'atteinte) ; ses PX ; la raison qui la ferme, lue au survol. */
export interface Station {
  nom: string;
  niveau: number;
  statut: string;
  tenu?: true;
  acheve?: true;
  etat: 'faite' | 'visee' | 'ouverte' | 'loin';
  px?: number;
  refus?: string;
  survol?: true;
}

/** Le changement de carrière, au gabarit de la fiche : l'identité, le chemin de la carrière (son nom, sa Classe, ses
 *  stations) ; la page du niveau visé (son ruban, son nom, sa carrière, son niveau et son Statut, ce qu'il ouvre, sa note,
 *  le geste et son prix) ; une autre carrière (les Classes et leur prix, les carrières, le niveau d'arrivée, la note) ; le
 *  groupe. */
export interface ChangementDeCarriere {
  nom: string;
  gabarit: 'fiche';
  identite: IdentiteQuiProgresse;
  chemin: { carriere: string; classe: string; stations: Station[] };
  vise: { ruban: string; nom: string; carriere: string; niveau: number; statut: string; ouvre: { rubrique: string; noms: string[] }[]; note: string; geste: string; px: number };
  autre: { classes: { id: string; nom: string; px: number; choisie?: true; fermee?: true }[]; carrieres: Option[]; arrivee?: { valeurs: string[]; tenue: number }; note: string };
  groupe: HerosDuGroupe[];
}

/* ───────── l'accueil et le système ───────── */

/** Un instant de la partie : le lieu, le jour, le mois et l'année impériale, l'heure. */
export interface Instant {
  lieu: string;
  jour: number;
  mois: string;
  annee: number;
  heure: string;
}

/** Une entrée d'un écran d'ouverture, ou un outil : son id (son pictogramme), son libellé ; `principale`. */
export interface Entree {
  id: string;
  libelle: string;
  principale?: true;
}

/** L'écran titre, sur le couchant : le sur-titre, le titre, la campagne ; les entrées de jeu, la dernière sauvegarde que
 *  « Continuer » charge ; les outils. */
export interface Accueil {
  nom: string;
  gabarit: 'ouverture';
  decor: 'couchant';
  titre: { sur: string; nom: string; campagne: string };
  entrees: Entree[];
  derniere: Instant;
  outils: Entree[];
}

/** Le menu de la partie, sur le jeu assombri : le sur-titre, le titre, l'instant ; les entrées, puis la sortie ; l'heure de
 *  la dernière sauvegarde automatique. */
export interface MenuDeLaPartie {
  nom: string;
  gabarit: 'ouverture';
  decor: 'jeu';
  titre: { sur: string; nom: string };
  instant: Instant;
  entrees: Entree[];
  quitter: Entree;
  derniereAuto: string;
}

/** Ce qu'une séance vaut à un héros : son id (son buste), son nom, sa carrière ; sa Motivation, ses Ambitions écrites
 *  (absentes, il n'en a pas noté), sa Détermination ; les cases cochées ; `nouvelle`, le champ de l'Ambition suivante
 *  ouvert. */
export interface HerosDeLaSeance {
  id: string;
  nom: string;
  carriere: string;
  motivation: string;
  courte?: string;
  longue?: string;
  determination: Compte;
  coches: { motivation?: true; courte?: true; longue?: true };
  nouvelle?: 'courte' | 'longue';
}

/** La fin de séance : les héros, les cases du groupe, ce qu'octroie une Ambition accomplie, la phrase de la Chance. */
export interface Seance {
  heros: HerosDeLaSeance[];
  groupe: { courte?: true; longue?: true };
  px: { courte: number; longue: number };
  chance: string;
}

/** Le chapitre, qui s'ouvre ou se clôt sur son carton : le décor, le sur-titre, la campagne et le tome, le chapitre ;
 *  l'ouverture (le texte du chapitre, la compagnie au bandeau) ou la clôture (le sous-titre, ce que la route retiendra,
 *  les lieux révélés, les héros tombés, la fin de séance qu'elle ouvre) ; les gestes. */
export interface Chapitre {
  nom: string;
  gabarit: 'ouverture';
  decor: 'relais' | 'altdorf';
  sur: string;
  campagne?: { nom: string; tome: string };
  chapitre: string;
  texte?: string[];
  groupe?: HerosDuGroupe[];
  cloture?: { sous: string; objectifs: string[]; px: number; lieux: string[]; tombes: string[]; seance: Seance };
  gestes: Geste[];
}

/** La fin de séance, sur le jeu assombri : le titre et l'instant, la séance, le geste qui la termine. */
export interface FinDeSeance {
  nom: string;
  gabarit: 'gestion';
  decor: 'jeu';
  titre: { nom: string; instant: Instant };
  seance: Seance;
  action: string;
}

/** Un emplacement de sauvegarde : son nom ; ce qu'il porte (l'instant de la partie, le jour et l'heure réels) ; `auto`, il
 *  ne se réécrit pas ; `vise`, celui que l'on charge ; `survol`, le curseur sur son « Sauvegarder ». */
export interface Emplacement {
  nom: string;
  partie?: { instant: Instant; le: { date: string; heure: string } };
  auto?: true;
  vise?: true;
  survol?: true;
}

/** Les sauvegardes, sur la table : le titre et l'instant, les emplacements, l'avis d'un emplacement retiré ; la raison qui
 *  ferme « Sauvegarder ». */
export interface Sauvegardes {
  nom: string;
  gabarit: 'gestion';
  decor: 'table';
  titre: { nom: string; instant: Instant };
  emplacements: Emplacement[];
  avis?: string;
  refus?: string;
}

/** Un voyageur à recruter, debout dans la salle : son id (son buste et sa silhouette), son nom, sa carrière ; `vise`. */
export interface Voyageur {
  id: string;
  nom: string;
  carriere: string;
  vise?: true;
}

/** Le genre d'une campagne, que son pictogramme dit : la route, le fleuve, l'arène, l'enquête. */
export type GenreDeCampagne = 'route' | 'fleuve' | 'arene' | 'enquete';

/** La nouvelle partie, dans la salle de l'auberge-relais : le titre et les places du groupe ; l'onglet ouvert (les
 *  pré-tirés ou mes personnages), les voyageurs dans la salle sur leur total ; la campagne choisie et les autres ; le
 *  groupe et la place libre (ce qu'elle dit, ou le siège qui la tiendra) ; `modifier`, la création se rouvre sur un héros. */
export interface NouvellePartie {
  nom: string;
  gabarit: 'gestion';
  decor: 'compagnie';
  titre: { nom: string; sous: string; places: Compte };
  onglet: 'pretires' | 'roster';
  salle: { voyageurs: Voyageur[]; total: number };
  campagne: { sur: string; nom: string; chapitre: string; texte: string; genre: GenreDeCampagne };
  campagnes: { id: string; nom: string; genre: GenreDeCampagne }[];
  groupe: HerosDuGroupe[];
  libre: { nom: string; sous: string; dit?: string; siege?: { valeurs: string[]; tenue: number } };
  modifier?: true;
}

/** Une entrée du Compendium : son nom, sa source (le sigle du livre, la page) ; `pointee`. */
export interface EntreeDuCompendium {
  nom: string;
  source: { livre: string; page: number };
  pointee?: true;
}

/** Un renvoi de la fiche : sa rubrique, son compte, les entrées nommées (le reste se compte). */
export interface Renvoi {
  rubrique: string;
  compte: number;
  noms: string[];
}

/** Un champ du formulaire de l'atelier : son libellé, sa valeur ; `long`, sur plusieurs lignes ; `saisi`, le curseur y
 *  est ; son aide, et ce à quoi elle renvoie. */
export interface ChampDeFormulaire {
  libelle: string;
  valeur: string;
  long?: true;
  saisi?: true;
  aide?: { texte: string; lien?: string };
}

/** Le Compendium, sur la table : le titre, les familles et l'ouverte, ses catégories (leur compte) et l'ouverte, la
 *  recherche, les livres (leur compte) ; la catégorie au feuillet ouvert ; l'entrée pointée, en fiche (ses puces, sa
 *  description, ses liens, ses renvois) ou à l'atelier (ses champs par paires, les champs qu'elle ne porte pas, la
 *  raison qui ferme « Supprimer ») ; « Nouvelle entrée » fermée tant que l'atelier est ouvert. */
export interface Compendium {
  nom: string;
  gabarit: 'gestion';
  decor: 'table';
  titre: { nom: string; sous: string };
  familles: string[];
  famille: string;
  categories: { nom: string; entrees: number }[];
  categorie: string;
  recherche: string;
  livres: { sigle: string; entrees: number }[];
  feuillet: { n: number; sur: number; entrees: EntreeDuCompendium[] };
  genre: string;
  fiche?: { puces: { rubrique: string; valeur: string }[]; description: string[]; liens: string[]; renvois: Renvoi[] };
  atelier?: { paires: ChampDeFormulaire[][]; absents: string[]; refus: string };
}

/** La coop, sur la table : le titre, les quatre sièges de la tablée (leur joueur et les héros qu'il tient, ou à
 *  pourvoir), sa légende ; sans partie, rejoindre par le code et héberger ; en salon, l'invitation (le code, les joueurs
 *  connectés) et l'attribution des héros aux joueurs et du rôle de Maître du Jeu (à un joueur, ou `sans`). */
export interface Coop {
  nom: string;
  gabarit: 'gestion';
  decor: 'table';
  titre: { nom: string; sous: string };
  sieges: { joueur?: Joueur & { qualite: string }; heros: string[] }[];
  legende: string;
  rejoindre?: { code: string; indice: string; nom: string; geste: string };
  heberger?: { aide: string; attente: string; geste: string; refus: string };
  invitation?: { code: string; joueurs: Joueur[]; quitter: string };
  attribution?: { joueurs: string[]; heros: { id: string; nom: string; carriere: string; joueur: string }[]; maitre: { sans: string; joueur?: string; note: string } };
}

/** Un geste de la barre de l'éditeur : son id (son pictogramme), son libellé ; `principal` ; `ferme`. */
export interface GesteDeLEditeur {
  id: string;
  libelle: string;
  principal?: true;
  ferme?: true;
}

/** L'éditeur, son cadre commun : le projet, les documents et l'ouvert, les gestes de la barre par groupe ; les volets de
 *  gauche (leur titre) et l'ouvert ; les outils (leur id, leur nom) et l'armé ; la validation de l'inspecteur. */
export interface Editeur {
  projet: { nom: string; sous: string };
  documents: string[];
  document: string;
  gestes: GesteDeLEditeur[][];
  volets: string[];
  volet: string;
  outils: Entree[];
  outil: string;
  validation?: string;
}

/** Une ligne de l'inspecteur : son libellé ; sa valeur (des mots, un choix parmi des valeurs, oui ou non, une valeur à
 *  faire défiler, un nombre à régler), grisée quand elle est sans objet. */
export type Propriete = { libelle: string; grise?: true } & (
  | { texte: string }
  | { valeurs: string[]; tenue: number }
  | { oui: boolean }
  | { defile: string }
  | { nombre: number }
);

/** Ce que l'inspecteur montre : ce qui est choisi (son genre, où il est, son nom saisi, ses propriétés, son inventaire,
 *  la troupe à poser, les renvois de la logique, « Supprimer »), ou les options de l'outil armé (ses pinceaux, ses
 *  terrains). */
export type Inspecteur =
  | {
    genre: string; ou: string; nom?: string; proprietes: Propriete[]; inventaire?: { vide: string; ajouter: string };
    troupe?: Propriete[]; renvois: { rubrique?: string; noms: string[] }; supprimer?: string;
  }
  | { genre: string; options: string; pinceaux: { valeurs: string[]; tenue: number }; terrains: string[]; terrain: string };

/** L'éditeur de scène : le cadre commun, les scènes du projet et l'ouverte, les gestes du volet des scènes ; les couches
 *  et la tenue (le retrait refusé du rez, lu au survol), le nord en degrés ; sur le plan, la porte ou le personnage
 *  choisi, le pinceau sous le pointeur ; l'inspecteur ; au pied, ce que pointe le curseur et la taille de la scène. */
export interface EditeurDeScene extends Editeur {
  nom: string;
  gabarit: 'edition';
  scenes: { noms: string[]; ouverte: string; gestes: string[] };
  couches: { noms: string[]; tenue: number; ajouter: string; retirer?: { libelle: string; refus: string } };
  nord: number;
  plan: { porte?: true; personnage?: string; pinceau?: number };
  inspecteur: Inspecteur;
  pointe: string[];
  taille: { cases: [number, number]; entites: number };
}

/** Un lieu de la carte du monde : son id, son nom, son genre (son pictogramme), sa place sur la carte. */
export interface LieuDeLaCarte {
  id: string;
  nom: string;
  genre: 'hameau' | 'voyage' | 'village';
  place: [number, number];
}

/** L'éditeur de la carte du monde : le cadre commun, le titre de la carte, les lieux et le choisi, les routes (d'où, vers
 *  où, leur longueur, leurs modes, à double sens) ; l'inspecteur du lieu choisi (ses coordonnées, sa scène, son plan,
 *  ses établissements ; ses routes). */
export interface EditeurDeLaCarte extends Editeur {
  nom: string;
  gabarit: 'edition';
  carte: string;
  lieux: LieuDeLaCarte[];
  choisi: string;
  routes: { de: string; vers: string; km: number; modes: string[]; deuxSens?: true }[];
  lieu: { coordonnees: [number, number]; scene: string; plan: string; etablissements: number };
}
