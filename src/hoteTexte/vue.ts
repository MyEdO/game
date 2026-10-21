/**
 * LA VUE DE L'HÔTE TEXTE (#2898, plan v3 « La forme ») : la PROJECTION de l'état, lue champ par champ par les
 * lecteurs de la surface du noyau (`../noyau/index`), et ses rendus bornés en lignes et en caractères (`BORNES`). Aucune
 * règle ne se calcule ici : un champ est un lecteur du noyau, ou un champ de l'état lu tel quel (provenance : `scripts/docs/build-hote-texte.mjs`). Doc
 * généré : `npm run docs:hote-texte`.
 */
import {
  activeCombatant, mouvementDuTour, fenetreDuJeu, combatDistance, effectiveArmourAt, actionGate, etatDeLaBarre,
  validTargets, endTurnArmed, portalsForParty, stepInteraction, porteesDuTour, tileFromKey, LOCALISATIONS_DE_COUP, ACTIONS,
  type Combatant, type Jeu, type Offre, type Pt,
} from '../noyau/index';
import { offresDeLaBarre, ErreurDeGeste, type LigneNumerotee } from './partieTexte';
import { coupeAuMot } from '../lib/coupeAuMot.mjs';

/** Les bornes de chaque sortie (#2898, M2) : toute ligne tient en `largeur` caractères ; chaque commande a son nombre
 *  de lignes au plus, donc ses caractères au plus (`caracteresAuPlus`) ; la sortie `--json` a son plafond de caractères ;
 *  chaque liste de la vue a son nombre d'éléments au plus, le reste se dit « +N ». */
export const BORNES = {
  largeur: 160,
  lignes: { vue: 15, reponse: 12, offres: 16, carte: 16, journal: 16, fiche: 8, nouvelle: 16, cases: 10, scenarios: 16, erreur: 16 },
  json: 12_000,
  /** Combattants listés par la vue après l'actif et ses engagés. */
  autresEnVue: 5,
  /** Offres ouvertes que la vue nomme (une par action, ses candidats comptés). */
  offresEnVue: 12,
  ciblesEnVue: 8,
  /** Lignes de journal d'une réponse. */
  journalEnReponse: 8,
  /** Éléments d'une page de `journal`, `carte`, `offres` et `scenarios` (`--depuis`). */
  page: 15,
  /** Cases d'une page de `cases` (`--depuis`), et cases par ligne. */
  cases: 60,
  casesParLigne: 10,
} as const;

export type Commande = keyof typeof BORNES.lignes;

/** Les caractères au plus d'une sortie texte : ses lignes au plus, chacune à la largeur, avec sa fin de ligne. */
export const caracteresAuPlus = (commande: Commande): number => BORNES.lignes[commande] * (BORNES.largeur + 1);

/** Une sortie texte bornée : un saut de ligne interne coupe une ligne en deux, chaque ligne est coupée au mot à la largeur
 *  (`coupeAuMot`), et au-delà du nombre de lignes de la commande, la dernière dit combien il en manque. */
export function borner(entrees: readonly string[], commande: Commande): string[] {
  const max = BORNES.lignes[commande];
  const lignes = entrees.flatMap((l) => l.split('\n'));
  const gardees = lignes.length > max ? [...lignes.slice(0, max - 1), `+${lignes.length - max + 1} lignes`] : lignes;
  return gardees.map((l) => coupeAuMot(l, BORNES.largeur));
}

/** Un combattant projeté. */
export interface CombattantProjete {
  id: string;
  nom: string;
  camp: Combatant['kind'];
  pb: [courant: number, max: number];
  avantage: number;
  pos: [x: number, y: number] | null;
  /** Distance de l'actif, en cases (`combatDistance`) ; `null` sans position. */
  distance: number | null;
  /** Engagé avec l'actif (`engagedWith`). */
  engage: boolean;
  etats: string[];
  horsCombat: boolean;
}

/** Une ligne d'un jet lancé : qui, le jet, le d100, la valeur cible, le DR et le verdict. */
export interface LigneDeJet {
  qui: string;
  jet: string;
  d100: number;
  cible: number;
  dr: number;
  reussi: boolean;
}

/** Une entité de la scène en exploration : id, genre, nom, case. */
export interface EntiteProjetee {
  id: string;
  genre: string;
  nom: string | null;
  pos: [x: number, y: number];
}

/** Une offre ouverte de la vue : l'action, ses candidats ouverts comptés, son coût. */
export interface OffreEnVue {
  id: string;
  n: number;
  cout: string | null;
}

