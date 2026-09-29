#!/usr/bin/env node
// CLI de preuve navigateur : LE PONT DE CONSOLE TIENT SON CONTENU, ET SA BANDE NE BOUGE PAS D'UNE
// FORME À L'AUTRE. Promotion en script de recette des sondes qui ont trouvé les défauts du lot
// « pont continu / forme spectatrice » — aucun test jsdom ne peut les voir : jsdom ne fait pas de
// mise en page, et les cliquets CSS lisent des déclarations, pas des pixels.
// Voir docs/recette-navigateur.md § « Preuve headless (agents) ».
//
// Usage :
//   node scripts/recette/console-pont-formes.mjs
//   node scripts/recette/console-pont-formes.mjs [--url <url>] --widths 900,700
//   node scripts/recette/console-pont-formes.mjs --mesures      (imprime les mesures, aucun verdict)
//
// Ce qui est VÉRIFIÉ, à chaque largeur et dans les TROIS formes de console :
//   · AUCUNE AMPUTATION — `.cc-dock` et chacune de ses régions tiennent dans leur boîte
//     (`scrollHeight <= clientHeight`), et aucun contrôle du pont ne descend sous le bas du champ ;
//   · BANDE STABLE — la hauteur rendue de `.combat-console` est la MÊME dans les trois formes
//     (pont complet du tour du joueur · forme spectatrice du tour adverse · ouverture de combat) ;
//   · BANDEAU DE PHASE — sa boîte ne recouvre ni la bande de groupe, ni la frise d'initiative, ni le
//     fil de combat, ni l'arche, à aucune de ses trois adresses ;
//   · ARCHE IMMOBILE — dans les formes spectatrices, sa boîte est celle du pont complet (verdict
//     d'écran A1 du 2026-09-29, « la boîte reste, la matière s'éteint »), et de part et d'autre
//     d'elle c'est le PLATEAU qu'on touche (le pont n'a plus de bande) ;
//   · AUCUNE SURFACE OCCULTÉE par un pont, AUCUN élément hors fenêtre — détecteurs PURS,
//     `detecteurs-pont.mjs`, testés à fixtures par `test:recette`.
//
// Sortie : exit 1 au premier défaut (liste complète imprimée), exit 0 si tout passe.
import { openApp, evaluate, setViewport, sleep, clickButtonByText, cliquerSelecteur, resoudreModales, VUES_RECETTE } from './lib.mjs';
import { surfaceOcculteeParUnPont, elementsHorsFenetre } from './detecteurs-pont.mjs';

/** VUES de la passe EXPLORATION : les trois vues JUGÉES (bureau, portable, mobile), lues à leur
 *  source UNIQUE `vues-recette.json` — jamais recopiées. Le pont léger n'a qu'une forme : ce qui
 *  varie d'une vue à l'autre est la place qu'il laisse aux surfaces. */
const VUES_EXPLORATION = VUES_RECETTE.map((v) => [v.largeur, v.hauteur]);
/** VUES de recette : les trois vues jugées, plus les largeurs canon de la charte (900 / 700 / 560)
 *  et la tranche où la rangée à quatre régions est le plus serrée (1100). La HAUTEUR compte autant
 *  que la largeur : le côté d'alvéole se calcule en `vh`. */
const VUES = [...VUES_EXPLORATION, [1100, 780], [900, 780], [700, 780], [560, 740]].sort((a, b) => b[0] - a[0]);
const DEFAULT_WIDTHS = VUES.map(([w]) => w);
const hauteurDe = (w) => (VUES.find(([lw]) => lw === w) ?? [w, 780])[1];

function parseArgs(argv) {
  const out = { url: undefined, widths: DEFAULT_WIDTHS, mesures: false, stress: 0 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url') out.url = argv[++i];
    else if (a === '--widths') out.widths = argv[++i].split(',').map((n) => Number(n.trim()));
    else if (a === '--mesures') out.mesures = true;
    else if (a === '--stress') out.stress = Number(argv[++i] ?? 105);
    else throw new Error(`Option inconnue : ${a}`);
  }
  return out;
}

