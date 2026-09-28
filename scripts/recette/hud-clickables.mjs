#!/usr/bin/env node
// CLI de preuve navigateur : le HUD RESTE CLIQUABLE aux largeurs étroites. Promotion en test des
// sondes qui ont trouvé les défauts du lot #1135 — une surface du HUD peut en recouvrir une autre
// sans qu'aucun test de rendu ne bronche (les cliquets CSS lisent des déclarations, pas des pixels).
// Voir docs/recette-navigateur.md § « Preuve headless (agents) ».
//
// Usage :
//   node scripts/recette/hud-clickables.mjs
//   node scripts/recette/hud-clickables.mjs --widths 700,560,360
//   node scripts/recette/hud-clickables.mjs --url <autre serveur>   # défaut : le port de CET arbre
//
// Sans `--url`, la cible est le serveur de DEV de cet arbre (`DEFAULT_URL`, scripts/port-dev.mjs) ;
// une preview (`npm run preview`) a son propre port, imprimé à son lancement.
//
// Ce qui est VÉRIFIÉ, à chaque largeur, par `elementFromPoint` au centre de chaque surface :
//   · en combat, la console (`.combat-console`) est MONTÉE, peuplée, et chacune de ses cases
//     (`.cc-cell`) reçoit son propre clic ;
//   · en combat, `.combat-feed` et `.initiative-strip` n'ont aucune surface commune ;
//   · en combat, le tiroir du journal OUVERT (déplié par clic réel) ne recouvre pas la console ;
//   · en combat, la piste `.is-tiles` DÉFILE (scrollWidth > clientWidth) et tient dans sa bande ;
//   · en combat, la frise en BANDE horizontale va jusqu'au bord droit (réserve ≤ 8px) et son cartouche
//     de Round reste visible à TOUT décalage de défilement de la piste ;
//   · en combat, la frise se juge TROIS FOIS : à la pause d'initiative (seul état où les badges de
//     score sont montés), au tour engagé, et l'acteur au trait EN BAS de l'ordre (piste défilée à
//     fond, mise en évidence de l'unité active dans le champ) ;
//   · en combat, à neuf positions de défilement, rien ne se voit dans la TÊTE de la frise — ni
//     vignette ni mobilier en débord (score, chevron, pastille, encre de l'unité au trait) entre le
//     bord du champ et le cartouche de Round, et rien ne PEINT SUR lui (rangs d'empilement
//     comparés) ; au repos, toute entrée qui COMMENCE dans la zone utile de la colonne y FINIT
//     (hauteur arrondie au pas d'entrée, CONSTANT). Axe qui ne défile pas = NON MESURÉ ;
//   · la piste du groupe (`.pd-track`) tient sur UNE ligne (aucune carte à un autre `y`) ;
//   · quand le rail est DISSOUS (`display: contents`, ≤700), son ouvreur d'écran se pose LUI-MÊME
//     (position hors flux) et reçoit son clic. ANGLE MORT DÉCLARÉ : cet ouvreur n'est monté que
//     lorsqu'un navire est en jeu (`CampaignView.tsx`) — le scénario `enc-mutants` sondé ici ne le
//     porte pas, le verdict est donc CONDITIONNEL à sa présence, et sa structure reste gardée en
//     unité (`src/ui/ui-ratchets.test.ts`) ;
//   · en exploration, la boîte pleine ligne de `.objective-banner` n'avale aucun clic hors de sa
//     tête : le point sondé à droite de `.objective-head` rend la scène ;
//   · en exploration, chaque portrait du groupe (`.party-dock .ptile`) reçoit son clic — la pile de
//     contexte (haut-gauche) ne mord pas sur le haut-centre, qui appartient au GROUPE.
//
// Sortie : exit 1 au premier défaut (liste complète imprimée), exit 0 si tout passe.
import { openApp, evaluate, setViewport, sleep, clickButtonByText, cliquerSelecteur, resoudreModales, VUE_REFERENCE } from './lib.mjs';

// Les trois largeurs étroites (700/560/360) portent les recouvrements ; les deux larges portent la
// zone morte du bandeau d'objectif, dont la boîte n'excède sa tête qu'au-delà de 900px — sonder
// 700/560/360 seuls rendait cette vérification AVEUGLE (marge morte mesurée à 0px).
// La plus large est la vue de RÉFÉRENCE (`vues-recette.json`), jamais un couple recopié (#1847).
const DEFAULT_WIDTHS = [VUE_REFERENCE.largeur, 1100, 900, 700, 560, 360];
const HEIGHT = VUE_REFERENCE.hauteur;

function parseArgs(argv) {
  const out = { url: undefined, widths: DEFAULT_WIDTHS };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url') out.url = argv[++i];
    else if (a === '--widths') out.widths = argv[++i].split(',').map((n) => Number(n.trim()));
    else throw new Error(`Option inconnue : ${a}`);
  }
  return out;
}

