/**
 * ARÊTES UTILISABLES — dériveur UNIQUE de ce qu'une ARÊTE de scène offre au joueur (#1687, lot 1b-1).
 *
 * Jumeau de `state/usable.ts` (lot 2) pour les arêtes : là où `actionsDe` dérive les actions d'une
 * ENTITÉ, `aretesUtilisables` dérive les gestes portés par les arêtes — franchir une porte, grimper,
 * sauter en bas, frapper une fortification. Une capacité N+1 = une fonction interne et une ligne de
 * `PRIORITE_ARETES`.
 *
 * PUR et FEUILLE : aucune lecture de store, aucune géométrie d'écran (`tileEdge` reste chez l'hôte),
 * aucun libellé en dur (`t()`/`MsgKey`, ou le `label` du Combattant pour une structure). Le CONTEXTE
 * (brouillard, contrôleur, couche active, combat, accès de pièce) est FOURNI par l'appelant.
 *
 * PORTEUR UNIQUE CÔTÉ HÔTE (lot 1b-3) : les quatre capacités reçoivent le MÊME mobile — le groupe hors
 * combat, le héros actif quand c'est mon tour (`ContexteAretes.controleur` = `doorCtrls[0] ?? null`,
 * `gameIso/stage/MondeDeCampagne.tsx`, cardinal ≤ 1). L'unité du porteur est le contrat : deux
 * capacités qui répondraient à deux mobiles différents offriraient deux gestes sur la même arête.
 *
 * Les divergences que ce module a HÉRITÉES des quatre overlays d'origine et qui vivent encore :
 *  (a) INTERROGATION DU PORTEUR — les deux capacités de dénivelé ne lisent pas le même mobile de la
 *      même façon : l'escalade exige qu'il BORDE l'arête (`escalades`), la chute sonde ses quatre
 *      cardinaux (`chutes`) ; la structure, elle, ne l'interroge pas du tout — on pilonne à distance,
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
 * PORTES : la liste vient de `portalsForParty` (`roomPortals.ts`), CALCULÉE PAR L'HÔTE et passée en
 * `portails` — la recalculer ici exigerait `occupiedInteriorZoneIds`, qui vit dans
 * `gameIso/stage/roomFocus.ts`, et la frontière `src/state ↛ src/gameIso` ne connaît aucune exception
 * (`state/devtools.ts:9`).
 */
import { t } from '../i18n';
import { heightAt, edgeOf, structureIsDown, type Scene, type WallSide } from './scene';
import { cleArete } from './wallIndex';
import { planFall } from './fallMove';
import { inBattleId } from './combatants';
import type { RoomPortal } from './roomPortals';
import type { Pt } from './path';
import type { BattleState } from './store';

/** Ce qu'une arête OFFRE. Identité STABLE (le libellé est de l'affichage). */
export type CapaciteArete = 'structure' | 'chute' | 'escalade' | 'porte';

/**
 * PRIORITÉ entre capacités sur une MÊME arête, du plus fort au plus faible. Elle est ÉCRITE ici et
 * nulle part ailleurs : ni l'ordre de peinture ni l'ordre d'un `if` ne la disent. L'ordre de la liste
 * rendue par `aretesUtilisables` EST cette priorité, et la chaîne de picking la relit à égalité de
 * distance (`stage/pickResolve.ts:areteSousLePixel`).
 */
export const PRIORITE_ARETES: readonly CapaciteArete[] = ['structure', 'chute', 'escalade', 'porte'];

/**
 * Largeur PLEINE du trait offert au geste, en pixels, PAR capacité : 28 pour un seuil, 9 pour les
 * traits d'escalade et de chute, 16 pour une structure ; le rayon de prise vaut la moitié, et le
 * peintre trace à cette même largeur. Donnée du dériveur : un 28 uniforme ferait mordre les gestes les
 * uns sur les autres.
 */
