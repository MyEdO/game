#!/usr/bin/env node
// CLI de preuve navigateur : À LA HAUTEUR RÉELLE, TOUT RESTE ATTEIGNABLE (#1847). Aucun test jsdom
// ne peut le voir — jsdom ne met rien en page, et un cliquet CSS lit des déclarations, pas des
// pixels. Voir docs/recette-navigateur.md § « La HAUTEUR réelle ».
//
// Usage :
//   node scripts/recette/hauteur-reelle.mjs
//   node scripts/recette/hauteur-reelle.mjs [--url <url>] --vues portable
//   node scripts/recette/hauteur-reelle.mjs --mesures     (imprime les mesures, aucun verdict)
//
// Écrans parcourus, à CHACUNE des trois vues de `vues-recette.json` (bureau, portable, mobile) :
//   `menu`, `party`, `creator`, `compendium`, `editor`, `test`, `coop` ; la campagne en exploration
//   puis en combat ; l'ouverture de campagne et le récap de chapitre ; un document, un butin, la
//   fiche de personnage ; le menu SYSTÈME ouvert par une vraie frappe d'Échap et ses sous-écrans
//   (Options, onglet Clavier, Coopération) atteints par de vrais clics ; la fenêtre de jet de
//   l'ouverture de combat ; le sauvetage par le Destin ; la planche de navire d'un duel naval.
// Ce qui y est VÉRIFIÉ :
//   · AUCUN SCROLLPORT DE PAGE — le contenu défile DANS un cadre, jamais `document` lui-même :
//     ce qui est ancré (en-tête, actions) reste ancré ;
//   · AUCUNE COMMANDE INATTEIGNABLE dans une carte de menu — aucun défilement ne la ramène ;
//   · AUCUN CORPS DE MODALE ÉCRASÉ — la fenêtre de jet tient ce que son CSS déclare réclamer ;
//   · ACTEUR AU TRAIT DANS SON CHAMP — la frise d'initiative ramène l'entrée courante en vue ;
//   · AUCUN PIED DE CADRE HORS CHAMP — les gestes d'un cadre restent à l'écran ;
//   · AUCUN CONTENU SOUS LE BORD D'UN CADRE sans défileur qui le ramène ;
//   · AUCUN CHEVAUCHEMENT de deux enfants d'un cadre (étendue comprise : le contenu qui déborde) ;
//   · après un VRAI clic d'onglet d'une planche (fiche, navire), la barre d'onglets et le haut du
//     corps ouvert en vue ;
//   · un écran de cadre NOMMÉ est PRÉSENT et AU-DESSUS (son dialogue, par son nom accessible ; le
//     point de son geste tombe sur lui) — absent ou recouvert, c'est un défaut.
// Les VERDICTS sont des détecteurs PURS (`detecteurs-hauteur.mjs`), testés à fixtures par
// `test:recette` : la MESURE vit ici, le JUGEMENT là-bas.
//
// Sortie : la liste complète des défauts, exit 1 s'il en reste, exit 0 sinon.
// Résidu mesuré sur l'arbre : Codex à 360×740, page 3007/740 — #1860. Aucune liste d'exemption ici :
// la sonde reste rouge tant qu'il vit.
import {
  openApp, evaluate, setViewport, sleep, gotoScreen, resoudreModales, realKey, clickButtonByText, clicReel, VUES_RECETTE,
} from './lib.mjs';
import {
  scrollportDePage, commandesInatteignables, corpsDeModaleEcrase, courantHorsChamp, piedHorsChamp,
  contenuSousLeBord, ecranNomme, enfantsQuiSeChevauchent, ongletHorsDeVue, nomRecouvert,
} from './detecteurs-hauteur.mjs';

function parseArgs(argv) {
  const out = { url: undefined, vues: VUES_RECETTE, mesures: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url') out.url = argv[++i];
    else if (a === '--vues') {
      const noms = argv[++i].split(',').map((n) => n.trim());
      out.vues = VUES_RECETTE.filter((v) => noms.includes(v.nom));
      if (!out.vues.length) throw new Error(`--vues : aucune vue connue parmi « ${noms.join(', ')} » (${VUES_RECETTE.map((v) => v.nom).join(', ')})`);
    } else if (a === '--mesures') out.mesures = true;
    else throw new Error(`Option inconnue : ${a}`);
  }
  return out;
}

