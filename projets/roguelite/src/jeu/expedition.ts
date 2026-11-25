/**
 * L'expédition : départ, salles, prière et provisions en route, retour, repos des absents, victoire.
 */
import {
  epreuveTentable,
  jouerLeCombat,
  jouerLEpreuve,
  partiesDuTest,
  reposer,
  horsDeCombat,
  auHameau,
  gesteDeLObjet,
  doter,
  saitSoigner,
  entretenirLesMaladies,
  soignerUnCompagnon,
  verdictDuSoin,
  viseeDeLEpreuve,
  viseeDuSoin,
  type IssueDuCombat,
  type Visee,
} from '../noyau';

import {
  BUTIN_DES_SALLES,
  DESTINATIONS,
  EPREUVES,
  type IdActionAJet,
  LIEUX_DE_SEJOUR,
  MUNITIONS,
  PEAGE_PAR_SALLE,
  PRIERE_DE_SOIN,
  PX_PAR_SALLE,
  SEMAINE_DE_REPOS,
  TAILLE_DU_GROUPE,
  TROPHEES,
  TypeDeSalle,
  ACTIONS_A_JET,
  CAMP,
  type SalleAJet,
  CONSIGNES,
  RANG_DU_ROLE,
  type Rang,
  roleDe,
} from './valeurs';
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

/** Le rang du héros à l'entrée d'une rencontre : celui où le joueur l'a placé, sinon celui du rôle de sa carrière. */
export const rangDe = (h: Heros): Rang => h.rang ?? RANG_DU_ROLE[roleDe(h.carriere) ?? 'front'];
/** Le groupe dans l'ordre où il entre en rencontre : ceux qui vont devant, puis ceux qui vont derrière. */
export const ordreDEntree = (groupe: readonly Heros[]): Heros[] => [...groupe.filter((h) => rangDe(h) === 'devant'), ...groupe.filter((h) => rangDe(h) === 'derriere')];
/** Place le héros `id` au rang `rang`. */
export function placer(e: Etat, id: string, rang: Rang): void {
  const h = heros(e, id);
  if (h) h.rang = rang;
}
/** Donne au héros `id` la consigne de combat de doctrine `doctrine` (`CONSIGNES`) ; `null` rend la doctrine au noyau. */
export function consigner(e: Etat, id: string, doctrine: string | null): void {
  const h = heros(e, id);
  const c = CONSIGNES.find((x) => x.doctrine === doctrine);
  if (!h || !c) return;
  if (c.doctrine) h.c.aiDoctrine = c.doctrine;
  else delete h.c.aiDoctrine;
}
/** La consigne de combat du héros (`CONSIGNES`). */
export const consigneDe = (h: Heros) => CONSIGNES.find((x) => x.doctrine === (h.c.aiDoctrine ?? null))!;

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
    const type: TypeDeSalle = i === 0 ? 'combat' : t <= 50 ? 'combat' : t <= 70 ? 'elite' : t <= 85 ? 'camp'
      : t <= 93 && !salles.some((s) => s.type === 'rencontre') ? 'rencontre' : 'tresor';
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
  return h ? auNoyau(e, h, [gesteDeLObjet(h.c.id, uid, 'utiliser')]) : 'Héros introuvable.';
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

/** Une épreuve jouée (`jouerLEpreuve`) : qui a jeté (id et nom), le Test, son issue et ses DR, chaque héros touché et
 *  ses Blessures avant et après, l'or pris (perdu, s'il est négatif) et le nom de la bourse, et ce que dit l'issue. */
export interface EpreuveDuRecit {
  testeur: string; nom: string; competence: string; difficulte: string; reussite: boolean; dr: number;
  victimes: { id: string; nom: string; avant: number; apres: number; max: number }[]; or: number; bourse: string; dit: string;
}
/** Le récit d'une salle ; `combatAVenir` : l'épreuve ratée tourne au combat, que la salle livre au prochain `avancer`. */
export interface RecitDeSalle { titre: string; lignes: string[]; combat?: IssueDuCombat; fin?: 'defaite' | 'succes'; epreuve?: EpreuveDuRecit; combatAVenir?: true }

/** Une action d'une salle à choix : une action à jet, passer son chemin, ou au camp se reposer et soigner. */
export type ActionDeSalle = IdActionAJet | 'passer' | 'reposer' | 'soigner';
/** La salle courante attend-elle le choix d'une action ? */
export const salleAChoisir = (e: Etat): boolean => !!e.expedition?.salles[e.expedition.index]?.ouverte;

