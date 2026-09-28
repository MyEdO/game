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
//   · l'ouvreur d'écran du rail d'outils reçoit son clic. Il n'est monté qu'avec un navire en jeu
//     (`CampaignView.tsx`) : la mise en place du combat en pose un (`vessel`, patron de
//     `__wfrp.scenario`) ;
//   · en exploration, la boîte pleine ligne de `.objective-banner` n'avale aucun clic hors de sa
//     tête : le point sondé à droite de `.objective-head` rend la scène ;
//   · aux DEUX phases, chaque portrait du groupe (`.party-dock .ptile`) reçoit son clic — la pile de
//     contexte (haut-gauche) ne mord pas sur le haut-centre, qui appartient au GROUPE ; à ≤560 la
//     bande REPLIÉE se déplie par clic réel sur sa poignée et le groupe déplié se juge (en combat,
//     devant le fil d'événements), puis elle se replie ;
//   · la MATRICE RESPONSIVE du design 2026-07-31 §12, sur les cellules qu'un DOM porte
//     (`defautsMatrice`) : Groupe — toutes les cartes rendues, vie et nom à toute tranche
//     (docs/plans/2026-08-16-spec-hud-combat.md:192-194), vie superposée au portrait à
//     561–700, défilement horizontal de secours, R-M1 à ≤560 (:66-68 — tuile ≥ 44px de large, rognée
//     seulement par une piste qui défile) ; Initiative — colonne à gauche au-dessus de 900 et cartouche
//     de Round rendu DANS sa boîte, colonne jusqu'à 701 et entrée au trait entière dans le champ, bande
//     à 700 et moins et piste défilable, cartouche de Round en PREMIÈRE entrée, bande sous le groupe à
//     561–700, courant + deux suivants entiers à ≤560 ; Dock — pont de bord à bord, chaque case entière
//     dans l'écran, hauteur du pont ≤ 21 % dès 1280 et ≤ 45 % à ≤560
//     (docs/plans/2026-08-16-spec-hud-combat.md Zone 1) ; COMPACITÉ sur la série des largeurs
//     (`defautsCompacite`) — cartes et colonne d'initiative plus étroites à 701–900 qu'au-delà de 900,
//     portraits à 561–700 ; CIBLES TACTILES sous `pointer: coarse` émulé (`defautsTactile`) — chaque
//     commande vissée rendue offre 44px à ≤560 ;
//   · la COUCHE HUD (#1919, design « Le pont se dimensionne seul », `defautsCouche`), à 3 hauteurs
//     (`vues-recette.json`) × 7 largeurs × 4 états — exploration, ouverture, tour de héros,
//     spectateur (atteint par le VRAI geste : « Fin du tour » cliqué deux fois) : le pont est posé au
//     bas de l'écran, la page ne défile pas, aucune surface d'une zone n'est rognée par la couche, et
//     chaque commande du HUD et du pont reçoit son clic — exemptée seulement hors du champ de son
//     ancêtre défilant, ou sous la TÊTE COLLÉE de cet ancêtre.
//
// Cellules §12 NON MESURÉES :
//   · Caméra / inspection >900, 701–900, 561–700 : `ViewControls`, monté en jeu nulle part (#1822 ;
//     `grep -rn ViewControls src` : `src/ui/editor/EditorCanvas.tsx`, `src/ui/gallery/registry.tsx`) ;
//   · Dock 701–900 « dock sur deux rangées au besoin » : conditionnel ;
//   · Dock 561–700 « actions sur deux colonnes » : grille `.cc-dock` réécrite sous #1856 ;
//   · Dock <=560 « modales plein écran… » : aucune modale de jet ouverte ici — structure gardée par
//     `src/ui/ui-ratchets.test.ts` ;
//   · Dock >900 « disposition de référence » : aucun contrat propre hors bord à bord et hauteur.
//
// Sortie : exit 1 au premier défaut (liste complète imprimée), exit 0 si tout passe.
import { openApp, evaluate, setViewport, sleep, clickButtonByText, cliquerSelecteur, cliquerAction, resoudreModales, attendreSelecteur, freezeTimeout, unfreezeTimeout, VUE_REFERENCE, VUES_RECETTE } from './lib.mjs';

// Les trois largeurs étroites (700/560/360) portent les recouvrements ; les deux larges portent la
// zone morte du bandeau d'objectif, dont la boîte n'excède sa tête qu'au-delà de 900px — sonder
// 700/560/360 seuls rendait cette vérification AVEUGLE (marge morte mesurée à 0px).
// La plus large est la vue de RÉFÉRENCE (`vues-recette.json`), jamais un couple recopié (#1847).
const DEFAULT_WIDTHS = [VUE_REFERENCE.largeur, 1100, 900, 700, 560, 360];
const HEIGHT = VUE_REFERENCE.hauteur;
/** Grille de la COUCHE : 7 largeurs (les vues de référence et les seuils canon 900 / 700 / 560, de
 *  part et d'autre) × les hauteurs de `vues-recette.json`. */
