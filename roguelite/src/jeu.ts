/**
 * Le jeu roguelite : un hameau à relever, des recrues, des expéditions de salles en salles. Les règles de combat,
 * de création, d'avancement et de guérison sont celles du noyau (`./combat`) ; ce module ne tient que la boucle de
 * jeu et ses valeurs d'adaptation (prix, gains, paliers), toutes regroupées ici. Tout l'aléa passe par le RNG à
 * graine du moteur (`makeRNG`), jamais par `Math.random`.
 */
import { makeRNG, generateName, type RNG, nouvelleRecrue, jouerLeCombat, guerisonNaturelle, soigner, bonusDEndurance, horsDeCombat, augmenter, nomDeCreature, type Combatant, type CharKey, type IssueDuCombat } from './combat';

export type { CharKey } from './combat';

// ─── Valeurs d'adaptation ───────────────────────────────────────────────────────────────────────────────────

export type IdBatiment = 'relais' | 'temple' | 'salle' | 'cartographe' | 'peage' | 'memorial';

export interface Batiment { id: IdBatiment; nom: string; role: string; paliers: { cout: number; trophees: number; effet: string }[] }

export const BATIMENTS: readonly Batiment[] = [
  { id: 'relais', nom: 'Relais de diligence', role: 'Recrutement', paliers: [
    { cout: 0, trophees: 0, effet: '2 candidats, carrières de base' },
    { cout: 120, trophees: 0, effet: '3 candidats, carrières martiales' },
    { cout: 300, trophees: 1, effet: '4 candidats, carrières d’élite' },
  ] },
  { id: 'temple', nom: 'Chapelle de Shallya', role: 'Soins', paliers: [
    { cout: 0, trophees: 0, effet: 'Fermée : seuls les jours passent' },
    { cout: 80, trophees: 0, effet: 'Soins complets, 15 CO par héros' },
    { cout: 220, trophees: 1, effet: 'Soins complets, 5 CO par héros' },
    { cout: 450, trophees: 2, effet: 'Soins gratuits, +1 Destin à qui n’en a plus' },
  ] },
  { id: 'salle', nom: 'Salle d’armes', role: 'Entraînement', paliers: [
    { cout: 0, trophees: 0, effet: 'Fermée : les PX attendent' },
    { cout: 100, trophees: 0, effet: 'Jusqu’à 5 Augmentations par Caractéristique' },
    { cout: 260, trophees: 1, effet: 'Jusqu’à 10 Augmentations' },
    { cout: 500, trophees: 2, effet: 'Jusqu’à 15 Augmentations' },
  ] },
  { id: 'cartographe', nom: 'Cartographe', role: 'Destinations', paliers: [
    { cout: 0, trophees: 0, effet: 'La lisière du Reikwald' },
    { cout: 150, trophees: 1, effet: 'Ouvre les Tertres de Grisefosse' },
    { cout: 320, trophees: 2, effet: 'Ouvre la Clairière des hardes' },
    { cout: 600, trophees: 3, effet: 'Ouvre l’Autel du Chaos' },
  ] },
  { id: 'peage', nom: 'Péage du pont', role: 'Revenu', paliers: [
    { cout: 0, trophees: 0, effet: 'Ruiné : aucun revenu' },
    { cout: 90, trophees: 0, effet: '+10 CO à chaque retour' },
    { cout: 240, trophees: 1, effet: '+25 CO à chaque retour' },
    { cout: 480, trophees: 2, effet: '+50 CO à chaque retour' },
  ] },
  { id: 'memorial', nom: 'Jardin de Morr', role: 'Mémoire', paliers: [
    { cout: 0, trophees: 0, effet: 'Un champ en friche' },
    { cout: 110, trophees: 0, effet: 'Chaque recrue arrive avec 10 PX par héros tombé (max 100)' },
    { cout: 300, trophees: 1, effet: '20 PX par héros tombé (max 200)' },
  ] },
];