/** Sonde DOM : mesures + verdicts d'atteignabilité, en UN aller-retour par largeur. */
const PROBE = `(() => {
  const cn = (e) => e ? ((e.className && e.className.baseVal !== undefined ? e.className.baseVal : String(e.className || '')) + ' <' + e.tagName + '>') : 'rien';
  const rectOf = (sel) => { const e = document.querySelector(sel); return e ? e.getBoundingClientRect() : null; };
  const box = (r) => r ? { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) } : null;
  // Une boîte NON RENDUE (repliée, écran d'un parent en display:none) a un rect 0×0 : elle n'a aucun
  // clic à recevoir, et le point (0,0) rend le décor — la juger « recouverte » est un FAUX POSITIF
  // (mesuré : à 560 et 360 la bande de groupe est repliée sur sa poignée, piste en display none).
  const reaches = (el) => {
    const r = el.getBoundingClientRect();
    const rendu = r.width > 0 && r.height > 0;
    const top = rendu ? document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) : null;
    return { rendu, ok: !!(top && (top === el || el.contains(top))), hitBy: cn(top), rect: box(r) };
  };
  const overlap = (a, b) => {
    if (!a || !b) return null;
    const ox = Math.min(a.right, b.right) - Math.max(a.x, b.x);
    const oy = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
    return (ox > 0 && oy > 0) ? { ox: +ox.toFixed(1), oy: +oy.toFixed(1) } : null;
  };

  const strip = document.querySelector('.initiative-strip');
  const tiles = document.querySelector('.is-tiles');
  const ptiles = [...document.querySelectorAll('.party-dock .ptile')].map((p, i) => ({ i, ...reaches(p) }));
  // Console de combat (pont du tour) : chacune de ses cases se sonde comme une commande de vue.
  // (Aucun accent grave dans cette sonde : elle vit dans un gabarit de chaîne.)
  const pont = document.querySelector('.combat-console');
  const dockBtns = [...document.querySelectorAll('.combat-console button.cc-cell')].map((b, i) => ({
    i, label: (b.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 40) || (b.getAttribute('title') || '').trim(), ...reaches(b),
  }));

  // TIROIR DU JOURNAL : sa réserve du bas ne se juge qu'au panneau DÉPLIÉ (fermé, il ne recouvre
  // rien). C'est le seul état où la question « passe-t-il sous la console ? » a un sens.
  const panneau = document.querySelector('.ld-panel');
  const rp = panneau ? panneau.getBoundingClientRect() : null;
  const tiroir = document.querySelector('.log-drawer') ? {
    ouvert: !!(rp && rp.width > 0 && rp.height > 0),
    rect: box(rp),
    surPont: overlap(rp, pont ? pont.getBoundingClientRect() : null),
  } : null;

  let objective = null;
  const banner = document.querySelector('.objective-banner');
  const head = document.querySelector('.objective-head');
  if (banner && head) {
    const rb = banner.getBoundingClientRect(), rh = head.getBoundingClientRect();
    // Marge MORTE = ce que la boîte pleine ligne ajoute à droite de la tête. Si elle existe, un point
    // en son milieu doit rendre la SCÈNE, pas la bannière.
    const marge = rb.right - rh.right;
    if (marge > 4) {
      const px = rh.right + marge / 2, py = rb.y + rh.height / 2;
      const top = document.elementFromPoint(px, py);
      objective = { marge: +marge.toFixed(1), sondeA: { x: +px.toFixed(1), y: +py.toFixed(1) },
        avale: !!(top && banner.contains(top)), hitBy: cn(top) };
    } else {
      objective = { marge: +marge.toFixed(1), avale: false, hitBy: 'boîte au ras de la tête (aucune marge morte)' };
    }
  }

  // Rail d'outils DISSOUS (≤700, hud.css) : il ne porte plus l'ancrage de ses enfants, son ouvreur
  // d'écran doit se poser lui-même (sinon il retombe dans le flux du stage).
  const rail = document.querySelector('.hud-rail');
  const rails = rail ? {
    dissous: getComputedStyle(rail).display === 'contents',
    ouvreurs: [...document.querySelectorAll('.hud-rail > .worldmap-btn')].map((b, i) => ({
      i, label: (b.getAttribute('title') || '').trim(), position: getComputedStyle(b).position, ...reaches(b),
    })),
  } : null;

  // Frise : réserve de droite et VISIBILITÉ du cartouche de Round à fond de défilement. La mesure
  // déplace la piste puis la REMET où elle était — aucune trace pour les largeurs suivantes.
  let frise = null;
  if (strip && tiles) {
    const rs = strip.getBoundingClientRect();
    const dansLaPiste = (el) => {
      const r = el.getBoundingClientRect(), rt = tiles.getBoundingClientRect();
      return r.width > 0 && r.height > 0
        && r.right > rt.x + 0.5 && r.x < rt.right - 0.5
        && r.bottom > rt.y + 0.5 && r.y < rt.bottom - 0.5;
    };
    // L'acteur AU TRAIT doit être dans le champ de la piste : elle défile, il peut vivre hors champ.
    const actif = tiles.querySelector('.is-cell[aria-current="step"]');
    const auTraitVisible = actif ? dansLaPiste(actif) : null;
    const round = tiles.querySelector('.is-round');
    const enBande = getComputedStyle(tiles).flexDirection === 'row';
    let roundVisible = null;
    // TÊTE DE FRISE : la piste est le conteneur défilant, son rembourrage vit DANS le champ (le clip
    // se fait au bord de rembourrage) — ce que le cartouche collé ne couvre pas du champ, en amont
    // de lui sur l axe de défilement ET sur sa propre section, montre ce qui défile. Le MOBILIER en
    // débord (score, chevron, pastille d etat) sort du rect de sa cellule : il se mesure à part, et
    // il se mesure aussi SUR le cartouche — à rang d empilement égal, c est lui qui peint.
    let teteDecouverte = null, teteSurCartouche = null, piedRogne = null, auTrait = null;
    let teteMesuree = false, piedMesure = false, pas = null;
    if (round) {
      const avantX = tiles.scrollLeft, avantY = tiles.scrollTop;
      tiles.scrollLeft = tiles.scrollWidth;
      tiles.scrollTop = tiles.scrollHeight;
      roundVisible = dansLaPiste(round);
      const cs2 = getComputedStyle(tiles);
      const rt = tiles.getBoundingClientRect();
      const champ = {
        left: rt.left + parseFloat(cs2.borderLeftWidth), right: rt.right - parseFloat(cs2.borderRightWidth),
        top: rt.top + parseFloat(cs2.borderTopWidth), bottom: rt.bottom - parseFloat(cs2.borderBottomWidth),
      };
      // Rang d empilement EFFECTIF : le premier z-index numérique porté par l élément ou un de ses
      // ancêtres positionnés, jusqu à la piste.
      const rang = (el) => {
        for (let e = el; e && e !== tiles; e = e.parentElement) {
          const s = getComputedStyle(e);
          if (s.position !== 'static' && s.zIndex !== 'auto') return parseInt(s.zIndex, 10);
        }
        return 0;
      };
      const rangRound = rang(round);
      const inter = (r, z) => {
        const ox = Math.min(r.right, z.right) - Math.max(r.left, z.left);
        const oy = Math.min(r.bottom, z.bottom) - Math.max(r.top, z.top);
        return (ox > 0.5 && oy > 0.5) ? { ox: +ox.toFixed(1), oy: +oy.toFixed(1) } : null;
      };
      // Facteur du transform PROPRE de l élément : le rect en tient compte, l encre et le liseré non
      // — ils sont peints à l échelle, et une marge non mise à l échelle sous-estime le débord.
      const facteur = (s) => (new DOMMatrixReadOnly(s.transform)).a || 1;
      // ENCRE : ce qu un élément peint HORS de sa boîte, HALO compris. Le rect seul le manquerait.
      const encre = (el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        const k = facteur(s);
        let m = 0;
        if (s.outlineStyle !== 'none') m = Math.max(m, ((parseFloat(s.outlineWidth) || 0) + (parseFloat(s.outlineOffset) || 0)) * k);
        if (s.boxShadow && s.boxShadow !== 'none') {
          const nums = (s.boxShadow.match(/-?[0-9.]+px/g) || []).map(parseFloat);
          if (nums.length >= 3) m = Math.max(m, (Math.abs(nums[0]) + nums[2]) * k, (Math.abs(nums[1]) + nums[2]) * k);
        }
        return { left: r.left - m, right: r.right + m, top: r.top - m, bottom: r.bottom + m, width: r.width + 2 * m, height: r.height + 2 * m };
      };
      // BOÎTE PEINTE : le rect plus le seul LISERÉ (à l échelle). C est la matière pleine de la
      // vignette — elle ne doit recouvrir aucun contrôle ni être rognée par un bord ; le halo, lui,
      // est un dégradé : il a le droit de passer sous le cartouche et de mourir au filet.
      const peinte = (el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        const m = s.outlineStyle === 'none' ? 0
          : ((parseFloat(s.outlineWidth) || 0) + (parseFloat(s.outlineOffset) || 0)) * facteur(s);
        return { left: r.left - m, right: r.right + m, top: r.top - m, bottom: r.bottom + m, lisere: +m.toFixed(2) };
      };
      const foot = parseFloat(cs2.paddingBottom);
      // PAS des entrées : l arrondi au pas suppose une hauteur d entrée CONSTANTE. La vignette au
      // trait comprise (sa mise en évidence est un transform, qui ne change aucune boîte de mise en
      // page). Le relevé dit le pas réel.
      const hauteurs = [...tiles.querySelectorAll('.is-cell')].map((c) => c.getBoundingClientRect().height).filter((h) => h > 0.5);
      if (hauteurs.length) pas = { min: +Math.min(...hauteurs).toFixed(1), max: +Math.max(...hauteurs).toFixed(1) };
      // TÊTE RÉELLE : du bord du champ à la première entrée, piste non défilée.
      const c0 = tiles.querySelector('.is-cell');
      tiles.scrollTop = 0; tiles.scrollLeft = 0;
      const tete = c0 ? c0.getBoundingClientRect().top - champ.top : 0;
      const axeMax = enBande ? tiles.scrollWidth - tiles.clientWidth : tiles.scrollHeight - tiles.clientHeight;
      // Un axe qui ne défile pas n a pas de tête à découvrir : la mesure le DIT au lieu d être verte
      // par vacuité. Le PIED, lui, ne se juge qu en colonne (l arrondi au pas y vit).
      teteMesuree = axeMax > 0;
      piedMesure = axeMax > 0 && !enBande;
      for (let k = 0; teteMesuree && k <= 8; k++) {
        const p = Math.round(axeMax * k / 8);
        if (enBande) tiles.scrollLeft = p; else tiles.scrollTop = p;
        const rr = round.getBoundingClientRect();
        // La TÊTE MOINS LE CARTOUCHE, en rectangles exacts : l amont sur l axe de défilement, et les
        // deux flancs de section que la boîte du cartouche ne couvre pas.
        const nus = enBande
          ? [{ left: champ.left, right: rr.left, top: champ.top, bottom: champ.bottom },
            { left: rr.left, right: rr.right, top: champ.top, bottom: rr.top },
            { left: rr.left, right: rr.right, top: rr.bottom, bottom: champ.bottom }]
          : [{ left: champ.left, right: champ.right, top: champ.top, bottom: rr.top },
            { left: champ.left, right: rr.left, top: rr.top, bottom: rr.bottom },
            { left: rr.right, right: champ.right, top: rr.top, bottom: rr.bottom }];
        for (const c of tiles.querySelectorAll('.is-cell')) {
          const pieces = [{ el: c, quoi: 'vignette' }];
          for (const m of c.querySelectorAll('.is-score, .ptile-caret, .end-mark, .is-first, .is-preempt, .ptile.active')) {
            pieces.push({ el: m, quoi: (m.className || '').split(' ')[0] });
          }
          for (const { el, quoi } of pieces) {
            const r = encre(el);
            if (r.width < 0.5 || r.height < 0.5) continue;
            for (const z of nus) {
              const o = inter(r, z);
              if (o && (!teteDecouverte || o.ox * o.oy > teteDecouverte.ox * teteDecouverte.oy)) teteDecouverte = { ...o, quoi };
            }
            const surLui = inter(r, rr);
            if (surLui && rang(el) >= rangRound
              && (!teteSurCartouche || surLui.ox * surLui.oy > teteSurCartouche.ox * teteSurCartouche.oy)) {
              teteSurCartouche = { ...surLui, quoi, rang: rang(el), rangRound };
            }
          }
          // PIED : la hauteur utile (champ moins tête moins réserve du pied) est arrondie AU PAS
          // d entrée. Le contrat tient si toute entrée qui COMMENCE dans cette zone y FINIT — sinon
          // la colonne s arrête sur un visage coupé. Se juge au REPOS (k === 0 : le cran d arrêt cale
          // la première entrée sous le cartouche).
          if (!piedMesure || k !== 0) continue;
          const r = c.getBoundingClientRect();
          const finZone = champ.bottom - foot;
          if (r.top >= finZone - 0.5) continue;
          const debord = +(r.bottom - finZone).toFixed(1);
          if (debord > 0.5 && (!piedRogne || debord > piedRogne.debord)) {
            piedRogne = { debord, zone: +(finZone - (champ.top + tete)).toFixed(1), reserve: foot };
          }
        }
      }
      tiles.scrollLeft = avantX;
      tiles.scrollTop = avantY;
      // RELIEF de la vignette AU TRAIT, à la position que l application a elle-même choisie (la mise
      // en vue a joué) : sa boîte PEINTE ne recouvre aucun contrôle — la pastille « agit en premier »
      // est un BOUTON —, aucun bord du champ ne la rogne, et son chevron se voit.
      const cellAuTrait = [...tiles.querySelectorAll('.is-cell')].find((c) => c.querySelector('.ptile.active'));
      if (cellAuTrait) {
        const tuile = cellAuTrait.querySelector('.ptile.active');
        const pb = peinte(tuile);
        const rr0 = round.getBoundingClientRect();
        let controle = null;
        for (const voisine of [cellAuTrait, cellAuTrait.previousElementSibling, cellAuTrait.nextElementSibling]) {
          if (!voisine || !voisine.classList || !voisine.classList.contains('is-cell')) continue;
          for (const ctrl of voisine.querySelectorAll('.is-first, .is-preempt')) {
            const o = inter(pb, ctrl.getBoundingClientRect());
            if (o && (!controle || o.ox * o.oy > controle.ox * controle.oy)) {
              controle = { ...o, quoi: (ctrl.className || '').split(' ')[0], sienne: voisine === cellAuTrait };
            }
          }
        }
        const rogne = {
          haut: +(champ.top - pb.top).toFixed(1), bas: +(pb.bottom - champ.bottom).toFixed(1),
          gauche: +(champ.left - pb.left).toFixed(1), droite: +(pb.right - champ.right).toFixed(1),
        };
        const car = cellAuTrait.querySelector('.ptile-caret');
        const rc = car ? car.getBoundingClientRect() : null;
        auTrait = {
          lisere: pb.lisere,
          controle,
          rogne,
          sousCartouche: inter(pb, rr0),
          caret: rc ? { h: +rc.height.toFixed(1), cache: (inter(rc, rr0) || { oy: 0 }).oy, horsChamp: +Math.max(0, champ.top - rc.top, rc.bottom - champ.bottom, champ.left - rc.left, rc.right - champ.right).toFixed(1) } : null,
        };
      }
    }
    frise = {
      bande: enBande,
      margeDroite: +(window.innerWidth - rs.right).toFixed(1),
      roundVisible,
      teteMesuree,
      pas,
      teteDecouverte,
      teteSurCartouche,
      piedMesure,
      piedRogne,
      auTrait,
      auTraitVisible,
    };
  }

  // Piste du GROUPE : une rangée enroulée mange le champ — toutes les cartes partagent UNE ordonnée.
  // (Aucun accent grave ici : ce bloc vit dans un gabarit de chaîne.)
  const track = document.querySelector('.pd-track');
  const rendues = track ? [...track.children].filter((c) => c.getBoundingClientRect().width > 0) : [];
  const poignee = document.querySelector('.party-dock .pd-handle');
  const groupe = document.querySelector('.party-dock') ? {
    cartes: rendues.length,
    lignes: new Set(rendues.map((c) => Math.round(c.getBoundingClientRect().y))).size,
    // Bande REPLIÉE : c'est la poignée qui porte alors l'affordance du groupe.
    poignee: poignee ? reaches(poignee) : null,
  } : null;

  return {
    largeur: window.innerWidth,
    combat: !!strip,
    rail: rails,
    frise,
    groupe,
    portraits: ptiles,
    objectif: objective,
    feedXfrise: overlap(rectOf('.combat-feed'), rectOf('.initiative-strip')),
    piste: tiles && strip ? {
      scrollWidth: tiles.scrollWidth, clientWidth: tiles.clientWidth, bande: strip.clientWidth,
      defile: tiles.scrollWidth > tiles.clientWidth, tientDansLaBande: tiles.clientWidth <= strip.clientWidth,
    } : null,
    dock: pont ? { rect: box(pont.getBoundingClientRect()) } : null,
    tiroir,
    dockBtns,
  };
})()`;