/** Pourquoi le héros `h` ne peut pas tenter l'`action`, ou `null` s'il le peut. LDB 09 l.30 */
export function refusDAction(h: Heros, action: IdActionAJet): string | null {
  if (!valide(h)) return 'Hors de combat.';
  const { epreuves } = ACTIONS_A_JET[action];
  return epreuveTentable(h.c, epreuves) ? null : `Ne sait tenter ni ${epreuves.map((ep) => partiesDuTest(ep.flux).competence).join(' ni ')}.`;
}

/** Ce que le héros `h` viserait à l'`action` (`viseeDeLEpreuve`), ou `undefined` s'il ne peut pas la tenter. */
export const viseeDAction = (h: Heros, action: IdActionAJet): Visee | undefined =>
  (refusDAction(h, action) ? undefined : viseeDeLEpreuve(h.c, ACTIONS_A_JET[action].epreuves));

/** Ce que le `soigneur` viserait au soin du héros `h` au camp courant (`viseeDuSoin`), ou `undefined` sur un refus
 *  (`refusDuPatient`). */
const viseeDuSoinAuCamp = (e: Etat, soigneur: Heros, h: Heros): Visee | undefined => {
  if (refusDuPatient(e, soigneur, h)) return undefined;
  const v = viseeDuSoin(soigneur.c, h.c);
  return 'refus' in v ? undefined : v;
};

/** Ce que le héros `h` viserait au mieux en soignant au camp courant : sa meilleure visée parmi les blessés qu'il peut
 *  soigner (`viseeDuSoinAuCamp`), ou `undefined`. */
export const viseeDuSoigneur = (e: Etat, h: Heros): Visee | undefined =>
  herosDuGroupe(e).map((p) => viseeDuSoinAuCamp(e, h, p)).reduce<Visee | undefined>((m, v) => (v && (!m || v.chances > m.chances) ? v : m), undefined);

/** Pourquoi le héros `h` ne sait pas soigner, ou `null` s'il le sait. LDB 09 l.30 */
const refusDeLaGuerison = (h: Heros): string | null =>
  !valide(h) ? 'Hors de combat.' : saitSoigner(h.c) ? null : 'Ne sait pas tenter la Guérison.';

/** Pourquoi le héros `h` ne peut pas soigner au camp courant, ou `null` s'il le peut : il sait soigner, et un autre
 *  héros du groupe peut recevoir son soin (`refusDuPatient`). LDB 09 l.30 */
export const refusDuSoigneur = (e: Etat, h: Heros): string | null =>
  refusDeLaGuerison(h) ?? (herosDuGroupe(e).some((p) => !refusDuPatient(e, h, p)) ? null : 'Personne à soigner.');

/** Pourquoi le `soigneur` ne peut pas soigner le héros `h` au camp courant, ou `null` s'il le peut : le soigneur, un
 *  autre héros que lui, un soin par blessé et par camp, puis le verdict de l'infirmerie du noyau (`verdictDuSoin`). */
export function refusDuPatient(e: Etat, soigneur: Heros, h: Heros): string | null {
  const salle = e.expedition?.salles[e.expedition.index];
  if (salle?.type !== 'camp' || !salle.ouverte) return 'Aucun camp dressé.';
  const refus = refusDeLaGuerison(soigneur) ?? (h.c.id === soigneur.c.id ? 'Le soigneur soigne un autre héros.'
    : salle.soignes?.includes(h.c.id) ? 'Déjà soigné·e à ce camp.' : null);
  if (refus) return refus;
  const verdict = verdictDuSoin(soigneur.c, h.c);
  return 'refus' in verdict ? verdict.refus : null;
}

/** Joue l'`action` choisie dans la salle ouverte. Une action à jet se joue sur le seul héros `herosId`, testeur et
 *  cible de l'échec ; au camp, « soigner » fait soigner le héros `patientId` par le héros `herosId` et laisse le camp
 *  ouvert ; « passer » et « se reposer » ne jouent aucun Test. Rend le récit, ou pourquoi l'action est refusée. Un Test
 *  que le noyau ne joue pas (`IssueDEpreuve`, `refus`) laisse la salle ouverte : le héros revient tel que le noyau le
 *  laisse, et le choix reste au joueur. */
