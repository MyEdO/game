/**
 * CLIQUET nominatif des `ev('condition', …)` restants (#1330).
 *
 * `ev('condition', …)` est le site où un événement de journal est déclaré « État » SANS porter d'id
 * d'État : c'est ce qui oblige l'affichage à retrouver l'État en SCANNANT le texte français
 * (`conditionIdInText`, `engine/conditions`, consommé par `noyau/combatLog` + `gameIso/combatNarration`). Le stock ci-dessous est
 * NOMINATIF et DÉCROISSANT, cible ZÉRO : à zéro, le scan par libellé meurt et `ev()` peut être muré
 * (l'union `CombatEvent` devient discriminée, `condition` exigeant son `stateId`).
 *
 * Le cliquet mord dans les DEUX sens : un site migré doit BAISSER son compte ici (sinon rouge), et
 * aucun site nouveau ne peut apparaître (fichier absent de la liste = 0 toléré).
 */
import { describe, it, expect } from 'vitest';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';

/** Stock RESTANT par fichier. Aucun de ces sites n'a d'id d'État sous la main : ils déversent des
 *  `string[]` fabriqués ailleurs (sinks de hooks/triggers, files différées). Leur migration attend que
 *  le canal `OpsCtx.onCondition` (#1330 lot A) soit relayé jusqu'à eux par un canal de journal APPARIÉ
 *  — tant que les fabricants rendent des `string[]` nus, l'id ne peut pas les rejoindre. */
const REMAINING: Record<string, number> = {
  'src/noyau/combatFlow.ts': 8, // dont DEUX sur la même ligne (lutte : dégâts de filet + issue)
  'src/noyau/combatEffects.ts': 1,
  'src/noyau/combatPlacement.ts': 1,
  'src/ui/StateRecoveryModal.tsx': 1,
  // Tests qui FABRIQUENT un événement `condition` — ils tomberont avec leurs sites de production.
  'src/state/combat/aa-bleed-unconscious.test.ts': 1,
  'src/state/combat/bleed-death-aa.test.ts': 1,
  'src/state/combat/bleed-death.test.ts': 1,
  'src/ui/RecapLine.test.tsx': 1,
  'src/gameIso/combatNarration.test.ts': 1,
};

/** Le recensement s'EXCLUT lui-même : sa prose cite la forme qu'il traque (elle se compterait). */
const SELF = 'src/condition-event-counter.test.ts';

function census(): Record<string, number> {
  const found: Record<string, number> = {};
  for (const { rel, text } of readCorpus(['src'], { tests: true })) {
    if (rel === SELF) continue;
    const n = (text.match(/ev\('condition'/g) ?? []).length;
    if (n > 0) found[rel] = n;
  }
  return found;
}

describe("#1330 — cliquet des `ev('condition')` sans id d'État", () => {
  it('le stock recensé est EXACTEMENT celui déclaré (aucun site neuf, aucune migration non soldée)', () => {
    expect(census()).toEqual(REMAINING);
  });

  it('cible ZÉRO : le total ne peut que décroître (murage de `ev()` à 0)', () => {
    const total = Object.values(census()).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(Object.values(REMAINING).reduce((a, b) => a + b, 0));
  });
});