/**
 * Amène le combat jusqu'aux CASES du tour d'un héros (`.combat-console button.cc-cell`). Pendant la
 * pause d'initiative de début de Round, le pont ne porte que le bandeau de phase et son bouton
 * « Commencer … » (`.cc-phase [data-action='round-start']`, `src/ui/CombatConsole.tsx`), qui n'est PAS
 * dans une fenêtre : `resoudreModales` ne le voit pas, et `fastForward` ne le franchit pas. Sans ce
 * clic la sonde mesurait la phase (un bouton) au lieu du pont de tour — elle ne pouvait constater
 * aucun recouvrement des cases.
 *
 * Le tour du héros est posé en MISE EN PLACE (`__wfrp.turn`, triche de recette documentée) au lieu
 * d'être atteint en avançant les tours d'IA : la cascade de Défense gèle le combat au tour 4
 * (défaut de JEU #1852, chantier à part). C'est le HUD qu'on mesure ici, pas la boucle de tours —
 * et un blocage résiduel reste NOMMÉ (round, tour, phase, attentes posées).
 */
async function monterLeDock(session) {
  /** État d'avancement du combat — c'est lui qui NOMME un blocage, au lieu d'un « ça ne monte pas ». */
  const AVANCEMENT = `(() => {
    const st = window.__wfrp.store.getState();
    const b = st.battle;
    return {
      cellules: document.querySelectorAll('.combat-console button.cc-cell').length,
      tour: b ? b.turn : null,
      round: b ? b.round : null,
      actif: b ? ((b.combatants.find((c) => c.id === b.order[b.turn]) || {}).label || null) : null,
      phase: document.querySelector('.cc-phase') ? (document.querySelector('.cc-phase').textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 60) : null,
      modale: !!document.querySelector('.modal-overlay'),
      attentes: Object.keys(st).filter((k) => /^pending/.test(k) && st[k]),
    };
  })()`;
  let precedent = null;
  let immobile = 0;
  for (let i = 0; i < 12; i++) {
    const etat = await evaluate(session, AVANCEMENT);
    if (etat.cellules > 0) return;
    // Un tour qui ne bouge plus n'est pas une lenteur : c'est un blocage, et il se DIT avec la
    // mesure qui le prouve (qui joue, quelle fenêtre est ouverte, quelles attentes sont posées).
    immobile = etat.tour === precedent ? immobile + 1 : 0;
    precedent = etat.tour;
    if (immobile >= 3) {
      throw new Error(`le combat n'avance plus : Round ${etat.round}, tour ${etat.tour} (${etat.actif}), phase « ${etat.phase} », `
        + `fenêtre ${etat.modale ? 'ouverte' : 'ABSENTE'}, attentes posées : ${etat.attentes.join(', ') || 'aucune'}`);
    }
    if (await evaluate(session, `!!document.querySelector(".cc-phase [data-action='round-start']:not(:disabled)")`)) {
      await clickButtonByText(session, 'Commencer');
      await sleep(900);
      await resoudreModales(session, 'ouverture de Round');
      continue;
    }
    const verdict = await evaluate(session, `(() => {
      const b = window.__wfrp.store.getState().battle;
      if (!b) return 'aucun combat';
      const id = b.order.find((x) => ((b.combatants.find((c) => c.id === x) || {}).kind) === 'hero');
      return id ? window.__wfrp.turn(id) : 'aucun héros dans l ordre d initiative';
    })()`);
    console.log(`  (mise en place : premier tour tenu par un héros — ${verdict})`);
    await sleep(900);
    await resoudreModales(session, 'mise en place du tour');
  }
  throw new Error('la console (.combat-console .cc-cell) ne monte pas : le combat ne parvient pas au tour d’un héros');
}