export function agirDansLaSalle(e: Etat, action: ActionDeSalle, herosId?: string, patientId?: string): RecitDeSalle | string {
  const x = e.expedition;
  const salle = x?.salles[x.index];
  if (!x || !salle?.ouverte) return 'Aucune action en attente.';
  const groupe = herosDuGroupe(e);
  if (salle.type === 'camp') {
    if (action === 'reposer') {
      const lignes = groupe.flatMap((h) => reposer(h.c, e.graine++, 1));
      return franchir(e, { titre: CAMP.titre, lignes: [CAMP.reposer.recit, ...(lignes.length ? lignes : ['Personne n’a besoin de repos.'])] });
    }
    if (action !== 'soigner') return 'Action inconnue ici.';
    const soigneur = groupe.find((g) => g.c.id === herosId);
    const patient = groupe.find((g) => g.c.id === patientId);
    if (!soigneur || !patient) return 'Choisissez le soigneur et le blessé.';
    const refus = refusDuPatient(e, soigneur, patient);
    if (refus) return refus;
    const r = soignerUnCompagnon(soigneur.c, patient.c, e.graine++);
    for (const c of r.groupe) { const h = groupe.find((g) => g.c.id === c.id); if (h) h.c = c; }
    if ('refus' in r) return r.refus;
    salle.soignes = [...(salle.soignes ?? []), patient.c.id];
    return { titre: CAMP.soigner.titre, lignes: r.journal.length ? r.journal : [`${patient.c.label} : le soin n’apporte rien.`] };
  }
  const s = EPREUVES[salle.type as SalleAJet];
  if (action === 'passer') return franchir(e, { titre: s.titre, lignes: [s.passer.recit] });
  if (!(action in s.actions)) return 'Action inconnue ici.';
  const h = groupe.find((g) => g.c.id === herosId);
  if (!h) return 'Choisissez un héros du groupe.';
  const id = action as IdActionAJet;
  const refus = refusDAction(h, id);
  if (refus) return refus;
  const a = ACTIONS_A_JET[id];
  const ep = epreuveTentable(h.c, a.epreuves)!;
  const avant = h.c.wounds.current;
  const r = jouerLEpreuve([h.c], ep, e.graine++);
  h.c = r.groupe[0];
  if ('refus' in r) return { titre: s.titre, lignes: r.journal.includes(r.refus) ? r.journal : [...r.journal, r.refus] };
  const { competence, difficulte } = partiesDuTest(ep.flux);
  const nom = h.c.label;
  const victimes = h.c.wounds.current < avant ? [{ id: h.c.id, nom, avant, apres: h.c.wounds.current, max: h.c.wounds.max }] : [];
  const d = destinationCourante(e)!;
  const perte = !r.reussite && a.consequence?.type === 'bourse' ? Math.min(x.or, Math.round(a.consequence.part * d.or)) : 0;
  const or = r.reussite ? Math.round(s.gain.part * (d.or + tirer(e).int(0, d.or))) : perte ? -perte : 0;
  x.or += or;
  const ligneDuTest = `${nom} — Test de ${[competence, difficulte].filter(Boolean).join(' ')} : ${r.reussite ? 'réussi' : 'raté'}, DR ${r.dr >= 0 ? '+' : '−'}${Math.abs(r.dr)}.`;
  const dit = r.reussite ? a.reussite : a.echec;
  const lignes = [ligneDuTest, dit, ...victimes.map((v) => `${v.nom} est touché·e : ${v.apres}/${v.max} Blessures.`),
    ...(or > 0 ? [`${s.gain.libelle} : ${or} CO.`] : or < 0 ? [`Perdu : ${-or} CO.`] : [])];
  const epreuve: EpreuveDuRecit = { testeur: r.testeur, nom, competence, difficulte, reussite: r.reussite, dr: r.dr, victimes, or, bourse: s.gain.libelle, dit };
  if (r.reussite || a.consequence?.type !== 'combat') return franchir(e, { titre: s.titre, lignes, epreuve });
  salle.ennemis = [...a.consequence.adversaires];
  delete salle.ouverte;
  return { titre: s.titre, lignes, epreuve, combatAVenir: true };
}

