/**
 * L'expédition : départ, salles, prière et provisions en route, retour, repos des absents, victoire.
 */
import { epreuveTentable, jouerLeCombat, jouerLEpreuve, partiesDuTest, reposer, horsDeCombat, auHameau, doter, type IssueDuCombat } from '../noyau';

import { DESTINATIONS, EPREUVES, type IdActionAJet, LIEUX_DE_SEJOUR, MUNITIONS, PRIERE_DE_SOIN, PX_PAR_SALLE, SEMAINE_DE_REPOS, TAILLE_DU_GROUPE, TypeDeSalle } from './valeurs';
import { Etat, Heros, Salle, renouvelerLesCandidats } from './etat';
import { auNoyau, choisir, heros, noter, tirer } from './outils';

export const destinationsOuvertes = (e: Etat) => DESTINATIONS.filter((d) => d.palier <= e.batiments.cartographe);
export const valide = (h: Heros): boolean => !horsDeCombat(h.c);
/** En état de partir : valide, et sans séjour en cours. */
export const disponible = (h: Heros): boolean => valide(h) && !h.sejour;
/** Le séjour en cours du héros, dit : le bâtiment et les jours qui restent ; `null` sans séjour. */
export const sejourDit = (h: Heros): string | null =>
  (h.sejour ? `${LIEUX_DE_SEJOUR[h.sejour.ou].nom} encore ${h.sejour.reste} jour${h.sejour.reste > 1 ? 's' : ''}.` : null);
/** Pourquoi un héros ne peut pas partir, ou `null` s'il le peut. */
export const refusDeDepart = (h: Heros): string | null => sejourDit(h) ?? (!valide(h) ? 'Hors de combat : il doit se remettre au hameau.' : null);

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
  e.expedition = { destination: d.id, salles, index: 0, groupe: choisis.map((h) => h.c.id), or: 0, trophees: 0, px: 0, prieres: [], munitions: Object.fromEntries(choisis.map((h) => [h.c.id, munitionsDe(h)])) };
  return null;
}