/** La projection : ce que la vue montre, et rien de plus. Chaque liste est bornée, le reste compté. */
export interface Projection {
  pas: number;
  ecran: Jeu['screen'];
  scene: { id: string; nom: string } | null;
  combat: null | {
    round: number;
    tour: number;
    tours: number;
    fin: 'victory' | 'defeat' | null;
    actif: (CombattantProjete & { action: 'libre' | 'prise'; mouvement: [restant: number, total: number] }) | null;
    /** La fenêtre qui tient la main, ses verbes et l'id que ses verbes prennent en premier argument (`pid`) ; pour la
     *  cascade, son étape courante (`stepInteraction`, les clés d'un choix). */
    fenetre: { cle: string; proprietaire: string | null; verbes: string[]; pid: string | null; etape?: { id: string; genre: string; interaction: string; choix: string[] } } | null;
    /** Le jet de coup lancé, en attente de confirmation (`pendingAttack`, `pendingDefense` : `result`), chaque ligne lue
     *  telle que la fenêtre du web la montre, et le DR net du Test opposé (`netSL`), qu'une rangée de défense seule
     *  porte (`null` sans elle). */
    jet: { lignes: LigneDeJet[]; dr: number | null } | null;
    /** L'aperçu du premier clic du champ (`battle.preview`), que le second confirme. */
    apercu: { genre: string; vers: string; cout: number | null } | null;
    /** La barre de l'actif (`etatDeLaBarre`) : `ouverte`, ou fermée avec sa raison. */
    barre: string;
    intention: string | null;
    finDeTourArmee: boolean;
    cibles: { liste: string[]; enPlus: number };
    /** Les offres ouvertes de l'actif ; `null` : la barre n'est pas ouverte. */
    offres: { liste: OffreEnVue[]; enPlus: number } | null;
    /** L'actif, ses engagés, puis au plus `BORNES.autresEnVue` autres, par distance croissante. */
    voisins: { liste: CombattantProjete[]; enPlus: number };
  };
  exploration: null | {
    groupe: [x: number, y: number];
    heros: string[];
    portails: { id: string; genre: string; vers: [x: number, y: number] }[];
    /** Les entités de la scène (`scene.entities`) : décors, PNJ, objets. */
    entites: { liste: EntiteProjetee[]; enPlus: number };
  };
  refus: { texte: string; nonce: number } | null;
  journal: number;
}

const nomDe = (etat: Jeu, id: string | undefined | null): string | null => {
  if (id == null) return null;
  if (id === '*') return 'tous';
  return etat.battle?.combatants.find((c) => c.id === id)?.label ?? etat.party.find((c) => c.id === id)?.label ?? id;
};

function combattant(c: Combatant, actif: Combatant | undefined): CombattantProjete {
  const d = actif ? combatDistance(actif, c) : Infinity;
  return {
    id: c.id,
    nom: c.label,
    camp: c.kind,
    pb: [c.wounds.current, c.wounds.max],
    avantage: c.advantage,
    pos: c.pos ? [c.pos.x, c.pos.y] : null,
    distance: Number.isFinite(d) ? d : null,
    engage: !!actif && c.id !== actif.id && !!actif.engagedWith?.includes(c.id),
    etats: c.conditions.map((e) => (e.value > 1 ? `${e.id}×${e.value}` : e.id)),
    horsCombat: !!c.dead || !!c.outOfRencontre,
  };
}

/** Tous les combattants projetés : l'actif, ses engagés, puis par distance croissante. */
function combattantsTries(etat: Jeu): CombattantProjete[] {
  const b = etat.battle;
  if (!b) return [];
  const actif = activeCombatant(b);
  const rangDe = (c: CombattantProjete): number => (c.id === actif?.id ? -2 : c.engage ? -1 : (c.distance ?? Infinity));
  return b.combatants.map((c) => combattant(c, actif)).sort((x, y) => rangDe(x) - rangDe(y));
}

/** L'étape courante de la cascade, quand c'est elle qui tient la main. */
function etapeDe(etat: Jeu, cle: string) {
  const pc = etat.pendingCascade;
  const step = cle === 'cascade' && pc ? pc.participants[pc.cursor] : undefined;
  return step ? { etape: { id: step.id, genre: step.kind, interaction: stepInteraction(step), choix: (step.options ?? []).map((o) => o.key) } } : {};
}