const CARRIERES_PAR_RELAIS: readonly string[][] = [
  ['soldat', 'milicien', 'chasseur', 'hors-la-loi', 'ratier'],
  ['repurgateur', 'tueur', 'spadassin', 'pretre-guerrier', 'gladiateur', 'hallebardier'],
  ['chevalier-errant', 'flagellant', 'joueur-d-epee', 'chasseur-de-primes', 'garde'],
];
const NOMS_DE_CARRIERE: Record<string, string> = {
  soldat: 'Soldat', milicien: 'Milicien', chasseur: 'Chasseur', 'hors-la-loi': 'Hors-la-loi', ratier: 'Ratier',
  repurgateur: 'Répurgateur', tueur: 'Tueur', spadassin: 'Spadassin', 'pretre-guerrier': 'Prêtre-guerrier', gladiateur: 'Gladiateur',
  hallebardier: 'Hallebardier', 'chevalier-errant': 'Chevalier errant', flagellant: 'Flagellant', 'joueur-d-epee': 'Joueur d’épée',
  'chasseur-de-primes': 'Chasseur de primes', garde: 'Garde',
};
export const nomDeCarriere = (id: string): string => NOMS_DE_CARRIERE[id] ?? id;
const ESPECES: Record<string, { nom: string; race: 'humain' | 'nain' | 'halfling' }> = {
  'humains-reiklander': { nom: 'Humain', race: 'humain' }, nains: { nom: 'Nain', race: 'nain' }, halflings: { nom: 'Halfling', race: 'halfling' },
};
export const nomDEspece = (id: string): string => ESPECES[id]?.nom ?? id;

export type TypeDeSalle = 'combat' | 'elite' | 'camp' | 'tresor' | 'boss';
export interface Destination {
  id: string; nom: string; recit: string; palier: number; salles: number;
  meutes: string[][]; elites: string[][]; boss: string[]; or: number; lumiere: string;
}
export const DESTINATIONS: readonly Destination[] = [
  { id: 'reikwald', nom: 'Lisière du Reikwald', palier: 0, salles: 4, or: 15, lumiere: 'jour',
    recit: 'Des loups et des peaux-vertes rôdent le long de la route de la diligence.',
    meutes: [['gobelin', 'gobelin'], ['loup'], ['rat-geant', 'rat-geant'], ['brigand'], ['snotling', 'snotling', 'gobelin']],
    elites: [['orc'], ['brigand', 'loup']], boss: ['loup-funeste'] },
  { id: 'tertres', nom: 'Tertres de Grisefosse', palier: 1, salles: 5, or: 18, lumiere: 'crepuscule',
    recit: 'Les morts ne reposent plus sous les vieux tertres. Quelqu’un les réveille.',
    meutes: [['squelette', 'zombie'], ['zombie', 'zombie', 'zombie'], ['goule-de-crypte', 'zombie']],
    elites: [['squelette', 'squelette', 'goule-de-crypte'], ['chevalier-mort-vivant-revenant']], boss: ['necromancien', 'squelette', 'squelette'] },
  { id: 'hardes', nom: 'Clairière des hardes', palier: 2, salles: 5, or: 25, lumiere: 'couvert',
    recit: 'Les hommes-bêtes se rassemblent autour d’une pierre de harde.',
    meutes: [['ungor', 'ungor'], ['gor', 'ungor'], ['ungor', 'ungor', 'ungor']],
    elites: [['gor', 'gor', 'ungor'], ['gor-combattant', 'ungor']], boss: ['minotaure', 'ungor'] },
  { id: 'autel', nom: 'Autel du Chaos', palier: 3, salles: 6, or: 35, lumiere: 'crepuscule',
    recit: 'Un culte a dressé un autel aux Puissances de la Ruine. Il faut l’abattre.',
    meutes: [['cultiste', 'cultiste'], ['mutant', 'cultiste'], ['cultiste', 'cultiste', 'mutant']],
    elites: [['guerrier-du-chaos', 'cultiste'], ['mutant', 'mutant', 'cultiste']], boss: ['guerrier-du-chaos', 'troll'] },
];

/** PX gagnés par salle franchie, par type. */
const PX_PAR_SALLE: Record<TypeDeSalle, number> = { combat: 20, elite: 35, boss: 60, camp: 0, tresor: 5 };
const OR_INITIAL = 100;
const PRIX_DE_RECRUE = [15, 30, 50];
const TAILLE_DU_GROUPE = 4;

