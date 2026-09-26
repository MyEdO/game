// Socle de preuve navigateur headless (agents) — moissonné de scripts scratchpad ad hoc répétés
// (des-v5-verify.mjs, gallery-v2-tour.mjs, repro-399.mjs, dice-reduced-motion.mjs) : CDP nu sur
// Chrome, zéro dépendance nouvelle. Voir docs/recette-navigateur.md § « Preuve headless (agents) ».
import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { ENTETE_RACINE, RACINE, normaliserRacine, racineDepuisEntete, urlDev } from '../port-dev.mjs';

/** URL de l'app servie par CET arbre (#1679 L1c) : le port est propre à l'arbre, jamais une
 *  constante — un port fixe faisait recetter le serveur d'un arbre VOISIN. `WFRP_DEV_URL` prime,
 *  pour une app servie ailleurs (autre machine, tunnel). */
export const DEFAULT_URL = process.env.WFRP_DEV_URL || urlDev();

/** Racine de l'arbre depuis lequel CETTE recette tourne. */
export const RACINE_COURANTE = normaliserRacine(RACINE);

/**
 * VERDICT sur l'arbre SERVI (#1679 L1c) — `null` si le serveur sert bien `racineCourante`, sinon le
 * message de refus. Une recette ne prouve un écran que si le serveur qu'elle interroge sert L'ARBRE
 * où elle tourne ; le serveur publie sa racine dans l'en-tête `x-wfrp-racine` (`vite.config.ts`).
 * FAIL-CLOSED : en-tête ABSENT = refus lui aussi — un serveur muet est soit un autre arbre (config
 * d'avant #1679), soit un proxy, et dans les deux cas la mesure ne vaut rien. Fonction PURE.
 */
export function verdictArbreServi(valeurEntete, racineCourante = RACINE_COURANTE) {
  const servie = racineDepuisEntete(valeurEntete);
  if (!servie) {
    return (
      `Le serveur interrogé ne publie pas l'en-tête « ${ENTETE_RACINE} » : impossible de prouver ` +
      `qu'il sert CET arbre (${racineCourante}). Relancer "npm run dev" DANS cet arbre — ou viser ` +
      `explicitement l'autre serveur par WFRP_DEV_URL/--url en assumant la mesure.`
    );
  }
  if (servie !== normaliserRacine(racineCourante)) {
    return (
      `Arbre SERVI ≠ arbre courant : le serveur sert « ${servie} », la recette tourne dans ` +
      `« ${normaliserRacine(racineCourante)} ». La mesure porterait sur l'AUTRE arbre. Lancer ` +
      `"npm run dev" dans CET arbre (son port lui est propre, cf. scripts/port-dev.mjs).`
    );
  }
  return null;
}

/** Chemins SURVEILLÉS pendant une recette : tout ce dont une écriture recharge la page. */
const SURVEILLES = ['src', 'vite.config.ts'];

/** Liste `{ chemin, mtimeMs }` des fichiers surveillés sous `racine` (récursif, sans suivre `node_modules`). */
function fichiersSurveilles(racine) {
  const trouves = [];
  const visiter = (chemin) => {
    let info;
    try { info = statSync(chemin); } catch { return; }
    if (info.isDirectory()) {
      for (const nom of readdirSync(chemin)) visiter(join(chemin, nom));
    } else {
      trouves.push({ chemin, mtimeMs: info.mtimeMs });
    }
  };
  for (const cible of SURVEILLES) visiter(join(racine, cible));
  return trouves;
}

/**
 * EMPREINTE de l'arbre à un instant : `{ nb, mtimeMax, plusRecent }` sur `src/**` + `vite.config.ts`.
 * `lister` est injecté pour la mesure ; par défaut, le disque.
 */
export function empreinteArbre(racine = RACINE, lister = fichiersSurveilles) {
  const fichiers = lister(racine);
  let mtimeMax = 0;
  let plusRecent = null;
  for (const f of fichiers) {
    if (f.mtimeMs > mtimeMax) { mtimeMax = f.mtimeMs; plusRecent = f.chemin; }
  }
  return { nb: fichiers.length, mtimeMax, plusRecent };
}

/**
 * VERDICT sur le GEL de l'arbre entre deux empreintes — `null` si rien n'a bougé, sinon le message
 * d'échec NOMMANT le fichier. Un rejeu silencieux après rechargement (`withReloadRetry`) masquait
 * qu'une autre session avait réécrit `src/` en plein vol : la recette prouvait alors un arbre qui
 * n'est plus celui qu'on croit mesurer. Fonction PURE.
 */
export function verdictArbreGele(avant, apres) {
  if (apres.mtimeMax === avant.mtimeMax && apres.nb === avant.nb) return null;
  const quoi = apres.mtimeMax !== avant.mtimeMax
    ? `fichier ${apres.plusRecent ?? '(inconnu)'}`
    : `${apres.nb - avant.nb} fichier(s) ajouté(s)/supprimé(s)`;
  return (
    `L'arbre a été modifié pendant la recette : ${quoi}. La mesure porte sur un arbre qui a bougé ` +
    `sous elle — relancer en fenêtre calme plutôt que de rejouer (#1679 L1c).`
  );
}
const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

/** Attend `ms` millisecondes. */
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Code porté par tout rejet dû à un rechargement de la page (voir `isNavigationError`). */
export const TARGET_NAVIGATED = 'TARGET_NAVIGATED';

/** Messages CDP émis quand le contexte de page a été recréé sous les pieds de l'appel en vol. */
const NAV_MESSAGES = [
  /Inspected target navigated or closed/i,
  /Execution context was destroyed/i,
  /Cannot find context with specified id/i,
  /Target closed/i,
  /Session with given id not found/i,
  /No target with given id/i,
];

/** Sondes d'app évaporée : un helper `window.__x` posé au chargement redevient `undefined`. */
const CLEARED_GLOBALS = /Cannot read properties of (?:undefined|null) \(reading '[^']+'\)|window\.__\w+ is (?:not a function|undefined)/;

/**
 * Vrai si l'erreur vient d'un rechargement de page (Vite full-reload déclenché par une écriture
 * dans `src/` en cours de recette, #1196) plutôt que d'un défaut du scénario : soit le CDP le dit
 * (`Inspected target navigated or closed`), soit l'évaluation a buté sur un helper de DEV évaporé.
 * Fonction PURE — testable sans navigateur.
 */
export function isNavigationError(err) {
  if (!err) return false;
  if (err.code === TARGET_NAVIGATED) return true;
  const msg = typeof err === 'string' ? err : String(err.message ?? '');
  if (!msg) return false;
  return NAV_MESSAGES.some((re) => re.test(msg)) || CLEARED_GLOBALS.test(msg);
}

/** Fabrique un rejet CATCHABLE typé : les appelants retentent au lieu de mourir. */
function cdpError(message) {
  const e = new Error(message);
  if (isNavigationError(e)) e.code = TARGET_NAVIGATED;
  return e;
}

/**
 * Tue TOUT l'arbre de process Chrome (`chrome.kill()` ne tue que le PID racine — Chrome se
 * découpe en crashpad-handler/gpu-process/renderer×N/utility×N, tous ENFANTS survivants qui
 * gardent le profil temp verrouillé sous Windows, vécu 2026-07-16 sur le ticket #424 : la fuite
 * de handles persistait malgré `chrome.kill()` + retries de `rmSync`). `taskkill /T` (arbre) est
 * la seule primitive Windows fiable ici ; `proc.kill()` reste le filet hors Windows.
 */
