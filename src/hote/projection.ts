/**
 * LA PROJECTION DE L'ÉTAT D'UNE PARTIE (#2898, plan v3 « La forme » ; #2928 M-i), commune aux hôtes du noyau : ce
 * qu'une vue montre, lu champ par champ par les lecteurs de la surface du noyau (`../noyau/index`), chaque liste
 * tranchée aux bornes que l'hôte fixe (`BornesDeLaProjection`), et les cases atteignables au tour de l'actif. Aucune
 * règle ne se calcule ici : un champ est un lecteur du noyau, ou un champ de l'état lu tel quel (provenance :
 * `scripts/docs/build-hote-texte.mjs`). Chaque champ est une donnée, que chaque hôte met en forme à sa façon.
 */
import { garanti } from '../lib/garanti';
import { activeCombatant, offreArmee, mouvementDuTour, fenetreDuJeu, combatDistance, etatDeLaBarre, offresDeLActif, validTargets, endTurnArmed, porteeDuCombattant, vehiculeDuCombattant, gestesDExploration, jetsEnVue, capDuGroupe, stepInteraction, porteesDuTour, tileFromKey, estPoseParSesPonts, fermeturesDeLaFenetre, libelleDeLaFermeture, combattantEnVue, entiteConnue, nomEnVue, porteurEnVue, type Combatant, type EtatDeLaBarre, type GesteDExploration, type GesteDuJeu, type GesteDuNoyau, type Jeu, type JetEnVue, type Offre, type PorteeDeComposition, type Pt, type VehiculeDuCombattant } from '../noyau/index';

/** Un combattant projeté. */
export interface CombattantProjete {
  id: string;
  nom: string;
  camp: Combatant['kind'];
  pb: [courant: number, max: number];
  avantage: number;
  /** Sa case et sa couche (`Combatant.pos`, `z` absent : 0) ; `null` sans position. */
  pos: [x: number, y: number, z: number] | null;
  /** Distance de l'actif en vue, en cases (`combatDistance`) ; `null` sans position ou sans actif en vue. */
  distance: number | null;
  /** Engagé avec l'actif en vue (`engagedWith`). */
  engage: boolean;
  /** Ses États (`conditions`), chacun avec sa valeur. */
  etats: { id: string; valeur: number }[];
  horsCombat: boolean;
  /** Ce qu'il porte (`porteeDuCombattant`) ; `null` : son espèce n'a aucune race de rendu. */
  portee: PorteeDeComposition | null;
  /** Le véhicule ou l'engin qu'il est (`vehiculeDuCombattant`) ; `null` : ni l'un ni l'autre. */
  vehicule: VehiculeDuCombattant | null;
}

/** Une entité de la scène en exploration : id, genre, nom, case et couche (`SceneEntity.z`, absent : 0). */
export interface EntiteProjetee {
  id: string;
  genre: string;
  nom: string | null;
  pos: [x: number, y: number, z: number];
}

/** Une offre de la vue : l'action, ses candidats ouverts comptés, son coût en mots, la part de l'économie du tour
 *  qu'elle prend (`ActionDef.coutAction`, son id), et pourquoi elle est fermée quand aucun candidat ne l'ouvre (`refus`,
 *  la raison de son premier candidat ; `null` : ouverte). */
export interface OffreEnVue {
  id: string;
  n: number;
  cout: string | null;
  economie: Offre['def']['coutAction'];
  refus: string | null;
  /** L'offre est armée (`offreArmee`) : son intention visée, ou son mode celui du combat. */
  armee: boolean;
  /** Le geste qui joue l'offre sans argument (`Offre.geste`) ; `null` : elle s'offre par candidat, ou sa case attend un
   *  paramètre que seule la console choisit. */
  geste: GesteDuNoyau | null;
  /** Les candidats d'une offre qui s'offre par candidat (le sort, l'arme, l'attaque de trait), chacun nommé, le
   *  contexte qui le désigne (`offreDesignee`), le geste qui le joue et la raison qui le refuse ; vide pour une offre
   *  sans argument. */
  candidats: CandidatEnVue[];
}

