/**
 * Couche STATIQUE des MURS AU TRAIT : les éléments du builder (`builders/walls`, camera-free) projetés
 * en trait symbolique par le peintre `authoring/wallsSvg`, puis triés par `stage/objs`.
 *
 * UNE SEULE COUCHE POUR LES DEUX VUES DU DESSUS (#1176 P3-5b) : le PLAN DE STATION
 * (`gameIso/TopoScene`) et la vue du dessus de JEU (`SurcoucheIso`, verdict `mursAuTrait` de
 * `stage/viewPolicy`) la montent toutes deux — elles ne diffèrent que par le brouillard, un argument.
 * Vu à la verticale, la coiffe d'un mur volumique tombe sous le pixel (mesure au JSDoc de
 * `stage/planSnapshot.ts`), là où le trait est invariant d'échelle — la MATIÈRE vient du monde cuit,
 * la STRUCTURE du trait.
 *
 * C'est tout ce qui reste de l'assemblage de couches SVG : la voie de JEU affine est morte
 * (#1176 P3-4, commit C5a), et avec elle les sols et les toits projetés (`floorLayerObjs`/
 * `roofLayerObjs`), qui n'avaient plus de consommateur.
 * Fonctions PURES.
 */
import { depth, projectOccluder, tileEdge, type Dims, type EdgeSide } from '../../geometry/iso';
import { liftDe, tileAt } from '../../state/scene';
import { areteCanonique, cleArete } from '../../geometry/arete';
import { terrainSolidHeightM } from '../../state/terrain';
import { memoByRefDeps } from '../../state/sceneMemo';
import { panelOf } from './occluders';
import { wallSvg, wallAccentsSvg, wallDepth, solidEdgeTopSvg } from '../authoring/wallsSvg';
import type { DetailOpts } from '../authoring/detailSvg';
import { buildWalls } from '../builders/walls';
import type { WallEl } from '../builders/types';
import { sortByDepth, type StageObj } from './objs';
import type { Scene } from '../../state/scene';

/**
 * PROJECTION MÉMOÏSÉE PAR ÉLÉMENT (#808) : identité d'élément inchangée ET mêmes paramètres de
 * projection ⇒ MÊME `StageObj`. Aucune invalidation manuelle — les paramètres sont COMPARÉS, jamais
 * notifiés. UNE seule variante est retenue par élément (la dernière) : une rotation/un zoom change les
 * paramètres pour TOUS les éléments à la fois, donc en garder plusieurs n'éviterait aucun recalcul et
 * ferait enfler la mémoire (le thunk `svg` retient sa chaîne SVG).
 *
 * Sûr parce qu'un `StageObj` n'est JAMAIS muté après construction — le partager entre deux rendus ne
 * peut donc rien faire dériver.
 */
const wallProjected = memoByRefDeps<WallEl, StageObj>();

/** Murs sur arêtes (cloisons fines) : faces du builder projetées par le backend affine, fusionnées dans
 *  le tri. ACCENTS (LOD 2) : thunk paresseux, étendu APRÈS le culling écran puis mis en cache. */
export function wallLayerObjs(wallEls: WallEl[], d: Dims, lod: number, detailOpts: DetailOpts, lazySvg = false): StageObj[] {
  return wallEls.map((el) => wallProjected(el, [d, detailOpts, lod, lazySvg], () => {
    let svgCache: string | null = null;
    const svg = () => (svgCache ??= wallSvg(el, d, detailOpts));
    let accCache: string | null = null;
    const acc = lod === 2 ? () => (accCache ??= wallAccentsSvg(el, d, detailOpts)) : undefined;
    const occluder = projectOccluder(panelOf(el.faces), d);
    return {
      d: wallDepth(el, d),
      x: el.cell.x,
      y: el.cell.y,
      z: el.cell.z,
      kind: 'wall',
      ...(el.side === 'N' || el.side === 'E' ? { side: el.side } : {}),
      ...(el.roomZoneIds ? { roomZoneIds: el.roomZoneIds } : {}),
      bounds: occluder.bounds,
      vis: el.states.visible,
      ...(lazySvg ? { svg } : {}),
      ...(acc ? { acc } : {}),
      el: <g
        key={el.key}
        {...(lazySvg ? {} : { dangerouslySetInnerHTML: { __html: svg() } })}
      />,
    };
  }));
}

/** LOD 0 (aplats, aucun motif) — une structure au trait veut la silhouette symbolique, pas le détail. */
const TRAIT_LOD: DetailOpts = { zoom: 0.4 };

