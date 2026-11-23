/**
 * Les valeurs d'adaptation du roguelite : bâtiments et paliers, carrières du roster, destinations, prix, gains.
 */
import { nomDeCarriereDuLivre, type Epreuve, type Identite, type PoidsDArmure } from '../noyau';

import { profil } from './outils';

export type IdBatiment = 'relais' | 'temple' | 'salle' | 'forge' | 'cartographe' | 'peage' | 'memorial';

export interface Batiment { id: IdBatiment; nom: string; role: string; paliers: { cout: number; trophees: number; effet: string }[] }

export const BATIMENTS: readonly Batiment[] = [
  { id: 'relais', nom: 'Auberge relais', role: 'Recrues et provisions', paliers: [
    { cout: 0, trophees: 0, effet: '2 candidats ; potions de guérison' },
    { cout: 120, trophees: 0, effet: '3 candidats, carrières d’aventure ; potions de vitalité' },
    { cout: 300, trophees: 1, effet: '4 candidats, carrières d’élite' },
  ] },
  { id: 'temple', nom: 'Hospice de Shallya', role: 'Soins et chirurgie', paliers: [
    { cout: 0, trophees: 0, effet: 'Fermée : seuls les héros restés au hameau se reposent' },
    { cout: 80, trophees: 0, effet: 'Soins à 15 CO ; les sœurs pansent les plaies à l’hospice' },
    { cout: 220, trophees: 1, effet: 'Soins à 5 CO ; un chirurgien opère ; Larmes de Shallya' },
    { cout: 450, trophees: 2, effet: 'Soins gratuits, hospice à moitié prix, +1 Destin à qui n’en a plus' },
  ] },
  { id: 'salle', nom: 'Salle d’armes', role: 'Carrières', paliers: [
    { cout: 0, trophees: 0, effet: 'Fermée : les PX attendent' },
    { cout: 100, trophees: 0, effet: 'Avancements, jusqu’au niveau 2 de carrière' },
    { cout: 260, trophees: 1, effet: 'Jusqu’au niveau 3 de carrière' },
    { cout: 500, trophees: 2, effet: 'Jusqu’au niveau 4 de carrière' },
  ] },
  { id: 'forge', nom: 'Forge', role: 'Armes et armures', paliers: [
    { cout: 0, trophees: 0, effet: 'Armes communes, armure légère' },
    { cout: 110, trophees: 0, effet: 'Lames et arcs de guerre, armure moyenne' },
    { cout: 280, trophees: 1, effet: 'Armes lourdes, arc long, armure lourde' },
  ] },
  { id: 'cartographe', nom: 'Cartographe', role: 'Destinations', paliers: [
    { cout: 0, trophees: 0, effet: 'La lisière du Reikwald' },
    { cout: 150, trophees: 1, effet: 'Ouvre les Tertres de Grisefosse' },
    { cout: 320, trophees: 2, effet: 'Ouvre la Clairière des hardes' },
    { cout: 600, trophees: 3, effet: 'Ouvre l’Autel du Chaos' },
  ] },
  { id: 'peage', nom: 'Péage du pont', role: 'Revenu', paliers: [
    { cout: 0, trophees: 0, effet: 'Ruiné : aucun revenu' },
    { cout: 90, trophees: 0, effet: '+10 CO par expédition qui franchit une salle' },
    { cout: 240, trophees: 1, effet: '+25 CO' },
    { cout: 480, trophees: 2, effet: '+50 CO' },
  ] },
  { id: 'memorial', nom: 'Jardin de Morr', role: 'Mémoire', paliers: [
    { cout: 0, trophees: 0, effet: 'Un champ en friche' },
    { cout: 110, trophees: 0, effet: 'Chaque recrue arrive avec 10 PX par héros tombé (max 100)' },
    { cout: 300, trophees: 1, effet: '20 PX par héros tombé (max 200)' },
  ] },
];

/** La voie d'un lanceur : le Talent de niveau 2 qui ouvre les sorts ou les miracles, sa spécialisation, et ce qui
 *  s'achète ensuite. */