// ─── État ───────────────────────────────────────────────────────────────────────────────────────────────────

export interface Heros { c: Combatant; carriere: string; espece: string; expeditions: number; victoires: number }
export interface Candidat extends Heros { prix: number }
export interface Tombe { nom: string; carriere: string; expeditions: number; ou: string; semaine: number }
export interface Salle { type: TypeDeSalle; ennemis: string[]; faite: boolean; note?: string }
export interface Expedition { destination: string; salles: Salle[]; index: number; groupe: string[]; or: number; trophees: number; px: number }

export interface Etat {
  version: 1;
  graine: number;
  semaine: number;
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
const noter = (e: Etat, ligne: string) => { e.journal = [`Jour ${e.semaine} — ${ligne}`, ...e.journal].slice(0, 40); };

export function nouvellePartie(graine: number): Etat {
  const e: Etat = {
    version: 1, graine, semaine: 1, or: OR_INITIAL, trophees: 0,
    batiments: { relais: 0, temple: 0, salle: 0, cartographe: 0, peage: 0, memorial: 0 },
    roster: [], candidats: [], cimetiere: [], expedition: null, bossVaincus: [], journal: [],
  };
  for (let i = 0; i < 4; i++) e.roster.push(tirerUnHeros(e, i === 0 ? 'soldat' : undefined));
  renouvelerLesCandidats(e);
  noter(e, 'Quatre aventuriers descendent de la diligence à Grisefosse. Le hameau est en ruines ; tout reste à bâtir.');
  return e;
}

function tirerUnHeros(e: Etat, carriereImposee?: string): Heros {
  const rng = tirer(e);
  const pool = CARRIERES_PAR_RELAIS.slice(0, e.batiments.relais + 1).flat();
  const carriere = carriereImposee ?? choisir(rng, pool);
  const espece = carriere === 'tueur' ? 'nains' : rng.int(1, 10) <= 8 ? 'humains-reiklander' : choisir(rng, ['nains', 'halflings']);
  const sexe = rng.int(0, 1) ? 'M' : 'F';
  const nom = generateName(ESPECES[espece].race, sexe, rng) ?? 'Sans-nom';
  const c = nouvelleRecrue(e.graine++, carriere, espece, nom);
  const morr = e.batiments.memorial;
  if (morr) c.xp = (c.xp ?? 0) + Math.min(morr * 100, e.cimetiere.length * 10 * morr);
  return { c, carriere, espece, expeditions: 0, victoires: 0 };
}

export function renouvelerLesCandidats(e: Etat): void {
  const n = 2 + e.batiments.relais;
  e.candidats = Array.from({ length: n }, () => {
    const h = tirerUnHeros(e);
    const palier = CARRIERES_PAR_RELAIS.findIndex((l) => l.includes(h.carriere));
    return { ...h, prix: PRIX_DE_RECRUE[palier] };
  });
}

// ─── Village ────────────────────────────────────────────────────────────────────────────────────────────────

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
  const gratuit = rosterVide(e) && e.or < cand.prix;
  if (!gratuit && e.or < cand.prix) return `Il faut ${cand.prix} CO.`;
  if (!gratuit) e.or -= cand.prix;
  const { prix: _prix, ...h } = cand;
  e.roster.push(h);
  e.candidats.splice(i, 1);
  noter(e, `${h.c.label}, ${nomDeCarriere(h.carriere).toLowerCase()}, rejoint la compagnie${gratuit ? ' sans solde, faute de mieux' : ''}.`);
  return null;
}

/** Plus personne de valide et pas de quoi payer : la première recrue vient sans solde, jamais d'impasse. */
export const rosterVide = (e: Etat): boolean => e.roster.length === 0;

export function congedier(e: Etat, id: string): void {
  e.roster = e.roster.filter((h) => h.c.id !== id);
}

export const prixDuSoin = (e: Etat): number | null => [null, 15, 5, 0][e.batiments.temple] ?? null;
export const blesse = (h: Heros): boolean => h.c.wounds.current < h.c.wounds.max || h.c.conditions.length > 0;

