/**
 * Le catalogue du roguelite (vue lisible : `CATALOGUE.md`, `catalogue.ts`) : bâtiments et paliers, carrières du roster et
 * leurs désignations, voies et sorts, Compétences utiles, forge, hospice, destinations et adversaires, prix, gains.
 */
import {
  nomDeCarriereDuLivre,
  nomDeTalent,
  COMPETENCES_DU_COMBAT,
  type Combatant,
  type Epreuve,
  type Identite,
  munitionsDesArmes,
  DISPONIBILITES,
  type Disponibilite,
  type FluxDEpreuve,
  type Designation,
  type QualiteDeRepos,
  type DoctrineId,
} from '../noyau';

import { profil } from './outils';

export type IdBatiment = 'relais' | 'temple' | 'salle' | 'forge' | 'cartographe' | 'peage';

/** Un apport d'un palier : son pictogramme (`PICTOS` de `../kit`), sa phrase, et le chiffre de la phrase à marquer. */
export interface Apport { picto: string; chiffre?: string; texte: string }
export interface Batiment { id: IdBatiment; nom: string; role: string; paliers: { cout: number; trophees: number; apports: Apport[] }[] }
/** Ce qu'apporte un palier, en une phrase : ses apports joints. */
export const phraseDuPalier = (p: Batiment['paliers'][number]): string => p.apports.map((a) => a.texte).join(' ; ');
const apport = (picto: string, texte: string, chiffre?: string): Apport => (chiffre ? { picto, chiffre, texte } : { picto, texte });

export const TAILLE_DU_GROUPE = 4;
/** Les voyageurs que le relais propose à son palier, tous engagés sans frais : de quoi monter un groupe entier, et un
 *  de plus par palier. */
export const candidatsAuPalier = (palier: number): number => TAILLE_DU_GROUPE + palier;
const candidatsDuPalier = (palier: number, carrieres?: string): Apport =>
  apport('chope', `${candidatsAuPalier(palier)} candidats engagés sans frais${carrieres ? `, ${carrieres}` : ''}`, String(candidatsAuPalier(palier)));

/** Le revenu du péage à chaque palier, par salle que l'expédition franchit : il suit la longueur de la route, et rentrer
 *  après une salle n'en rapporte qu'une part. Mesure MyEdO/game#4963. */
export const PEAGE_PAR_SALLE: readonly number[] = [0, 3, 6, 12];
const peageDuPalier = (palier: number): string => `+${PEAGE_PAR_SALLE[palier]} CO`;
/** Prix des actes de l'hospice, avant la remise du dernier palier. */
export const PRIX_DE_L_HOSPICE = { panser: 20, operer: 60 } as const;
/** Le prix des Larmes de Shallya de l'hospice à chaque palier ; `null` : l'hospice ne les vend pas à ce palier. */
export const PRIX_DES_LARMES: readonly (number | null)[] = [null, null, 40, 20];
/** Le prix du soin de l'hospice par Point de Blessure rendu, à chaque palier ; `null` : l'hospice fermé. Mesure
 *  MyEdO/game#4963. */
export const PRIX_DU_SOIN_PAR_BLESSURE: readonly (number | null)[] = [null, 2, 1, 0];
const soinsDuPalier = (palier: number): string => `Soins à ${PRIX_DU_SOIN_PAR_BLESSURE[palier]} CO la Blessure`;

