/**
 * QC — PLANCHES DE GOÛT CAPTURÉES SUR L'ÉCRAN DE JEU RÉEL (#1176, voie VOLUMIQUE).
 *
 * Planches de jeu capturées DANS l'app (et non rendues hors d'elle) : ici
 * rien n'est ré-assemblé à côté du jeu — on OUVRE l'app (kit CDP `scripts/recette/lib.mjs`), on charge
 * un scénario par son id (`__wfrp.scenario`), on cadre par les MÊMES actions que le joueur
 * (`rotateCam` cran par cran, `setZoom`, `viewMode`), et on
 * capture le CANEVAS. Ce que la planche montre est donc ce que le joueur voit, HUD compris ou non
 * (la capture est rognée sur le canevas du monde).
 *
 * Le kit s'ATTACHE au serveur de dev, il n'en démarre aucun : `npm run dev` dans un autre terminal.
 *
 *   node scripts/qc/capture-jeu.mjs --help
 *   node scripts/qc/capture-jeu.mjs                                  (toutes les scènes, tous les crans)
 *   node scripts/qc/capture-jeu.mjs --scenes diligence --vues iso-rot0 --zoom 1
 *
 * Sortie : public/qc/jeu/<scene>-<vue>.png + public/qc/jeu.html (index, lié au hub des galeries).
 * Chaque scène affiche AUSSI, quand elle existe, la planche affine FIGÉE de
 * `public/qc/baseline-affine/` — la référence de non-régression d'avant la bascule.
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { openApp, evaluate, waitFor, consoleGuard, withReloadRetry, sleep, cliquerPremierOffert, ATTENTE_ECHUE, DEFAULT_URL } from '../recette/lib.mjs';
import { enteteArbre } from '../guards/lib/enteteArbre.mjs';

const OUT_DIR = 'public/qc/jeu';
const SHEET = 'public/qc/jeu.html';
const BASELINE_DIR = 'public/qc/baseline-affine';

/** Scènes de départ : les planches de GOÛT de la voie affine, portées sur l'écran de jeu.
 *  `id` = id de scénario `__wfrp.scenario` ; `baseline` = planche affine figée qui lui fait face. */
const SCENES = [
  { id: 'diligence', label: 'La Diligence (auberge, 2 niveaux)', baseline: 'diligence.png' },
  { id: 'siege-explore', label: 'Siège — enceinte explorable', baseline: 'env-siege-explore.png' },
  { id: 'arene', label: "Bourg de l'arène (hub)", baseline: 'env-arene-hub.png' },
  { id: 'opera', label: 'Opéra — théâtre', baseline: 'env-test-opera-theatre.png' },
  { id: 'piege-caveau', label: 'Caveau piégé', baseline: 'env-test-piege-caveau.png' },
];

/** Vues disponibles : les 4 CRANS de la caméra du jeu + la vue du dessus. */
const VUES = [
  { key: 'iso-rot0', label: 'iso cran 0', rot: 0, view: 'iso' },
  { key: 'iso-rot1', label: 'iso cran 1', rot: 1, view: 'iso' },
  { key: 'iso-rot2', label: 'iso cran 2', rot: 2, view: 'iso' },
  { key: 'iso-rot3', label: 'iso cran 3', rot: 3, view: 'iso' },
  { key: 'top', label: 'dessus (tactique)', rot: 0, view: 'top' },
];

const USAGE = `QC — planches de goût capturées sur l'ÉCRAN DE JEU réel (voie volumique, #1176)

  node scripts/qc/capture-jeu.mjs [options]

Options
  --scenes <ids>   liste d'ids de scénario séparés par des virgules
                   (défaut : ${SCENES.map((s) => s.id).join(',')})
  --vues <clés>    liste de vues séparées par des virgules parmi ${VUES.map((v) => v.key).join(',')}
                   (défaut : toutes)
  --zoom <n>       zoom caméra du jeu, borné [0.4 ; 2.6] par le store (défaut : 1)
  --seed <n>       graine RNG du scénario (défaut : 42)
  --out <dossier>  dossier des PNG (défaut : ${OUT_DIR})
  --url <url>      app à piloter (défaut : ${DEFAULT_URL})
  --largeur <px>   largeur de fenêtre (défaut : 1600)
  --hauteur <px>   hauteur de fenêtre (défaut : 900)
  --hud            garde le HUD dans la capture (défaut : capture rognée sur le canevas du monde)
  --help           cette aide

Prérequis : \`npm run dev\` tourne dans un autre terminal (le kit s'attache, il ne démarre rien).`;

