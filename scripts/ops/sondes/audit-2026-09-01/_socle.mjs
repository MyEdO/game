/**
 * SOCLE des sondes de l'audit 2026-09-01 (#1679) — résolution PORTABLE des deux racines dont
 * toute sonde a besoin, et d'elles seules :
 *   - `RACINE`    : la racine du dépôt. `process.cwd()` si un `package.json` y est posé, sinon
 *                   `git rev-parse --show-toplevel`. Aucune sonde ne porte de chemin de machine.
 *   - `donnees()` : le DOSSIER DE DONNÉES passé en `argv[2]` — il porte les dumps `gh` en entrée et
 *                   reçoit les artefacts intermédiaires en sortie. Il vit HORS du dépôt : une sonde
 *                   est en lecture seule sur l'arbre.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

/** REND la racine du dépôt, sans jamais dépendre du chemin d'une machine. */
function racineDepot() {
  if (existsSync(join(process.cwd(), 'package.json'))) return process.cwd();
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
}

export const RACINE = racineDepot();

/**
 * REND le dossier de données passé en `argv[2]`, ou ARRÊTE la sonde (code 2) avec son mode d'emploi.
 * @param {string} usage ce que la sonde attend d'y trouver (dumps) et d'y écrire (artefacts).
 */
export function donnees(usage) {
  const d = process.argv[2];
  if (!d) {
    process.stderr.write(
      'Usage : node <sonde> <dossier-de-données>\n' +
      `  <dossier-de-données> : dossier HORS dépôt. ${usage}\n` +
      '  Recettes de (re)fabrication des dumps : scripts/ops/sondes/audit-2026-09-01/README.md\n',
    );
    process.exit(2);
  }
  if (!existsSync(d)) {
    process.stderr.write(`Dossier de données introuvable : ${d}\n`);
    process.exit(2);
  }
  return d;
}
