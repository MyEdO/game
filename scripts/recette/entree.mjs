// GESTES D'ENTRÉE du kit de recette : un émetteur, une cible (#1953). L'émetteur BRUT du CDP
// (`emetteursBruts`) est privé à ce module : `brancherCdp` le pose, `geste` (souris, toucher) et
// `frappe` (clavier) le lisent ; `session.rpc` refuse le domaine `Input`.

import { sleep, TARGET_NAVIGATED, cdpError, joindre, porteErreur, leverApresNettoyage, courseContreMontre, evaluerFn } from './cdp.mjs';
import { ATTR_CIBLE, FN_NOMMER_ELEMENT, ATTENTE_CIBLE, formeDeCible, decrireCible, nouveauJeton, localiser, controler, marquer, marqueDe } from './cible.mjs';

/** Émetteur BRUT du CDP par session, posé par `brancherCdp` : lu par `geste` et `frappe` seulement.
 *  `(qui, delaiMs)` le rend BORNÉ : une émission sans accusé de réception en `delaiMs` LÈVE au nom de `qui`. */
const emetteursBruts = new WeakMap();

/** Plafond par défaut d'une émission `Input.*` (`geste`, `frappe` et les helpers qui les appellent : option
 *  `delaiEntreeMs`). */
export const DELAI_ENTREE = 10000;

/** Domaine CDP des événements d'ENTRÉE : `session.rpc` le refuse, `geste` et `frappe` l'émettent. */
export const DOMAINE_ENTREE = /^Input\./;

/** Méthode CDP qui RELAIE un message à une cible : le verrou lit la méthode relayée. */
const RELAIS_CIBLE = 'Target.sendMessageToTarget';

/** La méthode d'un message relayé (`RELAIS_CIBLE`), `null` s'il est illisible. */
function methodeRelayee(message) {
  try {
    const m = JSON.parse(message);
    return typeof m?.method === 'string' ? m.method : null;
  } catch {
    return null;
  }
}

/** Les INTENTIONS d'un geste : `agir` LÈVE sur un contrôle fermé (`aria-disabled`) ; `lire` le
 *  touche quand même et rend sa fermeture — le refus est ce qu'on vient lire (`GatedAction`). Un
 *  `disabled` natif lève dans les deux. */
export const INTENTIONS = Object.freeze(['agir', 'lire']);

/**
 * BRANCHE une connexion CDP de niveau NAVIGATEUR (`ws`) : appels en vol, écouteurs, rejet TYPÉ des
 * appels en vol quand la socket se coupe. Rend la `session` : `rpc` porte le `sessionId` de la cible
 * attachée, `rpcNavigateur` jamais (niveau navigateur : `Target.*`). Forme UNIQUE, partagée par
 * `launchSession` (le navigateur qu'on lance) et `attacherSession` (celui qu'un gardien tient).
 */