export const LARGEURS_COUCHE = [1707, 1366, 1100, 900, 700, 560, 360];
export const HAUTEURS_COUCHE = [...new Set(Object.values(VUES_RECETTE).map((v) => v.hauteur))];

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
  const dansLEcran = (r) => r.x >= -0.5 && r.y >= -0.5 && r.right <= window.innerWidth + 0.5 && r.bottom <= window.innerHeight + 0.5;
  const dockBtns = [...document.querySelectorAll('.combat-console button.cc-cell')].map((b, i) => ({
    i, label: (b.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 40) || (b.getAttribute('title') || '').trim(), ...reaches(b),
    entier: dansLEcran(b.getBoundingClientRect()),
  }));

  // TIROIR DU JOURNAL : sa réserve du bas ne se juge qu'au panneau DÉPLIÉ (fermé, il ne recouvre
  // rien). C'est le seul état où la question « passe-t-il sous la console ? » a un sens.
  const panneau = document.querySelector('.ld-panel');
  // Ce que le panneau PEINT : dans la couche HUD, sa boîte rognée par la couche (overflow: clip) —
  // un recouvrement calculé sans le rognage accusait un panneau qu'on ne voit pas (juge G3 #1919).
  const coucheDuPanneau = panneau ? panneau.closest('.stage-flot') : null;
  const rp = panneau ? (() => {
    const r = panneau.getBoundingClientRect();
    if (!coucheDuPanneau) return r;
    const c = coucheDuPanneau.getBoundingClientRect();
    const x = Math.max(r.left, c.left), y = Math.max(r.top, c.top);
    return new DOMRect(x, y, Math.max(0, Math.min(r.right, c.right) - x), Math.max(0, Math.min(r.bottom, c.bottom) - y));
  })() : null;
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

  // Rail d'outils : son ouvreur d'écran reçoit son clic.
  const rail = document.querySelector('.hud-rail');
  const rails = rail ? {
    ouvreurs: [...document.querySelectorAll('.hud-rail > .worldmap-btn')].map((b, i) => ({
      i, label: (b.getAttribute('title') || '').trim(), ...reaches(b),
    })),
  } : null;

  // COUCHE HUD (#1919) : la grille de .stage-flot, ses zones, le pont sous elle.
  const flotEl = document.querySelector('.stage-flot');
  const pontEl = document.querySelector('.stage > .combat-console, .stage > .exploration-dock');
  const rendu = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0.5 && r.height > 0.5 && s.visibility !== 'hidden'; };
  // EXEMPTION d'une commande qui ne reçoit pas son clic : elle n'est pas ENTIÈRE dans le champ de son
  // ancêtre défilant (on la ramène en défilant), ou elle est sous la TÊTE COLLÉE (sticky) de cet
  // ancêtre. Rien d'autre.
  const exemption = (b) => {
    const r = b.getBoundingClientRect();
    const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    for (let e = b.parentElement; e && e !== document.body; e = e.parentElement) {
      const s = getComputedStyle(e);
      const defile = /(auto|scroll)/.test(s.overflowX + ' ' + s.overflowY) && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1);
      if (!defile) continue;
      const c = e.getBoundingClientRect();
      const champ = { left: c.left + e.clientLeft, top: c.top + e.clientTop, right: c.left + e.clientLeft + e.clientWidth, bottom: c.top + e.clientTop + e.clientHeight };
      if (r.left < champ.left - 0.5 || r.right > champ.right + 0.5 || r.top < champ.top - 0.5 || r.bottom > champ.bottom + 0.5) return 'hors du champ de son défilant';
      const dessus = document.elementFromPoint(cx, cy);
      for (let t = dessus; t && t !== e; t = t.parentElement) {
        if (getComputedStyle(t).position === 'sticky' && e.contains(t)) return 'sous la tête collée de son défilant';
      }
      return null;
    }
    return null;
  };
  const couche = flotEl ? (() => {
    const rf = flotEl.getBoundingClientRect();
    const rpt = pontEl ? pontEl.getBoundingClientRect() : null;
    const surfaces = [];
    for (const z of flotEl.querySelectorAll(':scope > [data-zone]')) {
      for (const el of z.children) {
        if (!rendu(el)) continue;
        const r = el.getBoundingClientRect();
        const rogne = Math.max(rf.top - r.top, r.bottom - rf.bottom, rf.left - r.left, r.right - rf.right);
        surfaces.push({ zone: z.dataset.zone, surface: String(el.className || el.tagName).split(' ')[0], rect: box(r), rogne: +Math.max(0, rogne).toFixed(1) });
      }
    }
    const commandes = [...flotEl.querySelectorAll('button'), ...(pontEl ? pontEl.querySelectorAll('button') : [])]
      .filter(rendu)
      .map((b) => {
        const t = reaches(b);
        return { label: ((b.getAttribute('title') || b.getAttribute('aria-label') || b.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 40)),
          ok: t.ok, hitBy: t.hitBy, rect: t.rect, exempte: t.ok ? null : exemption(b) };
      });
    const de = document.documentElement;
    return {
      flot: box(rf),
      pont: box(rpt),
      pontAuBas: rpt ? Math.abs(rpt.bottom - window.innerHeight) <= 0.5 : null,
      pageDefile: de.scrollHeight > window.innerHeight + 0.5 || de.scrollWidth > window.innerWidth + 0.5,
      surfaces,
      commandes,
    };
  })() : null;

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
    // COURANT + DEUX SUIVANTS (§12 <=560) : chacun ENTIER dans le champ de la piste et hors du
    // cartouche collé, à la position de défilement que l application a choisie.
    const cellules = [...tiles.querySelectorAll('.is-cell')];
    const iCourant = actif ? cellules.indexOf(actif) : -1;
    const rt0 = tiles.getBoundingClientRect();
    const rr0 = round ? round.getBoundingClientRect() : null;
    const entiere = (c) => {
      const r = c.getBoundingClientRect();
      const dedans = r.width > 0 && r.x >= rt0.x - 0.5 && r.right <= rt0.right + 0.5 && r.y >= rt0.y - 0.5 && r.bottom <= rt0.bottom + 0.5;
      const sousTete = rr0 && Math.min(r.right, rr0.right) - Math.max(r.x, rr0.x) > 0.5 && Math.min(r.bottom, rr0.bottom) - Math.max(r.y, rr0.y) > 0.5;
      return dedans && !sousTete;
    };
    let suivants = null;
    if (iCourant >= 0) {
      const vus = cellules.slice(iCourant, iCourant + 3);
      suivants = { attendus: vus.length, entiers: vus.filter(entiere).length };
    }
    // COURANT ENTIER (§12 701-900) : l entrée au trait, à la position de défilement choisie par
    // l application. ROUND INTÉGRÉ (§12 >900) : le cartouche rendu DANS la boîte de la frise.
    const courantEntier = actif ? entiere(actif) : null;
    const roundDansColonne = rr0 ? (rr0.width > 0 && rr0.x >= rs.x - 0.5 && rr0.right <= rs.right + 0.5 && rr0.y >= rs.y - 0.5 && rr0.bottom <= rs.bottom + 0.5) : null;
    // DÉFILABLE (§12 561-700 et <=560) : la piste est un conteneur de défilement horizontal.
    const defilable = ['auto', 'scroll'].includes(getComputedStyle(tiles).overflowX);
    const roundPremier = !!round && tiles.firstElementChild === round;
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
      rect: box(rs),
      roundPremier,
      roundDansColonne,
      courantEntier,
      defilable,
      suivants,
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
  const dockGroupe = document.querySelector('.party-dock');
  // CARTES (§12, colonne Groupe) : nom rendu, vie rendue, vie SUPERPOSÉE au portrait, largeur, et
  // ROGNURE horizontale par le champ de la piste (R-M1).
  const champPiste = track ? (() => {
    const r = track.getBoundingClientRect(), s = getComputedStyle(track);
    return { left: r.left + parseFloat(s.borderLeftWidth), right: r.right - parseFloat(s.borderRightWidth) };
  })() : null;
  const cartesDetail = rendues.map((f) => {
    const rf = f.getBoundingClientRect();
    const nomEl = f.querySelector('figcaption');
    const rn = nomEl ? nomEl.getBoundingClientRect() : null;
    const vieEl = f.querySelector('.life-bar');
    const rv = vieEl ? vieEl.getBoundingClientRect() : null;
    const face = f.querySelector('.ptile-face');
    return {
      w: +rf.width.toFixed(1),
      rognee: !!champPiste && (rf.left < champPiste.left - 0.5 || rf.right > champPiste.right + 0.5),
      nom: !!(rn && rn.width > 0 && rn.height > 0 && (nomEl.textContent || '').trim()),
      vie: !!(rv && rv.width > 0 && rv.height > 0),
      vieSurPortrait: !!(rv && face && overlap(rv, face.getBoundingClientRect())),
    };
  });
  const groupe = dockGroupe ? {
    total: track ? track.querySelectorAll(':scope > figure').length : 0,
    detail: cartesDetail,
    defilementSecours: track && rendues.length ? ['auto', 'scroll'].includes(getComputedStyle(track).overflowX) : null,
    defile: !!track && ['auto', 'scroll'].includes(getComputedStyle(track).overflowX) && track.scrollWidth > track.clientWidth,
    bas: +dockGroupe.getBoundingClientRect().bottom.toFixed(1),
    replie: !dockGroupe.classList.contains('on') && !!poignee && poignee.getBoundingClientRect().width > 0,
    cartes: rendues.length,
    lignes: new Set(rendues.map((c) => Math.round(c.getBoundingClientRect().y))).size,
    // Bande REPLIÉE : c'est la poignée qui porte alors l'affordance du groupe.
    poignee: poignee ? reaches(poignee) : null,
    // … et la vie de chacun, en micro-jauges ENTIÈRES dans leur rangée (qui rogne son débord).
    micro: (() => {
      // Mesurée dès que la POIGNÉE est rendue : une rangée écrasée à 0 de large cache TOUTES ses
      // barres, ce n'est pas une rangée absente.
      const rang = document.querySelector('.party-dock .pd-micro');
      if (!rang || !poignee || poignee.getBoundingClientRect().width === 0) return null;
      const rr = rang.getBoundingClientRect();
      const barres = [...rang.children];
      return { attendues: barres.length, visibles: barres.filter((i) => { const r = i.getBoundingClientRect(); return r.width > 0 && r.left >= rr.left - 0.5 && r.right <= rr.right + 0.5; }).length };
    })(),
  } : null;

  // CIBLES TACTILES (§12 <=560, Caméra / inspection) : sous pointeur grossier seulement, chaque
  // commande vissée RENDUE du HUD.
  const grossier = matchMedia('(pointer: coarse)').matches;
  const cibles = grossier ? [...document.querySelectorAll('.skin-tole[data-ton]')]
    .filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
    .map((b) => { const r = b.getBoundingClientRect(); return { label: (b.getAttribute('aria-label') || b.getAttribute('title') || b.className.split(' ')[0]).trim().slice(0, 40), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; }) : null;

  return {
    largeur: window.innerWidth,
    hauteur: window.innerHeight,
    grossier,
    cibles,
    combat: !!strip,
    rail: rails,
    couche,
    frise,
    groupe,
    portraits: ptiles,
    objectif: objective,
    feedXfrise: overlap(rectOf('.combat-feed'), rectOf('.initiative-strip')),
    // Le volet DÉPLIÉ ≤560 couvre-t-il le fil d'événements ? Sans recouvrement, le verdict de clic des
    // portraits n'éprouve pas leur rang : la sortie le DIT.
    feedXvolet: overlap(rectOf('.combat-feed'), rectOf('.party-dock.on .pd-track')),
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
  for (const b of m.rail?.ouvreurs ?? []) {
    if (!b.ok) out.push(`${phase} ${m.largeur}px : l'ouvreur « ${b.label} » ${JSON.stringify(b.rect)} ne reçoit pas son clic — recouvert par ${b.hitBy}`);
  }
  out.push(...defautsGroupe(m, phase));
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
  }
  return out;
}

