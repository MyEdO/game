/**
 * Empreinte de grille des créatures par Taille — LDB `15 - Deplacement.md` l.12 :
 * « 1 case = 2 mètres … Les créatures plus grandes peuvent occuper 2, 4 ou même plus de cases
 * sur la carte, en fonction de leur trait Taille (voir page 342). » Le canon n'imprime AUCUNE barre
 * par catégorie : les 7 valeurs sont une extrapolation MAISON, sortie en donnée éditable
 * (`src/data/sizes.json::footprintSide`, lue par `sizeFootprintSide`).
 *
 * Géométrie de grille, pas une règle testée. Convention d'ANCRAGE : `pos` = coin Nord-Ouest
 * (min x, min y) de l'empreinte, qui s'étend vers +x/+y. Une créature 1×1 garde sa sémantique
 * actuelle (pos = sa tuile), donc tout le code positionnel existant reste correct par défaut.
 *
 * Les fonctions de CRÉATURE (`sizeFootprint`…) restent des fonctions pures de leurs arguments ; celles
 * de DÉCOR (`propFootTiles`) LISENT le catalogue app-owned `props.json` (`../data`),
 * vérité unique de l'empreinte d'un prop — ce module n'est donc pas sans dépendance de données.
 */
import { findPropById } from '../../data';
import { decalageDuCalage, empreinteDuProp, offsetAncre } from '../../data/props.types';
import type { Dir8 } from '../../geometry/dir8';
import { effectiveSize, sizeFootprintSide, type SizeCategory } from '../../engine/size';
import type { Combatant } from '../../engine/types';
import type { Pt } from './path';
import { plafondDe, wallOnSight, type Scene, type SceneEntity } from './scene';
import { isStructure } from '../../engine/structures';
import { chebyshev } from '../../engine/grid';
import { verticalTiles } from './relief';

/** Côté N de l'empreinte carrée pour une Taille créature (défaut Moyenne = 1). */
export function sizeFootprint(size?: SizeCategory): number {
  return sizeFootprintSide(effectiveSize(size));
}

/** Côté N de l'empreinte d'une ENTITÉ — accesseur UNIQUE qui DÉCOUPLE l'empreinte de grille de la Taille
 *  créature : `footprint` explicite (objet à empreinte propre — un NAVIRE, MDG 12, qui occupe N cases sans
 *  être une créature) prime ; sinon dérivée de la Taille créature (`size`). Un navire n'a donc PAS de `size`
 *  (→ aucune Peur de Taille / Piétinement / ×Dégâts) tout en occupant ses cases. */
export function footprintN(c: { size?: SizeCategory; footprint?: number }): number {
  return c.footprint ?? sizeFootprint(c.size);
}

/** Tuiles occupées par une empreinte carrée de côté `n` ancrée en `pos` (coin NO). Renvoie n×n tuiles. */
export function footprintTiles(pos: Pt, n = 1): Pt[] {
  if (n <= 1) return [{ x: pos.x, y: pos.y }];
  const out: Pt[] = [];
  for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) out.push({ x: pos.x + dx, y: pos.y + dy });
  return out;
}

/** L'empreinte (pos, côté `n`) couvre-t-elle la tuile (x, y) ? */
export function occupiesTile(pos: Pt, n: number, x: number, y: number): boolean {
  const side = Math.max(1, n);
  return x >= pos.x && x < pos.x + side && y >= pos.y && y < pos.y + side;
}

/**
 * ANCRE MONDE d'un décor posé — le point sur lequel TOUT ce que le décor projette se pose :
 * sa géométrie volumique (`buildPropVolumes`), son dessin billboard, ses places assises et
 * le FOYER de la source qu'il porte (`noyau/monde/vision.ts` → `LightSource.foyer`). Un décor s'ancre au
 * CENTRE de son empreinte (`pos` en est le coin NO, `decorFootGeometry` donne le décalage
 * fractionnaire vers ce centre), décalé dans son jeu libre par son `calage` (`decalageDuCalage`). UNE définition,
 * parce qu'une lampe calée sur un autre point que sa propre géométrie s'en détacherait dès la première empreinte
 * non 1×1 — mesuré à 1,414 m sur une empreinte 2×2 (#1680 ligne 5). PURE.
 */