export function brancherCdp(ws, champs = {}) {
  let id = 0;
  const pending = new Map();
  const listeners = new Set();
  const session = { chrome: null, listeners, sessionId: null, targetId: null, profile: null, contextCleared: false, ...champs };
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
    if (m.method === 'Runtime.executionContextsCleared' && (!m.sessionId || m.sessionId === session.sessionId)) {
      session.contextCleared = true;
    }
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) reject(cdpError(m.error.message)); else resolve(m.result);
    }
    for (const fn of listeners) fn(m);
  });
  // Socket coupée alors que des appels sont en vol : les rejeter TYPÉS plutôt que de les laisser
  // pendre pour toujours (un `await session.rpc(...)` jamais réglé fige le script sans message).
  const cibleFermee = () => {
    const e = new Error('Inspected target navigated or closed');
    e.code = TARGET_NAVIGATED;
    return e;
  };
  ws.addEventListener('close', () => {
    for (const [mid, { reject }] of pending) {
      pending.delete(mid);
      reject(cibleFermee());
    }
  });
  // Socket qui n'est plus OUVERTE : `send` y est muet (aucune réponse ne viendra), l'appel est REJETÉ
  // tout de suite, typé comme une socket coupée.
  const envoyer = (method, params, sessionId) => new Promise((resolve, reject) => {
    if (ws.readyState !== WebSocket.OPEN) { reject(cibleFermee()); return; }
    const mid = ++id;
    const msg = { id: mid, method, params };
    if (sessionId) msg.sessionId = sessionId;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify(msg));
  });
  // Le domaine `Input` n'est émis que par `geste` et `frappe` : l'émetteur BRUT leur est remis par
  // `emetteursBruts`, `rpc` et `rpcNavigateur` le refusent, relayé par `Target.sendMessageToTarget`
  // compris. La socket reste dans cette fermeture : la session ne l'expose pas.
  const verrouille = (envoi) => (method, params = {}) => {
    const visee = method === RELAIS_CIBLE ? methodeRelayee(params.message) : method;
    if (visee === null) return Promise.reject(new Error(`rpc « ${method} » : message relayé illisible (JSON portant \`method\` attendu) — aucun événement émis`));
    return DOMAINE_ENTREE.test(visee)
      ? Promise.reject(new Error(`rpc « ${method === RELAIS_CIBLE ? `${method} » relayant « ${visee}` : method} » : le domaine Input n'est émis que par \`geste\` (souris, toucher) ou \`frappe\` (clavier) — aucun événement émis`))
      : envoi(method, params);
  };
  const brut = (method, params = {}) => envoyer(method, params, session.sessionId);
  session.rpc = verrouille(brut);
  session.rpcNavigateur = verrouille((method, params) => envoyer(method, params, null));
  emetteursBruts.set(session, (qui, delaiMs) => (method, params) =>
    courseContreMontre(brut(method, params), delaiMs, `${qui} : ${method} : accusé de réception absent après ${delaiMs} ms (la page peut avoir reçu l'événement)`));
  return session;
}

/** Méthodes CDP que `geste` émet, par domaine. */
const EMISSIONS = Object.freeze({ souris: 'Input.dispatchMouseEvent', tactile: 'Input.dispatchTouchEvent' });

/**
 * GESTE RÉEL — le SEUL émetteur d'événements souris et tactiles du kit : RÉSOUT `cible` (une forme
 * explicite, `pageLocaliser`), la CONTRÔLE au point d'émission (`pageControler`), puis appelle
 * `evenements(localisation, emettre)`, où `emettre('souris' | 'tactile', params)` émet l'événement
 * CDP AU POINT CONTRÔLÉ : un autre point LÈVE, sauf le glissé (`mouseMoved`, `mouseReleased` entre
 * un `mousePressed` et son relâchement), BORNÉ à la fenêtre, dont le relâchement bouton gauche hors du
 * point est un DÉPÔT recontrôlé (`pageControler`, mode `couche`) ; un relâchement refusé relâche AU
 * POINT CONTRÔLÉ, puis lève. `emettre` est RÉVOQUÉ au retour d'`evenements`, et `geste` ne rend qu'après
 * les émissions EN VOL : un refus en vol LÈVE, joint (`joindre`) à l'échec d'`evenements` s'il y en a un ; une
 * émission sans accusé de réception en `delaiEntreeMs` (`DELAI_ENTREE`) LÈVE. Options : `intention` (`agir` défaut, ou `lire`), `qui` (le nom du geste dans les levées),
 * `defiler`, `attenteMs`, `point` (`centre`, `visible`, `defilant`), `controle` (`cible`, ou
 * `couche` pour un cran de molette). Rend la localisation, avec `ferme` (`null`, ou
 * `{ mecanisme, raison }` sous `lire`).
 */
