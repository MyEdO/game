/**
 * LE POINTEUR DE L'ÉDITEUR DE CARTE (#3508) : appui, glissé et relâché d'un point de la carte, routés vers les
 * écrivains de `../sceneEdit` selon l'outil actif. PUR, sans hôte : l'éditeur web et l'éditeur Godot désignent la
 * carte par lui, chacun ne fournissant que le point visé. Chaque appel rend l'effet du geste (la scène écrite et
 * si elle ouvre un cran d'annulation, la sélection désignée, la case tracée d'une volée) et le geste en cours, que
 * l'hôte repasse au pas suivant.
 */
import { canonEdge, sceneMetresPerTile, type Scene, type CellSide } from '../monde/scene';
import { ancreDuDecor } from '../monde/footprint';
import { appliquerOutil, addFacadeSection, moveSel, poserLeDecorAuPoint, rectFrom, resizeSel, validerRectangle, type GesteDOutil, type Pt, type Rect } from '../sceneEdit';
import { caseDe } from '../../data/props.types';
import { dansLaCarte, empriseDuPinceau, hitAt, nearestEdge, pickArchitectureEdge, pickWallEdge, type Layers, type Sel, type Tool, FORMULAIRES } from '../sceneEditLecture';
import { provenanceDesNavires } from '../planDeNavire';
import { CADRE, type WorldMap } from '../worldMap';
import { deplacerPoi, majLieu } from '../worldMapEdit';
import { lieuNeuf, poiNeuf, routeLiee } from '../sceneEdit';

/** Ce que l'éditeur tient autour du geste : l'outil, la couche, le pinceau, la rencontre que l'outil de rencontre
 *  complète et la fiche qu'il pose, les calques visibles, la sélection, le rectangle du terrain, et le mode
 *  architecture (`null` hors de lui) avec la couche de ses arêtes, son action et son corps. */
export interface ContexteDuPointeur {
  tool: Tool;
  z: number;
  brush: number;
  encId: string;
  encRef: string;
  layers: Layers;
  sel: Sel;
  terrainRect: boolean;
  architecture: { z: number; action: 'selection' | 'facade'; bodyId: string | null } | null;
}

/** Un point du plan du document ouvert : la case visée et ses coordonnées fractionnaires de case. Sur la scène, le plan
 *  de `planDuPointeur` ; `f` est le point touché, sur la surface que le rayon frappe (le dessus d'une table) : c'est sa
 *  case, `caseDe(f)`, que désigne et où pose un geste d'entité, pas la case du triangle touché. Sur la carte du monde,
 *  le plan de l'élément `Plan` de l'éditeur, en unités de la position d'un lieu (`MapPlace.pos`, `BORNES_DE_CARTE`) :
 *  le point `(u, v)` du cadre du `Plan` (0..1 sur chaque axe, comme `PointDuPlan`) y vaut
 *  `f = (u, v) × UNITES_DU_PLAN_DE_CARTE`, sa case la partie entière. */
export interface PointDeCarte {
  case: Pt;
  f: Pt;
}

/** Le geste en cours entre l'appui et le relâché. `trait` : un pinceau, `cran` une fois sa première écriture faite,
 *  `trace` les cases que ses écritures ont couvertes ; `volee` : le tracé d'une volée, sa dernière case ;
 *  `rectangle` : un rectangle tiré depuis `depart` ; `deplacement` et `redimension` : la sélection `sel` qu'il
 *  déplace ou redimensionne, `deplace` une fois la scène écrite ; `deplacement` garde le point `depuis` de l'appui et,
 *  pour un décor, sa `prise` : l'écart de son ancre à ce point, que le glissé conserve. */
export type GesteEnCours =
  | { sorte: 'trait'; cran: boolean; trace: readonly Pt[] }
  | { sorte: 'volee'; dernier: Pt }
  | { sorte: 'rectangle'; depart: Pt; rect: Rect }
  | { sorte: 'deplacement'; sel: Sel; depuis: PointDeCarte; prise?: Pt; deplace: boolean }
  | { sorte: 'redimension'; sel: Sel; deplace: boolean }
  | GesteSurLaCarte;

/** Le geste en cours sur le plan de la carte du monde : `lieu`, le glissé du lieu `id` appuyé au point `depuis`,
 *  `deplace` une fois la carte écrite ; `liaison`, la route tirée depuis le lieu `depuis`, son bout au point `bout` ;
 *  `poi`, sur le plan d'un lieu, le glissé de son point d'intérêt `id`, comme celui d'un lieu. */