/** Sonde DOM : toutes les mesures d'une forme, en UN aller-retour. */
const PROBE = `(() => {
  const box = (r) => r ? { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), bottom: +r.bottom.toFixed(1), right: +r.right.toFixed(1) } : null;
  const rect = (sel) => { const e = document.querySelector(sel); return e ? box(e.getBoundingClientRect()) : null; };
  const debord = (sel) => {
    const e = document.querySelector(sel);
    if (!e) return null;
    return { sel, scroll: e.scrollHeight, client: e.clientHeight, deborde: e.scrollHeight - e.clientHeight };
  };
  const recouvre = (a, b) => {
    if (!a || !b) return null;
    const ox = Math.min(a.right, b.right) - Math.max(a.x, b.x);
    const oy = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
    return (ox > 0.5 && oy > 0.5) ? { ox: +ox.toFixed(1), oy: +oy.toFixed(1) } : null;
  };
  const dock = document.querySelector('.cc-dock');
  const pont = document.querySelector('.combat-console');
  const bandeau = rect(".cc-phase[data-phase='ouverture']");
  // Le bandeau de phase OÙ QU'IL SOIT (parapet, ouverture, centré au-dessus de l'arche) : c'est la
  // même boîte à trois adresses, et aucune ne doit en recouvrir une autre surface du champ.
  const phase = document.querySelector('.cc-phase');
  const phaseBox = phase ? box(phase.getBoundingClientRect()) : null;
  const archeBox = rect('.cc-arch');
  // OCCLUSION (détecteur pur surfaceOcculteeParUnPont) : pour chaque surface basse du champ et
  // chaque pont monté, l'intersection des boîtes et CE QUE LE NAVIGATEUR REND en son centroïde.
  const PONTS = ['.combat-console', '.exploration-dock'];
  const SURFACES = ['.dialogue-box', '.log-drawer', '.ld-panel', '.combat-feed', '.pov-controls', ".spectator-chip[data-pose='ecran']", '.hud-rail > .worldmap-btn', '.initiative-strip'];
  const surfaces = [];
  for (const selPont of PONTS) {
    const p = document.querySelector(selPont);
    if (!p) continue;
    const pr = p.getBoundingClientRect();
    for (const selS of SURFACES) {
      const s = document.querySelector(selS);
      if (!s) continue;
      const sr = s.getBoundingClientRect();
      const ox = Math.min(pr.right, sr.right) - Math.max(pr.left, sr.left);
      const oy = Math.min(pr.bottom, sr.bottom) - Math.max(pr.top, sr.top);
      // Un DESCENDANT du pont n'est pas une surface occultée PAR lui : hors combat, le tiroir-journal
      // est ASSIS sur le pont d'exploration (sa commande en est un enfant). Le pont répond alors au
      // centroïde et le verdict serait un faux positif — le relevé le dit, le détecteur n'a rien à
      // deviner.
      if (p.contains(s)) { surfaces.push({ nom: selS, pont: selPont, inter: (ox > 0.5 && oy > 0.5) ? { w: +ox.toFixed(1), h: +oy.toFixed(1) } : null, touche: 'descendant' }); continue; }
      if (!(ox > 0.5 && oy > 0.5)) { surfaces.push({ nom: selS, pont: selPont, inter: null, touche: 'surface' }); continue; }
      const cx = (Math.max(pr.left, sr.left) + Math.min(pr.right, sr.right)) / 2;
      const cy = (Math.max(pr.top, sr.top) + Math.min(pr.bottom, sr.bottom)) / 2;
      const hit = document.elementFromPoint(cx, cy);
      const touche = !hit ? 'rien' : (p.contains(hit) ? 'pont' : (s.contains(hit) || hit === s ? 'surface' : 'autre'));
      surfaces.push({ nom: selS, pont: selPont, inter: { w: +ox.toFixed(1), h: +oy.toFixed(1) }, touche });
    }
  }
  // HORS FENÊTRE (détecteur pur elementsHorsFenetre) : TOUS les éléments non-SVG du document —
  // pas seulement les boutons du pont (la sonde de #1806 ratait les alvéoles vides et les fiches).
  // Un élément qui vit dans un SCROLLPORT n'est pas hors de la fenêtre : il est à UN GESTE de là
  // (la frise défile en bande sous 700, le panneau du journal défile). Ce qui est jugé ici, c'est
  // l'élément que RIEN ne ramène à l'écran.
  const dansUnScrollport = (e) => {
    for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (/(auto|scroll)/.test(cs.overflowX + ' ' + cs.overflowY)) return true;
    }
    return false;
  };
  const horsFenetre = [...document.querySelectorAll('body *')]
    .filter((e) => !(e instanceof SVGElement) && e.getClientRects().length && !dansUnScrollport(e))
    .map((e) => { const r = e.getBoundingClientRect(); return { nom: (e.getAttribute('data-cell') || e.getAttribute('data-action') || e.className || e.tagName).toString().slice(0, 32), left: +r.left.toFixed(1), right: +r.right.toFixed(1) }; })
    .filter((e) => e.right > window.innerWidth + 1 || e.left < -1);
  // DE PART ET D'AUTRE DE L'ARCHE, c'est le PLATEAU : en forme spectatrice le pont ne prend aucun
  // clic hors de son arche (le monde reste jouable pendant le tour d'un adversaire).
  const flancs = archeBox ? [archeBox.x / 2, (archeBox.right + window.innerWidth) / 2].map((x) => {
    const y = archeBox.y + archeBox.h / 2;
    const hit = document.elementFromPoint(x, Math.min(y, window.innerHeight - 1));
    return { x: +x.toFixed(1), quoi: hit ? (hit.closest('.combat-console') ? 'pont' : (hit.closest('.iso-stage') ? 'plateau' : (hit.className || hit.tagName).toString().slice(0, 28))) : 'rien' };
  }) : [];
  // CONTRÔLES du pont : tout ce qu'un joueur doit pouvoir viser, plus les textes gravés dont la
  // coupe est un défaut de rendu (nom du porteur, libellés de plaque).
  const controles = [...document.querySelectorAll('.combat-console button, .combat-console .cc-arch-name, .combat-console [data-nom]')].map((e) => {
    const r = e.getBoundingClientRect();
    return { quoi: (e.getAttribute('data-cell') || e.getAttribute('data-action') || e.className || e.tagName).slice(0, 28), rect: box(r) };
  });
  return {
    forme: pont ? pont.getAttribute('data-forme') : null,
    // RÉGIONS rendues dans la bande : quatre en forme complète, l'arche SEULE en spectatrice.
    regions: dock ? [...dock.children].map((e) => (e.className || e.tagName).toString().split(' ')[0]) : [],
    // … et ce que la bande PEINT : une bande éteinte ne montre ni nappe ni ombre, et son liseré est
    // transparent (sa PLACE reste — c'est elle qui tient l'arche immobile d'une forme à l'autre).
    bandePeinte: dock ? (() => {
      const cs = getComputedStyle(dock);
      return { fond: cs.backgroundImage, ombre: cs.boxShadow, liseret: cs.borderTopColor, epaisseur: cs.borderTopWidth };
    })() : null,
    pont: pont ? box(pont.getBoundingClientRect()) : null,
    debords: [debord('.cc-dock'), debord('.cc-bay-left'), debord('.cc-bay-right'), debord('.cc-corner'), debord('.cc-arch')].filter(Boolean),
    bandeau,
    phase: phaseBox,
    phaseSurArche: recouvre(phaseBox, archeBox),
    phaseSurFil: recouvre(phaseBox, rect('.combat-feed')),
    phaseSurFrise: recouvre(phaseBox, rect('.initiative-strip')),
    archeRect: archeBox,
    surfaces,
    horsFenetre,
    flancs,
    groupe: rect('.party-dock'),
    frise: rect('.initiative-strip'),
    fil: rect('.combat-feed'),
    surGroupe: recouvre(bandeau, rect('.party-dock')),
    surFrise: recouvre(bandeau, rect('.initiative-strip')),
    surFil: recouvre(bandeau, rect('.combat-feed')),
    surRail: recouvre(bandeau, rect('.hud-rail')),
    surPont: recouvre(bandeau, rect('.combat-console')),
    arche: (() => {
      const a = document.querySelector('.cc-arch');
      if (!a) return null;
      const cs = getComputedStyle(a);
      const enfants = [...a.children].map((e) => ({ q: (e.className || e.tagName).toString().slice(0, 22), h: +e.getBoundingClientRect().height.toFixed(1) }));
      const portrait = a.querySelector('.ptile');
      return { h: +a.getBoundingClientRect().height.toFixed(1), pad: cs.paddingTop + '/' + cs.paddingBottom, gap: cs.rowGap, enfants, portrait: portrait ? +portrait.getBoundingClientRect().height.toFixed(1) : null };
    })(),
    // Hauteur DÉCLARÉE de la bande, résolue par le moteur (les calc/max/clamp ne se lisent pas au
    // texte) : une boîte témoin qui ne porte QUE cette hauteur.
    deckDeclare: (() => {
      const t = document.createElement('div');
      t.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;height:var(--cc-deck-h)';
      document.body.appendChild(t);
      const h = +t.getBoundingClientRect().height.toFixed(1);
      t.remove();
      return h;
    })(),
    // SAILLIE déclarée (ce dont le fronton dépasse la bande) : la boîte du pont vaut son EMPREINTE,
    // bande PLUS saillie — c'est elle qu'il faut retrancher pour juger la bande.
    saillieDeclare: (() => {
      const t = document.createElement('div');
      t.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;height:var(--cc-saillie)';
      document.body.appendChild(t);
      const h = +t.getBoundingClientRect().height.toFixed(1);
      t.remove();
      return h;
    })(),
    pontSurFil: recouvre(pont ? box(pont.getBoundingClientRect()) : null, rect('.combat-feed')),
    pontSurFrise: recouvre(pont ? box(pont.getBoundingClientRect()) : null, rect('.initiative-strip')),
    controles,
    champ: box(document.querySelector('.stage').getBoundingClientRect()),
    // PASSE EXPLORATION : le pont LÉGER et les surfaces basses qui vivent avec lui. Le défaut
    // FONDATEUR du ticket (le bandeau de dialogue passant sous le pont) ne se voit que là — hors
    // combat, la console de combat n'est pas montée, et une sonde qui ne mesure que le combat MENT
    // par couverture.
    explo: rect('.exploration-dock'),
    dialogue: rect('.dialogue-box'),
    panneau: rect('.ld-panel'),
    tiroir: rect('.log-drawer'),
  };
})()`;