export const BATIMENTS: readonly Batiment[] = [
  { id: 'relais', nom: 'Auberge relais', role: 'Recrues', paliers: [
    { cout: 0, trophees: 0, apports: [candidatsDuPalier(0), apport('lit', 'repos en chambre piètre')] },
    { cout: 120, trophees: 0, apports: [candidatsDuPalier(1, 'carrières d’aventure'), apport('lit', 'repos en chambre normale')] },
    { cout: 300, trophees: 1, apports: [candidatsDuPalier(2, 'carrières d’élite'), apport('lit', 'repos en chambre de grande qualité')] },
  ] },
  { id: 'temple', nom: 'Hospice de Shallya', role: 'Soins, chirurgie et remèdes', paliers: [
    { cout: 0, trophees: 0, apports: [apport('lit', 'Fermée : on ne se repose qu’en chambre à l’auberge')] },
    { cout: 80, trophees: 0, apports: [apport('soin', soinsDuPalier(1), `${PRIX_DU_SOIN_PAR_BLESSURE[1]} CO`), apport('lit', 'les sœurs pansent les plaies à l’hospice'), apport('fiole', 'potions et remèdes communs et limités')] },
    { cout: 220, trophees: 1, apports: [apport('soin', soinsDuPalier(2), `${PRIX_DU_SOIN_PAR_BLESSURE[2]} CO`), apport('soin', 'un chirurgien opère'), apport('fiole', 'remèdes rares')] },
    { cout: 450, trophees: 2, apports: [apport('soin', 'Soins gratuits, hospice à moitié prix, +1 Destin à qui n’en a plus', '+1'), apport('fiole', 'remèdes exotiques')] },
  ] },
  { id: 'salle', nom: 'Salle d’armes', role: 'Carrières', paliers: [
    { cout: 0, trophees: 0, apports: [apport('epee', 'Fermée : les PX attendent')] },
    { cout: 100, trophees: 0, apports: [apport('epee', 'Avancements, jusqu’au niveau 2 de carrière', 'niveau 2')] },
    { cout: 260, trophees: 1, apports: [apport('epee', 'Jusqu’au niveau 3 de carrière', 'niveau 3')] },
    { cout: 500, trophees: 2, apports: [apport('epee', 'Jusqu’au niveau 4 de carrière', 'niveau 4')] },
  ] },
  { id: 'forge', nom: 'Forge', role: 'Armes et armures', paliers: [
    { cout: 0, trophees: 0, apports: [apport('hache', 'Armes communes, armure de cuir')] },
    { cout: 110, trophees: 0, apports: [apport('hache', 'Armes limitées : épée bâtarde, arc long ; armure de mailles')] },
    { cout: 280, trophees: 1, apports: [apport('hache', 'Armes rares : pistolet, armes d’ingénierie ; harnois de plates')] },
    { cout: 520, trophees: 2, apports: [apport('hache', 'Armes exotiques : arc elfique, long fusil d’Hochland')] },
  ] },
  { id: 'cartographe', nom: 'Cartographe', role: 'Destinations', paliers: [
    { cout: 0, trophees: 0, apports: [apport('carte', 'La lisière du Reikwald')] },
    { cout: 150, trophees: 1, apports: [apport('carte', 'Ouvre les Tertres de Grisefosse')] },
    { cout: 320, trophees: 2, apports: [apport('carte', 'Ouvre la Clairière des hardes')] },
    { cout: 600, trophees: 3, apports: [apport('carte', 'Ouvre l’Autel du Chaos')] },
  ] },
  { id: 'peage', nom: 'Péage du pont', role: 'Revenu', paliers: [
    { cout: 0, trophees: 0, apports: [apport('pieces', 'Ruiné : aucun revenu')] },
    { cout: 90, trophees: 0, apports: [apport('pieces', `${peageDuPalier(1)} par salle franchie en expédition`, peageDuPalier(1))] },
    { cout: 240, trophees: 1, apports: [apport('pieces', peageDuPalier(2), peageDuPalier(2))] },
    { cout: 480, trophees: 2, apports: [apport('pieces', peageDuPalier(3), peageDuPalier(3))] },
  ] },
];

/** Les Sorts mineurs qu'un lanceur de Collège connaît à la recrue. */
export const SORTS_MINEURS: readonly string[] = ['flechette', 'choc', 'eblouissant'];
/** Les sorts et miracles que chaque voie offre, par domaine ou par dieu : ceux que le noyau applique et que l'IA d'un
 *  héros lance en combat automatique avec effet, mesurés par `npx tsx projets/roguelite/balayage.ts sorts`. Arbitrage du
 *  2026-11-23, MyEdO/game#4947, mesure MyEdO/game#4954. Chaque voie range ses sorts par le plus bas niveau de carrière
 *  où la Salle d'armes les propose : un Collège ouvre au niveau 2 les sorts de NI 4 au plus, puis les NI 5 et 6 au
 *  niveau 3, les NI 7 à 9 au niveau 4 ; un culte ouvre ses miracles dès qu'il tient le Talent. */
