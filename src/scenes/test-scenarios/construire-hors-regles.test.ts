/**
 * La construction d'un scénario ne lit pas ses règles (#2898) : le lancement (`lancementDuScenario`) construit
 * le contenu AVANT que `poserLeLancement` ne pose les règles de la fiche. Un scénario dont `construire` lirait
 * une de ses règles se construirait sous les règles d'avant.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { testScenarios } from './index';
import { resetRule, setRule } from '../../engine/policy';

/** Le contenu construit, aux compteurs d'uid près : deux constructions successives numérotent à la suite. */
const forme = (contenu: unknown): string =>
  JSON.stringify(contenu, (_k, v) => (typeof v === 'function' ? 'fn' : v)).replace(/"(it|uid|c|e|n|p|ent|obj)-\d+"/g, '"$1-#"').replace(/-\d{3,}/g, '-#');

const aRegles = testScenarios.filter((sc) => sc.rules);

describe('construire, hors des règles de la fiche', () => {
  afterEach(() => {
    for (const sc of aRegles) for (const id of Object.keys(sc.rules!)) resetRule(id);
  });

  it('témoin : des scénarios portent des règles', () => {
    expect(aRegles.length).toBeGreaterThan(0);
  });

  it.each(aRegles.map((sc) => [sc.id, sc] as const))('%s se construit à l’identique sous ses règles', (_id, sc) => {
    const sansRegles = forme(sc.construire());
    expect(forme(sc.construire()), 'témoin : deux constructions sans règles diffèrent').toBe(sansRegles);
    for (const [id, v] of Object.entries(sc.rules!)) setRule(id, v);
    expect(forme(sc.construire()), 'la construction lit une règle de la fiche').toBe(sansRegles);
  });
});