/** Les offres de l'actif, ou `null` quand la barre n'est pas ouverte. */
function offresSiOuverte(etat: Jeu): Offre[] | null {
  try {
    return offresDeLaBarre(etat);
  } catch (erreur) {
    if (erreur instanceof ErreurDeGeste) return null;
    throw erreur;
  }
}

/** Les offres ouvertes, une par action, ses candidats comptés, dans l'ordre du registre. */
function offresEnVue(offres: readonly Offre[]): OffreEnVue[] {
  const parId = new Map<string, OffreEnVue>();
  for (const o of offres) {
    if (!o.gate.ok) continue;
    const vue = parId.get(o.actionId) ?? { id: o.actionId, n: 0, cout: o.cost };
    vue.n++;
    parId.set(o.actionId, vue);
  }
  return [...parId.values()];
}

const tranche = <T>(liste: readonly T[], n: number): { liste: T[]; enPlus: number } => ({ liste: liste.slice(0, n), enPlus: Math.max(0, liste.length - n) });

/** Les jets de coup en attente de confirmation : le pending, son attaquant et sa cible (`AttackResult`). */
const COUPS_EN_ATTENTE = [
  (etat: Jeu) => etat.pendingAttack && { result: etat.pendingAttack.result, de: etat.pendingAttack.attackerId, contre: etat.pendingAttack.targetId },
  (etat: Jeu) => etat.pendingDefense && { result: etat.pendingDefense.result, de: etat.pendingDefense.attackerId, contre: etat.pendingDefense.defenderId },
] as const;

/** Le jet de coup lancé, en attente de confirmation : la ligne de l'attaquant, celle du défenseur au Test opposé. */
function jetEnAttente(etat: Jeu): NonNullable<Projection['combat']>['jet'] {
  for (const lire of COUPS_EN_ATTENTE) {
    const coup = lire(etat);
    if (!coup?.result) continue;
    const r = coup.result;
    const lignes = ([[coup.de, r.attackerDetail], [coup.contre, r.defenderDetail]] as const).flatMap(([id, d]) =>
      d ? [{ qui: nomDe(etat, id) ?? id, jet: d.label, d100: d.roll, cible: d.target, dr: d.sl, reussi: d.success }] : []);
    return { lignes, dr: r.defenderDetail ? r.netSL : null };
  }
  return null;
}

/** L'aperçu du premier clic : son genre, sa case ou sa cible, son coût. */
function apercuDe(etat: Jeu): NonNullable<Projection['combat']>['apercu'] {
  const a = etat.battle?.preview;
  if (!a) return null;
  return { genre: a.kind, vers: 'targetId' in a ? a.targetId : pos([a.tile.x, a.tile.y]), cout: 'cost' in a ? a.cost : null };
}

/** La projection de l'état après `pas` gestes, sur un journal de `journal` lignes. */
export function projeter(etat: Jeu, pas: number, journal: number): Projection {
  const b = etat.battle;
  const actif = b ? activeCombatant(b) : undefined;
  const fenetre = fenetreDuJeu(etat);
  const barre = etatDeLaBarre(etat);
  const offres = offresSiOuverte(etat);
  const tous = combattantsTries(etat);
  const engages = tous.filter((c) => c.id === actif?.id || c.engage);
  const autres = tous.filter((c) => c.id !== actif?.id && !c.engage);
  const mvt = b && actif ? mouvementDuTour(b, actif) : null;
  return {
    pas,
    ecran: etat.screen,
    scene: etat.scene ? { id: etat.scene.id, nom: etat.scene.label } : null,
    combat: b
      ? {
          round: b.round,
          tour: b.turn + 1,
          tours: b.order.length,
          fin: b.over,
          actif: actif && mvt ? { ...combattant(actif, actif), action: b.acted ? 'prise' : 'libre', mouvement: [mvt.restant, mvt.total] } : null,
          fenetre: fenetre ? { cle: fenetre.cle, proprietaire: nomDe(etat, fenetre.proprietaire), verbes: [...fenetre.verbes], pid: fenetre.pid ?? null, ...etapeDe(etat, fenetre.cle) } : null,
          jet: jetEnAttente(etat),
          apercu: apercuDe(etat),
          barre: barre.forme === 'ouverte' ? 'ouverte' : `${barre.forme} : ${barre.raison}`,
          intention: etat.localIntent?.actionId ?? null,
          finDeTourArmee: endTurnArmed(b),
          cibles: tranche(offres ? validTargets(() => etat).map((c) => c.id) : [], BORNES.ciblesEnVue),
          offres: offres ? tranche(offresEnVue(offres), BORNES.offresEnVue) : null,
          voisins: { liste: [...engages, ...autres.slice(0, BORNES.autresEnVue)], enPlus: Math.max(0, autres.length - BORNES.autresEnVue) },
        }
      : null,
    exploration: b || !etat.scene
      ? null
      : {
          groupe: [etat.partyPos.x, etat.partyPos.y],
          heros: etat.party.map((h) => h.label),
          portails: portalsForParty(etat.scene, etat.partyPos).slice(0, BORNES.page).map((p) => ({ id: p.id, genre: p.kind, vers: [p.to.x, p.to.y] })),
          entites: tranche(etat.scene.entities.map((e) => ({ id: e.id, genre: e.kind, nom: e.label ?? null, pos: [e.pos.x, e.pos.y] })), BORNES.page),
        },
    refus: etat.refus,
    journal,
  };
}