function killChromeTree(chrome) {
  if (process.platform === 'win32' && chrome.pid) {
    spawnSync('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try { chrome.kill(); } catch {}
  }
}

/**
 * Filet de sécurité process-wide : tout Chrome spawné par ce module qui survivrait à un chemin
 * d'échec non couvert (SIGINT, script tiers oubliant son try/finally) est tué + son profil purgé
 * à la sortie du process — jamais de fuite silencieuse. `process.on('exit')` est SYNCHRONE : on
 * ne peut pas y `await`, `rmSync` reste best-effort en une passe (pas de retry possible ici).
 */
const activeChildren = new Set();
process.on('exit', () => {
  for (const { chrome, profile } of activeChildren) {
    try { killChromeTree(chrome); } catch {}
    try { rmSync(profile, { recursive: true, force: true }); } catch {}
  }
});

function resolveChromePath(explicit) {
  if (explicit) return explicit;
  return CHROME_CANDIDATES.find((p) => existsSync(p)) ?? CHROME_CANDIDATES[0];
}

/**
 * Vérifie que le serveur de dev répond (le kit ne le DÉMARRE jamais) ET qu'il sert BIEN cet arbre
 * (#1679 L1c) — message d'aide sinon. `WFRP_RECETTE_ARBRE_LIBRE=1` lève le second contrôle pour les
 * cas où la cible est délibérément ailleurs (app déployée, tunnel) ; il reste actif par défaut.
 */
export async function checkServer(url = DEFAULT_URL, { recuperer = fetch, racineCourante = RACINE_COURANTE } = {}) {
  let reponse;
  try {
    reponse = await recuperer(url);
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
  } catch (e) {
    throw new Error(
      `Serveur de dev injoignable sur ${url} — lancer "npm run dev" dans CET arbre, dans un autre ` +
      `terminal, avant d'utiliser le kit de recette (le kit s'ATTACHE, il ne démarre rien). Le port ` +
      `est propre à l'arbre ; pour viser un autre serveur : WFRP_DEV_URL, ou --url. Détail : ${e.message}`,
      { cause: e }
    );
  }
  if (process.env.WFRP_RECETTE_ARBRE_LIBRE === '1') return;
  const refus = verdictArbreServi(reponse.headers?.get?.(ENTETE_RACINE), racineCourante);
  if (refus) throw new Error(`${refus} (URL interrogée : ${url})`);
}

async function waitForWsUrl(port, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://localhost:${port}/json/version`);
      const j = await r.json();
      if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error(`Chrome (CDP) indisponible sur le port ${port} après ${timeoutMs}ms.`);
}

/**
 * Supprime le profil temporaire CDP — tolérant : Windows peut retenir des handles quelques
 * instants après `chrome.kill()` (EBUSY/EPERM), on réessaie avant d'abandonner sans jamais lever.
 */
async function removeProfileDir(profile, attempts = 5, delayMs = 200) {
  for (let i = 0; i < attempts; i++) {
    try {
      rmSync(profile, { recursive: true, force: true });
      return;
    } catch {
      await sleep(delayMs);
    }
  }
}

/**
 * Les TROIS VUES DE RÉFÉRENCE de toute recette (#1847), lues à leur source UNIQUE
 * `scripts/recette/vues-recette.json` — jamais recopiées : trois adresses divergeaient (1440×900,
 * 1600×900, `HEIGHT = 800`) et aucune ne rendait l'écran de l'utilisateur. Mesure du 2026-09-20 :
 * 2560×1440 à 150 % = 1707×960px CSS, `availHeight` 912, fenêtre Chrome utile ≈ 745-780px.
 * Un écran se juge à la HAUTEUR autant qu'à la largeur (`docs/charte-ui.md` § « La HAUTEUR réelle »).
 * Le fichier ne porte QUE des vues ; tout le reste (breakpoints 1440/900/700/560) est de la charte.
 */
export const VUES_RECETTE = JSON.parse(
  readFileSync(fileURLToPath(new URL('./vues-recette.json', import.meta.url)), 'utf8'),
);

/** Une vue par son nom (`bureau`, `portable`, `mobile`) — lève sur un nom inconnu plutôt que de
 *  rendre `undefined`, qu'un appelant transformerait en viewport `NaN×NaN` sans rien dire. */
export function vueRecette(nom) {
  const v = VUES_RECETTE.find((x) => x.nom === nom);
  if (!v) throw new Error(`vueRecette : vue inconnue « ${nom} » — vues connues : ${VUES_RECETTE.map((x) => x.nom).join(', ')}`);
  return v;
}

/** La vue de RÉFÉRENCE : celle du bureau de l'utilisateur. C'est elle qui donne à `launchSession`
 *  son viewport par défaut, et à toute capture sa taille d'étalon. */
export const VUE_REFERENCE = vueRecette('bureau');

/**
 * Déroule `fn({ nom, largeur, hauteur })` sur CHACUNE des trois vues, viewport posé et laissé au
 * calme avant l'appel (un DOM à moitié reposé rend toute mesure aveugle). Helper de sonde : une
 * recette qui ne juge qu'une vue ne juge pas la hauteur.
 */
export async function pourChaqueVue(session, fn, { reposMs = 500 } = {}) {
  for (const vue of VUES_RECETTE) {
    await setViewport(session, vue.largeur, vue.hauteur);
    await sleep(reposMs);
    await fn(vue);
  }
}

/**
 * Lance Chrome headless et attache une session CDP dédiée (targetId + sessionId propres).
 *
 * Viewport par DÉFAUT = la vue de RÉFÉRENCE (`VUE_REFERENCE`, bureau 1707×780) : la fenêtre que
 * l'utilisateur a RÉELLEMENT devant lui. Le défaut historique de 1280 a fait juger « étriqués »
 * pendant deux jours des écrans qui rendaient juste à leur largeur de référence (lot « matières &
 * proportions », #393), et les 900px de haut des recettes suivantes ne tiennent sur AUCUN de ses
 * écrans. Une recette responsive passe sa vue explicitement (`pourChaqueVue`, `setMobileViewport`).
 */
export async function launchSession({ chromePath, width = VUE_REFERENCE.largeur, height = VUE_REFERENCE.hauteur, port, mobile = false, timeoutMs = 10000 } = {}) {
  const cdpPort = port ?? 9222 + Math.floor(Math.random() * 2000);
  const profile = join(os.tmpdir(), `recette-cdp-profile-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
  mkdirSync(profile, { recursive: true });
  const chrome = spawn(resolveChromePath(chromePath), [
    '--headless=new', '--mute-audio', `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`, '--no-first-run', '--no-default-browser-check', 'about:blank',
  ], { stdio: 'ignore' });
  const childEntry = { chrome, profile };
  activeChildren.add(childEntry);

  // Tout échec APRÈS le spawn (avant qu'un `session` ne soit rendu à l'appelant, donc avant qu'il
  // puisse appeler `session.close()`) doit tuer ce Chrome et purger son profil ici — sinon fuite.
  try {
    const wsUrl = await waitForWsUrl(cdpPort, timeoutMs); // même délai réglable que l’amorçage de l’app
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

    let id = 0;
    const pending = new Map();
    const listeners = new Set();
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
    ws.addEventListener('close', () => {
      for (const [mid, { reject }] of pending) {
        pending.delete(mid);
        const e = new Error('Inspected target navigated or closed');
        e.code = TARGET_NAVIGATED;
        reject(e);
      }
    });

    const session = { ws, chrome, listeners, sessionId: null, targetId: null, profile, contextCleared: false };

    session.rpc = (method, params = {}) => new Promise((resolve, reject) => {
      const mid = ++id;
      const msg = { id: mid, method, params };
      if (session.sessionId) msg.sessionId = session.sessionId;
      pending.set(mid, { resolve, reject });
      ws.send(JSON.stringify(msg));
    });

    const { targetId } = await session.rpc('Target.createTarget', { url: 'about:blank' });
    session.targetId = targetId;
    const { sessionId } = await session.rpc('Target.attachToTarget', { targetId, flatten: true });
    session.sessionId = sessionId;

    await session.rpc('Page.enable');
    await session.rpc('Runtime.enable');
    await session.rpc('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: 1, mobile,
    });

    /** Ferme le target CDP + tue le process Chrome + purge le profil temp (toujours appeler en fin de script). */
    session.close = async () => {
      try { await session.rpc('Target.closeTarget', { targetId: session.targetId }); } catch {}
      try { ws.close(); } catch {}
      killChromeTree(chrome);
      await removeProfileDir(profile);
      activeChildren.delete(childEntry);
    };

    return session;
  } catch (e) {
    killChromeTree(chrome);
    await removeProfileDir(profile);
    activeChildren.delete(childEntry);
    throw e;
  }
}

/** Plafond par défaut d'une évaluation en page, et marge du filet côté Node. */
export const DELAI_EVALUATE = 15000;
export const MARGE_EVALUATE = 2000;

/**
 * Course entre `promesse` et un délai : rejette avec `message` si le délai gagne. Le minuteur est
 * TOUJOURS annulé (`unref` ne suffit pas : un rejet non annulé garde le process en vie). PURE.
 */
export function courseContreMontre(promesse, delaiMs, message) {
  let minuteur;
  return Promise.race([
    promesse,
    new Promise((_, rejeter) => { minuteur = setTimeout(() => rejeter(new Error(message)), delaiMs); }),
  ]).finally(() => clearTimeout(minuteur));
}

/**
 * Évalue une expression JS dans la page (attend les promesses) et lève une erreur lisible si ça throw.
 *
 * BORNÉE des DEUX côtés (#1679 L1c) : `Runtime.evaluate` reçoit son `timeout` CDP — le seul levier
 * qui interrompt aussi une boucle SYNCHRONE (aucun minuteur posé DANS la page ne s'exécuterait, le
 * fil est occupé) — doublé d'une course côté Node, pour qu'une réponse CDP qui ne revient jamais
 * (socket muette) rejette au lieu de figer le script sans message.
 */
export async function evaluate(session, expression, { timeoutMs = DELAI_EVALUATE, margeMs = MARGE_EVALUATE } = {}) {
  const depart = Date.now();
  const borne = (delai) =>
    `evaluate : la page n'a pas rendu la main en ${delai}ms (boucle non bornée ou attente sans fin ` +
    `dans l'expression évaluée) — expression : ${expression.slice(0, 200)}`;
  let r;
  try {
    r = await courseContreMontre(
      session.rpc('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, timeout: timeoutMs }),
      timeoutMs + margeMs,
      borne(timeoutMs + margeMs),
    );
  } catch (e) {
    // Le CDP interrompt bien l'exécution au `timeout`, mais rend un « Internal error » nu (mesuré
    // 2026-09-02, Chrome headless) : le requalifier ici, sinon un plafond ATTEINT se lit comme un
    // défaut mystérieux du scénario. Le rejet de la course côté Node porte déjà son message.
    if (Date.now() - depart >= timeoutMs && !isNavigationError(e) && !e.message?.startsWith('evaluate : ')) {
      throw new Error(`${borne(timeoutMs)} — le navigateur a rendu : ${e.message}`, { cause: e });
    }
    throw e;
  }
  if (r.exceptionDetails) {
    throw cdpError(r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails));
  }
  return r.result.value;
}

/** Instantané des stockages de la page — `{ local, session }`, tout en chaînes. */
export async function instantanerStockage(session) {
  return evaluate(session, `(() => ({
    local: Object.fromEntries(Object.entries(window.localStorage)),
    session: Object.fromEntries(Object.entries(window.sessionStorage)),
  }))()`);
}

/** Expression de RESTAURATION d'un instantané de stockage (PURE — testable sans navigateur). */
export function expressionRestaurerStockage(instantane) {
  return `(() => {
    const s = ${JSON.stringify(instantane ?? {})};
    for (const [nom, contenu] of [['localStorage', s.local || {}], ['sessionStorage', s.session || {}]]) {
      const zone = window[nom];
      zone.clear();
      for (const [k, v] of Object.entries(contenu)) zone.setItem(k, v);
    }
    return true;
  })()`;
}

/**
 * Restaure un instantané de stockage : une recette ne laisse JAMAIS l'état persistant du joueur
 * modifié derrière elle (sauvegardes, réglages) — appelé par `openApp` à la fermeture.
 */
export async function restaurerStockage(session, instantane) {
  return evaluate(session, expressionRestaurerStockage(instantane));
}

/** Attend qu'une expression JS devienne vraie (poll), lève si le délai expire. */
export async function waitFor(session, expression, { timeoutMs = 8000, intervalMs = 200 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await evaluate(session, expression)) return true;
    if (Date.now() >= deadline) throw new Error(`Condition jamais vraie après ${timeoutMs}ms : ${expression}`);
    await sleep(intervalMs);
  }
}

/** Délai BORNÉ pendant lequel un helper qui vise une cible au DOM la re-cherche avant de refuser : un
 *  écran monté en différé (liste des scénarios après « Scénarios de test ») n'est pas encore là au
 *  premier regard. */
export const DELAI_CIBLE_MS = 5000;

/** Re-évalue `expression` jusqu'à une valeur non nulle, ou `null` à l'échéance `delaiCibleMs` — la
 *  recherche de cible UNIQUE des helpers qui visent le DOM (`clickButtonByText`, `cliquerSelecteur`,
 *  `survoler`, `infobulleDe`, `selectOption`, `typeInField`). */
async function chercherCible(session, expression, delaiCibleMs = DELAI_CIBLE_MS, intervalMs = 100) {
  const deadline = Date.now() + delaiCibleMs;
  for (;;) {
    const v = await evaluate(session, expression);
    if (v != null) return v;
    if (Date.now() >= deadline) return null;
    await sleep(intervalMs);
  }
}

/** Expression d'app prête — `__wfrp.screen` est posé par `installDevtools` (cf. `openApp`). */
const APP_READY = `typeof window.__wfrp?.screen === 'function'`;

/** Attend l'app SANS lever : pendant un rechargement, chaque évaluation peut elle-même échouer. */
async function waitForAppSilently(session, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      if (await evaluate(session, APP_READY)) return true;
    } catch {}
    if (Date.now() >= deadline) return false;
    await sleep(250);
  }
}

