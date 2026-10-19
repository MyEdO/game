#!/usr/bin/env node
// Recette navigateur — gabarit ÉDITEUR de couche inférieure (#830 suite, opacité réglable) :
// ouvre l'éditeur, charge « La Diligence — exploration », passe en Couche 1 (vue plan par défaut),
// capture au réglage par défaut puis aux deux extrêmes du curseur d'opacité du gabarit.
//
// Usage : node scripts/recette/shot-editor-lower-layer-gabarit.mjs [--url <url>] [--out dir]
import { DOSSIER_CAPTURES, validerDossierCaptures, openApp, gotoScreen, waitFor, shot, VUE_REFERENCE, clickButtonByText, champParLibelle, selectOption } from './lib.mjs';
import { evaluate, sleep } from './cdp.mjs';

export function parseArgs(argv) {
  const out = { url: undefined, out: DOSSIER_CAPTURES };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--url') out.url = argv[++i];
    else if (argv[i] === '--out') out.out = argv[++i];
  }
  out.out = validerDossierCaptures(out.out);
  return out;
}

export async function choisirEtage(session, z) {
  const selecteur = await champParLibelle(session, 'Étage', { dans: '.ed-level-bar' });
  if (!selecteur) throw new Error('choisirEtage : contrôle Étage absent');
  await selectOption(session, selecteur, String(z), { par: 'valeur' });
  await waitFor(session, `document.querySelector(${JSON.stringify(selecteur)})?.value === ${JSON.stringify(String(z))}`);
}

/** Fixe la valeur du curseur `.ed-subfield input[type=range]` (le gabarit, seul range de la
 *  barre d'étages) en dispatchant `input`+`change` — React écoute `onChange`. */
async function setGabaritSlider(session, pct) {
  await evaluate(session, `(() => {
    const input = document.querySelector('.ed-level-bar .ed-subfield input[type="range"]');
    if (!input) throw new Error('curseur du gabarit introuvable');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, String(${pct}));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  // Ce script OUVRE un écran pour le juger à l'œil : il le cadre à la vue de référence des recettes
  // (`vues-recette.json`), pas à un couple qui lui serait propre.
  const session = await openApp(args.url ?? undefined, { width: VUE_REFERENCE.largeur, height: VUE_REFERENCE.hauteur, console: true });
  try {
    const guard = session.console;

    await gotoScreen(session, 'editor');
    await waitFor(session, `!!document.querySelector('svg.editor-iso')`);

    await clickButtonByText(session, 'Fichier', { exact: false });
    await sleep(150);
    await clickButtonByText(session, 'Ouvrir', { exact: false });
    await waitFor(session, `!!document.querySelector('.listrow')`);
    await clickButtonByText(session, 'Ouvrir', { rangee: 'La Diligence — exploration', dans: '.modal-overlay' });
    await waitFor(session, `!!document.querySelector('svg.editor-iso') && !document.querySelector('.wide')`);
    // Tracé réel dessiné (pas une carte vide) — attendre le nombre de formes, jamais un délai fixe.
    await waitFor(session, `document.querySelectorAll('svg.editor-iso path, svg.editor-iso polygon').length > 200`, { timeoutMs: 10000 });

    await choisirEtage(session, 1);
    console.log('étage actif : 1');
    await sleep(200);

    const shapeCount = await evaluate(session, `document.querySelectorAll('svg.editor-iso path, svg.editor-iso polygon').length`);
    console.log('formes SVG dessinées (Couche 1) :', shapeCount);
    if (!shapeCount) throw new Error('capture vide — aucune forme dessinée en Couche 1');

    // 1) Réglage par DÉFAUT du curseur.
    const defaultPct = await evaluate(session, `document.querySelector('.ed-level-bar .ed-subfield input[type="range"]')?.value`);
    console.log('gabarit — valeur par défaut du curseur :', defaultPct);
    await shot(session, 'editor-couche1-gabarit-defaut', args.out);

    // 2) Extrême BAS (0 = masqué).
    await setGabaritSlider(session, 0);
    await sleep(150);
    await shot(session, 'editor-couche1-gabarit-min', args.out);

    // 3) Extrême HAUT (100 = plein).
    await setGabaritSlider(session, 100);
    await sleep(150);
    await shot(session, 'editor-couche1-gabarit-max', args.out);

    const errors = guard.errors();
    if (errors.length) {
      console.error(`console — ${errors.length} erreur(s)/exception(s) :`);
      for (const e of errors) console.error(`  [${e.type}] ${e.text}`);
      process.exitCode = 1;
    } else {
      console.log('console — 0 erreur');
    }
  } finally {
    await session.close();
  }
}

if (import.meta.main) main().catch((e) => {
  console.error(`ERR ${e.message}`);
  process.exit(1);
});
