/**
 * MALADIES TRANSMISES PAR L'EAU (MSRC 16 l.3-63) — moteur PUR des tables d'exposition hydrique :
 * « Chaque fois qu'un Personnage risque d'être exposé à une maladie provenant de l'eau d'une rivière,
 * il est possible qu'il doive réaliser un Test de **Résistance Intermédiaire (+0)**, modifié selon les
 * circonstances. […] tous les modificateurs peuvent être cumulés. Si le Test de Résistance est raté,
 * lancez un dé selon le tableau suivant, avec un modificateur de +10 pour chaque DR négatif. »
 *
 * Le Test d'exposition EST le test : la maladie tirée est CONTRACTÉE directement (`applyContraction`
 * côté appelant — PAS `exposeDisease`, qui redéclencherait un second Test au bilan). Déclencheurs RAW :
 * ingestion volontaire (l.5), échec de Natation → Test de FM raté (l.7 — AUCUN Test de Natation n'existe
 * encore dans le jeu : pas de siège à brancher, l'Effet d'auteur couvre le cas), blessures ouvertes à
 * l'immersion « à la discrétion du MJ » (l.9) → Effet de scène `waterExposure` (contenu = donnée éditeur).
 * PAS de déclencheur périodique voyage/repos : le RAW met lui-même en garde contre la sur-application
 * (« va un peu trop loin », p.91).
 */
import type { Combatant } from './types';
import { WATER_EXPOSURE, type WaterExposureMode, type WaterExposureModifier } from '../data';
import { findTableEntry } from './tables';
import { d100, type RNG, defaultRNG } from './dice';

/** Le personnage est-il « blessé » (PB courants < max) ? Gate du reroll « Relancez si le Personnage
 *  n'est pas blessé » (Infection mineure / Blessure Purulente, MSRC 16 l.63). */
export function isWounded(c: Combatant): boolean {
  return c.wounds.current < c.wounds.max;
}

/** Un modificateur AUTO s'applique-t-il à `c`, et combien de fois (`perCondition` = 1 par pion) ? */
function autoTimes(c: Combatant, m: WaterExposureModifier): number {
  const a = m.auto;
  if (!a) return 0;
  switch (a.kind) {
    case 'woundsRemaining': return c.wounds.current <= a.value ? 1 : 0;
    case 'woundsLost': {
      const lost = Math.max(0, c.wounds.max - c.wounds.current);
      if (a.op === '>=') return lost >= a.value ? 1 : 0;
      return lost >= a.min && lost <= a.max ? 1 : 0;
    }
    case 'perCondition': return c.conditions.find((x) => x.id === a.condition)?.value ?? 0;
    case 'hasCondition': return c.conditions.some((x) => x.id === a.condition) ? 1 : 0;
  }
}

/** Modificateurs AUTOMATIQUES (tableau 2 « Blessures et États », immersion seule) dérivés du Combatant —
 *  cumulés (« tous les modificateurs peuvent être cumulés », MSRC 16 l.13). Renvoie le détail pour la modale. */
export function autoExposureMods(c: Combatant, mode: WaterExposureMode): { label: string; mod: number }[] {
  const out: { label: string; mod: number }[] = [];
  for (const m of WATER_EXPOSURE.modifiers) {
    if (!m.auto || !m.appliesTo.includes(mode)) continue;
    const times = autoTimes(c, m);
    if (times > 0) out.push({ label: times > 1 ? `${m.label} ×${times}` : m.label, mod: m.mod * times });
  }
  return out;
}

/** Modificateur de SOURCE D'EAU (tableau 1, choix d'auteur de la zone — s'applique ingestion ET
 *  immersion). `id` inconnu/absent → 0 (Campagne). */
export function sourceExposureMod(sourceId: string | undefined): { label: string; mod: number } | null {
  const m = WATER_EXPOSURE.modifiers.find((x) => x.table === 'source-d-eau' && x.id === sourceId);
  return m ? { label: m.label, mod: m.mod } : null;
}

/** Tirage de la maladie sur la table d100, « avec un modificateur de +10 pour chaque DR négatif » ;
 *  « Relancez si le Personnage n'est pas blessé » (entrées ¹). Le jet modifié est PLAFONNÉ à la table
 *  (findTableEntry replie sur la dernière entrée). Borne de sûreté anti-boucle : après 20 relances d'un
 *  tirage non-blessé, on garde la dernière entrée NON gatée en re-balayant la table (déterministe). */
export function drawWaterDisease(negativeSL: number, wounded: boolean, rng: RNG = defaultRNG): { roll: number; modified: number; disease: string; rerolled: number } {
  const mod = WATER_EXPOSURE.rollModPerNegativeSL * Math.max(0, negativeSL);
  let rerolled = 0;
  for (;;) {
    const roll = d100(rng);
    const modified = Math.min(100, roll + mod);
    const entry = findTableEntry(WATER_EXPOSURE.diseases, modified);
    if (!entry.rerollUnlessWounded || wounded) return { roll, modified, disease: entry.disease, rerolled };
    rerolled++;
    if (rerolled >= 20) {
      const fallback = WATER_EXPOSURE.diseases.find((e) => !e.rerollUnlessWounded) ?? entry;
      return { roll, modified, disease: fallback.disease, rerolled };
    }
  }
}