export async function geste(session, cible, { intention = 'agir', qui = 'geste', defiler = true, attenteMs = ATTENTE_CIBLE, point = 'centre', controle = 'cible', delaiEntreeMs = DELAI_ENTREE } = {}, evenements) {
  if (!INTENTIONS.includes(intention)) throw new Error(`${qui} : intention « ${intention} » — admises : ${INTENTIONS.join(', ')}`);
  if (typeof evenements !== 'function') throw new Error(`${qui} : les événements à émettre manquent — aucun événement émis`);
  const brut = emetteursBruts.get(session)?.(qui, delaiEntreeMs);
  if (!brut) throw new Error(`${qui} : session sans émetteur d'entrée (non branchée par \`brancherCdp\`) — aucun événement émis`);
  const forme = formeDeCible(cible, qui);
  const jeton = nouveauJeton();
  const loc = await localiser(session, forme, { jeton, qui, defiler, point, attenteMs });
  const { ferme, fenetre } = await controler(session, loc.x, loc.y, { jeton, libelle: decrireCible(forme), qui, intention, attenteMs, mode: controle });
  let tenu = false;
  const emettreBorne = async (domaine, params) => {
    if (!EMISSIONS[domaine]) throw new Error(`${qui} : domaine d'émission « ${domaine} » — admis : ${Object.keys(EMISSIONS).join(', ')}`);
    const glisse = domaine === 'souris' && tenu && (params.type === 'mouseMoved' || params.type === 'mouseReleased');
    const ecart = (domaine === 'souris' ? [params] : params.touchPoints ?? []).find((p) => p.x !== loc.x || p.y !== loc.y);
    if (ecart && !glisse) {
      throw new Error(`${qui} : « ${params.type} » au point (${ecart.x}, ${ecart.y}), le point contrôlé est (${loc.x}, ${loc.y}) — seul un glissé bouton tenu quitte le point contrôlé — aucun événement émis`);
    }
    if (ecart) {
      try {
        if (!(ecart.x >= 0 && ecart.y >= 0 && ecart.x < fenetre.l && ecart.y < fenetre.h)) {
          throw new Error(`${qui} : glissé « ${params.type} » au point (${ecart.x}, ${ecart.y}) HORS FENÊTRE (${fenetre.l}×${fenetre.h}) — aucun événement émis`);
        }
        if (params.type === 'mouseReleased' && params.button === 'left') {
          const depot = await marquer(session, forme, qui);
          if (!depot) throw new Error(`${qui} ${decrireCible(forme)} : la cible a quitté le DOM avant le DÉPÔT — aucun événement émis`);
          await controler(session, ecart.x, ecart.y, { jeton: depot, libelle: `${decrireCible(forme)} (dépôt)`, qui, intention, attenteMs, mode: 'couche' });
        }
      } catch (e) {
        if (params.type !== 'mouseReleased') throw e;
        tenu = false;
        const refus = new Error(`${e.message} ; bouton relâché au point contrôlé (${loc.x}, ${loc.y})`, { cause: e });
        if (e.code) refus.code = e.code;
        await leverApresNettoyage(refus, () => brut(EMISSIONS.souris, { ...params, x: loc.x, y: loc.y }));
      }
    }
    if (domaine === 'souris' && params.type === 'mousePressed') tenu = true;
    if (domaine === 'souris' && params.type === 'mouseReleased') tenu = false;
    return brut(EMISSIONS[domaine], params);
  };
  await emettreSous((emettre) => evenements(loc, emettre), emettreBorne, `${qui} : « emettre » RÉVOQUÉ — le geste est rendu — aucun événement émis`);
  return { ...loc, ferme };
}

/** ÉVÉNEMENTS d'un CLIC réel pour `geste` : la triade `mouseMoved`/`mousePressed`/`mouseReleased`.
 *  `bouton` (`left`, `right`, `middle`) ; `dureeMs` : le temps TENU (appui long) ; `trajet` : points
 *  relatifs au départ sous bouton tenu ; le relâchement est garanti, appui sans accusé compris, et conserve l'erreur primaire
 *  s'il échoue aussi. `modifiers` : les touches TENUES (`MOD_ALT`). */
export function clic({ modifiers = 0, bouton = 'left', dureeMs = 0, trajet = [] } = {}) {
  return async ({ x, y }, emettre) => {
    await emettre('souris', { type: 'mouseMoved', x, y, modifiers });
    let fin = { x, y };
    const relacher = () => emettre('souris', { type: 'mouseReleased', ...fin, button: bouton, clickCount: 1, modifiers });
    try {
      await emettre('souris', { type: 'mousePressed', x, y, button: bouton, clickCount: 1, modifiers });
      for (const p of trajet) {
        fin = { x: x + p.x, y: y + p.y };
        await emettre('souris', { type: 'mouseMoved', ...fin, button: bouton, buttons: bouton === 'middle' ? 4 : bouton === 'right' ? 2 : 1, modifiers });
      }
      if (dureeMs > 0) await sleep(dureeMs);
    } catch (e) {
      await leverApresNettoyage(e, relacher);
    }
    await relacher();
  };
}