/**
 * Rejoue `fn` quand la page a été RECHARGÉE sous les pieds du scénario (#1196 : une autre session
 * écrit dans `src/`, Vite full-reload, le contexte de page et ses helpers `window.__*` disparaissent).
 * Entre deux tentatives : on ré-attend l'app, puis `resettle` remet l'écran courant en place.
 * Toute erreur qui n'est PAS une navigation remonte telle quelle (aucun masquage de vrai défaut).
 */
export async function withReloadRetry(session, fn, { tries = 3, resettle, onRetry, timeoutMs = 20000, empreinte = empreinteArbre } = {}) {
  let last;
  const avant = empreinte();
  for (let i = 0; i < tries; i++) {
    session.contextCleared = false;
    try {
      return await fn();
    } catch (e) {
      if (!isNavigationError(e) && !session.contextCleared) throw e;
      // Rechargement CONSTATÉ : avant de rejouer, dire POURQUOI la page a rechargé (#1679 L1c). Un
      // arbre qui bouge sous la recette invalide la mesure ; le rejeu la maquillerait en vert.
      const bouge = verdictArbreGele(avant, empreinte());
      if (bouge) throw new Error(bouge, { cause: e });
      last = e;
      if (i === tries - 1) break;
      if (onRetry) await onRetry(e, i + 1, tries);
      await sleep(500);
      if (!(await waitForAppSilently(session, timeoutMs))) continue;
      if (resettle) {
        try { await resettle(session); } catch (re) { last = re; }
      }
    }
  }
  throw new Error(
    `Rechargement de page pendant la recette : ${tries} tentatives épuisées (dernier échec : ${last?.message ?? last}). ` +
    `arbre src/ en écriture par une autre session ? relancer en fenêtre calme (#1196)`,
    { cause: last },
  );
}

/**
 * Vérifie le serveur, lance Chrome, navigue et attend que `window.__wfrp` soit prêt.
 * `window.__wfrp` existe TÔT (le collecteur d'erreurs le pose en premier, `src/main.tsx`) mais
 * `installDevtools` le RÉASSIGNE en bloc peu après (chargement async, DEV uniquement) — attendre
 * `screen` (helper de navigation) plutôt que la seule présence de `__wfrp` sous peine de courir
 * après un objet encore partiel (`errors`/`exportErrors` seuls).
 *
 * `url` est EXPLICITE dès qu'on juge un worktree lié : le défaut vise le port de l'arbre principal,
 * et une recette qui l'oublie juge l'AUTRE arbre sans le dire.
 * `timeoutMs` (45 s) borne cette attente ET celle de l'URL CDP (`launchSession`) — un seul réglage
 * pour l'amorçage complet : un premier chargement à froid a été mesuré à 21 s sur un
 * worktree neuf (Vite compile la totalité du graphe à la première requête), là où le plafond de 10 s
 * d'origine rendait un refus qui accusait l'app. Le message DISTINGUE les deux causes : page qui n'a
 * pas répondu du tout (`__wfrp` absent — build cassé, mauvaise URL) et app trop lente à s'installer.
 */
export async function openApp(url = DEFAULT_URL, { timeoutMs = 45000, ...opts } = {}) {
  await checkServer(url);
  const session = await launchSession({ ...opts, timeoutMs });
  try {
    await session.rpc('Page.navigate', { url });
    try {
      await waitFor(session, APP_READY, { timeoutMs });
    } catch (e) {
      const presence = await evaluate(session, 'typeof window.__wfrp').catch(() => 'inconnu');
      throw new Error(
        presence === 'object'
          ? `openApp : « ${url} » a répondu mais l'app n'a pas fini de s'installer en ${timeoutMs} ms (\`__wfrp.screen\` toujours absent) — relever \`timeoutMs\` si le premier chargement est à froid.`
          : `openApp : « ${url} » n'expose AUCUN \`window.__wfrp\` (typeof = ${presence}) — URL d'un autre arbre, build cassé, ou serveur non-DEV.`,
        { cause: e },
      );
    }
    // ÉTAT PERSISTANT (#1679 L1c) : la recette joue — elle crée des héros, sauvegarde, change des
    // réglages. L'instantané pris ici est remis à la fermeture, pour qu'elle ne laisse rien derrière.
    session.stockageInitial = await instantanerStockage(session);
    const fermer = session.close;
    session.close = async () => {
      try { await restaurerStockage(session, session.stockageInitial); } catch { /* page déjà morte */ }
      await fermer();
    };
    return session;
  } catch (e) {
    await session.close();
    throw e;
  }
}

