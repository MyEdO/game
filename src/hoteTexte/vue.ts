/**
 * LA VUE DE L'HÔTE TEXTE (#2898, plan v3 « La forme ») : la PROJECTION de l'état, lue champ par champ par les
 * lecteurs de la surface du noyau (`../noyau/index`), et ses rendus bornés en lignes et en caractères (`BORNES`). Aucune
 * règle ne se calcule ici : un champ est un lecteur du noyau, ou un champ de l'état lu tel quel (provenance : `scripts/docs/build-hote-texte.mjs`). Doc
 * généré : `npm run docs:hote-texte`.
 */
import {
  activeCombatant, mouvementDuTour, fenetreDuJeu, combatDistance, effectiveArmourAt, actionGate, etatDeLaBarre,
  validTargets, endTurnArmed, porteurParId, gestesDExploration, jetsEnVue, capDuGroupe, CLICS_DU_CHAMP, stepInteraction, porteesDuTour, tileFromKey, LOCALISATIONS_DE_COUP, ACTIONS,
  type Combatant, type GesteDExploration, type Jeu, type JetEnVue, type LigneDeJet, type Offre, type Pt,
} from '../noyau/index';
import { offresDeLaBarre, ErreurDeGeste, type LigneNumerotee } from './partieTexte';
import { ecritALaForme, signature, type ParametreDeVerbe } from './formes';
import { VERBES } from './verbes.generated';
import { coupeAuMot } from '../lib/coupeAuMot.mjs';
import { appelEcrit } from './outils';

/** Les bornes de chaque sortie (#2898, M2) : toute ligne tient en `largeur` caractères ; chaque commande a son nombre
 *  de lignes au plus, donc ses caractères au plus (`caracteresAuPlus`) ;
 *  chaque liste de la vue a son nombre d'éléments au plus, le reste se dit « +N ». */
export const BORNES = {
  largeur: 160,
  lignes: { vue: 15, jouer: 28, offres: 16, carte: 16, journal: 16, fiche: 8, nouvelle: 16, cases: 10, verbes: 16, erreur: 16 },
  /** Combattants listés par la vue après l'actif et ses engagés. */
  autresEnVue: 5,
  /** Offres ouvertes que la vue nomme (une par action, ses candidats comptés). */
  offresEnVue: 12,
  ciblesEnVue: 8,
  /** Gestes d'exploration que la vue donne prêts à jouer. */
  gestesEnVue: 6,
  /** Lignes de journal d'une réponse de `jouer`. */
  journalEnReponse: 8,
  /** Éléments d'une page de `journal`, `carte` et `offres` (`depuis`). */
  page: 15,
  /** Cases d'une page de `cases` (`depuis`), et cases par ligne. */
  cases: 60,
  casesParLigne: 10,
  /** Noms d'une page de `verbes` (`depuis`). */
  verbesParPage: 80,
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
  /** La fenêtre qui tient la main, en combat comme hors combat, ses verbes et l'id que ses verbes prennent en premier
   *  argument (`pid`) ; pour la cascade, son étape courante (`stepInteraction`, les clés d'un choix). */
  fenetre: { cle: string; proprietaire: string | null; verbes: string[]; pid: string | null; etape?: { id: string; genre: string; interaction: string; choix: string[] } } | null;
  /** Les jets de la fenêtre qui tient la main (`jetsEnVue`), jetés ou à jeter, et le DR net d'un Test opposé tranché. */
  jets: JetEnVue[];
  combat: null | {
    round: number;
    tour: number;
    tours: number;
    fin: NonNullable<Jeu['battle']>['over'];
    actif: (CombattantProjete & { action: 'libre' | 'prise'; mouvement: [restant: number, total: number] }) | null;
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
    /** La case du groupe, son étage quand la scène en a plusieurs, son cap (`capDuGroupe`). */
    groupe: [x: number, y: number];
    etage: number | null;
    cap: string | null;
    heros: string[];
    /** Ce que le groupe peut jouer depuis sa case, chaque geste prêt à jouer (`gestesDExploration`). */
    gestes: { liste: GesteDExploration[]; enPlus: number };
    /** Les entités de la scène (`scene.entities`) : décors, PNJ, objets. */
    entites: { liste: EntiteProjetee[]; enPlus: number };
  };
  refus: { texte: string; nonce: number } | null;
  journal: number;
}

