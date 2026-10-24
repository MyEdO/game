/**
 * Échelle VISUELLE d'un token selon la catégorie de Taille (LDB 85 : 7 catégories Minuscule →
 * Monstrueuse). PUREMENT du rendu — aucune table canon de « pixels par Taille » n'existe (DESIGN),
 * ancrée sur Moyenne = 1 (standard des espèces jouables). Multiplie l'échelle d'art (speciesScale) :
 * un Troll (Grande) ou un Dragon (Monstrueuse) dépasse alors franchement sa tuile, façon Baldur's Gate,
 * là où un Gobelin (Moyenne) la remplit. Découplé de l'EMPREINTE de grille (T6, à part).
 *
 * CONVENTION (décision utilisateur 2026-06-11) : tout modèle est DESSINÉ à la baseline Moyenne —
 * son échelle d'art (sl / race.scale / perso.scale) n'exprime que la NUANCE intra-catégorie
 * (elfe > humain > nain ; cheval trapu vs pégase élancé), bande ~0.6-1.3. C'est CETTE table,
 * seule, qui agrandit par catégorie. Garde-fou : `toise.test.ts` + galerie `toise-gallery.html`.
 *
 * Le PRODUIT des deux (art × catégorie) est le multiplicateur de jeton — `entityTokenScale` /
 * `combatantTokenScale` ci-dessous, source UNIQUE de l'échelle des jetons du monde (#1176), qu'ils
 * soient billboards volumiques (`backends/webgl/sceneMeshes.ts` : taille monde du billboard × ce
 * facteur) ou pions de la surcouche. Seule la BASE du site appelant (0,55 / 0,58 / 0,62 du repère
 * 120×150) reste chez lui : elle n'a de sens qu'en pixels de projection.
 */
import { effectiveSize, type SizeCategory } from '../engine/size';
import type { Combatant } from '../engine/types';
import type { SceneEntity } from '../noyau/monde/scene';
import { findCreatureById } from '../data';
import { presetPnjById } from '../state/campaignData';
import { entitySize } from '../noyau/monde/spawn';
import { resolveRender, type RenderResolution } from './rig/bodyPlan';
import { refOf, rigDuCombattant } from './rig/enemyProfile';
import { bodyTopFrac } from './rig/composeRig';
import { isStructure } from '../engine/structures';
import type { TrappingResolver } from '../engine/items';

// Ancré sur les PROPORTIONS face à un humain (un cheval Grande ≈ ×1.3-1.5, un Géant Énorme ≈ ×2.4),
// PAS sur le remplissage de l'empreinte N×N (T6) — l'empreinte reste la vérité d'OCCUPATION,
// le visuel peut être plus petit qu'elle (un cheval bloque 2×2 sans mesurer 4 m au garrot).
const SIZE_TOKEN_SCALE: Record<SizeCategory, number> = {
  minuscule: 0.45,
  tresPetite: 0.6,
  petite: 0.78,
  moyenne: 1,
  grande: 1.45,
  enorme: 2.0,
  monstrueuse: 2.7,
};

/** Facteur d'échelle visuelle du token pour une catégorie de Taille (défaut Moyenne = 1). */
export function sizeTokenScale(size?: SizeCategory): number {
  return SIZE_TOKEN_SCALE[effectiveSize(size)];
}

/** Échelle visuelle d'un token à EMPREINTE propre (objet sans Taille créature — un NAVIRE) de côté `n` :
 *  miroir de `SIZE_TOKEN_SCALE` pour la Taille créature de même empreinte (1→1, 2→1.45, 3→2, 4→2.7),
 *  prolongée linéairement au-delà de 4×4. Découple le RENDU de la Taille créature, comme l'empreinte de grille. */
export function footprintTokenScale(n: number): number {
  const TABLE: Record<number, number> = { 1: 1, 2: 1.45, 3: 2.0, 4: 2.7 };
  const k = Math.max(1, Math.round(n));
  return TABLE[k] ?? 2.7 + (k - 4) * 0.6;
}

/** Entité de scène telle qu'elle se REND : un preset de PNJ nommé (#671) fournit sa base et son
 *  apparence EMBARQUÉE (`preset.portrait`, illustration, n'entre pas ici). Couche non chargée ou
 *  preset absent → l'entité telle quelle. Résolution partagée par le classifieur de corps et le
 *  rendu du monde. */
export function sceneEntityForRender(ent: SceneEntity): SceneEntity {
  const preset = ent.presetId ? presetPnjById(ent.presetId) : undefined;
  return preset ? { ...ent, ref: preset.base ?? ent.ref, appearance: preset.apparence ?? ent.appearance } : ent;
}

/** Résolution de rendu d'une ENTITÉ de scène (classe rig/gabarit, plan, espèce, échelle d'art) — par
 *  la DONNÉE : Espèce explicite + traits du record, par id (`refOf`), jamais par label. */
export function entityRender(ent: SceneEntity): RenderResolution {
  const e = sceneEntityForRender(ent);
  const refName = refOf(e);
  return resolveRender(e.appearance?.species, findCreatureById(refName)?.traits, refName);
}

/** Résolution de rendu d'un COMBATTANT — repli `creatureId` (id STABLE posé au spawn), puis `label`
 *  pour un statbloc d'auteur sans id de catalogue. */
export function combatantRender(c: Combatant): RenderResolution {
  return resolveRender(c.species, c.traits, c.creatureId ?? c.label);
}

/** Multiplicateur de taille du jeton d'une ENTITÉ de scène : échelle d'art × catégorie de Taille. La
 *  Taille se lit sur l'entité AUTHORÉE (`entitySize` : sa réf ou son statbloc custom). */
export function entityTokenScale(ent: SceneEntity): number {
  return entityRender(ent).scale * sizeTokenScale(entitySize(ent));
}

/** Multiplicateur de taille du jeton d'un COMBATTANT : échelle d'art × catégorie de Taille — ou ×
 *  EMPREINTE propre pour un objet sans Taille de créature (un NAVIRE, cf. `footprintTokenScale`). */
export function combatantTokenScale(c: Combatant): number {
  return combatantRender(c).scale * (c.footprint ? footprintTokenScale(c.footprint) : sizeTokenScale(c.size));
}

/** OÙ la tête DESSINÉE d'un combattant arrive dans sa boîte de corps, en fraction de celle-ci —
 *  SOURCE UNIQUE de l'ancrage du chrome au-dessus d'un billboard (`TokenChromeOverlay`
 *  volumique). Elle sort de la toise du gabarit (`bodyTopFrac` → `bodyHeight`, `composeRig`), la
 *  MÊME que l'aperçu de personnage à échelle vraie.
 *
 *  Un corps de GABARIT (créature non bipède, structure de siège) rend 1 : sa hauteur dessinée n'est
 *  stockée nulle part (`BodyPlan` ne déclare que sa `portraitBox`, un CADRAGE de portrait — pas une
 *  toise), et le haut de boîte est l'ancre que les deux voies posaient déjà. */
export function combatantBodyTopFrac(resolveTrapping: TrappingResolver, c: Combatant): number {
  if (isStructure(c) || combatantRender(c).kind !== 'rig') return 1;
  return bodyTopFrac(rigDuCombattant(resolveTrapping, c).appearance);
}