export const SORTS_DES_VOIES: Readonly<Record<string, Readonly<Record<number, readonly string[]>>>> = {
  feu: { 2: ['embrasement', 'flamme-fascinante'] },
  lumiere: { 2: ['carreau'] },
  vie: { 2: ['carreau'] },
  bete: { 2: ['carreau', 'ver-fretillant'] },
  metal: { 2: ['carreau'] },
  mort: { 2: ['carreau'] },
  shallya: { 1: ['larmes-de-shallya'] },
  sigmar: { 1: ['comete-a-deux-queues', 'marteau-ardent-de-sigmar'] },
  ulric: { 1: ['jugement-du-roi-de-la-neige', 'hurlement-du-loup'] },
  myrmidia: { 1: ['devotion-de-la-vierge-guerriere'] },
};

/** Les Compétences que le roguelite fait jouer, en combat et dans les salles : un id (`skills.json`), ou `id:spec`
 *  pour la seule spécialisation qui joue. */
export const COMPETENCES_UTILES: ReadonlySet<string> = new Set([
  ...COMPETENCES_DU_COMBAT, 'langue:magick',
  'perception', 'piegeage', 'crochetage', 'guerison', 'charme', 'escalade', 'discretion', 'pistage', 'survie-en-exterieur',
]);
/** La Compétence `ref` est-elle dans `COMPETENCES_UTILES`, par son id ou par sa spécialisation ? */
export const estUtile = (ref: { id: string; spec?: string }): boolean => COMPETENCES_UTILES.has(ref.id) || COMPETENCES_UTILES.has(`${ref.id}:${ref.spec}`);
/** Les Talents de carrière qui agissent par la donnée mais hors d'un combat automatique, que la salle d'armes ne met
 *  pas en avant : vie sociale, voyage, fuite, soins. */
export const TALENTS_HORS_DU_COMBAT: ReadonlySet<string> = new Set(['affable', 'studieux', 'voyageur-aguerri', 'fuite', 'sprinter', 'pansement-de-fortune']);

/** La voie d'un lanceur : le Talent de niveau 2 qui ouvre les sorts ou les miracles, sa spécialisation, et ce qui
 *  s'achète ensuite. */
export interface Voie { talent: 'magie-des-arcanes' | 'invocation'; spec: string; nom: string; sorts: readonly SortDeVoie[] }
/** Un sort d'une voie et le plus bas niveau de carrière où la Salle d'armes le propose. */
export interface SortDeVoie { id: string; niveau: number }
/** Le rôle d'une carrière dans la compagnie, que le joueur lit d'un pictogramme : il choisit un groupe par rôles. */
export type Role = 'front' | 'tireur' | 'eclaireur' | 'soigneur' | 'lanceur';
export const ROLES: Record<Role, { nom: string; picto: string }> = {
  front: { nom: 'Ligne de front', picto: 'bouclier' }, tireur: { nom: 'Tireur', picto: 'arc' }, eclaireur: { nom: 'Éclaireur', picto: 'oeil' },
  soigneur: { nom: 'Soigneur', picto: 'soin' }, lanceur: { nom: 'Lanceur de sorts', picto: 'etoile' },
};
/** Le rang d'un héros à l'entrée d'une rencontre : la tête du groupe, face à l'ennemi, ou derrière elle. */
export type Rang = 'devant' | 'derriere';
export const RANGS: Record<Rang, { nom: string; bulle: string }> = {
  devant: { nom: 'Devant', bulle: 'Entre en tête du groupe, face à l’ennemi.' },
  derriere: { nom: 'Derrière', bulle: 'Entre derrière ceux qui vont devant.' },
};
/** Le rang d'un héros que le joueur n'a pas placé, selon le rôle de sa carrière. */
export const RANG_DU_ROLE: Record<Role, Rang> = { front: 'devant', eclaireur: 'devant', tireur: 'derriere', soigneur: 'derriere', lanceur: 'derriere' };
/** Les consignes de combat offertes au joueur : une doctrine de l'IA du noyau (`Combatant.aiDoctrine`), ou `null`, que
 *  le noyau déduit du héros. `meute` (une bête), `horde` (un esprit absent), `embuscade` (la charge d'un embusqué) et
 *  `standard` (le défaut neutre) ne décrivent pas un aventurier ; `artillerie`, que le noyau déduit d'un lanceur, double
 *  `tirailleurs` pour un héros. */