const pos = (p: [number, number] | null): string => (p ? `(${p[0]},${p[1]})` : '(—)');
const enPlus = (n: number, suite: string): string[] => (n > 0 ? [`+${n} ${suite}`] : []);

/** Une ligne de combattant : id, nom, camp, PB, position, distance, engagement, États. */
export function ligneDeCombattant(c: CombattantProjete): string {
  const parts = [`${c.id} ${c.nom}`, c.camp, `PB ${c.pb[0]}/${c.pb[1]}`, pos(c.pos)];
  if (c.distance !== null) parts.push(`d${c.distance}`);
  if (c.engage) parts.push('engagé');
  if (c.horsCombat) parts.push('hors combat');
  if (c.etats.length) parts.push(`[${c.etats.join(', ')}]`);
  return parts.join(' · ');
}

/** La ligne d'en-tête du combat. */
function enteteDeCombat(p: Projection): string {
  const c = p.combat!;
  if (c.fin) return `combat fini : ${c.fin} · R${c.round} · pas ${p.pas}`;
  const a = c.actif;
  const qui = a ? `actif ${a.id} ${a.nom} · PB ${a.pb[0]}/${a.pb[1]} · Av ${a.avantage} · Action ${a.action} · Mvt ${a.mouvement[0]}/${a.mouvement[1]}` : 'aucun actif';
  return `R${c.round} tour ${c.tour}/${c.tours} · ${qui} · pas ${p.pas}`;
}

const ligneDeFenetre = (f: NonNullable<NonNullable<Projection['combat']>['fenetre']>): string => {
  const e = f.etape;
  const etape = e ? ` · étape ${e.id} ${e.genre}, ${e.interaction}${e.choix.length ? ` [${e.choix.join(' | ')}]` : ''}` : '';
  return `fenêtre ${f.cle} (à ${f.proprietaire ?? 'l’hôte'})${etape}`;
};

/** Un texte replié à la largeur, au mot, jamais coupé : une ligne de plus (en retrait) quand la largeur est atteinte ;
 *  un saut de ligne interne commence une ligne. Un mot plus large que la ligne reste entier, `borner` le coupe. */
export function replier(texte: string): string[] {
  return texte.split('\n').flatMap((paragraphe) => {
    const lignes: string[] = [];
    let ligne = '';
    for (const mot of paragraphe.split(' ')) {
      const suite = ligne ? `${ligne} ${mot}` : mot;
      if (suite.length > BORNES.largeur && ligne.trim()) {
        lignes.push(ligne);
        ligne = `  ${mot}`;
      } else ligne = suite;
    }
    return [...lignes, ligne];
  });
}

/** Les verbes de la fenêtre, repliés, et l'id que leurs paramètres `pid` attendent. */
const ligneDeVerbes = (f: NonNullable<NonNullable<Projection['combat']>['fenetre']>): string[] =>
  f.verbes.length ? replier(`verbes${f.pid ? ` (pid ${f.pid})` : ''} : ${f.verbes.join(', ')}`) : [];

const signe = (n: number): string => (n > 0 ? `+${n}` : String(n));

/** Le jet lancé : chaque ligne (d100 sur la cible, DR, verdict), puis le DR net du Test opposé. */
const ligneDeJet = (j: NonNullable<NonNullable<Projection['combat']>['jet']>): string =>
  `jet : ${j.lignes.map((l) => `${l.qui} ${l.jet} ${l.d100}/${l.cible} DR ${signe(l.dr)} ${l.reussi ? 'réussi' : 'raté'}`).join(' · ')}${j.dr === null ? '' : ` · DR net ${signe(j.dr)}`}`;