/**
 * Défauts de la COUCHE HUD (#1919, design « Le pont se dimensionne seul ; le HUD vit dans ce qui
 * reste, et n'en sort pas ») sur UNE mesure. PURE.
 * @param {any} m mesure rendue par `PROBE` @param {string} phase libellé de l'état sondé
 * @returns {string[]}
 */
export function defautsCouche(m, phase) {
  const ou = `${phase} ${m.largeur}×${m.hauteur}`;
  const c = m.couche;
  if (!c) return [`${ou} : aucune couche HUD (.stage-flot) — sonde aveugle`];
  const out = [];
  if (!c.pont) out.push(`${ou} : aucun pont sous la couche — sonde aveugle sur sa pose`);
  else if (!c.pontAuBas) out.push(`${ou} : le pont ${JSON.stringify(c.pont)} n'est pas posé au bas de l'écran`);
  if (c.pageDefile) out.push(`${ou} : la page défile — le plateau déborde de l'écran`);
  for (const s of c.surfaces) {
    if (s.rogne > 0.5) out.push(`${ou} : la surface « ${s.surface} » de la zone « ${s.zone} » ${JSON.stringify(s.rect)} est rognée par la couche de ${s.rogne}px`);
  }
  if (!c.commandes.length) out.push(`${ou} : aucune commande rendue dans la couche ni sur le pont — sonde aveugle`);
  for (const b of c.commandes) {
    if (!b.ok && !b.exempte) out.push(`${ou} : la commande « ${b.label} » ${JSON.stringify(b.rect)} ne reçoit pas son clic — ${b.hitBy}`);
  }
  return out;
}

