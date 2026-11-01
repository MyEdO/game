/**
 * Régénère TOUTES les galeries QC depuis le code/l'art existant, en une commande.
 *   npm run galleries        (ou : node scripts/gen-galleries.mjs)
 * Chaque galerie est produite par son générateur dédié ; le hub est public/galeries.html.
 */
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const GALERIES = Object.freeze([
  { label: 'Icônes UI (registre <Icon>)', module: './gen-icon-gallery.mts' },
  { label: 'Décor — planche-contact (props, dont orientés en 3 vues)', module: './_qc-decor-sheet.mts' },
  { label: 'Mobilier volumique — 4 rotations + dessus + vignette', module: './qc/render-props-volumiques.mts' },
]);

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let ok = 0;
  const failed = [];
  for (const { label, module } of GALERIES) {
    process.stdout.write(`\n▶ ${label}\n`);
    try {
      execFileSync(process.execPath, ['--import', 'tsx', fileURLToPath(new URL(module, import.meta.url))], {
        stdio: 'inherit', cwd: resolve(dirname(fileURLToPath(import.meta.url)), '..'),
      });
      ok++;
    } catch {
      failed.push(label);
      console.error(`  ✗ ÉCHEC : ${module}`);
    }
  }
  console.log(`\nGaleries régénérées : ${ok}/${GALERIES.length} OK${failed.length ? ` — échecs : ${failed.join(', ')}` : ''}.`);
  console.log('Hub : public/galeries.html');
  if (failed.length) process.exitCode = 1;
}
