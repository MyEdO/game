import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { rule, setRule, ruleDef } from './engine/policy';
import { DES_FIXES_DEFAULT, desFixes, setDesFixes } from './engine/fixedDie';
import { TAVERN_FAST_RULE } from './engine/tavernGame';
import { remettreLesSingletons } from './singletons.testkit';

/**
 * CONTRAT de la remise à zéro des singletons de module (`singletons.testkit.ts`) : elle rend chaque singleton à son
 * départ, et les DEUX setups l'appellent avant chaque test et en fin de fichier. Sans l'appel de fin de fichier, une
 * règle posée par le dernier test d'un fichier se lit au corps de module du suivant (`tavern-lancers`, sous
 * `--sequence.shuffle.files --sequence.seed=3` derrière `tavern-regime-rapide`).
 */
describe('remise à zéro des singletons de module', () => {
  it('rend la règle et les Dés fixés à leur départ', () => {
    setRule(TAVERN_FAST_RULE, !ruleDef(TAVERN_FAST_RULE)!.default);
    setDesFixes(!DES_FIXES_DEFAULT);
    remettreLesSingletons();
    expect(rule(TAVERN_FAST_RULE)).toBe(ruleDef(TAVERN_FAST_RULE)!.default);
    expect(desFixes()).toBe(DES_FIXES_DEFAULT);
  });

  it.each(['src/test-setup.ts', 'src/test-setup-noyau.ts'])('%s l’appelle avant chaque test et en fin de fichier', (setup) => {
    const texte = readFileSync(setup, 'utf8');
    for (const crochet of ['beforeEach', 'afterAll']) {
      const corps = texte.split(`${crochet}(`).slice(1).map((suite) => suite.slice(0, suite.indexOf('\n});')));
      expect(corps.some((c) => c.includes('remettreLesSingletons()')), `${setup} › ${crochet}`).toBe(true);
    }
  });
});