/** Les quatre arêtes cardinales d'une case, avec le pas vers la case qu'elles bordent. */
const ARETES: readonly [EdgeSide, number, number][] = [['N', 0, -1], ['E', 1, 0], ['S', 0, 1], ['O', -1, 0]];

/** Surélévation de TRI du trait de tuile : la même que celle d'un mur sur arête en vue du dessus
 *  (`wallDepth` — 0,45 de mur, +0,6 de vue du dessus), pour que les deux formes d'obstacle s'entremêlent
 *  dans un seul tri au lieu de se recouvrir par famille. */
const TRAIT_D = 0.45 + 0.6;

/**
 * Traits de FRONTIÈRE des TUILES À BLOC PLEIN de l'étage `z` (terrain à `solidHeightM > 0` — le
 * prédicat vient du registre de terrain, jamais d'une liste d'ids recopiée).
 *
 * CONTOUR DU GROUPE, pas un carré par tuile : une arête n'est tracée que si la case d'en face n'est PAS
 * pleine — les arêtes INTERNES d'un muret contigu ne se dessinent pas, sans quoi un muret de quatre
 * cases se lirait comme quatre pièces. Hors carte, `tileAt` rend un « mur » implicite (bord de scène) :
 * une tuile pleine collée au bord ne trace donc pas son arête extérieure, ce qui est la même
 * convention que le reste du rendu. PURE.
 */
function solidTileTraitObjs(scene: Scene, dims: Dims, z: number, visible?: ReadonlySet<string>): StageObj[] {
  const { w, h } = scene.dimensions;
  const plein = (x: number, y: number) => terrainSolidHeightM(tileAt(scene, x, y, z)) > 0;
  const out: StageObj[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!plein(x, y)) continue;
    if (visible && !visible.has(`${x},${y},${z}`)) continue;
    const lift = liftDe(scene, { x, y, z });
    for (const [side, dx, dy] of ARETES) {
      if (plein(x + dx, y + dy)) continue;
      const arete = areteCanonique(x, y, side);
      const [a, b] = tileEdge(x, y, side, dims, lift);
      const svg = solidEdgeTopSvg([a.cx, a.cy], [b.cx, b.cy]);
      out.push({
        d: depth(x, y, dims, z) + TRAIT_D,
        x, y, z,
        kind: 'wall',
        el: <g key={`bloc-${cleArete(arete.x, arete.y, arete.side, z)}`} dangerouslySetInnerHTML={{ __html: svg }} />,
      });
    }
  }
  return out;
}

/**
 * La STRUCTURE d'un étage, au trait, prête à monter dans un SVG : les murs de l'étage `z` (isolement
 * d'un étage, `viewZ` du builder — sans lui les murs de tous les niveaux se superposent), projetés et
 * PRÉ-TRIÉS. `visible` = le brouillard de guerre du jeu ; absent (plan de station, éditeur) ⇒ tout est
 * vu. Un mur que le brouillard cache n'est PAS émis : le trait porterait la structure d'un intérieur
 * jamais exploré, exactement ce que le voile cache. PURE.
 *
 * DEUX FORMES D'OBSTACLE, UN SEUL TRAIT : les éléments `wall` (segments sur arête) ET le contour des
 * TUILES à bloc plein (`solidTileTraitObjs`). Une scène à grille n'auteure ses murets qu'en tuiles :
 * sans elles, son plan est vide de structure alors que TOUTE sa tactique (couvert, ligne de vue) en
 * dépend. La tuile elle-même reste peinte par le monde cuit — sa face du dessus est une surface
 * légitime du plateau ; c'est le TRAIT qui porte la sémantique d'obstacle.
 *
 * POURQUOI TOUT OU RIEN (`vis !== false`), et non le champ continu de visibilité (#1176, C6) : le champ
 * s'applique à la MATIÈRE — les couleurs de sommet du monde cuit, où un dégradé a un sens. Un TRAIT
 * symbolique est BINAIRE : un mur à demi estompé se lit « est-ce un mur ? », exactement l'ambiguïté
 * qu'un plan doit interdire. Ce n'est donc pas une incohérence avec C6, c'est sa frontière.
 */
export function wallTraitObjs(scene: Scene, dims: Dims, z: number, visible?: ReadonlySet<string>): StageObj[] {
  const objs = wallLayerObjs(buildWalls(scene, visible, { activeZ: z, viewZ: z }), dims, 0, TRAIT_LOD);
  return sortByDepth(objs.filter((o) => o.vis !== false), solidTileTraitObjs(scene, dims, z, visible));
}
