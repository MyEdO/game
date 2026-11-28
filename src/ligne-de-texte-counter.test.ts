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
  'hotes/godot/pont/pont.ts': 1,
  'src/engine/conditions.ts': 1,
  'src/engine/disease.ts': 3,
  'src/engine/faits.ts': 1,
  'src/engine/healing.ts': 1,
  'src/engine/ops.ts': 98,
  'src/noyau/activityIssue.ts': 4,
  'src/noyau/activityWorldRolls.ts': 2,
  'src/noyau/authorPerils.ts': 3,
  'src/noyau/chapitreRecap.ts': 2,
  'src/noyau/combat/roundHooks.ts': 4,
  'src/noyau/combat/triggeredTest.ts': 14,
  'src/noyau/combat/turnHooks.ts': 4,
  'src/noyau/combatEffects.ts': 10,
  'src/noyau/combatFlow.ts': 23,
  'src/noyau/combatLog.ts': 3,
  'src/noyau/combatManeuvers.ts': 2,
  'src/noyau/combatSlice.ts': 2,
  'src/noyau/contagion.ts': 1,
  'src/noyau/corruptionFlow.ts': 4,
  'src/noyau/encounterPsychFlow.ts': 2,
  'src/noyau/entreeEnScene.ts': 1,
  'src/noyau/innFlow.ts': 1,
  'src/noyau/interludeFlow.ts': 5,
  'src/noyau/journal.ts': 1,
  'src/noyau/landMarketFlow.ts': 2,
  'src/noyau/merchantFlow.ts': 6,
  'src/noyau/portFlow.ts': 8,
  'src/noyau/pursuitFlow.ts': 2,
  'src/noyau/restFlow.ts': 17,
  'src/noyau/revealStep.ts': 1,
  'src/noyau/riverVoyageFlow.ts': 34,
  'src/noyau/seaActivities.ts': 7,
  'src/noyau/seaVoyageFlow.ts': 44,
  'src/noyau/shipwreck.ts': 3,
  'src/noyau/tavernFlow.ts': 8,
  'src/noyau/travelFlow.ts': 22,
  'src/noyau/travelPostes.ts': 8,
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
