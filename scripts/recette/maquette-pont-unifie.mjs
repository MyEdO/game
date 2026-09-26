#!/usr/bin/env node
// CLI de recette : LES MAQUETTES DU PONT UNIFIÉ ET DU DIALOGUE (#1849) SE PHOTOGRAPHIENT SUR LE
// MONDE RÉEL, ET AUCUNE NE DÉBORDE. Les compositions vivent dans la galerie DEV (spécimens
// `pleinChamp` de `src/ui/gallery/registry.tsx`) : elles se jugent À L'IMAGE, aux trois vues de
// `scripts/recette/vues-recette.json`, et c'est ce script qui rend ces images.
//
// Le monde n'est pas dessiné : il est CAPTURÉ. Le script joue « L'Embuscade », masque tout le HUD,
// photographie le terrain d'EXPLORATION puis celui du COMBAT, et pose ces captures dans l'image de
// fond de la maquette (`[data-maquette-monde]`) — ce qu'on voit derrière la console est donc le
// rendu réel du jeu, à la même vue, jamais une illustration.
//
// Usage :
//   node scripts/recette/maquette-pont-unifie.mjs --out <dossier>
//   node scripts/recette/maquette-pont-unifie.mjs --url http://localhost:5201/ --out <dossier>
//   node scripts/recette/maquette-pont-unifie.mjs --out <dossier> --specimens mq-1849-a1,mq-1849-c1
//
// Ce qui est VÉRIFIÉ, pour chaque spécimen et chaque vue :
//   · CONSOLE à zéro erreur (`consoleGuard`) ;
//   · AUCUN ÉLÉMENT DÉBORDANT à droite du document (`verdictDebordement`) ;
//   · AUCUN ÉLÉMENT HORS FENÊTRE (détecteur pur `elementsHorsFenetre`, `detecteurs-pont.mjs`) ;
//   · AUCUN DÉFILEMENT DE PAGE (`scrollHeight <= innerHeight`) : une maquette de plein champ tient
//     dans sa fenêtre, sinon la capture ment sur ce qu'on verrait.
// Plus l'IMMOBILITÉ de l'arche et des travées entre la composition d'EXPLORATION (A1) et celle de
// COMBAT (C1) : mêmes boîtes, au dixième de pixel, aux deux vues de bureau.
//
// LIMITE À DIRE : `Emulation.setDeviceMetricsOverride` n'émule PAS `pointer: coarse` — la vue 360px
// est jugée à la SOURIS, et la tranche tactile (cibles de 44px) ne l'est pas ici.
//
// Sortie : exit 1 au premier défaut (liste complète imprimée), exit 0 si tout passe.
import { mkdirSync } from 'node:fs';
import {
  openApp, evaluate, evaluerFn, setViewport, sleep, shot, consoleGuard, resoudreModales,
  cliquerSelecteur, attendreSelecteur, survoler, verdictDebordement, VUES_RECETTE, vueRecette,
} from './lib.mjs';
import { elementsHorsFenetre } from './detecteurs-pont.mjs';

/** Les spécimens à photographier, dans l'ORDRE de livraison du lot. `monde` dit lequel des deux
 *  terrains capturés se pose derrière ; `survol` désigne la commande à survoler avant la prise (une
 *  raison de refus, une infobulle, ne se voit qu'au survol). */
const SPECIMENS = [
  { id: 'mq-1849-a1', monde: 'exploration', immobile: 'exploration' },
  { id: 'mq-1849-b-histo', monde: 'exploration', survol: '.dlg-choice' },
  { id: 'mq-1849-b-narrateur', monde: 'exploration', survol: '.dlg-choice' },
  { id: 'mq-1849-b-solo', monde: 'exploration', survol: '.dlg-choice' },
  { id: 'mq-1849-a1-lanceur', monde: 'exploration' },
  { id: 'mq-1849-c', monde: 'combat', immobile: 'combat' },
  { id: 'mq-1849-m2', monde: 'exploration' },
  { id: 'mq-1849-m1', monde: 'exploration' },
  { id: 'mq-1849-b-coop', monde: 'exploration', survol: '.dlg-choice' },
];