/**
 * Défauts de la FRISE seule — extraits parce qu'ils se jugent dans DEUX états du combat : la pause
 * d'initiative (seul état où chaque entrée porte son badge de score, `InitiativeStrip.tsx`) et le
 * tour engagé. PURE, comme `defauts`.
 * @param {any} m mesure rendue par `PROBE` @param {string} phase libellé de l'état sondé
 * @returns {string[]}
 */
export function defautsFrise(m, phase) {
  const out = [];
  if (!m.frise) return out;
  // Le haut-droite est LIBRE : la bande va jusqu'au bord, comme à gauche.
  if (m.frise.bande && m.frise.margeDroite > 8) {
    out.push(`${phase} ${m.largeur}px : la frise en bande réserve ${m.frise.margeDroite}px à sa droite — aucune colonne n'y vit (plafond 8px)`);
  }
  if (m.frise.roundVisible === false) {
    out.push(`${phase} ${m.largeur}px : le cartouche de Round sort du champ quand la piste est défilée — la frise perd sa tête`);
  }
  if (m.frise.roundVisible === null) out.push(`${phase} ${m.largeur}px : aucun cartouche de Round (.is-round) — sonde aveugle sur la tête de frise`);
  // TÊTE COUVERTE : à toute position de défilement, entre le bord du champ et le cartouche on ne
  // voit que le fond du cartouche — ni vignette, ni mobilier en débord (#1867).
  if (m.frise.teteDecouverte) {
    out.push(`${phase} ${m.largeur}px : piste défilée, ${m.frise.teteDecouverte.quoi} se voit dans la tête de frise sur ${m.frise.teteDecouverte.ox}×${m.frise.teteDecouverte.oy}px — le cartouche de Round ne couvre pas la tête`);
  }
  // … et rien ne PEINT SUR lui : le mobilier de vignette suit le cartouche dans le DOM, un rang
  // d'empilement ÉGAL suffit à le lui faire recouvrir.
  if (m.frise.teteSurCartouche) {
    const s = m.frise.teteSurCartouche;
    out.push(`${phase} ${m.largeur}px : ${s.quoi} peint SUR le cartouche de Round (${s.ox}×${s.oy}px, rang ${s.rang} contre ${s.rangRound}) — la tête collée doit passer devant ce qui défile`);
  }
  // TÊTE et PIED NON MESURÉS : un axe qui ne défile pas ne peut ni révéler ni rogner quoi que ce
  // soit — le contrat y est intestable, pas violé. L'état est DIT au relevé (jamais « couverte » par
  // vacuité) ; c'est `m.piste` qui garde le cas d'une piste qui DEVRAIT défiler et ne défile pas.
  // PIED : l'arrondi au pas d'entrée promet que le reliquat tient dans la réserve du pied.
  if (m.frise.piedRogne) {
    const p = m.frise.piedRogne;
    out.push(`${phase} ${m.largeur}px : au repos, l'entrée du pied déborde de ${p.debord}px la zone utile de ${p.zone}px — la hauteur de piste n'est pas un nombre entier d'entrées`);
  }
  // PAS CONSTANT : l'arrondi de la hauteur de piste (`--is-pitch`, initiative-strip.css) suppose des
  // entrées de MÊME hauteur. Une entrée plus haute que les autres — mise en évidence de l'unité au
  // trait faite en MISE EN PAGE au lieu d'un `transform` — rend cet arrondi faux ET DÉPLAÇABLE : le
  // visage coupé n'apparaît qu'aux positions où l'entrée haute tombe dans la zone utile (#1867).
  if (m.frise.pas && m.frise.pas.max > m.frise.pas.min + 0.5) {
    out.push(`${phase} ${m.largeur}px : le pas d'entrée n'est pas constant (${m.frise.pas.min}px à ${m.frise.pas.max}px) — l'arrondi de la hauteur de piste au pas ne peut pas tomber juste`);
  }
  // RELIEF de la vignette AU TRAIT : elle est agrandie À LA PEINTURE (`transform`), donc elle ne
  // réserve rien d'elle-même — la place se réserve dans le flux (marge de la primitive) et dans les
  // rembourrages de la piste. Sans réserve, la matière pleine recouvre un CONTRÔLE ou meurt coupée
  // sur un bord du champ. Le HALO, lui, a le droit de passer sous le cartouche (#1867).
  if (m.frise.auTrait) {
    const a = m.frise.auTrait;
    if (a.controle) {
      out.push(`${phase} ${m.largeur}px : la vignette au trait recouvre ${a.controle.quoi} (${a.controle.ox}×${a.controle.oy}px, ${a.controle.sienne ? 'sa propre entrée' : 'une entrée voisine'}) — un contrôle recouvert ne reçoit pas son clic`);
    }
    for (const [cote, v] of Object.entries(a.rogne)) {
      if (v > 0.5) out.push(`${phase} ${m.largeur}px : la boîte peinte de la vignette au trait dépasse de ${v}px le bord ${cote} du champ de la piste — son liseré (${a.lisere}px) y est rogné`);
    }
    if (a.sousCartouche) {
      out.push(`${phase} ${m.largeur}px : la boîte peinte de la vignette au trait passe SOUS le cartouche de Round (${a.sousCartouche.ox}×${a.sousCartouche.oy}px) — la mise en vue la gare derrière la tête ; seul le halo a le droit d'y passer`);
    }
    if (a.caret && (a.caret.cache > 0.5 || a.caret.horsChamp > 0.5)) {
      out.push(`${phase} ${m.largeur}px : le chevron de l'unité au trait est masqué sur ${Math.max(a.caret.cache, a.caret.horsChamp)}px de ${a.caret.h}px — la tête et le pied doivent lui réserver sa place`);
    }
  }
  // COUVERTURE : `auTraitVisible` vaut `null` tant qu'aucune entrée n'est au trait (pause
  // d'initiative, combat fini) — il n'y a alors rien à ramener dans le champ, et rien à dire.
  if (m.frise.auTraitVisible === false) {
    out.push(`${phase} ${m.largeur}px : l'acteur au trait est hors du champ de la frise — rien ne l'y ramène (scrollIntoView)`);
  }
  return out;
}

