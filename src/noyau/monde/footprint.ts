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
 * de DÉCOR (`propDeclaredFoot`/`propFootTiles`) LISENT le catalogue app-owned `props.json` (`../data`),
 * vérité unique de l'empreinte d'un prop — ce module n'est donc pas sans dépendance de données.
 */
import { findPropById } from '../../data';
import { empreinteDuProp, offsetAncre } from '../../data/props.types';
import type { Dir8 } from './dir8';
import { effectiveSize, sizeFootprintSide, type SizeCategory } from '../../engine/size';
import type { Combatant } from '../../engine/types';
import type { Pt } from './path';
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

/** Empreinte DÉCLARÉE du TYPE de décor (`props.json` `foot`, ancre = coin NO) — vérité UNIQUE des
 *  dimensions d'un prop : une instance de scène n'en redéclare aucune. Absente = le décor n'occupe
 *  que sa case et ne bloque que s'il est solide ou interactif (cf. `entityBlockedAt`). */
export const propDeclaredFoot = (ref: string | undefined): { w: number; h: number } | undefined =>
  (ref ? findPropById(ref)?.foot : undefined);

/**
 * ANCRE MONDE d'un décor posé en `pos` — le point sur lequel TOUT ce que le décor projette se pose :
 * sa géométrie volumique (`gameIso/builders/props.ts` → `buildPropVolumes`), son dessin billboard, et
 * le FOYER de la source qu'il porte (`noyau/monde/vision.ts` → `LightSource.foyer`). Un décor s'ancre au
 * CENTRE de son empreinte : `pos` en est le coin NO, `decorFootGeometry` donne le décalage
 * fractionnaire vers ce centre. UNE définition, parce qu'une lampe calée sur un autre point que sa
 * propre géométrie s'en détacherait dès la première empreinte non 1×1 — mesuré à 1,414 m sur une
 * empreinte 2×2 (#1680 ligne 5). PURE.
 */
export function decorAncre(pos: { x: number; y: number }, foot?: { w: number; h: number }): { x: number; y: number } {
  const { offX, offY } = decorFootGeometry(foot);
  return { x: pos.x + offX, y: pos.y + offY };
}

/**
 * Cases couvertes par un décor de ref `ref` ancré en `pos`, au cap `facing` et à l'échelle `mpt` —
 * la COUTURE UNIQUE de l'empreinte effective d'un décor pour tous ses consommateurs de cases
 * (walkability `sceneRules`, Ligne de Vue `lineOfSight`, opacité de lumière `vision`, outillage).
 *
 * L'étendue vient de `empreinteDuProp` (`data/props.types.ts`) : le CORPS TOURNÉ pour un décor à
 * recette (#1509 — une table 2×1 au cap E couvre 1×2), l'empreinte DÉCLARÉE pour un billboard.
 * Ce que cette fonction rend, c'est une ÉTENDUE ; elle ne dit RIEN de la porte de blocage — un décor
 * qui ne bloque pas (`sceneRules` `entityBlockedAt`) ne se met pas à bloquer parce que ses cases sont
 * désormais dérivées.
 */
export function propFootTiles(ref: string | undefined, pos: Pt, facing: Dir8 | undefined, mpt: number): Pt[] {
  const { w, h } = empreinteDuProp(findPropById(ref), facing, mpt);
  const out: Pt[] = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) out.push({ x: pos.x + dx, y: pos.y + dy });
  return out;
}

/**
 * Géométrie d'un DÉCOR à empreinte rectangulaire (`PropData.foot {w,h}` pour un billboard, empreinte
 * DÉRIVÉE du corps tourné pour une recette, #1509 ; ancre = coin NO) : décalage fractionnaire vers le
 * CENTRE du bloc (pour y poser le token), ÉTENDUE en cases sur chaque axe, et facteur d'échelle
 * visuel. Absent/1×1 ⇒ identité — le décor historique ne bouge pas.
 *
 * DEUX grandeurs, deux emplois, et pas l'une pour l'autre :
 *  - `sx`/`sy` = l'étendue de l'empreinte, AXE PAR AXE. C'est ce que suit toute figure POSÉE AU SOL
 *    sur l'empreinte — le halo d'interaction (`gameIso/builders/interactHalos`). Un `scale` isotrope
 *    y débordait d'une demi-case sur l'axe court d'un meuble 1×2 : le halo d'une table murale passait
 *    à travers le mur, dans la pièce voisine.
 *  - `scale` = l'échelle du DESSIN, isotrope par nature : une vignette de billboard s'agrandit sans
 *    se déformer, donc au plus grand côté (`gameIso/builders/props.ts`, `PropEl.echelle`).
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
 * Distance de COMBAT (Chebyshev d'empreinte) entre deux combattants positionnés — `Infinity` si l'un
 * n'est pas posé. Un grand est « au contact » (distance 1) si UNE de ses tuiles touche la cible, et
 * la portée d'un tir se mesure du bord de l'empreinte. Remplace `chebyshev(a.pos, b.pos)` partout où
 * la Taille des deux combattants compte (mêlée, bandes de portée, sélection de cible).
 *
 * RELIEF : la séparation VERTICALE est la vraie hauteur métrique entre les deux surfaces, convertie en
 * cases (`verticalTiles`, Δhauteur ÷ échelle métrique) — un défenseur de muraille (h élevée) n'est PAS
 * superposé aux assaillants au sol. `mpt` = m/case de la scène (défaut 2 person-scale ; les appelants
 * qui ont la scène passent `sceneMetresPerTile(scene)`). Δhauteur=0 (même altitude) ⇒ terme nul ⇒
 * résultat byte-identique au plan. `pos.h` est stampé/rafraîchi à chaque mouvement (`placeCombatant`).
 */
export function combatDistance(a: Combatant, b: Combatant, mpt = 2): number {
  if (!a.pos || !b.pos) return Infinity;
  const horizontal = footprintChebyshev(a.pos, footprintN(a), b.pos, footprintN(b));
  const vertical = verticalTiles(a.pos.h ?? 0, b.pos.h ?? 0, mpt);
  return Math.max(horizontal, vertical);
}
