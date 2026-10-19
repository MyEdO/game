// CIBLES des gestes d'entrée du kit de recette (#1953) : localisation par forme explicite, marque à
// jeton, contrôle au point d'émission.

import { sleep, evaluerFn } from './cdp.mjs';

/** Marque de localisation, exclue de l’empreinte de page ; le contrôle de cible la retire. */
export const ATTR_CIBLE = 'data-recette-cible';

/** Les contrôles qu'un localisateur par TEXTE vise — SOURCE UNIQUE (`geste` sur `{ nom }` sans
 *  `selecteur`) : un `<summary>` de `<details>` est un contrôle (« + Op mécanique », `AddMenu`). */
export const SELECTEUR_CONTROLES = 'button, [role="button"], summary';

/** Les CHAMPS d'un formulaire : leur nom accessible vient de leur `<label>` (`champParLibelle`). */
export const SELECTEUR_CHAMPS = 'input, select, textarea';

/** `nomAccessible(el)` (fonction de PAGE, `norm` en portée) : le NOM d'un contrôle désigné par texte —
 *  son `aria-label` explicite, sinon texte (pour un CHAMP, le texte de son premier `<label>`, champs
 *  imbriqués retirés) ; `title` si le nom est vide. SOURCE UNIQUE des localisateurs par TEXTE
 *  (`CORPS_NOM_ACCESSIBLE` dans une expression, `pageLocaliser`). */
const FN_NOM_ACCESSIBLE = `(b) => norm(b.getAttribute('aria-label')) || norm(b.matches('${SELECTEUR_CHAMPS}') ? (() => { const l = b.labels && b.labels[0] ? b.labels[0].cloneNode(true) : null; if (l) l.querySelectorAll('${SELECTEUR_CHAMPS}').forEach((c) => c.remove()); return l ? l.textContent : ''; })() : b.textContent) || norm(b.getAttribute('title'))`;
export const CORPS_NOM_ACCESSIBLE = `const nomAccessible = ${FN_NOM_ACCESSIBLE};`;

/** `nommer(el)` (fonction de PAGE) : le NOM d'un élément, `tag#id.classe…` (classe SVG comprise), lisible
 *  même sans texte. SOURCE UNIQUE (`pageLocaliser`, `pageControler`, `frappe`, `choisirCouleur`,
 *  `hud-clickables.mjs`, `console-pont-formes.mjs`, `hauteur-reelle.mjs`). */
export const FN_NOMMER_ELEMENT = `(e) => { const c = e.className && e.className.baseVal !== undefined ? e.className.baseVal : String(e.className || ''); return e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (c.trim() ? '.' + c.trim().split(/\\s+/).join('.') : ''); }`;

/** `couche(el)` (fonction de PAGE) : la COUCHE de défilement d'un élément — son premier ancêtre
 *  défilant (lui compris), un ancêtre `position: fixed` formant sa propre couche, à défaut
 *  `document.scrollingElement`. Un cran de molette est valide si l'élément au point est de la couche
 *  de l'élément visé. SOURCE UNIQUE (`pageLocaliser`, `pageControler`). */
const FN_COUCHE = `(e) => {
  for (let a = e; a && a !== document.documentElement && a !== document.body; a = a.parentElement) {
    const s = getComputedStyle(a);
    if (s.position === 'fixed') return a;
    if (/(auto|scroll|overlay)/.test(s.overflowY + ' ' + s.overflowX) && (a.scrollHeight > a.clientHeight || a.scrollWidth > a.clientWidth)) return a;
  }
  return document.scrollingElement || document.documentElement;
}`;

let compteurJetons = 0;
/** Jeton UNIQUE d'une cible de geste (marque posée par le localiseur, vérifiée par le contrôle). */
export const nouveauJeton = () => `c${process.pid}-${++compteurJetons}`;

/** Délai par défaut d'une ATTENTE de cible (`attenteMs` : apparition, recouvrement transitoire). */
export const ATTENTE_CIBLE = 8000;