const ligneDApercu = (a: NonNullable<NonNullable<Projection['combat']>['apercu']>): string =>
  `aperçu : ${a.genre} → ${a.vers}${a.cout === null ? '' : ` · coût ${a.cout}`} (le même clic confirme)`;

const libelleDOffre = (o: OffreEnVue): string => `${o.id}${o.n > 1 ? `×${o.n}` : ''}→${o.cout ?? '—'}`;

/** La vue par défaut (`BORNES.lignes.vue`). */
export function rendreLaVue(p: Projection): string[] {
  const lignes: string[] = [];
  if (p.combat) {
    const c = p.combat;
    lignes.push(enteteDeCombat(p));
    if (c.fenetre) lignes.push(ligneDeFenetre(c.fenetre), ...ligneDeVerbes(c.fenetre));
    if (c.jet) lignes.push(ligneDeJet(c.jet));
    if (c.apercu) lignes.push(ligneDApercu(c.apercu));
    if (c.intention || c.finDeTourArmee) lignes.push([c.intention && `intention armée : ${c.intention}`, c.finDeTourArmee && 'fin de tour armée'].filter(Boolean).join(' · '));
    for (const x of c.voisins.liste.filter((v) => v.id !== c.actif?.id)) lignes.push(ligneDeCombattant(x));
    lignes.push(...enPlus(c.voisins.enPlus, 'autres (`carte`)'));
    if (c.offres) {
      const liste = c.offres.liste.map(libelleDOffre);
      lignes.push(`offres : ${liste.length ? [...liste, ...enPlus(c.offres.enPlus, '(`offres`)')].join(' · ') : 'aucune offre légale'}`);
      if (c.cibles.liste.length) lignes.push(`cibles : ${[...c.cibles.liste, ...enPlus(c.cibles.enPlus, 'autres')].join(', ')}`);
    } else if (!c.fin) lignes.push(`barre ${c.barre}`);
  } else {
    lignes.push(`${p.scene ? `scène ${p.scene.id} « ${p.scene.nom} »` : 'aucune scène'} · écran ${p.ecran} · pas ${p.pas}`);
    if (p.exploration) {
      lignes.push(`groupe ${pos(p.exploration.groupe)} : ${p.exploration.heros.join(', ')}`);
      const portails = p.exploration.portails;
      lignes.push(`portails : ${portails.length ? portails.map((x) => `${x.id} ${x.genre}${pos(x.vers)}`).join(' · ') : 'aucun'}`);
    }
  }
  if (p.refus) lignes.push(`dernier refus (#${p.refus.nonce}) : ${p.refus.texte}`);
  return borner(lignes, 'vue');
}

/** Le texte d'une ligne de journal. */
const texteDe = (l: LigneNumerotee): string => (l.ligne.de === 'journal' ? l.ligne.texte : l.ligne.evenement.text);

/** Une page d'une liste : `BORNES.page` éléments depuis `depuis` (par défaut la fin, ou le début), et la suite. */
function page<T>(liste: readonly T[], depuis: number | undefined, defaut: 'debut' | 'fin', suite: (k: number) => string): { elements: T[]; suite: string[] } {
  const debut = Math.max(0, depuis ?? (defaut === 'fin' ? liste.length - BORNES.page : 0));
  const elements = liste.slice(debut, debut + BORNES.page);
  const k = debut + elements.length;
  return { elements, suite: k < liste.length ? [`+${liste.length - k} : \`${suite(k)}\``] : [] };
}

/** Le journal : une page, les dernières lignes, ou celles depuis `depuis`. */
export function rendreLeJournal(journal: readonly LigneNumerotee[], depuis?: number, ligne = 0): string[] {
  const { elements } = page(journal, depuis, 'fin', () => '');
  const place = BORNES.lignes.journal - 1;
  // Une entrée à saut de ligne prend plusieurs lignes : la page s'arrête avant de déborder, la suite comprise. Une entrée
  // plus haute que la page se lit seule, page après page de ses lignes (`--ligne`).
  const lignes: string[] = [];
  let hauteur = 0;
  for (const [i, l] of elements.entries()) {
    const texte = `${l.n} [pas ${l.pas}] ${texteDe(l)}`.split('\n').slice(i === 0 ? ligne : 0);
    if (i === 0 && texte.length > place) {
      const vues = texte.slice(0, place - 1);
      const reste = texte.length - vues.length;
      return borner([...vues, `+${reste} lignes de l’entrée ${l.n} : \`journal --depuis ${l.n} --ligne ${ligne + vues.length}\``], 'journal');
    }
    if (hauteur + texte.length > place) break;
    lignes.push(texte.join('\n'));
    hauteur += texte.length;
  }
  const k = (elements[0]?.n ?? 0) + lignes.length;
  const suite = k < journal.length ? [`+${journal.length - k} : \`journal --depuis ${k}\``] : [];
  return borner(lignes.length ? [...lignes, ...suite] : ['journal vide'], 'journal');
}

