/**
 * ARÊTES UTILISABLES — dériveur UNIQUE de ce qu'une ARÊTE de scène offre au joueur (#1687, lot 1b-1).
 *
 * Jumeau de `noyau/monde/usable.ts` (lot 2) pour les arêtes : là où `actionsDe` dérive les actions d'une
 * ENTITÉ, `aretesUtilisables` dérive les gestes portés par les arêtes — franchir une porte, grimper,
 * sauter en bas, frapper une fortification. Une capacité N+1 = une fonction interne et une ligne de
 * `PRIORITE_ARETES`.
 *
 * PUR et FEUILLE : aucune lecture de store, aucune géométrie d'écran (`tileEdge` reste chez l'hôte),
 * aucun libellé en dur (`t()`/`MsgKey`, ou le `label` du Combattant pour une structure). Le CONTEXTE
 * (brouillard, contrôleur, couche active, combat) est FOURNI par l'appelant.
 *
 * PORTEUR UNIQUE CÔTÉ HÔTE (lot 1b-3) : toutes les capacités reçoivent le MÊME mobile — le groupe hors
 * combat, l'actif que ce siège mène (`controlsCombatant`) (`ContexteAretes.controleur` = `doorCtrls[0] ?? null`,
 * `gameIso/stage/MondeDeCampagne.tsx`, cardinal ≤ 1). L'unité du porteur est le contrat : deux
 * capacités qui répondraient à deux mobiles différents offriraient deux gestes sur la même arête.
 *
 * Les divergences que ce module a HÉRITÉES des quatre overlays d'origine et qui vivent encore :
 *  (a) INTERROGATION DU PORTEUR — les deux capacités de dénivelé ne lisent pas le même mobile de la
 *      même façon : l'escalade exige qu'il BORDE l'arête, la chute et la fenêtre sondent ses quatre
 *      cardinaux (`denivelesDuMobile`) ; la structure, elle, ne l'interroge pas du tout — on pilonne à distance,
 *      et le porteur n'y OUVRE que l'offre : pas de frappeur en main, pas de frappe offerte. Son
 *      geste, lui, part de la case du MUR comme le clic de n'importe quel jeton ennemi ;
 *  (c) BROUILLARD — porte et structure/escalade ne bâtissent pas leur clé de visibilité de la même
 *      façon (`portal.from.z ?? portal.z` contre `w.z ?? 0`).
 *
 * LIFT — l'élévation d'écran ne se lit plus ici : les arêtes que le peintre unique rend et que le
 * picking résout sont projetées une seule fois par l'hôte, au lift MÉTRIQUE de la case d'ancrage
 * (`gameIso/stage/aretesProjetees.ts`). `AreteUtilisable.z` ne porte que l'INDEX de couche, qui sert à
 * la clé et au brouillard.
 *
 * PORTES : les accès du CONTRÔLEUR, `portalsForParty(scene, controleur)` (`roomPortals.ts`) — la même
 * réponse que la navigation d'exploration (`exploreNav.ts`) ; aucun contrôleur, aucun accès.
 */
import { t, type MsgKey } from '../i18n';
import { heightAt, edgeOf, porteMasquee, structureIsDown, type Scene, type WallSeg, type WallSide } from './monde/scene';
import { memoByRef } from './monde/sceneMemo';
import { cleArete } from './monde/wallIndex';
import { planFranchissement } from './fallMove';
import { inBattleId } from './monde/combatants';
import { portalsForParty, type RoomPortal } from './monde/roomPortals';
import type { Pt } from './monde/path';
import type { BattleState } from './etat';
import { nomDe } from '../engine/nom';
import type { PlayerText } from '../i18n/playerText';

/** Ce qu'une arête OFFRE. Identité STABLE (le libellé est de l'affichage). */
export type CapaciteArete = 'structure' | 'chute' | 'fenetre' | 'escalade' | 'porte';