/**
 * Défauts d'ATTEIGNABILITÉ du GROUPE (bande dépliée ou repliée) — extraits parce qu'ils se jugent
 * aussi sur la bande DÉPLIÉE ≤560, dont la mesure ne doit pas re-juger le reste du HUD. PURE.
 * @param {any} m mesure rendue par `PROBE` @param {string} phase
 * @returns {string[]}
 */
export function defautsGroupe(m, phase) {
  const out = [];
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
    // Repliée, la vie du groupe se lit en micro-jauges : une par héros, chacune entière (juge G2
    // #1919, pt.5 : l'arrondi au pas de tuile rognait la poignée et les cachait toutes).
    const mj = m.groupe.micro;
    if (mj && mj.visibles < mj.attendues) out.push(`${phase} ${m.largeur}px : la poignée du groupe replié ne montre que ${mj.visibles} micro-jauge(s) sur ${mj.attendues}`);
  }
  // Portraits du groupe, aux DEUX phases (en combat, la bande dépliée ≤560 doit passer devant le fil
  // d'événements). RENDUS seulement : une tuile de bande repliée n'est pas recouverte, elle n'est pas
  // montée à l'écran — c'est le verdict de POIGNÉE (ci-dessus) qui garde ce cas-là.
  if (!m.portraits.length) out.push(`${phase} ${m.largeur}px : aucun portrait de groupe — sonde aveugle`);
  for (const p of m.portraits.filter((x) => x.rendu)) {
    if (!p.ok) out.push(`${phase} ${m.largeur}px : le portrait ${p.i} du groupe ne reçoit pas son clic — recouvert par ${p.hitBy}`);
  }
  return out;
}

/** Tranche de la matrice §12 (docs/superpowers/specs/2026-07-31-hud-combat-exploration-design.md). */
export function trancheMatrice(largeur) {
  return largeur > 900 ? '>900' : largeur > 700 ? '701–900' : largeur > 560 ? '561–700' : '<=560';
}