/** Les CÔTÉS de la mesure d'immobilité (arbitrage #1849 : l'arche et les travées ne bougent pas d'un
 *  pixel d'une composition de pont à l'autre — exploration, combat). Le premier est la RÉFÉRENCE, les
 *  autres se mesurent contre lui. Le spécimen DIT de quel côté il est (`immobile`) — la boucle ne
 *  branche pas sur son id. */
const COTES_IMMOBILES = ['exploration', 'combat'];
/** Vues où l'immobilité se mesure : les deux vues de bureau (à 360 le pont a sa composition compacte). */
const VUES_IMMOBILITE = ['bureau', 'portable'];

/** Tout ce que le HUD monte au-dessus du monde — masqué le temps de photographier le terrain NU. */
const MASQUE_DU_HUD = [
  '.hud-topbar', '.party-dock', '.stage-flot', '.exploration-dock', '.combat-console',
  '.hud-rail', '.combat-feed', '.initiative-strip', '.dialogue-box', '.log-drawer', '.cc-phase',
].map((s) => `${s} { visibility: hidden; }`).join('\n');

function parseArgs(argv) {
  const out = { url: undefined, out: undefined, specimens: SPECIMENS.map((s) => s.id) };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url') out.url = argv[++i];
    else if (a === '--out') out.out = argv[++i];
    else if (a === '--specimens') out.specimens = argv[++i].split(',').map((s) => s.trim());
    else throw new Error(`Option inconnue : ${a}`);
  }
  if (!out.out) throw new Error('--out <dossier> est requis : la recette écrit ses images quelque part.');
  return out;
}

/** Sonde DOM : ce qu'il faut pour les trois verdicts, en UN aller-retour. */
const PROBE = `(() => {
  const dansUnScrollport = (e) => {
    for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (/(auto|scroll)/.test(cs.overflowX + ' ' + cs.overflowY)) return true;
    }
    return false;
  };
  const elements = [...document.querySelectorAll('body *')]
    .filter((e) => !(e instanceof SVGElement) && e.getClientRects().length && !dansUnScrollport(e))
    .map((e) => { const r = e.getBoundingClientRect(); return { nom: (e.getAttribute('data-cell') || e.getAttribute('data-action') || e.className || e.tagName).toString().slice(0, 40), left: +r.left.toFixed(1), right: +r.right.toFixed(1) }; });
  return {
    elements,
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
  };
})()`;

/** Balises SVG : leurs boîtes DOM ne sont pas des surfaces touchables (cf. le verdict de débordement). */
const TAGS_SVG = new Set(['svg', 'g', 'rect', 'path', 'circle', 'ellipse', 'polygon', 'polyline', 'line', 'use', 'text', 'tspan', 'defs', 'clippath', 'lineargradient', 'radialgradient', 'stop', 'image']);

/** Boîtes dont l'IMMOBILITÉ est l'invariant du pont unifié. */
const BOITES = `(() => {
  const box = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; };
  return { arche: box('.cc-arch'), travéeGauche: box('.cc-bay-left'), travéeDroite: box('.cc-bay-right'), pont: box('.combat-console') };
})()`;

/** LE RAIL D'OUVREURS et ses VOISINS : il doit tenir dans la rangée du monde, sous la bande de
 *  groupe et au-dessus du pont — à 360px la question se pose vraiment (rangée ≈ 245px). */
