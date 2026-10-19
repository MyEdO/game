/**
 * RECETTE #1245 L4 — les TONS de lumière, jugés SUR L'ÉCRAN (voie volumique).
 *
 * Trois questions du recetteur, mesurées sur les PIXELS que three a rendus, jamais sur la donnée :
 *  1. le brasero VACILLE — la luminance BOUGE d'une capture à l'autre, sur une scène par ailleurs
 *     immobile (ni marche, ni caméra, ni météo) ;
 *  2. la flaque du feu est CHAUDE (canal rouge > canal bleu), pas l'aplat uniforme du lot précédent ;
 *  3. la LANTERNE est plus faible, plus pâle et STABLE — même scène, même place, l'autre ton.
 *
 * DEUX pièges d'INSTRUMENT, tous deux payés au premier jet et consignés ici :
 *  - lire les pixels par `drawImage` du canevas rend du NOIR : le contexte WebGL n'a pas de
 *    `preserveDrawingBuffer`, son buffer est vidé en fin de frame. On passe donc par une CAPTURE CDP ;
 *  - viser « le carré le plus CLAIR du cadre » désigne le HUD (chrome chaud, luminance 188 constante),
 *    pas la flaque. La flaque se localise par ce qui BOUGE : sur une scène immobile, les seuls pixels
 *    qui changent d'une capture à l'autre sont ceux que la flamme éclaire.
 *
 * Console : 0 erreur. Exit ≠ 0 sur le premier défaut, avec la mesure.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { openApp, waitFor, consoleGuard } from './lib.mjs';
import { evaluate } from './cdp.mjs';
import { decodePng } from '../qc/lib/pngDecode.mjs';

const SORTIE = join('public', 'qc', 'tons-lumiere-1245');
mkdirSync(SORTIE, { recursive: true });

const défauts = [];
const vérifier = (ok, message) => { console.log(`${ok ? 'OK    ' : 'ÉCHEC '} ${message}`); if (!ok) défauts.push(message); };

const session = await openApp();
const guard = consoleGuard(session);

/** Une capture CDP décodée — la seule lecture fiable d'un canevas WebGL (cf. l'en-tête). */
async function capture(nom) {
  const r = await session.rpc('Page.captureScreenshot', { format: 'png' });
  const buf = Buffer.from(r.data, 'base64');
  if (nom) writeFileSync(join(SORTIE, `${nom}.png`), buf);
  return decodePng(buf);
}

const lum = (img, i) => 0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2];

/** Moyennes R/B et luminance d'un ENSEMBLE de pixels (indices RGBA). */
function moyenne(img, idx) {
  let R = 0, G = 0, B = 0;
  for (const i of idx) { R += img.data[i]; G += img.data[i + 1]; B += img.data[i + 2]; }
  const n = idx.length;
  return { r: R / n, b: B / n, lum: (0.2126 * R + 0.7152 * G + 0.0722 * B) / n };
}

// Terrain d'entraînement, palier NUIT — le seul régime où une flaque se voit (de jour
// l'intensité tombe à 0 par construction, cf. `pointLightWrites`).
await evaluate(session, "__wfrp.scenario('entrainement', 42)");
await waitFor(session, "!!__wfrp.state()");
await evaluate(session, '__wfrp.store.setState({ lightLevel: 0.18 })');
// Brouillard OFF : le voile de guerre est un calque SVG POSÉ SUR le canevas — il masque l'essentiel
// des flaques et on ne mesurerait alors que les quelques pixels qu'il laisse voir (217 au premier jet).
await evaluate(session, '__wfrp.fog(false)');
await waitFor(session, "!!document.querySelector('canvas.iso-stage[data-lampes]')");
await waitFor(session, "+document.querySelector('canvas.iso-stage').dataset.lampes.split('/')[0] > 0");
console.log(`lampes allumées / budget : ${await evaluate(session, "document.querySelector('canvas.iso-stage').dataset.lampes")}`);

// ── 1. LE VACILLEMENT : ce qui BOUGE dans un cadre immobile ─────────────────────────────────────
// 24 captures : un bruit à DEUX sinus incommensurables ne se résume pas en une poignée de phases —
// à 12, le compte de pixels mouvants variait de 1 310 à 3 151 d'un jet à l'autre (mesuré).
const frames = [];
for (let i = 0; i < 24; i++) {
  frames.push(await capture(i === 0 ? 'flaque-feu-nuit' : null));
  await new Promise((r) => setTimeout(r, 45));
}
const { w, h } = frames[0];
let bougeMax = 0;
const mouvants = [];
for (let p = 0; p < w * h; p++) {
  const i = p * 4;
  let mn = Infinity, mx = -Infinity;
  for (const f of frames) { const l = lum(f, i); if (l < mn) mn = l; if (l > mx) mx = l; }
  const d = mx - mn;
  if (d > bougeMax) bougeMax = d;
  if (d > 2) mouvants.push(i);
}
const partMouvante = (100 * mouvants.length) / (w * h);
console.log(`pixels qui BOUGENT (> 2 de luminance) : ${mouvants.length} sur ${w * h} (${partMouvante.toFixed(2)} % du cadre), amplitude max ${bougeMax.toFixed(1)}`);
// SEUILS MESURÉS (2026-08-10, terrain d'entraînement, palier nuit, 1600×900) : à l'amplitude LIVRÉE
// de 0,35 — 8 672 pixels dépassent 2 niveaux, le maximum monte à 14,7. À 0,14 (première valeur
// essayée) : 364 pixels et 6,1 seulement — mesuré, puis REJETÉ comme invisible à l'œil, ce qui est
// exactement le reproche du recetteur (« le braséro paraît peint »). Seuils posés à un tiers du mesuré.
vérifier(mouvants.length > 800, `le brasero VACILLE à l'écran — ${mouvants.length} pixels bougent de plus de 2 niveaux sur une scène par ailleurs IMMOBILE (seuil 800)`);
vérifier(bougeMax > 6, `…et visiblement : amplitude max ${bougeMax.toFixed(1)} niveaux de luminance (seuil 6)`);