export interface Voie { talent: 'magie-des-arcanes' | 'invocation'; spec: string; nom: string; sorts: readonly string[] }
/** Le rôle d'une carrière dans la compagnie, que le joueur lit d'un pictogramme : il choisit un groupe par rôles. */
export type Role = 'front' | 'tireur' | 'eclaireur' | 'soigneur' | 'lanceur';
export const ROLES: Record<Role, { nom: string; picto: string }> = {
  front: { nom: 'Ligne de front', picto: 'bouclier' }, tireur: { nom: 'Tireur', picto: 'arc' }, eclaireur: { nom: 'Éclaireur', picto: 'oeil' },
  soigneur: { nom: 'Soigneur', picto: 'soin' }, lanceur: { nom: 'Lanceur de sorts', picto: 'etoile' },
};
/** Une carrière du roster : son palier de relais, le niveau de carrière où elle s'engage, son rôle, ce qui la
 *  caractérise à la création, les objets du catalogue qu'elle reçoit en plus de sa dotation, et sa voie de lanceur. */
export interface Profil { id: string; nom: string; relais: number; niveau: number; role: Role; identite: Identite; devise: string; dotation?: readonly string[]; voie?: Voie }

export const PROFILS: readonly Profil[] = [
  { id: 'soldat', nom: 'Soldat', relais: 0, niveau: 1, role: 'front', identite: { talent: { id: 'guerrier-ne' } }, dotation: ['bouclier'], devise: 'Tient la ligne. Guerrier né.' },
  { id: 'chasseur', nom: 'Chasseur', relais: 0, niveau: 1, role: 'tireur', identite: { talent: { id: 'dur-a-cuire' } }, devise: 'Tire de loin, encaisse de près. Dur à cuire.' },
  { id: 'ratier', nom: 'Ratier', relais: 0, niveau: 1, role: 'eclaireur', identite: { talent: { id: 'coup-puissant' } }, devise: 'Fouille les caves, frappe fort. Coup puissant.' },
  { id: 'nonne', nom: 'Nonne de Shallya', relais: 0, niveau: 1, role: 'soigneur', identite: { talent: { id: 'beni', spec: 'shallya' } }, devise: 'Soigne et protège. Bénie de Shallya.',
    voie: { talent: 'invocation', spec: 'shallya', nom: 'Invocation (Shallya)', sorts: [] } },
  { id: 'sorcier', nom: 'Sorcier', relais: 0, niveau: 1, role: 'lanceur', identite: { talent: { id: 'magie-mineure' }, sortsMineurs: ['flechette', 'choc', 'eblouissant'] }, devise: 'Le feu de l’Aethyr. Magie mineure.',
    voie: { talent: 'magie-des-arcanes', spec: 'feu', nom: 'Magie des Arcanes (Feu)', sorts: ['carreau', 'explosion', 'arme-aethyrique', 'armure-aethyrique', 'effrayant', 'sang-corrosif'] } },
  { id: 'tueur', nom: 'Tueur', relais: 1, niveau: 1, role: 'front', identite: { talent: { id: 'tueur' } }, devise: 'Cherche une mort glorieuse. Tueur.' },
  { id: 'repurgateur', nom: 'Répurgateur', relais: 1, niveau: 2, role: 'tireur', identite: { talent: { id: 'determine' } }, dotation: ['pistolet', 'pistolet'], devise: 'Traque l’hérétique. Déterminé.' },
  { id: 'medecin', nom: 'Médecin', relais: 1, niveau: 2, role: 'soigneur', identite: { talent: { id: 'pansement-de-fortune' } }, devise: 'Recoud les plaies, tranche le mal. Pansement de fortune.' },
  { id: 'voleur', nom: 'Voleur', relais: 1, niveau: 2, role: 'eclaireur', identite: { talent: { id: 'chat-de-gouttiere' } }, devise: 'Passe sans bruit par les toits. Chat de gouttière.' },
  { id: 'joueur-d-epee', nom: 'Joueur d’épée', relais: 2, niveau: 1, role: 'front', identite: { talent: { id: 'guerrier-ne' } }, devise: 'Le zweihänder des Carroburg. Guerrier né.' },
  { id: 'duelliste', nom: 'Duelliste', relais: 2, niveau: 2, role: 'front', identite: { talent: { id: 'battement' } }, devise: 'Bat le fer adverse. Battement.' },
  { id: 'chasseur-de-primes', nom: 'Chasseur de primes', relais: 2, niveau: 2, role: 'tireur', identite: { talent: { id: 'frappe-assommante' } }, devise: 'Vivant, de préférence. Frappe assommante.' },
  { id: 'pretre-guerrier', nom: 'Prêtre-guerrier de Sigmar', relais: 2, niveau: 2, role: 'front', identite: { talent: { id: 'beni', spec: 'sigmar' } }, devise: 'Le marteau et la foi. Béni de Sigmar.',
    voie: { talent: 'invocation', spec: 'sigmar', nom: 'Invocation (Sigmar)', sorts: ['marteau-ardent-de-sigmar', 'n-ecoutez-point-la-sorciere'] } },
];
export const nomDeCarriere = (id: string): string => profil(id)?.nom ?? nomDeCarriereDuLivre(id);
export const voieDe = (carriere: string): Voie | undefined => profil(carriere)?.voie;
export const deviseDe = (carriere: string): string => profil(carriere)?.devise ?? '';
/** Le rôle d'une carrière, s'il est au roster (`PROFILS`). */
export const roleDe = (carriere: string): Role | undefined => profil(carriere)?.role;

