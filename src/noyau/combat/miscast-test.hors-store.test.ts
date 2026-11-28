import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { applyMiscast } from '../combatFlow';
import { seedBattleRng } from '../battleRng';
import { avanceEtapeCascade } from '../cascade.testkit';
import { jouerPurifierLaChair } from './purifierLaChair.testkit';
import { createHero } from '../../engine/character';
import { hasCondition } from '../../engine/conditions';

import { testScene } from '../../scenes/test-fixture';
import { blessuresDeBase } from '../../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * Lot 4d — les Tests imbriqués des tables d'Imparfaites/Colère (« Résistance Accessible ou Sonné »,
 * « Purifier la chair » : échec à −4 DR → Inconscient EN PLUS) sont des nœuds de Flow `test` portés par `MiscastResult.testFlow`, résolus CADENCE-AWARE par
 * `applyMiscast`→`runCombatFlow` :
 *  (a) lanceur HÉROS MANUEL → étape de cascade `testDeclenche` INFLUENÇABLE (Chance/Pacte/Résilience),
 *      appendue APRÈS l'étape de révélation Imparfaite/Colère ; le palier `onFailHard` (Inconscient à
 *      −4 DR) est honoré à la validation via la Condition Flow `slThreshold ≤ −4` ;
 *  (b) lanceur ENNEMI → jet INLINE (pas de cascade), branche d'échec appliquée tout de suite.
 * Plus aucun jet de héros ne se résout en silence (fin du goal).
 */
describe('Maladresse — Test imbriqué routé cadence-aware (Lot 4d)', () => {
  function setup() {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'Mage', seed: 3 });
    banc.setState({ party: [hero] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'heros')!;
    const E = b.combatants.find((c) => c.kind === 'ennemi')!;
    H.wounds = blessuresDeBase(200, 200, H);
    E.wounds = blessuresDeBase(200, 200, E);
    banc.setState({ battle: { ...b }, pendingCascade: null, pendingLogQueue: [] });
    return { H, E };
  }

  /** Cherche la graine de `battleRng` qui, sur une Colère de `who`, produit une entrée À TEST (« Purifier
   *  la chair », « Visions sacrées »…) → une étape `testDeclenche` apparaît dans la cascade. Renvoie la
   *  graine ; on REJOUE ensuite proprement avec elle. (Le contrecoup tire d'abord le d100 de table.) */
  function seedYieldingTest(who: 'heros' | 'ennemi'): number {
    for (let s = 0; s < 300; s++) {
      const { H, E } = setup();
      seedBattleRng(s);
      applyMiscast(banc.getState, banc.setState, who === 'heros' ? H : E, 'colere');
      avanceEtapeCascade(banc.getState); // le dé du Tableau tombe à SON étape : la ligne n'existe qu'après
      const casc = banc.getState().pendingCascade;
      const hasTestStep = !!casc?.participants.some((p) => p.kind === 'testDeclenche');
      // Héros : une étape influençable (suspendue) ; Ennemi : ligne « Résistance » dans la file différée.
      const inlineTest = banc.getState().pendingLogQueue.some((q) => /Résistance/.test(q.entree.texte));
      if (who === 'heros' ? hasTestStep : inlineTest) return s;
    }
    throw new Error('aucune graine ne produit une entrée de Colère à Test');
  }

  it('(a) lanceur HÉROS MANUEL : étape testDeclenche INFLUENÇABLE appendue APRÈS la révélation', () => {
    const seed = seedYieldingTest('heros');
    const { H } = setup();
    seedBattleRng(seed);
    applyMiscast(banc.getState, banc.setState, H, 'colere');
    avanceEtapeCascade(banc.getState); // dé du Tableau → révélation + Test imbriqué appendus

    const casc = banc.getState().pendingCascade!;
    expect(casc.purpose).toBe('combat');
    // L'identité Colère vit sur une étape `miscast` (révélation), le Test imbriqué sur une étape SUIVANTE.
    const miscastIdx = casc.participants.findIndex((p) => p.kind === 'incantationImparfaite');
    const testIdx = casc.participants.findIndex((p) => p.kind === 'testDeclenche');
    expect(miscastIdx).toBeGreaterThanOrEqual(0);
    expect(testIdx).toBeGreaterThan(miscastIdx); // le Test vient APRÈS la révélation (ordre du journal)
    const step = casc.participants[testIdx];
    expect(step.actorId).toBe(H.id);
    expect(step.result).toBeFalsy();            // pas encore lancé → Chance/Pacte/Résilience possibles
    expect(step.rollLabel).toBe('Résistance');  // Test de Résistance (cadre de jet réel)
    expect(step.meta?.onFail).toBeTruthy();     // la branche d'échec voyage dans le meta (sérialisable)
  });

  it('(a bis) « Purifier la chair » HÉROS : échec à −4 DR ou moins → Inconscient EN PLUS (onFailHard)', () => {
    // Test forcé à −5 DR (≤ −4 → palier `slThreshold` honoré) : la branche d'échec entière se joue.
    const h = jouerPurifierLaChair(banc, () => setup().H);
    expect(hasCondition(h, 'sonne')).toBe(true);        // onFail : Sonné
    expect(hasCondition(h, 'inconscient')).toBe(true);  // onFailHard (slThreshold ≤ −4) : Inconscient EN PLUS
  });

  it('(b) lanceur ENNEMI : jet INLINE (pas de cascade), branche d’échec appliquée tout de suite', () => {
    const seed = seedYieldingTest('ennemi');
    const { E } = setup();
    E.characteristics.endurance = 1; // Résistance minimale → échec quasi sûr → Sonné posé inline
    seedBattleRng(seed);
    applyMiscast(banc.getState, banc.setState, E, 'colere');
    // La table de l'ennemi naît RÉSOLUE (nul siège ne le tient) ; la jouer dénoue tout, sans jamais
    // ouvrir d'étape INFLUENÇABLE : le Test imbriqué se roule inline.
    expect(banc.getState().pendingCascade!.participants[0].table!.result).toBeTruthy();
    avanceEtapeCascade(banc.getState);
    expect(banc.getState().pendingCascade?.participants.some((p) => p.kind === 'testDeclenche') ?? false).toBe(false);
    // La ligne de parité du Test (traceLineOf) part dans la file différée.
    expect(banc.getState().pendingLogQueue.some((q) => /Résistance/.test(q.entree.texte))).toBe(true);
  });
});
