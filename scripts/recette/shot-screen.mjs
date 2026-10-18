#!/usr/bin/env node
// CLI de preuve navigateur : ouvre un écran, capture, remonte la console. Un cas simple ne devrait
// plus écrire AUCUN script ad hoc — voir docs/recette-navigateur.md § « Preuve headless (agents) ».
//
// Usage :
//   node scripts/recette/shot-screen.mjs --screen gallery --out <dossier absolu>
//   node scripts/recette/shot-screen.mjs --screen menu --mobile
//
// Options :
//   --screen <id>   id d'écran __wfrp (obligatoire, ex. gallery, menu, party, compendium…)
//   --out <dir>     dossier ABSOLU de sortie (défaut : DOSSIER_CAPTURES hors arbre)
//   --url <url>     URL de l'app (défaut : le port de CET arbre, cf. scripts/port-dev.mjs)
//   --mobile        viewport 360x740 (charte-ui.md, testable dès 360px)
//   --width/--height  viewport explicite (ignoré si --mobile)
//   --settle <ms>   attente après navigation avant capture (défaut 600ms)
//
// Sortie : exit 1 si la console a remonté une erreur/exception après l'ouverture de l'écran.
import { DOSSIER_CAPTURES, validerDossierCaptures, openApp, gotoScreen, shot, consoleGuard, setMobileViewport, setViewport } from './lib.mjs';

export function parseArgs(argv) {
  const out = { out: DOSSIER_CAPTURES, url: undefined, mobile: false, settle: 600 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--screen') out.screen = argv[++i];
    else if (a === '--out') out.out = argv[++i];
    else if (a === '--url') out.url = argv[++i];
    else if (a === '--mobile') out.mobile = true;
    else if (a === '--width') out.width = Number(argv[++i]);
    else if (a === '--height') out.height = Number(argv[++i]);
    else if (a === '--settle') out.settle = Number(argv[++i]);
    else throw new Error(`Option inconnue : ${a}`);
  }
  if (!out.screen) throw new Error('--screen <id> est obligatoire (ex. --screen gallery).');
  out.out = validerDossierCaptures(out.out);
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const session = await openApp(args.url, args.width || args.height
    ? { width: args.width ?? 1280, height: args.height ?? 900 }
    : undefined);
  try {
    if (args.mobile) await setMobileViewport(session);
    else if (args.width && args.height) await setViewport(session, args.width, args.height);

    const guard = consoleGuard(session);
    await gotoScreen(session, args.screen, { settleMs: args.settle });
    const path = await shot(session, args.screen, args.out);

    console.log(`capture -> ${path}`);
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