export const CONSIGNES: readonly { doctrine: DoctrineId | null; nom: string; bulle: string }[] = [
  { doctrine: null, nom: 'À son idée', bulle: 'Combat selon ce qu’il porte et ce qu’il sait faire.' },
  { doctrine: 'soldats', nom: 'Tenir la ligne', bulle: 'Cherche le contact et reste au coude à coude avec les siens.' },
  { doctrine: 'tirailleurs', nom: 'Harceler', bulle: 'Garde ses distances, recule devant l’ennemi et vise les plus dangereux.' },
  { doctrine: 'racaille', nom: 'Se ménager', bulle: 'Achève les blessés et se replie quand il est très entamé.' },
];
/** Une carrière du roster : son palier de relais, le niveau de carrière où elle s'engage, son rôle, ce qui la
 *  caractérise à la création, les objets du catalogue qu'elle reçoit en plus de sa dotation, sa voie de lanceur, et
 *  les dieux parmi lesquels se tire la spécialisation de son Talent d'identité (`beni`), qui fixe sa voie. */
export interface Profil { id: string; nom: string; relais: number; niveau: number; role: Role; identite: Identite; devise: string; dotation?: readonly string[]; voie?: Voie; dieux?: readonly string[] }

/** La voie du Talent `talent` spécialisé en `spec` : son libellé et ses sorts choisis (`SORTS_DES_VOIES`). */
const voie = (talent: Voie['talent'], spec: string): Voie => ({ talent, spec, nom: nomDeTalent({ id: talent, spec }),
  sorts: Object.entries(SORTS_DES_VOIES[spec] ?? {}).flatMap(([niveau, ids]) => ids.map((id) => ({ id, niveau: Number(niveau) }))) });
/** Les emplacements « (Au choix) » de Corps à corps et de Projectiles désignés à la recrue, valeur d'adaptation par
 *  profil : la spécialisation qui sert son identité. */
const cac = (niveau: number, spec: string): Designation => ({ niveau, id: 'corps-a-corps', spec });
const tir = (niveau: number, spec: string): Designation => ({ niveau, id: 'projectiles', spec });
/** Une carrière de Collège (VDM ch. 4 à 11) : lanceur, recrutée au niveau 1, sa voie la Magie des Arcanes de son domaine. */
const college = (id: string, nom: string, relais: number, domaine: string, devise: string): Profil =>
  ({ id, nom, relais, niveau: 1, role: 'lanceur', identite: MAGIE_MINEURE, devise, voie: voie('magie-des-arcanes', domaine) });
const MAGIE_MINEURE: Identite = { talent: { id: 'magie-mineure' }, sortsMineurs: SORTS_MINEURS };

