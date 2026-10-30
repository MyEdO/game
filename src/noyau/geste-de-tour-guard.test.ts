import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { programmerHorsDesSites } from '../../scripts/guards/lib/gesteDeTour.mjs';

/**
 * ARMEMENT UNIQUE d'un tour d'IA (#3058) : un geste différé d'un tour décidé part au plus une fois parce qu'il n'a
 * qu'un armeur, qui l'écrit sous la clé du tour et le numérote (`armerLaSuite`), et une seule garde
 * (`jouerLaSuite`). Un différé ajouté ailleurs dans le module du tour d'IA — `programmer(…)` sous quelque nom que ce
 * soit, `afterApproach(…)` qui l'enveloppe, ou le différeur passé en valeur — ré-ouvrirait le geste lié à aucune clé (frappe ou « avancer » joué sur
 * le tour suivant). Table FIXE de deux sites, zéro violation tolérée.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const MODULE = 'src/noyau/combatFlow.ts';

/** Les SEULS sites de geste différé du module, chacun avec sa raison. */
const SITES = new Map<string, { corpsAppelle?: string; raison: string }>([
  ['armerLaSuite', { raison: 'seul armeur d’un geste différé d’un tour décidé : la suite écrite sous la clé du tour, numérotée' }],
  ['maybeRunEnemyTurn', { corpsAppelle: 'runEnemyAI', raison: 'seul point de reprise : programme la seule DÉCISION d’un tour non décidé (#1852)' }],
]);

const texte = () => readFileSync(join(ROOT, MODULE), 'utf8');
const hors = (t: string, sites: ReadonlyMap<string, { corpsAppelle?: string }> = SITES) => programmerHorsDesSites('src/noyau/fixture.ts', t, sites);

describe('armement unique d’un tour d’IA (#3058)', () => {
  it('aucun geste différé du module hors des deux sites de la table', () => {
    const vus = programmerHorsDesSites(MODULE, texte(), SITES).map((h) => `${MODULE}:${h.line} ${h.appele} (${h.fonction ?? 'hors fonction'})`);
    expect(vus, `Geste différé programmé hors de \`armerLaSuite\` — l'armer par elle :\n${vus.join('\n')}`).toEqual([]);
  });

  it('chaque site de la table programme bien (la table est EXACTE)', () => {
    const parSite = [...SITES.keys()].map((site) => [site, programmerHorsDesSites(MODULE, texte(), new Map([...SITES].filter(([s]) => s !== site))).length > 0]);
    expect(parSite).toEqual([...SITES.keys()].map((site) => [site, true]));
  });

  it('FAIL-CLOSED : chaque forme de différé hors de la table est vue', () => {
    expect(hors('function runEnemyAI() { programmer(() => advanceTurn(), 650); }'), 'nom nu').toEqual([{ line: 1, fonction: 'runEnemyAI', appele: 'programmer' }]);
    expect(hors("import { programmer as differer } from './plateforme';\nfunction runEnemyAI() { differer(() => advanceTurn(), 650); }"), 'alias d’import').toEqual([{ line: 2, fonction: 'runEnemyAI', appele: 'programmer' }]);
    expect(hors("import * as P from './plateforme';\nfunction runEnemyAI() { P.programmer(() => advanceTurn(), 650); }"), 'espace de noms').toEqual([{ line: 2, fonction: 'runEnemyAI', appele: 'programmer' }]);
    expect(hors('function runEnemyAI() { plateforme().programmer(() => advanceTurn(), 650); }'), 'accès de propriété').toEqual([{ line: 1, fonction: 'runEnemyAI', appele: 'programmer' }]);
    expect(hors("import { afterApproach } from './combatDirector';\nfunction runEnemyAI() { afterApproach(get, path, () => advanceTurn(get, set)); }"), 'enveloppe `afterApproach`').toEqual([{ line: 2, fonction: 'runEnemyAI', appele: 'afterApproach' }]);
    expect(hors('const x = () => programmer(() => {}, 0);'), 'hors fonction').toEqual([{ line: 1, fonction: null, appele: 'programmer' }]);
    expect(hors('function maybeRunEnemyTurn() { programmer(() => advanceTurn(), 650); }'), 'site de décision : un autre geste').toEqual([{ line: 1, fonction: 'maybeRunEnemyTurn', appele: 'programmer' }]);
    expect(hors('function maybeRunEnemyTurn() { programmer(() => { runEnemyAI(get, set, id); advanceTurn(get, set); }, 650); }'), 'site de décision : la décision ET un autre geste').toEqual([{ line: 1, fonction: 'maybeRunEnemyTurn', appele: 'programmer' }]);
    expect(hors("import { programmer } from './plateforme';\nconst d = programmer;\nfunction runEnemyAI() { d(() => advanceTurn(), 650); }"), 'référence hors appel').toEqual([{ line: 2, fonction: null, appele: 'programmer (référence)' }]);
  });

  it('les formes admises : tout différé d’`armerLaSuite` (flèche imbriquée comprise), la seule décision de `maybeRunEnemyTurn`', () => {
    expect(hors('function armerLaSuite() { const f = () => programmer(() => {}, 1); f(); }')).toEqual([]);
    expect(hors('function maybeRunEnemyTurn() { programmer(() => runEnemyAI(get, set, id), 650); }')).toEqual([]);
  });
});