export const ESPECES: Record<string, { nom: string; race: 'humain' | 'nain' | 'halfling' }> = {
  'humains-reiklander': { nom: 'Humain', race: 'humain' }, nains: { nom: 'Nain', race: 'nain' }, halflings: { nom: 'Halfling', race: 'halfling' },
};
export const nomDEspece = (id: string): string => ESPECES[id]?.nom ?? id;

/** La prière utilitaire d'un Béni entre deux salles, une fois par expédition. */
export const PRIERE_DE_SOIN = 'benediction-de-guerison';

export type TypeDeSalle = 'combat' | 'elite' | 'camp' | 'tresor' | 'boss';
export interface Destination {
  id: string; nom: string; recit: string; palier: number; salles: number;
  meutes: string[][]; elites: string[][]; boss: string[]; or: number; lumiere: string;
}
export const DESTINATIONS: readonly Destination[] = [
  { id: 'reikwald', nom: 'Lisière du Reikwald', palier: 0, salles: 4, or: 30, lumiere: 'jour',
    recit: 'Des loups et des peaux-vertes rôdent le long de la route de la diligence.',
    meutes: [['gobelin', 'gobelin'], ['loup'], ['rat-geant', 'rat-geant'], ['brigand'], ['snotling', 'snotling', 'gobelin']],
    elites: [['orc'], ['brigand', 'loup']], boss: ['loup-funeste'] },
  { id: 'tertres', nom: 'Tertres de Grisefosse', palier: 1, salles: 5, or: 36, lumiere: 'crepuscule',
    recit: 'Les morts ne reposent plus sous les vieux tertres. Quelqu’un les réveille.',
    meutes: [['squelette', 'zombie'], ['zombie', 'zombie', 'zombie'], ['goule-de-crypte', 'zombie']],
    elites: [['squelette', 'squelette', 'goule-de-crypte'], ['chevalier-mort-vivant-revenant']], boss: ['necromancien', 'squelette', 'squelette'] },
  { id: 'hardes', nom: 'Clairière des hardes', palier: 2, salles: 5, or: 50, lumiere: 'couvert',
    recit: 'Les hommes-bêtes se rassemblent autour d’une pierre de harde.',
    meutes: [['ungor', 'ungor'], ['gor', 'ungor'], ['ungor', 'ungor', 'ungor']],
    elites: [['gor', 'gor', 'ungor'], ['gor-combattant', 'ungor']], boss: ['minotaure', 'ungor'] },
  { id: 'autel', nom: 'Autel du Chaos', palier: 3, salles: 6, or: 70, lumiere: 'crepuscule',
    recit: 'Un culte a dressé un autel aux Puissances de la Ruine. Il faut l’abattre.',
    meutes: [['cultiste', 'cultiste'], ['mutant', 'cultiste'], ['cultiste', 'cultiste', 'mutant']],
    elites: [['guerrier-du-chaos', 'cultiste'], ['mutant', 'mutant', 'cultiste']], boss: ['guerrier-du-chaos', 'troll'] },
];