/** Amène le combat jusqu'aux CASES du tour d'un héros (le pont COMPLET). */
async function jusquAuTourDuJoueur(session) {
  for (let i = 0; i < 6; i++) {
    await resoudreModales(session, 'mise en place');
    if (await evaluate(session, `!!document.querySelector('.combat-console button.cc-cell')`)) return;
    if (await evaluate(session, `!!document.querySelector(".cc-phase [data-action='round-start']:not(:disabled)")`)) {
      await clickButtonByText(session, 'Commencer');
      await sleep(800);
      await resoudreModales(session, 'ouverture de Round');
      continue;
    }
    await evaluate(session, AU_TOUR_DU_JOUEUR);
    await sleep(600);
  }
  const etat = await evaluate(session, `(() => {
    const s = window.__wfrp.store.getState();
    const b = s.battle;
    const pont = document.querySelector('.combat-console');
    return JSON.stringify({ over: b && b.over, turn: b && b.turn, forme: pont && pont.getAttribute('data-forme'), pause: !!s.pendingRoundStart, modale: !!document.querySelector('.modal-overlay') });
  })()`);
  throw new Error(`le pont COMPLET ne monte pas : le combat ne parvient pas au tour d’un héros — ${etat}`);
}

/** Force le tour sur un HÉROS de l'ordre — la forme COMPLÈTE. La sonde mesure la MISE EN PAGE des
 *  trois formes : le tour se pose par le store, comme celui de l'adversaire, plutôt que de dépendre
 *  du hasard des tours d'IA (le déroulé du combat, lui, est couvert par `hud-clickables.mjs`). */