export const LARGEUR_PRISE_ARETE: Readonly<Record<CapaciteArete, number>> = {
  structure: 16,
  chute: 9,
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
   *  (`state/combatSlice.ts`, `c.pos = { x: w.x, y: w.y }`), d'où la prise se projette AU LIFT DU MUR
   *  et le survol tombe sur le jeton visé. TOUJOURS posée : une arête sans case à viser n'est pas une
   *  offre, et les quatre dériveurs la construisent avant de rendre l'offre. */
  ancrage: Pt;
  /** Largeur pleine du trait de prise, en pixels (`LARGEUR_PRISE_ARETE`). */
  largeurPrise: number;
  /** Texte JOUEUR déjà résolu. */
  libelle: string;
  /** Combattant-structure visé par le geste de siège (`battleClickEntity`). */
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
  /** Groupe hors combat, héros actif si c'est mon tour, `null` sinon
   *  (`gameIso/stage/MondeDeCampagne.tsx`, `doorCtrls`) — le MÊME porteur pour les quatre capacités. */
  controleur: Pt | null;
  activeZ: number;
  battle?: BattleState | null;
  /** Accès de pièce du contrôleur (`portalsForParty`), calculés par l'hôte. */
  portails?: readonly RoomPortal[];
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
 * dirait deux fois la même géométrie. TOUJOURS définie : les quatre dériveurs ancrent sur l'un des
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
export const libellePortail = (portal: RoomPortal): string =>
  (portal.kind === 'door-closed'
    ? portal.exterior ? t('arete.porteExterieureFermee') : t('arete.porteFermee')
    : portal.exterior
      ? portal.fromZoneId === null ? t('arete.entreeInterieure') : t('arete.sortieExterieure')
      : portal.kind === 'door-open'
        ? t('arete.porteOuverte')
        : t('arete.passage'));

/** PORTES : accès de la couche active dont une extrémité est éclaircie. */
function portes(ctx: ContexteAretes): AreteUtilisable[] {
  const out: AreteUtilisable[] = [];
  for (const p of ctx.portails ?? []) {
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

/** ESCALADE : arête `climb` de la couche active que le mobile BORDE ; on grimpe depuis sa case vers
 *  celle d'en face, le libellé disant le sens du dénivelé. */
function escalades(ctx: ContexteAretes): AreteUtilisable[] {
  const { scene, controleur, activeZ } = ctx;
  if (!controleur) return [];
  const sur = (c: Pt) => controleur.x === c.x && controleur.y === c.y && (controleur.z ?? 0) === activeZ;
  const out: AreteUtilisable[] = [];
  for (const w of scene.walls ?? []) {
    if (!w.climb || (w.z ?? 0) !== activeZ || (w.side !== 'N' && w.side !== 'E')) continue;
    const z = w.z ?? 0;
    const [c1, c2] = cotes(w.x, w.y, w.side);
    if (!vue(ctx.visible, c1, c2, z)) continue;
    if (!sur(c1) && !sur(c2)) continue;
    const from = sur(c1) ? c1 : c2;
    const to = sur(c1) ? c2 : c1;
    const monte = heightAt(scene, to.x, to.y, z) > heightAt(scene, from.x, from.y, z);
    out.push({
      cle: cleArete(w.x, w.y, w.side, z),
      x: w.x, y: w.y, side: w.side, z,
      capacite: 'escalade',
      ancrage: { x: from.x, y: from.y, z },
      largeurPrise: LARGEUR_PRISE_ARETE.escalade,
      libelle: monte ? t('arete.escalader') : t('arete.descendreEnEscalade'),
    });
  }
  return out;
}

/** CHUTE : les quatre cardinaux du mobile de la couche active, sondés par `planFall` ; seul un plan
 *  `fall` (dénivelé descendant sans arête grimpable) donne une arête. */
function chutes(ctx: ContexteAretes): AreteUtilisable[] {
  const { scene, controleur, activeZ } = ctx;
  if (!controleur || (controleur.z ?? 0) !== activeZ) return [];
  const out: AreteUtilisable[] = [];
  for (const [dx, dy] of CARDINAUX) {
    const to: Pt = { x: controleur.x + dx, y: controleur.y + dy, z: controleur.z };
    const plan = planFall(scene, controleur, to);
    if (plan.kind !== 'fall') continue;
    if (!vue(ctx.visible, controleur, to, activeZ)) continue;
    const e = edgeOf(controleur.x, controleur.y, to.x, to.y);
    if (!e) continue;
    out.push({
      cle: cleArete(e.x, e.y, e.side, activeZ),
      x: e.x, y: e.y, side: e.side, z: activeZ,
      capacite: 'chute',
      ancrage: controleur,
      largeurPrise: LARGEUR_PRISE_ARETE.chute,
      libelle: t('arete.sauterEnBas', { m: Math.round(plan.metres) }),
    });
  }
  return out;
}

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
    if (structureIsDown(scene, w)) continue;
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
      libelle: sc.label,
      cid,
    });
  }
  return out;
}

const DERIVEURS: Readonly<Record<CapaciteArete, (ctx: ContexteAretes) => AreteUtilisable[]>> = {
  structure: structures,
  chute: chutes,
  escalade: escalades,
  porte: portes,
};

/**
 * Les arêtes utilisables du contexte, DANS L'ORDRE DE PRIORITÉ (`PRIORITE_ARETES`) : une arête qui
 * porte plusieurs capacités n'en rend qu'UNE, la plus forte — une enceinte enrôlée en combat se
 * frappe, elle ne s'ouvre pas.
 */
export function aretesUtilisables(ctx: ContexteAretes): AreteUtilisable[] {
  const out: AreteUtilisable[] = [];
  const prises = new Set<string>();
  for (const capacite of PRIORITE_ARETES) {
    for (const arete of DERIVEURS[capacite](ctx)) {
      if (prises.has(arete.cle)) continue;
      prises.add(arete.cle);
      out.push(arete);
    }
  }
  return out;
}