const RAIL = `(() => {
  const box = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), bas: +r.bottom.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; };
  return {
    rail: box('.mq-rail'), bande: box('.party-dock'), pont: box('.combat-console'),
    sac: box('.mq-sac'), fiche: box('.mq-fiche'), finDuTour: box('.cc-end'), frise: box('.initiative-strip'),
    grilles: ['.cc-grid-right', '.cc-grid-left', '.cc-grid-quick'].map((sel) => {
      const e = document.querySelector(sel);
      return e ? { sel, w: +e.getBoundingClientRect().width.toFixed(1), scrollW: e.scrollWidth, clientW: e.clientWidth } : null;
    }).filter(Boolean),
    fenetre: { h: window.innerHeight },
  };
})()`;

/** Les QUATRE BLOCS du dialogue. À la référence ils forment UNE RANGÉE : même haut, même pied. */
const BLOCS_DE_DIALOGUE = `(() => {
  const rang = document.querySelector('.maquette-dialogue');
  if (!rang) return null;
  const box = (sel) => { const e = rang.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { y: +r.y.toFixed(1), bas: +r.bottom.toFixed(1), h: +r.height.toFixed(1), x: +r.x.toFixed(1), w: +r.width.toFixed(1) }; };
  return { locuteur: box('.mq-dlg-qui'), parchemin: box('.parchment-card'), réponses: box('.mq-dlg-reponses'), meneur: box('.mq-dlg-meneur') };
})()`;

/** Pose (ou lève) le masque du HUD — un seul `<style>`, réutilisé. */
async function masquerLeHud(session, css) {
  await evaluerFn(session, (regles) => {
    let el = document.getElementById('mq-masque-du-hud');
    if (!el) { el = document.createElement('style'); el.id = 'mq-masque-du-hud'; document.head.appendChild(el); }
    el.textContent = regles;
    return true;
  }, css);
  await sleep(250);
}

/** Photographie le TERRAIN NU à la vue courante, en JPEG (une capture PNG de 1707px ne passerait pas
 *  l'aller-retour d'évaluation quand on la repose dans la page). */
async function capturerLeMonde(session) {
  await masquerLeHud(session, MASQUE_DU_HUD);
  const r = await session.rpc('Page.captureScreenshot', { format: 'jpeg', quality: 78 });
  await masquerLeHud(session, '');
  return `data:image/jpeg;base64,${r.data}`;
}

async function poserLeMonde(session, src) {
  return evaluerFn(session, (url) => {
    const img = document.querySelector('[data-maquette-monde]');
    if (!img) return false;
    img.src = url;
    return true;
  }, src);
}

/** Sélectionne un spécimen par son id STABLE : retour à la liste si un plein champ est monté, puis
 *  clic sur sa ligne (amenée en vue — la liste est plus haute que la fenêtre). */
async function ouvrirSpecimen(session, id) {
  if (await evaluate(session, `!!document.querySelector('[data-maquette]')`)) {
    await cliquerSelecteur(session, '.hud-topbar .btn');
    await sleep(400);
  }
  const ligne = `[data-specimen="${id}"]`;
  await attendreSelecteur(session, ligne);
  await evaluerFn(session, (sel) => {
    const el = document.querySelector(sel);
    if (el) el.scrollIntoView({ block: 'center' });
    return !!el;
  }, ligne);
  await sleep(200);
  await cliquerSelecteur(session, ligne);
  await attendreSelecteur(session, `[data-maquette="${id}"]`);
  await sleep(500);
}

/** Attend que la scène soit VRAIMENT posée : la cascade de modales d'entrée résolue (elle arrive en
 *  DEUX temps — l'ouverture, puis ce que l'ouverture déclenche) et le rendu volumique monté. Sans
 *  cette attente, le terrain photographié est noir et porte encore un « Chargement… » (mesuré). */