/**
 * PRIORITÉ entre capacités sur une MÊME arête, du plus fort au plus faible. Elle est ÉCRITE ici et
 * nulle part ailleurs : ni l'ordre de peinture ni l'ordre d'un `if` ne la disent. L'ordre de la liste
 * rendue par `aretesUtilisables` EST cette priorité, et la chaîne de picking la relit à égalité de
 * distance (`stage/pickResolve.ts:areteSousLePixel`). `fenetre` suit `chute` : les deux sortent du
 * MÊME plan (`planFranchissement`), exclusifs sur une arête, et passent avant l'escalade et la porte
 * comme tout geste de franchissement que la croisée porte.
 */
export const PRIORITE_ARETES: readonly CapaciteArete[] = ['structure', 'chute', 'fenetre', 'escalade', 'porte'];

/**
 * Largeur PLEINE du trait offert au geste, en pixels, PAR capacité : 28 pour un seuil, 9 pour les
 * traits d'escalade, de chute et de fenêtre (une même croisée, d'étage ou de plain-pied, garde sa
 * prise), 16 pour une structure ; le rayon de prise vaut la moitié, et le peintre trace à cette même
 * largeur. Donnée du dériveur : un 28 uniforme ferait mordre les gestes les uns sur les autres.
 */
export const LARGEUR_PRISE_ARETE: Readonly<Record<CapaciteArete, number>> = {
  structure: 16,
  chute: 9,
  fenetre: 9,
  escalade: 9,
  porte: 28,
};

/** Une arête et le geste qu'elle offre au contrôleur. */
export interface AreteUtilisable {
  /** Clé canonique de l'arête (`wallIndex.cleArete`) — l'identité qui départage les capacités. */
  cle: string;
  x: number;
  y: number;
  side: WallSide;
  z: number;
  capacite: CapaciteArete;
  /** La case QUE LE GESTE VISE, et le pied de sa géométrie d'écran : `from` du portail, case du mobile
   *  pour l'escalade et la chute, case du MUR pour une structure — celle de son Combattant
   *  (`noyau/combatSlice.ts`, `c.pos = { x: w.x, y: w.y }`), d'où la prise se projette AU LIFT DU MUR
   *  et le survol tombe sur le jeton visé. TOUJOURS posée : une arête sans case à viser n'est pas une
   *  offre, et tous les dériveurs la construisent avant de rendre l'offre. */
  ancrage: Pt;
  /** Largeur pleine du trait de prise, en pixels (`LARGEUR_PRISE_ARETE`). */
  largeurPrise: number;
  /** Texte JOUEUR déjà résolu. */
  libelle: PlayerText;
  /** Combattant-structure visé par le geste de siège (`cliquerLaCase`). */
  cid?: string;
  /** Accès de pièce que le geste FRANCHIT (ouvrir la porte, marcher jusqu'à `to`) — jumeau de `cid`
   *  pour la capacité `porte` : la clé d'arête dit OÙ, ce champ dit avec QUOI le geste s'exécute
   *  (`kind` et `to` ne se retrouvent pas depuis l'arête). */
  portail?: RoomPortal;
}

/** Tout ce que le dériveur lit — aucun store, aucune dimension d'écran. */
export interface ContexteAretes {
  scene: Scene;
  /** Cases éclaircies, clés `x,y,z` (brouillard de guerre). */
  visible: ReadonlySet<string>;
  /** Groupe hors combat, actif que ce siège mène (`controlsCombatant`), `null` sinon
   *  (`gameIso/stage/MondeDeCampagne.tsx`, `doorCtrls`) — le MÊME porteur pour toutes les capacités. */
  controleur: Pt | null;
  activeZ: number;
  battle?: BattleState | null;
}