/** Un candidat d'une offre : son nom (`Offre.candidat`, sinon l'entité du champ qui le porte), son contexte, le geste
 *  qui le joue (`Offre.geste`), son refus, et s'il est armé (`offreArmee`). */
export interface CandidatEnVue {
  nom: string;
  ctx: Offre['args'];
  geste: GesteDuNoyau | null;
  refus: string | null;
  armee: boolean;
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
  /** La fenêtre qui tient la main, en combat comme hors combat, ses gestes (un verbe, et le flux d'un verbe de jet),
   *  ceux qui sont fermés maintenant avec leur raison, par l'identité du geste (`cleDuGeste`, `fermeturesDeLaFenetre`),
   *  et l'id que ses gestes désignent (`pid`, `argumentsPosesDuGeste`) ; pour la cascade, son étape courante
   *  (`stepInteraction`, les clés d'un choix). */
  fenetre: { cle: string; proprietaire: ProprietaireDeLaFenetre; gestes: GesteDuJeu[]; fermes: Record<string, string>; pid: string | null; etape?: { id: string; genre: string; interaction: string; choix: string[] } } | null;
  /** Les jets de la fenêtre qui tient la main (`jetsEnVue`), jetés ou à jeter, et le DR net d'un Test opposé tranché. */
  jets: JetEnVue[];
  combat: null | {
    round: number;
    /** Le rang de l'actif dans l'ordre du tour en vue (`ordreEnVue`), `null` avant le premier tour ou quand l'actif
     *  n'est pas en vue. */
    tour: number | null;
    /** Les combattants de l'ordre du tour en vue (`ordreEnVue`). */
    tours: number;
    fin: NonNullable<Jeu['battle']>['over'];
    /** L'actif, `null` quand il n'est pas en vue (`combattantEnVue`). */
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
    /** Les combattants en vue (`combattantsTries`) : l'actif, ses engagés, puis au plus `BornesDeLaProjection.autres`
     *  autres, par distance croissante. */
    voisins: { liste: CombattantProjete[]; enPlus: number };
  };
  exploration: null | {
    /** La case du groupe, son étage quand la scène en a plusieurs, son cap (`capDuGroupe`). */
    groupe: [x: number, y: number];
    etage: number | null;
    cap: string | null;
    /** Les héros du groupe, le meneur d'abord, chacun à la case du groupe. */
    heros: CombattantProjete[];
    /** Ce que le groupe peut jouer depuis sa case, chaque geste prêt à jouer (`gestesDExploration`). */
    gestes: { liste: GesteDExploration[]; enPlus: number };
    /** Les entités de la scène que le groupe connaît (`entiteConnue`), chacune à sa case : décors, PNJ, objets ; hors
     *  des navires posés par leurs ponts (`estPoseParSesPonts`), qui ne tiennent aucune case. */
    entites: { liste: EntiteProjetee[]; enPlus: number };
  };
  refus: { texte: string; nonce: number } | null;
  journal: number;
}

/** L'aperçu du premier clic : son genre, sa cible ou sa case, son coût. */
export interface Apercu {
  genre: string;
  cible: string | null;
  case: [x: number, y: number, z: number] | null;
  cout: number | null;
}

/** Qui tient la main d'une fenêtre : `tous` les sièges, `aucun` propriétaire (l'hôte), ou un `porteur`, nommé par
 *  l'état (`null` : l'état ne le nomme pas). Un hôte le dit en ses mots ; jamais un id. */
export type ProprietaireDeLaFenetre = { genre: 'tous' } | { genre: 'aucun' } | { genre: 'porteur'; nom: string | null };

/** Le propriétaire d'une fenêtre (`fenetreDuJeu`) : `'*'`, tous ; sans id, aucun (`modalOwnerOf`) ; un id, son porteur
 *  (`nomEnVue`). */