/** Sonde DOM — le relevé de HAUTEUR d'un écran, en UN aller-retour.
 *  La PAGE, c'est `document.scrollingElement` : le scrollport de dernier recours, celui qu'aucun
 *  écran ne doit laisser déborder. De chaque CADRE défilant on relève sa boîte et sa course — une
 *  boîte qui couvre le viewport EST un scrollport de page, et une boîte qui commence sous la
 *  fenêtre ne montre rien de ce qu'elle tient. De chaque CARTE DE MENU on relève ce qu'aucun
 *  défilement ne peut ramener en vue. */
const PROBE = `(() => {
  const page = document.scrollingElement || document.documentElement;
  const bord = (e) => { const r = e.getBoundingClientRect(); return { left: +r.left.toFixed(1), right: +r.right.toFixed(1), top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1) }; };
  const nomDe = (e) => (e.className && typeof e.className === 'string'
    ? '.' + e.className.trim().split(/\\s+/).join('.')
    : e.tagName.toLowerCase()).slice(0, 60);

  const defileurs = [];
  for (const e of document.querySelectorAll('*')) {
    if (e === page || e === document.body) continue;
    const st = getComputedStyle(e);
    if (!/(auto|scroll)/.test(st.overflowY)) continue;
    if (e.scrollHeight - e.clientHeight <= 1) continue;
    defileurs.push({ sel: nomDe(e), scrollH: e.scrollHeight, clientH: e.clientHeight, boite: bord(e) });
  }

  // FENÊTRE À CHAMP LISIBLE (\`data-champ\`) : elle publie son contrat sur le voile (\`--roll-fenetre\`
  // et les deux planchers, modal.css) ; la sonde le lit et le transmet, elle n'en fabrique aucune
  // valeur. Une modale sans champ lisible (document, butin) n'a pas ce contrat : son corps défile.
  const modales = [];
  const voile = document.querySelector('.modal-overlay[data-champ]');
  const corps = voile ? voile.querySelector(':scope > .modal > .modal-body') : null;
  const boite = voile ? voile.querySelector('.modal') : null;
  if (voile && corps) {
    const cs = getComputedStyle(voile);
    const px = (nom) => { const v = parseFloat(cs.getPropertyValue(nom)); return Number.isFinite(v) ? v : null; };
    modales.push({
      quoi: (boite ? nomDe(boite) : '.modal'),
      corps: { clientH: corps.clientHeight, scrollH: corps.scrollHeight },
      place: Math.round(voile.getBoundingClientRect().height),
      boite: boite ? Math.round(boite.getBoundingClientRect().height) : null,
      reclame: px('--roll-fenetre'),
      plancherHaut: px('--roll-band-min') ?? 0,
      plancherBas: px('--roll-dock-min') ?? 0,
      bandeHaute: Math.round(parseFloat(cs.paddingTop)),
      bandeBasse: Math.round(parseFloat(cs.paddingBottom)),
    });
  }

  // CARTES DE MENU (menu principal, écrans à carte, menu SYSTÈME et ses sous-écrans) : on RELÈVE le
  // bas de chaque commande, le bas du corps défilant et la course qui lui reste. Le critère
  // d'atteignabilité est au détecteur, pas ici.
  const cartes = [];
  for (const carte of document.querySelectorAll('.menu-card')) {
    const cc = carte.querySelector('.menu-card-body');
    if (!cc) continue;
    const cb = cc.getBoundingClientRect();
    const commandes = [];
    for (const e of carte.querySelectorAll('button, a[href], input, select')) {
      const b = e.getBoundingClientRect();
      if (!b.height) continue;
      commandes.push({ nom: (e.textContent || e.tagName).replace(/\\s+/g, ' ').trim().slice(0, 28) || e.tagName, bas: +b.bottom.toFixed(1) });
    }
    cartes.push({
      sel: nomDe(carte),
      corpsBas: +cb.bottom.toFixed(1),
      restant: +(cc.scrollHeight - cc.clientHeight - cc.scrollTop).toFixed(1),
      commandes,
    });
  }

  // PIEDS DE CADRE (\`.cadre-pied\`) : leur boîte. Le critère (dans la fenêtre) est au détecteur.
  const pieds = [...document.querySelectorAll('.cadre-pied')]
    .filter((e) => e.getClientRects().length)
    .map((e) => ({ sel: nomDe(e), ...bord(e) }));

  // CADRES (\`Modal\` : son \`.modal-body\` ; \`ScreenShell\` : son voile) : le bord, et le plus bas des
  // éléments qu'aucun défileur, jusqu'au cadre, ne ramène. Un ancêtre qui ROGNE au-dessus du bord
  // (repli, ellipse) cache son contenu exprès : l'élément n'est pas relevé. Le critère est au détecteur.
  const defile = (e) => /(auto|scroll)/.test(getComputedStyle(e).overflowY);
  const cadres = [];
  for (const [boite, corps] of [
    ...[...document.querySelectorAll('.modal-overlay > .modal')].map((m) => [m, m.querySelector(':scope > .modal-body')]),
    ...[...document.querySelectorAll('.worldmap-overlay')].map((o) => [o, o]),
  ]) {
    if (!corps || !corps.getClientRects().length) continue;
    const bord = +corps.getBoundingClientRect().bottom.toFixed(1);
    let sansDefileur = null;
    if (!defile(corps)) {
      for (const e of corps.querySelectorAll('*')) {
        if (!e.getClientRects().length) continue;
        const st = getComputedStyle(e);
        if (st.visibility === 'hidden' || st.position === 'fixed') continue;
        const bas = +e.getBoundingClientRect().bottom.toFixed(1);
        if (bas <= bord + 1 || (sansDefileur && bas <= sansDefileur.bas)) continue;
        let libre = true;
        for (let a = e.parentElement; a && a !== corps; a = a.parentElement) {
          const sa = getComputedStyle(a);
          if (/(auto|scroll)/.test(sa.overflowY) || sa.position === 'fixed') { libre = false; break; }
          if (/(hidden|clip)/.test(sa.overflowY) && a.getBoundingClientRect().bottom <= bord + 1) { libre = false; break; }
        }
        if (libre) sansDefileur = { sel: nomDe(e), bas };
      }
    }
    // FRATRIES : les BOÎTES de niveau bloc d'un même parent (items de grille ou de flex, blocs), dans
    // le flux (ni positionnées hors flux, ni flottantes : la prose s'écoule autour), et l'ÉTENDUE de
    // chacune — sa boîte, plus ce qui en déborde sans défileur ni rognage (\`display: contents\`
    // transparent). Un dessin (\`svg\`) est une feuille, une boîte en ligne n'a pas de frère de bloc.
    // Le critère (recouvrement) est au détecteur.
    const horsFlux = (e) => { const st = getComputedStyle(e); return /^(absolute|fixed)$/.test(st.position) || st.float !== 'none'; };
    const enfants = (e) => e instanceof SVGElement ? [] : [...e.children].flatMap((k) => getComputedStyle(k).display === 'contents' ? enfants(k) : [k]);
    const bloc = (e) => !/^inline/.test(getComputedStyle(e).display);
    const etendues = new Map();
    const etendue = (e) => {
      if (etendues.has(e)) return etendues.get(e);
      const b = e.getBoundingClientRect();
      const r = { left: +b.left.toFixed(1), right: +b.right.toFixed(1), top: +b.top.toFixed(1), bottom: +b.bottom.toFixed(1) };
      const st = getComputedStyle(e);
      if (st.overflowX === 'visible' && st.overflowY === 'visible') {
        for (const k of enfants(e)) {
          if (!k.getClientRects().length || horsFlux(k) || getComputedStyle(k).visibility === 'hidden') continue;
          const x = etendue(k);
          r.left = Math.min(r.left, x.left); r.right = Math.max(r.right, x.right);
          r.top = Math.min(r.top, x.top); r.bottom = Math.max(r.bottom, x.bottom);
        }
      }
      etendues.set(e, r);
      return r;
    };
    const fratries = [];
    for (const p of [corps, ...corps.querySelectorAll('*')]) {
      const k = enfants(p).filter((x) => x.getClientRects().length && bloc(x) && !horsFlux(x) && getComputedStyle(x).visibility !== 'hidden');
      if (k.length > 1) fratries.push({ parent: nomDe(p), enfants: k.map((x) => ({ sel: nomDe(x), ...etendue(x) })) });
    }
    cadres.push({ sel: nomDe(boite), bord, sansDefileur, fratries });
  }

  // FRISE D'INITIATIVE : l'entrée AU TRAIT, et la piste qui la porte (son scrollport).
  const piste = document.querySelector('.initiative-strip .is-tiles');
  const cell = document.querySelector('.initiative-strip [aria-current="step"]');
  return {
    page: { scrollH: page.scrollHeight, clientH: page.clientHeight },
    fenetre: { largeur: window.innerWidth, hauteur: window.innerHeight },
    defileurs,
    modales,
    cartes,
    pieds,
    cadres,
    piste: piste ? bord(piste) : null,
    courant: cell ? { nom: (cell.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 30) || 'au trait', ...bord(cell) } : null,
  };
})()`;