/** Forme EXPLICITE d'une cible de geste, validée avant toute lecture de page. */
export function formeDeCible(cible, qui) {
  const o = cible && typeof cible === 'object' ? cible : null;
  const ok = o && (o.surface !== undefined
    ? typeof o.surface === 'string' && Number.isFinite(o.x) && Number.isFinite(o.y)
    : o.nom !== undefined ? typeof o.nom === 'string' && o.nom !== '' : typeof o.selecteur === 'string' && o.selecteur !== '');
  if (!ok) throw new Error(`${qui} : cible ${JSON.stringify(cible)} — formes admises : { nom, selecteur?, libelle? | propre?, dans?, rangee?, exact? } · { selecteur, dans? } · { surface, x, y } — aucun événement émis`);
  return o;
}

/** Libellé d'une cible dans une levée. */
export const decrireCible = (c) => c.surface !== undefined
  ? `« ${c.surface} » au point (${Math.round(c.x)}, ${Math.round(c.y)})`
  : c.nom !== undefined
    ? `« ${c.nom} »${c.exact === false ? '' : ' (texte EXACT)'}${c.selecteur ? ` parmi « ${c.selecteur} »` : ''}${c.dans ? ` dans « ${c.dans} »` : ''}${c.rangee !== undefined ? ` dans la rangée « ${c.rangee} »` : ''}${c.etiquette?.texte !== undefined ? ` de ${c.etiquette.option} « ${c.etiquette.texte} »` : ''}`
    : `« ${c.selecteur} »${c.dans ? ` dans « ${c.dans} »` : ''}`;

/**
 * LOCALISEUR (fonction de PAGE, `evaluerFn`) : résout la cible par `querySelectorAll` et LÈVE dès
 * qu'il y a plus d'un candidat, en les nommant. Formes : `{ nom }` (nom accessible exact, ou texte
 * de `libelle` dans chaque candidat, ou, sous `propre`, ses seuls nœuds texte directs ; `rangee` retient les candidats de la rangée qui porte ce
 * texte ; `etiquette: { selecteur, texte, option }` retient les candidats dont l'élément `selecteur`
 * porte EXACTEMENT `texte`, et l'ambiguïté nomme leurs étiquettes et propose `{ option }`),
 * `{ selecteur }`, `{ surface, x, y }`. La cible retenue est MARQUÉE du `jeton`. `point` : `aucun`
 * (la marque seule, sans boîte),
 * `centre` (boîte, après `scrollIntoView` si `defiler`), `visible` (centre de la partie visible,
 * sans défiler), `defilant` (centre de la partie visible de la COUCHE de la cible, et la cible
 * est-elle visible dans cette couche). Rend `{ absente }`, `{ vide }`, `{ hors }` ou le point, avec le
 * `label` de la cible (son nom accessible, 60 caractères).
 */