const nomDe = (etat: Jeu, id: string | undefined | null): string | null => {
  if (id == null) return null;
  if (id === '*') return 'tous';
  return porteurParId(etat, id)?.label ?? id;
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

/** L'étape de cascade que la fenêtre rend (`fenetreDuJeu`) : son id, son genre, son interaction, les clés de son choix. */
const etapeDe = (f: NonNullable<ReturnType<typeof fenetreDuJeu>>) =>
  f.etape ? { etape: { id: f.etape.id, genre: f.etape.kind, interaction: stepInteraction(f.etape), choix: (f.etape.options ?? []).map((o) => o.key) } } : {};

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

/** L'aperçu du premier clic : son genre, sa case ou sa cible, son coût. */
function apercuDe(etat: Jeu): NonNullable<Projection['combat']>['apercu'] {
  const a = etat.battle?.preview;
  if (!a) return null;
  return { genre: a.kind, vers: 'targetId' in a ? a.targetId : pos([a.tile.x, a.tile.y]), cout: 'cost' in a ? a.cost : null };
}

/** Ce qui attend le geste suivant : l'intention armée, l'aperçu du premier clic, la fin de tour armée ; une réponse dit
 *  ceux qu'un geste a levés. */
export function enSuspens(etat: Jeu): string[] {
  const a = apercuDe(etat);
  return [
    ...(etat.localIntent ? [`intention ${etat.localIntent.actionId}`] : []),
    ...(a ? [`aperçu ${a.genre} → ${a.vers}`] : []),
    ...(etat.battle && endTurnArmed(etat.battle) ? ['fin de tour armée'] : []),
  ];
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
    fenetre: fenetre ? { cle: fenetre.cle, proprietaire: nomDe(etat, fenetre.proprietaire), verbes: [...fenetre.verbes], pid: fenetre.pid ?? null, ...etapeDe(fenetre) } : null,
    jets: jetsEnVue(etat),
    combat: b
      ? {
          round: b.round,
          tour: b.turn + 1,
          tours: b.order.length,
          fin: b.over,
          actif: actif && mvt ? { ...combattant(actif, actif), action: b.acted ? 'prise' : 'libre', mouvement: [mvt.restant, mvt.total] } : null,
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
          etage: etat.scene.layers.length > 1 ? (etat.partyPos.z ?? 0) : null,
          cap: capDuGroupe(etat),
          heros: etat.party.map((h) => h.label),
          gestes: tranche(gestesDExploration(etat), BORNES.gestesEnVue),
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

const ligneDeFenetre = (f: NonNullable<Projection['fenetre']>): string => {
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

/** Les verbes de la fenêtre, chacun par sa signature (`VERBES`, lus du type du noyau), repliés, et l'id que leurs
 *  paramètres `pid` attendent. */
const ligneDeVerbes = (f: NonNullable<Projection['fenetre']>): string[] =>
  f.verbes.length ? replier(`verbes${f.pid ? ` (pid ${f.pid})` : ''} : ${f.verbes.map((v) => signature(v, VERBES[v] ?? [])).join(' · ')}`) : [];

const signe = (n: number): string => (n > 0 ? `+${n}` : String(n));

/** Une ligne de jet : qui jette, quoi, puis le dé tombé (un Test : d100 sur la cible, DR, verdict ; une table : d100, la
 *  valeur lue et sa ligne ; un dé : naturel, total et lecture), ou ce qu'il reste à jeter. */
function texteDeLigneDeJet(l: LigneDeJet): string {
  const qui = l.qui ? `${l.qui} ` : '';
  switch (l.genre) {
    case 'test': return `${qui}${l.test} ${l.jet ? `${l.jet.d100}/${l.cible ?? '—'} DR ${signe(l.jet.dr)} ${l.jet.reussi ? 'réussi' : 'raté'}` : `à jeter${l.cible === null ? '' : ` (cible ${l.cible})`}`}`;
    case 'table': return `${qui}${l.table} ${l.jet ? `${l.jet.d100} (${l.jet.effectif}) : ${l.jet.ligne}` : 'à tirer'}`;
    case 'de': return `${qui}${l.de} ${l.jet ? `${l.jet.naturel} → ${l.jet.total}${l.jet.lecture ? ` : ${l.jet.lecture}` : ''}` : 'à jeter'}`;
  }
}

/** Les jets d'un flux : chaque ligne, puis le vainqueur et le DR net du Test opposé tranché. */
const ligneDeJets = (j: JetEnVue): string[] => replier(`jet ${j.flux} : ${j.lignes.map(texteDeLigneDeJet).join(' · ')}${
  j.oppose ? ` · ${j.oppose.gagnante === null ? 'égalité' : `gagne : ${j.lignes[j.oppose.gagnante]?.qui ?? `ligne ${j.oppose.gagnante + 1}`}`} · DR net ${signe(j.oppose.drNet)}` : ''}`);

const ligneDApercu = (a: NonNullable<NonNullable<Projection['combat']>['apercu']>): string =>
  `aperçu : ${a.genre} → ${a.vers}${a.cout === null ? '' : ` · coût ${a.cout}`} (le même clic confirme)`;

/** Les gestes d'un geste d'exploration tels que la vue les écrit : chaque argument à la forme de son paramètre. */
export const gestesEcrits = (g: GesteDExploration): { verbe: string; args: unknown[] }[] =>
  g.gestes.map(({ verbe, args }) => ({ verbe, args: args.map((a, i) => { const p = VERBES[verbe]?.[i]; return p ? ecritALaForme(a, p.forme) : a; }) }));

/** Un geste d'exploration : son libellé et l'appel qui le joue. */
export const ligneDeGeste = (g: GesteDExploration): string[] => replier(`${g.libelle} : ${appelEcrit('jouer', { gestes: gestesEcrits(g) })}`);

const libelleDOffre = (o: OffreEnVue): string => `${o.id}${o.n > 1 ? `×${o.n}` : ''}→${o.cout ?? '—'}`;

/** La vue par défaut (`BORNES.lignes.vue`). */
export function rendreLaVue(p: Projection): string[] {
  const lignes: string[] = [];
  if (p.combat) {
    const c = p.combat;
    lignes.push(enteteDeCombat(p));
    if (p.fenetre) lignes.push(ligneDeFenetre(p.fenetre), ...ligneDeVerbes(p.fenetre));
    lignes.push(...p.jets.flatMap(ligneDeJets));
    if (c.apercu) lignes.push(ligneDApercu(c.apercu));
    if (c.intention || c.finDeTourArmee) lignes.push([c.intention && `intention armée : ${c.intention} (un clic du champ la commet)`, c.finDeTourArmee && 'fin de tour armée (la même offre la confirme)'].filter(Boolean).join(' · '));
    for (const x of c.voisins.liste.filter((v) => v.id !== c.actif?.id)) lignes.push(ligneDeCombattant(x));
    lignes.push(...enPlus(c.voisins.enPlus, `autres (${appelEcrit('lire', { quoi: 'carte' })})`));
    if (c.offres) {
      const liste = c.offres.liste.map(libelleDOffre);
      lignes.push(`offres : ${liste.length ? [...liste, ...enPlus(c.offres.enPlus, `(${appelEcrit('lire', { quoi: 'offres' })})`)].join(' · ') : 'aucune offre légale'}`);
      if (c.cibles.liste.length) lignes.push(`cibles : ${[...c.cibles.liste, ...enPlus(c.cibles.enPlus, 'autres')].join(', ')}`);
      lignes.push(...replier(`champ : ${CLICS_DU_CHAMP.map((v) => signature(v, VERBES[v] ?? [])).join(' · ')}`));
    } else if (!c.fin) lignes.push(`barre ${c.barre}`);
  } else {
    lignes.push(`${p.scene ? `scène ${p.scene.id} « ${p.scene.nom} »` : 'aucune scène'} · écran ${p.ecran} · pas ${p.pas}`);
    if (p.fenetre) lignes.push(ligneDeFenetre(p.fenetre), ...ligneDeVerbes(p.fenetre));
    lignes.push(...p.jets.flatMap(ligneDeJets));
    if (p.exploration) {
      const x = p.exploration;
      lignes.push(`groupe ${pos(x.groupe)}${x.etage === null ? '' : ` étage ${x.etage}`}${x.cap ? ` · cap ${x.cap}` : ''} : ${x.heros.join(', ')}`);
      lignes.push(...(x.gestes.liste.length ? x.gestes.liste.flatMap(ligneDeGeste) : ['gestes : aucun depuis cette case']));
      lignes.push(...enPlus(x.gestes.enPlus, `gestes (${appelEcrit('lire', { quoi: 'offres' })})`));
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
  return { elements, suite: k < liste.length ? [`+${liste.length - k} : ${suite(k)}`] : [] };
}

/** Le journal : une page, les dernières lignes, ou celles depuis `depuis`. */
export function rendreLeJournal(journal: readonly LigneNumerotee[], depuis?: number, ligne = 0): string[] {
  const { elements } = page(journal, depuis, 'fin', () => '');
  const place = BORNES.lignes.journal - 1;
  // Une entrée à saut de ligne prend plusieurs lignes : la page s'arrête avant de déborder, la suite comprise. Une entrée
  // plus haute que la page se lit seule, page après page de ses lignes (`ligne`).
  const lignes: string[] = [];
  let hauteur = 0;
  for (const [i, l] of elements.entries()) {
    const texte = `${l.n} [pas ${l.pas}] ${texteDe(l)}`.split('\n').slice(i === 0 ? ligne : 0);
    if (i === 0 && texte.length > place) {
      const vues = texte.slice(0, place - 1);
      const reste = texte.length - vues.length;
      return borner([...vues, `+${reste} lignes de l’entrée ${l.n} : ${appelEcrit('lire', { quoi: 'journal', depuis: l.n, ligne: ligne + vues.length })}`], 'journal');
    }
    if (hauteur + texte.length > place) break;
    lignes.push(texte.join('\n'));
    hauteur += texte.length;
  }
  const k = (elements[0]?.n ?? 0) + lignes.length;
  const suite = k < journal.length ? [`+${journal.length - k} : ${appelEcrit('lire', { quoi: 'journal', depuis: k })}`] : [];
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

/** La réponse à `jouer` (`BORNES.lignes.jouer`) : l'issue de la suite, son journal condensé dans la place que l'issue et
 *  la vue laissent, au plus `BORNES.journalEnReponse` lignes, et la suite, puis la vue d'après. */
export function rendreLaSuite(issue: readonly string[], lignes: readonly LigneNumerotee[], vue: readonly string[]): string[] {
  const sortie = [...issue];
  const condensees = condenser(lignes);
  // Une entrée à saut de ligne compte plusieurs lignes ; la suite du journal en prend une.
  const place = Math.min(BORNES.journalEnReponse, BORNES.lignes.jouer - issue.flatMap((l) => l.split('\n')).length - vue.length - 1);
  let prises = 0;
  let k = 0;
  for (; k < condensees.length; k++) {
    const hauteur = condensees[k].texte.split('\n').length;
    if (prises + hauteur > place) break;
    sortie.push(`  ${condensees[k].n}  ${condensees[k].texte}`);
    prises += hauteur;
  }
  if (k < condensees.length) sortie.push(`  +${condensees.length - k} lignes : ${appelEcrit('lire', { quoi: 'journal', depuis: condensees[k].n })}`);
  return borner([...sortie, ...vue], 'jouer');
}

/** `verbes` (`BORNES.lignes.verbes`) : la signature du verbe `id` ; sinon les verbes dont le nom contient `id` (tous sans
 *  `id`), par page de `BORNES.verbesParPage` (`depuis`). */
export function rendreLesVerbes(verbes: Readonly<Record<string, readonly ParametreDeVerbe[]>>, id?: string, depuis?: number): string[] {
  if (id && Object.prototype.hasOwnProperty.call(verbes, id)) return borner(replier(signature(id, verbes[id])), 'verbes');
  const noms = Object.keys(verbes).filter((v) => !id || v.toLowerCase().includes(id.toLowerCase()));
  if (!noms.length) return [`aucun verbe ne contient « ${id} » (${appelEcrit('lire', { quoi: 'verbes' })} les liste)`];
  const debut = Math.max(0, depuis ?? 0);
  const pageDeNoms = noms.slice(debut, debut + BORNES.verbesParPage);
  const k = debut + pageDeNoms.length;
  const suite = k < noms.length ? [`+${noms.length - k} : ${appelEcrit('lire', { quoi: 'verbes', id, depuis: k })}`] : [];
  const tete = noms.length === 1 ? [] : [`${noms.length} verbes ; la signature d’un verbe : ${appelEcrit('lire', { quoi: 'verbes', id: pageDeNoms[0] })}`];
  const corps = noms.length === 1 ? replier(signature(noms[0], verbes[noms[0]])) : replier(pageDeNoms.join(', '));
  return borner([...tete, ...corps, ...suite], 'verbes');
}

/** Les offres que liste `offres` : les ouvertes, ou toutes (`toutes`) ; pour un id, les siennes. */
function offresListees(offres: readonly Offre[], options: { id?: string; toutes: boolean }): Offre[] {
  return offres.filter((o) => (!options.id || o.actionId === options.id) && (options.toutes || o.gate.ok));
}

/** Les offres de l'actif, une par ligne, en pages (`depuis`) : ouvertes, ou fermées comprises avec leur raison
 *  (`toutes`) ; pour un id, ses candidats et leurs arguments, ou la raison de l'absence (le gate de pertinence). */
export function rendreLesOffres(etat: Jeu, offres: readonly Offre[], options: { id?: string; toutes: boolean; depuis?: number }): string[] {
  const choisies = offresListees(offres, options);
  if (!choisies.length) {
    const barre = etatDeLaBarre(etat);
    const pertinence = options.id && barre.forme === 'ouverte' && ACTIONS.some((a) => a.id === options.id)
      ? actionGate(options.id, { active: barre.active, battle: barre.battle, netMode: etat.net.mode })
      : undefined;
    const raison = pertinence && !pertinence.ok ? ` : ${pertinence.reason}` : '';
    return [`aucune offre${options.id ? ` ${options.id}` : options.toutes ? '' : ` ouverte (${appelEcrit('lire', { quoi: 'offres', toutes: true })})`}${raison}`];
  }
  const { elements, suite } = page(choisies, options.depuis, 'debut', (k) => appelEcrit('lire', { quoi: 'offres', id: options.id, toutes: options.toutes || undefined, depuis: k }));
  const lignes = elements.map((o) => {
    const tete = `${o.actionId}${o.candidat ? `[${o.candidat}]` : ''} → ${o.cost ?? '—'}`;
    const args = options.id && Object.keys(o.args).length ? ` · ctx ${JSON.stringify(o.args)}` : '';
    return `${tete}${args} · ${o.gate.ok ? 'ouverte' : `fermée : ${o.gate.reason ?? 'sans raison'}`}`;
  });
  return borner([...lignes, ...suite], 'offres');
}

/** Les gestes d'exploration du groupe, par pages, chacun prêt à jouer. */
export function rendreLesGestes(gestes: readonly GesteDExploration[], depuis?: number): string[] {
  if (!gestes.length) return ['aucun geste d’exploration depuis la case du groupe'];
  const { elements, suite } = page(gestes, depuis, 'debut', (k) => appelEcrit('lire', { quoi: 'offres', depuis: k }));
  return borner([...elements.flatMap(ligneDeGeste), ...suite], 'offres');
}

/** La fiche d'un combattant (ou d'un héros hors combat) : ses champs de l'état, l'armure en PA par localisation
 *  (`effectiveArmourAt`). */
export function rendreLaFiche(etat: Jeu, id: string): string[] | null {
  const c = porteurParId(etat, id);
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

/** Une page de la carte : les combattants, l'actif d'abord, puis ses engagés, puis par distance (`depuis`). */
export function pageDeLaCarte(etat: Jeu, depuis?: number): { combattants: CombattantProjete[]; suite: string[] } {
  const { elements, suite } = page(combattantsTries(etat), depuis, 'debut', (k) => appelEcrit('lire', { quoi: 'carte', depuis: k }));
  return { combattants: elements, suite };
}

/** La carte (`BORNES.lignes.carte`) : en combat, les combattants ; en exploration, le groupe et ses héros (leur id),
 *  puis les entités de la scène (`scene.entities`) ; par page (`depuis`). */
export function rendreLaCarte(etat: Jeu, p: Projection, depuis?: number): string[] {
  if (!p.combat) {
    const entites = etat.scene?.entities ?? [];
    const { elements, suite } = page(entites, depuis, 'debut', (k) => appelEcrit('lire', { quoi: 'carte', depuis: k }));
    const tete = p.exploration
      ? [`groupe ${pos(p.exploration.groupe)} · ${etat.party.length} héros · ${entites.length} entité(s)`, ...etat.party.map((h) => `  ${h.id} · ${h.kind} · ${h.label}`)]
      : ['aucune scène'];
    return borner([...tete, ...elements.map((e) => `  ${e.id} · ${e.kind}${e.label ? ` · ${e.label}` : ''} · ${pos([e.pos.x, e.pos.y])}`), ...suite], 'carte');
  }
  const { combattants, suite } = pageDeLaCarte(etat, depuis);
  return borner([...combattants.map((c) => `${c.id === p.combat!.actif?.id ? '> ' : '  '}${ligneDeCombattant(c)}`), ...suite], 'carte');
}

/** Les cases que le champ peint au tour de l'actif (`porteesDuTour`, le lecteur de sa surbrillance), par zone et par
 *  coût, une page de `BORNES.cases` cases (`depuis`). Hors combat, ou hors du tour du joueur : aucune. */
export function casesAtteignables(etat: Jeu, monTour: boolean): { zone: string; case: Pt; cout: number }[] {
  if (!etat.battle) return [];
  const portees = porteesDuTour(() => etat, monTour);
  return (Object.entries(portees) as [string, Map<string, number>][]).flatMap(([zone, cases]) =>
    [...cases].map(([cle, cout]) => ({ zone, case: tileFromKey(cle), cout })).sort((a, b) => a.cout - b.cout || a.case.y - b.case.y || a.case.x - b.case.x));
}

/** `cases` (`BORNES.lignes.cases`) : les zones et leur compte, puis une ligne par zone et par tranche de
 *  `BORNES.casesParLigne` cases, « (x,y)·coût ». */
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
  const zones = [...new Set(cases.map((c) => c.zone))].map((z) => `${z} ${cases.filter((c) => c.zone === z).length}`);
  return borner([`zones : ${zones.join(' · ')}`, ...lignes, ...(k < cases.length ? [`+${cases.length - k} : ${appelEcrit('lire', { quoi: 'cases', depuis: k })}`] : [])], 'cases');
}
