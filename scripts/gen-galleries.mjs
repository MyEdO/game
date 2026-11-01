/**
 * Régénère TOUTES les galeries QC depuis le code/l'art existant, en une commande.
 *   npm run galleries        (ou : node scripts/gen-galleries.mjs)
 * Chaque galerie est produite par son générateur dédié ; le hub est public/galeries.html.
 */
import { execSync } from 'node:child_process';

const STEPS = [
  ['Icônes d’objet (ItemIcon)', 'npx tsx scripts/gen-item-icon-gallery.mts'],
  ['Icônes UI (registre <Icon>)', 'npx tsx scripts/gen-icon-gallery.mts'],
  ['Décor — planche-contact (props, dont orientés en 3 vues)', 'npx tsx scripts/_qc-decor-sheet.mts'],
  ['Mobilier volumique — 4 rotations + dessus + vignette', 'npx tsx scripts/qc/render-props-volumiques.mts'],
];

let ok = 0;
const failed = [];
for (const [label, cmd] of STEPS) {
  process.stdout.write(`\n▶ ${label}\n`);
  try {
    execSync(cmd, { stdio: 'inherit' });
    ok++;
  } catch {
    failed.push(label);
    console.error(`  ✗ ÉCHEC : ${cmd}`);
  }
}
console.log(`\nGaleries régénérées : ${ok}/${STEPS.length} OK${failed.length ? ` — échecs : ${failed.join(', ')}` : ''}.`);
console.log('Hub : public/galeries.html');
if (failed.length) process.exitCode = 1;