export const PROFILS: readonly Profil[] = [
  { id: 'soldat', nom: 'Soldat', relais: 0, niveau: 1, role: 'front', identite: { talent: { id: 'guerrier-ne' }, designations: [cac(2, 'armes-d-hast'), tir(2, 'arc')] }, dotation: ['bouclier'], devise: 'Tient la ligne. Guerrier né.' },
  { id: 'chasseur', nom: 'Chasseur', relais: 0, niveau: 1, role: 'tireur', identite: { talent: { id: 'dur-a-cuire' } }, devise: 'Tire de loin, encaisse de près. Dur à cuire.' },
  { id: 'ratier', nom: 'Ratier', relais: 0, niveau: 1, role: 'eclaireur', identite: { talent: { id: 'coup-puissant' }, designations: [{ niveau: 1, id: 'discretion', spec: 'souterrains' }] }, devise: 'Fouille les caves, frappe fort. Coup puissant.' },
  { id: 'nonne', nom: 'Nonne de Shallya', relais: 0, niveau: 1, role: 'soigneur', identite: { talent: { id: 'beni', spec: 'shallya' }, designations: [cac(2, 'base')] }, devise: 'Soigne et protège. Bénie de Shallya.',
    voie: voie('invocation', 'shallya') },
  college('pyromancien', 'Pyromancien', 0, 'feu', 'Le Collège Flamboyant. Magie mineure.'),
  college('hierophante', 'Hiérophante', 0, 'lumiere', 'Le Collège Lumineux. Magie mineure.'),
  { id: 'tueur', nom: 'Tueur', relais: 1, niveau: 1, role: 'front', identite: { talent: { id: 'tueur' } }, devise: 'Cherche une mort glorieuse. Tueur.' },
  { id: 'repurgateur', nom: 'Répurgateur', relais: 1, niveau: 2, role: 'tireur', identite: { talent: { id: 'determine' }, designations: [tir(2, 'poudre-noire')] }, devise: 'Traque l’hérétique. Déterminé.' },
  { id: 'medecin', nom: 'Médecin', relais: 1, niveau: 2, role: 'soigneur', identite: { talent: { id: 'pansement-de-fortune' } }, devise: 'Recoud les plaies, tranche le mal. Pansement de fortune.' },
  { id: 'voleur', nom: 'Voleur', relais: 1, niveau: 2, role: 'eclaireur', identite: { talent: { id: 'chat-de-gouttiere' } }, devise: 'Passe sans bruit par les toits. Chat de gouttière.' },
  college('druide', 'Druide', 1, 'vie', 'Le Collège de Jade. Magie mineure.'),
  college('chamane', 'Chamane', 1, 'bete', 'Le Collège d’Ambre. Magie mineure.'),
  { id: 'joueur-d-epee', nom: 'Joueur d’épée', relais: 2, niveau: 1, role: 'front', identite: { talent: { id: 'guerrier-ne' }, designations: [cac(2, 'parade')] }, devise: 'Le zweihänder des Carroburg. Guerrier né.' },
  { id: 'duelliste', nom: 'Duelliste', relais: 2, niveau: 2, role: 'front', identite: { talent: { id: 'battement' }, designations: [cac(1, 'escrime'), cac(4, 'deux-mains')] }, devise: 'Bat le fer adverse. Battement.' },
  { id: 'chasseur-de-primes', nom: 'Chasseur de primes', relais: 2, niveau: 2, role: 'tireur', identite: { talent: { id: 'frappe-assommante' } }, devise: 'Vivant, de préférence. Frappe assommante.' },
  // careerLevels.json l.11637
  { id: 'ingenieur', nom: 'Ingénieur', relais: 2, niveau: 2, role: 'tireur', identite: { talent: { id: 'artilleur' } }, dotation: ['pistolet'], devise: 'La poudre et la mécanique. Artilleur.' },
  { id: 'pretre-guerrier', nom: 'Prêtre-guerrier', relais: 2, niveau: 2, role: 'front', identite: { talent: { id: 'beni' }, designations: [cac(1, 'base'), cac(2, 'deux-mains'), tir(2, 'arbalete')] }, devise: 'L’arme et la foi. Béni.', dieux: ['sigmar', 'ulric', 'myrmidia'] },
  college('alchimiste', 'Alchimiste', 2, 'metal', 'Le Collège Doré. Magie mineure.'),
  college('spirite', 'Spirite', 2, 'mort', 'Le Collège d’Améthyste. Magie mineure.'),
];
export const nomDeCarriere = (id: string): string => profil(id)?.nom ?? nomDeCarriereDuLivre(id);
/** Le dieu d'un héros : la spécialisation de son Talent Béni. */
export const dieuDe = (c: Pick<Combatant, 'talents'>): string | undefined => c.talents.find((t) => t.talentId === 'beni')?.spec;
/** La voie de lanceur de la carrière `carriere` ; celle d'une carrière à dieu tiré suit le dieu du héros `c`. */
export const voieDe = (carriere: string, c: Pick<Combatant, 'talents'>): Voie | undefined => {
  const p = profil(carriere);
  const dieu = p?.dieux ? dieuDe(c) : undefined;
  return dieu ? voie('invocation', dieu) : p?.voie;
};
export const deviseDe = (carriere: string): string => profil(carriere)?.devise ?? '';
/** Le rôle d'une carrière, s'il est au roster (`PROFILS`). */
export const roleDe = (carriere: string): Role | undefined => profil(carriere)?.role;

export const ESPECES: Record<string, { nom: string }> = {
  'humains-reiklander': { nom: 'Humain' }, nains: { nom: 'Nain' }, halflings: { nom: 'Halfling' },
};
export const nomDEspece = (id: string): string => ESPECES[id]?.nom ?? id;