export type GesteSurLaCarte =
  | { sorte: 'lieu' | 'poi'; id: string; depuis: Pt; deplace: boolean }
  | { sorte: 'liaison'; depuis: string; bout: Pt };

/** L'effet d'un pas du pointeur. `scene` : la scène écrite, `cran` vrai quand elle ouvre un cran d'annulation,
 *  faux quand elle prolonge celui du geste ; `sel` (présente) : la sélection désignée, `null` pour aucune ; `encId` :
 *  la rencontre que l'outil de rencontre a complétée ; `volee` : la case que le tracé de volée bascule ;
 *  `architectureFinie` : l'action d'architecture est consommée. */
export interface EffetDuPointeur {
  geste: GesteEnCours | null;
  scene?: Scene;
  cran?: boolean;
  sel?: Sel;
  encId?: string;
  volee?: Pt;
  architectureFinie?: true;
}

const memeCase = (a: Pt, b: Pt) => a.x === b.x && a.y === b.y;

/** Distance (cases) sous laquelle un relâché reste un clic : la sélection ne bouge pas. */
const SEUIL_DU_GLISSE = 0.05;

/** La couche dont le plan porte le point du pointeur : celle des arêtes d'architecture en mode architecture, la
 *  couche éditée sinon. */
export function planDuPointeur(ctx: ContexteDuPointeur): number {
  return ctx.architecture?.z ?? ctx.z;
}

/** La case du point fractionnaire `f` et l'arête de cette case la plus proche de lui. */
function areteDuPoint(f: Pt): { p: Pt; side: CellSide } {
  const p = { x: Math.round(f.x), y: Math.round(f.y) };
  return { p, side: nearestEdge(f.x - p.x, f.y - p.y) };
}

/** L'arête canonique que l'outil murs viserait au point `pt` (cloison ou porte), `null` pour tout autre outil. */
export function areteVisee(ctx: ContexteDuPointeur, pt: PointDeCarte): { x: number; y: number; side: 'N' | 'E' } | null {
  if (ctx.tool.mode !== 'arete' || (ctx.tool.paint !== 'wall' && ctx.tool.paint !== 'door')) return null;
  const { p, side } = areteDuPoint(pt.f);
  return canonEdge(p.x, p.y, side);
}

const gesteDOutil = (ctx: ContexteDuPointeur): GesteDOutil => ({ z: ctx.z, brush: ctx.brush, encId: ctx.encId, encRef: ctx.encRef });

/** Un pas de pinceau à la case `p` : la gomme ouvre un cran par écriture, les autres pinceaux un seul pour le trait.
 *  Le trait trace l'emprise du pinceau des outils qui la peignent, la seule case `p` de la gomme et des cases d'une
 *  zone. */
function peindre(scene: Scene, ctx: ContexteDuPointeur, trait: Extract<GesteEnCours, { sorte: 'trait' }>, p: Pt): EffetDuPointeur {
  if (trait.trace.some((t) => memeCase(t, p))) return { geste: trait };
  const out = appliquerOutil(scene, ctx.tool, p, gesteDOutil(ctx));
  if (!out || out.scene === scene) return { geste: trait };
  const emprise = ctx.tool.mode === 'gomme' || ctx.tool.mode === 'casesDeZone' ? 1 : ctx.brush;
  const trace = [...trait.trace, ...empriseDuPinceau(scene.dimensions, p, emprise).filter((c) => !trait.trace.some((t) => memeCase(t, c)))];
  return { geste: { sorte: 'trait', cran: true, trace }, scene: out.scene, cran: ctx.tool.mode === 'gomme' || !trait.cran };
}

const rectangle = (p: Pt): EffetDuPointeur => ({ geste: { sorte: 'rectangle', depart: p, rect: { x: p.x, y: p.y, w: 1, h: 1 } } });

/** L'appui de l'outil de sélection : une façade sous le point, la façade posée sur l'arête en action « façade », la
 *  chose désignée sous la case en mode architecture ; hors de lui, une arête de mur proche l'emporte sur la case. Une
 *  chose désignée sous la case ouvre son déplacement ; sans elle, une case des ponts d'un navire désigne son entité
 *  (`provenanceDesNavires`), sans la déplacer. */
