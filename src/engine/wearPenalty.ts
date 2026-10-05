/**
 * Pénalités de port d'armure (LDB 63 l.12) : portées STRUCTURÉES par les pseudo-qualités d'armure
 * `en-<skillId>` (`{id:'en-discretion', value:-10}`) — l'id encode la Compétence, le `value` la magnitude.
 * Plus aucune prose FR « -N% en <Compétence> » re-parsée par regex. Somme les pièces ÉQUIPÉES d'un acteur
 * (LDB 63 l.92 : « chaque fois » → cumul), modulée par l'artisanat (Pratique réduit d'un niveau, Peu Fiable
 * double — LDB 60 l.22/58).
 */
import { Combatant } from './types';
import { itemLabel } from './items';
import type { GameOp, PassiveMod } from './ops';
import type { CodexTarget } from './ruleRefs';
import { hasQuality, qualitySocMods } from './qualities/dispatch';

/** Préfixe d'id des pseudo-qualités de pénalité de port : `en-<skillId>` (`en-discretion`, `en-perception`). */
const WEAR_PREFIX = 'en-';

/** Pénalités de port (skillId stable, valeur ≤ 0) des armures ÉQUIPÉES, modulées par l'artisanat
 *  (Pratique +10 plancher 0, Peu Fiable ×2). SOURCE UNIQUE : `wornArmourPenalty` + le collecteur passif. */
function wearEntries(c: Combatant): { skill: string; value: number; src?: CodexTarget; label: string }[] {
  const out: { skill: string; value: number; src?: CodexTarget; label: string }[] = [];
  for (const piece of c.items ?? []) {
    if (!piece.equipped || piece.kind !== 'armor') continue;
    for (const q of piece.qualities ?? []) {
      if (!q.id.startsWith(WEAR_PREFIX) || q.value == null) continue;
      const skill = q.id.slice(WEAR_PREFIX.length); // `en-discretion` → skillId `discretion` (stable)
      let v = q.value; // négatif (magnitude LDB 63)
      if (hasQuality(piece, 'pratique')) v = Math.min(0, v + 10); // Atout : -1 niveau (LDB 60 l.22)
      if (hasQuality(piece, 'peu-fiable')) v = v * 2; // Défaut : doublée (LDB 60 l.58)
      // `src` = LA PIÈCE portée : c'est elle qui NOMME la chip du jet (« −10 Cotte de mailles »), pas la
      // pseudo-qualité `en-<skill>` dont le libellé de catalogue (« % en discretion ») est un gabarit.
      if (v) out.push({ skill, value: v, label: itemLabel(piece), ...(piece.trappingId ? { src: { category: 'trappings', id: piece.trappingId } } : {}) });
    }
  }
  return out;
}

/** Somme des pénalités de port (≤ 0) des armures ÉQUIPÉES de `c` pour la compétence `skillId` stable. */
export function wornArmourPenalty(c: Combatant, skillId: string): number {
  return wearEntries(c).filter((e) => e.skill === skillId).reduce((s, e) => s + e.value, 0);
}

/** Pénalités de port → ops `skillMod` skill-qualifiées (kind `intrinseque`, Σ) pour le collecteur passif
 *  unifié, chacune ATTRIBUÉE à la pièce qui la porte (`src`) pour que le détail de jet la NOMME. */
export function qualityWearMods(c: Combatant): PassiveMod[] {
  return wearEntries(c).map((e) => ({ op: { op: 'skillMod' as const, skill: { id: e.skill }, mod: e.value }, kind: 'intrinseque' as const, label: e.label, ...(e.src ? { src: e.src } : {}) }));
}

/** Modificateurs de Sociabilité (≤ 0) des objets ÉQUIPÉS de `c` (objet Laid −10, LDB 60 l.54), UN PAR
 *  QUALITÉ émettrice : le `src` porte la qualité, donc le détail de jet la NOMME (« −10 Laid ») au lieu
 *  d'un total anonyme. SOURCE UNIQUE — `wornSocialMod` n'en est que la somme. */
export function wornSocialMods(c: Combatant): PassiveMod[] {
  const out: PassiveMod[] = [];
  for (const piece of c.items ?? []) {
    if (!piece.equipped) continue;
    for (const q of qualitySocMods(piece)) out.push({ op: { op: 'testMod', amount: q.amount, char: 'sociabilite' }, kind: 'intrinseque', src: { category: 'qualities', id: q.id } });
  }
  return out;
}

/** Somme de `wornSocialMods` — pour les sites qui n'ont qu'un nombre à porter. */
export function wornSocialMod(c: Combatant): number {
  return wornSocialMods(c).reduce((s, m) => s + (m.op as Extract<GameOp, { op: 'testMod' }>).amount, 0);
}