/** La prière utilitaire d'un Béni entre deux salles, une fois par expédition. */
export const PRIERE_DE_SOIN = 'benediction-de-guerison';

export type TypeDeSalle = 'combat' | 'elite' | 'camp' | 'tresor' | 'rencontre' | 'boss';
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

/** Ce que coûte l'échec d'une action, en plus de la branche d'échec de son Test (`flux.echec`) : le combat contre
 *  les `adversaires` (ids de `creatures.json`) que la salle met en scène, ou la part `part` de l'or de l'étape
 *  (`Destination.or`) prise sur la bourse de l'expédition. */
export type Consequence = { type: 'combat'; adversaires: readonly string[] } | { type: 'bourse'; part: number };
/** Une action à jet d'une salle à choix : son geste, la question au socle, ses épreuves (le héros choisi joue la
 *  première qu'il peut tenter, `epreuveTentable`), ce que disent sa réussite et son échec, et la conséquence de
 *  l'échec. */
export interface ActionAJet { libelle: string; question: string; epreuves: readonly Epreuve[]; reussite: string; echec: string; consequence?: Consequence }
/** Une salle à choix jouée par le noyau (`jouerLEpreuve`) : son titre, son annonce, ses actions à jet, « passer », et
 *  le gain d'une réussite : la part `part` d'un tirage entre une et deux fois l'or de l'étape (`Destination.or`). */
export interface SalleAChoix<A extends string> {
  titre: string; annonce: string; actions: Record<A, ActionAJet>; gain: { libelle: string; part: number };
  passer: { libelle: string; issue: string; recit: string };
}

/** La lame du piège : sans `on`, l'effet frappe le groupe de l'épreuve, réduit au héros qui la tente. */
const LAME: FluxDEpreuve['echec'] = { kind: 'effet', effet: { type: 'ops', ops: [{ op: 'wounds', amount: 4 }] } };
const RIEN: FluxDEpreuve['echec'] = { kind: 'sequence', etapes: [] };
const epreuve = (label: string, skill: string, difficulty: NonNullable<FluxDEpreuve['test']['difficulty']>, echec: FluxDEpreuve['echec'] = LAME): Epreuve =>
  ({ label, flux: { kind: 'test', test: { skill: { id: skill }, difficulty }, reussite: RIEN, echec } });

const DECLENCHE = 'Une pierre bascule et une lame jaillit du mur : le piège se déclenche, la bourse reste hors d’atteinte.';
/** Valeurs d'adaptation : la cache piégée de la salle `tresor`, les voyageurs de la salle `rencontre`. */
export const EPREUVES = {
  tresor: {
    titre: 'Une cache piégée',
    annonce: 'Des pierres semblent avoir été déplacées : une bourse dessous, peut-être, et un piège avec elle.',
    actions: {
      fouiller: { libelle: 'Fouiller', question: 'Qui fouille la cache ?', epreuves: [epreuve('Fouiller la cache', 'perception', 'difficile')],
        reussite: 'Un fil tendu court sous les pierres : le piège est repéré, la bourse dégagée.', echec: DECLENCHE },
      desarmer: { libelle: 'Désarmer d’abord', question: 'Qui désarme le piège ?',
        epreuves: [epreuve('Désarmer le piège', 'piegeage', 'intermediaire'), epreuve('Désarmer le piège', 'crochetage', 'intermediaire')],
        reussite: 'Le mécanisme cède sans un bruit : le piège est désarmé, la cache se fouille sans risque.', echec: DECLENCHE },
    },
    gain: { libelle: 'Bourse cachée', part: 1 },
    passer: { libelle: 'Passer son chemin', issue: 'ni bourse ni risque', recit: 'Le groupe laisse les pierres en place et poursuit sa route.' },
  },
  rencontre: {
    titre: 'Des voyageurs sur la route',
    annonce: 'Un colporteur et deux gardes du village voisin font halte au bord du chemin. Ils toisent le groupe, la main près de la ceinture.',
    actions: {
      parlementer: { libelle: 'Parlementer', question: 'Qui parlemente ?', epreuves: [epreuve('Parlementer', 'charme', 'intermediaire', RIEN)],
        reussite: 'On parle de la route et des bêtes qui la hantent : le colporteur paie bien les nouvelles du hameau.',
        echec: 'Le marchandage tourne court : le colporteur vous soulage de quelques pièces avant de repartir.', consequence: { type: 'bourse', part: 0.5 } },
      intimider: { libelle: 'Intimider', question: 'Qui intimide ?', epreuves: [epreuve('Intimider', 'intimidation', 'difficile', RIEN)],
        reussite: 'Les gardes baissent les yeux : le colporteur lâche sa bourse pour passer son chemin.',
        echec: 'Les gardes ne plient pas : ils croisent le fer, et le colporteur empoigne son gourdin pour les épauler.',
        consequence: { type: 'combat', adversaires: ['garde-du-village', 'garde-du-village', 'marchand-habitants-des-champs'] } },
    },
    gain: { libelle: 'Bourse du colporteur', part: 0.5 },
    passer: { libelle: 'Ignorer', issue: 'ni gain ni risque', recit: 'Le groupe salue de loin et poursuit sa route.' },
  },
} satisfies { tresor: SalleAChoix<'fouiller' | 'desarmer'>; rencontre: SalleAChoix<'parlementer' | 'intimider'> };
/** Les salles à choix dont les actions se jouent par un Test (`EPREUVES`). */
export type SalleAJet = keyof typeof EPREUVES;
export type IdActionAJet = { [S in SalleAJet]: keyof (typeof EPREUVES)[S]['actions'] }[SalleAJet];
/** Toutes les actions à jet, par id. */
export const ACTIONS_A_JET: Record<IdActionAJet, ActionAJet> = { ...EPREUVES.tresor.actions, ...EPREUVES.rencontre.actions };