const CARDINAUX: ReadonlyArray<readonly [number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Les deux cases que sépare l'arête (x, y, side) — l'ordre est celui des overlays. */
const cotes = (x: number, y: number, side: WallSide): [Pt, Pt] => [
  { x, y },
  side === 'E' ? { x: x + 1, y } : { x, y: y - 1 },
];

const vue = (visible: ReadonlySet<string>, a: Pt, b: Pt, z: number): boolean =>
  visible.has(`${a.x},${a.y},${z}`) || visible.has(`${b.x},${b.y},${z}`);

/**
 * La case D'EN FACE, vue depuis l'ancrage : le second bout du geste (grimper vers elle, sauter vers
 * elle). Dérivée des deux cases que l'arête sépare (`cotes`) plutôt que portée en champ de plus, qui
 * dirait deux fois la même géométrie. TOUJOURS définie : tous les dériveurs ancrent sur l'un des
 * deux côtés de l'arête (case de départ du portail, case du mobile, case du mur) — un ancrage qui ne
 * la borde pas est une invariante VIOLÉE, qui LÈVE en se nommant au lieu de rendre un `null` qu'un
 * appelant avalerait en silence.
 */
export function caseOpposee(arete: AreteUtilisable): Pt {
  const de = arete.ancrage;
  const [c1, c2] = cotes(arete.x, arete.y, arete.side);
  const memeCase = (c: Pt) => c.x === de.x && c.y === de.y;
  const vers = memeCase(c1) ? c2 : memeCase(c2) ? c1 : null;
  if (!vers) {
    throw new Error(`caseOpposee : l'ancrage (${de.x},${de.y}) ne borde pas l'arête ${arete.cle}`);
  }
  return { x: vers.x, y: vers.y, z: arete.z };
}

/**
 * Libellé JOUEUR d'un accès de pièce — SOURCE UNIQUE, celle que le peintre affiche en `aria-label` et
 * en `<title>` : six formes selon la nature de l'accès et le sens du franchissement.
 */
export const libellePortail = (portal: RoomPortal): PlayerText =>
  (portal.kind === 'door-closed'
    ? portal.exterior ? t('arete.porteExterieureFermee') : t('arete.porteFermee')
    : portal.exterior
      ? portal.fromZoneId === null ? t('arete.entreeInterieure') : t('arete.sortieExterieure')
      : portal.kind === 'door-open'
        ? t('arete.porteOuverte')
        : t('arete.passage'));

/** PORTES : accès du contrôleur, de la couche active, dont une extrémité est éclaircie. */
function portes(ctx: ContexteAretes): AreteUtilisable[] {
  if (!ctx.controleur) return [];
  const out: AreteUtilisable[] = [];
  for (const p of portalsForParty(ctx.scene, ctx.controleur)) {
    if (p.z !== ctx.activeZ) continue;
    const cle = (pt: Pt) => `${pt.x},${pt.y},${pt.z ?? p.z}`;
    if (!ctx.visible.has(cle(p.from)) && !ctx.visible.has(cle(p.to))) continue;
    out.push({
      cle: cleArete(p.edge.x, p.edge.y, p.edge.side, p.z),
      x: p.edge.x, y: p.edge.y, side: p.edge.side, z: p.z,
      capacite: 'porte',
      ancrage: { ...p.from, z: p.z },
      largeurPrise: LARGEUR_PRISE_ARETE.porte,
      libelle: libellePortail(p),
      portail: p,
    });
  }
  return out;
}

/** Un dénivelé du mobile, hors brouillard : l'arête qu'il lui offre sans son texte, la clé de message qui le dit
 *  et ses variables. */
interface Denivele {
  arete: Omit<AreteUtilisable, 'libelle'>;
  libelle: MsgKey;
  vars?: Record<string, number>;
}

/** Les segments grimpables (`climb`) de `scene`, par la clé `x,y,z` de chacune des deux cases qu'ils séparent, dans
 *  l'ordre du document. Mémoïsés par scène. */
const grimpablesParCase = memoByRef((scene: Scene): ReadonlyMap<string, WallSeg[]> => {
  const parCase = new Map<string, WallSeg[]>();
  for (const w of scene.walls ?? []) {
    if (!w.climb || (w.side !== 'N' && w.side !== 'E')) continue;
    for (const c of cotes(w.x, w.y, w.side)) {
      const k = `${c.x},${c.y},${w.z ?? 0}`;
      const bordants = parCase.get(k);
      if (bordants) bordants.push(w);
      else parCase.set(k, [w]);
    }
  }
  return parCase;
});

/**
 * Les DÉNIVELÉS du mobile posé en (x, y, z), hors brouillard. FRANCHISSEMENTS : ses quatre cardinaux, sondés par
 * `planFranchissement` — un plan `fall` (dénivelé descendant, croisée franchissable comprise) donne une CHUTE, un plan
 * `enjamber` (croisée franchissable de plain-pied) une FENÊTRE. ESCALADE : chaque arête `climb` de sa couche qu'il
 * BORDE ; on grimpe depuis sa case vers celle d'en face, le texte disant le sens du dénivelé.
 */
function denivelesDuMobile(scene: Scene, x: number, y: number, z: number): Denivele[] {
  const offre = (e: { x: number; y: number; side: WallSide }, capacite: CapaciteArete, libelle: MsgKey, vars?: Record<string, number>): Denivele => ({
    arete: { cle: cleArete(e.x, e.y, e.side, z), x: e.x, y: e.y, side: e.side, z, capacite, ancrage: { x, y, z }, largeurPrise: LARGEUR_PRISE_ARETE[capacite] },
    libelle,
    vars,
  });
  const out: Denivele[] = [];
  for (const [dx, dy] of CARDINAUX) {
    const e = edgeOf(x, y, x + dx, y + dy);
    if (!e) continue;
    const plan = planFranchissement(scene, { x, y, z }, { x: x + dx, y: y + dy, z });
    if (plan.kind === 'fall') out.push(offre(e, 'chute', 'arete.sauterEnBas', { m: Math.round(plan.metres) }));
    if (plan.kind === 'enjamber') out.push(offre(e, 'fenetre', 'arete.enjamberFenetre'));
  }
  for (const w of grimpablesParCase(scene).get(`${x},${y},${z}`) ?? []) {
    const [c1, c2] = cotes(w.x, w.y, w.side);
    const vers = c1.x === x && c1.y === y ? c2 : c1;
    const monte = heightAt(scene, vers.x, vers.y, z) > heightAt(scene, x, y, z);
    out.push(offre(w, 'escalade', monte ? 'arete.escalader' : 'arete.descendreEnEscalade'));
  }
  return out;
}

const denivelesParCase = memoByRef((_scene: Scene) => new Map<string, readonly Denivele[]>());

/** Les dénivelés du mobile posé en (x, y, z) (`denivelesDuMobile`) : ils ne tiennent qu'à la scène et à sa case, et
 *  se calculent une fois par scène et par case. */
function denivelesDe(scene: Scene, x: number, y: number, z: number): readonly Denivele[] {
  const parCase = denivelesParCase(scene);
  const k = `${x},${y},${z}`;
  let deniveles = parCase.get(k);
  if (!deniveles) parCase.set(k, (deniveles = denivelesDuMobile(scene, x, y, z)));
  return deniveles;
}

const casesADeniveleParCouche = memoByRef((_scene: Scene) => new Map<number, readonly { x: number; y: number }[]>());

/** Les cases de la couche `z` de `scene` d'où un mobile a un dénivelé (`denivelesDe`), rangée par rangée. Calculées
 *  une fois par scène et par couche. */
export function casesADenivele(scene: Scene, z: number): readonly { x: number; y: number }[] {
  const parCouche = casesADeniveleParCouche(scene);
  let cases = parCouche.get(z);
  if (!cases) {
    const { w, h } = scene.dimensions;
    const trouvees: { x: number; y: number }[] = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (denivelesDe(scene, x, y, z).length) trouvees.push({ x, y });
    parCouche.set(z, (cases = trouvees));
  }
  return cases;
}

/** DÉNIVELÉS de capacité `capacite` : ceux du contrôleur posé sur la couche active (`denivelesDe`) dont une des
 *  deux cases est éclaircie. */
const deniveles = (capacite: CapaciteArete) => ({ scene, visible, controleur, activeZ }: ContexteAretes): AreteUtilisable[] =>
  !controleur || (controleur.z ?? 0) !== activeZ
    ? []
    : denivelesDe(scene, controleur.x, controleur.y, activeZ)
      .filter(({ arete }) => arete.capacite === capacite && vue(visible, ...cotes(arete.x, arete.y, arete.side), activeZ))
      .map(({ arete, libelle, vars }) => ({ ...arete, ancrage: { ...arete.ancrage }, libelle: t(libelle, vars) }));

/** STRUCTURE (AA 10 l.94-102) : arête `structure` debout de la couche active, ENRÔLÉE dans la file de
 *  combat (le Combattant tient la cible ; à la brèche il disparaît et l'arête avec). Aucune garde
 *  d'adjacence — on la pilonne à distance. Le FRAPPEUR n'ouvre que l'OFFRE (sans héros en main, hors
 *  de mon tour, une enceinte ne se frappe pas) ; l'ANCRAGE est la case du MUR, celle du
 *  Combattant-structure : le geste d'une structure EST le clic de son jeton, et l'étage d'arête ne lui
 *  donne que la prise géométrique que le rayon ne rend pas (#1297). */
function structures(ctx: ContexteAretes): AreteUtilisable[] {
  const { scene, battle, activeZ } = ctx;
  if (!battle || !ctx.controleur) return [];
  const out: AreteUtilisable[] = [];
  for (const w of scene.walls ?? []) {
    if (!w.structure || (w.z ?? 0) !== activeZ || (w.side !== 'N' && w.side !== 'E')) continue;
    if (structureIsDown(scene, w) || porteMasquee(scene, w)) continue;
    const z = w.z ?? 0;
    const cid = `structure-${w.x}-${w.y}-${w.side}-${z}`;
    const sc = inBattleId(battle, cid);
    if (!sc) continue;
    const [c1, c2] = cotes(w.x, w.y, w.side);
    if (!vue(ctx.visible, c1, c2, z)) continue;
    out.push({
      cle: cleArete(w.x, w.y, w.side, z),
      x: w.x, y: w.y, side: w.side, z,
      capacite: 'structure',
      ancrage: { x: w.x, y: w.y, z },
      largeurPrise: LARGEUR_PRISE_ARETE.structure,
      libelle: nomDe(sc),
      cid,
    });
  }
  return out;
}

const DERIVEURS: Readonly<Record<CapaciteArete, (ctx: ContexteAretes) => AreteUtilisable[]>> = {
  structure: structures,
  chute: deniveles('chute'),
  fenetre: deniveles('fenetre'),
  escalade: deniveles('escalade'),
  porte: portes,
};

/**
 * Les arêtes utilisables du contexte, DANS L'ORDRE DE PRIORITÉ (`PRIORITE_ARETES`) : une arête qui
 * porte plusieurs capacités n'en rend qu'UNE, la plus forte — une enceinte enrôlée en combat se
 * frappe, elle ne s'ouvre pas. `capacites` borne la dérivation à celles qu'il nomme.
 */
export function aretesUtilisables(ctx: ContexteAretes, capacites: readonly CapaciteArete[] = PRIORITE_ARETES): AreteUtilisable[] {
  const out: AreteUtilisable[] = [];
  const prises = new Set<string>();
  for (const capacite of PRIORITE_ARETES) {
    if (!capacites.includes(capacite)) continue;
    for (const arete of DERIVEURS[capacite](ctx)) {
      if (prises.has(arete.cle)) continue;
      prises.add(arete.cle);
      out.push(arete);
    }
  }
  return out;
}

/** La capacité de l'arête que franchit le pas `de` → `vers` (case cardinale d'en face), telle que le dériveur la rend au
 *  mobile posé en `de`, à sa couche, sans brouillard ; `null` sans arête qui offre un geste. */
export function capaciteDuPas(scene: Scene, de: Pt, vers: Pt): CapaciteArete | null {
  const z = de.z ?? 0;
  const ctx: ContexteAretes = { scene, visible: new Set([`${de.x},${de.y},${z}`]), controleur: { ...de, z }, activeZ: z };
  const arete = aretesUtilisables(ctx).find((a) => {
    const [c1, c2] = cotes(a.x, a.y, a.side);
    const borde = (p: Pt, q: Pt) => p.x === de.x && p.y === de.y && q.x === vers.x && q.y === vers.y;
    return borde(c1, c2) || borde(c2, c1);
  });
  return arete?.capacite ?? null;
}