function selectionner(scene: Scene, ctx: ContexteDuPointeur, pt: PointDeCarte): EffetDuPointeur {
  const a = ctx.architecture;
  if (a) {
    const facade = pickArchitectureEdge(scene, pt.f.x, pt.f.y, a.z);
    if (facade) return { geste: null, sel: facade, architectureFinie: true };
    if (a.action === 'facade' && a.bodyId) {
      const { p, side } = areteDuPoint(pt.f);
      const out = addFacadeSection(scene, a.bodyId, { ...canonEdge(p.x, p.y, side), ...(a.z ? { z: a.z } : {}) });
      return out
        ? { geste: null, scene: out.scene, cran: true, sel: { type: 'facadeSection', bodyId: a.bodyId, id: out.id }, architectureFinie: true }
        : { geste: null, architectureFinie: true };
    }
  } else {
    const mur = pickWallEdge(scene, pt.f.x, pt.f.y, ctx.z);
    if (mur) return { geste: null, sel: { type: 'wall', x: mur.x, y: mur.y, side: mur.side, z: ctx.z } };
  }
  const p = caseDe(pt.f.x, pt.f.y);
  const sel = hitAt(scene, p, ctx.layers, ctx.z, a?.bodyId ?? undefined, pt.f);
  if (!sel) {
    const navire = provenanceDesNavires(scene).cases.get(`${p.x},${p.y},${ctx.z}`);
    return { geste: null, sel: navire === undefined ? null : { type: 'entity', id: navire } };
  }
  const decor = decorDeLaSelection(scene, sel);
  const ancre = decor && ancreDuDecor(scene.entities.find((e) => e.id === decor)!, sceneMetresPerTile(scene));
  const prise = ancre && { x: ancre.x - pt.f.x, y: ancre.y - pt.f.y };
  return { geste: { sorte: 'deplacement', sel, depuis: pt, ...(prise ? { prise } : {}), deplace: false }, sel };
}

/** L'appui au point `pt`. */
export function appuyer(scene: Scene, ctx: ContexteDuPointeur, pt: PointDeCarte): EffetDuPointeur {
  const p = pt.case;
  if (!dansLaCarte(scene, p)) return { geste: null };
  const tool = ctx.tool;
  switch (tool.mode) {
    case 'selection':
      return selectionner(scene, ctx, pt);
    case 'terrain':
      return ctx.terrainRect ? rectangle(p) : peindre(scene, ctx, { sorte: 'trait', cran: false, trace: [] }, p);
    case 'zone':
      return rectangle(p);
    case 'casesDeZone':
    case 'hauteur':
    case 'crenelage':
    case 'gomme':
      return peindre(scene, ctx, { sorte: 'trait', cran: false, trace: [] }, p);
    case 'escalier':
      return { geste: { sorte: 'volee', dernier: p }, volee: p };
    case 'entite':
    case 'emplacement':
    case 'entree':
    case 'rencontre':
    case 'arete': {
      const cible = tool.mode === 'arete' ? areteDuPoint(pt.f) : { p: caseDe(pt.f.x, pt.f.y), side: undefined };
      const out = appliquerOutil(scene, tool, cible.p, { ...gesteDOutil(ctx), side: cible.side, point: pt.f });
      if (!out) return { geste: null };
      return {
        geste: null,
        ...(out.scene !== scene ? { scene: out.scene, cran: true } : {}),
        ...(out.encId && out.encId !== ctx.encId ? { encId: out.encId } : {}),
        ...(out.sel ? { sel: out.sel } : {}),
      };
    }
  }
}

/** La saisie de la poignée de redimensionnement de la sélection. */
export function saisirLaPoignee(ctx: ContexteDuPointeur): GesteEnCours {
  return { sorte: 'redimension', sel: ctx.sel, deplace: false };
}

/** Le glissé du geste `geste` au point `pt` : le même pas qu'à l'appui pour un pinceau, le rectangle étiré, la
 *  sélection déplacée ou redimensionnée (un cran au premier pas réel), la case suivante d'une volée. */