/** Valeurs d'adaptation : le camp, salle à choix. Chaque blessé y reçoit un soin au plus (`Salle.soignes`) ; le repos
 *  lève le camp. */
export const CAMP = {
  titre: 'Un abri pour la nuit',
  annonce: 'Un abri se devine entre les arbres. Le groupe peut y passer la nuit, et ses blessés y être soignés.',
  reposer: { libelle: 'Se reposer', issue: 'Une nuit de repos pour tous, puis la route', recit: 'Le groupe établit un camp et monte la garde à tour de rôle.' },
  soigner: { libelle: 'Soigner un blessé', titre: 'Les soins du camp', soigneur: 'Qui soigne ?', patient: 'Qui est soigné ?' },
};

/** Le butin d'une salle de combat : l'or de l'étape (`Destination.or`) multiplié par son type, puis par un tirage
 *  entre `ecart.min` et `ecart.max` centièmes. */
export const BUTIN_DES_SALLES = { facteur: { combat: 1, elite: 2, boss: 4 }, ecart: { min: 75, max: 125 } } as const;
/** Les trophées : la chance en pour cent qu'une élite en laisse un, ceux du maître, et celui de plus la première fois
 *  qu'il tombe. */
export const TROPHEES = { elite: 35, boss: 1, premiereVictoire: 1 } as const;
/** PX gagnés par salle franchie, par type. */
export const PX_PAR_SALLE: Record<TypeDeSalle, number> = { combat: 40, elite: 70, boss: 120, camp: 0, tresor: 10, rencontre: 10 };
export const OR_INITIAL = 100;
/** Le prix d'un objet au hameau : son prix au catalogue (CO) multiplié, à l'échelle du butin des expéditions. */
export const ECHELLE_DES_PRIX = 10;
/** Jours de repos accordés à tous quand personne n'est plus en état de partir ; durée d'un séjour à l'hospice. */
export const SEMAINE_DE_REPOS = 7;
/** La Guérison des sœurs et du chirurgien de l'hospice. */
export const GUERISON_DE_L_HOSPICE = 45;
/** La qualité de la chambre de l'Auberge relais à chaque palier, que le séjour d'une semaine paie au prix du noyau. */
export const CHAMBRE_DU_RELAIS: readonly QualiteDeRepos[] = ['pietre', 'normale', 'grande'];
/** Les bâtiments où un héros séjourne sans partir en expédition : le nom de son séjour, la marque de sa carte. */
export const LIEUX_DE_SEJOUR = { temple: { nom: 'Hospice', picto: 'soin' }, relais: { nom: 'Auberge', picto: 'chope' } } as const;
export type LieuDeSejour = keyof typeof LIEUX_DE_SEJOUR;

