// Socle de preuve navigateur headless (agents) — moissonné de scripts scratchpad ad hoc répétés
// (des-v5-verify.mjs, gallery-v2-tour.mjs, repro-399.mjs, dice-reduced-motion.mjs) : CDP nu sur
// Chrome, zéro dépendance nouvelle. Voir docs/recette-navigateur.md § « Preuve headless (agents) ».
import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync, appendFileSync, mkdirSync, existsSync, readdirSync, readFileSync, readlinkSync, rmSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
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

/** Liste `{ chemin, mtimeMs }` des fichiers surveillés sous `racine` (récursif, sans suivre `node_modules`).
 *  Un chemin ABSENT (`ENOENT`) se saute ; toute autre erreur de lecture remonte. */
export function fichiersSurveilles(racine, { stat = statSync, lister = readdirSync } = {}) {
  const trouves = [];
  const visiter = (chemin) => {
    let info;
    try {
      info = stat(chemin);
    } catch (e) {
      if (e.code === 'ENOENT') return;
      throw e;
    }
    if (info.isDirectory()) {
      for (const nom of lister(chemin)) visiter(join(chemin, nom));
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
const CHROME_WINDOWS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];
/** Racine des navigateurs Playwright quand `PLAYWRIGHT_BROWSERS_PATH` n'est pas posée. */
const RACINE_PLAYWRIGHT = '/opt/pw-browsers';

/**
 * Exécutable Chrome et arguments de lancement propres à la machine. Ordre : chemin `explicite` de
 * l'appelant, `CHROME_PATH`, chemins Windows présents (sur `win32` seulement : ailleurs ils se
 * résoudraient contre le dossier courant), puis le Chromium Playwright de plus haute
 * version sous `PLAYWRIGHT_BROWSERS_PATH` (défaut `/opt/pw-browsers`), trouvé par lecture du dossier
 * (`chromium-<N>/chrome-linux/chrome`). `--no-sandbox` en root seulement : Chromium refuse d'y
 * démarrer avec son bac à sable. PURE : `fs`, `uid` et `plateforme` injectés.
 * @param {{ explicite?: string, env: Record<string, string | undefined>, fs: { existe: (p: string) => boolean, lister: (d: string) => string[] }, uid?: number, plateforme: string }} o
 * @returns {{ chemin: string, args: string[] }}
 */
export function resoudreChrome({ explicite, env, fs, uid, plateforme }) {
  const args = uid === 0 ? ['--no-sandbox'] : [];
  const direct = explicite || env.CHROME_PATH;
  if (direct) return { chemin: direct, args };
  const windows = plateforme === 'win32' ? CHROME_WINDOWS.find((p) => fs.existe(p)) : undefined;
  if (windows) return { chemin: windows, args };
  const racine = env.PLAYWRIGHT_BROWSERS_PATH || RACINE_PLAYWRIGHT;
  const playwright = (fs.existe(racine) ? fs.lister(racine) : [])
    .map((d) => /^chromium-(\d+)$/.exec(d))
    .filter(Boolean)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map((m) => `${racine}/${m[0]}/chrome-linux/chrome`)
    .find((p) => fs.existe(p));
  if (playwright) return { chemin: playwright, args };
  throw new Error(
    `aucun Chrome trouvé — pose CHROME_PATH, ou installe Chrome (${CHROME_WINDOWS.join(', ')}) ` +
      `ou un Chromium Playwright (${racine}/chromium-*/chrome-linux/chrome)`,
  );
}

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
export function killChromeTree(chrome, { plateforme = process.platform, executer = spawnSync } = {}) {
  if (plateforme === 'win32' && chrome.pid) {
    const r = executer('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { encoding: 'utf8' });
    // 128 : aucun process de ce PID — l'arbre est déjà mort.
    if (r.error) throw r.error;
    if (r.status !== 0 && r.status !== 128) {
      throw new Error(`killChromeTree : taskkill /PID ${chrome.pid} a échoué (code ${r.status}) — ${String(r.stderr || r.stdout || '').trim()}`);
    }
  } else {
    chrome.kill();
  }
}

/**
 * Filet de sécurité process-wide : tout Chrome spawné par ce module qui survivrait à un chemin
 * d'échec non couvert (SIGINT, script tiers oubliant son try/finally) est tué + son profil purgé
 * à la sortie du process — jamais de fuite silencieuse. `process.on('exit')` est SYNCHRONE : on
 * ne peut pas y `await`, `rmSync` reste best-effort en une passe (pas de retry possible ici).
 */
const activeChildren = new Set();

/** Le filet de sortie sur `enfants` : chaque Chrome tué, chaque profil supprimé ; un échec est NOMMÉ
 *  (`signaler`) et n'arrête pas les suivants. Rend la liste des échecs. */
export function nettoyerALaSortie(enfants, { tuer = killChromeTree, supprimer = (p) => rmSync(p, { recursive: true, force: true }), signaler = (m) => console.error(m) } = {}) {
  const echecs = [];
  for (const { chrome, profile } of enfants) {
    for (const [quoi, geste] of [[`Chrome ${chrome.pid}`, () => tuer(chrome)], [`profil ${profile}`, () => supprimer(profile)]]) {
      try {
        geste();
      } catch (e) {
        echecs.push(`${quoi} : ${e.message}`);
        signaler(`recette — filet de sortie : ${quoi} non nettoyé — ${e.message}`);
      }
    }
  }
  return echecs;
}
process.on('exit', () => { nettoyerALaSortie(activeChildren); });

/** `resoudreChrome` sur le disque et l'environnement réels. */
const chromeDeLaMachine = (explicite) =>
  resoudreChrome({ explicite, env: process.env, fs: { existe: existsSync, lister: readdirSync }, uid: process.getuid?.(), plateforme: process.platform });

/** La CAUSE d'un échec de requête au serveur de dev, en clair (PURE) : connexion refusée (personne
 *  n'écoute) et réponse lente (le serveur écoute, la réponse ne vient pas) ne se soignent pas pareil. */
export function causeDeServeur(e) {
  const code = e?.cause?.code ?? e?.code;
  if (code === 'ECONNREFUSED') return `connexion REFUSÉE (aucun serveur n'écoute : lancer "npm run dev" dans CET arbre)`;
  if (e?.name === 'TimeoutError' || e?.name === 'AbortError') return 'réponse LENTE (le serveur écoute mais ne répond pas dans le délai : compilation Vite à froid, machine chargée — relever `timeoutMs`)';
  return `échec réseau : ${e?.message ?? e}${code ? ` (${code})` : ''}`;
}

/**
 * ATTEND que le serveur de dev réponde, `timeoutMs` au plus (friction #2290 : 35 s à 8 min à froid,
 * machine chargée). Une connexion refusée se retente tous les `pasMs` ; une requête en vol est bornée
 * par le temps qui reste. Rend la réponse ; à l'échéance, LÈVE en nommant la DERNIÈRE cause
 * (`causeDeServeur`, ou le statut HTTP). Le kit ne DÉMARRE jamais le serveur, il l'attend.
 */
export async function attendreServeur(url = DEFAULT_URL, { timeoutMs = 45000, pasMs = 1000, recuperer = fetch } = {}) {
  const fin = Date.now() + timeoutMs;
  let cause;
  for (;;) {
    // Minuteur ARMÉ (jamais `AbortSignal.timeout`, dont le minuteur ne tient pas le process en vie).
    const abandon = new AbortController();
    const minuteur = setTimeout(() => abandon.abort(Object.assign(new Error('délai écoulé'), { name: 'TimeoutError' })), Math.max(1, fin - Date.now()));
    try {
      const reponse = await recuperer(url, { signal: abandon.signal });
      if (reponse.ok) return reponse;
      cause = `réponse HTTP ${reponse.status}`;
    } catch (e) {
      cause = causeDeServeur(e);
    } finally {
      clearTimeout(minuteur);
    }
    if (Date.now() + pasMs >= fin) {
      throw new Error(
        `Serveur de dev indisponible sur ${url} après ${timeoutMs} ms — dernière cause : ${cause}. Le kit ` +
        `s'ATTACHE, il ne démarre rien ; le port est propre à l'arbre ; pour viser un autre serveur : ` +
        `WFRP_DEV_URL, ou --url.`,
      );
    }
    await sleep(pasMs);
  }
}

/**
 * Attend le serveur de dev (`attendreServeur`, `timeoutMs`) ET vérifie qu'il sert BIEN cet arbre
 * (#1679 L1c) — message d'aide sinon. `WFRP_RECETTE_ARBRE_LIBRE=1` lève le second contrôle pour les
 * cas où la cible est délibérément ailleurs (app déployée, tunnel) ; il reste actif par défaut.
 */
export async function checkServer(url = DEFAULT_URL, { recuperer = fetch, racineCourante = RACINE_COURANTE, timeoutMs = 45000, pasMs = 1000 } = {}) {
  const reponse = await attendreServeur(url, { timeoutMs, pasMs, recuperer });
  if (process.env.WFRP_RECETTE_ARBRE_LIBRE === '1') return;
  const refus = verdictArbreServi(reponse.headers?.get?.(ENTETE_RACINE), racineCourante);
  if (refus) throw new Error(`${refus} (URL interrogée : ${url})`);
}

/** URL WebSocket du NAVIGATEUR servi sur `port` (`/json/version`), attendue `timeoutMs` au plus. */
export async function waitForWsUrl(port, timeoutMs = 10000, { recuperer = fetch } = {}) {
  const deadline = Date.now() + timeoutMs;
  let dernier = null;
  while (Date.now() < deadline) {
    try {
      const r = await recuperer(`http://localhost:${port}/json/version`);
      const j = await r.json();
      if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl;
    } catch (e) {
      dernier = e;
    }
    await sleep(250);
  }
  throw new Error(`Chrome (CDP) indisponible sur le port ${port} après ${timeoutMs}ms.${dernier ? ` Dernier échec : ${dernier.message}` : ''}`, { cause: dernier ?? undefined });
}

/** Préfixe des profils Chrome JETABLES du kit, sous `os.tmpdir()` — la purge des orphelins le lit. */
export const PREFIXE_PROFIL = 'recette-cdp-profile-';

/** Nom d'un profil : il porte le PID du process qui lance Chrome (`p<pid>`), relu par
 *  `purgerProfilsOrphelins`. */
export const nomDeProfil = (pid) => `${PREFIXE_PROFIL}p${pid}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

/** Le PID consigné dans un nom de profil (`nomDeProfil`), ou `null` si le nom n'en porte pas. */
export function pidDeProfil(nom) {
  const m = new RegExp(`^${PREFIXE_PROFIL}p(\\d+)-`).exec(nom);
  return m ? Number(m[1]) : null;
}

/** Sous-dossier du profil jetable où Chrome dépose les téléchargements (`launchSession`). */
export const DOSSIER_TELECHARGEMENTS = 'telechargements';

/**
 * Le DERNIER fichier téléchargé par la page (`{ chemin, nom, contenu }`, contenu lu en UTF-8) : le
 * plus récent du dossier de téléchargements du profil que cette session n'a jamais rendu. Attend
 * `timeoutMs` qu'un fichier COMPLET arrive (aucun `.crdownload` en cours) ; à l'échéance, LÈVE en
 * nommant le dossier et les téléchargements encore en cours. Le dossier vit dans le profil jetable :
 * il est purgé avec lui (`purgerProfil`).
 */
export async function dernierTelechargement(session, { timeoutMs = 15000, pasMs = 200, disque = DISQUE } = {}) {
  if (!session.profile) throw new Error('dernierTelechargement : la session ne porte aucun profil (ni `launchSession`, ni `attacherSession`)');
  const dossier = join(session.profile, DOSSIER_TELECHARGEMENTS);
  session.telechargementsRendus ??= new Set();
  const fin = Date.now() + timeoutMs;
  for (;;) {
    const noms = disque.existe(dossier) ? disque.lister(dossier) : [];
    const enCours = noms.filter((n) => n.endsWith('.crdownload'));
    const neufs = noms.filter((n) => !n.endsWith('.crdownload') && !session.telechargementsRendus.has(n));
    if (neufs.length && !enCours.length) {
      const nom = neufs.map((n) => ({ n, t: disque.dater(join(dossier, n)) })).sort((a, b) => b.t - a.t)[0].n;
      session.telechargementsRendus.add(nom);
      const chemin = join(dossier, nom);
      return { chemin, nom, contenu: disque.lire(chemin) };
    }
    if (Date.now() >= fin) {
      throw new Error(`dernierTelechargement : aucun fichier téléchargé complet en ${timeoutMs} ms dans ${dossier}${enCours.length ? ` — en cours : ${enCours.join(', ')}` : ''}`);
    }
    await sleep(pasMs);
  }
}

/** Options de lancement de Chrome : JAMAIS `detached` — sous win32 l'arbre Chrome meurt avec le process
 *  qui l'a lancé (job object de libuv), donc un gardien tué ne laisse aucun Chrome orphelin (K9). */
export const OPTIONS_SPAWN_CHROME = Object.freeze({ stdio: 'ignore' });

/** Le disque réel, sous la forme que les purges injectables prennent (`purgerProfil`, `fermerSession`). */
export const DISQUE = Object.freeze({
  existe: existsSync,
  lister: readdirSync,
  lire: (chemin) => readFileSync(chemin, 'utf8'),
  dater: (chemin) => statSync(chemin).mtimeMs,
  ecrire: (chemin, contenu, { exclusif = false } = {}) => writeFileSync(chemin, contenu, { flag: exclusif ? 'wx' : 'w' }),
  lireLien: (chemin) => {
    try { return readlinkSync(chemin); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
  },
  supprimer: (chemin) => rmSync(chemin, { recursive: true, force: true }),
});

/** Codes d'une suppression REFUSÉE parce qu'un handle est encore tenu (Windows, après la mort de Chrome). */
const CODES_HANDLE_TENU = Object.freeze(['EBUSY', 'EPERM', 'ENOTEMPTY']);

/**
 * Supprime un profil temporaire CDP et VÉRIFIE qu'il n'existe plus : Windows retient des handles
 * quelques instants après la mort de Chrome (EBUSY/EPERM), on réessaie à pas croissants. Rend `true`
 * si le dossier est absent à la fin, `false` sinon — jamais une purge supposée.
 */
export async function purgerProfil(profil, { tentatives = 20, pasMs = 100, disque = DISQUE } = {}) {
  for (let i = 0; i < tentatives; i++) {
    try {
      disque.supprimer(profil);
    } catch (e) {
      if (!CODES_HANDLE_TENU.includes(e.code)) throw e;
    }
    if (!disque.existe(profil)) return true;
    await sleep(pasMs * (i + 1));
  }
  return !disque.existe(profil);
}

/** Attend la SORTIE du process Chrome (`exit`), `delaiMs` au plus : le profil se libère après elle. */
async function attendreSortie(chrome, delaiMs = 5000) {
  if (chrome.exitCode !== null || chrome.signalCode !== null) return;
  await new Promise((resolve) => {
    const fin = setTimeout(resolve, delaiMs);
    chrome.once('exit', () => { clearTimeout(fin); resolve(); });
  });
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
  const lancement = chromeDeLaMachine(chromePath);
  const cdpPort = port ?? 9222 + Math.floor(Math.random() * 2000);
  const profile = join(os.tmpdir(), nomDeProfil(process.pid));
  mkdirSync(profile, { recursive: true });
  const chrome = spawn(lancement.chemin, [
    ...lancement.args, '--headless=new', '--mute-audio', `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`, '--no-first-run', '--no-default-browser-check', 'about:blank',
  ], { ...OPTIONS_SPAWN_CHROME });
  const childEntry = { chrome, profile };
  activeChildren.add(childEntry);

  // Tout échec APRÈS le spawn (avant qu'un `session` ne soit rendu à l'appelant, donc avant qu'il
  // puisse appeler `session.close()`) doit tuer ce Chrome et purger son profil ici — sinon fuite.
  try {
    const wsUrl = await waitForWsUrl(cdpPort, timeoutMs); // même délai réglable que l’amorçage de l’app
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

    const session = brancherCdp(ws, { chrome, profile, port: cdpPort });

    const { targetId } = await session.rpc('Target.createTarget', { url: 'about:blank' });
    session.targetId = targetId;
    const { sessionId } = await session.rpc('Target.attachToTarget', { targetId, flatten: true });
    session.sessionId = sessionId;

    await session.rpc('Page.enable');
    await session.rpc('Runtime.enable');
    await session.rpc('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: 1, mobile,
    });
    // Les téléchargements vont DANS le profil jetable (`dernierTelechargement`) : purgés avec lui.
    const telechargements = join(profile, DOSSIER_TELECHARGEMENTS);
    mkdirSync(telechargements, { recursive: true });
    await session.rpcNavigateur('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: telechargements });

    /** Ferme le target CDP + tue le process Chrome + purge le profil temp (toujours appeler en fin de
     *  script). Rend `{ profilPurge }` : la purge est VÉRIFIÉE (`purgerProfil`), jamais supposée. */
    session.close = async () => {
      try {
        await session.rpc('Target.closeTarget', { targetId: session.targetId });
      } catch (e) {
        if (!cibleDejaPartie(e)) throw e;
      }
      ws.close();
      killChromeTree(chrome);
      await attendreSortie(chrome);
      const profilPurge = await purgerProfil(profile);
      activeChildren.delete(childEntry);
      return { profilPurge };
    };

    return session;
  } catch (e) {
    await leverApresNettoyage(e, async () => {
      killChromeTree(chrome);
      await attendreSortie(chrome);
      await purgerProfil(profile);
      activeChildren.delete(childEntry);
    });
  }
}

/** L'erreur PRINCIPALE et celle du NETTOYAGE qui l'a suivie, JOINTES (`AggregateError`, message et
 *  `code` de la principale en tête) : aucune n'avale l'autre. */
function joindre(principale, nettoyage) {
  const e = new AggregateError([principale, nettoyage], `${principale.message} — et le nettoyage a échoué : ${nettoyage.message}`, { cause: principale });
  if (principale.code) e.code = principale.code;
  if (principale.choix) e.choix = principale.choix;
  return e;
}

/** Après l'échec `principale`, joue `nettoyage()` puis LÈVE la principale — jointe (`joindre`) à
 *  l'échec du nettoyage s'il y en a un. */
export async function leverApresNettoyage(principale, nettoyage) {
  try {
    await nettoyage();
  } catch (n) {
    throw joindre(principale, n);
  }
  throw principale;
}

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
  const session = { ws, chrome: null, listeners, sessionId: null, targetId: null, profile: null, contextCleared: false, ...champs };
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
  session.rpc = (method, params = {}) => envoyer(method, params, session.sessionId);
  session.rpcNavigateur = (method, params = {}) => envoyer(method, params, null);
  return session;
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
    if (Date.now() >= deadline) throw Object.assign(new Error(`Condition jamais vraie après ${timeoutMs}ms : ${expression}`), { code: ATTENTE_ECHUE });
    await sleep(intervalMs);
  }
}

/** Code de l'erreur d'une attente (`waitFor`) arrivée à échéance sans que la condition soit vraie. */
export const ATTENTE_ECHUE = 'ATTENTE_ECHUE';

/** Marqueur DOM du MENU PRINCIPAL monté : la section « Atelier » (`src/ui/MainMenu.tsx`), rendue en
 *  dernier, qui porte « Scénarios de test ». */
export const MARQUEUR_MENU = '.menu-tools';

/** Expression d'app prête : `__wfrp.screen` posé par `installDevtools` (cf. `openApp`), ET, sur l'écran
 *  `menu`, le menu principal MONTÉ (`MARQUEUR_MENU`) — friction #2415 (c) : `__wfrp` prêt rendait la main
 *  avant le montage, et le premier clic de menu échouait. */
const APP_READY = `typeof window.__wfrp?.screen === 'function' && !!window.__game && (window.__game.getState().screen !== 'menu' || !!document.querySelector(${JSON.stringify(MARQUEUR_MENU)}))`;

/** Attend l'app pendant un rechargement : une évaluation qui échoue par NAVIGATION (`isNavigationError`)
 *  se relit ; toute autre erreur remonte. Rend `false` à l'échéance. */
export async function waitForAppSilently(session, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      if (await evaluate(session, APP_READY)) return true;
    } catch (e) {
      if (!isNavigationError(e)) throw e;
    }
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
 * `screen` (helper de navigation) ET, sur l'écran `menu`, le menu MONTÉ (`MARQUEUR_MENU`) plutôt que
 * la seule présence de `__wfrp` sous peine de courir après un objet encore partiel.
 *
 * Le défaut de `url` (`DEFAULT_URL`) est le port de CET arbre (`WFRP_DEV_URL`, sinon `urlDev()`,
 * `scripts/port-dev.mjs`).
 * `timeoutMs` (45 s) borne cette attente ET celle de l'URL CDP (`launchSession`) — un seul réglage
 * pour l'amorçage complet : un premier chargement à froid a été mesuré à 21 s sur un
 * worktree neuf (Vite compile la totalité du graphe à la première requête), là où le plafond de 10 s
 * d'origine rendait un refus qui accusait l'app. Le message DISTINGUE les deux causes : page qui n'a
 * pas répondu du tout (`__wfrp` absent — build cassé, mauvaise URL) et app trop lente à s'installer.
 *
 * `console` : `true` (ou `{ journal }`) pose `consoleGuard` AVANT `Page.navigate` — `session.console`.
 */
export async function openApp(url = DEFAULT_URL, { timeoutMs = 45000, console: consoleDesLAmorcage, ...opts } = {}) {
  await checkServer(url, { timeoutMs });
  const session = await launchSession({ ...opts, timeoutMs });
  try {
    // Console DÈS L'AMORÇAGE : le garde se pose AVANT la navigation, `Log` activé avec lui — une erreur
    // du chargement (module introuvable, 404, CSP) entre au verdict au lieu de passer avant le garde.
    if (consoleDesLAmorcage) {
      session.console = consoleGuard(session, consoleDesLAmorcage === true ? {} : consoleDesLAmorcage);
      await session.rpc('Log.enable');
    }
    await session.rpc('Page.navigate', { url });
    try {
      await waitFor(session, APP_READY, { timeoutMs });
    } catch (e) {
      const presence = await evaluate(session, `typeof window.__wfrp?.screen === 'function' ? 'installee' : typeof window.__wfrp`).catch((l) => `illisible (${l.message})`);
      throw new Error(
        presence === 'installee'
          ? `openApp : « ${url} » : l'app est installée mais le menu principal n'est pas monté en ${timeoutMs} ms (\`${MARQUEUR_MENU}\` absent du DOM sur l'écran \`menu\`).`
          : presence === 'object'
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
      try {
        await restaurerStockage(session, session.stockageInitial);
      } catch (e) {
        if (!isNavigationError(e)) await leverApresNettoyage(e, fermer);
      }
      return fermer();
    };
    return session;
  } catch (e) {
    await leverApresNettoyage(e, () => session.close());
  }
}

/**
 * RECHARGE la page (`Page.reload`) et attend l'app prête, menu monté (`APP_READY`) — jamais l'ancienne
 * page : un témoin posé avant le rechargement doit avoir DISPARU. Une évaluation qui échoue par
 * navigation se relit ; à l'échéance, LÈVE en le nommant.
 */
export async function rechargerEtAttendreMenu(session, { timeoutMs = 45000, pasMs = 250 } = {}) {
  await evaluate(session, 'window.__recetteAvantRechargement = true');
  await session.rpc('Page.reload', {});
  const fin = Date.now() + timeoutMs;
  for (;;) {
    try {
      if (await evaluate(session, `!window.__recetteAvantRechargement && (${APP_READY})`)) return;
    } catch (e) {
      if (!isNavigationError(e)) throw e;
    }
    if (Date.now() >= fin) throw new Error(`rechargerEtAttendreMenu : page rechargée sans app prête (menu \`${MARQUEUR_MENU}\` monté) en ${timeoutMs} ms`);
    await sleep(pasMs);
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
 * Par défaut, la capture ne CHANGE RIEN à l'état qu'elle capture (#2001 E : le retrait du focus
 * fermait le tiroir du journal avant la photo). La NEUTRALISATION se DEMANDE (`neutraliser: true`) :
 * le popup d'un `<select>` est NATIF (hors DOM) et reste ouvert au-dessus de la page après un
 * `selectOption` — `Escape` UNIQUEMENT quand le focus est sur un `<select>`, jamais à l'aveugle (une
 * modale capturée se fermerait sous elle) — puis le focus est retiré, dont l'anneau signe la capture.
 * Ce retrait MUTE l'écran : tout ce qui se ferme à la perte du focus se ferme avec lui.
 */
export async function shot(session, name, dir = process.cwd(), { ancre, neutraliser = false } = {}) {
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

/** Une entrée de console CDP → `{ type, source, text }`, ou `null` si le message n'en est pas une.
 *  `type` : niveau `Runtime` (`log`, `info`, `warning`, `error`, `debug`…), `exception`, ou niveau
 *  `Log` (`verbose`, `info`, `warning`, `error`) ; `source` : `runtime`, `exception` ou celle du `Log`
 *  (`network`, `security`…). PURE. */
export function entreeDeConsole(m) {
  if (m.method === 'Runtime.consoleAPICalled') {
    const text = (m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
    return { type: m.params.type, source: 'runtime', text };
  }
  if (m.method === 'Runtime.exceptionThrown') {
    const ex = m.params.exceptionDetails;
    return { type: 'exception', source: 'exception', text: ex.exception?.description || ex.text };
  }
  if (m.method === 'Log.entryAdded') {
    const e = m.params.entry;
    return { type: e.level, source: e.source, text: `${e.text}${e.url ? ` (${e.url})` : ''}` };
  }
  return null;
}

/** Les ERREURS d'une liste d'entrées (`error` de Runtime ou de Log, exceptions) — ce qui juge. */
export const erreursDe = (entries) => entries.filter((e) => e.type === 'error' || e.type === 'exception');
/** Les AVERTISSEMENTS (`warning`) — exportés : leur absence d'export n'est jamais un « zéro ». */
export const avertissementsDe = (entries) => entries.filter((e) => e.type === 'warning');

/**
 * Collecte la console de LA session courante, TOUS niveaux (`log` et `info` compris, avec leur
 * niveau), exceptions et entrées `Log` (réseau, 404, CSP, avertissements du navigateur). `errors()`
 * juge, `warnings()` se liste, `log`/`info` sont enregistrés sans juger.
 * Filtré par `sessionId` : le CDP multiplexe plusieurs sessions/onglets sur la même connexion, un
 * piège vécu en recette (buffer partagé, cf. docs/recette-navigateur.md « Pièges vécus »).
 * `journal` (chemin) : chaque entrée y est AJOUTÉE en une ligne JSON — le journal du gardien de
 * session, que les clients découpent par décalage (`attacherSession`).
 */
export function consoleGuard(session, { journal } = {}) {
  const entries = [];
  const handler = (m) => {
    if (m.sessionId !== session.sessionId) return;
    const e = entreeDeConsole(m);
    if (!e) return;
    entries.push(e);
    if (journal) appendFileSync(journal, `${JSON.stringify(e)}\n`);
  };
  session.listeners.add(handler);
  return {
    entries,
    errors: () => erreursDe(entries),
    warnings: () => avertissementsDe(entries),
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
    const note = (u) => {
      let url;
      try { url = String(u && u.url ? u.url : u); } catch (e) { url = '(URL illisible : ' + e.message + ')'; }
      window.__recetteReseau.push(url);
    };
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
 * Correspondance EXACTE par défaut : le texte ENTIER du bouton (espaces et apostrophes normalisés) —
 * une sous-chaîne trouvait cinq cibles pour « Atelier » et cliquait la première. `{ exact: false }`
 * DEMANDE la sous-chaîne, quand le libellé porte une partie variable (« Fin du tourAction non
 * dépensée »).
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
 *
 * `attendreChangement` (`true` = `DELAI_CHANGEMENT`, ou un délai en ms) : LÈVE si ni le DOM ni l'état
 * du store n'ont bougé dans le délai qui suit le clic (`avecEffet`) — un clic sans effet ne passe
 * plus en silence (friction #2290).
 *
 * Le texte cherché est confronté au NOM ACCESSIBLE du contrôle (`CORPS_NOM_ACCESSIBLE` : son texte,
 * sinon `aria-label`, sinon `title`) — un portrait `button.ptile` ou le bouton de carte du monde
 * n'ont aucun texte. `attenteMs` : l'attente d'un recouvrement transitoire (`controlerCible`).
 */
export async function clickButtonByText(session, texte, { exact = true, dans, rangee, modifiers = 0, attendreChangement = false, attenteMs = ATTENTE_CIBLE } = {}) {
  return avecEffet(session, `clickButtonByText « ${texte} »`, attendreChangement, () => cliquerParTexte(session, texte, { exact, dans, rangee, modifiers, attenteMs }));
}

/** Délai par défaut de `attendreChangement` (`clickButtonByText`, `cliquerSelecteur`). */
export const DELAI_CHANGEMENT = 2000;

/** Hachage (PURE, expression-fonction de page) d'une chaîne en court jeton base 36 — djb2 : les
 *  empreintes de page (`EMPREINTE_PAGE`, `expressionLectureModales`) se comparent, jamais se lisent. */
const FN_HACHER = `(s) => { let x = 5381; for (let i = 0; i < s.length; i++) x = ((x * 33) ^ s.charCodeAt(i)) >>> 0; return x.toString(36); }`;

/** Attributs de RENDU réécrits à chaque image, hors de tout geste : le compteur d'images et la file du
 *  cuiseur du canevas (`src/gameIso/stage/GameStage3D.tsx`, `canvas.dataset.rendus` / `.file`). Une
 *  empreinte qui les compterait bougerait sans clic. */
export const ATTRIBUTS_VOLATILS = Object.freeze(['data-rendus', 'data-file']);
const MOTIF_VOLATILS = `\\s(?:${ATTRIBUTS_VOLATILS.join('|')})="[^"]*"`;

/** EMPREINTE de la page (PURE, chaîne) : hachage du DOM (`body.innerHTML`, sans `ATTRIBUTS_VOLATILS`) et de l'état du store
 *  (`__game`, sérialisé) — deux empreintes égales = rien n'a bougé. Un état non sérialisable entre à
 *  l'empreinte par le message de son refus. */
const EMPREINTE_PAGE = `(() => {
  const hacher = ${FN_HACHER};
  let etat;
  try { etat = window.__game ? JSON.stringify(window.__game.getState()) : ''; } catch (e) { etat = '(état illisible : ' + e.message + ')'; }
  const dom = (document.body ? document.body.innerHTML : '').replace(new RegExp(${JSON.stringify(MOTIF_VOLATILS)}, 'g'), '');
  return hacher(dom) + ':' + hacher(etat);
})()`;

/** Joue `geste()` ; si `attendre` (`true` ou un délai en ms), relit l'empreinte de la page jusqu'à ce
 *  qu'elle diffère de celle d'AVANT le geste, et LÈVE au nom de `qui` à l'échéance. Rend le résultat
 *  du geste. */
async function avecEffet(session, qui, attendre, geste) {
  if (!attendre) return geste();
  const delai = attendre === true ? DELAI_CHANGEMENT : attendre;
  const avant = await evaluate(session, EMPREINTE_PAGE);
  const resultat = await geste();
  const fin = Date.now() + delai;
  for (;;) {
    if ((await evaluate(session, EMPREINTE_PAGE)) !== avant) return resultat;
    if (Date.now() >= fin) throw new Error(`${qui} : le clic n'a RIEN changé — ni le DOM ni l'état du store n'ont bougé en ${delai} ms`);
    await sleep(100);
  }
}

/** Le localisateur par TEXTE et son clic (`clickButtonByText`, sans l'attente d'effet). */
async function cliquerParTexte(session, texte, { exact, dans, rangee, modifiers, attenteMs }) {
  const jeton = nouveauJeton();
  const rect = await evaluate(session, `(() => {
    const norm = (s) => (s || '').replace(/\\s+/g, ' ').replace(/[\\u2019']/g, "'").trim();
    ${CORPS_NOM_ACCESSIBLE}
    const target = norm(${JSON.stringify(texte)});
    const racine = ${dans ? `document.querySelector(${JSON.stringify(dans)})` : 'document'};
    if (!racine) return null;
    const els = Array.from(racine.querySelectorAll(${JSON.stringify(SELECTEUR_CONTROLES)}));
    const libelles = els.filter((b) => ${exact} ? nomAccessible(b) === target : nomAccessible(b).includes(target));
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
    el.setAttribute('${ATTR_CIBLE}', ${JSON.stringify(jeton)});
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, textes: matches.slice(0, 5).map(nomAccessible) };
  })()`);
  if (!rect) throw new Error(`clickButtonByText : aucun bouton ne matche « ${texte} »${exact ? ' (texte EXACT)' : ''}${dans ? ` dans « ${dans} »` : ''}${rangee !== undefined ? ` dans la rangée « ${rangee} »` : ''}`);
  avertirAmbiguite(`clickButtonByText « ${texte} »`, rect.textes, 'Préciser avec { dans } ou { rangee } si ce n\'est pas celui-là.');
  await clicReel(session, rect.x, rect.y, modifiers, { cible: jeton, libelle: texte, attenteMs });
  return rect;
}

/** AVERTIT (`stderr`) qu'une désignation par TEXTE en vise plusieurs : le PREMIER est retenu, et les
 *  textes concurrents sont nommés — avertissement, jamais exception. Rend `true` s'il a averti. */
function avertirAmbiguite(qui, textes, precision) {
  if (!textes || textes.length < 2) return false;
  console.warn(`${qui} : ${textes.length} cibles matchent (${textes.join(' | ')}) — la PREMIÈRE est retenue. ${precision}`);
  return true;
}

/**
 * CLIC RÉEL d'un contrôle désigné par un SÉLECTEUR — le pendant de `clickButtonByText` quand le
 * contrôle n'a pas de texte (un bouton à GLYPHE : tiroir du journal, menu ☰, ouvreur d'écran).
 * SCROLL-AWARE comme ses frères (rect lu APRÈS `scrollIntoView`), et il REFUSE explicitement : cible
 * absente, boîte nulle, ou fermée (`clicReel`) — jamais un clic silencieux qui n'a rien fait.
 * `attendreChangement` : même option que `clickButtonByText` (`avecEffet`).
 * `attenteMs` borne l'APPARITION du sélecteur (`attendreSelecteur` : l'écran qu'un clic vient d'ouvrir
 * monte après lui) puis un recouvrement transitoire (`controlerCible`) ; la levée les nomme à l'échéance.
 * @returns {Promise<{ x: number, y: number, label: string }>}
 */
export async function cliquerSelecteur(session, selecteur, { modifiers = 0, attendreChangement = false, attenteMs = ATTENTE_CIBLE } = {}) {
  return avecEffet(session, `cliquerSelecteur « ${selecteur} »`, attendreChangement, () => cliquerParSelecteur(session, selecteur, { modifiers, attenteMs }));
}

/** Le localisateur par SÉLECTEUR et son clic (`cliquerSelecteur`, sans l'attente d'effet). */
async function cliquerParSelecteur(session, selecteur, { modifiers, attenteMs }) {
  await attendreSelecteur(session, selecteur, { timeoutMs: attenteMs, qui: 'cliquerSelecteur' });
  const jeton = nouveauJeton();
  const cible = await evaluate(session, `(() => {
    const el = document.querySelector(${JSON.stringify(selecteur)});
    if (!el) return null;
    el.scrollIntoView({ block: 'center', inline: 'center' });
    el.setAttribute('${ATTR_CIBLE}', ${JSON.stringify(jeton)});
    const r = el.getBoundingClientRect();
    return {
      x: r.x + r.width / 2, y: r.y + r.height / 2,
      vide: r.width === 0 || r.height === 0,
      label: (el.getAttribute('title') || el.getAttribute('aria-label') || el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 60),
    };
  })()`);
  if (!cible) throw new Error(`cliquerSelecteur « ${selecteur} » : aucun élément`);
  if (cible.vide) throw new Error(`cliquerSelecteur « ${selecteur} » : boîte de taille nulle (non rendu)`);
  await clicReel(session, cible.x, cible.y, modifiers, { cible: jeton, libelle: selecteur, attenteMs });
  return cible;
}

/** Les contrôles qu'un localisateur par TEXTE vise — SOURCE UNIQUE (`clickButtonByText`, `survoler`,
 *  `infobulleDe`) : un `<summary>` de `<details>` est un contrôle (« + Op mécanique », `AddMenu`). */
export const SELECTEUR_CONTROLES = 'button, [role="button"], summary';

/** Corps (PURE, `norm` en portée) : `nomAccessible(el)`, le NOM d'un contrôle désigné par texte — son
 *  texte, sinon `aria-label`, sinon `title` — SOURCE UNIQUE des localisateurs par TEXTE. */
const CORPS_NOM_ACCESSIBLE = "const nomAccessible = (b) => norm(b.textContent) || norm(b.getAttribute('aria-label')) || norm(b.getAttribute('title'));";

/** Attribut posé sur la CIBLE d'un clic par le helper qui l'a trouvée — `clicReel` le relit au point. */
const ATTR_CIBLE = 'data-recette-cible';
let compteurJetons = 0;
/** Jeton UNIQUE d'une cible de clic (marque posée par le localisateur, vérifiée par `clicReel`). */
const nouveauJeton = () => `c${process.pid}-${++compteurJetons}`;

/**
 * Expression du CONTRÔLE de cible (PURE) : la cible marquée `jeton` doit être OUVERTE (ni `disabled`, ni
 * `aria-disabled`, la forme de refus de `GatedAction`), et au point `(x, y)`, `document.elementFromPoint`
 * doit être elle ou un de ses descendants. Rend `null` si oui ; sinon `{ absente }`, `{ ferme, raison }`
 * (le mécanisme, et la raison affichée — `aria-describedby` ou `[data-gate]` — si elle existe) ou
 * `{ recouvre, boite }`. La marque est retirée, sauf sur un recouvrement : elle sert à la relecture.
 */
function expressionControleCible(jeton, x, y) {
  return `(() => {
    const c = document.querySelector('[${ATTR_CIBLE}=${JSON.stringify(jeton)}]');
    if (!c) return { absente: true };
    const verdict = (v) => { c.removeAttribute('${ATTR_CIBLE}'); return v; };
    const ferme = c.disabled ? 'disabled' : c.getAttribute('aria-disabled') === 'true' ? 'aria-disabled' : null;
    if (ferme) {
      const lien = c.getAttribute('aria-describedby');
      const porteur = (lien && document.getElementById(lien)) || c.querySelector('[data-gate]');
      const raison = porteur ? (porteur.textContent || '').replace(/\\s+/g, ' ').trim() : null;
      return verdict({ ferme, raison: raison || null });
    }
    const el = document.elementFromPoint(${x}, ${y});
    if (el && (el === c || c.contains(el))) return verdict(null);
    if (!el) return { recouvre: '(rien : point hors de la fenêtre)', boite: null };
    const r = el.getBoundingClientRect();
    const nom = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\\s+/).join('.') : '');
    const texte = (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 40);
    return { recouvre: nom + (texte ? ' « ' + texte + ' »' : ''), boite: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } };
  })()`;
}

/** Délai par défaut d'une ATTENTE de cible (`attenteMs` : apparition d'un sélecteur, recouvrement
 *  transitoire) — `attendreSelecteur`, `cliquerSelecteur`, `controlerCible`. */
export const ATTENTE_CIBLE = 8000;

/** CONTRÔLE de cible avant tout geste (`expressionControleCible`) : LÈVE, au nom du geste `qui`, si la
 *  cible marquée par le jeton est absente du DOM ou FERMÉE. Un RECOUVREMENT est relu jusqu'à
 *  `attenteMs` (la scène de dés `div.rm-scene` couvre la fenêtre le temps du roulis) ; à l'échéance,
 *  la levée nomme le DERNIER recouvreur — aucun événement émis. */
async function controlerCible(session, x, y, { cible, libelle = cible, qui = 'clicReel', attenteMs = ATTENTE_CIBLE }) {
  const echeance = Date.now() + attenteMs;
  let manque = await evaluate(session, expressionControleCible(cible, x, y));
  while (manque?.recouvre && Date.now() < echeance) {
    await sleep(100);
    manque = await evaluate(session, expressionControleCible(cible, x, y));
  }
  if (manque?.recouvre) await evaluate(session, `document.querySelector('[${ATTR_CIBLE}=${JSON.stringify(cible)}]')?.removeAttribute('${ATTR_CIBLE}')`);
  if (manque?.absente) throw new Error(`${qui} « ${libelle} » : la cible a quitté le DOM avant le geste — aucun événement émis`);
  if (manque?.ferme) {
    throw new Error(`${qui} « ${libelle} » : contrôle FERMÉ (${manque.ferme})${manque.raison ? ` — raison affichée : « ${manque.raison} »` : ' — aucune raison affichée'} — aucun événement émis`);
  }
  if (manque) {
    const b = manque.boite;
    throw new Error(`${qui} « ${libelle} » : au point (${Math.round(x)}, ${Math.round(y)}), ${manque.recouvre}${b ? ` (boîte ${b.x},${b.y} ${b.w}×${b.h})` : ''} RECOUVRE la cible, toujours après ${attenteMs} ms — aucun événement émis`);
  }
}

/** Clic RÉEL (CDP) au point donné — le geste de clic UNIQUE de ce module : tout helper qui clique
 *  passe ici, aucun ne réécrit la triade `mouseMoved`/`mousePressed`/`mouseReleased`.
 *  `cible` (jeton posé par le localisateur) : AVANT d'émettre quoi que ce soit, le point doit atteindre
 *  la cible ou un de ses descendants — sinon le clic LÈVE en nommant ce qui recouvre (#2220 : une barre
 *  de groupe recouvrait l'onglet visé, et le clic partait en silence sur elle).
 *  `bouton` (`left`, `right`, `middle`) : le bouton pressé ; `dureeMs` : le temps TENU entre l'appui
 *  et le relâchement (appui long) ; `attenteMs` : l'attente d'un recouvrement transitoire (`controlerCible`). */
export async function clicReel(session, x, y, modifiers = 0, { cible, libelle = cible, bouton = 'left', dureeMs = 0, attenteMs = ATTENTE_CIBLE } = {}) {
  if (cible) await controlerCible(session, x, y, { cible, libelle, attenteMs });
  await session.rpc('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, modifiers });
  await session.rpc('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: bouton, clickCount: 1, modifiers });
  if (dureeMs > 0) await sleep(dureeMs);
  await session.rpc('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: bouton, clickCount: 1, modifiers });
}

/** Corps (PURE) qui RÉSOUT la cible d'un geste dans la page en `el` : un SÉLECTEUR CSS, sinon le NOM
 *  ACCESSIBLE exact (`CORPS_NOM_ACCESSIBLE`) d'un contrôle (`SELECTEUR_CONTROLES`, espaces et apostrophes normalisés) — `null` si rien. */
const corpsResoudreCible = (cible) => `
    const norm = (s) => (s || '').replace(/\\s+/g, ' ').replace(/[\\u2019']/g, "'").trim();
    const cible = ${JSON.stringify(cible)};
    let el = null;
    try { el = document.querySelector(cible); } catch (e) { if (e.name !== 'SyntaxError') throw e; }
    ${CORPS_NOM_ACCESSIBLE}
    if (!el) el = Array.from(document.querySelectorAll(${JSON.stringify(SELECTEUR_CONTROLES)})).find((b) => nomAccessible(b) === norm(cible)) || null;`;

/**
 * LOCALISE la cible d'un geste (`corpsResoudreCible`) : `{ x, y }`, centre de sa boîte. `defiler`
 * (défaut) la fait d'abord défiler en vue (`scrollIntoView`) ; `jeton` la MARQUE pour le contrôle de
 * `clicReel`/`controlerCible`. LÈVE au nom du geste `qui` si la cible est absente ou sans boîte.
 */
async function localiserCible(session, cible, { defiler = true, jeton, qui }) {
  const point = await evaluate(session, `(() => {${corpsResoudreCible(cible)}
    if (!el) return null;
    if (${defiler}) el.scrollIntoView({ block: 'center', inline: 'center' });
    ${jeton ? `el.setAttribute('${ATTR_CIBLE}', ${JSON.stringify(jeton)});` : ''}
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), vide: r.width === 0 || r.height === 0 };
  })()`);
  if (!point) throw new Error(`${qui} : aucune cible « ${cible} » (sélecteur ni texte de contrôle)`);
  if (point.vide) throw new Error(`${qui} « ${cible} » : boîte de taille nulle (non rendu — dans un <details> replié ? \`deplierVers\`) — aucun événement émis`);
  return { x: point.x, y: point.y };
}

/** CLIC DROIT réel sur une cible (sélecteur ou texte de contrôle), contrôlé comme `clicReel` : le
 *  navigateur en tire le `contextmenu`. Rend le point. */
export async function clicDroit(session, cible, { defiler = true, modifiers = 0 } = {}) {
  const jeton = nouveauJeton();
  const point = await localiserCible(session, cible, { defiler, jeton, qui: 'clicDroit' });
  await clicReel(session, point.x, point.y, modifiers, { cible: jeton, libelle: cible, bouton: 'right' });
  return point;
}

/** APPUI LONG réel à la souris : bouton gauche TENU `ms` millisecondes sur la cible, contrôlé comme
 *  `clicReel`. Rend le point. */
export async function appuiLong(session, cible, ms = 800, { defiler = true, modifiers = 0 } = {}) {
  const jeton = nouveauJeton();
  const point = await localiserCible(session, cible, { defiler, jeton, qui: 'appuiLong' });
  await clicReel(session, point.x, point.y, modifiers, { cible: jeton, libelle: cible, dureeMs: ms });
  return point;
}

/**
 * TOUCHER réel (`Input.dispatchTouchEvent` : `touchStart`, puis `touchEnd` après `dureeMs`) sur une
 * cible, contrôlée comme `clicReel`. LIMITE mesurée (#1822) : l'émulation tactile du CDP n'émet ni
 * `contextmenu` ni `pointercancel` pendant un appui long — l'ordre de ces événements sur Android ne se
 * recette pas ici. Rend le point.
 */
export async function toucher(session, cible, { dureeMs = 0, defiler = true } = {}) {
  const jeton = nouveauJeton();
  const point = await localiserCible(session, cible, { defiler, jeton, qui: 'toucher' });
  await controlerCible(session, point.x, point.y, { cible: jeton, libelle: cible, qui: 'toucher' });
  await session.rpc('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y }] });
  if (dureeMs > 0) await sleep(dureeMs);
  await session.rpc('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  return point;
}

/** Point VISIBLE d'un élément (PURE, corps de page) : le centre de l'intersection de sa boîte avec la
 *  fenêtre, ou `null` s'il n'en montre rien. */
const corpsPointVisible = `
    const r = el.getBoundingClientRect();
    const g = Math.max(r.left, 0), d = Math.min(r.right, window.innerWidth), h = Math.max(r.top, 0), b = Math.min(r.bottom, window.innerHeight);
    const visible = d > g && b > h ? { x: Math.round((g + d) / 2), y: Math.round((h + b) / 2) } : null;`;

/**
 * MOLETTE RÉELLE (`Input.dispatchMouseEvent mouseWheel`) de `deltaY` px sur une cible (sélecteur ou
 * texte de contrôle), au centre de sa partie VISIBLE — sans `scrollIntoView` : c'est la molette qui
 * fait défiler, comme celle d'un joueur. LÈVE si la cible ne montre rien dans la fenêtre. Rend le point.
 */
export async function molette(session, cible, deltaY, { deltaX = 0 } = {}) {
  const point = await evaluate(session, `(() => {${corpsResoudreCible(cible)}
    if (!el) return { absente: true };${corpsPointVisible}
    return visible ?? { hors: true };
  })()`);
  if (point.absente) throw new Error(`molette : aucune cible « ${cible} » (sélecteur ni texte de contrôle)`);
  if (point.hors) throw new Error(`molette « ${cible} » : la cible ne montre rien dans la fenêtre — aucun cran émis`);
  await session.rpc('Input.dispatchMouseEvent', { type: 'mouseWheel', x: point.x, y: point.y, deltaX, deltaY });
  return point;
}

/**
 * AMÈNE `selecteur` à l'écran par la MOLETTE : chaque cran (`pasPx` au plus) tourne au-dessus de son
 * conteneur défilant le plus proche (la fenêtre à défaut), vers lui, jusqu'à ce qu'il tienne dans la
 * partie visible du conteneur. LÈVE en le nommant : élément absent, boîte nulle (non rendu), molette
 * qui ne fait plus défiler, ou `maxPas` crans épuisés. Rend le centre de l'élément.
 */
async function amenerParMolette(session, selecteur, { pasPx = 240, maxPas = 40, pauseMs = 80 } = {}) {
  let ecartPrecedent = null;
  for (let k = 0; ; k++) {
    const m = await evaluate(session, `(() => {
      const el = document.querySelector(${JSON.stringify(selecteur)});
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return { vide: true };
      let c = el.parentElement;
      while (c && c !== document.body && c !== document.documentElement) {
        const oy = getComputedStyle(c).overflowY;
        if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && c.scrollHeight > c.clientHeight) break;
        c = c.parentElement;
      }
      const conteneur = c && c !== document.body && c !== document.documentElement ? c.getBoundingClientRect() : null;
      const haut = Math.max(conteneur ? conteneur.top : 0, 0), bas = Math.min(conteneur ? conteneur.bottom : window.innerHeight, window.innerHeight);
      const gauche = Math.max(conteneur ? conteneur.left : 0, 0), droite = Math.min(conteneur ? conteneur.right : window.innerWidth, window.innerWidth);
      const cy = r.top + r.height / 2;
      const visible = r.height <= bas - haut ? r.top >= haut && r.bottom <= bas : cy >= haut && cy <= bas;
      return { visible, x: r.x + r.width / 2, y: cy, ecart: cy - (haut + bas) / 2, molette: { x: Math.round((gauche + droite) / 2), y: Math.round((haut + bas) / 2) } };
    })()`);
    if (!m) throw new Error(`deplierVers : « ${selecteur} » absent du DOM`);
    if (m.vide) throw new Error(`deplierVers : « ${selecteur} » a une boîte nulle (non rendu) — aucun cran émis`);
    if (m.visible) return { x: m.x, y: m.y };
    if (ecartPrecedent !== null && Math.abs(m.ecart - ecartPrecedent) < 1) {
      throw new Error(`deplierVers : la molette ne fait plus défiler vers « ${selecteur} » (écart figé à ${Math.round(m.ecart)} px)`);
    }
    if (k >= maxPas) throw new Error(`deplierVers : « ${selecteur} » toujours hors de vue après ${maxPas} crans de molette`);
    ecartPrecedent = m.ecart;
    await session.rpc('Input.dispatchMouseEvent', { type: 'mouseWheel', x: m.molette.x, y: m.molette.y, deltaX: 0, deltaY: Math.sign(m.ecart) * Math.min(pasPx, Math.abs(m.ecart)) });
    await sleep(pauseMs);
  }
}

/**
 * DÉPLIE vers `selecteur` comme un joueur : chaque `<details>` FERMÉ qui l'enveloppe s'ouvre, du plus
 * extérieur au plus intérieur, par un CLIC RÉEL sur son `<summary>` (amené à l'écran par la molette) ;
 * puis `selecteur` est amené à l'écran par la molette (`amenerParMolette`) — jamais `scrollIntoView`,
 * qui ne ramène pas un champ d'un `<details>` replié (#1853 L3). LÈVE si un `<details>` n'a pas de
 * `<summary>`, ou si le clic n'ouvre pas le sien. Rend le centre de `selecteur`.
 */
export async function deplierVers(session, selecteur, options = {}) {
  let precedent = null;
  for (;;) {
    const jeton = nouveauJeton();
    const r = await evaluate(session, `(() => {
      const el = document.querySelector(${JSON.stringify(selecteur)});
      if (!el) return { absente: true };
      let ferme = null;
      for (let a = el.parentElement; a; a = a.parentElement) if (a.tagName === 'DETAILS' && !a.open) ferme = a;
      if (!ferme) return { deplie: true };
      const s = Array.from(ferme.children).find((x) => x.tagName === 'SUMMARY');
      if (!s) return { sansSommaire: true };
      s.setAttribute('${ATTR_CIBLE}', ${JSON.stringify(jeton)});
      return { sommaire: (s.textContent || '').replace(/\\s+/g, ' ').trim() };
    })()`);
    if (r.absente) throw new Error(`deplierVers : « ${selecteur} » absent du DOM`);
    if (r.deplie) return amenerParMolette(session, selecteur, options);
    if (r.sansSommaire) throw new Error(`deplierVers « ${selecteur} » : un <details> fermé qui l'enveloppe n'a aucun <summary> à cliquer`);
    if (r.sommaire === precedent) throw new Error(`deplierVers « ${selecteur} » : le clic sur « ${r.sommaire} » n'a pas ouvert son <details>`);
    precedent = r.sommaire;
    const point = await amenerParMolette(session, `[${ATTR_CIBLE}=${JSON.stringify(jeton)}]`, options);
    await clicReel(session, point.x, point.y, 0, { cible: jeton, libelle: r.sommaire });
    await sleep(options.pauseMs ?? 80);
  }
}

/**
 * Libellés d'AVANCEMENT d'une cascade de fenêtres, par ordre de préférence : ils font AVANCER une
 * cérémonie déjà décidée (lancer, appliquer, fermer). Aucun libellé de RÈGLE ici (ni « Parade », ni
 * « Esquive ») : un CHOIX de joueur ne se résout pas par un cas nommé dans une liste de recette, il
 * se résout par sa forme — cf. `resoudreModales`.
 */
export const CASCADE_LABELS = ['Tout lancer', 'Commencer', 'Lancer', 'Continuer', 'Appliquer', 'Conclure', 'Poser la zone', 'Poursuivre', 'Suivant', 'Valider', 'Terminer', 'Fermer'];

/** Libellés qui QUITTENT une fenêtre sans la trancher : jamais le geste d'une fenêtre à CHOIX. */
const LABELS_DE_SORTIE = Object.freeze(['Fermer']);

/** Le PREMIER des `libelles` (ordre de préférence) que porte un des `offerts` (sous-chaîne), ou `null`. */
const premierLibelleOffert = (libelles, offerts) => libelles.map((l) => offerts.find((t) => t.includes(l))).find(Boolean) ?? null;

/** Expression (PURE) : textes des contrôles OUVERTS (`SELECTEUR_CONTROLES`) sous `dans`. */
const expressionControlesOuverts = (dans) => `(() => {
  const racine = document.querySelector(${JSON.stringify(dans)});
  if (!racine) return [];
  const ouvert = (b) => !b.disabled && b.getAttribute('aria-disabled') !== 'true';
  return [...racine.querySelectorAll(${JSON.stringify(SELECTEUR_CONTROLES)})].filter(ouvert).map((b) => (b.textContent || '').replace(/\\s+/g, ' ').trim()).filter(Boolean);
})()`;

/**
 * CLIQUE le premier des `libelles` (ordre de préférence) qu'offre un contrôle OUVERT de `dans` — le
 * geste d'une fenêtre qu'on fait avancer, quitte ou referme par la liste de ses issues. `offerts` :
 * les textes déjà lus par l'appelant (sinon lus ici). Rend le texte cliqué ; sans aucun libellé
 * offert, LÈVE en nommant les contrôles ouverts — aucun clic émis. `attenteMs` : l'attente d'un
 * recouvrement transitoire (`controlerCible`).
 */
export async function cliquerPremierOffert(session, libelles, { dans = '.modal-overlay', offerts, attenteMs = ATTENTE_CIBLE } = {}) {
  const textes = offerts ?? await evaluate(session, expressionControlesOuverts(dans));
  const texte = premierLibelleOffert(libelles, textes);
  if (!texte) {
    throw new Error(`cliquerPremierOffert : aucun de « ${libelles.join(' | ')} » parmi les contrôles ouverts de « ${dans} » — offerts : ${textes.join(' | ') || '(aucun)'}`);
  }
  await clickButtonByText(session, texte, { dans, attenteMs });
  return texte;
}

/**
 * RÉSOUT toute fenêtre ouverte (`.modal-overlay`) par ses VRAIS boutons, jusqu'à ce qu'il n'y en ait
 * plus — DÉFINITION UNIQUE, partagée par les sondes de recette.
 * Deux gestes, dans cet ordre :
 *  1. un bouton d'AVANCEMENT ouvert (`labels`, `cliquerPremierOffert`) — jamais un libellé de sortie
 *     (`LABELS_DE_SORTIE`) dans une fenêtre à choix. L'avancement PRIME : un groupe d'options
 *     FACULTATIF sans défaut (réaction Porte-Bouclier de la Défense, `useDefenseJetProps`) n'est jamais
 *     tranché à la place du joueur quand la fenêtre peut avancer sans lui ;
 *  2. sinon, la PREMIÈRE option OUVERTE d'un groupe d'options (`OptionChooser` : `.seg`,
 *     `.rm-loc-grid`) dont aucune option n'est retenue (`aria-pressed`) — une fenêtre qui ne peut
 *     avancer qu'une fois TRANCHÉE. La recette tranche par la FORME du contrôle, jamais par le nom
 *     d'une règle.
 * CHOISIR N'EST PAS AVANCER (#2306 B) : après le clic d'une option, la fenêtre est RELUE ; un bouton
 * d'avancement ouvert est pris, même si l'option reste offerte (« Dévier (−1 PA) » d'une Blessure
 * critique). La levée « l'option ne fait pas avancer » ne juge que l'option ELLE-MÊME : deux clics dont
 * l'empreinte (état des options, longueur du journal, `pendingCascade`) est restée IDENTIQUE — jamais
 * des boutons identiques.
 * Rend la liste des CHOIX faits à la place du joueur, `[{ fenetre, option, offertes }]` (fenêtre =
 * nom accessible du dialogue), pour qu'une recette les asserte ; chacun est imprimé une fois son clic
 * émis. Une LEVÉE porte les choix faits jusque-là (`erreur.choix`, `porterChoix`).
 * Lève, en nommant les boutons offerts, si aucun des deux gestes ne s'applique.
 * Lève tant qu'un GESTE SUR LA CARTE est attendu (`__wfrp.gesteCarteAttendu`, #2306 A) : pose de zone,
 * visée de siège, choix de cibles — la fenêtre est masquée, la levée NOMME le geste
 * (`GESTES_CARTE`), et le résolveur ne rend jamais la main tant que la carte attend.
 *
 * `arret(identite)` : consulté à CHAQUE lecture avec l'identité de la fenêtre ouverte
 * (`IDENTITE_FENETRE` : `{ cle, jet, etape, nom }`) ; vrai = rendre la main, fenêtre laissée OUVERTE —
 * une recette s'arrête ainsi sur la modale qu'elle vise (Défense : `jet === 'defense'`).
 *
 * La fin se juge au STORE, pas au DOM : tant qu'une étape de cascade est en cours (`pendingCascade`),
 * sa fenêtre va monter — la carte d'entrée de scène (`startScene`, `store.ts`) attend le montage du
 * monde.
 *
 * UNE SEULE HORLOGE D'ATTENTE : une lecture qui n'offre RIEN à résoudre — étape au store sans fenêtre,
 * OU fenêtre au DOM sans bouton d'avancement ni option ouverte (état transitoire : un roulis de dés
 * désactive ses boutons ~750 ms, une cascade Surprise passe de « Tout lancer » à « Terminer ») — est
 * RELUE pendant `attenteMs`. À l'échéance, la levée nomme la DERNIÈRE lecture : étape, fenêtre, et
 * chaque bouton avec son état (désactivés compris). Le même `attenteMs` borne l'attente d'un bouton
 * RECOUVERT le temps du roulis (`controlerCible`).
 */
export async function resoudreModales(session, etape = 'resoudreModales', options = {}) {
  const choix = [];
  try {
    return await resoudreEnCumulant(session, etape, options, choix);
  } catch (e) {
    throw porterChoix(e, choix);
  }
}

/** Attache à la levée `e` les CHOIX faits jusque-là (`e.choix`, copie) et la rend. */
export function porterChoix(e, choix) {
  if (e instanceof Error) e.choix = [...choix];
  return e;
}

/** Le corps de `resoudreModales` : CUMULE ses choix dans `choix`, que l'appelant garde à la levée. */
async function resoudreEnCumulant(session, etape, { labels = CASCADE_LABELS, max = 40, pauseMs = 600, attenteMs = 30000, arret } = {}, choix) {
  let apresOption = null;
  let immobile = 0;
  let attenteDepuis = null;
  for (let i = 0; i < max; ) {
    const jeton = nouveauJeton();
    const lecture = await evaluate(session, expressionLectureModales(jeton));
    if (!lecture) return choix;
    if (arret && lecture.identite && arret(lecture.identite)) return choix;
    if (lecture.gesteCarte) {
      const g = lecture.gesteCarte;
      throw new Error(`[${etape}] ${GESTES_CARTE[g.kind] ?? `geste carte « ${g.kind} » en cours`} — « ${g.label} » (lanceur ${g.casterId}) : la fenêtre est masquée, la carte attend son geste (\`__wfrp.tileScreenPos\` puis \`clicReel\`), puis relancer`);
    }
    const ouverts = lecture.boutons.filter((b) => b.ouvert).map((b) => b.texte);
    const option = lecture.modale ? lecture.option : null;
    const permis = lecture.aChoix ? labels.filter((l) => !LABELS_DE_SORTIE.includes(l)) : labels;
    const avancement = lecture.modale ? premierLibelleOffert(permis, ouverts) : null;
    const geste = avancement ? 'avancer' : option ? 'choisir' : null;
    if (!geste) {
      attenteDepuis ??= Date.now();
      if (Date.now() - attenteDepuis > attenteMs) {
        throw new Error(`[${etape}] rien à résoudre après ${attenteMs} ms — dernière lecture : ${decrireLectureModales(lecture)}`);
      }
      await sleep(pauseMs);
      continue;
    }
    attenteDepuis = null;
    i += 1;
    if (geste === 'avancer') {
      apresOption = null;
      immobile = 0;
      // L'option marquée par la lecture n'est pas le geste : sa marque est retirée avant le clic.
      if (option) await evaluate(session, `document.querySelector('[${ATTR_CIBLE}=${JSON.stringify(jeton)}]')?.removeAttribute('${ATTR_CIBLE}')`);
      await cliquerPremierOffert(session, permis, { offerts: ouverts, attenteMs });
    } else {
      immobile = apresOption && option.texte === apresOption.texte && lecture.empreinte === apresOption.empreinte ? immobile + 1 : 0;
      if (immobile >= 2) {
        throw new Error(`[${etape}] l'option « ${option.texte} » ne fait pas avancer la fenêtre `
          + `(${immobile} clics sans rien changer : options, journal, étape de cascade) — dernière lecture : ${decrireLectureModales(lecture)}`);
      }
      apresOption = { texte: option.texte, empreinte: lecture.empreinte };
      await clicReel(session, option.x, option.y, 0, { cible: jeton, libelle: option.texte, attenteMs });
      choix.push({ fenetre: lecture.fenetre, option: option.texte, offertes: option.offertes });
      console.log(`[${etape}] fenêtre de CHOIX « ${lecture.fenetre ?? '?'} » : première option ouverte — « ${option.texte} » (offertes : ${option.offertes.join(' | ')})`);
    }
    await sleep(pauseMs);
  }
  throw new Error(`[${etape}] les fenêtres ne se referment pas après ${max} avancements`);
}

/** Le geste NOMMÉ de chaque `kind` de `__wfrp.gesteCarteAttendu` (`GesteCarteAttendu`, `src/state/devtools.ts`). */
export const GESTES_CARTE = Object.freeze({
  zone: 'pose de zone en cours, cliquer une case',
  siege: 'visée de siège en cours, cliquer une case',
  cibles: 'choix de cibles en cours, cliquer les cibles',
});

/**
 * IDENTITÉ de la fenêtre ouverte (PURE, expression-fonction de l'état du store) — `null` sans modale
 * élue, sans étape de cascade ni fenêtre au DOM, sinon `{ cle, jet, etape, nom }` : `cle` = l'entrée
 * élue par l'arbitre des modales (`__wfrp.auto().activeModal`, registre `src/state/modalArbiter.ts`),
 * `jet` et `etape` = le `jet` et le `kind` de l'étape de cascade courante (`defense`/`defenseJet`
 * pour une Défense), `nom` = le nom accessible du dialogue.
 */
export const IDENTITE_FENETRE = `((st) => {
  const pc = st.pendingCascade;
  const cur = pc ? pc.participants[pc.cursor] : null;
  const auto = window.__wfrp && typeof window.__wfrp.auto === 'function' ? window.__wfrp.auto() : null;
  const cle = auto && auto.activeModal ? auto.activeModal : null;
  const modale = document.querySelector('.modal-overlay');
  if (!cle && !cur && !modale) return null;
  const dialogue = modale ? modale.querySelector('[role="dialog"]') : null;
  const titre = dialogue && dialogue.getAttribute('aria-labelledby') ? document.getElementById(dialogue.getAttribute('aria-labelledby')) : null;
  const nom = ((dialogue ? dialogue.getAttribute('aria-label') || (titre && titre.textContent) : '') || '').replace(/\\s+/g, ' ').trim() || null;
  return { cle, jet: cur && cur.jet ? cur.jet : null, etape: cur && cur.kind ? cur.kind : null, nom };
})`;

/** Expression de LECTURE des fenêtres (PURE) : `null` s'il n'y a ni fenêtre ni étape au store, sinon
 *  `{ modale, fenetre, enCours, gesteCarte, boutons: [{ texte, ouvert }], option, aChoix, identite,
 *  empreinte }` — contrôles lus par `SELECTEUR_CONTROLES` ; l'option à choisir est MARQUÉE `jeton`, avec
 *  ses `offertes` (les options ouvertes de son groupe) ; `identite` = `IDENTITE_FENETRE` ; `empreinte` =
 *  hachage de l'état des options, de la longueur du journal et de `pendingCascade` (`resoudreModales`). */
function expressionLectureModales(jeton) {
  return `(() => {
    const st = window.__game.getState();
    const pc = st.pendingCascade;
    const enCours = pc ? String(pc.participants[pc.cursor]?.reveal?.kind ?? pc.participants[pc.cursor]?.kind ?? pc.purpose ?? '?') : null;
    const gesteCarte = window.__wfrp.gesteCarteAttendu();
    const identite = (${IDENTITE_FENETRE})(st);
    const modale = document.querySelector('.modal-overlay');
    if (!modale) return pc || gesteCarte ? { modale: false, fenetre: null, enCours, gesteCarte, boutons: [], option: null, aChoix: false, identite, empreinte: null } : null;
    const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
    const ouvert = (b) => !b.disabled && b.getAttribute('aria-disabled') !== 'true';
    const controles = (racine) => [...racine.querySelectorAll(${JSON.stringify(SELECTEUR_CONTROLES)})];
    const boutons = controles(modale).map((b) => ({ texte: norm(b.textContent), ouvert: ouvert(b) })).filter((b) => b.texte);
    const groupes = [...modale.querySelectorAll('.seg, .rm-loc-grid')];
    const aChoix = groupes.some((g) => controles(g).some(ouvert));
    const sansChoix = groupes.find((g) => controles(g).some(ouvert) && !controles(g).some((b) => b.getAttribute('aria-pressed') === 'true'));
    const ouvertes = sansChoix ? controles(sansChoix).filter(ouvert) : [];
    const option = ouvertes[0] ?? null;
    let point = null;
    if (option) {
      option.scrollIntoView({ block: 'center', inline: 'center' });
      option.setAttribute('${ATTR_CIBLE}', ${JSON.stringify(jeton)});
      const r = option.getBoundingClientRect();
      point = { x: r.x + r.width / 2, y: r.y + r.height / 2, texte: norm(option.textContent), offertes: ouvertes.map((b) => norm(b.textContent)) };
    }
    const hacher = ${FN_HACHER};
    const etatOptions = groupes.map((g) => controles(g).map((b) => norm(b.textContent) + (b.getAttribute('aria-pressed') === 'true' ? '*' : '') + (ouvert(b) ? '' : '-')).join(',')).join('/');
    let cascade;
    try { cascade = pc ? JSON.stringify(pc) : ''; } catch (e) { cascade = '(cascade illisible : ' + e.message + ')'; }
    const empreinte = hacher(etatOptions + '#' + (st.journal || []).length + '#' + cascade);
    return { modale: true, fenetre: identite ? identite.nom : null, enCours, gesteCarte, boutons, option: point, aChoix, identite, empreinte };
  })()`;
}

/** Les CHOIX faits à la place du joueur (`resoudreModales`), en clair pour le rapport de sortie
 *  d'une recette (PURE). */
export function decrireChoix(choix) {
  if (!choix.length) return 'Choix faits à la place du joueur : aucun.';
  return [`Choix faits à la place du joueur : ${choix.length}`,
    ...choix.map((c) => `  · « ${c.fenetre ?? '?'} » : « ${c.option} » (offertes : ${c.offertes.join(' | ')})`)].join('\n');
}

/** Une lecture de fenêtres en clair (PURE) : étape au store, fenêtre, boutons et leur état. */
function decrireLectureModales(l) {
  const boutons = l.boutons.map((b) => (b.ouvert ? b.texte : `${b.texte} (désactivé)`)).join(' | ') || '(aucun bouton)';
  return `étape au store « ${l.enCours ?? 'aucune'} », fenêtre ${l.modale ? 'ouverte' : 'absente'}, boutons : ${boutons}`;
}

/** OUVRE le Round en pause (« Commencer le combat » / « Commencer le round N ») par la case de phase
 *  `round-start` — le geste du joueur, au vrai bouton, jamais un `.click()` en JS. */
export async function ouvrirRound(session) {
  return cliquerAction(session, 'round-start', { racine: '.cc-phase' });
}

/** Lecture du combat pour le pilote (`__wfrp.battle()` + `__wfrp.auto()` + fenêtre au DOM) ; `fenetre`
 *  = l'IDENTITÉ de la fenêtre ouverte (`IDENTITE_FENETRE`), ou `null`. */
export const LECTURE_COMBAT = `(() => {
  const b = window.__wfrp.battle();
  const a = window.__wfrp.auto();
  return {
    battle: typeof b === 'string' ? null : { round: b.round, over: b.over, actif: b.actif, acted: b.acted, movementUsed: b.movementUsed, endTurnArmed: b.endTurnArmed },
    auto: { roundPause: a.roundPause, activeModal: a.activeModal, active: a.active },
    modale: !!document.querySelector('.modal-overlay'),
    fenetre: (${IDENTITE_FENETRE})(window.__game.getState()),
    gesteCarte: window.__wfrp.gesteCarteAttendu(),
  };
})()`;

/**
 * FINIT le tour du héros actif à la PLAQUE de fin de tour (`end-turn`) : un premier clic ARME le
 * garde-fou quand l'Action n'est pas dépensée (`endTurnArmed`), le second passe la main. Rend le
 * nombre de clics émis.
 */
export async function finDuTour(session, { pauseMs = 300 } = {}) {
  await cliquerAction(session, 'end-turn');
  await sleep(pauseMs);
  const arme = await evaluate(session, `(() => { const b = window.__wfrp.battle(); return typeof b === 'object' && !!b.endTurnArmed; })()`);
  if (!arme) return 1;
  await cliquerAction(session, 'end-turn');
  await sleep(pauseMs);
  return 2;
}

/**
 * Le PROCHAIN geste du pilote de combat, depuis une lecture `LECTURE_COMBAT` (PURE) :
 * `fini` (plus de combat, combat terminé, ou `arret(etat)` vrai), `resoudre` (une fenêtre, une
 * modale active, ou un geste attendu sur la carte), `ouvrirRound` (pause de début de Round), `finirTour` (tour d'un héros piloté, armé
 * ou non), `attendre` (tour d'IA, ou aucun acteur).
 */
export function prochainGeste(etat, { arret } = {}) {
  if (!etat.battle || etat.battle.over) return 'fini';
  if (arret && arret(etat)) return 'fini';
  if (etat.modale || etat.auto.activeModal || etat.gesteCarte) return 'resoudre';
  if (etat.auto.roundPause) return 'ouvrirRound';
  if (etat.battle.endTurnArmed) return 'finirTour';
  const actif = etat.auto.active;
  if (!actif || actif.aiDriven) return 'attendre';
  return 'finirTour';
}

/**
 * PILOTE le combat comme un joueur — `observer → prochainGeste → geste` — jusqu'à `arret(etat)` ou la
 * fin du combat, en `budget` gestes au plus ; lève en nommant la DERNIÈRE lecture. Rend
 * `{ lecture, choix }` : la lecture finale, et les CHOIX faits à la place du joueur par chaque
 * `resoudreModales`, cumulés — une levée les porte aussi (`erreur.choix`, `porterChoix`).
 * `arret(etat)` lit aussi `etat.fenetre`, l'IDENTITÉ de la fenêtre ouverte (`IDENTITE_FENETRE`) : il est
 * consulté à chaque lecture du pilote ET à chaque lecture de `resoudreModales`, de sorte qu'une recette
 * s'ARRÊTE sur la modale qu'elle vise, laissée ouverte (`(e) => e.fenetre?.jet === 'defense'`).
 */
export async function piloterCombat(session, { arret, budget = 300, pauseMs = 400 } = {}) {
  let derniere = null;
  const choix = [];
  try {
    for (let k = 0; k < budget; k++) {
      derniere = await evaluate(session, LECTURE_COMBAT);
      const geste = prochainGeste(derniere, { arret });
      if (geste === 'fini') return { lecture: derniere, choix };
      const lue = derniere;
      if (geste === 'resoudre') {
        try {
          choix.push(...(await resoudreModales(session, 'piloterCombat', arret ? { arret: (fenetre) => arret({ ...lue, modale: true, fenetre }) } : {})));
        } catch (e) {
          choix.push(...(e.choix ?? []));
          throw e;
        }
      } else if (geste === 'ouvrirRound') await ouvrirRound(session);
      else if (geste === 'finirTour') await finDuTour(session);
      await sleep(pauseMs);
    }
    throw new Error(`piloterCombat : ${budget} gestes sans atteindre l'arrêt — dernière lecture : ${JSON.stringify(derniere)}`);
  } catch (e) {
    throw porterChoix(e, choix);
  }
}

/** Avance le combat de `n` Rounds (ou jusqu'à sa fin, ou jusqu'à l'`arret` de l'appelant), au geste du
 *  joueur. Rend `{ lecture, choix }` ; une levée porte les choix (`piloterCombat`). */
export async function avancerDeRounds(session, n, { arret, ...opts } = {}) {
  const depart = await evaluate(session, LECTURE_COMBAT);
  if (!depart.battle) throw new Error('avancerDeRounds : aucun combat en cours');
  const cible = depart.battle.round + n;
  return piloterCombat(session, { ...opts, arret: (e) => e.battle.round >= cible || !!arret?.(e) });
}

/**
 * CAPTURE d'un PION : un PNG recadré autour de la case du combattant `id` (`tileScreenPos` de sa
 * position), agrandi `zoom` fois (`Page.captureScreenshot` + `clip.scale`). `cote` = côté du cadre en
 * px CSS. Lève si le combattant n'a pas de position projetée. Rend le chemin écrit.
 */
export async function capturerPion(session, id, { zoom = 3, cote = 160, dir = process.cwd(), nom = `pion-${id}` } = {}) {
  const centre = await evaluate(session, `(() => {
    const b = window.__wfrp.store.getState().battle;
    const c = b ? b.combatants.find((x) => x.id === ${JSON.stringify(id)}) : null;
    const pos = c ? c.pos : null;
    const r = pos ? window.__wfrp.tileScreenPos(pos) : null;
    return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
  })()`);
  if (!centre) throw new Error(`capturerPion : le combattant « ${id} » n'a pas de case projetée (hors combat, ou absent)`);
  const clip = { x: Math.max(0, centre.x - cote / 2), y: Math.max(0, centre.y - cote * 0.75), width: cote, height: cote, scale: zoom };
  mkdirSync(dir, { recursive: true });
  const r = await session.rpc('Page.captureScreenshot', { format: 'png', clip });
  const path = join(dir, nom.endsWith('.png') ? nom : `${nom}.png`);
  writeFileSync(path, Buffer.from(r.data, 'base64'));
  return path;
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
 * `defiler: false` survole SANS `scrollIntoView` (friction #700 : le défilement du helper faussait un
 * test « le survol ne fait pas défiler ») — la cible doit alors être déjà à l'écran.
 * Rend le point survolé `{ x, y }` ; lève si la cible est absente ou sans boîte.
 */
export async function survoler(session, cible, { attenteMs = 500, modifiers = 0, defiler = true } = {}) {
  const point = await localiserCible(session, cible, { defiler, qui: 'survoler' });
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
export async function infobulleDe(session, cible) {
  const r = await evaluate(session, `(() => {${corpsResoudreCible(cible)}
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
  })()`);
  if (!r) throw new Error(`infobulleDe : aucune cible « ${cible} » (sélecteur ni texte de bouton)`);
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
 * L'option se désigne par son LIBELLÉ VISIBLE (défaut) ; `{ par: 'valeur' }` vise la valeur interne.
 * Plusieurs options de même libellé : la PREMIÈRE est retenue et l'ambiguïté AVERTIE
 * (`avertirAmbiguite`, comme `clickButtonByText`). Refus EXPLICITES : liste absente, aucune option ne
 * correspond (les libellés, ou les valeurs, offerts sont remontés dans le message), ou option FERMÉE
 * (`disabled`, comme un contrôle fermé de `clicReel`). Rend `{ valeur, libelle }` LUS après le geste —
 * un `onChange` qui refuse la valeur se voit donc au retour, jamais en silence.
 */
export async function selectOption(session, selecteur, valeur, { par = 'libelle' } = {}) {
  const jeton = nouveauJeton();
  const rect = await evaluate(session, `(() => {
    const el = document.querySelector(${JSON.stringify(selecteur)});
    if (!el) return null;
    el.scrollIntoView({ block: 'center', inline: 'center' });
    el.setAttribute('${ATTR_CIBLE}', ${JSON.stringify(jeton)});
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  if (!rect) throw new Error(`selectOption : aucune liste ne matche « ${selecteur} »`);
  await clicReel(session, rect.x, rect.y, 0, { cible: jeton, libelle: selecteur });
  const res = await evaluate(session, `(() => {
    const el = document.querySelector(${JSON.stringify(selecteur)});
    const norm = (s) => (s || '').replace(/\\s+/g, ' ').replace(/[\u2019']/g, "'").trim();
    const demande = ${JSON.stringify(String(valeur))};
    const options = Array.from(el.options);
    const candidates = ${JSON.stringify(par)} === 'valeur' ? options.filter((o) => o.value === demande) : options.filter((o) => norm(o.textContent) === norm(demande));
    const choisie = candidates[0];
    if (!choisie) return { absente: true, offertes: options.map((o) => (${JSON.stringify(par)} === 'valeur' ? o.value : norm(o.textContent))) };
    const doublons = candidates.map((o) => norm(o.textContent) + ' [' + o.value + ']');
    if (choisie.disabled) return { fermee: true, doublons };
    el.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    setter.call(el, choisie.value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { valeur: el.value, libelle: (el.selectedOptions[0] || {}).textContent || '', doublons };
  })()`);
  if (res && res.absente) {
    throw new Error(`selectOption « ${selecteur} » : aucune option ${par === 'valeur' ? 'de VALEUR' : 'de LIBELLÉ'} « ${valeur} » — ${par === 'valeur' ? 'valeurs' : 'libellés'} offerts : ${res.offertes.join(' | ')}`);
  }
  avertirAmbiguite(`selectOption « ${selecteur} » « ${valeur} »`, res.doublons, 'Préciser avec { par: \'valeur\' } si ce n\'est pas celle-là.');
  if (res.fermee) throw new Error(`selectOption « ${selecteur} » : option « ${valeur} » FERMÉE (disabled) — aucun choix émis`);
  return { valeur: res.valeur, libelle: res.libelle };
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
 *
 * `dans` = sélecteur du CALQUE mesuré (même option que `clickButtonByText`) : seuls ses descendants
 * comptent — l'éditeur monté SOUS le calque Narratif n'entre pas au verdict de ce calque (#2001,
 * faux positifs à droite 682). Calque absent = refus NOMMÉ, jamais un verdict vide.
 */
export async function verdictDebordement(session, { dans = 'body', marge = 1 } = {}) {
  const r = await evaluate(session, `(() => {
    const vw = document.documentElement.clientWidth;
    const hote = document.querySelector(${JSON.stringify(dans)});
    if (!hote) return null;
    const debordants = [];
    for (const el of hote.querySelectorAll('*')) {
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
  if (!r) throw new Error(`verdictDebordement : calque « ${dans} » absent du DOM — aucun verdict`)
  return r
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
 * APPELLE le helper de mise en place `window.__wfrp[nom](...args)` (arguments sérialisés en JSON), en
 * attend la promesse, et LÈVE si le résultat est un REFUS — une chaîne qui commence par « ✗ » : un
 * refus RENDU au lieu d'être levé laissait le script continuer sur le mauvais état (#2001 F3,
 * `editorOpen`). Le message nomme le helper et cite le refus. `nom` peut porter son plafond
 * d'évaluation : `{ nom, timeoutMs }`, à régler AU-DESSUS du délai que le helper reçoit lui-même —
 * `appelerWfrp(session, { nom: 'ready', timeoutMs: 65000 }, 60000)` : `ready` attend 60 s, l'évaluation 65 s.
 * Rend le résultat.
 */
export async function appelerWfrp(session, nom, ...args) {
  const { nom: helper, timeoutMs = DELAI_EVALUATE } = typeof nom === 'string' ? { nom } : nom
  const resultat = await evaluate(session, `(async () => {
    const f = window.__wfrp && window.__wfrp[${JSON.stringify(helper)}];
    if (typeof f !== 'function') throw new Error('__wfrp.' + ${JSON.stringify(helper)} + ' : aucun helper de ce nom');
    return f(...${JSON.stringify(args)});
  })()`, { timeoutMs })
  if (typeof resultat === 'string' && resultat.startsWith('✗')) {
    throw new Error(`appelerWfrp « ${helper} » : refus — ${resultat}`)
  }
  return resultat
}

/**
 * LIT, en lecture seule, les enregistrements du magasin `magasin` de la base IndexedDB `base` :
 * `[{ cle, valeur }]` (valeurs sérialisées en JSON au retour). OBSERVATION pure : une base absente
 * n'est jamais ouverte (`indexedDB.open` la CRÉERAIT) — refus NOMMÉ listant les bases présentes ; un
 * magasin absent, refus listant les magasins de la base.
 */
export async function lireIndexedDB(session, base, magasin) {
  const r = await evaluerFn(session, async (base, magasin) => {
    const bases = await indexedDB.databases()
    if (!bases.some((b) => b.name === base)) return { refus: `base « ${base} » absente — bases : ${bases.map((b) => b.name).join(', ') || '(aucune)'}` }
    const db = await new Promise((ok, ko) => {
      const req = indexedDB.open(base)
      req.onsuccess = () => ok(req.result)
      req.onerror = () => ko(req.error)
    })
    try {
      const magasins = Array.from(db.objectStoreNames)
      if (!magasins.includes(magasin)) return { refus: `magasin « ${magasin} » absent de « ${base} » — magasins : ${magasins.join(', ') || '(aucun)'}` }
      const store = db.transaction(magasin, 'readonly').objectStore(magasin)
      const lire = (req) => new Promise((ok, ko) => { req.onsuccess = () => ok(req.result); req.onerror = () => ko(req.error) })
      const [cles, valeurs] = await Promise.all([lire(store.getAllKeys()), lire(store.getAll())])
      return { enregistrements: cles.map((cle, i) => ({ cle, valeur: valeurs[i] })) }
    } finally {
      db.close()
    }
  }, base, magasin)
  if (r.refus) throw new Error(`lireIndexedDB : ${r.refus}`)
  return r.enregistrements
}

/**
 * MESURE la PROVENANCE d'un texte de campagne rendue dans `selecteur` (`ProvenanceDuTexte`,
 * `src/ui/editor/ProvenanceDuTexte.tsx`, #2001) : le segment « Provenance du texte » dont les options
 * portent le nom accessible « <Mode> — provenance <sujet> ». Rend
 * `{ sujet, mode, options: [{ libelle, retenue, refus }], adresse, detacher, reference }` :
 * `mode` = l'option RETENUE (`aria-pressed`) ; `refus` = la raison liée d'une option refusée ;
 * `adresse` = le badge de la copie ADRESSÉE (`descRef`), `detacher` = son bouton « Détacher » (présent,
 * ouvert) ; `reference` = le libellé du champ de référence monté (« Source », « Adapté de »), ou `null`.
 * LÈVE si `selecteur` est absent, ne porte aucune provenance, ou en porte plusieurs (sujets nommés).
 */
export async function mesurerProvenance(session, selecteur) {
  const r = await evaluerFn(session, (selecteur) => {
    const racine = document.querySelector(selecteur)
    if (!racine) return { refus: 'absent du DOM' }
    const norm = (s) => (s || '').replace(/\s+/g, ' ').trim()
    const motif = /^(.+) — provenance (.+)$/
    const options = Array.from(racine.querySelectorAll('[aria-label]')).filter((b) => motif.test(b.getAttribute('aria-label')))
    const sujets = [...new Set(options.map((b) => motif.exec(b.getAttribute('aria-label'))[2]))]
    if (!sujets.length) return { refus: 'aucune provenance de texte (« … — provenance … ») rendue' }
    if (sujets.length > 1) return { refus: `plusieurs provenances : ${sujets.join(' | ')} — viser un conteneur plus étroit` }
    const champ = options[0].closest('.ed-field') ?? racine
    const raison = (b) => {
      const lien = b.getAttribute('aria-describedby')
      const porteur = lien && document.getElementById(lien)
      return porteur ? norm(porteur.textContent) || null : null
    }
    const ouvert = (b) => !b.disabled && b.getAttribute('aria-disabled') !== 'true'
    const lues = options.map((b) => ({
      libelle: motif.exec(b.getAttribute('aria-label'))[1],
      retenue: b.getAttribute('aria-pressed') === 'true',
      refus: ouvert(b) ? null : raison(b),
    }))
    const detacher = Array.from(champ.querySelectorAll('button')).find((b) => b.getAttribute('aria-label') === `Détacher le texte ${sujets[0]}`)
    const badge = champ.querySelector('.source-badge')
    const sousChamp = Array.from(champ.querySelectorAll(':scope .ed-field')).map((c) => c.firstElementChild).find((e) => e && e.tagName === 'SPAN')
    return {
      sujet: sujets[0],
      mode: lues.find((o) => o.retenue)?.libelle ?? null,
      options: lues,
      adresse: badge ? norm(badge.textContent) : null,
      detacher: detacher ? { ouvert: ouvert(detacher) } : null,
      reference: sousChamp ? norm(sousChamp.textContent) : null,
    }
  }, selecteur)
  if (r.refus) throw new Error(`mesurerProvenance « ${selecteur} » : ${r.refus}`)
  return r
}

/**
 * OUVRE la fiche d'une entrée du Compendium AUX GESTES (`src/ui/compendium/CompendiumScreen.tsx`) : le
 * bouton « Compendium » du menu si l'écran n'est pas monté, l'onglet du `groupe` (`[role=tab]` de
 * « Groupes du Codex »), la pastille de la `categorie` (`button.codex-cat`, dépliée de son sous-groupe
 * replié par `deplierVers`), la frappe de l'`entree` dans `.codex-search`, puis le clic de sa rangée.
 * L'entrée se désigne par ses LIBELLÉS visibles, comme un joueur : le Codex ne publie aucun id au DOM.
 * LÈVE en nommant ce qui manque (catégorie, rangée), et si la rangée cliquée n'est pas retenue
 * (`aria-current`). Rend `{ entree }`.
 */
export async function ouvrirFiche(session, { groupe, categorie, entree }) {
  if (!(await evaluate(session, `!!document.querySelector('.screen.codex')`))) {
    await clickButtonByText(session, 'Compendium');
    await attendreSelecteur(session, '.screen.codex');
  }
  if (groupe) await clickButtonByText(session, groupe, { dans: '.codex-groups' });
  if (categorie) {
    const pastille = await evaluerFn(session, (categorie) => {
      const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
      for (const v of document.querySelectorAll('[data-recette="codex-categorie"]')) v.removeAttribute('data-recette');
      const el = Array.from(document.querySelectorAll('button.codex-cat')).find((b) => norm(Array.from(b.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join('')) === norm(categorie));
      if (!el) return { offertes: Array.from(document.querySelectorAll('button.codex-cat')).map((b) => norm(Array.from(b.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join(''))) };
      el.setAttribute('data-recette', 'codex-categorie');
      return { trouvee: true };
    }, categorie);
    if (!pastille.trouvee) throw new Error(`ouvrirFiche : aucune catégorie « ${categorie} » — offertes : ${pastille.offertes.join(' | ') || '(aucune)'}`);
    await deplierVers(session, '[data-recette="codex-categorie"]');
    await cliquerSelecteur(session, '[data-recette="codex-categorie"]');
  }
  await typeInField(session, '.codex-search', entree, { attendu: entree });
  const rangee = await evaluerFn(session, (entree) => {
    const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
    for (const v of document.querySelectorAll('[data-recette="codex-entree"]')) v.removeAttribute('data-recette');
    const rangees = Array.from(document.querySelectorAll('.codex-rows button.listrow'));
    const el = rangees.find((b) => norm(b.querySelector('.lr-name')?.textContent) === norm(entree));
    if (!el) return { offertes: rangees.map((b) => norm(b.querySelector('.lr-name')?.textContent)).slice(0, 10) };
    el.setAttribute('data-recette', 'codex-entree');
    return { trouvee: true };
  }, entree);
  if (!rangee.trouvee) throw new Error(`ouvrirFiche : aucune rangée « ${entree} » — offertes : ${rangee.offertes.join(' | ') || '(aucune)'}`);
  await cliquerSelecteur(session, '[data-recette="codex-entree"]');
  if (!(await evaluate(session, `document.querySelector('[data-recette="codex-entree"]')?.getAttribute('aria-current') === 'true'`))) {
    throw new Error(`ouvrirFiche : la rangée « ${entree} » cliquée n'est pas retenue (aria-current)`);
  }
  return { entree };
}

/**
 * Attend qu'un sélecteur soit PRÉSENT dans le DOM, et REFUSE en le nommant sinon — un `sleep` gonflé
 * « au cas où » cache la cause quand l'élément n'arrive jamais. `qui` nomme le geste dans la levée.
 * Rend le sélecteur au succès.
 */
export async function attendreSelecteur(session, selecteur, { timeoutMs = ATTENTE_CIBLE, qui = 'attendreSelecteur' } = {}) {
  try {
    await waitFor(session, `!!document.querySelector(${JSON.stringify(selecteur)})`, { timeoutMs })
  } catch (e) {
    if (e.code !== ATTENTE_ECHUE) throw e
    throw new Error(`${qui} : « ${selecteur} » absent du DOM après ${timeoutMs} ms`, { cause: e })
  }
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
    code: touche.code ?? (/^[0-9]$/.test(touche.key) ? `Digit${touche.key}` : touche.key.length === 1 ? `Key${touche.key.toUpperCase()}` : touche.key),
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
  const texte = texteDeTouche(touche.key);
  if (texte !== null) await session.rpc('Input.dispatchKeyEvent', { type: 'char', text: texte, ...common });
  await session.rpc('Input.dispatchKeyEvent', { type: 'keyUp', ...common });
}

/** Le TEXTE qu'une touche produit, ce qui fait d'elle une frappe qui AGIT : un caractère se tape,
 *  Entrée produit `\r` — c'est lui qui active le bouton focalisé (sans, Chrome ne clique rien).
 *  Les touches sans texte (Échap, flèches, Tab, modificateurs) rendent `null`. */
function texteDeTouche(key) {
  if (key.length === 1) return key;
  return key === 'Enter' ? '\r' : null;
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
export async function typeInField(session, selecteur, texte, { clear = true, attendu } = {}) {
  const jeton = nouveauJeton();
  const rect = await evaluate(session, `(() => {
    const el = document.querySelector(${JSON.stringify(selecteur)});
    if (!el) return null;
    el.scrollIntoView({ block: 'center', inline: 'center' });
    el.setAttribute('${ATTR_CIBLE}', ${JSON.stringify(jeton)});
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  if (!rect) throw new Error(`typeInField : aucun élément ne matche « ${selecteur} »`);
  await clicReel(session, rect.x, rect.y, 0, { cible: jeton, libelle: selecteur });
  // La frappe va à l'élément FOCALISÉ : un champ qui n'a pas le focus après le clic (#1853 L3,
  // `<input type=number>`) recevrait une insertion perdue, que la relecture dirait « inchangée ».
  const focus = await evaluate(session, `(() => {
    const el = document.querySelector(${JSON.stringify(selecteur)});
    if (${clear}) el.select();
    const a = document.activeElement;
    return a === el ? null : (a ? a.tagName.toLowerCase() + (a.id ? '#' + a.id : '') : '(aucun)');
  })()`);
  if (focus) throw new Error(`typeInField « ${selecteur} » : le champ n'a pas le focus après le clic (focus sur ${focus}) — aucune frappe émise`);
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
 *  - case INERTE (`.cc-inert`, action `blocked` du registre) — dite comme telle ;
 *  - case FERMÉE (`disabled`/`aria-disabled`) — refus de `clicReel`, sa RAISON affichée remontée telle
 *    quelle : un gate qui se déclenche est un RÉSULTAT de recette, pas un obstacle.
 * Rend `{ actionId, label, rect }` au succès. Même dispatch souris réel que `clickButtonByText`.
 */
export async function cliquerAction(session, actionId, { racine = '.combat-console' } = {}) {
  const jeton = nouveauJeton();
  const etat = await evaluate(session, `(() => {
    const el = document.querySelector(${JSON.stringify('%RACINE% [data-action="%ID%"]')});
    if (!el) {
      const offertes = Array.from(document.querySelectorAll(${JSON.stringify('%RACINE% [data-action]')})).map((b) => b.getAttribute('data-action'));
      return { absente: true, offertes };
    }
    el.scrollIntoView({ block: 'center', inline: 'center' });
    el.setAttribute('${ATTR_CIBLE}', ${JSON.stringify(jeton)});
    const r = el.getBoundingClientRect();
    return {
      inerte: el.classList.contains('cc-inert'),
      label: (el.getAttribute('aria-label') || el.textContent || '').trim(),
      x: r.x + r.width / 2, y: r.y + r.height / 2,
    };
  })()`.replace(/%RACINE%/g, racine).replace(/%ID%/g, actionId));
  if (!etat || etat.absente) {
    throw new Error(`cliquerAction « ${actionId} » : aucune case de console ne porte cet id — offertes : ${((etat && etat.offertes) || []).join(', ') || '(aucune)'}`);
  }
  if (etat.inerte) throw new Error(`cliquerAction « ${actionId} » : case INERTE (action déclarée sans dispatcher au registre) — rien à cliquer`);
  await clicReel(session, etat.x, etat.y, 0, { cible: jeton, libelle: actionId });
  return { actionId, label: etat.label, rect: { x: etat.x, y: etat.y } };
}

/** Frappe RÉELLE d'une touche — alias FRANÇAIS de `realKey` (même geste, même pipeline CDP). */
export const frapperTouche = realKey;
// ───────────────────────────── SESSION TENUE : un gardien, des clients (#2306.1) ─────────────────────────────
//
// Le GARDIEN (`scripts/recette/session.mjs ouvrir`, lancé en fond) tient Chrome, l'app et la console
// depuis l'amorçage ; chaque commande de l'agent est un script `.mjs` CLIENT qui s'ATTACHE à la même
// cible (`attacherSession`), joue ses gestes, lit, et se DÉTACHE sans rien tuer. Le fichier de session,
// les signaux et le journal vivent sous `os.tmpdir()`, hors de l'arbre. Les écritures restent ICI
// (`session.mjs` les appelle) : la gate `test:recette` n'atteint qu'un écrivain, ce module.

/** Fichier de session de l'arbre `racine` : un par arbre (sessions parallèles de worktrees voisins). */
export function fichierDeSession(racine = RACINE_COURANTE, dossier = os.tmpdir()) {
  const cle = createHash('sha1').update(normaliserRacine(racine)).digest('hex').slice(0, 12);
  return join(dossier, `recette-session-${cle}.json`);
}

/** Les fichiers SIGNAUX d'une session : le client les pose, le gardien les consomme. */
export const signalDe = (fichier, quoi) => `${fichier}.${quoi}`;
export const SIGNAUX = Object.freeze(['fermer', 'vue', 'actif']);

/** Ce que le fichier de session publie (PURE) : de quoi s'attacher, observer, et nettoyer. */
export function descripteurSession({ pidGardien, session, url, journal, vue, racine = RACINE_COURANTE }) {
  return {
    pidGardien,
    pidChrome: session.chrome?.pid ?? null,
    port: session.port,
    targetId: session.targetId,
    url,
    journal,
    profil: session.profile,
    vue: { nom: vue.nom, largeur: vue.largeur, hauteur: vue.hauteur },
    racine: normaliserRacine(racine),
  };
}

/** Vrai si le process `pid` existe (`kill 0`, sans rien tuer). `ESRCH` = absent ; `EPERM` = il existe,
 *  sous un autre compte ; toute autre erreur remonte. */
export function processusVivant(pid, { sonder = (p) => process.kill(p, 0) } = {}) {
  if (!pid) return false;
  try {
    sonder(pid);
    return true;
  } catch (e) {
    if (e.code === 'ESRCH') return false;
    if (e.code === 'EPERM') return true;
    throw e;
  }
}

/** Lecture du journal de console du gardien à partir de l'octet `depuis` : `{ entries, errors(), warnings() }`. */
export function consoleDuJournal(journal, depuis = 0, { lire = (c) => readFileSync(c) } = {}) {
  const entries = () => lire(journal).subarray(depuis).toString('utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  return { entries, errors: () => erreursDe(entries()), warnings: () => avertissementsDe(entries()) };
}

/** Vrai si l'échec d'un appel de fermeture dit que la cible ou la socket est DÉJÀ partie : erreur de
 *  navigation (`isNavigationError`, dont la socket coupée de `brancherCdp`), ou session inconnue du
 *  navigateur. */
const cibleDejaPartie = (e) => isNavigationError(e) || /No session with given id/i.test(String(e?.message ?? ''));

/**
 * S'ATTACHE à la session tenue par le gardien (fichier `fichier`) et rend une `session` de même forme
 * que celle de `launchSession` : `rpc`, `listeners`, `sessionId`, `targetId`. Différences :
 *  - `close()` DÉTACHE (`Target.detachFromTarget` au niveau NAVIGATEUR, jamais `closeTarget`), ne tue
 *    rien, puis signale au gardien de ré-imposer SA vue (l'émulation d'un client tombe avec lui) ;
 *  - aucune console n'est posée par le client : un client qui active `Runtime`/`Log` reçoit le PASSÉ
 *    de la console. `session.console` lit le journal du GARDIEN, découpé à l'attache.
 * Refus NOMMÉS, sans pendre : aucune session, gardien mort (PID absent), CDP muet.
 */
export async function attacherSession(fichier = fichierDeSession(), {
  disque = DISQUE, vivant = processusVivant, recuperer = fetch, connecter = (url) => new WebSocket(url), delaiMs = 5000,
  taille = (chemin) => statSync(chemin).size, signaler = (chemin) => writeFileSync(chemin, String(Date.now())),
} = {}) {
  if (!disque.existe(fichier)) throw new Error(`attacherSession : aucune session tenue (${fichier}) — lancer « node scripts/recette/session.mjs ouvrir » en fond`);
  const d = JSON.parse(disque.lire(fichier));
  if (!vivant(d.pidGardien)) {
    throw new Error(`attacherSession : le gardien (pid ${d.pidGardien}) est MORT — « node scripts/recette/session.mjs fermer » purge son profil et son fichier`);
  }
  let wsUrl;
  try {
    wsUrl = await waitForWsUrl(d.port, delaiMs, { recuperer });
  } catch (e) {
    throw new Error(`attacherSession : CDP muet sur le port ${d.port} (gardien pid ${d.pidGardien}) après ${delaiMs} ms`, { cause: e });
  }
  const ws = connecter(wsUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  const session = brancherCdp(ws, { profile: d.profil, port: d.port, gardien: d });
  const { sessionId } = await session.rpcNavigateur('Target.attachToTarget', { targetId: d.targetId, flatten: true });
  session.sessionId = sessionId;
  session.targetId = d.targetId;
  session.console = consoleDuJournal(d.journal, taille(d.journal));
  signaler(signalDe(fichier, 'actif'));
  session.close = async () => {
    try {
      await session.rpcNavigateur('Target.detachFromTarget', { sessionId });
    } catch (e) {
      if (!cibleDejaPartie(e)) throw e;
    }
    ws.close();
    signaler(signalDe(fichier, 'vue'));
  };
  return session;
}

/**
 * TIENT une session jusqu'au signal `fermer` ou au délai d'INACTIVITÉ : app ouverte, console posée dès
 * l'amorçage et écrite au journal, fichier de session publié. Ré-impose sa vue au signal `vue` (posé
 * par chaque client qui se détache). À la sortie : stockage restauré, Chrome arrêté par SON process,
 * profil purgé et VÉRIFIÉ, fichier, signaux et journal supprimés. Rend `{ raison, profilPurge }`.
 */
export async function tenirSession(url = DEFAULT_URL, {
  vue = 'bureau', inactiviteMs = 30 * 60 * 1000, fichier = fichierDeSession(), pasMs = 250, timeoutMs = 120000, ouvrir = openApp,
  disque = DISQUE, vivant = processusVivant,
} = {}) {
  const refusTenue = () => {
    const ancien = JSON.parse(disque.lire(fichier));
    if (vivant(ancien.pidGardien)) return new Error(`tenirSession : une session est déjà tenue par le gardien ${ancien.pidGardien} (${fichier})`);
    return new Error(`tenirSession : fichier de session d'un gardien MORT (${fichier}) — « session.mjs fermer » le nettoie d'abord`);
  };
  if (disque.existe(fichier)) throw refusTenue();
  const v = vueRecette(vue);
  const journal = fichier.replace(/\.json$/, '.console.jsonl');
  // Le journal puis le fichier se CRÉENT en exclusif (`wx`) : deux gardiens du même arbre ne peuvent
  // pas tenir la même session ; seul ce que CE gardien a créé est supprimé à la sortie.
  const crees = [];
  let raison = 'fermer';
  let profilPurge;
  let session = null;
  try {
    try {
      disque.ecrire(journal, '', { exclusif: true });
    } catch (e) {
      if (e.code === 'EEXIST') throw new Error(`tenirSession : journal ${journal} déjà tenu par un autre gardien`, { cause: e });
      throw e;
    }
    crees.push(journal);
    session = await ouvrir(url, { timeoutMs, width: v.largeur, height: v.hauteur, console: { journal } });
    try {
      disque.ecrire(fichier, JSON.stringify(descripteurSession({ pidGardien: process.pid, session, url, journal, vue: v }), null, 2), { exclusif: true });
    } catch (e) {
      if (e.code === 'EEXIST') throw refusTenue();
      throw e;
    }
    crees.push(fichier, ...SIGNAUX.map((q) => signalDe(fichier, q)));
    let activite = Date.now();
    for (;;) {
      if (disque.existe(signalDe(fichier, 'fermer'))) break;
      if (disque.existe(signalDe(fichier, 'actif'))) { disque.supprimer(signalDe(fichier, 'actif')); activite = Date.now(); }
      if (disque.existe(signalDe(fichier, 'vue'))) {
        disque.supprimer(signalDe(fichier, 'vue'));
        activite = Date.now();
        await setViewport(session, v.largeur, v.hauteur);
      }
      if (Date.now() - activite > inactiviteMs) { raison = `inactivité (${inactiviteMs} ms)`; break; }
      await sleep(pasMs);
    }
  } finally {
    if (session) ({ profilPurge } = (await session.close()) ?? {});
    for (const f of crees) disque.supprimer(f);
  }
  return { raison, profilPurge };
}

/**
 * FERME la session de `fichier`, IDEMPOTENT :
 *  - aucune session → `{ etat: 'aucune' }` ;
 *  - gardien vivant → signal `fermer`, puis attente de la disparition du fichier (le gardien nettoie) ;
 *  - gardien mort → son profil est purgé par son CHEMIN enregistré (jamais une mise à mort : Chrome est
 *    mort avec lui, et le PID peut avoir été réattribué), purge VÉRIFIÉE, puis fichier, signaux et
 *    journal supprimés.
 */
export async function fermerSession(fichier = fichierDeSession(), {
  disque = DISQUE, vivant = processusVivant, signaler = (chemin) => writeFileSync(chemin, String(Date.now())), attenteMs = 30000, pasMs = 250,
} = {}) {
  if (!disque.existe(fichier)) return { etat: 'aucune' };
  const d = JSON.parse(disque.lire(fichier));
  if (vivant(d.pidGardien)) {
    signaler(signalDe(fichier, 'fermer'));
    const fin = Date.now() + attenteMs;
    while (disque.existe(fichier)) {
      if (Date.now() > fin) throw new Error(`fermerSession : le gardien ${d.pidGardien} n'a pas fermé sa session en ${attenteMs} ms`);
      await sleep(pasMs);
    }
    return { etat: 'fermee' };
  }
  const profilPurge = d.profil ? await purgerProfil(d.profil, { disque }) : true;
  for (const f of [fichier, d.journal, ...SIGNAUX.map((q) => signalDe(fichier, q))]) if (f) disque.supprimer(f);
  return { etat: 'gardien-mort', profilPurge, profil: d.profil };
}

/** Le Chrome inscrit au `SingletonLock` d'un profil (lien `hôte-pid` que Chrome pose sous POSIX) :
 *  `{ absent: true }` sans verrou, `{ hote, pid }` lu, `{ illisible }` sinon. */
function verrouChrome(profil, { disque = DISQUE } = {}) {
  let cible;
  try {
    cible = disque.lireLien(join(profil, 'SingletonLock'));
  } catch (e) {
    return { illisible: e.code ?? String(e) };
  }
  if (cible === null) return { absent: true };
  const m = /^(.+)-(\d+)$/.exec(cible);
  return m ? { hote: m[1], pid: Number(m[2]) } : { illisible: cible };
}

/**
 * PURGE les profils ORPHELINS du kit (`PREFIXE_PROFIL` sous `dossier`). FAIL-SAFE : un profil ne se purge
 * que sur PREUVE qu'aucun process ne l'utilise :
 *  - le PID de son lanceur, consigné dans son nom (`pidDeProfil`), est MORT ;
 *  - hors win32, EN PLUS, le Chrome de son `SingletonLock` (`verrouChrome`) est mort, sur CET hôte, ou
 *    le verrou est absent : hors du job object de win32 (`OPTIONS_SPAWN_CHROME`), Chrome peut survivre
 *    à son lanceur.
 * Lanceur ou Chrome vivant → compté dans `vivants`. Nom sans PID, verrou illisible ou d'un autre hôte →
 * chemin listé dans `sansPreuve`, laissé intact (`docs/recette-navigateur.md` dit comment le retirer à
 * la main). Jamais un âge, jamais une mise à mort. Rend `{ trouves, purges, vivants, sansPreuve, echecs }`
 * — chaque purge est VÉRIFIÉE.
 */
export async function purgerProfilsOrphelins({
  dossier = os.tmpdir(), disque = DISQUE, vivant = processusVivant, plateforme = process.platform, hote = os.hostname(),
} = {}) {
  const trouves = disque.lister(dossier).filter((n) => n.startsWith(PREFIXE_PROFIL));
  const bilan = { trouves: trouves.length, purges: 0, vivants: 0, sansPreuve: [], echecs: [] };
  for (const nom of trouves) {
    const profil = join(dossier, nom);
    const pid = pidDeProfil(nom);
    if (pid === null) { bilan.sansPreuve.push(profil); continue; }
    if (vivant(pid)) { bilan.vivants += 1; continue; }
    if (plateforme !== 'win32') {
      const verrou = verrouChrome(profil, { disque });
      if (!verrou.absent && (verrou.pid === undefined || verrou.hote !== hote)) { bilan.sansPreuve.push(profil); continue; }
      if (!verrou.absent && vivant(verrou.pid)) { bilan.vivants += 1; continue; }
    }
    if (await purgerProfil(profil, { disque, tentatives: 5 })) bilan.purges += 1;
    else bilan.echecs.push(profil);
  }
  return bilan;
}
