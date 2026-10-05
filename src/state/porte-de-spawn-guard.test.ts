/**
 * Garde de la PORTE DE SPAWN (#2097) : un `Combatant` né d'une fiche de créature ou d'un statbloc sort
 * de `spawnEnemy` (`src/state/spawn.ts`, le foyer), qui le copie en profondeur. Hors du foyer, dans le
 * code de PRODUCTION de `src/` et `scripts/`, aucun appel à `creatureToCombatant` ni à
 * `statblockToCombatant` importés de ce foyer (`appelReserve`). Aucune exception.
 *
 * Ce que cette garde ne voit pas : la fonction passée en valeur (`xs.map(creatureToCombatant)`) ou
 * liée à un autre nom avant l'appel, et l'appel à travers un RÉEXPORT (`export { creatureToCombatant }
 * from './spawn'` dans un autre module, appelé depuis un troisième).
 */
import { describe, it, expect } from 'vitest';
import { appelReserve, constructionsReserveesDuCorpus, scanConstructionsReservees } from '../../scripts/guards/lib/canonUnique.mjs';
import { corpusDesGardes } from '../../scripts/guards/lib/commentPoison.mjs';
import { estFichierVitest } from '../../scripts/guards/lib/fichierVitest.mjs';

const FOYER = 'src/state/spawn.ts';

const PORTE_DE_SPAWN = [{
  ...appelReserve({ nom: 'constructeur hors de la porte de spawn', fonctions: { [FOYER]: ['creatureToCombatant', 'statblockToCombatant'] } }),
  foyer: FOYER,
  domaine: (rel: string) => !estFichierVitest(rel),
}];

const IMPORTE = "import { creatureToCombatant, statblockToCombatant } from './spawn';\n";

/** Les constructions reconnues dans un texte, par défaut un module de `src/state/`. */
const fixture = (text: string, rel = 'src/state/fixture.ts') =>
  scanConstructionsReservees({ rel, text }, PORTE_DE_SPAWN).map((t) => t.construction);
const VUE = ['constructeur hors de la porte de spawn'];

describe('porte de spawn (#2097)', () => {
  it('aucun constructeur appelé hors de `spawnEnemy` dans le code de production', () => {
    expect(constructionsReserveesDuCorpus(corpusDesGardes(), PORTE_DE_SPAWN)).toEqual([]);
  });

  it('un appel importé, renommé ou par espace de noms', () => {
    expect(fixture(`${IMPORTE}const c = creatureToCombatant(cr, id, pos);`)).toEqual(VUE);
    expect(fixture(`${IMPORTE}const c = statblockToCombatant(sb, id, pos);`)).toEqual(VUE);
    expect(fixture("import { creatureToCombatant as fiche } from './spawn';\nconst c = fiche(cr, id, pos);"), 'renommé').toEqual(VUE);
    expect(fixture("import * as S from './spawn';\nconst c = S.statblockToCombatant(sb, id, pos);"), 'espace de noms').toEqual(VUE);
  });

  it('la porte, les homonymes, le foyer et les tests', () => {
    expect(fixture("import { spawnEnemy } from './spawn';\nconst c = spawnEnemy({ ref: 'gobelin' }, id, pos);")).toEqual([]);
    expect(fixture('const creatureToCombatant = (x) => x;\nconst c = creatureToCombatant(cr);'), 'homonyme local').toEqual([]);
    expect(fixture(`${IMPORTE}const c = creatureToCombatant(cr, id, pos);`, FOYER)).toEqual([]);
    expect(fixture(`${IMPORTE}const c = creatureToCombatant(cr, id, pos);`, 'src/state/fixture.test.ts')).toEqual([]);
  });
});