/** Navigue vers un écran via `__wfrp.screen(name)` — id validé côté app (throw si invalide). */
export async function gotoScreen(session, name, { settleMs = 600 } = {}) {
  await evaluate(session, `window.__wfrp.screen(${JSON.stringify(name)})`);
  await sleep(settleMs);
}

/**
 * Capture un PNG nommé dans `dir` (créé si absent) — retourne le chemin écrit.
 * `ancre` (sélecteur) fait DÉFILER l'élément en vue avant la capture : à 360 px les écrans s'empilent
 * et le sujet d'une recette se retrouve sous le pli — une capture le montrerait absent alors qu'il est
 * seulement plus bas.
 *
 * NEUTRALISATION avant capture (`neutraliser`, par défaut) : le popup d'un `<select>` est NATIF (hors
 * DOM) et restait ouvert au-dessus de la page sur les captures qui suivaient un `selectOption`. On
 * ferme donc ce popup — `Escape` UNIQUEMENT quand le focus est sur un `<select>`, jamais à l'aveugle :
 * une recette qui capture une modale la verrait se fermer sous elle (`intentions-portee.mjs:200`
 * photographie un jet ouvert) — puis on retire le focus, dont l'anneau signe la capture.
 */
export async function shot(session, name, dir = process.cwd(), { ancre, neutraliser = true } = {}) {
  if (neutraliser) {
    const surSelect = await evaluate(session, `!!document.activeElement && document.activeElement.tagName === 'SELECT'`);
    if (surSelect) await realKey(session, { key: 'Escape' });
    await evaluate(session, `(() => { const a = document.activeElement; if (a && a.blur) a.blur(); return true; })()`);
    await sleep(80);
  }
  if (ancre) {
    await evaluate(session, `(() => {
      const el = document.querySelector(${JSON.stringify(ancre)});
      if (el) el.scrollIntoView({ block: 'center', inline: 'center' });
      return !!el;
    })()`);
    await sleep(120);
  }
  mkdirSync(dir, { recursive: true });
  const r = await session.rpc('Page.captureScreenshot', { format: 'png' });
  const path = join(dir, name.endsWith('.png') ? name : `${name}.png`);
  writeFileSync(path, Buffer.from(r.data, 'base64'));
  return path;
}

/**
 * Collecte erreurs/warnings console + exceptions, filtrés sur LA session courante — le CDP
 * multiplexe plusieurs sessions/onglets sur la même connexion, un piège vécu en recette (buffer
 * partagé, cf. docs/recette-navigateur.md « Pièges vécus ») : sans ce filtre par `sessionId`,
 * une 2e session ouverte dans le même process récupère aussi les messages d'une session PRÉCÉDENTE.
 */
export function consoleGuard(session) {
  const entries = [];
  const handler = (m) => {
    if (m.sessionId !== session.sessionId) return;
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) {
      const text = (m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
      entries.push({ type: m.params.type, text });
    }
    if (m.method === 'Runtime.exceptionThrown') {
      const ex = m.params.exceptionDetails;
      entries.push({ type: 'exception', text: ex.exception?.description || ex.text });
    }
  };
  session.listeners.add(handler);
  return {
    entries,
    errors: () => entries.filter((e) => e.type === 'error' || e.type === 'exception'),
    stop: () => session.listeners.delete(handler),
  };
}

/**
 * ESPION RÉSEAU — la liste des URL que la page DEMANDE, à poser AVANT le geste mesuré.
 *
 * Deux voies, réunies : le patch de `fetch`/`XMLHttpRequest` DANS la page (il voit l'URL telle que
 * l'app la demande, même servie par un cache) et l'événement CDP `Network.requestWillBeSent` (il voit
 * ce que le réseau porte, y compris les requêtes qu'aucun script n'émet). Les deux se recoupent : une
 * URL vue par l'une seule est rendue quand même.
 *
 * POURQUOI PAS `performance.getEntriesByType('resource')` : son tampon est BORNÉ (250 entrées par
 * défaut) et l'app le sature à l'amorçage — la mesure y rendait « aucune requête » alors que la page
 * en avait émis (faux vert vécu en recette C5). Un espion se POSE avant le geste, il ne se relit pas
 * après coup.
 *
 * @param {object} session @param {{ filtre?: (url: string) => boolean }} [options]
 * @returns {Promise<{ urls: () => Promise<string[]>, correspondant: (motif: string|RegExp) => Promise<string[]>, stop: () => void }>}
 */
export async function espionReseau(session, { filtre } = {}) {
  const vues = [];
  const ajouter = (url) => { if (typeof url === 'string' && url && !vues.includes(url)) vues.push(url); };
  const handler = (m) => {
    if (m.sessionId !== session.sessionId) return;
    if (m.method === 'Network.requestWillBeSent') ajouter(m.params?.request?.url);
  };
  session.listeners.add(handler);
  await session.rpc('Network.enable', {});
  // Le patch de page : posé une seule fois, il empile dans un tableau que l'espion relit.
  await evaluate(session, `(() => {
    if (window.__recetteReseau) return;
    window.__recetteReseau = [];
    const note = (u) => { try { window.__recetteReseau.push(String(u && u.url ? u.url : u)); } catch { /* URL illisible */ } };
    const fetchOrig = window.fetch.bind(window);
    window.fetch = (entree, init) => { note(entree); return fetchOrig(entree, init); };
    const ouvrirOrig = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function (methode, url, ...reste) {
      note(url);
      return ouvrirOrig.call(this, methode, url, ...reste);
    };
  })()`);
  const urls = async () => {
    const dePage = await evaluate(session, 'JSON.stringify(window.__recetteReseau || [])');
    for (const u of JSON.parse(dePage || '[]')) ajouter(u);
    return filtre ? vues.filter(filtre) : [...vues];
  };
  return {
    urls,
    correspondant: async (motif) => {
      const re = motif instanceof RegExp ? motif : new RegExp(motif);
      return (await urls()).filter((u) => re.test(u));
    },
    stop: () => session.listeners.delete(handler),
  };
}

/**
 * Monkey-patch `setTimeout` pour figer une animation le temps d'une capture : les délais fournis
 * (`delays`, dans l'ordre d'appel) remplacent ceux demandés par l'app, le dernier de la liste étant
 * réutilisé pour tout appel excédentaire — passer `[0]` fige tout à l'instantané.
 */
export async function freezeTimeout(session, delays = [0]) {
  await evaluate(session, `(() => {
    if (window.__recetteOrigSetTimeout) return;
    window.__recetteOrigSetTimeout = window.setTimeout.bind(window);
    const forced = ${JSON.stringify(delays)};
    let i = 0;
    window.setTimeout = (fn, ms, ...args) =>
      window.__recetteOrigSetTimeout(fn, forced.length ? forced[Math.min(i++, forced.length - 1)] : ms, ...args);
  })()`);
}

/** Annule `freezeTimeout` — restaure le vrai `setTimeout`. */
export async function unfreezeTimeout(session) {
  await evaluate(session, `(() => {
    if (window.__recetteOrigSetTimeout) {
      window.setTimeout = window.__recetteOrigSetTimeout;
      delete window.__recetteOrigSetTimeout;
    }
  })()`);
}

/** Force `prefers-reduced-motion: reduce` côté page (CDP `Emulation.setEmulatedMedia`). */
export async function emulateReducedMotion(session) {
  await session.rpc('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
}

/** Redimensionne le viewport (mobile = largeur ≤ 480px active l'émulation tactile). */
export async function setViewport(session, width, height) {
  await session.rpc('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: width <= 480,
  });
}

/** Raccourci `setViewport` à la vue MOBILE de `vues-recette.json` — la source unique, jamais un
 *  couple recopié ici (charte-ui.md : testable dès 360px). */
export async function setMobileViewport(session) {
  const { largeur, hauteur } = vueRecette('mobile');
  await setViewport(session, largeur, hauteur);
}