const AU_TOUR_DU_JOUEUR = `(() => {
  const s = window.__wfrp.store.getState();
  const b = s.battle;
  const i = b.order.findIndex((id) => (b.combatants.find((c) => c.id === id) || {}).kind === 'hero');
  if (i < 0) throw new Error('aucun héros dans l’ordre d’initiative');
  window.__wfrp.store.setState({ battle: { ...b, turn: i, acted: false }, pendingRoundStart: null });
  return i;
})()`;

/** Force le tour sur le premier combattant NON contrôlé de l'ordre (forme spectatrice). */
const AU_TOUR_ADVERSE = `(() => {
  const s = window.__wfrp.store.getState();
  const b = s.battle;
  const i = b.order.findIndex((id) => (b.combatants.find((c) => c.id === id) || {}).kind === 'enemy');
  if (i < 0) throw new Error('aucun ennemi dans l’ordre d’initiative');
  window.__wfrp.store.setState({ battle: { ...b, turn: i }, pendingRoundStart: null });
  return i;
})()`;

/** Rouvre une pause de Round 1 (forme d'OUVERTURE : bandeau centré + médaillon). */
const A_L_OUVERTURE = `(() => {
  const s = window.__wfrp.store.getState();
  window.__wfrp.store.setState({ battle: { ...s.battle, turn: -1 }, pendingRoundStart: { round: 1, readyBySeat: {} } });
  return true;
})()`;

/** SETUP d'exploration : une conversation EN COURS. C'est du montage d'état (`__wfrp`), jamais le
 *  geste testé — ce qui est jugé ici est la MISE EN PAGE du bandeau face au pont léger. */
