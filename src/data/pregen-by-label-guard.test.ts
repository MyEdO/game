import { describe, it, expect } from 'vitest';
import { scanPregenByLabel } from '../../scripts/guards/lib/pregenByLabel.mjs';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import pregens from './pregens.json';
import { estSuiteVitest } from '../../scripts/guards/lib/fichierVitest.mjs';

/**
 * Garde-fou « prégénéré retrouvé PAR LABEL » (#322) : un test ne retrouve JAMAIS un `PregenDef`
 * (`pregens.json`) via `.find(… => x.name === '<nom affiché>')`/`.name.startsWith('<préfixe>')` — le
 * label est de l'AFFICHAGE (AGENTS.md, doctrine ids), fragile à tout renommage. La source unique est
 * `pretire(idsDeTest, '<id>')` (`src/data/pregens.ts`), résolution par id STABLE qui JETTE explicitement si absent. ZÉRO TOLÉRANCE (pas de baseline cliquet) :
 * la migration (#322) a ramené le compte à 0 sur les 42 sites recensés (17 fichiers) ; tout nouveau site réintroduit régresse.
 */

const NAMES = (pregens as { label: string }[]).map((p) => p.label);

/** Les `.ts(x)` de `src/**`, TESTS COMPRIS (la garde vise justement les tests), rendus par la
 *  primitive de marche `readCorpus` : chemin POSIX relatif à la racine + texte. */
const corpus = () => readCorpus(['src'], { tests: true });

describe('garde-fou « prégénéré par label » (#322)', () => {
  /** Le verdict de cette garde est une LISTE VIDE d'offenseurs : un corpus vide, ou un corpus qui
   *  aurait perdu les tests, la rendrait verte sans rien mesurer. Le peuplement est donc asserté,
   *  jamais supposé — et par une PROPRIÉTÉ (des tests sont vus, des labels existent), jamais par un
   *  cardinal, qui périmerait au fichier suivant. */
  it('PEUPLEMENT : le corpus mesuré n’est pas vide et porte des `*.test.ts(x)` — le périmètre VISE les tests', () => {
    const lu = corpus();
    expect(lu.length, 'corpus vide : la garde serait verte sans rien scanner').toBeGreaterThan(0);
    expect(
      lu.some((f) => estSuiteVitest(f.rel)),
      'aucun fichier de test dans le corpus — or c’est EXACTEMENT ce que cette garde surveille',
    ).toBe(true);
    expect(NAMES.length, 'aucun label de prégénéré : le détecteur ne chercherait rien').toBeGreaterThan(0);
  });

  it('aucun test ne recherche un prégénéré via .name/.label === <libellé> — utiliser pretire(idsDeTest, "<id>")', () => {
    const offenders: string[] = [];
    for (const { rel, text } of corpus()) {
      const findings = scanPregenByLabel(rel, text, NAMES);
      for (const fi of findings) offenders.push(`${rel}:${fi.line} : ${fi.detail}`);
    }
    expect(
      offenders,
      'Prégénéré(s) retrouvé(s) par LABEL — migrer vers pretire(idsDeTest, "<id>") ' +
        `(src/data/pregens.ts) :\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('fail-closed : détecte un motif fictif de lookup par label (preuve TDD)', () => {
    const fake = "const w = pregens.find((p) => p.name === 'Harbull Piedvelu');";
    expect(scanPregenByLabel('fake.test.ts', fake, NAMES)).toHaveLength(1);
    const fakeStartsWith = "const w = party.find((h) => h.name.startsWith('Harbull'));";
    expect(scanPregenByLabel('fake.test.ts', fakeStartsWith, NAMES)).toHaveLength(1);
    const legit = "const w = pretire(idsDeTest, 'wanda-weltschmertz');";
    expect(scanPregenByLabel('fake.test.ts', legit, NAMES)).toHaveLength(0);
  });
});
