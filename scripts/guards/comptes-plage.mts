// GATE `comptes:plage` (#2705, #3021) : aucun changement de la plage `merge-base(origin/main, HEAD)..HEAD` ne fait
// monter le compte d'un site sous la porte, n'y fait naître un site, ni ne fait céder un plancher (`jugerLesComptes`,
// scripts/guards/lib/corpusDesComptes.mts). `--base <ref>` remplace `origin/main`. Rend 1 au refus.
// Hors `--index` (la porte du commit, `porte-du-commit.mjs`), imprime ensuite l'INVENTAIRE de la dette que la donnée de
// l'arbre révèle (`inventaireDeDette.mts`) et l'ajoute au résumé du job (`GITHUB_STEP_SUMMARY`) quand il est posé. Son
// CONTENU ne change pas le code de sortie ; une mesure de l'inventaire qui lève fait échouer le job.
import { appendFileSync, readFileSync } from 'node:fs';
import { INDEX, TRONC, depotDe } from './lib/gitPorte.mjs';
import { jugerLesComptes } from './lib/corpusDesComptes.mts';
import { inventaireDeLaRacine, rendreInventaire } from './lib/inventaireDeDette.mts';

if (import.meta.main) {
  const rang = process.argv.indexOf('--base');
  const base = rang === -1 ? TRONC.suivi : process.argv[rang + 1];
  const debut = Date.now();
  const index = process.argv.includes('--index');
  const { ok, texte } = jugerLesComptes({ depot: depotDe(process.cwd()), base,
    ...(index ? { tete: INDEX, message: readFileSync(0, 'utf8') } : {}) });
  const ligne = `[comptes:plage] ${texte} (${((Date.now() - debut) / 1000).toFixed(1)} s)\n`;
  if (ok) process.stdout.write(ligne);
  else {
    process.stderr.write(ligne);
    process.exitCode = 1;
  }
  if (!index) {
    const inventaire = `## Inventaire de la dette de l’arbre\n\n${rendreInventaire(inventaireDeLaRacine(process.cwd()))}`;
    process.stdout.write(`${inventaire}\n`);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${inventaire}\n`);
  }
}