/**
 * Défauts d'une mesure, en clair (liste vide = tout passe). PURE : elle ne lit que `m` — c'est ce
 * qui la rend testable à fixtures (`hud-clickables.test.mjs`, gate `test:recette`).
 * @param {any} m mesure rendue par `PROBE` @param {string} phase `'exploration'` | `'combat'`
 * @returns {string[]}
 */
export function defauts(m, phase) {
  const out = [];
  // Rail DISSOUS : son ouvreur d'écran porte son propre ancrage, ou il retombe dans le flux.
  if (m.rail?.dissous) {
    // Un rail dissous SANS ouvreur ne rendait aucun verdict : la mesure était verte par VACUITÉ.
    if (!m.rail.ouvreurs.length) out.push(`${phase} ${m.largeur}px : le rail d'outils est dissous et ne porte aucun ouvreur d'écran — sonde aveugle sur l'accès à la carte`);
    for (const b of m.rail.ouvreurs) {
      if (b.position === 'static') out.push(`${phase} ${m.largeur}px : l'ouvreur « ${b.label} » du rail dissous est en flux (position: static) — il retombe dans le stage`);
    }
  }
  for (const b of m.rail?.ouvreurs ?? []) {
    if (!b.ok) out.push(`${phase} ${m.largeur}px : l'ouvreur « ${b.label} » ${JSON.stringify(b.rect)} ne reçoit pas son clic — recouvert par ${b.hitBy}`);
  }
  // Bande de groupe : UNE ligne. Une rangée enroulée mangeait 21 % de l'écran à 1280 (grief vision).
  // Seules les cartes RENDUES comptent : repliée, la bande n'en rend aucune (ce n'est pas une ligne
  // de plus, c'est une autre forme).
  if (m.groupe && m.groupe.cartes > 0 && m.groupe.lignes > 1) {
    out.push(`${phase} ${m.largeur}px : la piste du groupe s'enroule sur ${m.groupe.lignes} lignes (${m.groupe.cartes} cartes) — elle doit tenir sur une seule`);
  }
  // Le GROUPE reste ATTEIGNABLE, déplié comme replié : une carte rendue, ou la poignée qui la
  // rouvre. Sans ce verdict, une bande repliée rendait la mesure des portraits verte par VACUITÉ.
  if (m.groupe && m.groupe.cartes === 0) {
    if (!m.groupe.poignee) out.push(`${phase} ${m.largeur}px : le groupe ne rend aucune carte ET n'offre aucune poignée — il est hors d'atteinte`);
    else if (!m.groupe.poignee.rendu) out.push(`${phase} ${m.largeur}px : la poignée du groupe replié n'est pas rendue — le groupe est hors d'atteinte`);
    else if (!m.groupe.poignee.ok) out.push(`${phase} ${m.largeur}px : la poignée du groupe replié ${JSON.stringify(m.groupe.poignee.rect)} ne reçoit pas son clic — recouverte par ${m.groupe.poignee.hitBy}`);
  }
  if (m.combat) {
    out.push(...defautsFrise(m, phase));
    // La console doit être MONTÉE et peuplée : sans elle la sonde mesure le bandeau de phase (un seul
    // bouton) et ne voit aucun des recouvrements du pont de tour.
    if (!m.dock) out.push(`${phase} ${m.largeur}px : aucune console (.combat-console) — sonde aveugle sur le pont de tour`);
    else if (!m.dockBtns.length) out.push(`${phase} ${m.largeur}px : la console ne porte aucune case — sonde aveugle`);
    for (const b of m.dockBtns) {
      if (!b.ok) out.push(`${phase} ${m.largeur}px : la case « ${b.label} » ${JSON.stringify(b.rect)} ne reçoit pas son clic — recouverte par ${b.hitBy}`);
    }
    if (m.feedXfrise) out.push(`${phase} ${m.largeur}px : le fil d'événements recouvre la frise d'initiative de ${m.feedXfrise.ox}×${m.feedXfrise.oy}px`);
    // TIROIR DU JOURNAL : c'est ici que se mesure sa réserve du bas — un panneau qui passe SOUS la
    // console de tour lui mange ses cases. Fermé, il n'y a rien à dire ; pas ouvrable, la mesure est
    // aveugle et le dit.
    if (m.tiroir) {
      if (!m.tiroir.ouvert) out.push(`${phase} ${m.largeur}px : le tiroir du journal ne s'ouvre pas (panneau non rendu) — sonde aveugle sur sa réserve du bas`);
      else if (m.tiroir.surPont) out.push(`${phase} ${m.largeur}px : le tiroir du journal ouvert recouvre la console de ${m.tiroir.surPont.ox}×${m.tiroir.surPont.oy}px`);
    }
    if (m.piste) {
      if (!m.piste.tientDansLaBande) out.push(`${phase} ${m.largeur}px : la piste d'initiative (${m.piste.clientWidth}px) déborde de sa bande (${m.piste.bande}px) — overflow-x ne mord pas`);
      // Le défilement n'est EXIGÉ que si le contenu excède la bande : en colonne latérale (largeurs
      // larges) la piste tient d'un bloc, et l'exiger partout rendrait le verdict faux.
      if (m.piste.scrollWidth > m.piste.bande && !m.piste.defile) out.push(`${phase} ${m.largeur}px : la piste d'initiative ne défile pas (scrollWidth ${m.piste.scrollWidth} ≤ clientWidth ${m.piste.clientWidth}) — des combattants sont hors d'atteinte`);
    }
  } else {
    if (!m.objectif) out.push(`${phase} ${m.largeur}px : aucun bandeau d'objectif — sonde aveugle sur la zone morte`);
    else if (m.objectif.avale) out.push(`${phase} ${m.largeur}px : ${m.objectif.marge}px de carte à droite de l'objectif avalent les clics (${m.objectif.hitBy})`);
    // Portraits RENDUS seulement : une tuile de bande repliée n'est pas recouverte, elle n'est pas
    // montée à l'écran — c'est le verdict de POIGNÉE (ci-dessus) qui garde ce cas-là.
    const rendus = m.portraits.filter((p) => p.rendu);
    if (!m.portraits.length) out.push(`${phase} ${m.largeur}px : aucun portrait de groupe — sonde aveugle`);
    for (const p of rendus) {
      if (!p.ok) out.push(`${phase} ${m.largeur}px : le portrait ${p.i} du groupe ne reçoit pas son clic — recouvert par ${p.hitBy}`);
    }
  }
  return out;
}