/** Le groupe valide combat les `ennemis` (`jouerLeCombat`) : chacun revient tel que le noyau le laisse, les morts sont
 *  enterrés. Une impasse ou une défaite ramène le groupe au hameau : `fin` est alors le récit de la rencontre. */
function combattre(e: Etat, ennemis: string[]): { issue: IssueDuCombat; lignes: string[]; fin?: RecitDeSalle } {
  const d = destinationCourante(e)!;
  const groupe = herosDuGroupe(e);
  const issue = jouerLeCombat(ordreDEntree(groupe.filter(valide)).map((h) => h.c), ennemis, e.graine++, d.lumiere);
  for (const apres of issue.groupe) {
    const h = groupe.find((g) => g.c.id === apres.id);
    if (h) h.c = apres;
  }
  for (const h of groupe) if (issue.morts.includes(h.c.id)) h.c.dead = true;
  if (issue.issue === 'impasse') {
    return { issue, lignes: [], fin: { titre: 'Retraite', combat: issue, fin: 'defaite', lignes: ['Le combat s’enlise ; le groupe décroche en bon ordre.', ...rentrer(e, false)] } };
  }
  if (issue.issue === 'defaite') return { issue, lignes: [], fin: { titre: 'Déroute', combat: issue, fin: 'defaite', lignes: terminerEnDeroute(e, issue.destinDepense) } };
  const morts = groupe.filter((h) => h.c.dead);
  for (const h of morts) enterrer(e, h);
  return { issue, lignes: morts.map((h) => `${h.c.label} est tombé·e. Son corps est ramené au hameau.`) };
}

/** Les salles à choix : le camp (`CAMP`) et celles de `EPREUVES`. */
const SALLES_A_CHOIX: ReadonlySet<TypeDeSalle> = new Set<TypeDeSalle>(['camp', ...(Object.keys(EPREUVES) as SalleAJet[])]);

/** Entre dans la salle courante et la franchit ; une salle à choix s'ouvre et attend son action (`agirDansLaSalle`) :
 *  rend alors `null` ; celle dont l'épreuve a tourné au combat livre ce combat, sans butin. Chaque salle prend une
 *  journée. */
export function avancer(e: Etat): RecitDeSalle | null {
  const x = e.expedition!;
  const d = destinationCourante(e)!;
  const salle = x.salles[x.index];
  if (SALLES_A_CHOIX.has(salle.type)) {
    if (!salle.ennemis.length) {
      salle.ouverte = true;
      return null;
    }
    const c = combattre(e, salle.ennemis);
    return c.fin ?? franchir(e, { titre: EPREUVES[salle.type as SalleAJet].titre, lignes: c.lignes, combat: c.issue });
  }
  const rng = tirer(e);
  const c = combattre(e, salle.ennemis);
  if (c.fin) return c.fin;
  const { facteur, ecart } = BUTIN_DES_SALLES;
  const or = Math.round((d.or * facteur[salle.type as keyof typeof facteur] * rng.int(ecart.min, ecart.max)) / 100);
  x.or += or;
  if (salle.type === 'elite') x.trophees += rng.int(1, 100) <= TROPHEES.elite ? 1 : 0;
  const lignes = [`Butin : ${or} CO · ${PX_PAR_SALLE[salle.type]} PX chacun.`, ...c.lignes];
  return franchir(e, { titre: salle.type === 'boss' ? 'Le cœur du mal' : salle.type === 'elite' ? 'Un adversaire redoutable' : 'Embuscade', lignes, combat: c.issue });
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
  recit.lignes.push(...uneJourneeDeMaladie(e));
  if (!herosDuGroupe(e).length) {
    recit.lignes.push(...rentrer(e, false));
    recit.fin = 'defaite';
    return recit;
  }
  if (salle.type === 'boss') {
    x.trophees += TROPHEES.boss + (e.bossVaincus.includes(d.id) ? 0 : TROPHEES.premiereVictoire);
    if (!e.bossVaincus.includes(d.id)) e.bossVaincus.push(d.id);
    recit.lignes.push(...rentrer(e, true));
    recit.fin = 'succes';
  }
  return recit;
}

/** La journée de la salle franchie passe pour les maladies du groupe (`entretenirLesMaladies`) : soignées si un héros
 *  valide du groupe sait tenter la Guérison (LDB 09 l.30). Un héros que sa maladie emporte est enterré. */