/** Analyse d'arguments PURE — rend `{ options }` ou `{ erreur }` (aucune sortie de process ici). */
function parseArgs(argv) {
  const opts = {
    scenes: SCENES.map((s) => s.id), vues: VUES.map((v) => v.key), zoom: 1, seed: 42,
    // GABARIT DE MESURE : les planches produites se comparent aux étalons COMMITÉS de
    // `public/qc/baseline-affine/`, cadrés à 1600×900. Changer ce couple invaliderait la
    // comparaison ; il ne suit donc pas `scripts/recette/vues-recette.json`.
    out: OUT_DIR, url: DEFAULT_URL, largeur: 1600, hauteur: 900, hud: false, aide: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => argv[++i];
    if (a === '--help' || a === '-h') opts.aide = true;
    else if (a === '--hud') opts.hud = true;
    else if (a === '--scenes') opts.scenes = String(val() ?? '').split(',').filter(Boolean);
    else if (a === '--vues') opts.vues = String(val() ?? '').split(',').filter(Boolean);
    else if (a === '--zoom') opts.zoom = Number(val());
    else if (a === '--seed') opts.seed = Number(val());
    else if (a === '--out') opts.out = String(val() ?? '');
    else if (a === '--url') opts.url = String(val() ?? '');
    else if (a === '--largeur') opts.largeur = Number(val());
    else if (a === '--hauteur') opts.hauteur = Number(val());
    else return { erreur: `option inconnue « ${a} »` };
  }
  if (opts.aide) return { options: opts };
  const scèneInconnue = opts.scenes.find((id) => !SCENES.some((s) => s.id === id));
  if (scèneInconnue) return { erreur: `scène inconnue « ${scèneInconnue} » — ids : ${SCENES.map((s) => s.id).join(', ')}` };
  const vueInconnue = opts.vues.find((k) => !VUES.some((v) => v.key === k));
  if (vueInconnue) return { erreur: `vue inconnue « ${vueInconnue} » — clés : ${VUES.map((v) => v.key).join(', ')}` };
  if (!Number.isFinite(opts.zoom) || opts.zoom <= 0) return { erreur: `--zoom attend un nombre > 0` };
  if (!opts.scenes.length || !opts.vues.length) return { erreur: 'aucune scène ou aucune vue à capturer' };
  return { options: opts };
}

/** Boutons d'avancement d'une fenêtre de révélation (`CascadeModal`, dernière étape = « Terminer »). */
const LABELS_AVANCEMENT = ['Terminer', 'Continuer', 'Fermer'];

/**
 * Ferme la carte-briefing d'entrée de scène AVANT toute capture (`docs/recette-navigateur.md`,
 * § Pièges vécus) : `__wfrp.modal()` ne la voit pas, elle n'est détectable qu'au DOM
 * (`.modal-overlay`) et ne se ferme que par un CLIC réel sur son bouton.
 * Son apparition est asynchrone et de latence variable — on la POLL (jamais un délai fixe), on
 * avance jusqu'à ce que le voile tombe, et on RE-VÉRIFIE l'absence APRÈS la boucle : sans cette
 * re-vérification, une fenêtre encore ouverte partait en planche (centre de l'écran masqué).
 */