/** Sonde de l'ÉCRAN NOMMÉ : les dialogues montés (nom accessible), celui dont le nom contient \`nom\`, et
 *  si le point de son geste primaire — sinon de sa tête — tombe sur lui (\`elementFromPoint\`). */
const NOMME = (nom) => `(() => {
  const norm = (t) => (t || '').replace(/\\s+/g, ' ').trim();
  const nomDe = (d) => norm(d.getAttribute('aria-label') || (d.getAttribute('aria-labelledby') && document.getElementById(d.getAttribute('aria-labelledby'))?.textContent));
  const dialogues = [...document.querySelectorAll('[role="dialog"]')].filter((d) => d.getClientRects().length);
  const d = dialogues.filter((x) => nomDe(x).includes(${JSON.stringify(nom)})).pop();
  if (!d) return { dialogues: dialogues.map(nomDe), dialogue: null };
  const geste = d.querySelector('.cadre-pied .btn-primary') || d.querySelector('.cadre-pied button') || d.querySelector('.modal-tete, .modal-title, .worldmap-head') || d;
  const r = geste.getBoundingClientRect();
  const el = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 12));
  const hote = el && el.closest('[role="dialog"]');
  const cls = el ? (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\\s+/).join('.') : el.tagName.toLowerCase()) : '(rien)';
  return { dialogues: dialogues.map(nomDe), dialogue: { nom: nomDe(d), dessus: !!el && d.contains(el), cible: hote ? cls + ' dans « ' + nomDe(hote) + ' »' : cls } };
})()`;