/** Une salle jouée en épreuve par le noyau (`jouerLEpreuve`) : son titre, l'épreuve, et ce que le récit dit du piège
 *  repéré ou déclenché. */
export interface SalleDEpreuve { titre: string; epreuve: Epreuve; repere: string; declenche: string }
/** Valeurs d'adaptation : la cache piégée de la salle `tresor`. */
export const EPREUVES: { tresor: SalleDEpreuve } = {
  tresor: {
    titre: 'Une cache piégée',
    epreuve: {
      label: 'Fouiller la cache',
      flux: {
        kind: 'test', test: { skill: { id: 'perception' }, difficulty: 'difficile' },
        reussite: { kind: 'sequence', etapes: [] },
        echec: { kind: 'effet', effet: { type: 'ops', on: 'membreAuHasard', ops: [{ op: 'wounds', amount: 4 }] } },
      },
    },
    repere: 'Un fil tendu court sous les pierres : le piège est repéré et désarmé.',
    declenche: 'Une pierre bascule et une lame jaillit du mur : le piège se déclenche.',
  },
};

/** PX gagnés par salle franchie, par type. */
export const PX_PAR_SALLE: Record<TypeDeSalle, number> = { combat: 40, elite: 70, boss: 120, camp: 0, tresor: 10 };
export const OR_INITIAL = 100;
export const PRIX_DE_RECRUE = [15, 30, 50];
/** Ce qu'une recrue coûte en plus par niveau de carrière au-delà du premier. */
export const SUPPLEMENT_PAR_NIVEAU = 20;
export const TAILLE_DU_GROUPE = 4;
/** Le prix d'un objet au hameau : son prix au catalogue (CO) multiplié, à l'échelle du butin des expéditions. */
export const ECHELLE_DES_PRIX = 10;
/** Jours de repos accordés à tous quand personne n'est plus en état de partir ; durée d'un séjour à l'hospice. */
export const SEMAINE_DE_REPOS = 7;
/** La Guérison des sœurs et du chirurgien de l'hospice. */
export const GUERISON_DE_L_HOSPICE = 45;
/** Prix des actes de l'hospice, avant la remise du dernier palier. */
export const PRIX_DE_L_HOSPICE = { panser: 20, operer: 60 } as const;

/** Ce que vend la forge, par palier : armes du catalogue (`trappings.json`) et armures des règles rapides. */
export const ARMES_DE_FORGE: readonly string[][] = [
  ['dague', 'arme-simple', 'lance', 'baton-de-combat', 'bouclier', 'arc-court'],
  ['rapiere', 'sabre', 'epee-batarde', 'fleau', 'hallebarde', 'arc', 'arbalete'],
  ['grande-hache', 'marteau-de-guerre', 'zweihander', 'bouclier-grand', 'arc-long'],
];
export const ARMURES_DE_FORGE: readonly PoidsDArmure[] = ['legere', 'moyenne', 'lourde'];
/** Les objets tenus dans la main secondaire ; les autres armes vont dans la main principale, ou au set de tir. */
export const MAIN_SECONDAIRE = new Set(['dague', 'bouclier', 'bouclier-grand']);
/** Les munitions qu'une arme à projectiles réclame. */
export const MUNITIONS: Record<string, string> = { fronde: 'projectile-de-pierre', 'arc-court': 'fleche', arc: 'fleche', 'arc-long': 'fleche', arbalete: 'carreau', pistolet: 'balle-et-poudre' };
/** Les provisions du relais, par palier. */
export const PROVISIONS: readonly string[][] = [['potion-de-guerison'], ['potion-de-vitalite']];