export function soignerAuTemple(e: Etat, id: string): string | null {
  const prix = prixDuSoin(e);
  const h = e.roster.find((x) => x.c.id === id);
  if (prix == null || !h) return 'La chapelle est fermée.';
  if (e.or < prix) return `Il faut ${prix} CO.`;
  e.or -= prix;
  soigner(h.c, h.c.wounds.max);
  h.c.conditions = [];
  if (e.batiments.temple >= 3 && (h.c.fate ?? 0) === 0) h.c.fate = 1;
  return null;
}

export const plafondDAugmentations = (e: Etat): number => 5 * e.batiments.salle;
export const CARACS_ENTRAINABLES: readonly CharKey[] = ['capacite-de-combat', 'force', 'endurance', 'initiative', 'agilite', 'force-mentale'];

export function entrainer(e: Etat, id: string, k: CharKey): string | null {
  const h = e.roster.find((x) => x.c.id === id);
  if (!h) return 'Héros introuvable.';
  if ((h.c.charAdvances?.[k] ?? 0) >= plafondDAugmentations(e)) return e.batiments.salle ? 'Plafond de la salle d’armes atteint.' : 'La salle d’armes est fermée.';
  return augmenter(h.c, k);
}

// ─── Expédition ─────────────────────────────────────────────────────────────────────────────────────────────

export const destinationsOuvertes = (e: Etat) => DESTINATIONS.filter((d) => d.palier <= e.batiments.cartographe);
export const valide = (h: Heros): boolean => !horsDeCombat(h.c);

export function partir(e: Etat, destinationId: string, groupe: string[]): string | null {
  const d = DESTINATIONS.find((x) => x.id === destinationId);
  if (!d || d.palier > e.batiments.cartographe) return 'Destination inconnue.';
  const heros = groupe.map((id) => e.roster.find((h) => h.c.id === id)).filter((h): h is Heros => !!h && valide(h));
  if (!heros.length) return 'Choisissez au moins un héros valide.';
  if (heros.length > TAILLE_DU_GROUPE) return `${TAILLE_DU_GROUPE} héros au plus.`;
  const rng = tirer(e);
  const salles: Salle[] = [];
  for (let i = 0; i < d.salles - 1; i++) {
    const t = rng.int(1, 100);
    const type: TypeDeSalle = i === 0 ? 'combat' : t <= 50 ? 'combat' : t <= 70 ? 'elite' : t <= 85 ? 'camp' : 'tresor';
    salles.push({ type, ennemis: type === 'combat' ? choisir(rng, d.meutes) : type === 'elite' ? choisir(rng, d.elites) : [], faite: false });
  }
  salles.push({ type: 'boss', ennemis: d.boss, faite: false });
  e.expedition = { destination: d.id, salles, index: 0, groupe: heros.map((h) => h.c.id), or: 0, trophees: 0, px: 0 };
  return null;
}

export const herosDuGroupe = (e: Etat): Heros[] => (e.expedition?.groupe ?? []).map((id) => e.roster.find((h) => h.c.id === id)).filter((h): h is Heros => !!h);
export const destinationCourante = (e: Etat) => DESTINATIONS.find((d) => d.id === e.expedition?.destination);

export interface RecitDeSalle { titre: string; lignes: string[]; combat?: IssueDuCombat; fin?: 'defaite' | 'succes' }