function uneJourneeDeMaladie(e: Etat): string[] {
  const groupe = herosDuGroupe(e);
  const soigne = groupe.some((g) => valide(g) && saitSoigner(g.c));
  const lignes = groupe.flatMap((h) => entretenirLesMaladies(h.c, e.graine++, 1, soigne));
  for (const h of groupe.filter((g) => g.c.dead)) { lignes.push(`${h.c.label} succombe à sa maladie.`); enterrer(e, h); }
  return lignes;
}

function enterrer(e: Etat, h: Heros): void {
  e.roster = e.roster.filter((x) => x !== h);
  if (e.expedition) e.expedition.groupe = e.expedition.groupe.filter((id) => id !== h.c.id);
}

/** Déroute : le butin est perdu. Chaque héros laissé pour mort brûle un point de Destin pour en réchapper ; sans
 *  Destin, il ne revient pas. Qui en a déjà brûlé un pendant la rencontre (« Meurs un autre jour ») ne paie pas deux
 *  fois. LDB 17 l.31. */
function terminerEnDeroute(e: Etat, destinDepense: Readonly<Record<string, number>>): string[] {
  const lignes = ['Le groupe est submergé. Le butin de l’expédition est perdu.'];
  for (const h of herosDuGroupe(e)) {
    if (h.c.dead) { lignes.push(`${h.c.label} ne revient pas.`); enterrer(e, h); continue; }
    if ((destinDepense[h.c.id] ?? 0) > 0) { lignes.push(`${h.c.label} a échappé à la mort pendant le combat (Destin −1, reste ${h.c.fate}).`); continue; }
    if ((h.c.fate ?? 0) <= 0) { lignes.push(`${h.c.label}, sans plus de Destin, ne revient pas.`); enterrer(e, h); continue; }
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
  const peage = PEAGE_PAR_SALLE[e.batiments.peage] * x.index;
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
/** Compagnie vide ou épuisée, et bourse sous le prix du moins cher des candidats : un voyageur s'engage sans solde. */
export const engagementSansSolde = (e: Etat): boolean =>
  (e.roster.length === 0 || compagnieEpuisee(e)) && e.or < Math.min(...e.candidats.map((c) => c.prix));
export function attendreUneSemaine(e: Etat): string | null {
  if (!compagnieEpuisee(e)) return 'Il reste des héros en état de partir.';
  noter(e, 'Personne n’est en état de partir : la compagnie attend une semaine.');
  passerDesJours(e, SEMAINE_DE_REPOS, new Set());
  return null;
}

/** Les États qui survivent à la rencontre une fois le héros ramené au hameau ; les autres retombent avec elle. */
const DURABLES = new Set(['extenue', 'inconscient']);

/** `jours` journées passent : chez les héros restés au hameau (hors `absents`), les États de la rencontre retombent et
 *  les maladies avancent (`entretenirLesMaladies`), soignées par les sœurs le temps d'un séjour à l'hospice ; seuls ceux en séjour (chambre de l'auberge, hospice) se reposent (`reposer`), le temps qui reste à leur séjour.
 *  De nouveaux voyageurs arrivent. */
function passerDesJours(e: Etat, jours: number, absents: Set<string>): void {
  e.jour += jours;
  for (const h of [...e.roster]) {
    if (absents.has(h.c.id)) continue;
    h.c.conditions = h.c.conditions.filter((c) => DURABLES.has(c.id));
    const aLHospice = h.sejour?.ou === 'temple' ? Math.min(jours, h.sejour.reste) : 0;
    const maladie = [...entretenirLesMaladies(h.c, e.graine++, aLHospice, true), ...entretenirLesMaladies(h.c, e.graine++, jours - aLHospice, false)];
    if (maladie.length) noter(e, maladie.join(' '));
    if (h.c.dead) { noter(e, `${h.c.label} succombe à sa maladie.`); enterrer(e, h); continue; }
    if (!h.sejour) continue;
    reposer(h.c, e.graine++, Math.min(jours, h.sejour.reste));
    h.sejour.reste -= jours;
    if (h.sejour.reste <= 0) delete h.sejour;
  }
  renouvelerLesCandidats(e);
  if (engagementSansSolde(e)) noter(e, 'Personne n’est en état de partir et la bourse est vide : un voyageur accepte de servir sans solde.');
}

export const victoireFinale = (e: Etat): boolean => e.bossVaincus.includes('autel');