export const proprietaireDeLaFenetre = (etat: Jeu, id: string | undefined | null): ProprietaireDeLaFenetre => {
  if (id == null) return { genre: 'aucun' };
  if (id === '*') return { genre: 'tous' };
  return { genre: 'porteur', nom: nomEnVue(etat, id) };
};

/** `c` est hors du combat : mort, ou sorti de la rencontre. */
export const horsCombat = (c: Combatant): boolean => !!c.dead || !!c.outOfRencontre;

function combattant(c: Combatant, actif: Combatant | undefined, facing: Jeu['facing']): CombattantProjete {
  const d = actif ? combatDistance(actif, c) : Infinity;
  return {
    id: c.id,
    nom: c.label,
    camp: c.kind,
    pb: [c.wounds.current, c.wounds.max],
    avantage: c.advantage,
    pos: c.pos ? [c.pos.x, c.pos.y, c.pos.z ?? 0] : null,
    distance: Number.isFinite(d) ? d : null,
    engage: !!actif && c.id !== actif.id && !!actif.engagedWith?.includes(c.id),
    etats: c.conditions.map((e) => ({ id: e.id, valeur: e.value })),
    horsCombat: horsCombat(c),
    portee: porteeDuCombattant(c),
    vehicule: vehiculeDuCombattant(c, facing[c.id]),
  };
}

/** L'actif du combat, s'il est en vue (`combattantEnVue`). */
const actifEnVue = (etat: Jeu): Combatant | undefined => {
  const actif = etat.battle && activeCombatant(etat.battle);
  return actif && combattantEnVue(etat, actif) ? actif : undefined;
};

/** Les combattants en vue (`combattantEnVue`), projetés : l'actif, ses engagés, puis par distance croissante de l'actif
 *  en vue. */
export function combattantsTries(etat: Jeu): CombattantProjete[] {
  const b = etat.battle;
  if (!b) return [];
  const actif = actifEnVue(etat);
  const rangDe = (c: CombattantProjete): number => (c.id === actif?.id ? -2 : c.engage ? -1 : (c.distance ?? Infinity));
  return b.combatants.filter((c) => combattantEnVue(etat, c)).map((c) => combattant(c, actif, etat.facing)).sort((x, y) => rangDe(x) - rangDe(y));
}

/** L'ordre du tour (`battle.order`) réduit aux combattants en vue (`porteurEnVue`). */
export const ordreEnVue = (etat: Jeu): string[] => (etat.battle?.order ?? []).filter((id) => porteurEnVue(etat, id));

/** Les gestes de la fenêtre que son jet ferme maintenant (`fermeturesDeLaFenetre`), par leur identité (`cleDuGeste`),
 *  chacun avec sa raison en mots du joueur. */
const fermesDe = (etat: Jeu, f: NonNullable<ReturnType<typeof fenetreDuJeu>>): Record<string, string> =>
  Object.fromEntries([...fermeturesDeLaFenetre(etat, f)].flatMap(([cle, fermeture]) => (fermeture ? [[cle, libelleDeLaFermeture(fermeture)]] : [])));

/** L'étape de cascade que la fenêtre rend (`fenetreDuJeu`) : son id, son genre, son interaction, les clés de son choix. */
const etapeDe = (f: NonNullable<ReturnType<typeof fenetreDuJeu>>) =>
  f.etape ? { etape: { id: f.etape.id, genre: f.etape.kind, interaction: stepInteraction(f.etape), choix: (f.etape.options ?? []).map((o) => o.key) } } : {};

/** Les offres de l'actif d'une barre ouverte (`offresDeLActif`, l'énumération que lit la console). */
export const offresDeLaBarreOuverte = (etat: Jeu, barre: Extract<EtatDeLaBarre, { forme: 'ouverte' }>): Offre[] =>
  offresDeLActif({ active: barre.active, battle: barre.battle, netMode: etat.net.mode, gameTime: etat.gameTime, state: etat });