// ── 2. LA COULEUR : la flaque du feu est CHAUDE ─────────────────────────────────────────────────
// Les pixels MOUVANTS sont, par construction, ceux que la flamme éclaire : c'est SA flaque.
const feu = moyenne(frames[0], mouvants);
console.log(`flaque du FEU : R ${feu.r.toFixed(1)} / B ${feu.b.toFixed(1)} / luminance ${feu.lum.toFixed(2)}`);
vérifier(feu.r > feu.b + 2, `la flaque du FEU est CHAUDE — R ${feu.r.toFixed(1)} > B ${feu.b.toFixed(1)}`);

// ── 3. LA LANTERNE : même scène, même place, l'autre ton ────────────────────────────────────────
// On bascule le TON des props émetteurs EN DONNÉE (ce que fait un auteur, `SceneEntity.light.tone`),
// et on relit les MÊMES pixels : comparaison honnête — même géométrie, même heure, même caméra.
await evaluate(session, `(() => {
  const s = __wfrp.store.getState();
  const scene = { ...s.scene, entities: s.scene.entities.map((e) => (
    e.kind === 'prop' && e.ref && /brasero|feu-camp|chandelier|lampadaire/.test(e.ref)
      ? { ...e, light: { radiusM: 8, tone: 'lanterne' } } : e)) };
  __wfrp.store.setState({ scene });
})()`);
await new Promise((r) => setTimeout(r, 500));
const cadresLanterne = [];
for (let i = 0; i < 8; i++) {
  cadresLanterne.push(await capture(i === 0 ? 'flaque-lanterne-nuit' : null));
  await new Promise((r) => setTimeout(r, 70));
}
let bougeLanterne = 0;
for (const i of mouvants) {
  let mn = Infinity, mx = -Infinity;
  for (const f of cadresLanterne) { const l = lum(f, i); if (l < mn) mn = l; if (l > mx) mx = l; }
  bougeLanterne = Math.max(bougeLanterne, mx - mn);
}
const lanterne = moyenne(cadresLanterne[0], mouvants);
console.log(`flaque de la LANTERNE : R ${lanterne.r.toFixed(1)} / B ${lanterne.b.toFixed(1)} / luminance ${lanterne.lum.toFixed(2)}`);
// « Plus pâle » se juge sur la CHROMA, et c'est une mesure, pas une commodité : à intensité de ton
// ÉGALE, une lampe orange saturée rend MOINS de luminance qu'une lampe blanche (la luminance pèse le
// vert à 71 %, que `#ff8c3a` n'a presque pas). Comparées en luminance, la lanterne à 0,6 et la flamme
// à 1,0 se tiennent donc à 0,1 % près (41,53 contre 41,57 au pic, mesuré) — un verdict à cette marge
// serait un faux vert en attente de bascule. Ce qui SÉPARE réellement les deux tons à l'écran, et ce
// que le recetteur pointait (« couleur uniforme entre feu et lanterne »), c'est l'écart R−B.
let feuPic = 0;
for (const i of mouvants) { let mx = -Infinity; for (const f of frames) mx = Math.max(mx, lum(f, i)); feuPic += mx; }
feuPic /= mouvants.length;
console.log(`luminances (INDICATIF, non gaté) : feu au pic ${feuPic.toFixed(2)} / feu battu ${feu.lum.toFixed(2)} / lanterne ${lanterne.lum.toFixed(2)}`);
const chromaFeu = feu.r - feu.b, chromaLan = lanterne.r - lanterne.b;
vérifier(chromaLan < chromaFeu * 0.85, `la LANTERNE est plus PÂLE que le FEU — écart R−B ${chromaLan.toFixed(1)} contre ${chromaFeu.toFixed(1)} (au moins 15 % de moins)`);
vérifier(bougeLanterne < bougeMax / 3, `…et STABLE — amplitude max ${bougeLanterne.toFixed(1)} contre ${bougeMax.toFixed(1)} pour la flamme`);

const erreurs = guard.errors();
console.log(`CONSOLE : ${erreurs.length} erreur(s)`);
for (const e of erreurs) console.log(`  ${e}`);
await session.close();

if (erreurs.length) défauts.push(`console : ${erreurs.length} erreur(s)`);
console.log(défauts.length ? `\nDÉFAUTS (${défauts.length}) :\n- ${défauts.join('\n- ')}` : '\nRECETTE : tout tenu');
process.exit(défauts.length ? 1 : 0);