/** Relevé de la fenêtre à champ lisible montée (\`.modal-overlay[data-champ]\`) : son titre, son corps. */
/** Onglet NON sélectionné de la planche, amené dans la planche, et le point de son clic. */
const ONGLET_A_CLIQUER = `(() => {
  const onglet = [...document.querySelectorAll('.sheet-main [role=tab]')].find((t) => t.getAttribute('aria-selected') !== 'true');
  if (!onglet) return null;
  onglet.scrollIntoView({ block: 'nearest' });
  const r = onglet.getBoundingClientRect();
  const x = r.x + r.width / 2, y = r.y + r.height / 2;
  const sous = document.elementFromPoint(x, y);
  return { x, y, texte: onglet.textContent.trim(), sous: sous && !onglet.contains(sous) ? (sous.className || sous.tagName) + '' : null };
})()`;

/** Nom de la planche montée (`.planche-nom`) : 5 points (centre, 4 coins rentrés de 3px), et ce qui
 *  tombe sur chacun quand ce n'est pas le dialogue de la planche (le nom lui-même, hors dialogue). */
const NOM_PLANCHE = `(() => {
  const e = [...document.querySelectorAll('.planche-nom')].find((x) => x.getClientRects().length);
  if (!e) return null;
  const cadre = e.closest('[role="dialog"]') ?? e;
  const r = e.getBoundingClientRect();
  const pts = [[r.x + r.width / 2, r.y + r.height / 2], [r.x + 3, r.y + 3], [r.right - 3, r.y + 3], [r.x + 3, r.bottom - 3], [r.right - 3, r.bottom - 3]];
  const couverts = pts.map(([x, y]) => document.elementFromPoint(x, y))
    .filter((h) => !h || !cadre.contains(h))
    .map((h) => (!h ? '(hors écran)' : h.closest('.party-dock') ? 'party-dock' : (typeof h.className === 'string' && h.className ? '.' + h.className.trim().split(/\\s+/).join('.') : h.tagName.toLowerCase())));
  return { texte: e.textContent.trim(), rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], couverts };
})()`;