/**
 * Clique un `<button>`/`[role="button"]` par son TEXTE (sous-chaîne, espaces normalisés) via un
 * VRAI clic CDP (`Input.dispatchMouseEvent`, pas `.click()` JS) — le SEUL pilotage qui traverse les
 * mêmes gestionnaires que la souris (delegation, `pointerdown`…). SCROLL-AWARE : un bouton hors
 * viewport a un rect `{x,y}` qui ne correspond à RIEN de cliquable tant qu'on ne l'a pas fait défiler
 * dans le viewport — lire le rect AVANT `scrollIntoView` fait rater le clic SILENCIEUSEMENT (aucune
 * erreur, juste aucun effet), piège vécu en recette (#514). L'apostrophe est MIXTE selon l'écran
 * (typographique U+2019 ou droite U+0027) — les deux formes sont normalisées vers une seule avant
 * comparaison, texte cherché ET texte DOM (piège vécu, écrans « Tenter un Test d'Athlétisme » vs
 * « Dormir jusqu'à l'aube »).
 *
 * `{ exact: true }` compare le texte ENTIER du bouton au lieu d'y chercher une sous-chaîne : c'est ce
 * qu'il faut dès qu'un libellé court en préfixe un autre (« Fermer » / « Fermer la fiche »,
 * « blocs » / « blocs et cellules ») — sans lui, `find` prend le PREMIER du DOM, qui n'est pas
 * forcément celui que la recette vise.
 * Quand PLUSIEURS boutons matchent, le premier est cliqué (comportement inchangé) mais l'ambiguïté
 * est AVERTIE sur `stderr` avec les textes concurrents : une recette qui vise le mauvais bouton
 * échoue plus loin, sur un symptôme qui ne désigne plus sa cause. Avertissement, jamais exception —
 * l'appelant peut légitimement viser le premier.
 *
 * `dans` = sélecteur RACINE où chercher (même patron que `{ racine }` de `cliquerAction`) : c'est la
 * sortie propre quand le même libellé vit dans deux zones de l'écran (un « Fermer » de modale et
 * celui du bandeau), là où `exact` ne départage pas.
 *
 * `rangee` = texte d'une RANGÉE (sous-chaîne, mêmes normalisations) : quand chaque rangée d'une liste
 * porte le même bouton (cinq « Choisir » dans la modale « Choisir la campagne »), seuls comptent les
 * boutons de la rangée qui porte ce texte — l'ancêtre le plus proche de ce texte qui contient un
 * bouton candidat. Ni `dans` ni `exact` ne départagent des boutons de même libellé dans la même racine.
 *
 * `modifiers` = les touches TENUES pendant le clic (`MOD_ALT`), même paramètre que `survoler`.
 */
export async function clickButtonByText(session, texte, { exact = false, dans, rangee, modifiers = 0, delaiCibleMs = DELAI_CIBLE_MS } = {}) {
  const rect = await chercherCible(session, `(() => {
    const norm = (s) => (s || '').replace(/\\s+/g, ' ').replace(/[\\u2019']/g, "'").trim();
    const target = norm(${JSON.stringify(texte)});
    const racine = ${dans ? `document.querySelector(${JSON.stringify(dans)})` : 'document'};
    if (!racine) return null;
    const els = Array.from(racine.querySelectorAll('button, [role="button"]'));
    const libelles = els.filter((b) => ${exact} ? norm(b.textContent) === target : norm(b.textContent).includes(target));
    const rangee = ${rangee === undefined ? 'null' : `norm(${JSON.stringify(rangee)})`};
    const porte = (e) => norm(e.textContent).includes(rangee);
    const deLaRangee = new Set();
    if (rangee !== null) {
      const porteurs = Array.from(racine.querySelectorAll('*')).filter((e) => porte(e) && !Array.from(e.children).some(porte));
      for (const p of porteurs) {
        let a = p;
        while (a && !libelles.some((b) => a.contains(b))) a = a === racine ? null : a.parentElement;
        if (a) for (const b of libelles) if (a.contains(b)) deLaRangee.add(b);
      }
    }
    const matches = rangee === null ? libelles : libelles.filter((b) => deLaRangee.has(b));
    const el = matches[0];
    if (!el) return null;
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, textes: matches.slice(0, 5).map((b) => norm(b.textContent)) };
  })()`, delaiCibleMs);
  if (!rect) throw new Error(`clickButtonByText : aucun bouton ne matche « ${texte} »${dans ? ` dans « ${dans} »` : ''}${rangee !== undefined ? ` dans la rangée « ${rangee} »` : ''} après ${delaiCibleMs} ms`);
  if (rect.textes && rect.textes.length > 1) {
    console.warn(`clickButtonByText « ${texte} » : ${rect.textes.length} boutons matchent (${rect.textes.join(' | ')}) — le PREMIER est cliqué. Préciser avec { exact: true } si ce n'est pas celui-là.`);
  }
  await clicReel(session, rect.x, rect.y, modifiers);
  return rect;
}

/**
 * CLIC RÉEL d'un contrôle désigné par un SÉLECTEUR — le pendant de `clickButtonByText` quand le
 * contrôle n'a pas de texte (un bouton à GLYPHE : tiroir du journal, menu ☰, ouvreur d'écran).
 * SCROLL-AWARE comme ses frères (rect lu APRÈS `scrollIntoView`), et il REFUSE explicitement : cible
 * absente, ou désactivée — jamais un clic silencieux qui n'a rien fait.
 * @returns {Promise<{ x: number, y: number, label: string }>}
 */
export async function cliquerSelecteur(session, selecteur, { modifiers = 0, delaiCibleMs = DELAI_CIBLE_MS } = {}) {
  const cible = await chercherCible(session, `(() => {
    const el = document.querySelector(${JSON.stringify(selecteur)});
    if (!el) return null;
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const r = el.getBoundingClientRect();
    return {
      x: r.x + r.width / 2, y: r.y + r.height / 2,
      vide: r.width === 0 || r.height === 0,
      desactive: !!el.disabled || el.getAttribute('aria-disabled') === 'true',
      label: (el.getAttribute('title') || el.getAttribute('aria-label') || el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 60),
    };
  })()`, delaiCibleMs);
  if (!cible) throw new Error(`cliquerSelecteur « ${selecteur} » : aucun élément après ${delaiCibleMs} ms`);
  if (cible.vide) throw new Error(`cliquerSelecteur « ${selecteur} » : boîte de taille nulle (non rendu)`);
  if (cible.desactive) throw new Error(`cliquerSelecteur « ${selecteur} » : contrôle DÉSACTIVÉ (${cible.label})`);
  await clicReel(session, cible.x, cible.y, modifiers);
  return cible;
}

/** Clic RÉEL (CDP) au point donné — le geste de clic UNIQUE de ce module : tout helper qui clique
 *  passe ici, aucun ne réécrit la triade `mouseMoved`/`mousePressed`/`mouseReleased`. */