/** Plafonds de HAUTEUR du pont, en part du viewport : ≥1280 → docs/plans/2026-08-16-spec-hud-combat.md
 *  Zone 1 (« Hauteur du pont ≤ ~21 % du viewport à ≥1280 ») ; ≤560 → même Zone 1 (« cible ~40-45 % »). */
export const BUDGET_PONT = { large: { des: 1280, part: 0.21 }, compact: { part: 0.45 } };

/** Largeur minimale d'une tuile du groupe à <=560 : docs/plans/2026-08-16-spec-hud-combat.md:66-68
 *  (R-M1, « tuiles PLEINES à largeur minimale digne (portrait reconnaissable + PV lisibles, ≥44px) »). */
export const TUILE_MIN_PX = 44;

/**
 * Colonne GROUPE de la matrice §12 : cartes toutes rendues, vie et nom à toute tranche, vie
 * superposée au portrait à 561–700, défilement horizontal de secours ; à <=560, R-M1. PURE.
 * @param {any} m mesure rendue par `PROBE` @param {string} phase
 * @returns {string[]}
 */
export function defautsMatriceGroupe(m, phase) {
  const out = [];
  const t = trancheMatrice(m.largeur);
  const ou = `${phase} ${m.largeur}px (§12 ${t})`;
  const g = m.groupe;
  if (g && g.cartes > 0) {
    if (g.cartes < g.total) out.push(`${ou} : ${g.total - g.cartes} carte(s) du groupe sur ${g.total} ne sont pas rendues`);
    if (g.defilementSecours === false) out.push(`${ou} : la piste du groupe n'a aucun défilement horizontal de secours`);
    // NOM à toute tranche : docs/plans/2026-08-16-spec-hud-combat.md:192-194 (« NOM VISIBLE SOUS LA TUILE »).
    for (const [i, c] of g.detail.entries()) {
      if (!c.vie) out.push(`${ou} : la carte ${i} du groupe ne rend pas sa vie`);
      if (!c.nom) out.push(`${ou} : la carte ${i} du groupe ne rend pas son nom`);
      if (t === '561–700' && !c.vieSurPortrait) out.push(`${ou} : la vie de la carte ${i} du groupe n'est pas superposée à son portrait`);
      // R-M1 : docs/plans/2026-08-16-spec-hud-combat.md:66-68.
      if (t === '<=560' && c.w < TUILE_MIN_PX) out.push(`${ou} : la tuile ${i} du groupe fait ${c.w}px de large — sous ${TUILE_MIN_PX}px (R-M1)`);
      if (t === '<=560' && c.rognee && !g.defile) out.push(`${ou} : la tuile ${i} du groupe est rognée par le champ de la piste, qui ne défile pas (R-M1)`);
    }
  }
  return out;
}

/**
 * Défauts de la MATRICE RESPONSIVE (§12) — cellules mesurées, voir l'en-tête — sur UNE mesure. PURE.
 * Chaque verdict ne juge que la mesure qu'il trouve : `defauts` dit déjà une console absente ou une
 * frise absente (« sonde aveugle »).
 * @param {any} m mesure rendue par `PROBE` @param {string} phase libellé de l'état sondé
 * @returns {string[]}
 */
export function defautsMatrice(m, phase) {
  const out = [];
  const t = trancheMatrice(m.largeur);
  const ou = `${phase} ${m.largeur}px (§12 ${t})`;
  const g = m.groupe;
  out.push(...defautsMatriceGroupe(m, phase));
  // ── Initiative ──
  const f = m.frise;
  if (f) {
    const enColonne = t === '>900' || t === '701–900';
    if (enColonne && f.bande) out.push(`${ou} : la frise d'initiative est en bande — la tranche la veut en colonne`);
    if (!enColonne && !f.bande) out.push(`${ou} : la frise d'initiative est en colonne — la tranche la veut en bande horizontale`);
    if (t === '>900' && f.rect.x + f.rect.w / 2 > m.largeur / 2) out.push(`${ou} : la colonne d'initiative n'est pas à gauche (centre à ${+(f.rect.x + f.rect.w / 2).toFixed(1)}px)`);
    if (!f.roundPremier) out.push(`${ou} : le cartouche de Round n'est pas la première entrée de la frise`);
    if (t === '>900' && f.roundDansColonne === false) out.push(`${ou} : le cartouche de Round n'est pas intégré à la colonne d'initiative (rendu hors de sa boîte)`);
    if (t === '701–900' && f.courantEntier === false) out.push(`${ou} : l'entrée au trait n'est pas entière dans le champ de la frise`);
    if (t === '701–900' && f.courantEntier == null) out.push(`${ou} : aucune entrée au trait — sonde aveugle sur le courant entier`);
    if (!enColonne && f.defilable === false) out.push(`${ou} : la piste d'initiative n'est pas défilable (overflow-x ni auto ni scroll)`);
    if (t === '561–700' && g && f.rect.y < g.bas - 0.5) out.push(`${ou} : la bande d'initiative (haut ${f.rect.y}px) n'est pas sous le groupe (bas ${g.bas}px)`);
    if (t === '<=560' && f.suivants && f.suivants.entiers < f.suivants.attendus) {
      out.push(`${ou} : ${f.suivants.entiers} entrée(s) sur ${f.suivants.attendus} (courant + deux suivants) entières dans le champ de la frise`);
    }
  }
  // ── Dock ──
  if (m.dock) {
    const r = m.dock.rect;
    if (r.x > 0.5 || r.x + r.w < m.largeur - 0.5) out.push(`${ou} : le pont ne va pas de bord à bord (${r.x}..${+(r.x + r.w).toFixed(1)}px sur ${m.largeur}px)`);
    const part = r.h / m.hauteur;
    if (m.largeur >= BUDGET_PONT.large.des && part > BUDGET_PONT.large.part) out.push(`${ou} : le pont prend ${(100 * part).toFixed(1)} % de la hauteur (plafond ${100 * BUDGET_PONT.large.part} % dès ${BUDGET_PONT.large.des}px)`);
    if (t === '<=560' && part > BUDGET_PONT.compact.part) out.push(`${ou} : le pont compact prend ${(100 * part).toFixed(1)} % de la hauteur (plafond ${100 * BUDGET_PONT.compact.part} %)`);
    for (const b of m.dockBtns) {
      if (b.rendu && !b.entier) out.push(`${ou} : la case « ${b.label} » ${JSON.stringify(b.rect)} n'est pas entière dans l'écran`);
    }
  }
  return out;
}