/** Les lignes de journal d'un geste, condensées : les détails (« ↳ ») tombent, une suite de lignes différées d'un
 *  même acteur (un tour de l'IA) tient en une ligne. */
function condenser(lignes: readonly LigneNumerotee[]): { n: number; texte: string }[] {
  const sortie: { n: number; texte: string; acteur?: string; plus: number }[] = [];
  for (const l of lignes) {
    if (l.ligne.de === 'combat' && l.ligne.evenement.kind === 'detail') continue;
    const acteur = l.differee && l.ligne.de === 'combat' ? l.ligne.evenement.actorId : undefined;
    const prec = sortie[sortie.length - 1];
    if (acteur && prec?.acteur === acteur) prec.plus++;
    else sortie.push({ n: l.n, texte: texteDe(l), acteur, plus: 0 });
  }
  return sortie.map((s) => ({ n: s.n, texte: s.plus ? `${s.texte} (+${s.plus})` : s.texte }));
}

/** Le delta de deux projections : les champs de la vue qui ont bougé. L'en-tête, la fenêtre et ses verbes, le jet et
 *  l'aperçu ont chacun leur ligne ; l'intention, la fin de tour et les combattants qui ont bougé tiennent en une. */
function delta(avant: Projection, apres: Projection): string[] {
  const lignes: string[] = [];
  const items: string[] = [];
  const ca = avant.combat;
  const cb = apres.combat;
  if (cb && (!ca || enteteDeCombat({ ...avant, pas: 0 }) !== enteteDeCombat({ ...apres, pas: 0 }))) lignes.push(enteteDeCombat(apres));
  if (cb && JSON.stringify(ca?.fenetre) !== JSON.stringify(cb.fenetre)) lignes.push(...(cb.fenetre ? [ligneDeFenetre(cb.fenetre), ...ligneDeVerbes(cb.fenetre)] : ['fenêtre fermée']));
  if (cb?.jet && JSON.stringify(ca?.jet) !== JSON.stringify(cb.jet)) lignes.push(ligneDeJet(cb.jet));
  if (cb?.apercu && JSON.stringify(ca?.apercu) !== JSON.stringify(cb.apercu)) lignes.push(ligneDApercu(cb.apercu));
  if (cb && ca?.intention !== cb.intention) items.push(`intention : ${cb.intention ?? 'aucune'}`);
  if (cb && ca?.finDeTourArmee !== cb.finDeTourArmee) items.push(cb.finDeTourArmee ? 'fin de tour armée' : 'fin de tour désarmée');
  if (ca && cb) {
    const avants = new Map(ca.voisins.liste.map((c) => [c.id, c]));
    for (const c of cb.voisins.liste) {
      const a = avants.get(c.id);
      if (!a || c.id === cb.actif?.id) continue;
      const bouge: string[] = [];
      if (a.pb[0] !== c.pb[0]) bouge.push(`PB ${a.pb[0]}→${c.pb[0]}`);
      if (pos(a.pos) !== pos(c.pos)) bouge.push(pos(c.pos));
      if (a.etats.join() !== c.etats.join()) bouge.push(`[${c.etats.join(', ')}]`);
      if (a.horsCombat !== c.horsCombat) bouge.push('hors combat');
      if (bouge.length) items.push(`${c.id} ${bouge.join(' ')}`);
    }
  }
  if (!cb && JSON.stringify(avant.exploration) !== JSON.stringify(apres.exploration)) lignes.push(...rendreLaVue(apres).slice(0, 2));
  if (items.length) lignes.push(items.join(' · '));
  return lignes.map((l) => `Δ ${l}`);
}

/** La réponse à un geste appliqué (`BORNES.lignes.reponse`) : l'issue, le delta (`delta`, une ligne par champ qui a
 *  bougé), puis le journal dans la place qui reste, au plus `BORNES.journalEnReponse` lignes, et la suite. */
