import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { estCheminDuBudget, importsDe } from '../guards/budget-contexte.mjs';
import { depotDe, racineDe, ceQuiChange, listerImage, lireEnLot, INDEX, SUIVI, TRAVAIL } from '../guards/lib/gitPorte.mjs';
import { codeEnfant } from './partition.mjs';

const RACINE = fileURLToPath(new URL('../..', import.meta.url));
const CONTRATS = ['src/data/structures-contrat.test.ts', 'src/data/slots-contrat.test.ts', 'src/data/schemas/grammaire/flow-de-scene.test.ts'];
const INTEGRITE = ['src/data/maison-sans-source.test.ts', 'src/data/refs-migrated.test.ts'];
const lireTravail = (depot) => {
  try { return readFileSync(resolve(racineDe(depot), 'CLAUDE.md'), 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
};

export function testsDuCorpusPour(fichiers, importsAvantApres = []) {
  const tests = new Set();
  let raw = false, budget = false;
  for (const fichier of fichiers) {
    const f = fichier.replace(/\\/g, '/');
    if (/^src\/(scenes|data)\/.*\.json$/.test(f)) {
      for (const test of CONTRATS) tests.add(test);
      for (const test of INTEGRITE) tests.add(test);
    }
    if ([...CONTRATS, ...INTEGRITE].includes(f) || f.startsWith('scripts/guards/lib/integriteStock.')) {
      if (f.startsWith('scripts/')) for (const test of INTEGRITE) tests.add(test);
      else tests.add(f);
    }
    if (f.startsWith('Source/') || f.startsWith('scripts/raw/')) raw = true;
    if (f === 'scripts/guards/budget-contexte.mjs' || f === 'scripts/guards/budget-contexte.test.mjs' || estCheminDuBudget(f, importsAvantApres)) budget = true;
  }
  const selections = [];
  if (tests.size) selections.push({ lanceur: 'npm test', tests: [...tests].sort() });
  if (raw) selections.push({ lanceur: 'node-tests', gate: 'test:raw' });
  if (budget) {
    selections.push({ lanceur: 'node --test', tests: ['scripts/guards/budget-contexte.test.mjs'] });
    selections.push({ lanceur: 'node --test', tests: ['scripts/git-hooks/porte-du-commit.test.mjs'], motif: 'budget' });
  }
  return selections;
}

export function fichiersDuCorpusDepuis(base, depot = depotDe(RACINE), lecteurs = { ceQuiChange, listerImage, lireEnLot, lireTravail }) {
  const suivis = lecteurs.ceQuiChange(depot, base, SUIVI).chemins();
  const tete = new Set(lecteurs.listerImage(depot, 'HEAD'));
  const nonSuivis = lecteurs.listerImage(depot, TRAVAIL).filter((f) => !tete.has(f));
  const imports = new Set();
  for (const image of [base, 'HEAD', INDEX]) {
    for (const fichier of importsDe(lecteurs.lireEnLot(depot, image, ['CLAUDE.md']).get('CLAUDE.md'))) imports.add(fichier);
  }
  for (const fichier of importsDe(lecteurs.lireTravail(depot))) imports.add(fichier);
  return { fichiers: [...new Set([...suivis, ...nonSuivis])].sort(), imports: [...imports] };
}

export function jouerTestsDuCorpus(selections, { lancer = spawnSync, cwd = RACINE, journal = console.log } = {}) {
  const refus = [];
  for (const selection of selections) {
    journal(JSON.stringify(selection));
    const args = selection.lanceur === 'npm test' ? ['scripts/test/run.mjs', ...selection.tests]
      : selection.lanceur === 'node-tests' ? ['scripts/test/node-tests.mjs', selection.gate]
        : ['--test', ...(selection.motif ? [`--test-name-pattern=${selection.motif}`] : []), ...selection.tests];
    const enfant = lancer(process.execPath, args, { cwd, stdio: 'inherit' });
    const code = codeEnfant(enfant.status, enfant.signal);
    if (code) refus.push({ ...selection, code });
  }
  return refus;
}

export function lireArgumentsCorpus(args) {
  let base;
  const fichiers = [];
  for (let i = 0; i < args.length; i++) {
    if (!['--base', '--fichier'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error('usage : test:corpus -- --base <ref> ou --fichier <chemin> (répétable)');
    if (args[i] === '--base') base = args[++i];
    else fichiers.push(args[++i].replace(/\\/g, '/'));
  }
  if (!base && !fichiers.length) throw new Error('nommer --base ou au moins un --fichier');
  return { base, fichiers };
}

if (import.meta.main) {
  try {
    const { base, fichiers } = lireArgumentsCorpus(process.argv.slice(2));
    const observes = base ? fichiersDuCorpusDepuis(base) : { fichiers: [], imports: [] };
    if (!base) {
      const depot = depotDe(RACINE);
      for (const image of ['HEAD', INDEX]) observes.imports.push(...importsDe(lireEnLot(depot, image, ['CLAUDE.md']).get('CLAUDE.md')));
      observes.imports.push(...importsDe(lireTravail(depot)));
    }
    const selections = testsDuCorpusPour([...observes.fichiers, ...fichiers], observes.imports);
    console.log('[corpus] sélection : ' + JSON.stringify(selections));
    process.exitCode = jouerTestsDuCorpus(selections).length ? 1 : 0;
  } catch (error) {
    console.error('[corpus] ' + error.message);
    process.exitCode = 2;
  }
}
