/**
 * Le jeu roguelite : un hameau à relever, des recrues, des expéditions de salles en salles. Les règles de combat,
 * de création, d'avancement, d'équipement et de guérison sont celles du noyau (`./combat`) ; ce module ne tient que
 * la boucle de jeu et ses valeurs d'adaptation (prix, gains, paliers), toutes regroupées ici. Tout l'aléa passe par
 * le RNG à graine du moteur (`makeRNG`), jamais par `Math.random`.
 */
import {
  refusDUsage, talentDeCombat, plaiesASoigner, panserLesPlaies, opererLesBlessures, makeRNG, generateName, type RNG, nouvelleRecrue, jouerLeCombat, reposer, soigner, guerirDesSequelles, sequelles, horsDeCombat,
  nomDeCreature, nomDeCarriereDuLivre, libellesDeQualites, auHameau, doter, armureRapide, articleDuCatalogue, ARMURES_RAPIDES, progression,
  type ArticleDuCatalogue, type Combatant, type IssueDuCombat, type Geste, type Identite, type PoidsDArmure, type Progression,
} from './combat';

export type { CharKey, PoidsDArmure } from './combat';

// ─── Valeurs d'adaptation ───────────────────────────────────────────────────────────────────────────────────

export type IdBatiment = 'relais' | 'temple' | 'salle' | 'forge' | 'cartographe' | 'peage' | 'memorial';

export interface Batiment { id: IdBatiment; nom: string; role: string; paliers: { cout: number; trophees: number; effet: string }[] }

