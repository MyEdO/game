/**
 * Visuels des AMPUTATIONS et PROTHÈSES (LDB 18 Traumatisme / LDB 73 prothèses) — COSMÉTIQUE,
 * même architecture que les mutations (mutations.ts) : `Combatant.traumas` + prothèse PORTÉE
 * (`items` equipped) → calques/membres remplacés sur le rig.
 *
 *  - Main/bras amputé : moignon bandé ; Crochet porté → crochet ; Merveille → main mécanique.
 *  - Membre inférieur amputé : visible quand une Fausse jambe/Merveille est portée → jambe de
 *    bois (sans prothèse, la jambe peinte reste — un moignon rendrait la marche absurde).
 *  - Œil perdu : cicatrice ; Cache-œil → bandeau ; Œil de verre → œil pâle. Cécité → bandage.
 *  - Nez amputé : trou sombre ; Nez doré → nez d'or.
 *  Doigts/dents/oreilles : trop petits pour l'art du rig — pas de visuel (assumé).
 */
import type { Combatant, Trauma } from '../../../engine/types';
import { findTraumaFiche } from '../../../engine/trauma';
import type { RigOverlay, BoneId } from '../bones';
import type { Appearance } from '../../../engine/authoringAppearance';
import { EYES } from './eyes';
import { PROSTHESIS } from './prosthesis';

// Prothèse PORTÉE par son `trappingId` STABLE (≠ libellé) — réf de catalogue (trappings.json).
const worn = (c: Combatant, trappingId: string): boolean => (c.items ?? []).some((i) => i.trappingId === trappingId && i.equipped);
const handBone = (t: Trauma): BoneId => (t.location === 'brasG' ? 'mainG' : 'mainD');
/** Suffixe de latéralité d'une Localisation (`brasG` → `G`) ; absent pour tête/corps. */
const side = (t: Trauma): 'G' | 'D' | undefined => (t.location?.endsWith('G') ? 'G' : t.location?.endsWith('D') ? 'D' : undefined);

/** Calques DÉCLARÉS par la séquelle (`TraumaFiche.rig`, `traumas.json`) : os porteur, art par défaut et
 *  art substitué par la prothèse PORTÉE. Rien si la fiche ne déclare aucun visuel, si elle n'est visible
 *  qu'AVEC une prothèse (jambe de bois) et qu'aucune n'est portée, ou si l'id ne résout plus au catalogue
 *  (`findTraumaFiche` : un `traumaId` orphelin d'une save reste INERTE à l'écran, jamais un crash de scène). */
function declaredOverlays(c: Combatant, t: Trauma): RigOverlay[] {
  const rig = findTraumaFiche(t.traumaId)?.rig;
  if (!rig) return [];
  const lat = side(t);
  if (rig.lateral && !lat) return [];
  const suffix = rig.lateral ? lat : '';
  const art = rig.byProsthesis?.find((p) => worn(c, p.trappingId))?.art ?? rig.art;
  if (!art) return [];
  const out: RigOverlay[] = [{ bone: `${rig.bone}${suffix}` as BoneId, svg: PROSTHESIS[art], ...(rig.replace ? { replace: true } : {}), ...(rig.view ? { view: rig.view } : {}) }];
  if (rig.hidesBone) out.push({ bone: `${rig.hidesBone}${suffix}` as BoneId, svg: '', replace: true });
  return out;
}

/** Calques d'amputations/prothèses d'un combattant (traumas + objets portés). */
export function injuryOverlaysFor(c: Combatant): RigOverlay[] {
  const traumas = c.traumas ?? [];
  if (!traumas.length) return [];
  const out: RigOverlay[] = [];
  for (const t of traumas) {
    // Main/bras : la prothèse portée remplace le poing, sinon moignon bandé.
    if (t.ops?.some((o) => o.op === 'maxWeaponHands') && (t.location === 'brasG' || t.location === 'brasD')) {
      const svg = worn(c, 'merveille-d-ingenierie') ? PROSTHESIS['main-mecanique'] : worn(c, 'crochet') ? PROSTHESIS.crochet : PROSTHESIS.moignon;
      out.push({ bone: handBone(t), svg, replace: true });
    }
    // Jambe de bois, nez (doré ou trou), bandage de Cécité… : DÉCLARÉS par la fiche de séquelle.
    out.push(...declaredOverlays(c, t));
  }
  return out;
}

/** Modifications d'APPARENCE dues aux blessures : l'œil perdu remplace l'œil peint en place
 *  (cicatrice / Cache-œil / Œil de verre selon la prothèse portée). Même référence si rien. */
export function injuryAppearance(a: Appearance, c: Combatant): Appearance {
  const traumas = c.traumas ?? [];
  if (!traumas.some((t) => t.traumaId === 'oeil-perdu') || traumas.some((t) => t.traumaId === 'cecite')) return a;
  const art = worn(c, 'cache-oeil') ? EYES['cache-oeil'] : worn(c, 'oeil-de-verre') ? EYES.verre : EYES.perdu;
  return { ...a, eyes: { ...a.eyes, G: art } };
}