/** Franchit la salle courante. */
export function avancer(e: Etat): RecitDeSalle {
  const x = e.expedition!;
  const d = destinationCourante(e)!;
  const salle = x.salles[x.index];
  const groupe = herosDuGroupe(e);
  const rng = tirer(e);
  let recit: RecitDeSalle;
  if (salle.type === 'camp') {
    const lignes = groupe.map((h) => {
      if (h.c.wounds.current >= h.c.wounds.max) return `${h.c.label} est en pleine forme.`;
      const gain = guerisonNaturelle(h.c, e.graine++);
      return gain ? `${h.c.label} dort d’un sommeil réparateur : +${gain} PB.` : `${h.c.label} dort mal et ne récupère rien.`;
    });
    recit = { titre: 'Un abri pour la nuit', lignes: ['Le groupe établit un camp et monte la garde à tour de rôle.', ...lignes] };
  } else if (salle.type === 'tresor') {
    const or = d.or + rng.int(0, d.or);
    x.or += or;
    recit = { titre: 'Une cache oubliée', lignes: [`Sous des pierres descellées, une bourse : ${or} CO.`] };
  } else {
    const combattants = groupe.filter(valide);
    const issue = jouerLeCombat(combattants.map((h) => h.c), salle.ennemis, e.graine++, d.lumiere);
    for (const apres of issue.groupe) {
      const h = groupe.find((g) => g.c.id === apres.id);
      if (h) h.c = apres;
    }
    if (issue.issue !== 'victoire') {
      recit = { titre: issue.issue === 'defaite' ? 'Déroute' : 'Retraite', lignes: [], combat: issue, fin: 'defaite' };
      recit.lignes = terminerEnDeroute(e);
      return recit;
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
  e.cimetiere.unshift({ nom: h.c.label, carriere: h.carriere, expeditions: h.expeditions + 1, ou, semaine: e.semaine });
  e.roster = e.roster.filter((x) => x !== h);
  if (e.expedition) e.expedition.groupe = e.expedition.groupe.filter((id) => id !== h.c.id);
}

/** Déroute : le butin est perdu. Chaque héros laissé pour mort brûle un point de Destin pour en réchapper ; sans
 *  Destin, il ne revient pas. LDB 17 l.31. */
function terminerEnDeroute(e: Etat): string[] {
  const d = destinationCourante(e)!;
  const lignes = ['Le groupe est submergé. Le butin de l’expédition est perdu.'];
  for (const h of herosDuGroupe(e)) {
    if (h.c.dead || (h.c.fate ?? 0) <= 0) { lignes.push(`${h.c.label} ne revient pas.`); enterrer(e, h, d.nom); continue; }
    h.c.fate = (h.c.fate ?? 0) - 1;
    lignes.push(`${h.c.label} échappe de peu à la mort et rampe jusqu’au hameau (Destin −1, reste ${h.c.fate}).`);
  }
  e.expedition!.or = 0; e.expedition!.trophees = 0;
  lignes.push(...rentrer(e, false));
  return lignes;
}

/** Retour au hameau, le butin en poche : une nuit et un jour de repos passent. */
export function rentrer(e: Etat, reussie: boolean): string[] {
  const x = e.expedition!;
  const d = destinationCourante(e)!;
  const peage = [0, 10, 25, 50][e.batiments.peage];
  e.or += x.or + peage; e.trophees += x.trophees;
  for (const h of herosDuGroupe(e)) { h.expeditions++; if (reussie) h.victoires++; }
  const lignes = [`Retour à Grisefosse : ${x.or} CO${x.trophees ? `, ${x.trophees} trophée(s)` : ''}${peage ? `, +${peage} CO du péage` : ''}.`];
  noter(e, `${d.nom} : ${reussie ? 'expédition réussie' : x.or ? 'retour prudent' : 'déroute'}. ${lignes[0]}`);
  e.expedition = null;
  passerLaSemaine(e);
  return lignes;
}

/** Un retour au hameau : une nuit de sommeil (guérison naturelle, LDB 18 l.296) et une journée de repos complet
 *  (+BE PB, LDB 18 l.296) ; les plaies sont pansées, les États de la rencontre retombent. De nouveaux voyageurs arrivent. */
function passerLaSemaine(e: Etat): void {
  e.semaine += 2;
  for (const h of e.roster) {
    guerisonNaturelle(h.c, e.graine++);
    soigner(h.c, bonusDEndurance(h.c));
    h.c.conditions = [];
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
export function charger(): Etat | null {
  try {
    const brut = localStorage.getItem(CLE);
    const e = brut ? JSON.parse(brut) as Etat : null;
    return e?.version === 1 && Array.isArray(e.roster) ? e : null;
  } catch { return null; }
}
export function effacer(): void {
  try { localStorage.removeItem(CLE); } catch { /* idem */ }
}