export function rendreLaReponse(geste: string, avant: Projection, apres: Projection, lignes: readonly LigneNumerotee[], reprises: number): string[] {
  const refusNeuf = apres.refus && apres.refus.nonce !== avant.refus?.nonce ? ` · refus : ${apres.refus.texte}` : '';
  const sortie = [`${geste} : appliqué${reprises ? ` · ${reprises} jeton${reprises > 1 ? 's' : ''} repris` : ''}${refusNeuf}`, ...delta(avant, apres)];
  const condensees = condenser(lignes);
  // Le journal prend les lignes que l'issue et le delta laissent, la suite comprise ; une entrée à saut de ligne en compte plusieurs.
  const place = Math.min(BORNES.journalEnReponse, BORNES.lignes.reponse - sortie.flatMap((l) => l.split('\n')).length - 1);
  let prises = 0;
  let k = 0;
  for (; k < condensees.length; k++) {
    const hauteur = condensees[k].texte.split('\n').length;
    if (prises + hauteur > place) break;
    sortie.push(`  ${condensees[k].n}  ${condensees[k].texte}`);
    prises += hauteur;
  }
  if (k < condensees.length) sortie.push(`  +${condensees.length - k} lignes : \`journal --depuis ${condensees[k].n}\``);
  return borner(sortie, 'reponse');
}

/** Les offres que liste `offres` : les ouvertes, ou toutes (`--toutes`) ; pour un id, les siennes. */
export function offresListees(offres: readonly Offre[], options: { id?: string; toutes: boolean }): Offre[] {
  return offres.filter((o) => (!options.id || o.actionId === options.id) && (options.toutes || o.gate.ok));
}

/** Les offres de l'actif, une par ligne, en pages (`--depuis`) : ouvertes, ou fermées comprises avec leur raison
 *  (`--toutes`) ; pour un id, ses candidats et leurs arguments, ou la raison de l'absence (le gate de pertinence). */
export function rendreLesOffres(etat: Jeu, offres: readonly Offre[], options: { id?: string; toutes: boolean; depuis?: number }): string[] {
  const choisies = offresListees(offres, options);
  if (!choisies.length) {
    const barre = etatDeLaBarre(etat);
    const pertinence = options.id && barre.forme === 'ouverte' && ACTIONS.some((a) => a.id === options.id)
      ? actionGate(options.id, { active: barre.active, battle: barre.battle, netMode: etat.net.mode })
      : undefined;
    const raison = pertinence && !pertinence.ok ? ` : ${pertinence.reason}` : '';
    return [`aucune offre${options.id ? ` ${options.id}` : options.toutes ? '' : ' ouverte (`offres --toutes`)'}${raison}`];
  }
  const drapeaux = `${options.id ? ` ${options.id}` : ''}${options.toutes ? ' --toutes' : ''}`;
  const { elements, suite } = page(choisies, options.depuis, 'debut', (k) => `offres${drapeaux} --depuis ${k}`);
  const lignes = elements.map((o) => {
    const tete = `${o.actionId}${o.candidat ? `[${o.candidat}]` : ''} → ${o.cost ?? '—'}`;
    const args = options.id && Object.keys(o.args).length ? ` · ctx ${JSON.stringify(o.args)}` : '';
    return `${tete}${args} · ${o.gate.ok ? 'ouverte' : `fermée : ${o.gate.reason ?? 'sans raison'}`}`;
  });
  return borner([...lignes, ...suite], 'offres');
}

/** La fiche d'un combattant (ou d'un héros hors combat) : ses champs de l'état, l'armure en PA par localisation
 *  (`effectiveArmourAt`). */
export function rendreLaFiche(etat: Jeu, id: string): string[] | null {
  const c = etat.battle?.combatants.find((x) => x.id === id) ?? etat.party.find((x) => x.id === id);
  if (!c) return null;
  const ch = Object.entries(c.characteristics).map(([k, v]) => `${k} ${typeof v === 'number' ? v : JSON.stringify(v)}`).join(' · ');
  return borner([
    `${c.id} ${c.label} · ${c.kind}${c.species ? ` · ${c.species}` : ''}${c.career ? ` · ${c.career}` : ''}`,
    `PB ${c.wounds.current}/${c.wounds.max} · Av ${c.advantage} · Mvt ${c.movement} · Destin ${c.fate ?? 0} · Fortune ${c.fortune ?? 0} · Résilience ${c.resilience ?? 0} · Détermination ${c.resolve ?? 0}`,
    `carac : ${ch}`,
    `armes : ${c.weapons.map((w) => w.label).join(' · ') || 'aucune'}`,
    `armure (PA) : ${LOCALISATIONS_DE_COUP.map((loc) => `${loc} ${effectiveArmourAt(c, loc)}`).join(' · ')}`,
    `États : ${c.conditions.map((e) => (e.value > 1 ? `${e.id}×${e.value}` : e.id)).join(', ') || 'aucun'}`,
    `compétences : ${c.skills.map((s) => s.id).join(', ') || 'aucune'}`,
    `talents : ${c.talents.map((t) => t.talentId).join(', ') || 'aucun'}`,
  ], 'fiche');
}