export const BATIMENTS: readonly Batiment[] = [
  { id: 'relais', nom: 'Relais de diligence', role: 'Recrues et provisions', paliers: [
    { cout: 0, trophees: 0, effet: '2 candidats ; cataplasmes de guérison' },
    { cout: 120, trophees: 0, effet: '3 candidats, carrières d’aventure ; potions de guérison' },
    { cout: 300, trophees: 1, effet: '4 candidats, carrières d’élite ; potions de vitalité' },
  ] },
  { id: 'temple', nom: 'Chapelle de Shallya', role: 'Soins et hospice', paliers: [
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
/** Une carrière du roster : son palier de relais, ce qui la caractérise à la création, et sa voie de lanceur. */
export interface Profil { id: string; nom: string; relais: number; identite: Identite; devise: string; espece?: string; voie?: Voie }

export const PROFILS: readonly Profil[] = [
  { id: 'soldat', nom: 'Soldat', relais: 0, identite: { talent: { id: 'guerrier-ne' } }, devise: 'Tient la ligne. Guerrier né.' },
  { id: 'chasseur', nom: 'Chasseur', relais: 0, identite: { talent: { id: 'dur-a-cuire' } }, devise: 'Tire de loin, encaisse de près. Dur à cuire.' },
  { id: 'hors-la-loi', nom: 'Hors-la-loi', relais: 0, identite: { talent: { id: 'vigilance' } }, devise: 'Jamais surpris. Vigilance.' },
  { id: 'pretre', nom: 'Prêtre de Shallya', relais: 0, identite: { talent: { id: 'beni', spec: 'shallya' } }, devise: 'Soigne et protège. Béni de Shallya.',
    voie: { talent: 'invocation', spec: 'shallya', nom: 'Invocation (Shallya)', sorts: [] } },
  { id: 'sorcier', nom: 'Sorcier', relais: 0, identite: { talent: { id: 'magie-mineure' }, sortsMineurs: ['flechette', 'choc', 'eblouissant'] }, devise: 'Le feu de l’Aethyr. Magie mineure.',
    voie: { talent: 'magie-des-arcanes', spec: 'feu', nom: 'Magie des Arcanes (Feu)', sorts: ['carreau', 'explosion', 'arme-aethyrique', 'armure-aethyrique', 'effrayant', 'sang-corrosif'] } },
  { id: 'tueur', nom: 'Tueur', relais: 1, espece: 'nains', identite: { talent: { id: 'tueur' } }, devise: 'Cherche une mort glorieuse. Tueur.' },
  { id: 'repurgateur', nom: 'Répurgateur', relais: 1, identite: { talent: { id: 'determine' } }, devise: 'Traque l’hérétique. Déterminé.' },
  { id: 'pretre-guerrier', nom: 'Prêtre-guerrier de Sigmar', relais: 1, identite: { talent: { id: 'beni', spec: 'sigmar' } }, devise: 'Le marteau et la foi. Béni de Sigmar.',
    voie: { talent: 'invocation', spec: 'sigmar', nom: 'Invocation (Sigmar)', sorts: ['marteau-ardent-de-sigmar', 'n-ecoutez-point-la-sorciere'] } },
  { id: 'duelliste', nom: 'Duelliste', relais: 1, identite: { talent: { id: 'pas-de-cote' } }, devise: 'Pare, esquive, riposte. Pas de côté.' },
  { id: 'joueur-d-epee', nom: 'Joueur d’épée', relais: 2, identite: { talent: { id: 'guerrier-ne' } }, devise: 'Le zweihänder des Carroburg. Guerrier né.' },
  { id: 'flagellant', nom: 'Flagellant', relais: 2, identite: { talent: { id: 'frenesie' } }, devise: 'La douleur est une prière. Frénésie.' },
  { id: 'chasseur-de-primes', nom: 'Chasseur de primes', relais: 2, identite: { talent: { id: 'frappe-assommante' } }, devise: 'Vivant, de préférence. Frappe assommante.' },
];
const profil = (id: string): Profil | undefined => PROFILS.find((p) => p.id === id);
export const nomDeCarriere = (id: string): string => profil(id)?.nom ?? nomDeCarriereDuLivre(id);
export const voieDe = (carriere: string): Voie | undefined => profil(carriere)?.voie;
export const deviseDe = (carriere: string): string => profil(carriere)?.devise ?? '';

const ESPECES: Record<string, { nom: string; race: 'humain' | 'nain' | 'halfling' }> = {
  'humains-reiklander': { nom: 'Humain', race: 'humain' }, nains: { nom: 'Nain', race: 'nain' }, halflings: { nom: 'Halfling', race: 'halfling' },
};
export const nomDEspece = (id: string): string => ESPECES[id]?.nom ?? id;

/** La prière utilitaire d'un Béni entre deux salles, une fois par expédition. */
const PRIERE_DE_SOIN = 'benediction-de-guerison';

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

/** PX gagnés par salle franchie, par type. */
const PX_PAR_SALLE: Record<TypeDeSalle, number> = { combat: 40, elite: 70, boss: 120, camp: 0, tresor: 10 };
const OR_INITIAL = 100;
const PRIX_DE_RECRUE = [15, 30, 50];
const TAILLE_DU_GROUPE = 4;
/** Le prix d'un objet au hameau : son prix au catalogue (CO) multiplié, à l'échelle du butin des expéditions. */
const ECHELLE_DES_PRIX = 10;
/** Jours de repos accordés à tous quand personne n'est plus en état de partir ; durée d'un séjour à l'hospice. */
const SEMAINE_DE_REPOS = 7;
/** La Guérison des sœurs et du chirurgien de l'hospice. */
const GUERISON_DE_L_HOSPICE = 45;
/** Prix des actes de l'hospice, avant la remise du dernier palier. */
const PRIX_DE_L_HOSPICE = { panser: 20, operer: 60 } as const;

/** Ce que vend la forge, par palier : armes du catalogue (`trappings.json`) et armures des règles rapides. */
const ARMES_DE_FORGE: readonly string[][] = [
  ['dague', 'arme-simple', 'lance', 'baton-de-combat', 'bouclier', 'arc-court'],
  ['rapiere', 'sabre', 'epee-batarde', 'fleau', 'hallebarde', 'arc', 'arbalete'],
  ['grande-hache', 'marteau-de-guerre', 'zweihander', 'bouclier-grand', 'arc-long'],
];
const ARMURES_DE_FORGE: readonly PoidsDArmure[] = ['legere', 'moyenne', 'lourde'];
/** Les objets tenus dans la main secondaire ; les autres armes vont dans la main principale. */
const MAIN_SECONDAIRE = new Set(['dague', 'bouclier', 'bouclier-grand']);
/** Les munitions qu'une arme à projectiles réclame. */
const MUNITIONS: Record<string, string> = { 'arc-court': 'fleche', arc: 'fleche', 'arc-long': 'fleche', arbalete: 'carreau' };
/** Les provisions du relais, par palier. */
const PROVISIONS: readonly string[][] = [['cataplasme-de-guerison'], ['potion-de-guerison'], ['potion-de-vitalite']];

// ─── État ───────────────────────────────────────────────────────────────────────────────────────────────────

/** `retrait` : jours restants à l'hospice ; le héros ne part pas en expédition. */
export interface Heros { c: Combatant; carriere: string; espece: string; expeditions: number; victoires: number; retrait?: number }
export interface Candidat extends Heros { prix: number }
export interface Tombe { nom: string; carriere: string; expeditions: number; ou: string; jour: number }
export interface Salle { type: TypeDeSalle; ennemis: string[]; faite: boolean }
/** `prieres` : les Bénis qui ont déjà prié pour soigner pendant l'expédition. */
export interface Expedition { destination: string; salles: Salle[]; index: number; groupe: string[]; or: number; trophees: number; px: number; prieres: string[] }

export interface Etat {
  version: 2;
  graine: number;
  jour: number;
  or: number;
  trophees: number;
  batiments: Record<IdBatiment, number>;
  roster: Heros[];
  candidats: Candidat[];
  cimetiere: Tombe[];
  expedition: Expedition | null;
  bossVaincus: string[];
  journal: string[];
}

const tirer = (e: Etat): RNG => makeRNG(e.graine++);
const choisir = <T>(rng: RNG, l: readonly T[]): T => l[rng.int(0, l.length - 1)];
const noter = (e: Etat, ligne: string) => { e.journal = [`Jour ${e.jour} — ${ligne}`, ...e.journal].slice(0, 40); };
const heros = (e: Etat, id: string): Heros | undefined => e.roster.find((h) => h.c.id === id);

export function nouvellePartie(graine: number): Etat {
  const e: Etat = {
    version: 2, graine, jour: 1, or: OR_INITIAL, trophees: 0,
    batiments: { relais: 0, temple: 0, salle: 0, forge: 0, cartographe: 0, peage: 0, memorial: 0 },
    roster: [], candidats: [], cimetiere: [], expedition: null, bossVaincus: [], journal: [],
  };
  for (const carriere of ['soldat', 'chasseur', 'pretre', 'sorcier']) e.roster.push(tirerUnHeros(e, carriere));
  renouvelerLesCandidats(e);
  noter(e, 'Quatre aventuriers descendent de la diligence à Grisefosse. Le hameau est en ruines ; tout reste à bâtir.');
  return e;
}

function tirerUnHeros(e: Etat, carriereImposee?: string): Heros {
  const rng = tirer(e);
  const p = carriereImposee ? profil(carriereImposee)! : choisir(rng, PROFILS.filter((x) => x.relais <= e.batiments.relais));
  const espece = p.espece ?? (rng.int(1, 10) <= 8 ? 'humains-reiklander' : choisir(rng, ['nains', 'halflings']));
  const sexe = rng.int(0, 1) ? 'M' : 'F';
  const nom = generateName(ESPECES[espece].race, sexe, rng) ?? 'Sans-nom';
  const c = nouvelleRecrue(e.graine++, p.id, espece, nom, p.identite);
  const morr = e.batiments.memorial;
  if (morr) c.xp = (c.xp ?? 0) + Math.min(morr * 100, e.cimetiere.length * 10 * morr);
  return { c, carriere: p.id, espece, expeditions: 0, victoires: 0 };
}

export function renouvelerLesCandidats(e: Etat): void {
  e.candidats = Array.from({ length: 2 + e.batiments.relais }, () => {
    const h = tirerUnHeros(e);
    return { ...h, prix: PRIX_DE_RECRUE[profil(h.carriere)!.relais] };
  });
}

// ─── Village ────────────────────────────────────────────────────────────────────────────────────────────────

/** Les bâtiments qui servent dès le premier jour ; les autres sont en ruine tant qu'on ne les a pas relevés. */
const SERVENT_DES_LE_DEBUT: ReadonlySet<IdBatiment> = new Set(['relais', 'forge', 'cartographe']);
export const enRuine = (batiments: Etat['batiments'], id: IdBatiment): boolean => batiments[id] === 0 && !SERVENT_DES_LE_DEBUT.has(id);

export const palierSuivant = (e: Etat, id: IdBatiment) => BATIMENTS.find((b) => b.id === id)!.paliers[e.batiments[id] + 1];

export function ameliorer(e: Etat, id: IdBatiment): string | null {
  const p = palierSuivant(e, id);
  if (!p) return 'Déjà au plus haut.';
  if (e.or < p.cout) return `Il faut ${p.cout} CO.`;
  if (e.trophees < p.trophees) return `Il faut ${p.trophees} trophée(s).`;
  e.or -= p.cout; e.trophees -= p.trophees; e.batiments[id]++;
  noter(e, `${BATIMENTS.find((b) => b.id === id)!.nom} : ${p.effet}.`);
  if (id === 'relais') renouvelerLesCandidats(e);
  return null;
}

export function recruter(e: Etat, i: number): string | null {
  const cand = e.candidats[i];
  if (!cand) return 'Candidat parti.';
  const gratuit = e.roster.length === 0 && e.or < cand.prix;
  if (!gratuit && e.or < cand.prix) return `Il faut ${cand.prix} CO.`;
  if (!gratuit) e.or -= cand.prix;
  const { prix: _prix, ...h } = cand;
  e.roster.push(h);
  e.candidats.splice(i, 1);
  noter(e, `${h.c.label}, ${nomDeCarriere(h.carriere).toLowerCase()}, rejoint la compagnie${gratuit ? ' sans solde, faute de mieux' : ''}.`);
  return null;
}

export function congedier(e: Etat, id: string): void {
  e.roster = e.roster.filter((h) => h.c.id !== id);
}

export const prixDuSoin = (e: Etat): number | null => [null, 15, 5, 0][e.batiments.temple] ?? null;
export const prixDeSequelle = (e: Etat): number | null => [null, null, 40, 20][e.batiments.temple] ?? null;
export const blesse = (h: Heros): boolean => h.c.wounds.current < h.c.wounds.max || h.c.conditions.length > 0;
/** Les séquelles qu'une prière de Shallya peut guérir : celles qui ont une convalescence. */
export const sequellesGuerissables = (h: Heros): number => sequelles(h.c).filter((s) => s.jours != null).length;

export function soignerAuTemple(e: Etat, id: string): string | null {
  const prix = prixDuSoin(e);
  const h = heros(e, id);
  if (prix == null || !h) return 'La chapelle est fermée.';
  if (e.or < prix) return `Il faut ${prix} CO.`;
  e.or -= prix;
  soigner(h.c, h.c.wounds.max);
  h.c.conditions = [];
  if (e.batiments.temple >= 3 && (h.c.fate ?? 0) === 0) h.c.fate = 1;
  return null;
}

export type ActeDHospice = keyof typeof PRIX_DE_L_HOSPICE;
/** Le prix de l'acte à l'hospice, `null` sous le palier qui le pratique (panser : 1, opérer : 2). */
export const prixDeLHospice = (e: Etat, acte: ActeDHospice): number | null =>
  e.batiments.temple < (acte === 'panser' ? 1 : 2) ? null : PRIX_DE_L_HOSPICE[acte] / (e.batiments.temple >= 3 ? 2 : 1);
/** Ce que l'hospice peut faire pour le héros. */
export const actesPossibles = (h: Heros): ActeDHospice[] => { const p = plaiesASoigner(h.c); return [...(p.panser ? ['panser' as const] : []), ...(p.operer ? ['operer' as const] : [])]; };

/** Confie le héros à l'hospice : les sœurs pansent ses plaies, ou le chirurgien l'opère ; il y reste une semaine. */
export function confierALHospice(e: Etat, id: string, acte: ActeDHospice): string | null {
  const h = heros(e, id);
  const prix = prixDeLHospice(e, acte);
  if (!h || prix == null) return 'L’hospice ne pratique pas encore cet acte.';
  if (h.retrait) return `${h.c.label} est déjà à l’hospice.`;
  if (!actesPossibles(h).includes(acte)) return acte === 'panser' ? 'Aucune plaie que les sœurs puissent panser.' : 'Rien à opérer.';
  if (e.or < prix) return `Il faut ${prix} CO.`;
  e.or -= prix;
  const lignes = acte === 'panser' ? panserLesPlaies(h.c, GUERISON_DE_L_HOSPICE, e.graine++) : opererLesBlessures(h.c);
  h.retrait = SEMAINE_DE_REPOS;
  noter(e, `${lignes.join(' ')} ${h.c.label} reste une semaine à l’hospice.`);
  return null;
}

export function guerirUneSequelle(e: Etat, id: string): string | null {
  const prix = prixDeSequelle(e);
  const h = heros(e, id);
  if (prix == null || !h) return 'Les Larmes de Shallya ne sont pas encore offertes ici.';
  if (!sequellesGuerissables(h)) return 'Aucune séquelle que la prière puisse guérir.';
  if (e.or < prix) return `Il faut ${prix} CO.`;
  e.or -= prix;
  noter(e, guerirDesSequelles(h.c, 1).join(' '));
  return null;
}

// ─── Carrières : avancements et voies, joués par le noyau ───────────────────────────────────────────────────

/** Le plus haut niveau de carrière que la salle d'armes ouvre (0 : fermée). */
export const niveauMaximal = (e: Etat): number => (e.batiments.salle ? e.batiments.salle + 1 : 0);

/** Joue `gestes` du noyau sur le héros `h` et le remplace par ce que le noyau rend ; rend la dernière ligne écrite. */
function auNoyau(e: Etat, h: Heros, gestes: Geste[]): string {
  const r = auHameau([h.c], gestes, e.graine++);
  h.c = r.groupe[0];
  return r.journal[r.journal.length - 1] ?? '';
}

/** Les Talents qui agissent par la donnée mais hors d'un combat automatique : vie sociale, voyage, fuite, soins. */
const TALENTS_HORS_DU_COMBAT: ReadonlySet<string> = new Set(['affable', 'studieux', 'voyageur-aguerri', 'fuite', 'sprinter', 'pansement-de-fortune']);

/** Les offres de la carrière du héros : la voie du lanceur réduite à sa spécialisation, et les seuls Talents qui
 *  agissent dans un combat automatique (`talentDeCombat`). */
export function offresDeCarriere(h: Heros): Progression {
  const p = progression(h.c);
  const voie = voieDe(h.carriere);
  const talents = p.talents.flatMap((t) => {
    if (voie && t.ref.id === voie.talent) return t.ref.spec && t.ref.spec !== voie.spec ? [] : [{ ...t, ref: { id: voie.talent, spec: voie.spec }, label: voie.nom, aSpecifier: false }];
    return t.aSpecifier || !talentDeCombat(t.ref.id) || TALENTS_HORS_DU_COMBAT.has(t.ref.id) ? [] : [t];
  });
  return { ...p, talents: talents.filter((t, i, l) => l.findIndex((u) => u.ref.id === t.ref.id && u.ref.spec === t.ref.spec) === i) };
}

export type Achat = { genre: 'carac'; id: string } | { genre: 'competence' | 'talent'; ref: { id: string; spec?: string } } | { genre: 'niveau' } | { genre: 'sort'; id: string };

export function acheter(e: Etat, id: string, a: Achat): string | null {
  const h = heros(e, id);
  if (!h) return 'Héros introuvable.';
  if (!niveauMaximal(e)) return 'La salle d’armes est fermée.';
  if (e.expedition?.groupe.includes(id)) return 'Ce héros est en expédition.';
  const verbe = { carac: 'acheterLaCaracteristique', competence: 'acheterLaCompetence', talent: 'acheterLeTalent', niveau: 'changerDeCarriere', sort: 'acheterLeSort' }[a.genre];
  if (a.genre === 'niveau') {
    const suivant = progression(h.c).suivant;
    if (!suivant) return 'Sommet de la carrière.';
    if (suivant.niveau > niveauMaximal(e)) return 'La salle d’armes n’enseigne pas encore ce niveau.';
    return messageDuNoyau(auNoyau(e, h, [{ verbe, args: [h.c.id, h.carriere, suivant.niveau] }]), () => (h.c.careerLevel ?? 1) === suivant.niveau);
  }
  const xp = h.c.xp ?? 0;
  const args = a.genre === 'carac' || a.genre === 'sort' ? [h.c.id, a.id] : [h.c.id, a.ref];
  return messageDuNoyau(auNoyau(e, h, [{ verbe, args }]), () => (h.c.xp ?? 0) < xp);
}

/** `null` si le geste a pris (`pris`), sinon la ligne du noyau qui dit pourquoi. */
const messageDuNoyau = (ligne: string, pris: () => boolean): string | null => (pris() ? null : ligne || 'Le geste n’a rien changé.');

// ─── Forge et relais : équipement et provisions ─────────────────────────────────────────────────────────────

const prixDe = (id: string): number => Math.max(1, Math.round(articleDuCatalogue(id).prixCO * ECHELLE_DES_PRIX));
export const prixDArmure = (p: PoidsDArmure): number => Math.round({ legere: 2, moyenne: 5, lourde: 30 }[p] * ECHELLE_DES_PRIX); // LDB 63 l.95-103

/** Un objet en vente : ce que le catalogue en dit, son prix au hameau, et la main où il se tient (arme). */
export interface Article extends ArticleDuCatalogue { id: string; prix: number; tenue: 'main' | 'secondaire' }
const article = (id: string): Article => ({ ...articleDuCatalogue(id), id, prix: prixDe(id), tenue: MAIN_SECONDAIRE.has(id) ? 'secondaire' : 'main' });
export const armesEnVente = (e: Etat): Article[] => ARMES_DE_FORGE.slice(0, e.batiments.forge + 1).flat().map(article);
export interface ArmureEnVente { poids: PoidsDArmure; label: string; prix: number; enc: number; pa: number; qualites: string[] }
export const armuresEnVente = (e: Etat): ArmureEnVente[] =>
  ARMURES_DE_FORGE.slice(0, e.batiments.forge + 1).map((poids) => {
    const a = ARMURES_RAPIDES[poids];
    return { poids, label: a.label, prix: prixDArmure(poids), enc: a.enc, pa: a.pa, qualites: libellesDeQualites(a.qualites) };
  });
export const provisionsEnVente = (e: Etat): Article[] => PROVISIONS.slice(0, e.batiments.relais + 1).flat().map(article);

/** Ce que le héros tient : main principale, main secondaire (du set actif), armure portée et ses PA au corps. */
export function equipement(h: Heros): { main?: string; secondaire?: string; armure?: string; pa: number } {
  const lo = (h.c.loadouts ?? []).find((l) => l.id === h.c.activeLoadoutId) ?? h.c.loadouts?.[0];
  const nom = (uid?: string) => (uid ? h.c.items?.find((i) => i.uid === uid)?.label : undefined);
  return { main: nom(lo?.main), secondaire: nom(lo?.secondaire), armure: h.c.items?.filter((i) => i.kind === 'armor' && i.equipped).map((i) => i.label).join(', ') || undefined, pa: h.c.armour.corps };
}

function payer(e: Etat, h: Heros | undefined, prix: number): string | null {
  if (!h) return 'Héros introuvable.';
  if (e.expedition?.groupe.includes(h.c.id)) return 'Ce héros est en expédition.';
  if (e.or < prix) return `Il faut ${prix} CO.`;
  e.or -= prix;
  return null;
}

/** Achète l'arme `armeId` au héros et la lui met en main ; l'objet qu'elle remplace est laissé au forgeron. */
export function acheterUneArme(e: Etat, id: string, armeId: string): string | null {
  const h = heros(e, id);
  if (!armesEnVente(e).some((a) => a.id === armeId)) return 'La forge ne la vend pas encore.';
  const refus = payer(e, h, prixDe(armeId));
  if (refus || !h) return refus;
  const slot = MAIN_SECONDAIRE.has(armeId) ? 'secondaire' : 'main';
  const lo = (h.c.loadouts ?? []).find((l) => l.id === h.c.activeLoadoutId) ?? h.c.loadouts?.[0];
  const ancien = lo?.[slot];
  const munition = MUNITIONS[armeId];
  const neufs = doter(munition && !h.c.items?.some((i) => i.trappingId === munition) ? [armeId, munition] : [armeId], `forge${e.graine++}`);
  const avant = h.c;
  h.c = { ...h.c, items: [...(h.c.items ?? []).filter((i) => i.uid !== ancien), ...neufs] };
  const ligne = lo ? auNoyau(e, h, [{ verbe: 'garnirLaPanoplie', args: [h.c.id, lo.id, slot, neufs[0].uid] }]) : 'Ce héros n’a pas de panoplie.';
  if ((h.c.loadouts ?? []).some((l) => l[slot] === neufs[0].uid)) return null;
  h.c = avant;
  e.or += prixDe(armeId);
  return ligne || 'Le forgeron ne peut pas lui mettre cette arme en main.';
}

/** Achète l'armure `poids` des règles rapides au héros et la lui fait porter ; ses anciennes pièces sont reprises. */
export function acheterUneArmure(e: Etat, id: string, poids: PoidsDArmure): string | null {
  const h = heros(e, id);
  if (!armuresEnVente(e).some((a) => a.poids === poids)) return 'La forge ne la vend pas encore.';
  const refus = payer(e, h, prixDArmure(poids));
  if (refus || !h) return refus;
  const neuve = armureRapide(poids, `forge${e.graine++}-armure`);
  h.c.items = [...(h.c.items ?? []).filter((i) => i.kind !== 'armor'), neuve];
  auNoyau(e, h, [{ verbe: 'equiperLObjet', args: [neuve.uid] }]);
  return null;
}

export function acheterUneProvision(e: Etat, id: string, objetId: string): string | null {
  const h = heros(e, id);
  if (!provisionsEnVente(e).some((a) => a.id === objetId)) return 'Le relais n’en vend pas encore.';
  const refus = payer(e, h, prixDe(objetId));
  if (refus || !h) return refus;
  h.c.items = [...(h.c.items ?? []), ...doter([objetId], `relais${e.graine++}`)];
  return null;
}

/** Les provisions qu'un héros porte, regroupées : une entrée par objet du catalogue, avec un uid à utiliser. */
export function provisionsPortees(h: Heros): { id: string; label: string; nombre: number; uid: string; refus: string | null }[] {
  const ids = new Set(PROVISIONS.flat());
  const out = new Map<string, { id: string; label: string; nombre: number; uid: string; refus: string | null }>();
  for (const i of h.c.items ?? []) {
    if (!i.trappingId || !ids.has(i.trappingId)) continue;
    const prev = out.get(i.trappingId);
    if (prev) prev.nombre += i.qty ?? 1;
    else out.set(i.trappingId, { id: i.trappingId, label: i.label, nombre: i.qty ?? 1, uid: i.uid, refus: refusDUsage(h.c, i.uid) });
  }
  return [...out.values()];
}

// ─── Expédition ─────────────────────────────────────────────────────────────────────────────────────────────

export const destinationsOuvertes = (e: Etat) => DESTINATIONS.filter((d) => d.palier <= e.batiments.cartographe);
export const valide = (h: Heros): boolean => !horsDeCombat(h.c);
/** En état de partir : valide, et pas à l'hospice. */
export const disponible = (h: Heros): boolean => valide(h) && !h.retrait;

export function partir(e: Etat, destinationId: string, groupe: string[]): string | null {
  const d = DESTINATIONS.find((x) => x.id === destinationId);
  if (!d || d.palier > e.batiments.cartographe) return 'Destination inconnue.';
  const choisis = groupe.map((id) => heros(e, id)).filter((h): h is Heros => !!h && disponible(h));
  if (!choisis.length) return 'Choisissez au moins un héros valide.';
  if (choisis.length > TAILLE_DU_GROUPE) return `${TAILLE_DU_GROUPE} héros au plus.`;
  const rng = tirer(e);
  const salles: Salle[] = [];
  for (let i = 0; i < d.salles - 1; i++) {
    const t = rng.int(1, 100);
    const type: TypeDeSalle = i === 0 ? 'combat' : t <= 50 ? 'combat' : t <= 70 ? 'elite' : t <= 85 ? 'camp' : 'tresor';
    salles.push({ type, ennemis: type === 'combat' ? choisir(rng, d.meutes) : type === 'elite' ? choisir(rng, d.elites) : [], faite: false });
  }
  salles.push({ type: 'boss', ennemis: d.boss, faite: false });
  e.expedition = { destination: d.id, salles, index: 0, groupe: choisis.map((h) => h.c.id), or: 0, trophees: 0, px: 0, prieres: [] };
  return null;
}

export const herosDuGroupe = (e: Etat): Heros[] => (e.expedition?.groupe ?? []).map((id) => heros(e, id)).filter((h): h is Heros => !!h);
export const destinationCourante = (e: Etat) => DESTINATIONS.find((d) => d.id === e.expedition?.destination);

/** Utilise, entre deux salles, la provision `uid` du héros `id` : le noyau applique l'objet ou dit pourquoi il le garde. */
export function utiliserUneProvision(e: Etat, id: string, uid: string): string {
  const h = herosDuGroupe(e).find((x) => x.c.id === id);
  return h ? auNoyau(e, h, [{ verbe: 'utiliserLObjet', args: [uid] }]) : 'Héros introuvable.';
}

/** Le Béni `id` peut-il encore prier pour soigner pendant cette expédition ? */
export const peutPrier = (e: Etat, h: Heros): boolean =>
  !!e.expedition && !e.expedition.prieres.includes(h.c.id) && valide(h) && (h.c.spells ?? []).includes(PRIERE_DE_SOIN);

/** La prière de soin du Béni `id` sur le compagnon `cibleId`, une fois par expédition : le noyau lance la Bénédiction. */
export function prier(e: Etat, id: string, cibleId: string): string {
  const groupe = herosDuGroupe(e);
  const pretre = groupe.find((h) => h.c.id === id);
  if (!pretre || !peutPrier(e, pretre)) return 'Pas de prière possible.';
  e.expedition!.prieres.push(id);
  const r = auHameau(groupe.map((h) => h.c), [{ verbe: 'incanterLeSort', args: [id, PRIERE_DE_SOIN, cibleId] }], e.graine++);
  for (const c of r.groupe) { const h = groupe.find((x) => x.c.id === c.id); if (h) h.c = c; }
  return r.journal.slice(-2).join(' ');
}

export interface RecitDeSalle { titre: string; lignes: string[]; combat?: IssueDuCombat; fin?: 'defaite' | 'succes' }

/** Franchit la salle courante. Chaque salle prend une journée. */
export function avancer(e: Etat): RecitDeSalle {
  const x = e.expedition!;
  const d = destinationCourante(e)!;
  const salle = x.salles[x.index];
  const groupe = herosDuGroupe(e);
  const rng = tirer(e);
  let recit: RecitDeSalle;
  if (salle.type === 'camp') {
    const lignes = groupe.flatMap((h) => reposer(h.c, e.graine++, 1));
    recit = { titre: 'Un abri pour la nuit', lignes: ['Le groupe établit un camp et monte la garde à tour de rôle.', ...(lignes.length ? lignes : ['Personne n’a besoin de repos.'])] };
  } else if (salle.type === 'tresor') {
    const or = d.or + rng.int(0, d.or);
    x.or += or;
    recit = { titre: 'Une cache oubliée', lignes: [`Sous des pierres descellées, une bourse : ${or} CO.`] };
  } else {
    const combattants = groupe.filter(valide);
    const destinAvant = new Map(groupe.map((h) => [h.c.id, h.c.fate ?? 0]));
    const issue = jouerLeCombat(combattants.map((h) => h.c), salle.ennemis, e.graine++, d.lumiere);
    for (const apres of issue.groupe) {
      const h = groupe.find((g) => g.c.id === apres.id);
      if (h) h.c = apres;
    }
    for (const h of groupe) if (issue.morts.includes(h.c.id)) h.c.dead = true;
    if (issue.issue === 'impasse') {
      return { titre: 'Retraite', combat: issue, fin: 'defaite', lignes: ['Le combat s’enlise ; le groupe décroche en bon ordre.', ...rentrer(e, false)] };
    }
    if (issue.issue === 'defaite') {
      return { titre: 'Déroute', combat: issue, fin: 'defaite', lignes: terminerEnDeroute(e, destinAvant) };
    }
    const morts = groupe.filter((h) => h.c.dead);
    for (const h of morts) enterrer(e, h, d.nom);
    const or = Math.round(d.or * (salle.type === 'boss' ? 4 : salle.type === 'elite' ? 2 : 1) * (0.75 + rng.int(0, 50) / 100));
    x.or += or;
    if (salle.type === 'elite') x.trophees += rng.int(1, 100) <= 35 ? 1 : 0;
    const lignes = [`Victoire contre ${salle.ennemis.map(nomDeCreature).join(', ')}. Butin : ${or} CO.`, ...morts.map((h) => `${h.c.label} est tombé·e. Son corps est ramené au hameau.`)];
    recit = { titre: salle.type === 'boss' ? 'Le cœur du mal' : salle.type === 'elite' ? 'Un adversaire redoutable' : 'Embuscade', lignes, combat: issue };
  }
  const px = PX_PAR_SALLE[salle.type];
  x.px += px;
  for (const h of herosDuGroupe(e)) h.c.xp = (h.c.xp ?? 0) + px;
  salle.faite = true;
  x.index++;
  if (salle.type === 'boss') {
    x.trophees += 1 + (e.bossVaincus.includes(d.id) ? 0 : 1);
    if (!e.bossVaincus.includes(d.id)) e.bossVaincus.push(d.id);
    recit.lignes.push(...rentrer(e, true));
    recit.fin = 'succes';
  }
  return recit;
}

function enterrer(e: Etat, h: Heros, ou: string): void {
  e.cimetiere.unshift({ nom: h.c.label, carriere: h.carriere, expeditions: h.expeditions + 1, ou, jour: e.jour });
  e.roster = e.roster.filter((x) => x !== h);
  if (e.expedition) e.expedition.groupe = e.expedition.groupe.filter((id) => id !== h.c.id);
}

/** Déroute : le butin est perdu. Chaque héros laissé pour mort brûle un point de Destin pour en réchapper ; sans
 *  Destin, il ne revient pas. Qui en a déjà brûlé un pendant la rencontre (« Meurs un autre jour ») ne paie pas deux
 *  fois. LDB 17 l.31. */
function terminerEnDeroute(e: Etat, destinAvant: Map<string, number>): string[] {
  const d = destinationCourante(e)!;
  const lignes = ['Le groupe est submergé. Le butin de l’expédition est perdu.'];
  for (const h of herosDuGroupe(e)) {
    if (h.c.dead) { lignes.push(`${h.c.label} ne revient pas.`); enterrer(e, h, d.nom); continue; }
    if ((h.c.fate ?? 0) < (destinAvant.get(h.c.id) ?? 0)) { lignes.push(`${h.c.label} a déjà échappé à la mort pendant le combat (Destin brûlé, reste ${h.c.fate}).`); continue; }
    if ((h.c.fate ?? 0) <= 0) { lignes.push(`${h.c.label}, sans plus de Destin, ne revient pas.`); enterrer(e, h, d.nom); continue; }
    h.c.fate = (h.c.fate ?? 0) - 1;
    lignes.push(`${h.c.label} échappe de peu à la mort et rampe jusqu’au hameau (Destin −1, reste ${h.c.fate}).`);
  }
  e.expedition!.or = 0; e.expedition!.trophees = 0;
  lignes.push(...rentrer(e, false));
  return lignes;
}

/** Retour au hameau, le butin en poche. Chaque salle franchie a pris un jour : seuls les héros restés au hameau
 *  se sont reposés ; ceux qui rentrent portent leurs blessures. Rentrer sans avoir franchi une salle ne fait passer
 *  aucun jour. */
export function rentrer(e: Etat, reussie: boolean): string[] {
  const x = e.expedition!;
  const d = destinationCourante(e)!;
  const peage = x.index > 0 ? [0, 10, 25, 50][e.batiments.peage] : 0;
  e.or += x.or + peage; e.trophees += x.trophees;
  for (const h of herosDuGroupe(e)) { h.expeditions++; if (reussie) h.victoires++; }
  const jours = x.index;
  const lignes = [`Retour à Grisefosse${jours ? ` après ${jours} jour${jours > 1 ? 's' : ''}` : ', sans avoir franchi une salle'} : ${x.or} CO${x.trophees ? `, ${x.trophees} trophée(s)` : ''}${peage ? `, +${peage} CO du péage` : ''}.`];
  noter(e, `${d.nom} : ${reussie ? 'expédition réussie' : x.or ? 'retour prudent' : 'déroute'}. ${lignes[0]}`);
  const partis = new Set(x.groupe);
  for (const h of herosDuGroupe(e)) h.c.conditions = h.c.conditions.filter((c) => DURABLES.has(c.id));
  e.expedition = null;
  if (jours) passerDesJours(e, jours, partis);
  return lignes;
}

/** Quand personne n'est plus en état de partir (hors de combat, ou sous la moitié de ses Blessures), la compagnie
 *  attend une semaine que les blessés se relèvent : jamais d'impasse, faute d'or pour la chapelle. */
export const compagnieEpuisee = (e: Etat): boolean => e.roster.length > 0 && !e.roster.some((h) => disponible(h) && h.c.wounds.current * 2 >= h.c.wounds.max);
export function attendreUneSemaine(e: Etat): string | null {
  if (!compagnieEpuisee(e)) return 'Il reste des héros en état de partir.';
  noter(e, 'Personne n’est en état de partir : la compagnie panse ses plaies une semaine durant.');
  passerDesJours(e, SEMAINE_DE_REPOS, new Set());
  return null;
}

/** Les États qui survivent à la rencontre une fois le héros ramené au hameau ; les autres retombent avec elle. */
const DURABLES = new Set(['extenue', 'inconscient']);

/** `jours` journées passent : les héros restés au hameau (hors `absents`) se reposent (`reposer`) ; les États de la
 *  rencontre retombent chez eux. De nouveaux voyageurs arrivent. */
function passerDesJours(e: Etat, jours: number, absents: Set<string>): void {
  e.jour += jours;
  for (const h of e.roster) {
    if (absents.has(h.c.id)) continue;
    if (h.retrait) h.retrait = Math.max(0, h.retrait - jours) || undefined;
    h.c.conditions = h.c.conditions.filter((c) => DURABLES.has(c.id));
    reposer(h.c, e.graine++, jours);
  }
  renouvelerLesCandidats(e);
  if (e.roster.length === 0 && e.or < Math.min(...e.candidats.map((c) => c.prix))) noter(e, 'La compagnie est vide et la bourse aussi : un voyageur accepte de servir sans solde.');
}

export const victoireFinale = (e: Etat): boolean => e.bossVaincus.includes('autel');

// ─── Sauvegarde ─────────────────────────────────────────────────────────────────────────────────────────────

const CLE = 'grisefosse-v1';
export function sauver(e: Etat): void {
  try { localStorage.setItem(CLE, JSON.stringify(e)); } catch { /* stockage indisponible : la partie vit en mémoire */ }
}

/** Une sauvegarde de la version 1 (sans forge, `semaine` pour le jour), portée à la version 2. */
interface EtatV1 extends Omit<Etat, 'version' | 'jour' | 'batiments' | 'cimetiere' | 'expedition'> {
  version: 1; semaine: number; batiments: Omit<Etat['batiments'], 'forge'>;
  cimetiere: (Omit<Tombe, 'jour'> & { semaine: number })[]; expedition: Omit<Expedition, 'prieres'> | null;
}
function migrer(v1: EtatV1): Etat {
  const { semaine, version: _v, cimetiere, expedition, ...reste } = v1;
  return {
    ...reste, version: 2, jour: semaine, batiments: { ...v1.batiments, forge: 0 },
    cimetiere: cimetiere.map(({ semaine: s, ...t }) => ({ ...t, jour: s })),
    expedition: expedition && { ...expedition, prieres: [] },
  };
}

export function charger(): Etat | null {
  try {
    const brut = localStorage.getItem(CLE);
    const e = brut ? JSON.parse(brut) as Etat | EtatV1 : null;
    if (!e || !Array.isArray(e.roster)) return null;
    return e.version === 2 ? e : e.version === 1 ? migrer(e) : null;
  } catch { return null; }
}
export function effacer(): void {
  try { localStorage.removeItem(CLE); } catch { /* idem */ }
}