/**
 * Défauts de CIBLE TACTILE (§12 <=560, colonne Caméra / inspection) : sous `pointer: coarse`, chaque
 * commande vissée rendue offre 44px sur ses deux côtés. PURE.
 * @param {any} m mesure rendue par `PROBE` sous émulation tactile @param {string} phase
 * @returns {string[]}
 */
export function defautsTactile(m, phase) {
  const ou = `${phase} ${m.largeur}px (§12 ${trancheMatrice(m.largeur)}, pointer: coarse)`;
  if (!m.grossier) return [`${ou} : le pointeur grossier n'est pas émulé — sonde aveugle sur les cibles tactiles`];
  if (!m.cibles.length) return [`${ou} : aucune commande vissée rendue — sonde aveugle sur les cibles tactiles`];
  return m.cibles.filter((c) => c.w < 44 || c.h < 44).map((c) => `${ou} : la commande « ${c.label} » offre ${c.w}×${c.h}px — cible tactile sous 44px`);
}

/**
 * Défauts de COMPACITÉ, jugés sur la SÉRIE des mesures d'un même état (une par largeur) : à 701–900
 * les cartes du groupe et la colonne d'initiative, à 561–700 les portraits, sont plus étroits qu'à la
 * tranche >900 de référence. PURE. Sans mesure >900 dans la série, rien à comparer.
 * @param {any[]} serie mesures rendues par `PROBE` @param {string} phase
 * @returns {string[]}
 */
export function defautsCompacite(serie, phase) {
  const out = [];
  const carte = (m) => (m.groupe?.detail?.length ? Math.max(...m.groupe.detail.map((c) => c.w)) : null);
  const ref = serie.find((m) => trancheMatrice(m.largeur) === '>900');
  if (!ref) return out;
  const refCarte = carte(ref);
  const refColonne = ref.frise && !ref.frise.bande ? ref.frise.rect.w : null;
  for (const m of serie) {
    const t = trancheMatrice(m.largeur);
    if (t !== '701–900' && t !== '561–700') continue;
    const c = carte(m);
    if (refCarte != null && c != null && c >= refCarte) out.push(`${phase} ${m.largeur}px (§12 ${t}) : la carte du groupe fait ${c}px, pas plus compacte que ${refCarte}px à ${ref.largeur}px`);
    if (t === '701–900' && refColonne != null && m.frise && !m.frise.bande && m.frise.rect.w >= refColonne) {
      out.push(`${phase} ${m.largeur}px (§12 ${t}) : la colonne d'initiative fait ${m.frise.rect.w}px, pas plus réduite que ${refColonne}px à ${ref.largeur}px`);
    }
  }
  return out;
}

/**
 * Bande REPLIÉE (≤560) : elle se DÉPLIE par clic réel sur sa poignée, le groupe déplié se juge
 * (§12 <=560 : portraits sur une ligne, défilement de secours, chacun reçoit son clic — en combat,
 * devant le fil d'événements), puis elle se REPLIE : aucune trace pour la largeur suivante.
 * @returns {Promise<string[]>}
 */
async function jugerGroupeDeplie(session, m, phase) {
  if (!m.groupe?.replie) return [];
  const p = `${phase} (groupe déplié)`;
  await cliquerSelecteur(session, '.party-dock .pd-handle');
  await sleep(400);
  const d = await evaluate(session, PROBE);
  const out = d.groupe?.cartes
    ? [...defautsGroupe(d, p), ...defautsMatriceGroupe(d, p)]
    : [`${p} ${d.largeur}px : la poignée ne déplie aucune carte — sonde aveugle sur le groupe déplié`];
  console.log(`${p} ${d.largeur}px — ${d.groupe?.cartes ?? 0} carte(s) sur ${d.groupe?.lignes ?? 0} ligne(s), ${d.portraits.filter((x) => x.rendu && x.ok).length} portrait(s) cliquable(s)${d.combat ? ', volet × fil ' + (d.feedXvolet ? d.feedXvolet.ox + '×' + d.feedXvolet.oy + 'px (rang éprouvé)' : 'aucun recouvrement (rang NON éprouvé)') : ''} → ${out.length ? out.length + ' défaut(s)' : 'OK'}`);
  dire(out);
  await cliquerSelecteur(session, '.party-dock .pd-handle');
  await sleep(300);
  return out;
}