async function installerLaScene(session, quoi) {
  await sleep(2500);
  await resoudreModales(session, quoi);
  await sleep(2000);
  // L'OUVERTURE DE COMBAT n'est pas une modale : c'est le bandeau du pont (`cc-phase`), qu'aucune
  // cascade ne résout. Le monde photographié doit être celui du combat EN COURS, pas de son seuil.
  if (await evaluate(session, `!!document.querySelector('[data-action="round-start"]')`)) {
    await cliquerSelecteur(session, '[data-action="round-start"]');
    await sleep(1500);
    await resoudreModales(session, `${quoi} (round 1)`);
  }
  await sleep(2000);
  await resoudreModales(session, `${quoi} (2ᵉ temps)`);
  await sleep(1500);
  await attendreSelecteur(session, 'canvas.iso-stage');
  const reste = await evaluate(session, `document.body.innerText.includes('Chargement')`);
  if (reste) throw new Error(`installerLaScene(${quoi}) : la scène affiche encore « Chargement… » — le monde photographié serait vide.`);
}

/** Les quatre blocs partagent-ils leur PIED, et les deux VIGNETTES sont-elles plus PETITES que les
 *  panneaux ? (Référence RT : les cadres de portrait sont alignés en bas et nettement moins hauts.
 *  Hors tranches empilées, où la rangée devient une colonne : la question n'y a plus de sens.) */
function memePied(blocs, vue) {
  const noms = Object.keys(blocs).filter((n) => blocs[n]);
  if (noms.length < 2) return [`${vue} : seulement ${noms.length} bloc(s) de dialogue monté(s)`];
  const bas = noms.map((n) => blocs[n].bas);
  const out = [];
  if (Math.max(...bas) - Math.min(...bas) > 1) out.push(`${vue} : les blocs ne partagent pas leur PIED (${noms.map((n) => `${n} ${blocs[n].bas}`).join(' · ')})`);
  const panneau = Math.min(...['parchemin', 'réponses'].filter((n) => blocs[n]).map((n) => blocs[n].h));
  for (const n of ['locuteur', 'meneur']) {
    if (blocs[n] && blocs[n].h >= panneau) out.push(`${vue} : le cadre « ${n} » (${blocs[n].h}) n'est pas plus petit que les panneaux (${panneau})`);
  }
  return out;
}

/** Deux boîtes se RECOUVRENT-elles vraiment ? (Les deux axes : deux surfaces à la même hauteur sur
 *  des bords opposés de l'écran ne se gênent pas.) */
function seChevauchent(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.bas && b.y < a.bas;
}

