/**
 * CLIQUET nominatif des `ligneDeTexte(` restants (#4574, patron #1330).
 *
 * `ligneDeTexte` pose une entrée de journal de variante `ligne` : un texte DÉJÀ rédigé par le noyau, que l'hôte ne
 * fait que recopier — le stock que le journal en données (`EntreeDuJournal`, `src/engine/journal.ts`) résorbe. Le
 * stock ci-dessous est NOMINATIF et DÉCROISSANT, cible ZÉRO : à zéro, la variante `ligne` meurt et chaque entrée est
 * une donnée que l'hôte rédige. Sortie datée au ticket #4574 : la PR « sortie de `ligne` », étape 4 de l'ordre
 * retenu le 2026-11-27 (https://github.com/MyEdO/game/issues/4574#issuecomment-7227908134).
 *
 * Le cliquet mord dans les DEUX sens : un site migré doit BAISSER son compte ici (sinon rouge), et aucun site
 * nouveau ne peut apparaître (fichier absent de la liste = 0 toléré). Les tests et kits de test sont hors stock.
 */
import { describe, it, expect } from 'vitest';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';

/** Stock RESTANT par fichier de production (`src/`, `hotes/`). */
const RESTANT: Record<string, number> = {
  'hotes/godot/pont/pont.ts': 2,
  'src/engine/conditions.ts': 10,
  'src/engine/disease.ts': 7,
  'src/engine/faits.ts': 1,
  'src/engine/healing.ts': 1,
  'src/engine/magic.ts': 6,
  'src/engine/miscast.ts': 5,
  'src/engine/ops.ts': 94,
  'src/engine/provisions.ts': 12,
  'src/engine/suffocation.ts': 5,
  'src/engine/trauma.ts': 5,
  'src/hote/coop/salon.ts': 5,
  'src/noyau/activityIssue.ts': 4,
  'src/noyau/activityWorldRolls.ts': 2,
  'src/noyau/authorPerils.ts': 2,
  'src/noyau/cascade.ts': 5,
  'src/noyau/chapitreRecap.ts': 2,
  'src/noyau/combat/advantagePool.ts': 1,
  'src/noyau/combat/roundHooks.ts': 6,
  'src/noyau/combat/triggeredTest.ts': 13,
  'src/noyau/combat/turnHooks.ts': 9,
  'src/noyau/combatArea.ts': 2,
  'src/noyau/combatEffects.ts': 53,
  'src/noyau/combatFlow.ts': 160,
  'src/noyau/combatLog.ts': 1,
  'src/noyau/combatManeuvers.ts': 8,
  'src/noyau/combatPlacement.ts': 2,
  'src/noyau/combatSlice.ts': 60,
  'src/noyau/contagion.ts': 1,
  'src/noyau/conversation.ts': 1,
  'src/noyau/corruptionFlow.ts': 11,
  'src/noyau/encounterPsychFlow.ts': 2,
  'src/noyau/entreeEnScene.ts': 4,
  'src/noyau/favorFlow.ts': 4,
  'src/noyau/gesteDArete.ts': 5,
  'src/noyau/innFlow.ts': 1,
  'src/noyau/intentionsDeSiege.ts': 1,
  'src/noyau/interactionsDExploration.ts': 6,
  'src/noyau/interludeFlow.ts': 59,
  'src/noyau/issueDeCombat.ts': 2,
  'src/noyau/landMarketFlow.ts': 8,
  'src/noyau/massBattleFlow.ts': 21,
  'src/noyau/medicFlow.ts': 5,
  'src/noyau/merchantFlow.ts': 22,
  'src/noyau/monde/shipCollision.ts': 1,
  'src/noyau/monde/zones.ts': 2,
  'src/noyau/mount.ts': 1,
  'src/noyau/navireOps.ts': 25,
  'src/noyau/objetsAuSol.ts': 3,
  'src/noyau/outOfCombatUpkeep.ts': 1,
  'src/noyau/partyFlow.ts': 35,
  'src/noyau/portFlow.ts': 14,
  'src/noyau/pousseeDeCombat.ts': 1,
  'src/noyau/pursuitFlow.ts': 20,
  'src/noyau/refusVisible.ts': 1,
  'src/noyau/restFlow.ts': 23,
  'src/noyau/riverVoyageFlow.ts': 44,
  'src/noyau/rollFlowFactory.ts': 3,
  'src/noyau/rollFlowSpecs.ts': 3,
  'src/noyau/seaActivities.ts': 7,
  'src/noyau/seaVoyageFlow.ts': 94,
  'src/noyau/sequenceCore.ts': 1,
  'src/noyau/shipCrew.ts': 14,
  'src/noyau/shipManeuver.ts': 4,
  'src/noyau/shipwreck.ts': 8,
  'src/noyau/summonFlow.ts': 4,
  'src/noyau/targetingModes.ts': 1,
  'src/noyau/tavernFlow.ts': 36,
  'src/noyau/testsDeScene.ts': 5,
  'src/noyau/travelFlow.ts': 55,
  'src/noyau/travelPostes.ts': 8,
  'src/noyau/triggeredEffects.ts': 1,
  'src/noyau/upkeep.ts': 8,
  'src/noyau/voyageCadence.ts': 2,
};

function recensement(): Record<string, number> {
  const trouves: Record<string, number> = {};
  for (const { rel, text } of readCorpus(['src', 'hotes'])) {
    const n = (text.match(/\bligneDeTexte\(/g) ?? []).length;
    if (n > 0) trouves[rel] = n;
  }
  return trouves;
}

describe('#4574 — cliquet des `ligneDeTexte(` (variante `ligne` du journal)', () => {
  it('le stock recensé est EXACTEMENT celui déclaré (aucun site neuf, aucune migration non soldée)', () => {
    expect(recensement()).toEqual(RESTANT);
  });

  it('cible ZÉRO : le total ne peut que décroître (mort de la variante `ligne`)', () => {
    const total = Object.values(recensement()).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(Object.values(RESTANT).reduce((a, b) => a + b, 0));
  });
});
