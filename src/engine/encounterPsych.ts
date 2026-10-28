/**
 * Psychologie À LA RENCONTRE (hors combat) — cœur pur de la couture C de l'audit « combat-only ».
 *
 * Hors combat, la **Peur / Terreur d'une CRÉATURE** (Taille, `causesPeur`/`causesTerreur` du statbloc)
 * ne se teste PAS (comportement retenu au playtest du 2026-06-10) : les créatures croisées y sont
 * supposées non hostiles — sinon une simple galerie de monstres (ou un PNJ inoffensif de grande Taille)
 * inonderait le joueur de Tests de Calme. Se déclenchent en revanche les Traits psy CIBLÉS du HÉROS —
 * Animosité / Haine / Préjugé / Amour / Camaraderie par leur Test propre, et ceux déclarés
 * `targetCauses` (Phobie) par le régime qu'ils CAUSENT (LDB 21 l.87) : la porte est portée par
 * l'OBSERVATEUR, pas par le statbloc croisé, donc l'arbitrage 2026-06-10 reste entier. RAW LDB 21,
 * dont l'exemple canonique (l.11) se passe DANS UNE TAVERNE. Le combat, lui, garde Peur/Terreur de
 * créature (cf. `collectHeroRoundStartPsych` / `collectHeroRoundEndPsych` dans noyau/combatFlow).
 *
 * Pur et découplé : prend les PNJ déjà décrits en `Combatant` (groups). Immunité (Psychologie) et
 * Frénésie court-circuitent. Le branchement (entrée de scène / dialogue → modale) vit dans la couche state.
 */
import { Combatant } from './types';
import { targetedTrigger, targetCausedTrigger, isPsychImmune, PsychType } from './psychology';
import type { CiblePsy } from './psych/ciblage';

export interface EncounterPsychTrigger {
  kind: PsychType;
  sourceId: string;
  indice: number;
  cible?: CiblePsy;
}

/** Premier Test de Psychologie dû à `hero` face aux `npcs` présents HORS COMBAT, ou null. Peur/Terreur
 *  de CRÉATURE exclues (combat seulement) ; comptent les Traits psy CIBLÉS du héros — d'abord ceux qui
 *  posent un régime (`targetCauses` : Phobie → Peur, LDB 21 l.87), puis les Tests ciblés binaires. */
export function encounterPsych(hero: Combatant, npcs: Combatant[]): EncounterPsychTrigger | null {
  if (isPsychImmune(hero)) return null; // immunité (Détermination en combat) / Frénésie → aucun Test
  const tc = targetCausedTrigger(hero, npcs); // Phobie : l'objet du Trait CAUSE la Peur (LDB 21 l.87)
  if (tc) return { kind: tc.kind, sourceId: tc.sourceId, indice: tc.indice, cible: tc.cible };
  const tt = targetedTrigger(hero, npcs); // Animosité/Haine/Préjugé/Amour/Camaraderie (LDB 21)
  if (tt) return { kind: tt.type, sourceId: tt.sourceId, indice: tt.indice ?? 0, cible: tt.cible };
  return null;
}