/** Relevé d'après clic d'onglet : la fenêtre de la planche, sa barre d'onglets, le haut du corps. */
const RELEVE_ONGLET = `(() => {
  const l = document.querySelector('.sheet-layout');
  const barre = document.querySelector('.sheet-main > [role=tablist]');
  const corps = document.querySelector('.sheet-tabbody');
  if (!l || !barre || !corps) return null;
  const c = l.getBoundingClientRect(), b = barre.getBoundingClientRect();
  return {
    actif: document.querySelector('.sheet-main [role=tab][aria-selected=true]')?.textContent.trim() ?? null,
    finDeCourse: l.scrollTop >= l.scrollHeight - l.clientHeight - 1,
    cadre: { top: Math.round(c.top), bottom: Math.round(c.bottom) },
    barre: { top: Math.round(b.top), bottom: Math.round(b.bottom) },
    corps: { top: Math.round(corps.getBoundingClientRect().top) },
  };
})()`;

/** Fenêtre RESTÉE après `resoudreModales` : au DOM, ou étape de cascade encore en cours au store.
 *  Mesure du juge B10 (#1920) : la carte d'entrée de scène montait après la main rendue et restait
 *  ouverte sous les écrans jugés ensuite. */
const FENETRE_RESTANTE = `(() => {
  const norm = (t) => (t || '').replace(/\\s+/g, ' ').trim();
  const v = document.querySelector('.modal-overlay');
  if (v) return norm(v.querySelector('.modal-title, .rm-title, h3')?.textContent).slice(0, 80) || '(sans titre)';
  const pc = window.__game.getState().pendingCascade;
  return pc ? 'étape « ' + (pc.participants[pc.cursor]?.reveal?.kind ?? pc.participants[pc.cursor]?.kind ?? '?') + ' » au store' : null;
})()`;

/** Tous les défauts d'un relevé, pour une vue et un écran donnés. `attendu` : ce que l'écran nommé
 *  PORTE (un cadre, un pied) — absent du relevé, c'est un défaut, jamais un vert. */
function defauts(m, vue, ecran, attendu = {}) {
  const ou = `${vue.largeur}×${vue.hauteur} (${vue.nom})`;
  return [
    ...scrollportDePage({ vue: ou, ecran, page: m.page, fenetre: m.fenetre, defileurs: m.defileurs }),
    ...commandesInatteignables({ vue: ou, ecran, cartes: m.cartes }),
    ...corpsDeModaleEcrase({ vue: `${ou} · ${ecran}`, modales: m.modales }),
    ...courantHorsChamp({ vue: `${ou} · ${ecran}`, courant: m.courant, piste: m.piste }),
    ...piedHorsChamp({ vue: ou, ecran, fenetre: m.fenetre, pieds: m.pieds, piedExige: !!attendu.pied }),
    ...contenuSousLeBord({ vue: ou, ecran, cadres: m.cadres, cadreExige: !!attendu.cadre }),
    ...enfantsQuiSeChevauchent({ vue: ou, ecran, cadres: m.cadres }),
  ];
}

/** Imprime le relevé d'un écran, TOUJOURS — une sonde dit ce qu'elle a mesuré, pas seulement ce
 *  qu'elle reproche. */
function dire(m, vue, ecran, mauvais) {
  const jet = m.modales[0];
  const frise = m.courant ? ` · au trait « ${m.courant.nom} » [${m.courant.left}..${m.courant.right}] dans piste [${m.piste.left}..${m.piste.right}]` : '';
  const cartes = m.cartes.length
    ? ` · cartes ${m.cartes.map((c) => `${c.sel} (${c.commandes.length} commandes, corps ${c.corpsBas} + ${c.restant} de course)`).join(', ')}`
    : '';
  console.log(
    `  ${ecran.padEnd(26)} page ${m.page.scrollH}/${m.page.clientH}`
    + `${m.defileurs.length ? ` · cadres ${m.defileurs.map((d) => `${d.sel} ${d.scrollH}/${d.clientH}`).join(', ')}` : ''}`
    + cartes
    + `${jet ? ` · JET corps ${jet.corps.clientH}/${jet.corps.scrollH} boîte ${jet.boite} réclame ${jet.reclame} bandes ${jet.bandeHaute}/${jet.bandeBasse} dans ${jet.place}` : ''}`
    + `${frise}`
    + ` → ${mauvais.length ? `${mauvais.length} défaut(s)` : 'OK'}`,
  );
}