export async function clicReel(session, x, y, modifiers = 0) {
  await session.rpc('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, modifiers });
  await session.rpc('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1, modifiers });
  await session.rpc('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, modifiers });
}

/**
 * Libellés d'AVANCEMENT d'une cascade de fenêtres, par ordre de préférence : ils font AVANCER une
 * cérémonie déjà décidée (lancer, appliquer, fermer). Aucun libellé de RÈGLE ici (ni « Parade », ni
 * « Esquive ») : un CHOIX de joueur ne se résout pas par un cas nommé dans une liste de recette, il
 * se résout par sa forme — cf. `resoudreModales`.
 */
export const CASCADE_LABELS = ['Tout lancer', 'Commencer', 'Lancer', 'Continuer', 'Appliquer', 'Poursuivre', 'Suivant', 'Valider', 'Terminer', 'Fermer'];

/**
 * RÉSOUT toute fenêtre ouverte (`.modal-overlay`) par ses VRAIS boutons, jusqu'à ce qu'il n'y en ait
 * plus — DÉFINITION UNIQUE, partagée par les sondes de recette.
 * Deux gestes, dans cet ordre :
 *  1. un bouton d'AVANCEMENT (`CASCADE_LABELS`) : la cérémonie continue ;
 *  2. à défaut, la PREMIÈRE option OUVERTE d'un sélecteur d'options (`OptionChooser` : `.seg`,
 *     `.rm-loc-grid`, `.rm-loc-inline`) — une fenêtre de CHOIX (défense, désengagement, résistance)
 *     n'a aucun bouton d'avancement tant que le joueur n'a pas tranché. La recette tranche par la
 *     FORME du contrôle, jamais par le nom d'une règle : toute fenêtre de choix passe, y compris
 *     celle qu'une règle future ouvrira. L'option cliquée est IMPRIMÉE (une recette dit ce qu'elle
 *     a choisi à la place du joueur).
 * Lève, en nommant les boutons offerts, si aucun des deux gestes ne s'applique — et lève aussi si
 * l'option cliquée NE FAIT RIEN : une fenêtre dont les boutons et l'option offerte sont identiques
 * après deux clics est un BLOCAGE, pas une lenteur, et la recette le nomme au lieu d'épuiser `max`.
 */
export async function resoudreModales(session, etape, { labels = CASCADE_LABELS, max = 40, pauseMs = 600 } = {}) {
  let precedent = null;
  let immobile = 0;
  for (let i = 0; i < max; i++) {
    const etat = await evaluate(session, `(() => {
      const modale = document.querySelector('.modal-overlay');
      if (!modale) return null;
      const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
      const ouvert = (b) => !b.disabled && b.getAttribute('aria-disabled') !== 'true';
      const boutons = [...modale.querySelectorAll('button')].filter(ouvert).map((b) => norm(b.textContent)).filter(Boolean);
      const option = [...modale.querySelectorAll('.seg button, .rm-loc-grid button, .rm-loc-inline button')].filter(ouvert)[0] || null;
      let point = null;
      if (option) {
        option.scrollIntoView({ block: 'center', inline: 'center' });
        const r = option.getBoundingClientRect();
        point = { x: r.x + r.width / 2, y: r.y + r.height / 2, texte: norm(option.textContent) };
      }
      return { boutons, option: point };
    })()`);
    if (!etat) return;
    const signature = `${etat.boutons.join('|')}##${etat.option ? etat.option.texte : ''}`;
    immobile = signature === precedent ? immobile + 1 : 0;
    precedent = signature;
    if (immobile >= 2 && etat.option) {
      throw new Error(`[${etape}] l'option « ${etat.option.texte} » ne fait pas avancer la fenêtre `
        + `(boutons inchangés après ${immobile} clics : ${etat.boutons.join(' | ') || '(aucun)'})`);
    }
    const label = labels.find((l) => etat.boutons.some((t) => t.includes(l)));
    if (label) {
      await clickButtonByText(session, label, { dans: '.modal-overlay' });
    } else if (etat.option) {
      console.log(`[${etape}] fenêtre de CHOIX : première option ouverte — « ${etat.option.texte} »`);
      await clicReel(session, etat.option.x, etat.option.y);
    } else {
      throw new Error(`[${etape}] fenêtre bloquée, ni bouton d'avancement ni option ouverte parmi : ${etat.boutons.join(' | ') || '(aucun bouton)'}`);
    }
    await sleep(pauseMs);
  }
  throw new Error(`[${etape}] les fenêtres ne se referment pas après ${max} avancements`);
}

/**
 * SURVOL RÉEL (CDP `Input.dispatchMouseEvent mouseMoved`) d'un contrôle désigné par un SÉLECTEUR ou
 * par son TEXTE exact de bouton — le geste par lequel une raison de refus se lit (arbitrage user
 * 2026-08-24 : au survol/focus/tap, jamais inline). SCROLL-AWARE comme `clickButtonByText` : le rect
 * est lu APRÈS `scrollIntoView`, sinon la souris se pose sur ce qui n'est pas là.
 *
 * `attenteMs` laisse l'infobulle s'ouvrir (elle naît sur `pointerenter`, pas au rendu suivant).
 * `modifiers` porte les touches TENUES pendant le geste (`MOD_ALT` sous un Alt maintenu) : sans lui,
 * l'événement dirait au navigateur que la touche vient d'être relâchée.
 * Rend le point survolé `{ x, y }` ; lève si la cible est absente.
 */
export async function survoler(session, cible, { attenteMs = 500, modifiers = 0, delaiCibleMs = DELAI_CIBLE_MS } = {}) {
  const point = await chercherCible(session, `(() => {
    const norm = (s) => (s || '').replace(/\\s+/g, ' ').replace(/[\\u2019']/g, "'").trim();
    const cible = ${JSON.stringify(cible)};
    let el = null;
    try { el = document.querySelector(cible); } catch { el = null; }
    if (!el) el = Array.from(document.querySelectorAll('button, [role="button"]')).find((b) => norm(b.textContent) === norm(cible)) || null;
    if (!el) return null;
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  })()`, delaiCibleMs);
  if (!point) throw new Error(`survoler : aucune cible « ${cible} » (sélecteur ni texte de bouton) après ${delaiCibleMs} ms`);
  await session.rpc('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y, buttons: 0, modifiers });
  await sleep(attenteMs);
  return point;
}

/**
 * L'INFOBULLE ouverte et sa position RELATIVE à la cible : `{ texte, dx, dy }` — `dx`/`dy` sont les
 * écarts entre les deux boîtes (0 quand elles se touchent ou se recouvrent sur cet axe). Une bulle
 * posée loin de sa cible est le symptôme d'un rect mesuré à 0×0 (piège vécu : `display: contents`
 * sur l'enveloppe → bulle au coin haut-gauche, (8, 6) pour un contrôle à (1050, 258)).
 * `{ texte: null }` = aucune infobulle ouverte — un refus muet, pas une erreur de recette.
 */
export async function infobulleDe(session, cible, { delaiCibleMs = DELAI_CIBLE_MS } = {}) {
  const r = await chercherCible(session, `(() => {
    const norm = (s) => (s || '').replace(/\\s+/g, ' ').replace(/[\\u2019']/g, "'").trim();
    const cible = ${JSON.stringify(cible)};
    let el = null;
    try { el = document.querySelector(cible); } catch { el = null; }
    if (!el) el = Array.from(document.querySelectorAll('button, [role="button"]')).find((b) => norm(b.textContent) === norm(cible)) || null;
    if (!el) return null;
    const bulle = document.querySelector('[role="tooltip"]');
    const b = el.getBoundingClientRect();
    if (!bulle) return { texte: null, cible: { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } };
    const p = bulle.getBoundingClientRect();
    return {
      texte: norm(bulle.textContent),
      dx: Math.round(Math.max(0, b.left - p.right, p.left - b.right)),
      dy: Math.round(Math.max(0, b.top - p.bottom, p.top - b.bottom)),
      cible: { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) },
      bulle: { x: Math.round(p.x), y: Math.round(p.y), w: Math.round(p.width), h: Math.round(p.height) },
    };
  })()`, delaiCibleMs);
  if (!r) throw new Error(`infobulleDe : aucune cible « ${cible} » (sélecteur ni texte de bouton) après ${delaiCibleMs} ms`);
  return r;
}

/**
 * CHOISIT une option d'un `<select>` AU GESTE (`session, selecteur, valeur`) — le pendant « liste
 * déroulante » de `clickButtonByText`/`typeInField`.
 *
 * Un `<select>` ne s'ouvre pas en headless (le popup est natif, hors DOM) : le geste réel qu'on peut
 * rejouer est celui du CLAVIER — focaliser la liste, poser `selectedIndex`, puis laisser partir les
 * événements `input` et `change` que le navigateur émet à la validation. Trois étages, tous DOM :
 *  1. FOCUS par un vrai clic CDP (comme `typeInField`) — la liste reçoit le geste, pas le `<body>` ;
 *  2. `selectedIndex` posé par le SETTER NATIF (`HTMLSelectElement.prototype.value`), jamais par un
 *     `setState` React : c'est ce qui fait voir la nouvelle valeur au `onChange` d'un champ CONTRÔLÉ
 *     (même piège que `.value = …` documenté dans `docs/recette-navigateur.md`) ;
 *  3. `input` puis `change` dispatchés `{ bubbles: true }` — React écoute `change` sur la racine.
 *
 * Refus EXPLICITES : liste absente, ou valeur absente des options (les valeurs offertes sont
 * remontées dans le message). Rend `{ valeur, libelle }` LUS après le geste — un `onChange` qui
 * refuse la valeur se voit donc au retour, jamais en silence.
 */
export async function selectOption(session, selecteur, valeur, { delaiCibleMs = DELAI_CIBLE_MS } = {}) {
  const rect = await chercherCible(session, `(() => {
    const el = document.querySelector(${JSON.stringify(selecteur)});
    if (!el) return null;
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`, delaiCibleMs);
  if (!rect) throw new Error(`selectOption : aucune liste ne matche « ${selecteur} » après ${delaiCibleMs} ms`);
  await clicReel(session, rect.x, rect.y);
  const res = await evaluate(session, `(() => {
    const el = document.querySelector(${JSON.stringify(selecteur)});
    const cible = ${JSON.stringify(String(valeur))};
    const options = Array.from(el.options).map((o) => o.value);
    const i = options.indexOf(cible);
    if (i < 0) return { absente: true, options };
    el.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    setter.call(el, cible);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { valeur: el.value, libelle: (el.selectedOptions[0] || {}).textContent || '' };
  })()`);
  if (res && res.absente) {
    throw new Error(`selectOption « ${selecteur} » : aucune option ne vaut « ${valeur} » — offertes : ${res.options.join(' | ')}`);
  }
  return res;
}

/**
 * SÉLECTEUR CSS d'un champ désigné par son LIBELLÉ VISIBLE (`champParLibelle(session, 'dernier bloc')`).
 *
 * Pourquoi ce détour : `NumberField variant="champ"` (et tout l'éditeur qui le compose) rend
 * `label.field > span + input`, et l'`id` qui les lie vient de `useId` — `:r5:`, `:ra:` : ce n'est PAS
 * un sélecteur CSS valide (`document.querySelector('#:r5:')` JETTE). La recette ne peut donc pas viser
 * le champ par son id ; elle le vise par le TEXTE de son libellé, comme un humain.
 *
 * Rend un sélecteur utilisable par `typeInField`/`evaluate` (un `data-recette` posé à la volée sur le
 * champ trouvé), ou `null` si aucun libellé ne matche. Le marqueur est INERTE (attribut de données) :
 * il ne change ni le style ni le comportement. Il PERSISTE en revanche jusqu'au démontage du nœud —
 * React ne retire pas un attribut qu'il n'a pas posé ; chaque appel tire donc une marque NEUVE, et
 * une recette qui vise le même champ deux fois doit reprendre le sélecteur que l'appel vient de rendre.
 *
 * `dans` = sélecteur RACINE où chercher, même option que `clickButtonByText` : quand le même libellé
 * vit dans deux zones de l'écran (le « Nom » de l'inspecteur et celui de la modale « Enregistrer »).
 * Racine absente = `null`, comme un libellé introuvable.
 */
export async function champParLibelle(session, libelle, { exact = true, dans } = {}) {
  const marque = `recette-champ-${Math.random().toString(36).slice(2, 8)}`
  const trouve = await evaluate(session, `(() => {
    const norm = (s) => (s || '').replace(/\\s+/g, ' ').replace(/[\\u2019']/g, "'").trim();
    const target = norm(${JSON.stringify(libelle)});
    const racine = ${dans ? `document.querySelector(${JSON.stringify(dans)})` : 'document'};
    if (!racine) return null;
    const champs = Array.from(racine.querySelectorAll('input, select, textarea'));
    const el = champs.find((c) => {
      const nom = norm((c.labels && c.labels[0] ? c.labels[0].textContent : '') || c.getAttribute('aria-label') || '');
      return ${exact} ? nom === target : nom.includes(target);
    });
    if (!el) return null;
    el.setAttribute('data-recette', ${JSON.stringify(marque)});
    return true;
  })()`)
  return trouve ? `[data-recette="${marque}"]` : null
}

/**
 * PEUPLE un `input[type=file]` désigné par un SÉLECTEUR avec le fichier `chemin` (résolu en absolu),
 * par `DOM.setFileInputFiles` — l'`input` reçoit son `change` sans aucun dialogue. Cliquer son
 * `<label>` ouvrirait le sélecteur de fichier de l'OS, qu'aucun pilote ne ferme.
 *
 * `dans` = sélecteur RACINE où chercher, même option que `clickButtonByText`. REFUSE en le nommant :
 * racine absente, `input` absent — jamais un geste silencieux qui n'a rien posé.
 */
export async function poserFichier(session, selecteur, chemin, { dans } = {}) {
  await session.rpc('DOM.enable');
  const { root } = await session.rpc('DOM.getDocument', { depth: 0 });
  let racine = root.nodeId;
  if (dans) {
    racine = (await session.rpc('DOM.querySelector', { nodeId: racine, selector: dans })).nodeId;
    if (!racine) throw new Error(`poserFichier : racine « ${dans} » absente`);
  }
  const { nodeId } = await session.rpc('DOM.querySelector', { nodeId: racine, selector: selecteur });
  if (!nodeId) throw new Error(`poserFichier « ${selecteur} » : aucun input${dans ? ` dans « ${dans} »` : ''}`);
  const absolu = resolve(chemin);
  await session.rpc('DOM.setFileInputFiles', { nodeId, files: [absolu] });
  return absolu;
}

/**
 * VERDICT DE DÉBORDEMENT à la largeur courante — le contrôle le plus fréquent de la règle stricte 4
 * (« utilisable à 360 px ») : un écran qui déborde ne se voit pas sur une capture, il se MESURE.
 * Rend `{ vw, docSW, debordants }` : largeur du viewport, largeur du document (elles doivent être
 * ÉGALES — un `scrollWidth` plus grand = la page pousse latéralement), et les éléments dont le bord
 * droit dépasse le viewport, avec leur balise, leur nom accessible et leur bord droit.
 */
export async function verdictDebordement(session, { racine = 'body', marge = 1 } = {}) {
  return evaluate(session, `(() => {
    const vw = document.documentElement.clientWidth;
    const hote = document.querySelector(${JSON.stringify(racine)});
    const debordants = [];
    for (const el of (hote ? hote.querySelectorAll('*') : [])) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.right > vw + ${marge}) {
        debordants.push({
          tag: el.tagName.toLowerCase(),
          aria: el.getAttribute('aria-label') || (el.labels && el.labels[0] ? el.labels[0].textContent : '') || (el.className || '').toString().slice(0, 40),
          droite: Math.round(r.right),
        });
      }
    }
    return { vw, docSW: document.documentElement.scrollWidth, debordants: debordants.slice(0, 20) };
  })()`)
}

/**
 * ÉVALUE UNE FONCTION dans la page (`evaluerFn(session, (a, b) => …, a, b)`) — la sortie du piège du
 * DOUBLE ÉCHAPPEMENT : une expression passée à `evaluate` sous forme de chaîne traverse d'abord le
 * template literal de Node, où `\s` devient `s` (mesuré : `/\s+/` arrivé `/s+/` dans la page, 4 appels
 * perdus). Ici, le corps de la fonction est sérialisé tel qu'il est ÉCRIT (`fn.toString()`) et les
 * arguments passent par `JSON.stringify` : rien à ré-échapper.
 *
 * La fonction s'exécute DANS la page : elle ne capture RIEN de la portée du script (pas de closure) —
 * tout ce dont elle a besoin arrive par `args`, et son résultat doit être sérialisable en JSON.
 */
export async function evaluerFn(session, fn, ...args) {
  const appel = `(${fn.toString()}).apply(null, ${JSON.stringify(args)})`
  return evaluate(session, appel)
}

/**
 * Attend qu'un sélecteur soit PRÉSENT dans le DOM, et REFUSE en le nommant sinon — un `sleep` gonflé
 * « au cas où » cache la cause quand l'élément n'arrive jamais. Rend le sélecteur au succès.
 */
export async function attendreSelecteur(session, selecteur, { timeoutMs = 8000 } = {}) {
  const vu = await waitFor(session, `!!document.querySelector(${JSON.stringify(selecteur)})`, { timeoutMs })
    .then(() => true)
    .catch(() => false)
  if (!vu) throw new Error(`attendreSelecteur : « ${selecteur} » absent du DOM après ${timeoutMs} ms`)
  return selecteur
}

/** Table des touches courantes non imprimables (`key` DOM → code virtuel Windows CDP). */
const KEY_CODES = {
  Enter: 13, Escape: 27, Tab: 9, Backspace: 8, Delete: 46, ' ': 32, Space: 32,
  ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, Home: 36, End: 35,
  PageUp: 33, PageDown: 34,
};

/**
 * La TOUCHE, forme UNIQUE d'argument de la famille `realKey*` : `{ key, code?, windowsVirtualKeyCode?,
 * modifiers? }` — seul `key` est requis, `code` et le code virtuel se déduisent de lui quand l'appelant
 * ne les impose pas (`ALT` les impose, une touche nommée comme `Escape` non). C'est cette forme qui porte
 * les MODIFICATEURS, donc c'est elle que prennent les trois helpers : un recetteur qui lit l'un déduit
 * juste pour les deux autres.
 * @param {{ key: string, code?: string, windowsVirtualKeyCode?: number, modifiers?: number }} touche
 */
function champsCDP(touche) {
  // Le refus de FORME se NOMME : sans ce contrôle, une chaîne nue déréférence `.key` et le recetteur
  // lit une panne de propriété au lieu de la forme attendue.
  if (!touche || typeof touche !== 'object' || typeof touche.key !== 'string' || touche.key === '')
    throw new Error(
      'realKey* : la forme attendue est la TOUCHE { key, code?, windowsVirtualKeyCode?, modifiers? } — ' +
        `reçu ${JSON.stringify(touche)} (ex. { key: 'Escape' }).`,
    );
  const vk = touche.windowsVirtualKeyCode ?? KEY_CODES[touche.key] ?? (touche.key.length === 1 ? touche.key.toUpperCase().charCodeAt(0) : 0);
  return {
    key: touche.key,
    code: touche.code ?? (touche.key.length === 1 ? `Key${touche.key.toUpperCase()}` : touche.key),
    windowsVirtualKeyCode: vk,
    nativeVirtualKeyCode: vk,
    ...(touche.modifiers === undefined ? {} : { modifiers: touche.modifiers }),
  };
}

/**
 * Envoie une frappe RÉELLE (`Input.dispatchKeyEvent`, keyDown puis keyUp) — traverse les mêmes
 * handlers que le clavier physique (`keybindings.ts`), contrairement à un `KeyboardEvent` JS
 * synthétique (souvent ignoré par les listeners posés en natif sur `window`).
 * @param {{ key: string, code?: string, windowsVirtualKeyCode?: number, modifiers?: number }} touche
 */
export async function realKey(session, touche) {
  const common = champsCDP(touche);
  await session.rpc('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...common });
  if (touche.key.length === 1) await session.rpc('Input.dispatchKeyEvent', { type: 'char', text: touche.key, ...common });
  await session.rpc('Input.dispatchKeyEvent', { type: 'keyUp', ...common });
}

/** Alt GAUCHE, tel que CDP le nomme — la touche des gestes MAINTENUS du jeu (`decor.reveler`). */
export const ALT = { key: 'Alt', code: 'AltLeft', windowsVirtualKeyCode: 18 };
/** Bit de modificateur CDP pour Alt — à passer en `modifiers` aux gestes ÉMIS PENDANT le maintien. */
export const MOD_ALT = 1;

/**
 * APPUI et RELÂCHEMENT SÉPARÉS (`realKeyDown` / `realKeyUp`) — ce que `realKey` ne sait pas faire :
 * un geste MAINTENU (Alt tenu qui révèle les utilisables) dure entre les deux, et tout ce que la
 * recette fait dans l'intervalle doit porter le modificateur (`modifiers`), sans quoi les événements
 * émis déclareraient la touche relâchée et l'état tenu ne serait plus celui de l'écran.
 */
export async function realKeyDown(session, touche) {
  await session.rpc('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...champsCDP(touche) });
}

export async function realKeyUp(session, touche) {
  // Le relâchement ne porte aucun modificateur : c'est l'événement qui déclare la touche relâchée.
  await session.rpc('Input.dispatchKeyEvent', { type: 'keyUp', ...champsCDP({ ...touche, modifiers: undefined }) });
}

/**
 * SAISIE RÉELLE dans un champ (`session, selecteur, texte`) — le pendant clavier de
 * `clickButtonByText`, pour les formulaires que la recette doit remplir AUX GESTES (nom de joueur et
 * code de room du salon coop, `src/ui/CoopLobby.tsx`).
 *
 * Deux étages, tous deux CDP :
 *  1. FOCUS par un VRAI clic (`Input.dispatchMouseEvent` au centre du champ, après `scrollIntoView`) —
 *     la frappe va au champ FOCALISÉ, pas au sélecteur : sans ce clic, `Input.insertText` atterrit
 *     dans l'élément actif du moment (souvent `<body>`), sans erreur ni effet.
 *  2. `Input.insertText` — l'insertion passe par le pipeline d'ÉDITION du navigateur, donc l'`input`
 *     event porte la valeur native et le `onChange` React s'exécute. C'est ce qui la sépare d'un
 *     `evaluate()` + `.value = …`, qui écrit dans le DOM sans réveiller React (piège documenté dans
 *     `docs/recette-navigateur.md`, « Champ CONTRÔLÉ React »).
 *
 * MESURÉ sur le salon coop (Chrome headless du kit, 2026-08-13) : `.coop-code-input` frappé
 * `ab12cd` se lit `AB12CD` — la valeur est donc passée par le `onChange` React
 * (`e.target.value.toUpperCase()`, `CoopCodeInput` de `CoopPanels.tsx`), pas seulement par le DOM ; et le bouton
 * « Héberger », `disabled` tant que le nom est vide, s'arme après la frappe du champ de nom.
 *
 * `clear` (défaut) sélectionne le contenu existant (`select()` — une SÉLECTION, pas une écriture
 * d'état) pour que l'insertion le remplace ; un champ pré-rempli (code d'invitation `?join=`) se
 * réécrit ainsi sans `Backspace` répétés. Rend la valeur LUE dans le champ après la frappe.
 *
 * AUTO-CONTRÔLE : la valeur relue est comparée au texte demandé. Un `onChange` a le DROIT de la
 * transformer (le code de room passe en majuscules) — un écart n'est donc pas une erreur en soi, et
 * la comparaison par défaut AVERTIT sur `stderr` au lieu de jeter (`console.warn`). Ce qu'elle
 * attrape : la frappe ADDITIVE — un re-render entre `select()` et l'insertion perd la sélection, le
 * texte s'ajoute au lieu de remplacer (`AB12CDab12cd`), et sans ce contrôle seul l'appelant qui relit
 * s'en apercevrait. `attendu` (chaîne ou prédicat) durcit le contrôle en ERREUR quand le site connaît
 * la valeur exacte à obtenir.
 */
export async function typeInField(session, selecteur, texte, { clear = true, attendu, delaiCibleMs = DELAI_CIBLE_MS } = {}) {
  const rect = await chercherCible(session, `(() => {
    const el = document.querySelector(${JSON.stringify(selecteur)});
    if (!el) return null;
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`, delaiCibleMs);
  if (!rect) throw new Error(`typeInField : aucun élément ne matche « ${selecteur} » après ${delaiCibleMs} ms`);
  await clicReel(session, rect.x, rect.y);
  if (clear) await evaluate(session, `(() => { const el = document.querySelector(${JSON.stringify(selecteur)}); el.select ? el.select() : el.setSelectionRange(0, el.value.length); return true; })()`);
  await session.rpc('Input.insertText', { text: texte });
  const lu = await evaluate(session, `document.querySelector(${JSON.stringify(selecteur)}).value`);
  if (attendu !== undefined) {
    const ok = typeof attendu === 'function' ? attendu(lu) : lu === attendu;
    if (!ok) throw new Error(`typeInField « ${selecteur} » : champ à « ${lu} », attendu « ${attendu} » (frappé « ${texte} »)`);
  } else if (lu !== texte) {
    console.warn(`typeInField « ${selecteur} » : champ à « ${lu} » après avoir frappé « ${texte} » — transformation du onChange (casse, filtre) OU frappe additive : contrôler avant de continuer.`);
  }
  return lu;
}

/**
 * CLIC D'UNE CASE DE CONSOLE PAR SON ID D'ACTION (`data-action`, registre `src/data/actions.json`).
 * Le DOM de la console publie l'identité de chaque alvéole : la recette n'a donc plus à viser un
 * libellé (qui bouge avec la donnée) ni une position (qui bouge avec le set au poing).
 *
 * Trois refus EXPLICITES, jamais un clic silencieux qui « n'a rien fait » :
 *  - case ABSENTE (l'action n'est pas offerte dans cette situation) ;
 *  - case GATÉE (`data-gated`/`disabled`) — la RAISON affichée est remontée telle quelle, et le geste
 *    n'est pas forcé : un gate qui se déclenche est un RÉSULTAT de recette, pas un obstacle ;
 *  - case INERTE (`.cc-inert`, action `blocked` du registre) — dite comme telle.
 * Rend `{ actionId, label, rect }` au succès. Même dispatch souris réel que `clickButtonByText`.
 */
export async function cliquerAction(session, actionId, { racine = '.combat-console' } = {}) {
  const etat = await evaluate(session, `(() => {
    const el = document.querySelector(${JSON.stringify('%RACINE% [data-action="%ID%"]')});
    if (!el) {
      const offertes = Array.from(document.querySelectorAll(${JSON.stringify('%RACINE% [data-action]')})).map((b) => b.getAttribute('data-action'));
      return { absente: true, offertes };
    }
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const r = el.getBoundingClientRect();
    const raison = el.querySelector('[data-gate]');
    return {
      gate: el.hasAttribute('data-gated') ? (raison ? raison.textContent.trim() : '(sans raison affichée)') : null,
      inerte: el.classList.contains('cc-inert'),
      disabled: !!el.disabled,
      label: (el.getAttribute('aria-label') || el.textContent || '').trim(),
      x: r.x + r.width / 2, y: r.y + r.height / 2,
    };
  })()`.replace(/%RACINE%/g, racine).replace(/%ID%/g, actionId));
  if (!etat || etat.absente) {
    throw new Error(`cliquerAction « ${actionId} » : aucune case de console ne porte cet id — offertes : ${((etat && etat.offertes) || []).join(', ') || '(aucune)'}`);
  }
  if (etat.gate) throw new Error(`cliquerAction « ${actionId} » : case GATÉE — raison affichée : « ${etat.gate} » (geste non forcé)`);
  if (etat.inerte) throw new Error(`cliquerAction « ${actionId} » : case INERTE (action déclarée sans dispatcher au registre) — rien à cliquer`);
  if (etat.disabled) throw new Error(`cliquerAction « ${actionId} » : case DÉSACTIVÉE (${etat.label}) — la situation ne l'offre pas`);
  await clicReel(session, etat.x, etat.y);
  return { actionId, label: etat.label, rect: { x: etat.x, y: etat.y } };
}

/** Frappe RÉELLE d'une touche — alias FRANÇAIS de `realKey` (même geste, même pipeline CDP). */
export const frapperTouche = realKey;