/** Méthodes CDP que `frappe` émet, par domaine. */
const EMISSIONS_CLAVIER = Object.freeze({ touche: 'Input.dispatchKeyEvent', texte: 'Input.insertText' });

/**
 * Joue `jouer(emettre)`, où `emettre(domaine, params)` délègue à `emettreBorne` — SOCLE de `geste` et
 * `frappe`. `emettre` est RÉVOQUÉ au retour de `jouer` (rejet `revoque`), puis attend TOUTES ses
 * émissions : rien ne part après le retour. Un refus d'émission LÈVE, joint (`joindre`) à l'échec de
 * `jouer` s'il y en a un et qu'il ne le porte pas déjà (`porteErreur`).
 */
async function emettreSous(jouer, emettreBorne, revoque) {
  let ouvert = true;
  const emissions = [];
  let echec = null;
  try {
    await jouer((domaine, params) => {
      if (!ouvert) return Promise.reject(new Error(revoque));
      const emission = emettreBorne(domaine, params);
      emission.catch(() => {});
      emissions.push(emission);
      return emission;
    });
  } catch (e) {
    echec = { e };
  }
  ouvert = false;
  const refus = (await Promise.allSettled(emissions))
    .find((r) => r.status === 'rejected' && !(echec && porteErreur(echec.e, r.reason)))?.reason;
  if (echec) throw refus ? joindre(echec.e, refus) : echec.e;
  if (refus) throw refus;
}

/**
 * FRAPPE RÉELLE — le SEUL émetteur CLAVIER du kit, second émetteur à côté de `geste` : la cible d'une
 * frappe est l'élément FOCALISÉ. `focus` (un sélecteur, résolu par le localiseur) : il doit désigner
 * UN élément, et cet élément doit avoir le focus, sinon LÈVE — aucune frappe émise. Sans `focus`, la
 * frappe est une touche GLOBALE, sans cible contrôlée. Puis appelle `evenements(emettre)`, où
 * `emettre('touche' | 'texte', params)` émet `Input.dispatchKeyEvent` ou `Input.insertText`, RÉVOQUÉ au
 * retour d'`evenements` ; `frappe` ne rend qu'après ses émissions EN VOL, et un refus en vol LÈVE
 * (`emettreSous`, comme `geste`).
 */
export async function frappe(session, { focus, qui = 'frappe', delaiEntreeMs = DELAI_ENTREE } = {}, evenements) {
  const brut = emetteursBruts.get(session)?.(qui, delaiEntreeMs);
  if (!brut) throw new Error(`${qui} : session sans émetteur d'entrée (non branchée par \`brancherCdp\`) — aucune frappe émise`);
  if (focus !== undefined) {
    const jeton = await marquer(session, { selecteur: focus }, qui);
    const manque = jeton ? await evaluerFn(session, (marque, attr, fnNommer) => {
      const el = document.querySelector(marque);
      el.removeAttribute(attr);
      const a = document.activeElement;
      return a === el ? null : 'focus sur ' + (a ? new Function('return ' + fnNommer)()(a) : '(aucun)');
    }, marqueDe(jeton), ATTR_CIBLE, FN_NOMMER_ELEMENT) : 'aucun élément désigné';
    if (manque) throw new Error(`${qui} « ${focus} » : la cible n'a pas le focus (${manque}) — aucune frappe émise`);
  }
  await emettreSous(evenements, async (domaine, params) => {
    if (!EMISSIONS_CLAVIER[domaine]) throw new Error(`${qui} : domaine d'émission « ${domaine} » — admis : ${Object.keys(EMISSIONS_CLAVIER).join(', ')}`);
    return brut(EMISSIONS_CLAVIER[domaine], params);
  }, `${qui} : « emettre » RÉVOQUÉ — la frappe est rendue — aucune frappe émise`);
}