/** Une page de la carte : les combattants, l'actif d'abord, puis ses engagés, puis par distance (`--depuis`). */
export function pageDeLaCarte(etat: Jeu, depuis?: number): { combattants: CombattantProjete[]; suite: string[] } {
  const { elements, suite } = page(combattantsTries(etat), depuis, 'debut', (k) => `carte --depuis ${k}`);
  return { combattants: elements, suite };
}

/** La carte (`BORNES.lignes.carte`) : en combat, les combattants ; en exploration, le groupe, puis les entités de la
 *  scène (`scene.entities`) ; par page (`--depuis`). */
export function rendreLaCarte(etat: Jeu, p: Projection, depuis?: number): string[] {
  if (!p.combat) {
    const entites = etat.scene?.entities ?? [];
    const { elements, suite } = page(entites, depuis, 'debut', (k) => `carte --depuis ${k}`);
    const tete = p.exploration ? [`groupe ${pos(p.exploration.groupe)} · ${entites.length} entité(s)`] : ['aucune scène'];
    return borner([...tete, ...elements.map((e) => `  ${e.id} · ${e.kind}${e.label ? ` · ${e.label}` : ''} · ${pos([e.pos.x, e.pos.y])}`), ...suite], 'carte');
  }
  const { combattants, suite } = pageDeLaCarte(etat, depuis);
  return borner([...combattants.map((c) => `${c.id === p.combat!.actif?.id ? '> ' : '  '}${ligneDeCombattant(c)}`), ...suite], 'carte');
}

/** Les cases que le champ peint au tour de l'actif (`porteesDuTour`, le lecteur de sa surbrillance), par zone et par
 *  coût, une page de `BORNES.cases` cases (`--depuis`). Hors combat, ou hors du tour du joueur : aucune. */
export function casesAtteignables(etat: Jeu, monTour: boolean): { zone: string; case: Pt; cout: number }[] {
  if (!etat.battle) return [];
  const portees = porteesDuTour(() => etat, monTour);
  return (Object.entries(portees) as [string, Map<string, number>][]).flatMap(([zone, cases]) =>
    [...cases].map(([cle, cout]) => ({ zone, case: tileFromKey(cle), cout })).sort((a, b) => a.cout - b.cout || a.case.y - b.case.y || a.case.x - b.case.x));
}

/** `cases` (`BORNES.lignes.cases`) : une ligne par zone et par tranche de `BORNES.casesParLigne` cases, « (x,y)·coût ». */
export function rendreLesCases(cases: readonly { zone: string; case: Pt; cout: number }[], depuis?: number): string[] {
  if (!cases.length) return ['aucune case atteignable (hors combat, ou hors du tour d’un héros de ce siège)'];
  const debut = Math.max(0, depuis ?? 0);
  const pageDeCases = cases.slice(debut, debut + BORNES.cases);
  const lignes: string[] = [];
  for (let i = 0; i < pageDeCases.length;) {
    const zone = pageDeCases[i].zone;
    const tranche: typeof pageDeCases = [];
    while (i < pageDeCases.length && pageDeCases[i].zone === zone && tranche.length < BORNES.casesParLigne) tranche.push(pageDeCases[i++]);
    lignes.push(`${zone} : ${tranche.map((c) => `${pos([c.case.x, c.case.y])}·${c.cout}`).join(' ')}`);
  }
  const k = debut + pageDeCases.length;
  return borner([...lignes, ...(k < cases.length ? [`+${cases.length - k} : \`cases --depuis ${k}\``] : [])], 'cases');
}

/** `scenarios` (`BORNES.lignes.scenarios`) : l'id à passer à `nouvelle`, puis le titre, par page (`--depuis`). */
export function rendreLesScenarios(scenarios: readonly { id: string; title: string }[], depuis?: number): string[] {
  const { elements, suite } = page(scenarios, depuis, 'debut', (k) => `scenarios --depuis ${k}`);
  return borner([...elements.map((sc) => `${sc.id} · ${sc.title}`), ...suite], 'scenarios');
}