export function glisser(scene: Scene, ctx: ContexteDuPointeur, geste: GesteEnCours | null, pt: PointDeCarte): EffetDuPointeur {
  const p = pt.case;
  if (!geste) return { geste: null };
  switch (geste.sorte) {
    case 'trait':
      return peindre(scene, ctx, geste, p);
    case 'rectangle':
      return { geste: { ...geste, rect: rectFrom(geste.depart, p) } };
    case 'volee':
      return !dansLaCarte(scene, p) || memeCase(p, geste.dernier) ? { geste } : { geste: { sorte: 'volee', dernier: p }, volee: p };
    case 'deplacement':
      if (!geste.deplace && memeCase(p, geste.depuis.case)) return { geste };
      return deplacer(scene, geste, pt);
    case 'redimension':
      return { geste: { ...geste, deplace: true }, scene: resizeSel(scene, geste.sel, p), cran: !geste.deplace };
    case 'lieu':
    case 'poi':
    case 'liaison':
      return { geste };
  }
}

/** L'id du décor que la sélection désigne, `undefined` pour toute autre sélection. */
function decorDeLaSelection(scene: Scene, sel: Sel): string | undefined {
  return sel?.type === 'entity' && scene.entities.some((e) => e.id === sel.id && e.kind === 'prop') ? sel.id : undefined;
}

/** Le pas d'un déplacement au point `pt` : un décor se pose au point (`poserLeDecorAuPoint` : case, calage, appui),
 *  toute autre sélection à la case ; un cran au premier pas réel. */
function deplacer(scene: Scene, geste: Extract<GesteEnCours, { sorte: 'deplacement' }>, pt: PointDeCarte): EffetDuPointeur {
  const decor = decorDeLaSelection(scene, geste.sel);
  const prise = geste.prise ?? { x: 0, y: 0 };
  const scenePosee = decor ? poserLeDecorAuPoint(scene, decor, { x: pt.f.x + prise.x, y: pt.f.y + prise.y }) : moveSel(scene, geste.sel, pt.case);
  return { geste: { ...geste, deplace: true }, scene: scenePosee, cran: !geste.deplace };
}

/** Le relâché du geste `geste` au point `pt` : un rectangle se valide (zone ou terrain), un décor déplacé se pose au
 *  point du relâché (l'hôte ne rend un glissé qu'au changement de case), tout autre geste finit. */
export function relacher(scene: Scene, ctx: ContexteDuPointeur, geste: GesteEnCours | null, pt: PointDeCarte): EffetDuPointeur {
  if (geste?.sorte === 'deplacement') {
    const bouge = geste.deplace || Math.hypot(pt.f.x - geste.depuis.f.x, pt.f.y - geste.depuis.f.y) >= SEUIL_DU_GLISSE;
    if (!decorDeLaSelection(scene, geste.sel) || !bouge) return { geste: null };
    const effet = deplacer(scene, geste, pt);
    return { geste: null, ...(effet.scene !== scene ? { scene: effet.scene, cran: effet.cran } : {}) };
  }
  if (geste?.sorte !== 'rectangle') return { geste: null };
  const out = validerRectangle(scene, ctx.tool, rectFrom(geste.depart, pt.case), ctx.z);
  return out ? { geste: null, scene: out.scene, cran: true, ...(out.sel ? { sel: out.sel } : {}) } : { geste: null };
}

/** L'effet d'un pas du pointeur sur le plan de la carte du monde : la carte écrite, `cran` vrai quand elle ouvre un cran
 *  d'annulation ; la sélection désignée (présente), `null` pour aucune. */
export interface EffetSurLaCarte {
  geste: GesteEnCours | null;
  carte?: WorldMap;
  cran?: boolean;
  sel?: Sel;
}

/** Les outils du pointeur sur la carte du monde : sélectionner un lieu ou une route (et glisser le lieu), poser un lieu
 *  sur le fond, tirer une route d'un lieu à un autre. */
export const OUTILS_DE_LA_CARTE = ['selection', 'lieu', 'chemin'] as const;
export type OutilDeLaCarte = (typeof OUTILS_DE_LA_CARTE)[number];

/** Le rayon, en unités du cadre de la carte (`CADRE`), sous lequel un point touche un lieu (l'anneau de sélection de son
 *  médaillon), et la demi-largeur du trait où il touche une route. */
const RAYON_DU_LIEU = 2.1;
const DEMI_TRAIT_DE_ROUTE = 1.5;

/** Les unités de la position d'un lieu (`MapPlace.pos`, en % du cadre) que vaut le côté du cadre de l'élément `Plan`
 *  (0..1 sur chaque axe) : le point `(u, v)` de ce cadre est la position `(u, v) × UNITES_DU_PLAN_DE_CARTE`. */