const TYPES_DE_MUNITION = new Set(Object.values(MUNITIONS));
/** Les munitions que porte un héros, par objet du catalogue. */
function munitionsDe(h: Heros): Record<string, number> {
  const n: Record<string, number> = {};
  for (const i of h.c.items ?? []) if (i.trappingId && TYPES_DE_MUNITION.has(i.trappingId)) n[i.trappingId] = (n[i.trappingId] ?? 0) + (i.qty ?? 1);
  return n;
}
/** Valeur d'adaptation : au retour, chacun ramasse ses flèches, carreaux et pierres ; il repart avec ce qu'il avait. */
function ramasserLesMunitions(e: Etat): void {
  for (const h of herosDuGroupe(e)) {
    const avant = e.expedition?.munitions?.[h.c.id] ?? {};
    const maintenant = munitionsDe(h);
    for (const [id, n] of Object.entries(avant)) {
      const manque = n - (maintenant[id] ?? 0);
      if (manque <= 0) continue;
      const tenu = h.c.items?.find((i) => i.trappingId === id);
      if (tenu) tenu.qty = (tenu.qty ?? 1) + manque;
      else h.c.items = [...(h.c.items ?? []), ...doter([id], `retour${e.graine++}`).map((i) => ({ ...i, qty: manque }))];
    }
  }
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

/** Une épreuve jouée (`jouerLEpreuve`) : qui a jeté (id), le Test, son issue et ses DR, chaque héros touché et ses
 *  Blessures avant et après, l'or pris, et ce que dit l'issue. */
export interface EpreuveDuRecit {
  testeur: string; competence: string; difficulte: string; reussite: boolean; dr: number;
  victimes: { id: string; avant: number; apres: number; max: number }[]; or: number; dit: string;
}
export interface RecitDeSalle { titre: string; lignes: string[]; combat?: IssueDuCombat; fin?: 'defaite' | 'succes'; epreuve?: EpreuveDuRecit }

/** Une action d'une salle à choix : une action à jet, ou passer son chemin. */
export type ActionDeSalle = IdActionAJet | 'passer';
/** La salle courante attend-elle le choix d'une action ? */
export const salleAChoisir = (e: Etat): boolean => !!e.expedition?.salles[e.expedition.index]?.ouverte;

/** Pourquoi le héros `h` ne peut pas tenter l'`action` de la cache, ou `null` s'il le peut. LDB 09 l.30 */
export function refusDAction(h: Heros, action: IdActionAJet): string | null {
  if (!valide(h)) return 'Hors de combat.';
  const { epreuves } = EPREUVES.tresor.actions[action];
  return epreuveTentable(h.c, epreuves) ? null : `Ne sait tenter ni ${epreuves.map((ep) => partiesDuTest(ep.flux).competence).join(' ni ')}.`;
}

/** Joue l'`action` choisie dans la salle ouverte : une action à jet se joue sur le seul héros `herosId`, testeur et
 *  cible du piège ; « passer » ne joue rien. Rend le récit, ou pourquoi l'action est refusée. Un Test que le noyau
 *  ne joue pas (`IssueDEpreuve`, `refus`) laisse la salle ouverte : le héros revient tel que le noyau le laisse, et le
 *  choix reste au joueur. */
export function agirDansLaSalle(e: Etat, action: ActionDeSalle, herosId?: string): RecitDeSalle | string {
  const x = e.expedition;
  const salle = x?.salles[x.index];
  if (!x || !salle?.ouverte) return 'Aucune action en attente.';
  const cache = EPREUVES.tresor;
  if (action === 'passer') return franchir(e, { titre: cache.titre, lignes: [cache.passer.recit] });
  const h = herosDuGroupe(e).find((g) => g.c.id === herosId);
  if (!h) return 'Choisissez un héros du groupe.';
  const refus = refusDAction(h, action);
  if (refus) return refus;
  const a = cache.actions[action];
  const ep = epreuveTentable(h.c, a.epreuves)!;
  const avant = h.c.wounds.current;
  const r = jouerLEpreuve([h.c], ep, e.graine++);
  h.c = r.groupe[0];
  if ('refus' in r) return { titre: cache.titre, lignes: r.journal.includes(r.refus) ? r.journal : [...r.journal, r.refus] };
  const { competence, difficulte } = partiesDuTest(ep.flux);
  const victimes = h.c.wounds.current < avant ? [{ id: h.c.id, avant, apres: h.c.wounds.current, max: h.c.wounds.max }] : [];
  const d = destinationCourante(e)!;
  const or = r.reussite ? d.or + tirer(e).int(0, d.or) : 0;
  x.or += or;
  const dit = r.reussite ? a.reussite : cache.declenche;
  return franchir(e, { titre: cache.titre, lignes: [
    `${h.c.label} — Test de ${[competence, difficulte].filter(Boolean).join(' ')} : ${r.reussite ? 'réussi' : 'raté'}, DR ${r.dr >= 0 ? '+' : '−'}${Math.abs(r.dr)}.`,
    dit,
    ...victimes.map((v) => `${h.c.label} est touché·e : ${v.apres}/${v.max} Blessures.`),
    ...(or ? [`La bourse cachée est prise : ${or} CO.`] : []),
  ], epreuve: { testeur: r.testeur, competence, difficulte, reussite: r.reussite, dr: r.dr, victimes, or, dit } });
}

/** Entre dans la salle courante et la franchit ; une salle à choix (`tresor`) s'ouvre et attend son action
 *  (`agirDansLaSalle`) : rend alors `null`. Chaque salle prend une journée. */
export function avancer(e: Etat): RecitDeSalle | null {
  const x = e.expedition!;
  const d = destinationCourante(e)!;
  const salle = x.salles[x.index];
  if (salle.type === 'tresor') {
    salle.ouverte = true;
    return null;
  }
  const groupe = herosDuGroupe(e);
  const rng = tirer(e);
  let recit: RecitDeSalle;
  if (salle.type === 'camp') {
    const lignes = groupe.flatMap((h) => reposer(h.c, e.graine++, 1));
    recit = { titre: 'Un abri pour la nuit', lignes: ['Le groupe établit un camp et monte la garde à tour de rôle.', ...(lignes.length ? lignes : ['Personne n’a besoin de repos.'])] };
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
  return franchir(e, recit);
}

/** La salle courante est franchie : ses PX, la suivante ; le maître vaincu ramène le groupe au hameau. */
function franchir(e: Etat, recit: RecitDeSalle): RecitDeSalle {
  const x = e.expedition!;
  const d = destinationCourante(e)!;
  const salle = x.salles[x.index];
  const px = PX_PAR_SALLE[salle.type];
  x.px += px;
  for (const h of herosDuGroupe(e)) h.c.xp = (h.c.xp ?? 0) + px;
  salle.faite = true;
  delete salle.ouverte;
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

/** Retour au hameau, le butin en poche. Chaque salle franchie a pris un jour, que les héros en séjour ont passé à se
 *  reposer ; ceux qui rentrent portent leurs blessures. Rentrer sans avoir franchi une salle ne fait passer aucun
 *  jour. */
export function rentrer(e: Etat, reussie: boolean): string[] {
  const x = e.expedition!;
  const d = destinationCourante(e)!;
  const peage = x.index > 0 ? [0, 10, 25, 50][e.batiments.peage] : 0;
  e.or += x.or + peage; e.trophees += x.trophees;
  for (const h of herosDuGroupe(e)) { h.expeditions++; if (reussie) h.victoires++; }
  ramasserLesMunitions(e);
  const jours = x.index;
  const lignes = [`Retour à Grisefosse${jours ? ` après ${jours} jour${jours > 1 ? 's' : ''}` : ', sans avoir franchi une salle'} : ${x.or} CO${x.trophees ? `, ${x.trophees} trophée${x.trophees > 1 ? 's' : ''}` : ''}${peage ? `, +${peage} CO du péage` : ''}${x.px ? ` ; ${x.px} PX chacun` : ''}.`];
  noter(e, `${d.nom} : ${reussie ? 'expédition réussie' : x.or ? 'retour prudent' : 'déroute'}. ${lignes[0]}`);
  const partis = new Set(x.groupe);
  for (const h of herosDuGroupe(e)) h.c.conditions = h.c.conditions.filter((c) => DURABLES.has(c.id));
  e.expedition = null;
  if (jours) passerDesJours(e, jours, partis);
  return lignes;
}

/** Quand personne n'est plus en état de partir (hors de combat, ou sous la moitié de ses Blessures), la compagnie
 *  attend une semaine : ceux en séjour s'y reposent. */
export const compagnieEpuisee = (e: Etat): boolean => e.roster.length > 0 && !e.roster.some((h) => disponible(h) && h.c.wounds.current * 2 >= h.c.wounds.max);
export function attendreUneSemaine(e: Etat): string | null {
  if (!compagnieEpuisee(e)) return 'Il reste des héros en état de partir.';
  noter(e, 'Personne n’est en état de partir : la compagnie attend une semaine.');
  passerDesJours(e, SEMAINE_DE_REPOS, new Set());
  return null;
}

/** Les États qui survivent à la rencontre une fois le héros ramené au hameau ; les autres retombent avec elle. */
const DURABLES = new Set(['extenue', 'inconscient']);

/** `jours` journées passent : chez les héros restés au hameau (hors `absents`), les États de la rencontre retombent ;
 *  seuls ceux en séjour (chambre de l'auberge, hospice) se reposent (`reposer`), le temps qui reste à leur séjour.
 *  De nouveaux voyageurs arrivent. */
function passerDesJours(e: Etat, jours: number, absents: Set<string>): void {
  e.jour += jours;
  for (const h of e.roster) {
    if (absents.has(h.c.id)) continue;
    h.c.conditions = h.c.conditions.filter((c) => DURABLES.has(c.id));
    if (!h.sejour) continue;
    reposer(h.c, e.graine++, Math.min(jours, h.sejour.reste));
    h.sejour.reste -= jours;
    if (h.sejour.reste <= 0) delete h.sejour;
  }
  renouvelerLesCandidats(e);
  if (e.roster.length === 0 && e.or < Math.min(...e.candidats.map((c) => c.prix))) noter(e, 'La compagnie est vide et la bourse aussi : un voyageur accepte de servir sans solde.');
}

export const victoireFinale = (e: Etat): boolean => e.bossVaincus.includes('autel');
