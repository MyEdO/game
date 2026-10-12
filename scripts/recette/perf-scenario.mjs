#!/usr/bin/env node
// CLI de preuve de PERFORMANCE (cadence rAF + profil CPU) sur un scénario de test — réutilise le
// socle CDP de lib.mjs (mêmes primitives que shot-screen.mjs), ZÉRO second socle. Un scénario se
// charge par `window.__wfrp.scenario(id, seed)` (state/devtools.ts) — tout id de
// `src/scenes/test-scenarios/*.ts` est jouable (ex. diligence, arene).
//
// Usage :
//   node scripts/recette/perf-scenario.mjs --scenario diligence
//   node scripts/recette/perf-scenario.mjs --scenario arene --mode profile
//   node scripts/recette/perf-scenario.mjs --scenario diligence --mode cadence --seed 7 --click-x 700 --click-y 620
//
// Options :
//   --scenario <id>     id du scénario __wfrp.scenario (défaut : diligence)
//   --mode <cadence|profile>  cadence = intervalles rAF repos/rotation/marche (défaut) ;
//                        profile = temps CPU propre par fonction pendant une marche (CDP Profiler)
//   --seed <n>           graine RNG du scénario (défaut 42)
//   --url <url>           URL de l'app (défaut : le port de CET arbre, cf. scripts/port-dev.mjs)
//   --click-x/--click-y   coordonnées écran du clic de marche (défaut 700,620 — case de sol visible
//                         au chargement par défaut ; à ajuster si le scénario cadre différemment)
//   --sampling-interval   µs entre échantillons du profileur CDP (mode profile, défaut 200)
//
// Sortie : statistiques imprimées sur stdout, exit 1 si la console a remonté une erreur.
import { openApp, evaluate, sleep, consoleGuard, realKey, geste, clic, SURFACE_CARTE } from './lib.mjs';

/** Clic RÉEL de marche au point demandé, sur la surface de carte (`geste`). */
const clicDeMarche = (session, args) => geste(session, { surface: SURFACE_CARTE, x: args.clickX, y: args.clickY }, { qui: 'perf-scenario' }, clic());

function parseArgs(argv) {
  const out = { scenario: 'diligence', mode: 'cadence', seed: 42, url: undefined, clickX: 700, clickY: 620, samplingInterval: 200 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--scenario') out.scenario = argv[++i];
    else if (a === '--mode') out.mode = argv[++i];
    else if (a === '--seed') out.seed = Number(argv[++i]);
    else if (a === '--url') out.url = argv[++i];
    else if (a === '--click-x') out.clickX = Number(argv[++i]);
    else if (a === '--click-y') out.clickY = Number(argv[++i]);
    else if (a === '--sampling-interval') out.samplingInterval = Number(argv[++i]);
    else throw new Error(`Option inconnue : ${a}`);
  }
  if (out.mode !== 'cadence' && out.mode !== 'profile') throw new Error(`--mode invalide : ${out.mode} (cadence|profile)`);
  return out;
}

/** Échantillonne les intervalles entre images pendant `ms`, renvoie le tableau brut (ms). */
const SAMPLER = (ms) => `new Promise((res) => {
  const t = []; let last = performance.now(); const t0 = last;
  const tick = (now) => { t.push(now - last); last = now;
    if (now - t0 < ${ms}) requestAnimationFrame(tick); else res(t); };
  requestAnimationFrame(tick);
})`;

function stats(label, arr) {
  const a = [...arr].sort((x, y) => x - y);
  const n = a.length;
  if (!n) return `${label}: aucune image`;
  const med = a[Math.floor(n / 2)];
  const p95 = a[Math.floor(n * 0.95)];
  const moy = a.reduce((s, v) => s + v, 0) / n;
  return `${label}: ${n} images | médiane ${med.toFixed(1)}ms (${(1000 / med).toFixed(1)} fps) `
    + `| moy ${moy.toFixed(1)}ms | p95 ${p95.toFixed(1)}ms | pire ${a[n - 1].toFixed(1)}ms`;
}

async function runCadence(session, args) {
  console.log(stats('REPOS   ', await evaluate(session, SAMPLER(2000))));

  const rot = evaluate(session, SAMPLER(2500));
  await sleep(200);
  for (let i = 0; i < 3; i++) { await realKey(session, { key: 'e' }); await sleep(600); }
  console.log(stats('ROTATION', await rot));

  const walk = evaluate(session, SAMPLER(3000));
  await sleep(150);
  await clicDeMarche(session, args);
  console.log(stats('MARCHE  ', await walk));

  console.log('objets SVG dans le stage :', await evaluate(session,
    `document.querySelectorAll('svg [data-cid], svg g, svg polygon, svg path').length`));
}

async function runProfile(session, args) {
  await session.rpc('Profiler.enable');
  await session.rpc('Profiler.setSamplingInterval', { interval: args.samplingInterval });
  await session.rpc('Profiler.start');

  await clicDeMarche(session, args);
  await sleep(6000);

  const { profile } = await session.rpc('Profiler.stop');
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map();
  const total = profile.samples.length;
  for (const id of profile.samples) {
    const n = byId.get(id);
    if (!n) continue;
    const cf = n.callFrame;
    const key = `${cf.functionName || '(anonyme)'} @ ${(cf.url || '').split('/').slice(-1)[0]}:${cf.lineNumber + 1}`;
    self.set(key, (self.get(key) || 0) + 1);
  }
  const durMs = (profile.endTime - profile.startTime) / 1000;
  console.log(`\n--- profil ${args.scenario} : ${total} échantillons sur ${durMs.toFixed(0)} ms ---`);
  [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)
    .forEach(([k, v]) => console.log(`${((v / total) * 100).toFixed(1).padStart(5)}%  ${((v / total) * durMs).toFixed(0).padStart(6)}ms  ${k}`));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  // GABARIT DE MESURE, pas une vue de recette : les coordonnées de clic par défaut (700,620,
  // consignées en tête) désignent une case de sol à CE cadrage, et une cadence rAF ne se compare
  // qu'à des chiffres relevés au même. Il ne suit donc pas `vues-recette.json`.
  const session = await openApp(args.url, { width: 1600, height: 950 });
  try {
    const guard = consoleGuard(session);
    console.log(await evaluate(session, `window.__wfrp.scenario(${JSON.stringify(args.scenario)}, ${args.seed})`));
    await sleep(2000);

    if (args.mode === 'cadence') await runCadence(session, args);
    else await runProfile(session, args);

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

main().catch((e) => {
  console.error(`ERR ${e.message}`);
  process.exit(1);
});