export const UNITES_DU_PLAN_DE_CARTE = 100;

/** La sélection du lieu ou de la route `id`, du type que déclare son porteur (`FORMULAIRES`, `sel`). */
const selDuLieu = (id: string): Sel => ({ type: FORMULAIRES.lieu.sel!, id });
const selDeLaRoute = (id: string): Sel => ({ type: FORMULAIRES.route.sel!, id });

/** Le point `p` en unités de la position d'un lieu, porté au cadre de la carte (`CADRE`), où les distances se mesurent. */
const auCadre = (p: Pt): Pt => ({ x: (p.x * CADRE.w) / UNITES_DU_PLAN_DE_CARTE, y: (p.y * CADRE.h) / UNITES_DU_PLAN_DE_CARTE });

/** Celui des `points` que touche le point `f`, le plus proche : un lieu de la carte, un point d'intérêt du plan d'un
 *  lieu, dont les médaillons ont la même taille. */
function pointSous<P extends { pos: Pt }>(points: readonly P[], f: Pt): P | undefined {
  const c = auCadre(f);
  const distance = (pos: Pt) => { const q = auCadre(pos); return Math.hypot(q.x - c.x, q.y - c.y); };
  return points.filter((p) => distance(p.pos) <= RAYON_DU_LIEU).sort((a, b) => distance(a.pos) - distance(b.pos))[0];
}

/** Le lieu de la carte `carte` que touche le point `f`, le plus proche. */
const lieuSous = (carte: WorldMap, f: Pt) => pointSous(carte.places, f);

/** La route de la carte `carte` dont le trait touche le point `f`, la plus proche. */
function routeSous(carte: WorldMap, f: Pt): WorldMap['routes'][number] | undefined {
  const c = auCadre(f);
  const distance = (r: WorldMap['routes'][number]) => {
    const a = carte.places.find((p) => p.id === r.a.id);
    const b = carte.places.find((p) => p.id === r.b.id);
    if (!a || !b) return Infinity;
    const pa = auCadre(a.pos), pb = auCadre(b.pos);
    const l2 = (pb.x - pa.x) ** 2 + (pb.y - pa.y) ** 2;
    const t = l2 ? Math.max(0, Math.min(1, ((c.x - pa.x) * (pb.x - pa.x) + (c.y - pa.y) * (pb.y - pa.y)) / l2)) : 0;
    return Math.hypot(pa.x + t * (pb.x - pa.x) - c.x, pa.y + t * (pb.y - pa.y) - c.y);
  };
  return carte.routes.filter((r) => distance(r) <= DEMI_TRAIT_DE_ROUTE).sort((a, b) => distance(a) - distance(b))[0];
}

/** L'appui au point `pt` du plan de la carte `carte`, à l'outil `outil` (`OUTILS_DE_LA_CARTE`), les lieux neufs liés à
 *  la première des scènes `scenes` : un lieu touché se sélectionne et ouvre son glissé, sauf à l'outil chemin, où il
 *  ouvre la route tirée depuis lui ; hors d'un lieu, la sélection désigne la route touchée (ou rien), l'outil lieu pose un
 *  lieu neuf au point, sélectionné (`lieuNeuf`), l'outil chemin ne fait rien. Un autre outil ne fait rien. */
export function appuyerSurLaCarte(carte: WorldMap, scenes: readonly { id: string }[], outil: string, pt: PointDeCarte): EffetSurLaCarte {
  const lieu = lieuSous(carte, pt.f);
  if (lieu) {
    const sel = selDuLieu(lieu.id);
    if (outil === 'chemin') return { geste: { sorte: 'liaison', depuis: lieu.id, bout: pt.f }, sel };
    return OUTILS_DE_LA_CARTE.includes(outil as OutilDeLaCarte) ? { geste: { sorte: 'lieu', id: lieu.id, depuis: pt.f, deplace: false }, sel } : { geste: null };
  }
  if (outil === 'selection') {
    const route = routeSous(carte, pt.f);
    return { geste: null, sel: route ? selDeLaRoute(route.id) : null };
  }
  if (outil !== 'lieu') return { geste: null };
  const pose = lieuNeuf(carte, pt.f, scenes);
  return { geste: null, carte: pose.carte, cran: true, sel: selDuLieu(pose.id) };
}