export function ancreDuDecor(ent: Pick<SceneEntity, 'pos' | 'decor' | 'facing' | 'calage'>, mpt: number): { x: number; y: number } {
  const prop = findPropById(ent.decor?.id);
  const { offX, offY } = decorFootGeometry(empreinteDuProp(prop, ent.facing, mpt));
  const decalage = decalageDuCalage(prop, ent.facing, mpt, ent.calage);
  return { x: ent.pos.x + offX + decalage.x, y: ent.pos.y + offY + decalage.y };
}

/**
 * Cases couvertes par un décor de ref `ref` ancré en `pos`, au cap `facing` et à l'échelle `mpt` —
 * la COUTURE UNIQUE de l'empreinte effective d'un décor pour tous ses consommateurs de cases
 * (walkability `sceneRules`, Ligne de Vue `lineOfSight`, opacité de lumière `vision`, outillage).
 *
 * L'étendue vient de `empreinteDuProp` (`data/props.types.ts`) : le CORPS TOURNÉ de sa recette
 * (#1509 — une table 2×1 au cap E couvre 1×2). Ce que cette fonction rend, c'est une ÉTENDUE ; elle ne
 * dit RIEN de la porte de blocage (`sceneRules` `entityBlockedAt`).
 */
export function propFootTiles(ref: string | undefined, pos: Pt, facing: Dir8 | undefined, mpt: number): Pt[] {
  const { w, h } = empreinteDuProp(findPropById(ref), facing, mpt);
  const out: Pt[] = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) out.push({ x: pos.x + dx, y: pos.y + dy });
  return out;
}

/**
 * Géométrie d'un DÉCOR à empreinte rectangulaire (DÉRIVÉE du corps tourné de sa recette, #1509 ;
 * ancre = coin NO) : décalage fractionnaire vers le
 * CENTRE du bloc (pour y poser le token), ÉTENDUE en cases sur chaque axe, et facteur d'échelle
 * visuel. Absent/1×1 ⇒ identité — le décor historique ne bouge pas.
 *
 * DEUX grandeurs, deux emplois, et pas l'une pour l'autre :
 *  - `sx`/`sy` = l'étendue de l'empreinte, AXE PAR AXE. C'est ce que suit toute figure POSÉE AU SOL
 *    sur l'empreinte — le halo d'interaction. Un `scale` isotrope
 *    y débordait d'une demi-case sur l'axe court d'un meuble 1×2 : le halo d'une table murale passait
 *    à travers le mur, dans la pièce voisine.
 *  - `scale` = l'échelle du DESSIN, isotrope par nature : une vignette de billboard s'agrandit sans
 *    se déformer, donc au plus grand côté (`PropEl.echelle`).
 * Le décalage est LU à `data/props.types.ts` (`offsetAncre`), où le validateur de catalogue et la
 * résolution des places le lisent aussi : `src/data` ne peut pas remonter jusqu'ici sans cycle.
 */
export function decorFootGeometry(foot?: { w: number; h: number }): { offX: number; offY: number; sx: number; sy: number; scale: number } {
  const { x, y } = offsetAncre(foot);
  const sx = Math.max(1, foot?.w ?? 1);
  const sy = Math.max(1, foot?.h ?? 1);
  return { offX: x, offY: y, sx, sy, scale: Math.max(sx, sy) };
}

/** Écart 1D minimal entre les intervalles [a, a+an) et [b, b+bn) (0 s'ils se recouvrent ou se touchent). */
function gapAxis(a: number, an: number, b: number, bn: number): number {
  const a2 = a + an - 1;
  const b2 = b + bn - 1;
  if (a <= b2 && b <= a2) return 0; // recouvrement sur cet axe
  return Math.max(b - a2, a - b2); // écart positif (l'un est strictement avant l'autre)
}

/**
 * Distance de Chebyshev MINIMALE entre deux empreintes (la plus petite distance tuile-à-tuile,
 * diagonale incluse) : 0 = chevauchement, 1 = au contact/adjacentes. Coïncide avec `chebyshev`
 * pour deux créatures 1×1. Base de l'adjacence / portée / Engagement « par empreinte ».
 */