const OUVRIR_UN_DIALOGUE = `(() => {
  const s = window.__wfrp.store.getState();
  const pnj = (s.scene && s.scene.entities || []).find((e) => e.kind === 'npc' || e.dialogue);
  window.__wfrp.store.setState({ dialogue: {
    speakerId: pnj ? pnj.id : undefined,
    nodeId: 'n1',
    dialogue: { id: 'sonde-pont', nodes: [{ id: 'n1', desc: 'Sonde de recette — le bandeau de dialogue tient-il AU-DESSUS du pont d’exploration, à toute largeur ? Cette réplique est volontairement longue : c’est sa hauteur qui a mis le défaut fondateur du ticket #1848 en évidence, 31px de boîte passés sous une bande de 49px.', choices: [{ label: 'Rester dans l’ombre et écouter' }, { label: 'Répondre, franchement' }] }] },
  } });
  return true;
})()`;
const FERMER_LE_DIALOGUE = `(() => { window.__wfrp.store.setState({ dialogue: null }); return true; })()`;

/** Défauts de la passe EXPLORATION (liste vide = tout passe). Les deux détecteurs purs y jugent le
 *  relevé, et la sonde commence par se prouver NON AVEUGLE : sans pont léger, sans dialogue OUVERT
 *  et sans panneau de journal DÉPLOYÉ, elle ne mesure rien de ce que le ticket a corrigé. */
function defautsExploration(m, w) {
  const ou = `exploration ${w}px`;
  const out = [];
  if (!m.explo) return [`${ou} : aucun pont d'exploration (.exploration-dock) — sonde aveugle`];
  if (!m.dialogue) out.push(`${ou} : aucun bandeau de dialogue monté — sonde aveugle sur le défaut FONDATEUR du ticket`);
  if (!m.panneau) out.push(`${ou} : le panneau du tiroir-journal n'est pas déployé — sonde aveugle`);
  // Rien de ce qui vit dans la rangée du monde ne descend sous le bord HAUT du pont : la rangée
  // s'arrête là, et le pont est en dessous.
  for (const [nom, r] of [['bandeau de dialogue', m.dialogue], ['panneau du journal', m.panneau]]) {
    if (r && r.bottom > m.explo.y + 1) out.push(`${ou} : le ${nom} descend ${+(r.bottom - m.explo.y).toFixed(1)}px SOUS le bord haut du pont`);
  }
  out.push(...surfaceOcculteeParUnPont({ vue: ou, surfaces: m.surfaces }));
  out.push(...elementsHorsFenetre({ vue: ou, largeur: w, elements: m.horsFenetre }));
  return out;
}

