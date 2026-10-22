import { describe, it, expect } from 'vitest';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';
import { valeursDe } from './data/schemas/grammaire/meta';
import { effectTriggerSchema } from './data/schemas/grammaire/mecanique';
import type { EffectTrigger } from './engine/flowCore';
import { estFichierVitest } from '../scripts/guards/lib/fichierVitest.mjs';

/**
 * GARDE DE COMPLÉTUDE (nouvelle classe, #316) : « zéro trigger d'authoring sans point d'émission ».
 * Chaque valeur d'`EffectTrigger` OFFERTE au schéma d'authoring (donc éditable au Compendium) doit
 * avoir ≥1 SITE D'ÉMISSION en production — sinon un effet authoré dessus est une AFFORDANCE MORTE
 * (se pose dans l'éditeur, ne se déclenche JAMAIS). La taxonomie est DÉRIVÉE d'`effectTriggerSchema`
 * (`grammaire/mecanique.ts`, dont le `satisfies Record<EffectTrigger, string>` tient l'exhaustivité AU
 * COMPILATEUR) — pas une liste maintenue à la main.
 *
 * Un site d'émission = `emitCombatEvent('<trigger>'` (l'unique porte) OU, pour les événements de
 * CYCLE, la boucle `fireTriggers`/`fireTurnEdgeTriggers` interne aux modules BUS-OWNED
 * (roundHooks/turnHooks/clockHooks) — la machinerie du bus, whitelistée par la quarantaine d'import — OU, pour un
 * trigger CADENCE-AGNOSTIQUE fié aux seams HORS cycle de combat (`onOwnTestFailed` : le porteur échoue un
 * Test — combat OU scène OU entretien, MSRC 16), sa PORTE DÉDIÉE `fireTriggers(…, '<trigger>'` dans le
 * module ÉMETTEUR whitelisté (`triggeredEffects.ts` porte `fireOwnTestFailed`, l'unique point d'émission).
 */
const BUS_OWNED = ['src/noyau/combat/roundHooks.ts', 'src/noyau/combat/turnHooks.ts', 'src/noyau/clockHooks.ts'];
// Portes DÉDIÉES hors cycle de combat : un émetteur nommé fié à un seam qui n'est pas le bus de combat
// (pas d'`emitCombatEvent`, ils tirent aussi hors combat), mais un point d'émission RÉEL et unique.
//  - `fireOwnTestFailed` (triggeredEffects) : seams de résolution de Test (modale joueur, cascade
//    d'entretien, jets inline) ;
//  - `fireClockTriggers` (clockHooks, bus-owned) : sa boucle par porteur EST la machinerie du cycle
//    CALENDAIRE, mais elle reçoit son déclencheur en PARAMÈTRE — le site qui le NOMME est sa cadence
//    unique `runDailyUpkeep` (upkeep.ts), anti-double-comptage des franchissements de jour.
const DEDICATED_EMITTERS = ['src/noyau/triggeredEffects.ts', 'src/noyau/upkeep.ts'];


function tsFiles(): { rel: string; src: string }[] {
  return readCorpus(['src'], { tests: true })
    .filter(({ rel }) => !estFichierVitest(rel))
    .map(({ rel, text }) => ({ rel, src: text }));
}

/** Ensemble des triggers ayant ≥1 émission de production. */
function emittedTriggers(): Set<string> {
  const emitted = new Set<string>();
  const files = tsFiles();
  // (a) `emitCombatEvent('<trigger>'` — n'importe où (l'unique porte).
  for (const { src } of files) {
    for (const m of src.matchAll(/emitCombatEvent\(\s*'(\w+)'/g)) emitted.add(m[1]);
  }
  // (b) boucles de cycle bus-owned + (c) portes DÉDIÉES hors cycle : `fireTriggers(…, '<trigger>'` /
  //     `fireTurnEdgeTriggers(…, '<trigger>'` dans un module whitelisté (bus OU émetteur dédié nommé).
  for (const { rel, src } of files) {
    if (!BUS_OWNED.includes(rel) && !DEDICATED_EMITTERS.includes(rel)) continue;
    for (const m of src.matchAll(/(?:fireTriggers|fireTurnEdgeTriggers|fireClockTriggers)\([^;)]*?'(\w+)'/g)) emitted.add(m[1]);
  }
  return emitted;
}

describe('couverture d’émission du bus — chaque trigger d’authoring a un point d’émission (#316)', () => {
  it('aucun trigger de la taxonomie n’est une affordance morte (émission manquante)', () => {
    const taxonomy = Object.keys(valeursDe(effectTriggerSchema)!) as EffectTrigger[];
    const emitted = emittedTriggers();
    const orphans = taxonomy.filter((t) => !emitted.has(t));
    expect(
      orphans,
      'Trigger(s) d’authoring SANS point d’émission (affordance morte) — câbler un ' +
        `emitCombatEvent('<trigger>') à leur site naturel, ou retirer le trigger de la taxonomie :\n${orphans.join('\n')}`,
    ).toEqual([]);
  });
});
