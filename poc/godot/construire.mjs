#!/usr/bin/env node
// Construction du prototype #2793 : bundle du pont, export web Godot, copie, tailles.
// Usage : node poc/godot/construire.mjs [--godot <exécutable>] [--sortie <dossier>] [--pont-seul]
//         (l'exécutable vient aussi de la variable GODOT)
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const PONT = 'wfrp-pont.js';
const MODULES_AFFICHES = 15;

const MODE_D_EMPLOI = `Usage : node poc/godot/construire.mjs [--godot <exécutable>] [--sortie <dossier>] [--pont-seul]
  --godot <chemin>   exécutable Godot 4.7 (sinon variable d'environnement GODOT) ; requis hors --pont-seul
  --sortie <dossier> dossier de l'export web (défaut : poc/godot/build/web/)
  --pont-seul        seulement le bundle ${PONT}, vers poc/godot/build/`;

function lireOptions(argv) {
  const options = { godot: process.env.GODOT, sortie: path.join(ICI, 'build', 'web'), pontSeul: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--pont-seul') options.pontSeul = true;
    else if (a === '--godot' || a === '--sortie') {
      const v = argv[++i];
      if (!v) return { erreur: `${a} attend une valeur` };
      options[a.slice(2)] = path.resolve(v);
    } else return { erreur: `option inconnue : ${a}` };
  }
  return { options };
}

function octets(n) {
  return `${n.toLocaleString('fr-FR')} o`;
}

async function empaqueter(dossier) {
  mkdirSync(dossier, { recursive: true });
  const sortie = path.join(dossier, PONT);
  const debut = performance.now();
  const resultat = await build({
    entryPoints: [path.join(ICI, 'pont', 'entree.ts')],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    loader: { '.json': 'json' },
    // `import.meta.env` de Vite (src/vite-env.d.ts), posé comme le pose un `vite build`.
    define: { 'import.meta.env': JSON.stringify({ DEV: false, PROD: true, MODE: 'production', BASE_URL: './', SSR: false }) },
    minify: true,
    sourcemap: 'external',
    metafile: true,
    outfile: sortie,
    logLevel: 'warning',
  });
  const duree = performance.now() - debut;
  const brut = readFileSync(sortie);
  console.log(`[pont] ${path.relative(process.cwd(), sortie)} : ${octets(brut.length)} brut, ${octets(gzipSync(brut).length)} gzip, empaqueté en ${Math.round(duree)} ms`);
  const sortieMeta = Object.values(resultat.metafile.outputs).find((o) => o.entryPoint);
  const modules = Object.entries(sortieMeta?.inputs ?? {})
    .map(([fichier, { bytesInOutput }]) => ({ fichier, bytesInOutput }))
    .sort((a, b) => b.bytesInOutput - a.bytesInOutput);
  console.log(`[pont] ${modules.length} modules ; les ${MODULES_AFFICHES} plus gros (octets dans la sortie minifiée) :`);
  for (const m of modules.slice(0, MODULES_AFFICHES)) console.log(`  ${String(m.bytesInOutput).padStart(9)}  ${m.fichier}`);
  return sortie;
}

function exporterGodot(godot, sortie) {
  mkdirSync(sortie, { recursive: true });
  const projet = path.join(ICI, 'projet');
  const args = ['--headless', '--path', projet, '--export-release', 'Web', path.join(sortie, 'index.html')];
  console.log(`[godot] ${godot} ${args.join(' ')}`);
  const debut = performance.now();
  const r = spawnSync(godot, args, { stdio: 'inherit' });
  const duree = Math.round(performance.now() - debut);
  if (r.error) {
    console.error(`[godot] lancement impossible : ${r.error.message}`);
    return 1;
  }
  console.log(`[godot] code de sortie ${r.status}${r.signal ? ` (signal ${r.signal})` : ''}, ${duree} ms`);
  return r.status ?? 1;
}

function imprimerTailles(dossier) {
  let total = 0;
  console.log(`[tailles] ${path.relative(process.cwd(), dossier)}`);
  for (const nom of readdirSync(dossier).sort()) {
    const chemin = path.join(dossier, nom);
    const st = statSync(chemin);
    if (!st.isFile()) continue;
    total += st.size;
    const gz = nom === PONT || nom.endsWith('.wasm') ? `, ${octets(gzipSync(readFileSync(chemin)).length)} gzip` : '';
    console.log(`  ${nom} : ${octets(st.size)}${gz}`);
  }
  console.log(`  total : ${octets(total)}`);
}

async function principal() {
  const { options, erreur } = lireOptions(process.argv.slice(2));
  if (erreur) {
    console.error(`${erreur}\n${MODE_D_EMPLOI}`);
    return 2;
  }
  if (options.pontSeul) {
    await empaqueter(path.join(ICI, 'build'));
    return 0;
  }
  if (!options.godot) {
    console.error(`Exécutable Godot absent : --godot <chemin> ou variable GODOT.\n${MODE_D_EMPLOI}`);
    return 2;
  }
  const pont = await empaqueter(path.join(ICI, 'build'));
  const code = exporterGodot(options.godot, options.sortie);
  if (code !== 0) return code;
  copyFileSync(pont, path.join(options.sortie, PONT));
  imprimerTailles(options.sortie);
  return 0;
}

process.exitCode = await principal();
