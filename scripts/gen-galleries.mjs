/**
 * Régénère TOUTES les galeries QC depuis le code/l'art existant, en une commande.
 *   npm run galleries        (ou : node scripts/gen-galleries.mjs)
 * Chaque galerie est produite par son générateur dédié ; le hub est public/galeries.html.
 */
import { execSync } from 'node:child_process';

const STEPS = [
  ['Bestiaire — rendu en jeu (rig)', 'npx tsx scripts/gen-bestiary-gallery.mts'],
  ['Tenues de carrière', 'npx tsx scripts/gen-tenue-gallery.mts'],
  ['Rig — espèces × équipement', 'npx tsx scripts/gen-rig-gallery.mts'],
  ['Mutations physiques (LDB 19)', 'npx tsx scripts/gen-mutations-gallery.mts'],
  ['Armes', 'npx tsx scripts/gen-weapon-gallery.mts'],
  ['Icônes d’objet (ItemIcon)', 'npx tsx scripts/gen-item-icon-gallery.mts'],
  ['Icônes UI (registre <Icon>)', 'npx tsx scripts/gen-icon-gallery.mts'],
  ['Animations par arme (animé)', 'npx tsx scripts/gen-anim-gallery.mts'],
  ['Animations — clips & sorts (animé)', 'npx tsx scripts/gen-clip-anim-gallery.mts'],
  ['Bestiaire — attaques (traits, animé)', 'npx tsx scripts/gen-creature-attacks-gallery.mts'],
  ['Tenues — 3 vues', 'npx tsx scripts/gen-tenue-views-gallery.mts'],
  ['Engins de siège — planche-contact 3 vues', 'npx tsx scripts/gen-engin-views-gallery.mts'],
  ['Décor — planche-contact (props, dont orientés en 3 vues)', 'npx tsx scripts/_qc-decor-sheet.mts'],
  ['Objets orientés — couverture de vues + rotation caméra', 'npx tsx scripts/gen-oriented-objects-gallery.mts'],
  ['Mobilier volumique — 4 rotations + dessus + vignette', 'npx tsx scripts/qc/render-props-volumiques.mts'],
  ['Toise — échelles en jeu', 'npx tsx scripts/gen-toise-gallery.mts'],
  ['Debug — ancrage sol & armes', 'npx tsx scripts/_dbg-species.mts'],
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
