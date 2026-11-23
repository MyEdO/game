/**
 * L'expédition : départ, salles, prière et provisions en route, retour, repos des absents, victoire.
 */
import { jouerLeCombat, reposer, horsDeCombat, auHameau, type IssueDuCombat } from '../noyau';

import { DESTINATIONS, PRIERE_DE_SOIN, PX_PAR_SALLE, SEMAINE_DE_REPOS, TAILLE_DU_GROUPE, TypeDeSalle } from './valeurs';
import { Etat, Heros, Salle, renouvelerLesCandidats } from './etat';
import { auNoyau, choisir, heros, noter, tirer } from './outils';

export const destinationsOuvertes = (e: Etat) => DESTINATIONS.filter((d) => d.palier <= e.batiments.cartographe);
export const valide = (h: Heros): boolean => !horsDeCombat(h.c);
/** En état de partir : valide, et pas à l'hospice. */
export const disponible = (h: Heros): boolean => valide(h) && !h.retrait;
/** Pourquoi un héros ne peut pas partir, ou `null` s'il le peut. */
export const refusDeDepart = (h: Heros): string | null => (h.retrait ? `À l’hospice encore ${h.retrait} jour${h.retrait > 1 ? 's' : ''}.` : !valide(h) ? 'Hors de combat : il doit se remettre au hameau.' : null);

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
    const lignes = [`Butin : ${or} CO · ${PX_PAR_SALLE[salle.type]} PX chacun.`, ...morts.map((h) => `${h.c.label} est tombé·e. Son corps est ramené au hameau.`)];
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