/** Les Disponibilités (`DISPONIBILITES`) qu'ouvre le palier `palier` de la forge ou de l'hospice : une de plus par palier. */
export const disponibilitesDuPalier = (palier: number): readonly Disponibilite[] => DISPONIBILITES.slice(0, palier + 1);
/** Les armures que la forge vend : les trois armures d'une pièce de l'option du noyau `armure-regles-rapides`, de la plus
 *  légère à la plus lourde. LDB 63 l.95-103 ; arbitrage du 2026-11-24, MyEdO/game#4966. */
export const ARMURES_DE_LA_FORGE = ['armure-legere', 'armure-moyenne', 'armure-lourde'] as const;
export type ArmureDeLaForge = (typeof ARMURES_DE_LA_FORGE)[number];
/** Le Groupe des potions et remèdes du catalogue, que l'hospice reconnaît au sac d'un héros. */
export const GROUPE_DES_REMEDES = 'herbes-et-potions';
/** Ce que l'hospice vend du Groupe des remèdes : ceux dont le combat et la route jouent l'effet, un au moins par
 *  Disponibilité. Arbitrage du 2026-11-23, MyEdO/game#4947. */
export const REMEDES_DE_L_HOSPICE: readonly string[] = ['cataplasme-de-guerison', 'soude-commune', 'potion-de-guerison', 'potion-de-vitalite', 'racine-des-tombes', 'faxtoryll'];
/** Les Groupes d'armes que la forge vend. */
export type GroupeDeLaForge = 'base' | 'escrime' | 'parade' | 'deux-mains' | 'armes-d-hast' | 'fleau' | 'arc' | 'arbalete' | 'fronde' | 'poudre-noire' | 'ingenierie' | 'lancer' | 'entraves';
/** Les armes que la forge vend, par Groupe : une sélection qui couvre chaque Disponibilité, sans armes d'ogre ni
 *  lances de cavalerie. Arbitrage du 2026-11-23, MyEdO/game#4947. */
export const ARMES_DE_LA_FORGE: Readonly<Record<GroupeDeLaForge, readonly string[]>> = {
  base: ['arme-simple', 'bouclier', 'pique-d-armes'],
  escrime: ['rapiere'],
  parade: ['main-gauche'],
  'deux-mains': ['epee-batarde'],
  'armes-d-hast': ['hallebarde'],
  fleau: ['fleau'],
  arc: ['arc', 'arc-long', 'arc-elfique'],
  arbalete: ['arbalete'],
  fronde: ['fronde'],
  'poudre-noire': ['arquebuse', 'pistolet', 'long-fusil-d-hochland'],
  ingenierie: ['pistolet-a-repetition', 'arquebus-a-repetition'],
  lancer: ['hache-de-lancer'],
  entraves: ['fouet'],
};
/** Les Groupes que la forge propose à tout héros, sans Compétence qui les couvre. Arbitrage du 2026-11-23, MyEdO/game#4947. */
export const GROUPES_SANS_COMPETENCE: ReadonlySet<GroupeDeLaForge> = new Set<GroupeDeLaForge>(['arbalete']);
/** Les armes hors Boucliers tenues dans la main secondaire : celles de ces Groupes à une main, et ces armes-ci ; les
 *  autres vont dans la main principale, ou au set de tir. */
export const MAIN_SECONDAIRE = { groupes: new Set(['parade']), armes: new Set(['dague']) };
/** La munition qu'une arme à distance reçoit quand sa fiche n'en nomme aucune, par famille (`ammoFamily`). */
export const MUNITION_DE_FAMILLE: Readonly<Record<string, string>> = { arc: 'fleche', arbalete: 'carreau', fronde: 'projectile-de-pierre', 'poudre-ingenierie': 'balle-et-poudre' };
/** La munition de chaque arme à distance du catalogue, `null` pour celle qui s'utilise seule (`munitionsDesArmes`). */
export const MUNITION_DES_ARMES: Readonly<Record<string, string | null>> = munitionsDesArmes(MUNITION_DE_FAMILLE);
/** Les munitions qu'une arme à projectiles réclame. */
export const MUNITIONS: Record<string, string> = Object.fromEntries(Object.entries(MUNITION_DES_ARMES).filter((e): e is [string, string] => e[1] !== null));
