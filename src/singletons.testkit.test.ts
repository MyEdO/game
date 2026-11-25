import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { rule, setRule, ruleDef } from './engine/policy';
import { DES_FIXES_DEFAULT, desFixes, setDesFixes } from './engine/fixedDie';
import { CADENCE_DEFAULT, cadence, setCadence } from './engine/cadence';
import { TAVERN_FAST_RULE } from './engine/tavernGame';
import { remettreLesSingletons } from './singletons.testkit';

/**
 * CONTRAT de la remise à zéro des singletons de module (`singletons.testkit.ts`) : elle rend chaque singleton à son
 * départ, et le setup l'appelle en fin de fichier. Sans l'appel de fin de fichier, une
 * règle posée par le dernier test d'un fichier se lit au corps de module du suivant (`tavern-lancers`, sous
 * `--sequence.shuffle.files --sequence.seed=3` derrière `tavern-regime-rapide`).
 */
describe('remise à zéro des singletons de module', () => {
  it('rend la règle, la cadence et les Dés fixés à leur départ', () => {
    setRule(TAVERN_FAST_RULE, !ruleDef(TAVERN_FAST_RULE)!.default);
    setDesFixes(!DES_FIXES_DEFAULT);
    setCadence('auto');
    remettreLesSingletons();
    expect(rule(TAVERN_FAST_RULE)).toBe(ruleDef(TAVERN_FAST_RULE)!.default);
    expect(desFixes()).toBe(DES_FIXES_DEFAULT);
    expect(cadence()).toBe(CADENCE_DEFAULT);
  });

  // Commentaires retirés : un appel commenté ne remet rien.
  const appelleDans = (texte: string, crochet: string): boolean =>
    texte.split(`${crochet}(`).slice(1)
      .map((suite) => suite.slice(0, suite.indexOf('\n});')).replace(/\/\/.*$/gm, ''))
      .some((corps) => corps.includes('remettreLesSingletons()'));

  // Le noyau ne l'appelle pas avant chaque test : l'ouverture du propriétaire pose ces singletons pour tout son fichier.
  it('src/test-setup-noyau.ts l’appelle en fin de fichier', () => {
    expect(appelleDans(readFileSync('src/test-setup-noyau.ts', 'utf8'), 'afterAll')).toBe(true);
  });
});