function pageLocaliser(cible, jeton, attr, qui, defiler, point, controles, fnNom, fnCouche, fnNommer) {
  const norm = (s) => (s || '').replace(/\s+/g, ' ').replace(/[’']/g, "'").trim();
  const nomAccessible = new Function('norm', 'return ' + fnNom)(norm);
  const couche = new Function('return ' + fnCouche)();
  const nommer = new Function('return ' + fnNommer)();
  const decrire = (e) => { const t = norm(e.textContent).slice(0, 60); return nommer(e) + (t ? ' « ' + t + ' »' : ''); };
  const rangeeDe = new Map();
  const etiquetteDe = (e) => norm(e.querySelector(cible.etiquette.selecteur)?.textContent);
  const ambigu = (quoi, liste, conseil) => new Error(qui + ' : ' + liste.length + ' ' + quoi + ' — '
    + (rangeeDe.size ? 'rangées retenues : ' + liste.slice(0, 6).map((e) => decrire(rangeeDe.get(e))).join(' | ') : liste.slice(0, 6).map(decrire).join(' | '))
    + ' — ' + conseil + ' ; aucun événement émis');
  let hote = document;
  if (cible.dans) {
    const racines = [...document.querySelectorAll(cible.dans)];
    if (racines.length > 1) throw ambigu('racines ambiguës « ' + cible.dans + ' »', racines, 'préciser { dans }');
    if (!racines.length) return { absente: true };
    hote = racines[0];
  }
  let candidats;
  if (cible.surface !== undefined) candidats = [...hote.querySelectorAll(cible.surface)];
  else if (cible.nom === undefined) candidats = [...hote.querySelectorAll(cible.selecteur)];
  else {
    const voulu = norm(cible.nom);
    const nomDe = (e) => cible.libelle ? norm(e.querySelector(cible.libelle)?.textContent) : cible.propre ? norm([...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('')) : nomAccessible(e);
    const libelles = [...hote.querySelectorAll(cible.selecteur || controles)].filter((e) => cible.exact === false ? nomDe(e).includes(voulu) : nomDe(e) === voulu);
    candidats = libelles;
    if (cible.rangee !== undefined && cible.rangee !== null) {
      const rangee = norm(cible.rangee);
      const porte = (e) => norm(e.textContent).includes(rangee);
      const retenus = new Set();
      for (const p of [...hote.querySelectorAll('*')].filter((e) => porte(e) && ![...e.children].some(porte))) {
        let a = p;
        while (a && !libelles.some((b) => a.contains(b))) a = a === hote ? null : a.parentElement;
        if (a) for (const b of libelles) if (a.contains(b)) { retenus.add(b); rangeeDe.set(b, a); }
      }
      candidats = libelles.filter((b) => retenus.has(b));
    }
    if (cible.etiquette && cible.etiquette.texte !== undefined) candidats = candidats.filter((e) => etiquetteDe(e) === norm(cible.etiquette.texte));
  }
  const quoi = cible.surface !== undefined ? '« ' + cible.surface + ' »' : cible.nom !== undefined ? '« ' + norm(cible.nom) + ' »' : '« ' + cible.selecteur + ' »';
  if (candidats.length > 1) {
    throw ambigu('cibles ambiguës ' + quoi, candidats, cible.surface !== undefined ? 'préciser { surface }'
      : cible.etiquette ? 'préciser { ' + cible.etiquette.option + ' } — offerts : ' + candidats.map(etiquetteDe).join(' | ')
        : cible.nom !== undefined ? 'préciser { dans }, { rangee } ou { selecteur }' : 'préciser { selecteur } ou { dans }');
  }
  const el = candidats[0];
  if (!el) return { absente: true };
  for (const v of document.querySelectorAll('[' + attr + '="' + jeton + '"]')) v.removeAttribute(attr);
  el.setAttribute(attr, jeton);
  if (point === 'aucun') return {};
  const label = nomAccessible(el).slice(0, 60);
  if (cible.surface !== undefined) return { x: cible.x, y: cible.y, label };
  if (point === 'centre' && defiler) el.scrollIntoView({ block: 'center', inline: 'center' });
  const boite = (e) => { const q = e.getBoundingClientRect(); return { x: q.x, y: q.y, w: q.width, h: q.height }; };
  const r = boite(el);
  if (r.w === 0 || r.h === 0) { el.removeAttribute(attr); return { vide: true }; }
  if (point === 'centre') return { x: Math.round(r.x + r.w / 2), y: Math.round(r.y + r.h / 2), label };
  const c = couche(el);
  const zone = point === 'visible' ? r : c === document.scrollingElement || c === document.documentElement ? null : boite(c);
  const g = Math.max(zone ? zone.x : 0, 0), d = Math.min(zone ? zone.x + zone.w : innerWidth, innerWidth);
  const h = Math.max(zone ? zone.y : 0, 0), b = Math.min(zone ? zone.y + zone.h : innerHeight, innerHeight);
  if (!(d > g && b > h)) { el.removeAttribute(attr); return { hors: true }; }
  const centre = { x: Math.round((g + d) / 2), y: Math.round((h + b) / 2) };
  if (point === 'visible') return { ...centre, label, zone: { g, d, h, b } };
  const cy = r.y + r.h / 2;
  const visible = r.h <= b - h ? r.y >= h && r.y + r.h <= b : cy >= h && cy <= b;
  return { ...centre, label, visible, ecart: cy - (h + b) / 2, centre: { x: r.x + r.w / 2, y: cy } };
}

/**
 * CONTRÔLE au point d'émission (fonction de PAGE, `evaluerFn`) : la cible marquée `jeton` est
 * présente ; `disabled` natif refuse toujours, `aria-disabled` refuse sous l'intention `agir` ; le
 * point est dans la fenêtre ; l'élément au point est la cible ou un de ses descendants (`mode`
 * `cible`), ou appartient à la même COUCHE qu'elle (`mode` `couche`, cran de molette : premier
 * ancêtre défilant, ou ancêtre `position: fixed`, à défaut `document.scrollingElement`). Rend
 * `{ ferme, fenetre }` si oui (`fenetre` : `{ l, h }`, la taille de la fenêtre) ; la marque est retirée, sauf sur un recouvrement (relu jusqu'à l'échéance).
 */
function pageControler(jeton, attr, x, y, mode, intention, fnCouche, fnNommer) {
  const c = document.querySelector('[' + attr + '="' + jeton + '"]');
  if (!c) return { absente: true };
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const nommer = new Function('return ' + fnNommer)();
  const couche = new Function('return ' + fnCouche)();
  const fin = (v) => { c.removeAttribute(attr); return v; };
  const mecanisme = c.disabled ? 'disabled' : c.getAttribute('aria-disabled') === 'true' ? 'aria-disabled' : null;
  let ferme = null;
  if (mecanisme) {
    const lien = c.getAttribute('aria-describedby');
    const porteur = (lien && document.getElementById(lien)) || c.querySelector('[data-gate]');
    ferme = { mecanisme, raison: (porteur && norm(porteur.textContent)) || null };
    if (mecanisme === 'disabled' || intention === 'agir') return fin({ ferme, refuse: true });
  }
  if (!(x >= 0 && y >= 0 && x < innerWidth && y < innerHeight)) return fin({ ferme, horsFenetre: true });
  const el = document.elementFromPoint(x, y);
  if (el && (mode === 'couche' ? couche(el) === couche(c) : el === c || c.contains(el))) return fin({ ferme, fenetre: { l: innerWidth, h: innerHeight } });
  if (!el) return { ferme, recouvre: '(rien)', boite: null, couches: null };
  const r = el.getBoundingClientRect();
  const texte = norm(el.textContent).slice(0, 40);
  return {
    ferme,
    recouvre: nommer(el) + (texte ? ' « ' + texte + ' »' : ''),
    boite: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    couches: mode === 'couche' ? { visee: nommer(couche(c)), atteinte: nommer(couche(el)) } : null,
  };
}

/** MARQUE la cible (`pageLocaliser`, point `aucun`) sans geste, pour une lecture ou un appel CDP :
 *  rend le `jeton` posé, `null` si elle est absente ; LÈVE sur plus d'un candidat. `attr` : une marque
 *  DISTINCTE de celle des gestes, qui survit à leurs localisations (à retirer par `retirerJeton`). */
export async function marquer(session, cible, qui, attr = ATTR_CIBLE) {
  const jeton = nouveauJeton();
  const loc = await evaluerFn(session, pageLocaliser, formeDeCible(cible, qui), jeton, attr, qui, false, 'aucun', SELECTEUR_CONTROLES, FN_NOM_ACCESSIBLE, FN_COUCHE, FN_NOMMER_ELEMENT);
  return loc.absente ? null : jeton;
}

/** Sélecteur de l'élément marqué `jeton`. */
export const marqueDe = (jeton, attr = ATTR_CIBLE) => `[${attr}="${jeton}"]`;

/** Retire la marque `jeton` d'une cible dont le geste n'aura pas lieu. */
export const retirerJeton = (session, jeton, attr = ATTR_CIBLE) => evaluerFn(session, (jeton, attr) => { for (const v of document.querySelectorAll('[' + attr + '="' + jeton + '"]')) v.removeAttribute(attr); }, jeton, attr);

/** LOCALISE la cible (`pageLocaliser`), en attendant son APPARITION jusqu'à `attenteMs` ; LÈVE au nom
 *  du geste `qui` si elle reste absente, ou si elle n'a ni boîte ni partie visible. */
export async function localiser(session, cible, { jeton, qui, defiler = true, point = 'centre', attenteMs = ATTENTE_CIBLE }) {
  const fin = Date.now() + attenteMs;
  let loc;
  for (;;) {
    loc = await evaluerFn(session, pageLocaliser, cible, jeton, ATTR_CIBLE, qui, defiler, point, SELECTEUR_CONTROLES, FN_NOM_ACCESSIBLE, FN_COUCHE, FN_NOMMER_ELEMENT);
    if (!loc.absente || Date.now() >= fin) break;
    await sleep(Math.min(50, Math.max(0, fin - Date.now())));
  }
  if (loc.absente) throw new Error(`${qui} : aucune cible ${decrireCible(cible)} après ${attenteMs} ms — aucun événement émis`);
  if (loc.vide) throw new Error(`${qui} ${decrireCible(cible)} : boîte de taille nulle (non rendu — dans un <details> replié ? \`deplierVers\`) — aucun événement émis`);
  if (loc.hors) throw new Error(`${qui} ${decrireCible(cible)} : HORS FENÊTRE — la cible ne montre rien dans la fenêtre — aucun événement émis`);
  return loc;
}

/** CONTRÔLE de la cible marquée au point (`pageControler`) : un RECOUVREMENT est relu jusqu'à
 *  `attenteMs` (la scène de dés `div.rm-scene` couvre la fenêtre le temps du roulis) ; à l'échéance,
 *  la levée nomme le DERNIER recouvreur. Rend `{ ferme }` (`null`, ou ce que `lire` a touché). */
export async function controler(session, x, y, { jeton, libelle, qui, intention, attenteMs, mode }) {
  const lire = () => evaluerFn(session, pageControler, jeton, ATTR_CIBLE, x, y, mode, intention, FN_COUCHE, FN_NOMMER_ELEMENT);
  const echeance = Date.now() + attenteMs;
  let v = await lire();
  while (v.recouvre && Date.now() < echeance) {
    await sleep(100);
    v = await lire();
  }
  if (v.recouvre) await retirerJeton(session, jeton);
  const ici = `${qui} ${libelle}`;
  const point = `(${Math.round(x)}, ${Math.round(y)})`;
  if (v.absente) throw new Error(`${ici} : la cible a quitté le DOM avant le geste — aucun événement émis`);
  if (v.refuse) {
    throw new Error(`${ici} : contrôle FERMÉ (${v.ferme.mecanisme})${v.ferme.raison ? ` — raison affichée : « ${v.ferme.raison} »` : ' — aucune raison affichée'} — aucun événement émis`);
  }
  if (v.horsFenetre) throw new Error(`${ici} : HORS FENÊTRE — le point ${point} sort de la fenêtre — aucun événement émis`);
  if (v.recouvre) {
    const b = v.boite;
    const boite = b ? ` (boîte ${b.x},${b.y} ${b.w}×${b.h})` : '';
    if (v.couches) throw new Error(`${ici} : AUTRE COUCHE — au point ${point}, ${v.recouvre}${boite} est de la couche ${v.couches.atteinte}, la cible de la couche ${v.couches.visee}, toujours après ${attenteMs} ms — aucun cran émis`);
    throw new Error(`${ici} : au point ${point}, ${v.recouvre}${boite} RECOUVRE la cible, toujours après ${attenteMs} ms — aucun événement émis`);
  }
  return { ferme: v.ferme ?? null, fenetre: v.fenetre };
}