/** Le glissé du geste `geste` au point `pt` du plan de la carte `carte` : le lieu glissé posé au point (`majLieu`, borné),
 *  un cran au premier pas réel, hors de la case de son appui ; le bout de la route tirée suit le point. */
export function glisserSurLaCarte(carte: WorldMap, geste: GesteEnCours | null, pt: PointDeCarte): EffetSurLaCarte {
  if (geste?.sorte === 'liaison') return { geste: { ...geste, bout: pt.f } };
  if (geste?.sorte !== 'lieu') return { geste };
  if (!geste.deplace && memeCase(pt.case, { x: Math.floor(geste.depuis.x), y: Math.floor(geste.depuis.y) })) return { geste };
  return { geste: { ...geste, deplace: true }, carte: majLieu(carte, geste.id, { pos: pt.f }), cran: !geste.deplace };
}

/** L'effet d'un pas du pointeur sur le plan d'un lieu de la carte du monde (`EffetSurLaCarte`), et le point d'intérêt
 *  qu'il désigne (présent), `null` pour aucun. */
export interface EffetSurLePlanDuLieu extends Omit<EffetSurLaCarte, 'sel'> {
  poi?: string | null;
}

/** Les outils du pointeur sur le plan d'un lieu : sélectionner un point d'intérêt (et le glisser), en poser un sur le
 *  fond (épingler). */
export const OUTILS_DU_PLAN_DU_LIEU = ['selection', 'epingler'] as const;
export type OutilDuPlanDuLieu = (typeof OUTILS_DU_PLAN_DU_LIEU)[number];

/** L'appui au point `pt` du plan du lieu `lieu` de la carte `carte`, à l'outil `outil` (`OUTILS_DU_PLAN_DU_LIEU`), les
 *  points neufs menant à la première des scènes `scenes` : un point d'intérêt touché se désigne et ouvre son glissé ;
 *  hors d'eux, l'outil epingler pose un point neuf au point, désigné (`poiNeuf`), la sélection n'en désigne aucun. Un autre
 *  outil ne fait rien. */
export function appuyerSurLePlanDuLieu(carte: WorldMap, lieu: string, scenes: Parameters<typeof poiNeuf>[3], outil: string, pt: PointDeCarte): EffetSurLePlanDuLieu {
  if (!OUTILS_DU_PLAN_DU_LIEU.includes(outil as OutilDuPlanDuLieu)) return { geste: null };
  const touche = pointSous(carte.places.find((p) => p.id === lieu)?.poi ?? [], pt.f);
  if (touche) return { geste: { sorte: 'poi', id: touche.id, depuis: pt.f, deplace: false }, poi: touche.id };
  const pose = outil === 'epingler' ? poiNeuf(carte, lieu, pt.f, scenes) : undefined;
  return pose ? { geste: null, carte: pose.carte, cran: true, poi: pose.id } : { geste: null, poi: null };
}

/** Le glissé du geste `geste` au point `pt` du plan du lieu `lieu` de la carte `carte` : le point d'intérêt glissé posé
 *  au point (`deplacerPoi`, borné), un cran au premier pas réel, hors de la case de son appui. */
export function glisserSurLePlanDuLieu(carte: WorldMap, lieu: string, geste: GesteEnCours | null, pt: PointDeCarte): EffetSurLePlanDuLieu {
  if (geste?.sorte !== 'poi') return { geste };
  if (!geste.deplace && memeCase(pt.case, { x: Math.floor(geste.depuis.x), y: Math.floor(geste.depuis.y) })) return { geste };
  return { geste: { ...geste, deplace: true }, carte: deplacerPoi(carte, lieu, geste.id, pt.f), cran: !geste.deplace };
}

/** Le relâché du geste `geste` au point `pt` du plan de la carte `carte` : la route tirée relie son lieu de départ au lieu
 *  touché (`routeLiee`, refusée comme `lierLieux`), sélectionnée, sur un cran ; tout autre geste finit. */
export function relacherSurLaCarte(carte: WorldMap, geste: GesteEnCours | null, pt: PointDeCarte): EffetSurLaCarte {
  if (geste?.sorte !== 'liaison') return { geste: null };
  const vers = lieuSous(carte, pt.f);
  const liee = vers && routeLiee(carte, geste.depuis, vers.id);
  return liee ? { geste: null, carte: liee.carte, cran: true, sel: selDeLaRoute(liee.id) } : { geste: null };
}