async function fermerBriefing(session, { attendreApparition = true, timeoutMs = 3000 } = {}) {
  const voile = `!!document.querySelector('.modal-overlay')`;
  if (attendreApparition) {
    try {
      await waitFor(session, voile, { timeoutMs, intervalMs: 150 });
    } catch (e) {
      // Scène sans `startMessage` : aucune fenêtre ne monte. L'absence est confirmée en fin de fonction.
      if (e.code !== ATTENTE_ECHUE) throw e;
    }
  }
  for (let i = 0; i < 12; i++) {
    if (!(await evaluate(session, voile))) break;
    await cliquerPremierOffert(session, LABELS_AVANCEMENT);
    await sleep(500);
  }
  if (await evaluate(session, voile)) throw new Error('une fenêtre modale occupe encore le centre de l\'écran — capture refusée');
}

/** Charge le scénario et ouvre la carte : l'état de départ de toute capture. */
async function armerScene(session, id, seed) {
  console.log(await evaluate(session, `__wfrp.scenario(${JSON.stringify(id)}, ${seed})`));
  await waitFor(session, '!!__wfrp.state()');
  // Brouillard OFF : une planche de goût juge le MONDE, pas la vision du groupe (le voile est un
  // calque SVG posé par-dessus le canevas — il masquerait l'essentiel de la scène).
  await evaluate(session, '__wfrp.fog(false)');
  // Le monde volumique est un CANEVAS ; la voie affine n'en monte aucun (couches SVG). Cette attente
  // est donc la PREUVE que la capture qui suit vient bien de la voie volumique.
  await waitFor(session, `!!document.querySelector('canvas.iso-stage[data-vue]')`, { timeoutMs: 20000 });
  await fermerBriefing(session);
}

/** Cadre la caméra par les actions du JEU (crans, zoom, vue) — jamais une écriture d'état parallèle. */
async function cadrer(session, vue, zoom) {
  await evaluate(session, `(() => {
    const g = () => __wfrp.store.getState();
    g().setZoom(${zoom});
    let tours = 0;
    while (g().camRot !== ${vue.rot} && tours++ < 8) g().rotateCam(1);
    if (g().viewMode !== ${JSON.stringify(vue.view)}) g().toggleViewMode();
    return { camRot: g().camRot, viewMode: g().viewMode, zoom: g().zoom };
  })()`);
  await sleep(700); // la caméra s'anime d'un cran à l'autre ; on capture une fois posée
  // Un changement de vue peut remonter une fenêtre (révélation, bilan) : on re-vérifie l'écran nu.
  await fermerBriefing(session, { attendreApparition: false });
}

/** Capture le canevas du monde (rect du canevas, HUD exclu sauf `--hud`). */
async function capturer(session, fichier, avecHud) {
  const clip = avecHud ? undefined : await evaluate(session, `(() => {
    const c = document.querySelector('canvas.iso-stage');
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height), scale: 1 };
  })()`);
  if (!avecHud && !clip) throw new Error(`aucun canevas volumique à capturer pour ${fichier} — voie affine ?`);
  const r = await session.rpc('Page.captureScreenshot', clip ? { format: 'png', clip } : { format: 'png' });
  const buf = Buffer.from(r.data, 'base64');
  if (buf.length < 1024) throw new Error(`capture vide pour ${fichier} (${buf.length} octets)`);
  writeFileSync(fichier, buf);
  return buf.length;
}

