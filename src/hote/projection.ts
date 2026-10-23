/**
 * LA PROJECTION DE L'ÉTAT D'UNE PARTIE (#2898, plan v3 « La forme » ; #2928 M-i), commune aux hôtes du noyau : ce
 * qu'une vue montre, lu champ par champ par les lecteurs de la surface du noyau (`../noyau/index`), chaque liste
 * tranchée aux bornes que l'hôte fixe (`BornesDeLaProjection`), et les cases atteignables au tour de l'actif. Aucune
 * règle ne se calcule ici : un champ est un lecteur du noyau, ou un champ de l'état lu tel quel (provenance :
 * `scripts/docs/build-hote-texte.mjs`). Chaque champ est une donnée, que chaque hôte met en forme à sa façon.
 */
import {
  activeCombatant, mouvementDuTour, fenetreDuJeu, combatDistance, etatDeLaBarre, offresDeLActif, validTargets, endTurnArmed,
  porteurParId, gestesDExploration, jetsEnVue, capDuGroupe, stepInteraction, porteesDuTour, tileFromKey,
  type Combatant, type EtatDeLaBarre, type GesteDExploration, type Jeu, type JetEnVue, type Offre, type Pt,
} from '../noyau/index';

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
  /** Ses États (`conditions`), chacun avec sa valeur. */
  etats: { id: string; valeur: number }[];
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

/** Les éléments au plus de chaque liste de la projection, le reste compté (`enPlus`) : les combattants après l'actif et
 *  ses engagés, les offres ouvertes, les cibles, les gestes d'exploration, les entités de la scène. */
export interface BornesDeLaProjection {
  autres: number;
  offres: number;
  cibles: number;
  gestes: number;
  entites: number;
}