/** Défauts d'une mesure de forme (liste vide = tout passe). */
function defauts(m, w, forme) {
  const out = [];
  const ou = `${forme} ${w}px`;
  if (!m.pont) return [`${ou} : aucun pont (.combat-console) — sonde aveugle`];
  if (m.forme !== (forme === 'pont complet' ? 'complete' : 'spectatrice')) {
    out.push(`${ou} : le pont rend la forme « ${m.forme} », pas celle attendue`);
  }
  // AMPUTATION : une région dont le contenu ne tient pas dans sa boîte est coupée à l'écran.
  for (const d of m.debords) {
    if (d.deborde > 1) out.push(`${ou} : ${d.sel} ampute son contenu de ${d.deborde}px (scrollHeight ${d.scroll} > clientHeight ${d.client})`);
  }
  // … et rien du pont ne descend sous le bas du champ (le débord d'une bande ancrée en bas sort de
  // l'écran : c'est ainsi que le nom du héros et la plaque de sortie étaient tranchés).
  for (const c of m.controles) {
    const hors = +(c.rect.bottom - m.champ.bottom).toFixed(1);
    if (hors > 1) out.push(`${ou} : « ${c.quoi} » sort du champ par le bas de ${hors}px`);
    if (c.rect.y < m.champ.y - 1) out.push(`${ou} : « ${c.quoi} » sort du champ par le haut de ${+(m.champ.y - c.rect.y).toFixed(1)}px`);
  }
  // La bande RENDUE vaut la bande DÉCLARÉE : sans cette égalité, une dérive du chrome d'arche
  // pousse le pont vers le haut sans qu'aucune région ne déborde — le pont mange alors le terrain
  // et recouvre le fil (mesuré : +105px de chrome ⇒ 222,5×20px de fil recouvert).
  // Elle n'est exigée que là où le pont est une LIGNE : sous 700 les régions s'EMPILENT dans la
  // forme complète, et la bande vaut la pile.
  if (w > 700) {
    // La boîte du pont est son EMPREINTE : bande + saillie du fronton. C'est la BANDE qu'on juge.
    // La réserve est un PLANCHER : la bande ne peut jamais être plus COURTE que ce qu'elle déclare
    // (sinon la réserve ment à ses lecteurs), et elle ne doit pas dériver au-delà de l'air que le
    // chrome d'arche embarque — mesuré : +2,1px à 1707×780, +4,8px à 1366×650.
    const bandeRendue = +(m.pont.h - m.saillieDeclare).toFixed(1);
    const ecart = +(bandeRendue - m.deckDeclare).toFixed(1);
    if (ecart < -1) out.push(`${ou} : la bande RENDUE fait ${bandeRendue}px, MOINS que les ${m.deckDeclare}px déclarés — la réserve ment`);
    if (ecart > 6) out.push(`${ou} : la bande RENDUE fait ${bandeRendue}px pour ${m.deckDeclare}px DÉCLARÉS (dérive ${ecart}px)`);
  }
  if (m.pontSurFil) out.push(`${ou} : le pont recouvre le fil de combat de ${m.pontSurFil.ox}×${m.pontSurFil.oy}px`);
  if (m.pontSurFrise) out.push(`${ou} : le pont recouvre la frise d'initiative de ${m.pontSurFrise.ox}×${m.pontSurFrise.oy}px`);
  if (forme === 'ouverture') {
    if (!m.bandeau) out.push(`${ou} : aucun bandeau d'ouverture centré — sonde aveugle`);
    else {
      if (m.surGroupe) out.push(`${ou} : le bandeau d'ouverture recouvre la bande de groupe de ${m.surGroupe.ox}×${m.surGroupe.oy}px`);
      if (m.surFrise) out.push(`${ou} : le bandeau d'ouverture recouvre la frise d'initiative de ${m.surFrise.ox}×${m.surFrise.oy}px`);
      if (m.surFil) out.push(`${ou} : le bandeau d'ouverture recouvre le fil de combat de ${m.surFil.ox}×${m.surFil.oy}px`);
      if (m.surRail) out.push(`${ou} : le bandeau d'ouverture recouvre le rail d'outils de ${m.surRail.ox}×${m.surRail.oy}px`);
      if (m.surPont) out.push(`${ou} : le bandeau d'ouverture recouvre le pont de ${m.surPont.ox}×${m.surPont.oy}px`);
      const dc = Math.abs(m.bandeau.x + m.bandeau.w / 2 - (m.champ.x + m.champ.w / 2));
      if (dc > 1) out.push(`${ou} : le bandeau d'ouverture est décentré de ${dc.toFixed(1)}px`);
      // POSITION DE RÉFÉRENCE (RT « round 0 ») : EN HAUT de la carte. Elle ne cède que là où la zone
      // haute est pleine (sous 700, frise en bande et fil monté en haut) — pas un pixel avant.
      if (w > 700 && m.bandeau.y > m.champ.y + m.champ.h / 2) {
        out.push(`${ou} : le bandeau d'ouverture a quitté le HAUT de la carte (y=${m.bandeau.y} dans un champ de ${m.champ.h}px)`);
      }
    }
  }
  if (m.forme === 'spectatrice') {
    // L'ARCHE SEULE (arbitrage 2026-09-20) : aucune région de plus, et une bande ÉTEINTE — plus de
    // « barres gauche et droite » à l'écran, alors que sa BOÎTE tient toujours la géométrie.
    const enTrop = m.regions.filter((r) => r !== 'cc-arch');
    if (enTrop.length) out.push(`${ou} : la bande porte encore ${enTrop.join(', ')} — « les barres gauche et droite »`);
    if (m.bandePeinte) {
      if (m.bandePeinte.fond !== 'none') out.push(`${ou} : la bande peint encore sa nappe (${m.bandePeinte.fond.slice(0, 40)})`);
      if (m.bandePeinte.ombre !== 'none') out.push(`${ou} : la bande porte encore son ombre (${m.bandePeinte.ombre.slice(0, 40)})`);
      if (!/rgba\(0, 0, 0, 0\)|transparent/.test(m.bandePeinte.liseret)) out.push(`${ou} : le liseré de la bande est encore peint (${m.bandePeinte.liseret})`);
      if (parseFloat(m.bandePeinte.epaisseur) <= 0) out.push(`${ou} : le liseré a perdu son ÉPAISSEUR — le pont saute d'une forme à l'autre`);
    }
    if (!m.archeRect) out.push(`${ou} : aucune arche — la forme spectatrice est vide`);
    for (const f of m.flancs) {
      if (f.quoi !== 'plateau') out.push(`${ou} : à x=${f.x}, de côté de l'arche, on touche « ${f.quoi} » et non le plateau`);
    }
  }
  // BANDEAU DE PHASE — à CHACUNE de ses adresses, il ne recouvre ni l'arche, ni le fil, ni la frise.
  if (m.phaseSurArche) out.push(`${ou} : le bandeau de phase recouvre l'arche de ${m.phaseSurArche.ox}×${m.phaseSurArche.oy}px`);
  if (m.phaseSurFil) out.push(`${ou} : le bandeau de phase recouvre le fil de combat de ${m.phaseSurFil.ox}×${m.phaseSurFil.oy}px`);
  if (m.phaseSurFrise) out.push(`${ou} : le bandeau de phase recouvre la frise de ${m.phaseSurFrise.ox}×${m.phaseSurFrise.oy}px`);
  // … et les deux DÉTECTEURS PURS, sur le relévé de cette forme.
  out.push(...surfaceOcculteeParUnPont({ vue: ou, surfaces: m.surfaces }));
  out.push(...elementsHorsFenetre({ vue: ou, largeur: w, elements: m.horsFenetre }));
  return out;
}