/** États de setup des écrans de cadre de campagne — la forme des \`pending*\` du store. */
const OUVERTURE = {
  surtitre: 'Une campagne pour Warhammer Fantasy Roleplay', titre: 'L’Ennemi Intérieur',
  chapitre: 'Chapitre 1 — On recherche : aventuriers courageux', pitch: 'Nos héros forment un **groupe hétéroclite**.',
};
const DOCUMENT = { title: 'Lettre de Kastor Lieberung', text: 'Mon cher frère,\n\nJe t’écris depuis **Altdorf**. ' + 'La route fut longue et les bois peu sûrs. '.repeat(30) };
const BUTIN = {
  title: 'Coffre du relais', messages: ['Sous la paille, un coffre cerclé de fer.'], gold: { gold: 1, silver: 4, brass: 6 },
  gear: ['epee', 'dague', 'corde'].map((ref) => ({ label: ref, magic: false, effect: { type: 'giveTrapping', ref } })),
};
const RECAP = {
  titre: 'Chapitre 1 — la route d’Altdorf', sousTitre: 'Ce que la compagnie emporte', px: 120,
  chronique: [{ text: 'Atteindre Altdorf', tone: 'ok' }], tombes: [], lieux: ['Auberge La Diligence', 'Altdorf'],
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const session = await openApp(args.url);
  const echecs = [];
  try {
    for (const vue of args.vues) {
      await setViewport(session, vue.largeur, vue.hauteur);
      await sleep(400);
      console.log(`\n── ${vue.largeur}×${vue.hauteur} (${vue.nom}) ──────────────────────────────`);
      const juger = (m, ecran, attendu) => {
        const d = args.mesures ? [] : defauts(m, vue, ecran, attendu);
        dire(m, vue, ecran, d);
        echecs.push(...d);
      };
      /** Écran de CADRE posé par le store : on attend SON dialogue (nom accessible \`nom\`), jamais un
       *  délai fixe ; absent ou recouvert au délai, le relevé part quand même et \`ecranNomme\` le dit. */
      const cadrePose = async (etat, nom, ecran, attendu) => {
        await evaluate(session, `window.__game.setState(${etat})`);
        let n = null;
        for (let i = 0; i < 25 && !(n && n.dialogue); i++) {
          n = await evaluate(session, NOMME(nom));
          if (!n.dialogue) await sleep(200);
        }
        await sleep(300);
        n = await evaluate(session, NOMME(nom));
        const nomme = args.mesures ? [] : ecranNomme({ vue: `${vue.largeur}×${vue.hauteur} (${vue.nom})`, ecran, nom, ...n });
        echecs.push(...nomme);
        juger(await evaluate(session, PROBE), ecran, attendu);
      };
      /** Le nom de la planche montée n'est sous aucun élément hors de son dialogue. */
      const nomDePlanche = async (ecran) => {
        const nom = await evaluate(session, NOM_PLANCHE);
        const d = nomRecouvert({ vue: `${vue.largeur}×${vue.hauteur} (${vue.nom})`, ecran, nom });
        console.log(`  ${`${ecran} › nom`.padEnd(26)} ${nom ? `« ${nom.texte} » [${nom.rect.join(',')}]` : 'absent'} → ${d.length ? `${d.length} défaut(s)` : 'OK'}`);
        if (!args.mesures) echecs.push(...d);
      };
      /** Un VRAI clic d'onglet de la planche montée : ce que le joueur vient d'ouvrir est en vue. */
      const clicDOnglet = async (ecran) => {
        const ici = `${vue.largeur}×${vue.hauteur} (${vue.nom})`;
        const onglet = await evaluate(session, ONGLET_A_CLIQUER);
        if (!onglet) { echecs.push(`${ici} · ${ecran} : aucun onglet à cliquer — sonde aveugle`); return; }
        await clicReel(session, onglet.x, onglet.y);
        await sleep(600);
        const r = await evaluate(session, RELEVE_ONGLET);
        const d = !r ? [`${ici} · ${ecran} : planche absente après le clic d'onglet`]
          : r.actif !== onglet.texte ? [`${ici} · ${ecran} : le clic sur « ${onglet.texte} » n'a pas atteint l'onglet (point sur « ${onglet.sous} »)`]
          : ongletHorsDeVue({ vue: ici, ecran, onglet: onglet.texte, ...r });
        console.log(`  ${`${ecran} › clic d’onglet`.padEnd(26)} ${r ? `barre ${r.barre.top - r.cadre.top}px sous le haut, corps à ${r.corps.top}/${r.cadre.bottom}` : 'absente'} → ${d.length ? `${d.length} défaut(s)` : 'OK'}`);
        if (!args.mesures) echecs.push(...d);
      };

      // ── Écrans plein-champ, atteints par le routeur. `test` et `coop` en sont : ce sont des
      //    CARTES DE MENU, et leur hôte a perdu son `overflow-y` avec les autres. ───────────────
      for (const ecran of ['menu', 'party', 'creator', 'compendium', 'editor', 'test', 'coop']) {
        await gotoScreen(session, ecran, { settleMs: 900 });
        juger(await evaluate(session, PROBE), ecran);
      }

      // ── Campagne : exploration, le menu SYSTÈME et ses sous-écrans, puis le combat ───────────
      await gotoScreen(session, 'menu', { settleMs: 300 });
      await evaluate(session, `window.__wfrp.scenario('embuscade', 7)`);
      await sleep(1600);
      await resoudreModales(session, `${vue.nom} · ouverture`);
      await sleep(400);
      const restante = await evaluate(session, FENETRE_RESTANTE);
      if (restante) echecs.push(`${vue.largeur}×${vue.hauteur} (${vue.nom}) · campagne (exploration) : fenêtre restée ouverte après l'ouverture — « ${restante} », les écrans suivants seraient jugés dessous`);
      juger(await evaluate(session, PROBE), 'campagne (exploration)');

      // Les deux écrans de CADRE DE CAMPAGNE à pied (\`ScreenShell\` \`footer\`) : l'ouverture et le récap
      // de chapitre. Leur état est posé par le store (setup), le relevé est celui du rendu réel.
      for (const [nom, etat] of [
        ['ouverture de campagne', { pendingChapterRecap: null, pendingOuverture: OUVERTURE }],
        ['récap de chapitre', { pendingOuverture: null, pendingChapterRecap: RECAP }],
      ]) {
        await cadrePose(JSON.stringify(etat), etat.pendingOuverture ? OUVERTURE.titre : RECAP.titre, nom, { cadre: true, pied: true });
      }
      await evaluate(session, `window.__game.setState({ pendingOuverture: null, pendingChapterRecap: null })`);
      await sleep(400);

      // Les MODALES de lecture (document, butin) et la PLANCHE de personnage.
      await cadrePose(`{ document: ${JSON.stringify(DOCUMENT)} }`, DOCUMENT.title, 'document', { cadre: true, pied: true });
      await cadrePose(`{ document: null, pendingLoot: ${JSON.stringify(BUTIN)} }`, BUTIN.title, 'butin', { cadre: true, pied: true });
      await evaluate(session, `window.__game.setState({ pendingLoot: null })`);
      // La planche porte le NOM de ce qu'elle montre (`Planche` `nom`) : c'est son nom de dialogue.
      const heros = await evaluate(session, `(window.__game.getState().party || [])[0]?.label ?? '(aucun héros)'`);
      await cadrePose(`{ sheetId: (window.__game.getState().party || [])[0]?.id ?? null }`, heros, 'fiche de personnage', { cadre: true });
      await nomDePlanche('fiche de personnage');
      await clicDOnglet('fiche de personnage');
      await evaluate(session, `window.__game.setState({ sheetId: null })`);
      await sleep(400);

      // Le menu SYSTÈME s'ouvre par une VRAIE frappe d'Échap, et ses sous-écrans par de VRAIS
      // clics : c'est le seul chemin où le joueur les rencontre, et le seul qui prouve que le
      // contrat de carte tient aussi sous le voile de pause.
      await realKey(session, { key: 'Escape' });
      await sleep(800);
      juger(await evaluate(session, PROBE), 'menu système');
      for (const [libelle, nom] of [['Options', 'menu système › Options'], ['Clavier', 'menu système › Options/Clavier']]) {
        try {
          await clickButtonByText(session, libelle);
        } catch (e) {
          echecs.push(`${vue.largeur}×${vue.hauteur} (${vue.nom}) · ${nom} : « ${libelle} » introuvable — sonde aveugle sur ce sous-écran (${e.message.slice(0, 60)})`);
          continue;
        }
        await sleep(800);
        juger(await evaluate(session, PROBE), nom);
      }
      await realKey(session, { key: 'Escape' });
      await sleep(500);
      try {
        await clickButtonByText(session, 'Coopération');
        await sleep(800);
        juger(await evaluate(session, PROBE), 'menu système › Coopération');
      } catch (e) {
        echecs.push(`${vue.largeur}×${vue.hauteur} (${vue.nom}) · menu système › Coopération : introuvable — sonde aveugle (${e.message.slice(0, 60)})`);
      }
      await realKey(session, { key: 'Escape' });
      await sleep(400);
      await realKey(session, { key: 'Escape' });
      await sleep(500);

      await evaluate(session, `window.__wfrp.fight('enc-mutants')`);
      await sleep(1800);
      // La cascade d'OUVERTURE DE COMBAT est la plus longue fenêtre de jet du jeu (Initiative de
      // tous les combattants). On la juge AVANT de la résoudre — la résoudre d'abord rendrait la
      // sonde aveugle sur la seule modale de jet que le combat ouvre sans geste de joueur.
      juger(await evaluate(session, PROBE), 'fenêtre de jet (combat)');

      await resoudreModales(session, `${vue.nom} · ouverture de combat`);
      await sleep(800);
      juger(await evaluate(session, PROBE), 'campagne (combat)');

      // SAUVETAGE PAR LE DESTIN d'un héros au coup fatal : décision de combat, champ lisible.
      await cadrePose(
        `{ pendingFateSave: { heroId: window.__wfrp.battle().combatants.find((c) => c.kind === 'hero').id, source: 'hit' } }`,
        'Le Destin', 'sauvetage par le Destin', { cadre: true, pied: true },
      );
      await evaluate(session, `window.__game.setState({ pendingFateSave: null })`);
      await sleep(400);

      // FICHE EN COMBAT : la bande de groupe flotte au-dessus du voile de la fiche (#1829).
      const heroCombat = await evaluate(session, `(window.__game.getState().battle?.combatants || []).find((c) => c.kind === 'hero')?.label ?? '(aucun héros)'`);
      await cadrePose(`{ sheetId: (window.__game.getState().battle?.combatants || []).find((c) => c.kind === 'hero')?.id ?? null }`, heroCombat, 'fiche de personnage (combat)', { cadre: true });
      await nomDePlanche('fiche de personnage (combat)');
      await evaluate(session, `window.__game.setState({ sheetId: null })`);
      await sleep(400);

      // PLANCHE DE NAVIRE (duel naval) : le contenu hébergé défile chez lui.
      await evaluate(session, `window.__wfrp.scenario('duel-naval')`);
      await sleep(1600);
      await evaluate(session, `window.__wfrp.fight('duel')`);
      await sleep(1800);
      await resoudreModales(session, `${vue.nom} · ouverture du duel naval`);
      await sleep(600);
      const navire = await evaluate(session, `(window.__game.getState().battle?.combatants || []).find((c) => c.bodyShape === 'vehicule')?.label ?? '(aucun navire)'`);
      await cadrePose(
        `{ sheetId: (window.__game.getState().battle?.combatants || []).find((c) => c.bodyShape === 'vehicule')?.id ?? null }`,
        navire, 'planche de navire', { cadre: true },
      );
      await nomDePlanche('planche de navire');
      await clicDOnglet('planche de navire');
      await evaluate(session, `window.__game.setState({ sheetId: null })`);
      await sleep(400);
    }
  } finally {
    await session.close();
  }

  if (echecs.length) {
    console.error(`\n${echecs.length} défaut(s) de HAUTEUR :`);
    for (const e of echecs) console.error(`  · ${e}`);
    process.exit(1);
  }
  console.log('\nHauteur réelle : aucun scrollport de page, aucun corps de modale écrasé, acteur au trait en vue, aucun pied de cadre hors champ, aucun contenu coupé sous le bord d\'un cadre, aucun chevauchement dans un cadre — aux trois vues.');
}

main().catch((e) => {
  console.error(`ERR ${e.message}`);
  process.exit(1);
});
