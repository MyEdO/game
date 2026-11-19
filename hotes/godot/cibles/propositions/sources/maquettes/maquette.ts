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

export type Etat = EtatDeCombat | TourDeCombat | IssueDuCombat | Options | Nuit | Poursuite | BatailleDeMasse | Interlude | Soins | Commerce;

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

/** Celui qui teste : le combattant, son Test et son seuil (`null`, masqué au joueur), ses modificateurs ; tombé, son jet ;
 *  les dés déjà posés d'un jet que l'on reprend. */
export interface Testeur {
  role: 'testeur';
  qui: string;
  test: string;
  seuil: number | null;
  modificateurs?: Modificateur[];
  jet?: JetTombe;
  des?: Des;
}

/** Le héros d'une fenêtre sans dé : ce qui le met en jeu (une réserve, sa compétence et son seuil, le Critique qu'il
 *  porte, l'arme qu'il tient, son engagement : son Avantage contre celui de l'adversaire, ce qui le menace, ses Points de
 *  Corruption sur son seuil, le rôle qu'il tient pour le groupe), ce que son choix coûte, la marque de son mode. */
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
    | { decidePour: string };
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
  | { role: 'marche'; lot: LotMarchande; drNet: number; issue: EnjeuDuMarchandage; avant: Sous; apres: Sous };

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
 *  restants sur ses pas, son Action, son Avantage, sa Détermination ; ses familles d'actions, celle qui est ouverte ; les
 *  outils du tour. */
export interface BarreDeLActif {
  qui: string;
  arme: string;
  adverse?: true;
  mouvement?: { reste: number; sur: number };
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
 *  lignes, la choisie), ce qui se pose par-dessus, les offres du champ. */
export interface TourDeCombat {
  nom: string;
  gabarit: 'combat';
  cour: Cour;
  combattants: Record<string, Combattant>;
  combat: Combat;
  barre: BarreDeLActif;
  liste?: { titre: string; lignes: string[]; choisie: number };
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

/** Un héros du bandeau : son id (son buste), son nom, sa carrière, ses Blessures, ce qu'il dit ; `choisi`. */
export interface HerosDuGroupe {
  id: string;
  nom: string;
  carriere: string;
  blessures: number;
  max: number;
  dit?: Dit;
  choisi?: true;
}

/** Une journée en voyage : son nom, sa date, le jour en mer, le temps ; `ciel`, la teinte de l'arche. */
export interface Journee {
  jour: string;
  date: { jour: number; mois: string };
  enMer: number;
  meteo: string;
  ciel: 'jour';
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
  trajet?: { titre: string; de: string; vers: string; part: number };
  panneau: PanneauDePoursuite | Sommation;
  frise?: { distance: number; sur: number; depart: number; ecart?: number };
  apercu?: { nom: string; test: string; lignes: { qui: string; poste: string; dr: number; double?: true }[] };
  postes?: string;
  combattants: Record<string, Combattant>;
  groupe?: HerosDuGroupe[];
  fenetre?: Fenetre;
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
 *  Test, ce qu'elle fait, son prix ; `maison`, un prix de valeur maison ; `prise`, la voie choisie. */
export interface Voie {
  id: string;
  nom: string;
  test: string;
  texte: string;
  prix?: Sous;
  maison?: true;
  prise?: true;
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
 *  son titulaire (un héros ou un PNJ) ; `vise`, la place que le héros choisi prendra. */
export interface PosteDuLieu {
  id: string;
  nom: string;
  sous: string;
  prix?: Sous;
  tenant?: string;
  vise?: true;
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

/** Les soins d'un lieu : le titre, le rail du quartier, le médecin, le patient et son mal, les actes, ce qu'il paie et
 *  sa bourse, l'action, le retour, le groupe. */
export interface Soins {
  nom: string;
  gabarit: 'lieu-et-voyage';
  decor: 'cabinet';
  titre: TitreDuLieu;
  rail: Rail;
  hote: HoteDuLieu;
  patient: { qui: string; mal: string };
  actes: Voie[];
  aPayer: Sous;
  avoir: Sous;
  action: string;
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
 *  son hôte et le geste qui y entre. */
export interface ServiceDuQuai {
  role: 'service';
  id: string;
  nom: string;
  sous: string;
  accueil?: { dit: string; geste: string };
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

/** Un départ en mer : la destination, la mer, la distance en milles, les jours. */
export interface Depart {
  vers: string;
  par: string;
  milles: number;
  jours: number;
}

/** Un commerce, la halle ou le port : le décor, le titre, le récit du port ; le rail des services ; la rumeur du marché ;
 *  ce qui se pose dans la scène ; la page du service ouvert ; la carte du port et ses départs ; le retour ; le groupe, ou
 *  la fenêtre du Marchandage qui prend sa place, et les combattants qu'elle nomme. */
export interface Commerce {
  nom: string;
  gabarit: 'lieu-et-voyage';
  decor: 'halle' | 'quai';
  titre: TitreDuLieu;
  recit?: string;
  rail?: Rail;
  rumeur?: { titre: string; texte: string };
  scene: HoteDuCommerce[];
  page?: PageDeService;
  carte?: { departs: Depart[]; ouvrir: string };
  retour: string;
  groupe?: HerosDuGroupe[];
  fenetre?: Fenetre;
  combattants?: Record<string, Combattant>;
}
