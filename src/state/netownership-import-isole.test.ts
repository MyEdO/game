/**
 * #1054 — `netOwnership` s'importe SEUL, sans monter le store. La table de possession (`ROUTES`,
 * #1051) doit être énumérable hors environnement de test complet (script, garde CI légère). Le
 * graphe `combatOrParty → targetingModes → … → store.ts` EXISTE (sonde (c) ci-dessous) : tout import
 * runtime de `netOwnership` vers cette famille de modules monte le store à l'import — et le store
 * s'évalue en `ReferenceError: Cannot access 'testRouter' before initialization`.
 *
 * DEUX mesures, complémentaires :
 *  (a) le CHEMIN RÉEL — un process `tsx` importe le module seul et doit sortir 0 (~0,25 s) ;
 *  (b) la CHAÎNE — fermeture transitive des imports RUNTIME du fichier : `store.ts` ne doit pas y
 *      être atteignable, et l'échec NOMME le chemin fautif. (a) seule cesserait de mordre le jour
 *      où le store s'évaluerait sans crasher ; (b) seule ne mesure pas ce que le moteur exécute.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { arcsDe, estModule, sourceALExecution } from '../../scripts/guards/lib/importGraph.mjs';
import { canoniser } from '../../scripts/docs/lib/chemin-mesure.mjs';

const RACINE = fileURLToPath(new URL('../..', import.meta.url));
const ENTREE = join(RACINE, 'src', 'state', 'netOwnership.ts');
const LOURD = join(RACINE, 'src', 'state', 'combatOrParty.ts');
const STORE = join(RACINE, 'src', 'state', 'store.ts');

const cheminCanonique = (fichier: string) => canoniser(fichier).replace(/\\/g, '/');

/** Chemin d'import RUNTIME de `depuis` vers `cible`, ou `null` s'il n'y en a pas (BFS = le plus court). */
function chemin(depuis: string, cible: string): string[] | null {
  depuis = cheminCanonique(depuis);
  cible = cheminCanonique(cible);
  const vus = new Map<string, string[]>([[depuis, [depuis]]]);
  const file = [depuis];
  while (file.length) {
    const f = file.shift()!;
    if (!estModule(f)) continue;
    for (const arc of arcsDe(f, sourceALExecution(f, readFileSync(f, 'utf8')))) {
      const suiv = cheminCanonique(arc.cible);
      if (vus.has(suiv)) continue;
      const route = [...vus.get(f)!, suiv];
      if (suiv === cible) return route;
      vus.set(suiv, route);
      file.push(suiv);
    }
  }
  return null;
}

const lisible = (route: string[] | null) => route?.map((f) => relative(RACINE, f).replace(/\\/g, '/')) ?? null;

describe('#1054 — `netOwnership` s’importe SEUL', () => {
  it('le BFS suit require et import dynamique, efface les types et rend le chemin le plus court', () => {
    const racine = mkdtempSync(join(tmpdir(), 'netownership-bfs-'));
    try {
      const fichier = (nom: string) => join(racine, `${nom}.ts`);
      const route = (...noms: string[]) => noms.map((nom) => cheminCanonique(fichier(nom)));
      writeFileSync(fichier('entree'), [
        "require('./court');",
        "import './long';",
        "import('./dynamique');",
        "import type { T } from './typeExplicite';",
        "import { U } from './typeImplicite';",
        'let u: U;',
      ].join('\n'));
      writeFileSync(fichier('long'), "import './pont';");
      writeFileSync(fichier('pont'), "import './cible';");
      writeFileSync(fichier('court'), "require('./cible');");
      writeFileSync(fichier('dynamique'), "import('./finDynamique');");
      for (const nom of ['cible', 'finDynamique', 'typeExplicite', 'typeImplicite'])
        writeFileSync(fichier(nom), 'export type T = number; export type U = number;');
      expect(chemin(fichier('entree'), fichier('cible'))).toEqual(route('entree', 'court', 'cible'));
      expect(chemin(fichier('entree'), fichier('finDynamique'))).toEqual(route('entree', 'dynamique', 'finDynamique'));
      expect(chemin(fichier('entree'), fichier('typeExplicite'))).toBeNull();
      expect(chemin(fichier('entree'), fichier('typeImplicite'))).toBeNull();
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it('(a) chemin RÉEL : un process qui importe le module seul sort 0 et lit la table', () => {
    const r = spawnSync(
      process.execPath,
      ['--import', 'tsx', '-e', "import('./src/state/netOwnership.ts').then((m) => { if (!(m.ROUTES.size > 200)) { throw new Error('table vide'); } })"],
      { cwd: RACINE, encoding: 'utf8' },
    );
    expect(r.stderr + r.stdout, 'l’import isolé de netOwnership échoue — un import LOURD est revenu').toBe('');
    expect(r.status, 'code de sortie de l’import isolé').toBe(0);
  });

  it('(b) CHAÎNE : `store.ts` n’est pas atteignable par les imports runtime du module', () => {
    expect(
      lisible(chemin(ENTREE, STORE)),
      'chaîne d’import runtime qui monte le store — la donnée doit descendre dans un module FEUILLE (patron `targetingHolder`/`combatants`)',
    ).toBeNull();
  });

  it('le détecteur de chaîne MORD : depuis `combatOrParty` (lourd), le chemin vers le store EXISTE', () => {
    // Sans cette sonde, un résolveur cassé rendrait `null` partout et (b) serait vert à tort.
    const route = lisible(chemin(LOURD, STORE));
    expect(route?.[0], 'le BFS ne part pas du module attendu').toBe('src/state/combatOrParty.ts');
    expect(route?.[(route?.length ?? 0) - 1]).toBe('src/state/store.ts');
    expect(route!.length, 'chaîne du lourd vers le store').toBeGreaterThan(1);
  });
});