/** La projection : ce que la vue montre, et rien de plus. Chaque liste est bornée, le reste compté. */
export interface Projection {
  pas: number;
  ecran: Jeu['screen'];
  scene: { id: string; nom: string } | null;
  /** La fenêtre qui tient la main, en combat comme hors combat, ses verbes et l'id que ses verbes prennent en premier
   *  argument (`pid`) ; pour la cascade, son étape courante (`stepInteraction`, les clés d'un choix). */
  fenetre: { cle: string; proprietaire: ProprietaireDeLaFenetre; verbes: string[]; pid: string | null; etape?: { id: string; genre: string; interaction: string; choix: string[] } } | null;
  /** Les jets de la fenêtre qui tient la main (`jetsEnVue`), jetés ou à jeter, et le DR net d'un Test opposé tranché. */
  jets: JetEnVue[];
  combat: null | {
    round: number;
    tour: number;
    tours: number;
    fin: NonNullable<Jeu['battle']>['over'];
    actif: (CombattantProjete & { action: 'libre' | 'prise'; mouvement: [restant: number, total: number] }) | null;
    /** L'aperçu du premier clic du champ (`battle.preview`), que le second confirme. */
    apercu: Apercu | null;
    /** La barre de l'actif (`etatDeLaBarre`) : sa forme, et la raison d'une barre fermée (`null` : ouverte). */
    barre: { forme: EtatDeLaBarre['forme']; raison: string | null };
    intention: string | null;
    finDeTourArmee: boolean;
    cibles: { liste: string[]; enPlus: number };
    /** Les offres ouvertes de l'actif ; `null` : la barre n'est pas ouverte. */
    offres: { liste: OffreEnVue[]; enPlus: number } | null;
    /** L'actif, ses engagés, puis au plus `BornesDeLaProjection.autres` autres, par distance croissante. */
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

/** L'aperçu du premier clic : son genre, sa cible ou sa case, son coût. */
export interface Apercu {
  genre: string;
  cible: string | null;
  case: [x: number, y: number] | null;
  cout: number | null;
}

/** Qui tient la main d'une fenêtre : `tous` les sièges, `aucun` propriétaire (l'hôte), ou un `porteur`, nommé par
 *  l'état (`null` : l'état ne le nomme pas). Un hôte le dit en ses mots ; jamais un id. */
export type ProprietaireDeLaFenetre = { genre: 'tous' } | { genre: 'aucun' } | { genre: 'porteur'; nom: string | null };

/** Le propriétaire d'une fenêtre (`fenetreDuJeu`) : `'*'`, tous ; sans id, aucun (`modalOwnerOf`) ; un id, son porteur
 *  (`porteurParId`). */
export const proprietaireDeLaFenetre = (etat: Jeu, id: string | undefined | null): ProprietaireDeLaFenetre => {
  if (id == null) return { genre: 'aucun' };
  if (id === '*') return { genre: 'tous' };
  return { genre: 'porteur', nom: porteurParId(etat, id)?.label ?? null };
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
    etats: c.conditions.map((e) => ({ id: e.id, valeur: e.value })),
    horsCombat: !!c.dead || !!c.outOfRencontre,
  };
}

/** Tous les combattants projetés : l'actif, ses engagés, puis par distance croissante. */
export function combattantsTries(etat: Jeu): CombattantProjete[] {
  const b = etat.battle;
  if (!b) return [];
  const actif = activeCombatant(b);
  const rangDe = (c: CombattantProjete): number => (c.id === actif?.id ? -2 : c.engage ? -1 : (c.distance ?? Infinity));
  return b.combatants.map((c) => combattant(c, actif)).sort((x, y) => rangDe(x) - rangDe(y));
}

/** L'étape de cascade que la fenêtre rend (`fenetreDuJeu`) : son id, son genre, son interaction, les clés de son choix. */
const etapeDe = (f: NonNullable<ReturnType<typeof fenetreDuJeu>>) =>
  f.etape ? { etape: { id: f.etape.id, genre: f.etape.kind, interaction: stepInteraction(f.etape), choix: (f.etape.options ?? []).map((o) => o.key) } } : {};

/** Les offres de l'actif d'une barre ouverte (`offresDeLActif`, l'énumération que lit la console). */
export const offresDeLaBarreOuverte = (etat: Jeu, barre: Extract<EtatDeLaBarre, { forme: 'ouverte' }>): Offre[] =>
  offresDeLActif({ active: barre.active, battle: barre.battle, netMode: etat.net.mode, state: etat });

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

/** L'aperçu du premier clic (`battle.preview`), `null` sans aperçu. */
export function apercuDe(etat: Jeu): Apercu | null {
  const a = etat.battle?.preview;
  if (!a) return null;
  return 'targetId' in a
    ? { genre: a.kind, cible: a.targetId, case: null, cout: 'cost' in a ? a.cost : null }
    : { genre: a.kind, cible: null, case: [a.tile.x, a.tile.y], cout: 'cost' in a ? a.cost : null };
}

/** Une case que le champ peint au tour de l'actif : sa zone (`porteesDuTour`), la case, son coût. */
export interface CaseAtteignable {
  zone: string;
  case: Pt;
  cout: number;
}

/** Les cases que le champ peint au tour de l'actif (`porteesDuTour`, le lecteur de sa surbrillance), par zone, puis par
 *  coût et par case. Hors combat, ou hors du tour du joueur (par défaut : la barre n'est pas ouverte, `etatDeLaBarre`) :
 *  aucune. */
export function casesAtteignables(etat: Jeu, monTour = etatDeLaBarre(etat).forme === 'ouverte'): CaseAtteignable[] {
  if (!etat.battle) return [];
  const portees = porteesDuTour(() => etat, monTour);
  return (Object.entries(portees) as [string, Map<string, number>][]).flatMap(([zone, cases]) =>
    [...cases].map(([cle, cout]) => ({ zone, case: tileFromKey(cle), cout })).sort((a, b) => a.cout - b.cout || a.case.y - b.case.y || a.case.x - b.case.x));
}

/** La projection de l'état après `pas` gestes, sur un journal de `journal` lignes, chaque liste à ses `bornes`. */
export function projeter(etat: Jeu, pas: number, journal: number, bornes: BornesDeLaProjection): Projection {
  const b = etat.battle;
  const actif = b ? activeCombatant(b) : undefined;
  const fenetre = fenetreDuJeu(etat);
  const barre = etatDeLaBarre(etat);
  const offres = barre.forme === 'ouverte' ? offresDeLaBarreOuverte(etat, barre) : null;
  const tous = combattantsTries(etat);
  const engages = tous.filter((c) => c.id === actif?.id || c.engage);
  const autres = tous.filter((c) => c.id !== actif?.id && !c.engage);
  const mvt = b && actif ? mouvementDuTour(b, actif) : null;
  return {
    pas,
    ecran: etat.screen,
    scene: etat.scene ? { id: etat.scene.id, nom: etat.scene.label } : null,
    fenetre: fenetre ? { cle: fenetre.cle, proprietaire: proprietaireDeLaFenetre(etat, fenetre.proprietaire), verbes: [...fenetre.verbes], pid: fenetre.pid ?? null, ...etapeDe(fenetre) } : null,
    jets: jetsEnVue(etat),
    combat: b
      ? {
          round: b.round,
          tour: b.turn + 1,
          tours: b.order.length,
          fin: b.over,
          actif: actif && mvt ? { ...combattant(actif, actif), action: b.acted ? 'prise' : 'libre', mouvement: [mvt.restant, mvt.total] } : null,
          apercu: apercuDe(etat),
          barre: { forme: barre.forme, raison: barre.forme === 'ouverte' ? null : barre.raison },
          intention: etat.localIntent?.actionId ?? null,
          finDeTourArmee: endTurnArmed(b),
          cibles: tranche(offres ? validTargets(() => etat).map((c) => c.id) : [], bornes.cibles),
          offres: offres ? tranche(offresEnVue(offres), bornes.offres) : null,
          voisins: { liste: [...engages, ...autres.slice(0, bornes.autres)], enPlus: Math.max(0, autres.length - bornes.autres) },
        }
      : null,
    exploration: b || !etat.scene
      ? null
      : {
          groupe: [etat.partyPos.x, etat.partyPos.y],
          etage: etat.scene.layers.length > 1 ? (etat.partyPos.z ?? 0) : null,
          cap: capDuGroupe(etat),
          heros: etat.party.map((h) => h.label),
          gestes: tranche(gestesDExploration(etat), bornes.gestes),
          entites: tranche(etat.scene.entities.map((e) => ({ id: e.id, genre: e.kind, nom: e.label ?? null, pos: [e.pos.x, e.pos.y] })), bornes.entites),
        },
    refus: etat.refus,
    journal,
  };
}