function memesBoites(a, b) {
  const ecarts = [];
  for (const cle of Object.keys(a)) {
    const x = a[cle];
    const y = b[cle];
    if (!x || !y) { ecarts.push(`${cle} : absente d'un des deux côtés (${JSON.stringify(x)} / ${JSON.stringify(y)})`); continue; }
    for (const d of ['x', 'y', 'w', 'h']) {
      if (Math.abs(x[d] - y[d]) > 0.5) ecarts.push(`${cle}.${d} : ${x[d]} vs ${y[d]}`);
    }
  }
  return ecarts;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  mkdirSync(args.out, { recursive: true });
  const session = await openApp(args.url);
  const guard = consoleGuard(session);
  const echecs = [];
  const boitesParVue = {};
  try {
    // ── 1. LE MONDE, capturé à chaque vue, en exploration PUIS en combat ────────────────────────
    await evaluate(session, `window.__wfrp.scenario('embuscade', 7)`);
    await installerLaScene(session, 'exploration');
    const mondes = { exploration: {}, combat: {} };
    for (const v of VUES_RECETTE) {
      await setViewport(session, v.largeur, v.hauteur);
      await sleep(1200); // le rendu volumique se recompose sur la nouvelle fenêtre
      // L'ÉCRAN RÉEL D'AUJOURD'HUI, à la même vue : la preuve AVANT, à côté des maquettes.
      console.log(`✔ ${await shot(session, `reel-exploration-${v.nom}-${v.largeur}x${v.hauteur}`, args.out, { neutraliser: true })}`);
      mondes.exploration[v.nom] = await capturerLeMonde(session);
    }
    await setViewport(session, vueRecette('bureau').largeur, vueRecette('bureau').hauteur);
    await evaluate(session, `window.__wfrp.fight('enc-mutants')`);
    await installerLaScene(session, 'combat');
    for (const v of VUES_RECETTE) {
      await setViewport(session, v.largeur, v.hauteur);
      await sleep(1200);
      console.log(`✔ ${await shot(session, `reel-combat-${v.nom}-${v.largeur}x${v.hauteur}`, args.out, { neutraliser: true })}`);
      mondes.combat[v.nom] = await capturerLeMonde(session);
    }

    // ── 2. LA GALERIE : un spécimen, trois vues, une image chacune ───────────────────────────────
    await setViewport(session, vueRecette('bureau').largeur, vueRecette('bureau').hauteur);
    await evaluate(session, `window.__wfrp.screen('gallery')`);
    await sleep(800);
    for (const spec of SPECIMENS) {
      if (!args.specimens.includes(spec.id)) continue;
      await setViewport(session, vueRecette('bureau').largeur, vueRecette('bureau').hauteur);
      await sleep(400);
      await ouvrirSpecimen(session, spec.id);
      for (const v of VUES_RECETTE) {
        await setViewport(session, v.largeur, v.hauteur);
        await sleep(600);
        if (!(await poserLeMonde(session, mondes[spec.monde][v.nom]))) {
          echecs.push(`${spec.id} / ${v.nom} : l'image de monde (\`[data-maquette-monde]\`) est absente du plein champ.`);
        }
        await sleep(300);
        if (spec.survol) {
          try { await survoler(session, spec.survol); } catch (e) { echecs.push(`${spec.id} / ${v.nom} : survol de « ${spec.survol} » impossible (${e.message})`); }
        }
        // VERDICTS, avant la prise : ce qu'on photographie est ce qu'on vient de mesurer.
        const m = await evaluate(session, PROBE);
        echecs.push(...elementsHorsFenetre({ vue: `${spec.id} / ${v.nom}`, largeur: v.largeur, elements: m.elements }));
        if (m.scrollHeight > m.innerHeight + 1) {
          echecs.push(`${spec.id} / ${v.nom} : la PAGE défile (scrollHeight ${m.scrollHeight} > innerHeight ${m.innerHeight}) — une maquette de plein champ tient dans sa fenêtre.`);
        }
        const deb = await verdictDebordement(session);
        // Les nœuds INTERNES d'un SVG sont hors verdict : le rig d'un portrait peint dans son propre
        // repère et sa boîte dépasse le cadre qui le DECOUPE (`.dlg-portrait { overflow: hidden }`) —
        // ce n'est pas une surface que le joueur peut toucher. Même exclusion que le détecteur pur
        // d'éléments hors fenêtre (`detecteurs-pont.mjs`), qui écarte déjà tout `SVGElement`.
        for (const d of deb.debordants.filter((x) => !TAGS_SVG.has(x.tag))) {
          echecs.push(`${spec.id} / ${v.nom} : « ${d.aria} » (${d.tag}) déborde à droite (${d.droite} pour ${deb.vw}px)`);
        }
        if (spec.immobile && VUES_IMMOBILITE.includes(v.nom)) {
          boitesParVue[`${v.nom}|${spec.immobile}`] = await evaluate(session, BOITES);
        }
        // LE RAIL : mesuré à CHAQUE vue, avec ses voisins — il ne doit ni passer sous la bande de
        // groupe, ni mordre le pont, ni sortir de la fenêtre.
        const rail = await evaluate(session, RAIL);
        if (rail.rail) {
          console.log(`rail ${spec.id} / ${v.nom} ${JSON.stringify(rail)}`);
          if (rail.bande && seChevauchent(rail.rail, rail.bande)) echecs.push(`${spec.id} / ${v.nom} : le rail ${JSON.stringify(rail.rail)} recouvre la bande de groupe ${JSON.stringify(rail.bande)}.`);
          if (rail.pont && rail.rail.bas > rail.pont.y) echecs.push(`${spec.id} / ${v.nom} : le rail (bas ${rail.rail.bas}) mord le pont (haut ${rail.pont.y}).`);
        }
        // LES DEUX BOUTS DE LA BARRE : ils ne se recouvrent jamais entre eux ni avec la fin de tour.
        if (rail.frise) {
          if (rail.bande && seChevauchent(rail.frise, rail.bande)) echecs.push(`${spec.id} / ${v.nom} : la frise ${JSON.stringify(rail.frise)} recouvre la bande de groupe ${JSON.stringify(rail.bande)}.`);
          if (rail.pont && rail.frise.bas > rail.pont.y + 1) echecs.push(`${spec.id} / ${v.nom} : la frise (bas ${rail.frise.bas}) mord le pont (haut ${rail.pont.y}).`);
          if (rail.sac && seChevauchent(rail.frise, rail.sac)) echecs.push(`${spec.id} / ${v.nom} : la frise recouvre l'inventaire.`);
        }
        for (const g of rail.grilles) {
          if (g.scrollW > g.clientW + 1) echecs.push(`${spec.id} / ${v.nom} : la grille ${g.sel} DÉBORDE (scrollWidth ${g.scrollW} > clientWidth ${g.clientW}).`);
        }
        for (const [a, b] of [['sac', 'fiche'], ['sac', 'finDuTour'], ['fiche', 'finDuTour']]) {
          if (rail[a] && rail[b] && seChevauchent(rail[a], rail[b])) {
            echecs.push(`${spec.id} / ${v.nom} : « ${a} » et « ${b} » se recouvrent (${JSON.stringify(rail[a])} / ${JSON.stringify(rail[b])}).`);
          }
        }
        // LA RANGÉE DE DIALOGUE : mesurée à CHAQUE vue, jugée là où elle EST une rangée (les tranches
        // étroites l'empilent en colonne — elle n'y a plus ni haut ni pied communs à tenir).
        const blocs = await evaluate(session, BLOCS_DE_DIALOGUE);
        if (blocs) {
          console.log(`blocs ${spec.id} / ${v.nom} ${JSON.stringify(blocs)}`);
          if (VUES_IMMOBILITE.includes(v.nom)) echecs.push(...memePied(blocs, `${spec.id} / ${v.nom}`));
        }
        const nom = `mq-${spec.id.replace(/^mq-/, '')}-${v.nom}-${v.largeur}x${v.hauteur}`;
        const chemin = await shot(session, nom, args.out, { neutraliser: !spec.survol });
        console.log(`✔ ${chemin}`);
      }
    }

    // ── 3. IMMOBILITÉ de l'arche et des travées, exploration contre combat ──────────────────────
    for (const vue of VUES_IMMOBILITE) {
      const [reference, ...autres] = COTES_IMMOBILES;
      const a = boitesParVue[`${vue}|${reference}`];
      if (!a) continue;
      console.log(`immobilité ${vue} — ${reference} ${JSON.stringify(a)}`);
      for (const cote of autres) {
        const b = boitesParVue[`${vue}|${cote}`];
        if (!b) continue;
        console.log(`immobilité ${vue} — ${cote} ${JSON.stringify(b)}`);
        for (const e of memesBoites(a, b)) echecs.push(`immobilité ${vue} (${reference} vs ${cote}) : ${e}`);
      }
    }

    const erreurs = guard.errors();
    for (const e of erreurs) echecs.push(`console : ${e.type} — ${e.text}`);
  } finally {
    guard.stop();
    await session.close();
  }

  if (echecs.length) {
    console.error(`\n✖ ${echecs.length} défaut(s) :`);
    for (const e of echecs) console.error(`  · ${e}`);
    process.exit(1);
  }
  console.log('\n✔ maquettes #1849 : console à 0 erreur, aucun débordant, aucun élément hors fenêtre, aucun défilement de page, arche et travées immobiles.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