/**
 * La COUCHE HUD à chaque vue de sa grille (`HAUTEURS_COUCHE` × `LARGEURS_COUCHE`), dans l'état où
 * se trouve le jeu. Une ligne par vue, chaque défaut nommé.
 * @returns {Promise<string[]>}
 */
async function jugerCouche(session, phase) {
  const out = [];
  for (const h of HAUTEURS_COUCHE) {
    for (const w of LARGEURS_COUCHE) {
      await setViewport(session, w, h);
      await sleep(450);
      const m = await evaluate(session, PROBE);
      const d = defautsCouche(m, `couche (${phase})`);
      const c = m.couche;
      console.log(`couche (${phase}) ${w}×${h} — pont ${c?.pont ? c.pont.h + 'px' + (c.pontAuBas ? ' au bas' : ' DÉCOLLÉ') : 'absent'}, ${c ? c.surfaces.length : 0} surface(s), ${c ? c.commandes.filter((b) => b.ok).length + '/' + c.commandes.length : 0} commande(s) atteinte(s)${c ? ', ' + c.commandes.filter((b) => b.exempte).length + ' exemptée(s)' : ''} → ${d.length ? d.length + ' défaut(s)' : 'OK'}`);
      dire(d);
      out.push(...d);
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
  const serieExploration = [];
  const serieCombat = [];
  try {
    // ── Exploration ────────────────────────────────────────────────────────────────────────────
    await evaluate(session, `window.__wfrp.scenario('embuscade', 7)`);
    // L'écran de campagne se monte de façon DIFFÉRÉE (mesuré : ~1,3 s serveur chaud, ~2,9 s à froid),
    // et sa fenêtre d'introduction de scène avec lui : un délai fixe laissait `resoudreModales` passer
    // AVANT elle, et toute l'exploration se mesurait sans groupe, puis sous cette fenêtre.
    await attendreSelecteur(session, '.stage .party-dock', { timeoutMs: 20000 });
    await sleep(400);
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
      const d = [...defauts(m, 'exploration'), ...defautsMatrice(m, 'exploration')];
      serieExploration.push(m);
      const bande = !m.groupe ? 'aucune bande de groupe'
        : m.groupe.cartes === 0 ? `bande REPLIÉE sur sa poignée (${m.groupe.poignee ? 'poignée ' + (m.groupe.poignee.ok ? 'atteignable' : 'RECOUVERTE') : 'SANS poignée'})`
          : `${m.groupe.cartes} carte(s) sur ${m.groupe.lignes} ligne(s)`;
      console.log(`exploration ${w}px — ${bande}, ${m.portraits.filter((p) => p.rendu).length} portrait(s) rendu(s), marge morte objectif ${m.objectif ? m.objectif.marge + 'px' : 'n/a'} → ${d.length ? d.length + ' défaut(s)' : 'OK'}`);
      dire(d);
      echecs.push(...d);
      echecs.push(...await jugerGroupeDeplie(session, m, 'exploration'));
    }
    const compaciteExploration = defautsCompacite(serieExploration, 'exploration');
    dire(compaciteExploration);
    echecs.push(...compaciteExploration);
    echecs.push(...await jugerCouche(session, 'exploration'));

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
    echecs.push(...await jugerCouche(session, 'ouverture'));
    await setViewport(session, VUE_REFERENCE.largeur, VUE_REFERENCE.hauteur);
    await sleep(300);
    await monterLeDock(session);
    echecs.push(...await jugerCouche(session, 'tour de héros'));
    await setViewport(session, VUE_REFERENCE.largeur, VUE_REFERENCE.hauteur);
    await sleep(300);
    // Le tiroir du journal ne se juge QU'OUVERT : on le déplie par CLIC RÉEL sur sa poignée (glyphe
    // seul → par sélecteur), au PREMIER tour tenu par un héros — console complète, avant tout tour
    // d'IA. Son état React traverse les changements de largeur : un seul clic pour les six mesures.
    await cliquerSelecteur(session, '.log-drawer .ld-btn');
    await sleep(400);
    // Un NAVIRE de campagne : l'ouvreur d'écran du rail n'est monté qu'avec lui
    // (`src/ui/CampaignView.tsx`, `vessel &&`). Même couture que `__wfrp.scenario`
    // (`src/state/devtools.ts`, `sc.vessel`), valeur du scénario 14 (`14-voyage-maritime.ts`).
    const navire = await evaluate(session, `(() => {
      window.__wfrp.store.setState({ vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } } });
      return !!window.__wfrp.store.getState().vessel;
    })()`);
    if (!navire) throw new Error('mise en place : le navire de campagne ne se pose pas — sonde aveugle sur l’ouvreur du rail');
    await sleep(300);

    for (const w of args.widths) {
      await setViewport(session, w, HEIGHT);
      await sleep(600);
      const m = await evaluate(session, PROBE);
      if (!m.combat) throw new Error(`combat ${w}px : aucune frise d'initiative — le combat n'est pas monté`);
      const d = [...defauts(m, 'combat'), ...defautsMatrice(m, 'combat')];
      serieCombat.push(m);
      console.log(`combat ${w}px — dock ${m.dock ? m.dock.rect.h + 'px de haut / ' + m.dockBtns.length + ' contrôle(s)' : 'ABSENT'}, piste ${m.piste.clientWidth}/${m.piste.scrollWidth}px dans une bande de ${m.piste.bande}px, frise ${m.frise ? (m.frise.bande ? 'bande' : 'colonne') + ' à ' + m.frise.margeDroite + 'px du bord, Round ' + (m.frise.roundVisible ? 'visible' : 'HORS CHAMP') + ', tête ' + (!m.frise.teteMesuree ? 'non mesurée' : (m.frise.teteDecouverte || m.frise.teteSurCartouche) ? 'DÉCOUVERTE' : 'couverte') + ', pied ' + (!m.frise.piedMesure ? 'non mesuré' : m.frise.piedRogne ? 'DÉBORDE de ' + m.frise.piedRogne.debord + 'px' : 'entier') : 'n/a'}, chevauchement fil×frise ${m.feedXfrise ? m.feedXfrise.ox + '×' + m.feedXfrise.oy + 'px' : 'aucun'} → ${d.length ? d.length + ' défaut(s)' : 'OK'}`);
      dire(d);
      echecs.push(...d);
      echecs.push(...await jugerGroupeDeplie(session, m, 'combat'));
    }
    const compaciteCombat = defautsCompacite(serieCombat, 'combat');
    dire(compaciteCombat);
    echecs.push(...compaciteCombat);

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

    // ── Combat, POINTEUR GROSSIER (§12 <=560, Caméra / inspection) ─────────────────────────────
    // L'émulation tactile de CDP (`Emulation.setTouchEmulationEnabled`) fait répondre
    // `(pointer: coarse)` : la tranche tactile se MESURE, elle ne se lit pas au texte du CSS.
    const etroites = args.widths.filter((w) => trancheMatrice(w) === '<=560');
    if (etroites.length) {
      await session.rpc('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
      try {
        for (const w of etroites) {
          await setViewport(session, w, HEIGHT);
          await sleep(500);
          const m = await evaluate(session, PROBE);
          const d = defautsTactile(m, 'combat');
          console.log(`combat (pointeur grossier) ${w}px — ${m.cibles ? m.cibles.map((c) => c.label + ' ' + c.w + '×' + c.h).join(', ') : 'pointeur fin'} → ${d.length ? d.length + ' défaut(s)' : 'OK'}`);
          dire(d);
          echecs.push(...d);
        }
      } finally {
        await session.rpc('Emulation.setTouchEmulationEnabled', { enabled: false });
      }
    }

    // Le tiroir du journal se REFERME (clic réel) : un panneau ouvert par le joueur n'est pas un état
    // de la couche.
    await cliquerSelecteur(session, '.log-drawer.open .ld-btn');
    await sleep(300);

    // ── Combat, TOUR SPECTATEUR, atteint par le VRAI geste (juge G4 #1919, pt.5) ─────────────────
    // Mise en place : le trait au héros qui PRÉCÈDE un adversaire dans l'ordre (`__wfrp.turn`). Puis
    // le joueur finit son tour : « Fin du tour » cliqué deux fois (armer, confirmer — garde-fou de
    // l'Action non dépensée). Les minuteries de l'IA sont figées le temps de la mesure : le tour
    // adverse ne s'achève pas sous la sonde.
    await setViewport(session, VUE_REFERENCE.largeur, VUE_REFERENCE.hauteur);
    await sleep(300);
    const avantAdversaire = await evaluate(session, `(() => {
      const b = window.__wfrp.store.getState().battle;
      const kind = (id) => (b.combatants.find((c) => c.id === id) || {}).kind;
      for (let i = 0; i < b.order.length; i++) {
        const suivant = b.order[(i + 1) % b.order.length];
        if (kind(b.order[i]) === 'hero' && kind(suivant) !== 'hero') {
          const r = window.__wfrp.turn(b.order[i]);
          if (typeof r === 'string' && r.startsWith('\u2713')) return b.order[i];
        }
      }
      return null;
    })()`);
    if (!avantAdversaire) throw new Error('aucun héros ne précède un adversaire dans l’ordre — tour spectateur inatteignable');
    await sleep(800);
    await resoudreModales(session, 'tour avant adversaire');
    await cliquerAction(session, 'end-turn');
    await sleep(250);
    await freezeTimeout(session, [3600000]);
    try {
      if (!await evaluate(session, `!document.querySelector(".combat-console[data-forme='spectatrice']")`)) {
        throw new Error('le premier clic sur « Fin du tour » a déjà passé la main — le garde-fou n’a rien armé');
      }
      await cliquerAction(session, 'end-turn');
      await sleep(600);
      const spectateur = await evaluate(session, `!!document.querySelector(".combat-console[data-forme='spectatrice']")`);
      if (!spectateur) throw new Error('après « Fin du tour » confirmé, le pont n’est pas en forme spectatrice — tour adverse non atteint');
      echecs.push(...await jugerCouche(session, 'spectateur'));
    } finally {
      await unfreezeTimeout(session);
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