function indexHtml(prises, opts) {
  const sections = SCENES.filter((s) => prises.some((p) => p.scene === s.id)).map((s) => {
    const cells = prises.filter((p) => p.scene === s.id).map((p) =>
      `<figure class="shot"><a href="jeu/${p.fichier}"><img src="jeu/${p.fichier}" alt="${p.label}"></a><figcaption>${p.label}</figcaption></figure>`).join('');
    const base = s.baseline && existsSync(`${BASELINE_DIR}/${s.baseline}`)
      ? `<h3>référence AFFINE figée (avant bascule)</h3><div class="row"><figure class="shot ref"><a href="baseline-affine/${s.baseline}"><img src="baseline-affine/${s.baseline}" alt="${s.baseline}"></a><figcaption>${s.baseline} — planche affine figée (référence de comparaison C4)</figcaption></figure></div>`
      : `<p class="note">aucune planche affine figée en face (${s.baseline ?? '—'}).</p>`;
    return `<section><h2>${s.label} <span class="id">${s.id}</span></h2><div class="row">${cells}</div>${base}</section>`;
  }).join('');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>QC — écran de jeu (voie volumique)</title>
<style>
 body { background:#11141c; color:#e8e2d2; font:13px/1.5 sans-serif; padding:16px; }
 h1 { font-size:20px; margin:0 0 4px; }
 h2 { font-size:16px; margin:24px 0 6px; border-bottom:1px solid #2a2f3a; padding-bottom:4px; }
 h3 { font-size:12px; color:#9fb0c8; font-weight:normal; margin:10px 0 4px; text-transform:uppercase; letter-spacing:.06em; }
 .id { color:#7c879a; font-weight:normal; font-size:12px; }
 .row { display:flex; gap:10px; flex-wrap:wrap; align-items:flex-start; }
 .shot { margin:0; } .shot img { width:420px; border:1px solid #2a2f3a; background:#14161f; display:block; }
 .shot.ref img { width:860px; }
 figcaption { color:#9fb0c8; font-size:11px; padding-top:3px; }
 .note { color:#9fb0c8; }
 a { color:#8fb6ff; }
</style></head><body>
<a href="../galeries.html" style="color:#8fb6ff;text-decoration:none;font:13px sans-serif">← Galeries</a>
<h1>QC — planches capturées sur l'écran de JEU (voie volumique)</h1>
<p class="note">${prises.length} capture(s) — fenêtre ${opts.largeur}×${opts.hauteur}, zoom ${opts.zoom}, graine ${opts.seed}, ${opts.hud ? 'HUD compris' : 'rognées sur le canevas du monde'}. Régénérer : <code>node scripts/qc/capture-jeu.mjs</code> (serveur de dev requis).</p>
${sections}
</body></html>`;
}

async function main() {
  const { options, erreur } = parseArgs(process.argv.slice(2));
  if (erreur) { console.error(`capture-jeu : ${erreur}\n\n${USAGE}`); process.exit(2); }
  if (options.aide) { console.log(USAGE); process.exit(0); }

  // Les planches se comparent d'une session à l'autre : elles disent SUR QUEL ARBRE elles sont prises.
  console.log(`FILIGRANE — ${enteteArbre(process.cwd())}`);
  mkdirSync(options.out, { recursive: true });
  const session = await openApp(options.url, { width: options.largeur, height: options.hauteur });
  const guard = consoleGuard(session);
  const prises = [];
  try {
    for (const id of options.scenes) {
      const scn = SCENES.find((s) => s.id === id);
      await withReloadRetry(session, () => armerScene(session, id, options.seed), { tries: 3 });
      for (const clé of options.vues) {
        const vue = VUES.find((v) => v.key === clé);
        const fichier = `${id}-${clé}.png`;
        const octets = await withReloadRetry(session, async () => {
          await cadrer(session, vue, options.zoom);
          return capturer(session, `${options.out}/${fichier}`, options.hud);
        }, { tries: 3, resettle: () => armerScene(session, id, options.seed) });
        prises.push({ scene: id, fichier, label: `${scn.label} — ${vue.label}` });
        console.log(`OK: ${options.out}/${fichier} (${(octets / 1024).toFixed(0)} Ko)`);
      }
    }
    writeFileSync(SHEET, indexHtml(prises, options));
    console.log(`OK: ${SHEET} (${prises.length} capture(s))`);
  } finally {
    const erreurs = guard.errors();
    guard.stop();
    await session.close();
    console.log(`CONSOLE : ${erreurs.length} erreur(s)`);
    for (const e of erreurs) console.log(`  [${e.type}] ${e.text}`);
    if (erreurs.length) process.exitCode = 1;
  }
}

await main();