export function footprintChebyshev(aPos: Pt, an: number, bPos: Pt, bn: number): number {
  return Math.max(gapAxis(aPos.x, an, bPos.x, bn), gapAxis(aPos.y, an, bPos.y, bn));
}

/** Deux empreintes (de côtés `an`/`bn`) se chevauchent-elles (collision de placement) ? */
export function footprintsOverlap(aPos: Pt, an: number, bPos: Pt, bn: number): boolean {
  return footprintChebyshev(aPos, an, bPos, bn) === 0;
}

/**
 * Distance de COMBAT, en cases, entre deux combattants : Chebyshev d'empreinte et séparation verticale
 * (`verticalTiles` sur `pos.h`) ; `Infinity` si l'un n'est pas posé. Mesure de la PORTÉE. `mpt` = m/case.
 */
export function distanceDeCombat(a: Combatant, b: Combatant, mpt = 2): number {
  if (!a.pos || !b.pos) return Infinity;
  const horizontal = footprintChebyshev(a.pos, footprintN(a), b.pos, footprintN(b));
  const vertical = verticalTiles(a.pos.h ?? 0, b.pos.h ?? 0, mpt);
  return Math.max(horizontal, vertical);
}

/** Le corps de `c` est-il porté par la scène : une structure de siège (ses arêtes), un navire sur ses ponts ? */
export const porteParLaScene = (c: Combatant): boolean => isStructure(c) || !!c.surSesPonts;

/** Distance horizontale de contact : la plus petite distance de Chebyshev entre une case de chaque empreinte que
 *  nulle arête pleine (`wallOnSight`, à la couche la plus haute des deux) ne sépare ; `Infinity` s'il n'y en a aucune.
 *  Un corps porté par la scène n'est séparé de personne par une arête. LDB 13 l.94 ; LDB 13 l.114. */
function horizontalDeContact(scene: Scene | null, a: Combatant, b: Combatant, aPos: Pt, bPos: Pt): number {
  const an = footprintN(a), bn = footprintN(b);
  if (!scene?.walls?.length || porteParLaScene(a) || porteParLaScene(b)) return footprintChebyshev(aPos, an, bPos, bn);
  const z = Math.max(aPos.z ?? 0, bPos.z ?? 0);
  let best = Infinity;
  for (const ta of footprintTiles(aPos, an))
    for (const tb of footprintTiles(bPos, bn)) {
      const d = chebyshev(ta, tb);
      if (d < best && !wallOnSight(scene, ta, tb, z)) best = d;
    }
  return best;
}

/** Le plafond (m) d'une empreinte de côté `n` posée en `p` : le plus haut des plafonds de ses cases (`plafondDe`). */
function plafondDeLEmpreinte(scene: Scene, p: Pt, n: number): number {
  return Math.max(...footprintTiles(p, n).map((t) => plafondDe(scene, { ...t, z: p.z ?? 0 })));
}

/** Distance de CONTACT, en cases : celle de tout ce qui dit « au contact » (Allonge, adjacence, Surnombre).
 *  `Infinity` quand le plafond du plus bas (`plafondDeLEmpreinte`, lu à la scène) n'est pas plus haut que le sol du
 *  plus haut, ou quand une arête pleine sépare les deux empreintes (`horizontalDeContact`). Sans scène, ni plafond ni
 *  arête. LDB 13 l.114 ; LDB 15 l.12. */
export function distanceDeContact(scene: Scene | null, a: Combatant, b: Combatant, mpt = 2): number {
  if (!a.pos || !b.pos) return Infinity;
  const [bas, posBas, posHaut] = (a.pos.h ?? 0) <= (b.pos.h ?? 0) ? [a, a.pos, b.pos] : [b, b.pos, a.pos];
  if (scene && plafondDeLEmpreinte(scene, posBas, footprintN(bas)) <= (posHaut.h ?? 0)) return Infinity;
  return Math.max(horizontalDeContact(scene, a, b, a.pos, b.pos), verticalTiles(a.pos.h ?? 0, b.pos.h ?? 0, mpt));
}
