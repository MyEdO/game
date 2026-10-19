// GATE `comptes:plage` (#2705) : aucune donnée de la plage `merge-base(origin/main, HEAD)..HEAD` ne fait
// monter le compte d'un site d'une collection à compte, ni n'y fait naître un site (`jugerLesComptes`,
// scripts/guards/lib/corpusDesComptes.mts). `--base <ref>` remplace `origin/main`. Rend 1 au refus.
import { TRONC, depotDe } from './lib/gitPorte.mjs';
import { jugerLesComptes } from './lib/corpusDesComptes.mts';

if (import.meta.main) {
  const rang = process.argv.indexOf('--base');
  const base = rang === -1 ? TRONC.suivi : process.argv[rang + 1];
  const debut = Date.now();
  const { ok, texte } = jugerLesComptes({ depot: depotDe(process.cwd()), base });
  const ligne = `[comptes:plage] ${texte} (${((Date.now() - debut) / 1000).toFixed(1)} s)\n`;
  if (ok) process.stdout.write(ligne);
  else {
    process.stderr.write(ligne);
    process.exitCode = 1;
  }
}