/** Les offres, une par action, dans l'ordre du registre : ses candidats ouverts comptés ; fermée quand aucun ne
 *  l'ouvre, avec la raison de son premier candidat (loi du refus visible, `offresDeLActif`). */
function offresEnVue(etat: Jeu, offres: readonly Offre[]): OffreEnVue[] {
  const parId = new Map<string, OffreEnVue>();
  for (const o of offres) {
    const refus = o.gate.ok ? null : garanti(o.gate.reason, o.actionId, 'raison du refus de l’offre');
    const vue = parId.get(o.actionId) ?? { id: o.actionId, n: 0, cout: o.cost, economie: o.def.coutAction, refus, armee: false, geste: null, candidats: [] };
    const armee = offreArmee(etat, o.def, o.args);
    vue.armee ||= armee;
    if (Object.keys(o.args).length) {
      const nom = o.candidat ?? (o.porteurId === undefined ? undefined : nomEnVue(etat, o.porteurId));
      vue.candidats.push({ nom: garanti(nom, o.actionId, 'nom du candidat de l’offre'), ctx: o.args, geste: o.geste, refus, armee });
    } else vue.geste = o.geste;
    if (o.gate.ok) {
      vue.n++;
      vue.refus = null;
    }
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
    : { genre: a.kind, cible: null, case: [a.tile.x, a.tile.y, a.tile.z ?? 0], cout: 'cost' in a ? a.cost : null };
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
  const actif = actifEnVue(etat);
  const ordre = ordreEnVue(etat);
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
    fenetre: fenetre ? { cle: fenetre.cle, proprietaire: proprietaireDeLaFenetre(etat, fenetre.proprietaire), gestes: [...fenetre.gestes], fermes: fermesDe(etat, fenetre), pid: fenetre.pid ?? null, ...etapeDe(fenetre) } : null,
    jets: jetsEnVue(etat),
    combat: b
      ? {
          round: b.round,
          tour: b.turn < 0 || !actif ? null : ordre.indexOf(actif.id) + 1,
          tours: ordre.length,
          fin: b.over,
          actif: actif && mvt ? { ...combattant(actif, actif, etat.facing), action: b.acted ? 'prise' : 'libre', mouvement: [mvt.restant, mvt.total] } : null,
          apercu: apercuDe(etat),
          barre: { forme: barre.forme, raison: barre.forme === 'ouverte' ? null : barre.raison },
          intention: etat.localIntent?.actionId ?? null,
          finDeTourArmee: endTurnArmed(b),
          cibles: tranche(offres ? validTargets(() => etat).map((c) => c.id) : [], bornes.cibles),
          offres: offres ? tranche(offresEnVue(etat, offres), bornes.offres) : null,
          voisins: { liste: [...engages, ...autres.slice(0, bornes.autres)], enPlus: Math.max(0, autres.length - bornes.autres) },
        }
      : null,
    exploration: b || !etat.scene
      ? null
      : {
          groupe: [etat.partyPos.x, etat.partyPos.y],
          etage: etat.scene.layers.length > 1 ? (etat.partyPos.z ?? 0) : null,
          cap: capDuGroupe(etat),
          heros: etat.party.map((h) => ({ ...combattant(h, undefined, etat.facing), pos: [etat.partyPos.x, etat.partyPos.y, etat.partyPos.z ?? 0] })),
          gestes: tranche(gestesDExploration(etat), bornes.gestes),
          entites: tranche(etat.scene.entities.filter((e) => !estPoseParSesPonts(etat.scene!, e.id) && entiteConnue(etat, e)).map((e) => ({ id: e.id, genre: e.kind, nom: e.label ?? null, pos: [e.pos.x, e.pos.y, e.z ?? 0] })), bornes.entites),
        },
    refus: etat.refus,
    journal,
  };
}