/** Attend que le pont rende la forme voulue : mesurer un DOM à moitié posé rend la sonde aveugle. */
async function attendreForme(session, forme) {
  for (let i = 0; i < 30; i++) {
    if (await evaluate(session, `((d) => !!d && d.getAttribute('data-forme') === '${forme}')(document.querySelector('.combat-console'))`)) return;
    await sleep(200);
  }
  throw new Error(`le pont ne rend pas la forme « ${forme} » après 6s`);
}

async function mesurer(session, w) {
  const formes = {};
  await setViewport(session, w, hauteurDe(w));
  await sleep(500);
  // La console se remonte après un changement de viewport : on ATTEND qu'elle soit là plutôt que de
  // mesurer un DOM à moitié posé (une mesure absente rendrait la sonde aveugle sans le dire).
  await attendreForme(session, 'complete');
  formes['pont complet'] = await evaluate(session, PROBE);
  await evaluate(session, AU_TOUR_ADVERSE);
  await attendreForme(session, 'spectatrice');
  formes['spectatrice'] = await evaluate(session, PROBE);
  await evaluate(session, A_L_OUVERTURE);
  await attendreForme(session, 'spectatrice');
  formes['ouverture'] = await evaluate(session, PROBE);
  return formes;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const session = await openApp(args.url);
  const echecs = [];
  try {
    await evaluate(session, `window.__wfrp.scenario('embuscade', 7)`);
    await sleep(1500);
    await resoudreModales(session, 'ouverture');
    // ── PASSE EXPLORATION, AVANT tout combat : le pont LÉGER porte le même invariant que le pont de
    //    combat, et c'est SOUS LUI que le défaut fondateur du ticket a été vu. Trois vues jugées.
    for (const [w, h] of VUES_EXPLORATION) {
      await setViewport(session, w, h);
      await sleep(500);
      await evaluate(session, OUVRIR_UN_DIALOGUE);
      await sleep(400);
      // Le tiroir est un INTERRUPTEUR : on le pousse jusqu'à ce que son panneau soit là (un clic
      // parti trop tôt après le changement de viewport le referme aussitôt), et on le dit si le
      // panneau ne vient pas — une sonde aveugle s'annonce, elle ne se tait pas.
      for (let essai = 0; essai < 3; essai++) {
        if (await evaluate(session, `!!document.querySelector('.ld-panel')`)) break;
        try {
          await cliquerSelecteur(session, '.exploration-dock .ld-btn');
        } catch (e) {
          echecs.push(`exploration ${w}px : le tiroir-journal ne s'ouvre pas (${e.message})`);
          break;
        }
        await sleep(500);
      }
      const m = await evaluate(session, PROBE);
      console.log(`exploration ${w}×${h} — pont ${m.explo ? `${m.explo.h}px (haut y=${m.explo.y})` : '—'} · dialogue ${m.dialogue ? `${m.dialogue.w}×${m.dialogue.h} bas=${m.dialogue.bottom}` : '—'} · panneau ${m.panneau ? `${m.panneau.w}×${m.panneau.h} bas=${m.panneau.bottom}` : '—'}`);
      if (!args.mesures) echecs.push(...defautsExploration(m, w));
      await evaluate(session, FERMER_LE_DIALOGUE);
      await sleep(200);
    }
    await setViewport(session, VUES[0][0], VUES[0][1]);
    await evaluate(session, `window.__wfrp.fight('enc-mutants')`);
    await sleep(1500);
    await resoudreModales(session, 'ouverture de combat');
    await jusquAuTourDuJoueur(session);
    // STRESS : le CONTENU de l'arche dérive (une rangée de plus, un chrome mal calibré) SANS que sa
    // déclaration bouge, et on exige que la sonde le voie. Faire dériver le TOKEN ne prouverait
    // rien : la réserve en découle, elle suivrait la dérive (mesuré : aucun défaut).
    if (args.stress) {
      await evaluate(session, `(() => {
        const st = document.createElement('style');
        st.textContent = '.cc-arch { padding-top: ${args.stress}px; }';
        document.head.appendChild(st);
        return true;
      })()`);
      await sleep(400);
    }
    for (const w of args.widths) {
      // Chaque largeur repart du TOUR DU JOUEUR : les deux autres formes sont posées par-dessus.
      await evaluate(session, AU_TOUR_DU_JOUEUR);
      await sleep(300);
      await resoudreModales(session, `largeur ${w}`);
      const formes = await mesurer(session, w);
      const z = formes['ouverture'];
      if (args.mesures && formes['pont complet'].arche) console.log(`    arche ${JSON.stringify(formes['pont complet'].arche)}`);
      if (args.mesures) console.log(`    zones hautes — groupe ${JSON.stringify(z.groupe)} · frise ${JSON.stringify(z.frise)} · fil ${JSON.stringify(z.fil)}`);
      const hauteurs = Object.entries(formes).map(([f, m]) => `${f} ${m.pont ? m.pont.h : '—'}px`).join(' · ');
      console.log(`${w}×${hauteurDe(w)} — bande : ${hauteurs}${formes['ouverture'].bandeau ? ` · bandeau y=${formes['ouverture'].bandeau.y} h=${formes['ouverture'].bandeau.h}` : ''}`);
      for (const [f, m] of Object.entries(formes)) {
        for (const d of m.debords) console.log(`    ${f} [${m.forme}] · ${d.sel} : scroll ${d.scroll} / client ${d.client}${d.deborde > 1 ? `  ← DÉBORDE de ${d.deborde}px` : ''}`);
        if (!args.mesures) echecs.push(...defauts(m, w, f));
      }
      // BANDE STABLE et ARCHE IMMOBILE, à toute largeur : la hauteur rendue du pont et la boîte de
      // l'arche ne bougent pas d'une forme à l'autre (verdict d'écran A1 du 2026-09-29).
      const hs = Object.entries(formes).filter(([, m]) => m.pont).map(([f, m]) => [f, m.pont.h]);
      const ref = hs[0];
      for (const [f, h] of hs.slice(1)) {
        if (Math.abs(h - ref[1]) > 1 && !args.mesures) echecs.push(`${w}px : la bande passe de ${ref[1]}px (${ref[0]}) à ${h}px (${f}) — la géométrie bat d'une forme à l'autre`);
      }
      const a0 = formes['pont complet'].archeRect;
      for (const f of ['spectatrice', 'ouverture']) {
        const a = formes[f].archeRect;
        if (!a0 || !a || args.mesures) continue;
        const d = Math.max(...['x', 'y', 'w', 'h'].map((k) => Math.abs(a[k] - a0[k])));
        if (d > 1) echecs.push(`${w}px : l'arche passe de ${JSON.stringify(a0)} (pont complet) à ${JSON.stringify(a)} (${f}) — sa boîte bouge d'un tour à l'autre`);
      }
    }
  } finally {
    await session.close();
  }

  // En mode STRESS le verdict s'INVERSE : c'est l'absence de défaut qui est l'échec — une sonde
  // qu'aucune dérive ne fait rougir ne prouve rien.
  if (args.stress) {
    if (!echecs.length) {
      console.error(`
SONDE AVEUGLE : +${args.stress}px dans l'arche n'ont produit AUCUN défaut.`);
      process.exit(1);
    }
    console.log(`
Sonde RÉFUTABLE : +${args.stress}px dans l'arche produisent ${echecs.length} défaut(s) —`);
    for (const e of echecs) console.log(`  · ${e}`);
    return;
  }
  if (echecs.length) {
    console.error(`\n${echecs.length} défaut(s) du pont de console :`);
    for (const e of echecs) console.error(`  · ${e}`);
    process.exit(1);
  }
  console.log('\nPont de console : aucune amputation, bande stable dans les trois formes, bandeau d’ouverture dégagé.');
}

main().catch((e) => {
  console.error(`ERR ${e.message}`);
  process.exit(1);
});