/** Chaque défaut est NOMMÉ là où il est mesuré : un compte « 4 défaut(s) » ne dit rien, et le bilan
 *  final ne s'imprime jamais si la mise en place meurt à la phase suivante. */
const dire = (liste) => { for (const e of liste) console.log(`   · ${e}`); };

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const session = await openApp(args.url);
  const echecs = [];
  try {
    // ── Exploration ────────────────────────────────────────────────────────────────────────────
    await evaluate(session, `window.__wfrp.scenario('embuscade', 7)`);
    await sleep(1500);
    await resoudreModales(session, 'ouverture');
    // Un objectif courant : c'est ce qu'un effet de scène pose (`combatEffects.ts`, op `objective`).
    // Le scénario de test n'en porte pas — sans lui la zone morte du bandeau n'est pas sondable.
    await evaluate(session, `window.__wfrp.store.setState({ objectives: [{ id: 'recette-hud', text: 'Retrouver la piste des mutants dans les collines' }] })`);
    await sleep(400);
    await resoudreModales(session, 'pose objectif');

    for (const w of args.widths) {
      await setViewport(session, w, HEIGHT);
      await sleep(500);
      const m = await evaluate(session, PROBE);
      if (m.combat) throw new Error(`exploration ${w}px : la frise d'initiative est montée — l'app n'est pas en exploration`);
      const d = defauts(m, 'exploration');
      const bande = !m.groupe ? 'aucune bande de groupe'
        : m.groupe.cartes === 0 ? `bande REPLIÉE sur sa poignée (${m.groupe.poignee ? 'poignée ' + (m.groupe.poignee.ok ? 'atteignable' : 'RECOUVERTE') : 'SANS poignée'})`
          : `${m.groupe.cartes} carte(s) sur ${m.groupe.lignes} ligne(s)`;
      console.log(`exploration ${w}px — ${bande}, ${m.portraits.filter((p) => p.rendu).length} portrait(s) rendu(s), marge morte objectif ${m.objectif ? m.objectif.marge + 'px' : 'n/a'} → ${d.length ? d.length + ' défaut(s)' : 'OK'}`);
      dire(d);
      echecs.push(...d);
    }

    // ── Combat ─────────────────────────────────────────────────────────────────────────────────
    await setViewport(session, VUE_REFERENCE.largeur, VUE_REFERENCE.hauteur);
    await sleep(300);
    await evaluate(session, `window.__wfrp.fight('enc-mutants')`);
    await sleep(1500);
    await resoudreModales(session, 'ouverture de combat');

    // ── Combat, PAUSE D'INITIATIVE ─────────────────────────────────────────────────────────────
    // Le combat s'ouvre sur cette pause, et c'est le SEUL état où chaque entrée porte son badge de
    // score (`InitiativeStrip.tsx`, `p.turn === -1`) : la frise s'y juge avant d'entrer dans le
    // Round, sinon son mobilier en débord n'est jamais mesuré. Seuls les verdicts de FRISE valent
    // ici — le pont de tour n'est pas monté.
    const enPause = await evaluate(session, `(() => { const b = window.__wfrp.store.getState().battle; return !!b && b.turn === -1; })()`);
    if (!enPause) throw new Error('le combat ne s’ouvre plus sur la pause d’initiative — la frise n’y est plus sondée (badges de score)');
    for (const w of args.widths) {
      await setViewport(session, w, HEIGHT);
      await sleep(600);
      const m = await evaluate(session, PROBE);
      const d = defautsFrise(m, 'combat (pause d’initiative)');
      console.log(`combat (pause) ${w}px — frise ${m.frise ? (m.frise.bande ? 'bande' : 'colonne') + ', tête ' + (!m.frise.teteMesuree ? 'non mesurée' : (m.frise.teteDecouverte || m.frise.teteSurCartouche) ? 'DÉCOUVERTE' : 'couverte') + ', pied ' + (!m.frise.piedMesure ? 'non mesuré' : m.frise.piedRogne ? 'DÉBORDE de ' + m.frise.piedRogne.debord + 'px' : 'entier') : 'ABSENTE'} → ${d.length ? d.length + ' défaut(s)' : 'OK'}`);
      dire(d);
      echecs.push(...d);
    }
    await setViewport(session, VUE_REFERENCE.largeur, VUE_REFERENCE.hauteur);
    await sleep(300);
    await monterLeDock(session);
    // Le tiroir du journal ne se juge QU'OUVERT : on le déplie par CLIC RÉEL sur sa poignée (glyphe
    // seul → par sélecteur), au PREMIER tour tenu par un héros — console complète, avant tout tour
    // d'IA. Son état React traverse les changements de largeur : un seul clic pour les six mesures.
    await cliquerSelecteur(session, '.log-drawer .ld-btn');
    await sleep(400);

    for (const w of args.widths) {
      await setViewport(session, w, HEIGHT);
      await sleep(600);
      const m = await evaluate(session, PROBE);
      if (!m.combat) throw new Error(`combat ${w}px : aucune frise d'initiative — le combat n'est pas monté`);
      const d = defauts(m, 'combat');
      console.log(`combat ${w}px — dock ${m.dock ? m.dock.rect.h + 'px de haut / ' + m.dockBtns.length + ' contrôle(s)' : 'ABSENT'}, piste ${m.piste.clientWidth}/${m.piste.scrollWidth}px dans une bande de ${m.piste.bande}px, frise ${m.frise ? (m.frise.bande ? 'bande' : 'colonne') + ' à ' + m.frise.margeDroite + 'px du bord, Round ' + (m.frise.roundVisible ? 'visible' : 'HORS CHAMP') + ', tête ' + (!m.frise.teteMesuree ? 'non mesurée' : (m.frise.teteDecouverte || m.frise.teteSurCartouche) ? 'DÉCOUVERTE' : 'couverte') + ', pied ' + (!m.frise.piedMesure ? 'non mesuré' : m.frise.piedRogne ? 'DÉBORDE de ' + m.frise.piedRogne.debord + 'px' : 'entier') : 'n/a'}, chevauchement fil×frise ${m.feedXfrise ? m.feedXfrise.ox + '×' + m.feedXfrise.oy + 'px' : 'aucun'} → ${d.length ? d.length + ' défaut(s)' : 'OK'}`);
      dire(d);
      echecs.push(...d);
    }

    // ── Combat, ACTEUR AU TRAIT EN BAS DE L'ORDRE ──────────────────────────────────────────────
    // La piste est alors DÉFILÉE à fond (`useRamenerEnVue` amène l'entrée au trait en vue) et le
    // pas d'entrée est sollicité sur toute la hauteur : c'est l'état où une entrée plus HAUTE que
    // les autres fait sortir la dernière vignette du champ. Le tour est redonné à CHAQUE largeur,
    // après le changement de viewport : sans changement de tour, la mise en vue ne rejoue pas.
    const AU_TRAIT_EN_BAS = `(() => {
      const b = window.__wfrp.store.getState().battle;
      for (let i = b.order.length - 1; i >= 0; i--) {
        const r = window.__wfrp.turn(b.order[i]);
        if (typeof r === 'string' && r.startsWith('\\u2713')) return b.order[i];
      }
      return null;
    })()`;
    for (const w of args.widths) {
      await setViewport(session, w, HEIGHT);
      await sleep(400);
      await evaluate(session, `window.__wfrp.turn(window.__wfrp.store.getState().battle.order[0])`);
      await sleep(200);
      const auTrait = await evaluate(session, AU_TRAIT_EN_BAS);
      if (!auTrait) throw new Error(`combat ${w}px : aucun combattant de l'ordre ne peut prendre le trait`);
      await sleep(600);
      const m = await evaluate(session, PROBE);
      if (!m.frise) throw new Error(`combat ${w}px (au trait en bas) : aucune frise d'initiative`);
      const d = defautsFrise(m, 'combat (au trait en bas)');
      console.log(`combat (au trait en bas) ${w}px — ${auTrait} au trait, frise ${(m.frise.bande ? 'bande' : 'colonne')}, tête ${!m.frise.teteMesuree ? 'non mesurée' : (m.frise.teteDecouverte || m.frise.teteSurCartouche) ? 'DÉCOUVERTE' : 'couverte'}, pied ${!m.frise.piedMesure ? 'non mesuré' : m.frise.piedRogne ? 'DÉBORDE de ' + m.frise.piedRogne.debord + 'px (zone ' + m.frise.piedRogne.zone + 'px)' : 'entier'}, pas ${m.frise.pas ? m.frise.pas.min + '–' + m.frise.pas.max + 'px' : 'n/a'} → ${d.length ? d.length + ' défaut(s)' : 'OK'}`);
      dire(d);
      echecs.push(...d);
    }
  } finally {
    await session.close();
  }

  if (echecs.length) {
    console.error(`\n${echecs.length} défaut(s) d'atteignabilité du HUD :`);
    for (const e of echecs) console.error(`  · ${e}`);
    process.exit(1);
  }
  console.log('\nHUD atteignable à toutes les largeurs sondées.');
}

// Le VERDICT (`defauts`) s'importe pour être testé à fixtures ; la sonde ne s'OUVRE que lancée en CLI.
if (import.meta.main) {
  main().catch((e) => {
    console.error(`ERR ${e.message}`);
    process.exit(1);
  });
}
