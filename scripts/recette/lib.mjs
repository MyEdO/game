// Pilotage de Chromium par CDP pour les recettes et étalons de l’export Web Godot.
import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, readdirSync, readFileSync, readlinkSync, rmSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { attendreSync } from '../guards/lib/spawnResilient.mjs';
import { TOLERANCE_CREATION_MS } from '../guards/lib/processusWorktrees.mjs';
import { NAISSANCE_ABSENTE, estPidVivant, estPidVivantDepuis } from '../guards/lib/pid.mjs';
import { IDENTITE_MESUREE } from '../test/identiteMesuree.mjs';
import { RACINE, normaliserRacine } from '../port-dev.mjs';

/** Racine de l'arbre depuis lequel CETTE recette tourne. */
export const RACINE_COURANTE = normaliserRacine(RACINE);

export const DOSSIER_CAPTURES = join(os.tmpdir(), 'recette-captures', createHash('sha256').update(RACINE_COURANTE).digest('hex').slice(0, 12));

export function validerDossierCaptures(dir = DOSSIER_CAPTURES) {
  if (typeof dir !== 'string' || !isAbsolute(dir)) throw new Error('capture : dossier absolu requis — reçu « ' + dir + ' »');
  return dir;
}

const CHROME_WINDOWS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];
/** Racine des navigateurs Playwright quand `PLAYWRIGHT_BROWSERS_PATH` n'est pas posée. */
const RACINE_PLAYWRIGHT = '/opt/pw-browsers';
/** Exécutable sous `chromium-<N>/`, par disposition de Playwright (`chrome-linux64` dans les versions récentes). */
const EXECUTABLES_PLAYWRIGHT = ['chrome-linux/chrome', 'chrome-linux64/chrome'];

/**
 * Exécutable Chrome et arguments de lancement propres à la machine. Ordre : chemin `explicite` de
 * l'appelant, `CHROME_PATH`, chemins Windows présents (sur `win32` seulement : ailleurs ils se
 * résoudraient contre le dossier courant), puis le Chromium Playwright de plus haute
 * version sous `PLAYWRIGHT_BROWSERS_PATH` (défaut `/opt/pw-browsers`), trouvé par lecture du dossier
 * (`chromium-<N>/` suivi d'un sous-chemin de `EXECUTABLES_PLAYWRIGHT`). `--no-sandbox` en root seulement : Chromium refuse d'y
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
    .flatMap((m) => EXECUTABLES_PLAYWRIGHT.map((e) => `${racine}/${m[0]}/${e}`))
    .find((p) => fs.existe(p));
  if (playwright) return { chemin: playwright, args };
  throw new Error(
    `aucun Chrome trouvé — pose CHROME_PATH, ou installe Chrome (${CHROME_WINDOWS.join(', ')}) ` +
      `ou un Chromium Playwright (${EXECUTABLES_PLAYWRIGHT.map((e) => `${racine}/chromium-*/${e}`).join(', ')})`,
  );
}

/** Attend `ms` millisecondes. */
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Code porté par tout rejet dû à un rechargement de la page (voir `isNavigationError`). */
export const TARGET_NAVIGATED = 'TARGET_NAVIGATED';

/** Code porté par le rejet d'un appel en vol quand sa page plante (`brancherCdp`) : jamais une navigation, rien à rejouer. */
export const PAGE_PLANTEE = 'PAGE_PLANTEE';

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
const CLEARED_GLOBALS = /window\.__\w+ is (?:not a function|undefined)/;

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

function validerProcessus(processus) {
  if (!Array.isArray(processus)) throw new Error('killChromeTree : instantané des processus malformé, tableau attendu');
  const vus = new Set();
  for (const [i, p] of processus.entries()) {
    if (!Number.isSafeInteger(p?.pid) || p.pid <= 0 || !Number.isSafeInteger(p?.parent) || p.parent < 0 || vus.has(p.pid) || !Number.isFinite(p.cree) || p.cree < 0) {
      throw new Error('killChromeTree : instantané des processus malformé, entrée ' + i + ' — PID positif unique, parent entier positif ou nul et date de création finie, positive ou nulle, attendus');
    }
    vus.add(p.pid);
  }
  return processus;
}

/** Instantané CIM des processus : un processus sans date de création LÈVE, la lecture échoue. */
export const COMMANDE_PROCESSUS_CIM = 'ConvertTo-Json -Compress -InputObject @(Get-CimInstance Win32_Process -Filter "ProcessId > 0" | ForEach-Object { if (-not $_.CreationDate) { throw "date de creation absente, PID $($_.ProcessId)" }; [pscustomobject]@{ ProcessId = $_.ProcessId; ParentProcessId = $_.ParentProcessId; Cree = [int64]($_.CreationDate.ToUniversalTime() - [datetime]\'1970-01-01\').TotalMilliseconds } })';

/** Instantané PID/parent/création (`cree`, ms epoch, EXIGÉE) via CIM sous Windows, à la milliseconde,
 *  ps ailleurs (`etimes`, à la seconde, d'où `TOLERANCE_CREATION_MS`) ; toute observation illisible refuse. Un zombie
 *  (`stat` en `Z`) est un processus mort, que son parent n'a pas recueilli : il n'est pas de l'instantané. */
export function lireProcessus({ plateforme = process.platform, executer = spawnSync, horloge = Date.now } = {}) {
  const r = plateforme === 'win32'
    ? executer('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', COMMANDE_PROCESSUS_CIM], { encoding: 'utf8' })
    : executer('ps', ['-eo', 'pid=,ppid=,etimes=,stat='], { encoding: 'utf8' });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`killChromeTree : observation des processus impossible (code ${r.status}) — ${r.stderr || ''}`);
  if (plateforme === 'win32') {
    const lignes = JSON.parse(r.stdout);
    if (!Array.isArray(lignes)) throw new Error('killChromeTree : instantané des processus malformé, tableau attendu');
    return validerProcessus(lignes.map((p) => ({ pid: p?.ProcessId, parent: p?.ParentProcessId, cree: p?.Cree })));
  }
  const maintenant = horloge();
  const lignes = r.stdout.trim().split('\n').filter(Boolean).map((s) => {
    const ligne = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s*$/.exec(s);
    if (!ligne) throw new Error('killChromeTree : ligne de processus malformée « ' + s + ' »');
    return { pid: Number(ligne[1]), parent: Number(ligne[2]), cree: Math.max(0, maintenant - Number(ligne[3]) * 1000), zombie: ligne[4].startsWith('Z') };
  });
  return validerProcessus(lignes).filter((p) => !p.zombie).map(({ pid, parent, cree }) => ({ pid, parent, cree }));
}

/** ÉCHÉANCE d'extinction d'un Chrome et de libération de son profil, qui tient la CHARGE : #2540, une
 *  observation CIM coûte 600 à 800 ms sur une machine chargée, et l'extinction y dépassait 2000 ms. */
export const ATTENTE_EXTINCTION_MS = 15000;

/** Arrête l’arbre puis observe son extinction jusqu'à une échéance synchrone prise APRÈS l'arrêt,
 *  indépendamment du code taskkill. Chaque PID suivi conserve sa première date de création. Une
 *  nouvelle filiation exige une naissance compatible avec celle du parent suivi et antérieure à son
 *  éventuel remplacement. Un descendant découvert après coup doit être né avant l'arrêt. */
export function killChromeTree(chrome, { plateforme = process.platform, executer = spawnSync, observer = () => lireProcessus({ plateforme, executer }), tuerPid = (pid) => process.kill(pid, 'SIGKILL'), attenteMs = ATTENTE_EXTINCTION_MS, horloge = Date.now, patienter = attendreSync } = {}) {
  if (!Number.isInteger(chrome.pid) || chrome.pid <= 0) throw new Error('killChromeTree : PID racine absent, arbre non observable');
  if (!Number.isFinite(attenteMs) || attenteMs < 0) throw new Error('killChromeTree : délai non fini ou négatif');
  const avant = validerProcessus(observer());
  const suivis = new Map([[chrome.pid, undefined]]);
  const remplacements = new Map();
  const tolerance = TOLERANCE_CREATION_MS[plateforme === 'win32' ? 'cim' : 'ps'];
  const suivre = (instantane, debutArret = Infinity) => {
    const candidats = new Map();
    for (const p of instantane) {
      const naissance = suivis.get(p.pid);
      const memeProcessus = naissance === undefined
        ? p.cree <= debutArret + tolerance
        : Math.abs(p.cree - naissance) <= tolerance;
      if (memeProcessus) candidats.set(p.pid, p);
      else if (naissance !== undefined && p.cree > naissance && !remplacements.has(p.pid)) remplacements.set(p.pid, p.cree);
    }
    const racine = candidats.get(chrome.pid);
    if (racine && suivis.get(chrome.pid) === undefined) suivis.set(chrome.pid, racine.cree);
    for (let n = -1; n !== suivis.size;) {
      n = suivis.size;
      for (const p of candidats.values()) {
        if (suivis.has(p.pid)) continue;
        const parentSuivi = suivis.get(p.parent);
        if (parentSuivi === undefined) continue;
        const naissanceParent = candidats.get(p.parent)?.cree ?? parentSuivi;
        const remplacement = remplacements.get(p.parent);
        if (p.cree < naissanceParent - tolerance || (remplacement !== undefined && p.cree >= remplacement - tolerance)) continue;
        suivis.set(p.pid, p.cree);
      }
    }
    return [...candidats.values()].filter((p) => suivis.has(p.pid));
  };
  suivre(avant);
  const lireHeure = () => {
    const t = horloge();
    if (!Number.isFinite(t)) throw new Error('killChromeTree : horloge non finie');
    return t;
  };
  const debut = lireHeure();
  let r;
  if (plateforme === 'win32') {
    r = executer('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { encoding: 'utf8' });
  } else {
    for (const pid of [...suivis.keys()].reverse()) {
      try { tuerPid(pid); } catch (e) { if (e.code !== 'ESRCH') throw e; }
    }
  }
  const fin = lireHeure() + attenteMs;
  let survivants;
  for (;;) {
    const apres = validerProcessus(observer());
    const maintenant = lireHeure();
    survivants = suivre(apres, debut);
    if (!survivants.length) return { racine: chrome.pid, observes: [...suivis.keys()], survivants: [] };
    if (maintenant >= fin) break;
    patienter(Math.min(50, fin - maintenant));
    if (lireHeure() <= maintenant) throw new Error('killChromeTree : horloge sans progression après attente');
  }
  throw new Error(`killChromeTree : processus survivants ${survivants.map((p) => p.pid).join(', ')} après arrêt de ${chrome.pid} (code ${r?.status ?? 'signal'}) et ${attenteMs} ms d’attente — ${r?.stderr || r?.stdout || ''}`);
}

/**
 * Filet de sécurité process-wide : tout Chrome spawné par ce module qui survivrait à un chemin
 * d'échec non couvert (script tiers oubliant son try/finally, SIGTERM d'un lanceur à délai, rendu en sortie) est tué
 * + son profil purgé à la sortie du process — jamais de fuite silencieuse. `process.on('exit')` est SYNCHRONE : l'arrêt
 * (`killChromeTree`) et la purge (`purgerProfil`, retentée jusqu'à `ATTENTE_EXTINCTION_MS`) y attendent
 * en synchrone (`attendreSync`).
 */
const activeChildren = new Set();

/** Le filet de sortie sur `enfants` : chaque Chrome tué, chaque profil supprimé ; un échec est NOMMÉ
 *  (`signaler`) et n'arrête pas les suivants. Rend la liste des échecs. */
export function nettoyerALaSortie(enfants, { tuer = killChromeTree, supprimer = (p) => { if (!purgerProfil(p)) throw new Error(`toujours présent après ${ATTENTE_EXTINCTION_MS} ms`); }, signaler = (m) => console.error(m) } = {}) {
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
process.on('SIGTERM', () => process.exit(143));

/** `resoudreChrome` sur le disque et l'environnement réels. */
const chromeDeLaMachine = (explicite) =>
  resoudreChrome({ explicite, env: process.env, fs: { existe: existsSync, lister: readdirSync }, uid: process.getuid?.(), plateforme: process.platform });

/** Le port et l'URL WebSocket du navigateur qui tient le profil `profile`, lus dans le `DevToolsActivePort` que
 *  Chrome lancé avec `--remote-debugging-port=0` y écrit (le port, puis le chemin du WebSocket du navigateur),
 *  attendu `timeoutMs` au plus : un fichier absent, vide ou d'une seule ligne s'attend. */
export async function lireDevToolsActivePort(profile, timeoutMs = 10000, { lire = (chemin) => readFileSync(chemin, 'utf8') } = {}) {
  const fichier = join(profile, 'DevToolsActivePort');
  const deadline = Date.now() + timeoutMs;
  let lu = 'absent';
  while (Date.now() < deadline) {
    try {
      const [ligne1 = '', ligne2 = ''] = lire(fichier).split('\n').map((l) => l.trim());
      const port = Number(ligne1);
      if (Number.isInteger(port) && port > 0 && ligne2.startsWith('/')) return { port, wsUrl: `ws://127.0.0.1:${port}${ligne2}` };
      lu = JSON.stringify(`${ligne1}\n${ligne2}`.trim());
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
    await sleep(250);
  }
  throw new Error(`Chrome (CDP) : ${fichier} sans ses deux lignes (port, chemin du WebSocket) après ${timeoutMs}ms — dernière lecture : ${lu}`);
}

/** Préfixe des profils Chrome JETABLES du kit, sous `os.tmpdir()` — la purge des orphelins le lit. */
export const PREFIXE_PROFIL = 'recette-cdp-profile-';

/** Nom d'un profil : il porte le PID du process qui lance Chrome (`p<pid>`) et sa naissance (`Date.now()`,
 *  posé par ce process), relus par `purgerProfilsOrphelins` (#2603). */
export const nomDeProfil = (pid) => `${PREFIXE_PROFIL}p${pid}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

/** Le lanceur consigné dans un nom de profil (`nomDeProfil`) : `{ pid, naissance }`, ou `null` si le nom n'en porte pas (#2603). */
export function pidDeProfil(nom) {
  const m = new RegExp(`^${PREFIXE_PROFIL}p(\\d+)-(\\d+)-`).exec(nom);
  return m ? { pid: Number(m[1]), naissance: Number(m[2]) } : null;
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
  if (!session.profile) throw new Error('dernierTelechargement : la session ne porte aucun profil');
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

/** Le disque réel, utilisé pour lire les téléchargements et purger les profils Chrome. */
export const DISQUE = Object.freeze({
  existe: existsSync,
  lister: readdirSync,
  lire: (chemin) => readFileSync(chemin, 'utf8'),
  dater: (chemin) => statSync(chemin).mtimeMs,
  lireLien: (chemin) => {
    try { return readlinkSync(chemin); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
  },
  supprimer: (chemin) => rmSync(chemin, { recursive: true, force: true }),
});

/** Codes d'une suppression REFUSÉE parce qu'un handle est encore tenu (Windows, après la mort de Chrome). */
const CODES_HANDLE_TENU = Object.freeze(['EBUSY', 'EPERM', 'ENOTEMPTY']);

/**
 * Supprime un profil temporaire CDP et VÉRIFIE qu'il n'existe plus : Windows retient des handles
 * quelques instants après la mort de Chrome (EBUSY/EPERM), on réessaie à pas croissants jusqu'à
 * l'échéance `echeanceMs`. SYNCHRONE : le filet de sortie (`process.on('exit')`) la joue aussi. Rend
 * `true` si le dossier est absent à la fin, `false` sinon — jamais une purge supposée.
 */
export function purgerProfil(profil, { echeanceMs = ATTENTE_EXTINCTION_MS, pasMs = 100, disque = DISQUE, horloge = Date.now, patienter = attendreSync } = {}) {
  const fin = horloge() + echeanceMs;
  for (let i = 1; ; i++) {
    try {
      disque.supprimer(profil);
    } catch (e) {
      if (!CODES_HANDLE_TENU.includes(e.code)) throw e;
    }
    if (!disque.existe(profil)) return true;
    const reste = fin - horloge();
    if (reste <= 0) return false;
    patienter(Math.min(pasMs * i, reste));
  }
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
 * Les VUES DE RÉFÉRENCE de toute recette (#1847), lues à leur source UNIQUE
 * `scripts/recette/vues-recette.json` — jamais recopiées : trois adresses divergeaient (1440×900,
 * 1600×900, `HEIGHT = 800`) et aucune ne rendait l'écran de l'utilisateur. Mesure du 2026-09-20 :
 * 2560×1440 à 150 % = 1707×960px CSS, `availHeight` 912, fenêtre Chrome utile ≈ 745-780px.
 */
export const VUES_RECETTE = JSON.parse(
  readFileSync(fileURLToPath(new URL('./vues-recette.json', import.meta.url)), 'utf8'),
);

/** Une vue par son nom (`bureau`, `portable`) — lève sur un nom inconnu plutôt que de
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
 * Déroule `fn({ nom, largeur, hauteur })` sur CHACUNE des vues, viewport posé et laissé au
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
 * écrans. Une recette responsive passe sa vue explicitement (`pourChaqueVue`, `setViewport`).
 * `args` : des drapeaux de Chrome propres à la recette (le WebGL logiciel de l'hôte Godot, `hotes/godot/recette.mjs`).
 */
export async function launchSession({ chromePath, width = VUE_REFERENCE.largeur, height = VUE_REFERENCE.hauteur, timeoutMs = 10000, args = [] } = {}) {
  const lancement = chromeDeLaMachine(chromePath);
  const profile = join(os.tmpdir(), nomDeProfil(process.pid));
  mkdirSync(profile, { recursive: true });
  const chrome = spawn(lancement.chemin, [
    ...lancement.args, '--headless=new', '--mute-audio', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`, '--no-first-run', '--no-default-browser-check', ...args, 'about:blank',
  ], { ...OPTIONS_SPAWN_CHROME });
  const childEntry = { chrome, profile };
  activeChildren.add(childEntry);

  // Tout échec APRÈS le spawn (avant qu'un `session` ne soit rendu à l'appelant, donc avant qu'il
  // puisse appeler `session.close()`) doit tuer ce Chrome et purger son profil ici — sinon fuite.
  try {
    const { port, wsUrl } = await lireDevToolsActivePort(profile, timeoutMs); // même délai réglable que l’amorçage de l’app
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

    const session = brancherCdp(ws, { chrome, profile, port });

    const { targetId } = await session.rpc('Target.createTarget', { url: 'about:blank' });
    session.targetId = targetId;
    const { sessionId } = await session.rpc('Target.attachToTarget', { targetId, flatten: true });
    session.sessionId = sessionId;

    await session.rpc('Page.enable');
    await session.rpc('Runtime.enable');
    await session.rpc('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: 1, mobile: false,
    });
    // Les téléchargements vont DANS le profil jetable (`dernierTelechargement`) : purgés avec lui.
    const telechargements = join(profile, DOSSIER_TELECHARGEMENTS);
    mkdirSync(telechargements, { recursive: true });
    await session.rpcNavigateur('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: telechargements });

    /** Ferme le target CDP + tue le process Chrome + purge le profil temp (toujours appeler en fin de
     *  script). Rend `{ profilPurge }` : la purge est VÉRIFIÉE (`purgerProfil`), jamais supposée. */
    session.close = async () => {
      try {
        await session.rpcNavigateur('Target.closeTarget', { targetId: session.targetId });
      } catch (e) {
        if (!cibleDejaPartie(e)) throw e;
      }
      ws.close();
      killChromeTree(chrome);
      await attendreSortie(chrome);
      const profilPurge = purgerProfil(profile);
      activeChildren.delete(childEntry);
      return { profilPurge };
    };

    return session;
  } catch (e) {
    await leverApresNettoyage(e, async () => {
      killChromeTree(chrome);
      await attendreSortie(chrome);
      purgerProfil(profile);
      activeChildren.delete(childEntry);
    });
  }
}

/** L'erreur PRINCIPALE et celle du NETTOYAGE qui l'a suivie, JOINTES (`AggregateError`, message et
 *  `code` de la principale en tête) : aucune n'avale l'autre. */
function joindre(principale, nettoyage) {
  const e = new AggregateError([principale, nettoyage], `${principale.message} — et le nettoyage a échoué : ${nettoyage.message}`, { cause: principale });
  if (principale.code) e.code = principale.code;
  return e;
}

/** `erreur` PORTE-t-elle déjà `r` : elle-même, sa `cause` ou ses `errors` (`joindre`), en profondeur. */
function porteErreur(erreur, r) {
  return erreur === r || (erreur instanceof Error && ((erreur.cause !== undefined && porteErreur(erreur.cause, r)) || (erreur instanceof AggregateError && erreur.errors.some((x) => porteErreur(x, r)))));
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
 * attachée, `rpcNavigateur` jamais (niveau navigateur : `Target.*`).
 */
export function brancherCdp(ws, champs = {}) {
  let id = 0;
  const pending = new Map();
  const listeners = new Set();
  let plantee = false;
  const pagePlantee = () => Object.assign(new Error('la page a planté (Inspector.targetCrashed) : son processus de rendu est mort'), { code: PAGE_PLANTEE });
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
    // Page PLANTÉE (son processus de rendu est mort) : Chrome ne répond plus à aucun appel adressé à sa
    // session. Ceux en vol sont rejetés TYPÉS, ceux à venir le sont à l'envoi (`envoyer`).
    if (m.method === 'Inspector.targetCrashed' && m.sessionId === session.sessionId) {
      plantee = true;
      for (const [mid, { reject, sessionId }] of pending) {
        if (sessionId !== session.sessionId) continue;
        pending.delete(mid);
        reject(pagePlantee());
      }
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
    if (plantee && sessionId) { reject(pagePlantee()); return; }
    const mid = ++id;
    const msg = { id: mid, method, params };
    if (sessionId) msg.sessionId = sessionId;
    pending.set(mid, { resolve, reject, sessionId });
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

/** Attend qu'une expression JS devienne vraie (poll), lève si le délai expire. `evaluerMs` borne chaque évaluation
 *  (`evaluate`) : une page dont le fil est tenu plus longtemps (un GLB lu par l'hôte Godot) l'élargit. */
export async function waitFor(session, expression, { timeoutMs = 8000, intervalMs = 200, evaluerMs = DELAI_EVALUATE } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await evaluate(session, expression, { timeoutMs: evaluerMs })) return true;
    if (Date.now() >= deadline) throw Object.assign(new Error(`Condition jamais vraie après ${timeoutMs}ms : ${expression}`), { code: ATTENTE_ECHUE });
    await sleep(intervalMs);
  }
}

/** Code de l'erreur d'une attente (`waitFor`) arrivée à échéance sans que la condition soit vraie. */
export const ATTENTE_ECHUE = 'ATTENTE_ECHUE';

/**
 * Capture un PNG nommé dans `dir` (créé si absent) — retourne le chemin écrit.
 * `ancre` (sélecteur) fait DÉFILER l'élément en vue avant la capture : aux largeurs étroites les écrans
 * s'empilent et le sujet d'une recette se retrouve sous le pli — une capture le montrerait absent alors qu'il est
 * seulement plus bas.
 *
 * Par défaut, la capture ne CHANGE RIEN à l'état qu'elle capture (#2001 E : le retrait du focus
 * fermait le tiroir du journal avant la photo). La NEUTRALISATION se DEMANDE (`neutraliser: true`) :
 * le popup d'un `<select>` est NATIF (hors DOM) et reste ouvert au-dessus de la page après un
 * `selectOption` — `Escape` UNIQUEMENT quand le focus est sur un `<select>`, jamais à l'aveugle (une
 * modale capturée se fermerait sous elle) — puis le focus est retiré, dont l'anneau signe la capture.
 * Ce retrait MUTE l'écran : tout ce qui se ferme à la perte du focus se ferme avec lui.
 */
export async function shot(session, name, dir = DOSSIER_CAPTURES, { ancre, neutraliser = false } = {}) {
  dir = validerDossierCaptures(dir);
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
 * buffer de navigation appartient à la seule session courante.
 */
export function consoleGuard(session) {
  const entries = [];
  const handler = (m) => {
    if (m.sessionId !== session.sessionId) return;
    const e = entreeDeConsole(m);
    if (!e) return;
    entries.push(e);
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

/** Force `prefers-reduced-motion: reduce` côté page (CDP `Emulation.setEmulatedMedia`). */
export async function emulateReducedMotion(session) {
  await session.rpc('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
}

/** Redimensionne le viewport. */
export async function setViewport(session, width, height) {
  await session.rpc('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: false,
  });
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
 * Plusieurs boutons correspondants sont refusés avant tout événement : préciser `dans` ou `rangee`.
 *
 * `dans` = sélecteur de la racine où chercher lorsque le même libellé apparaît dans deux zones.
 * Par exemple, un bouton « Fermer » peut apparaître dans une boîte de dialogue et dans le bandeau.
 *
 *
 * `rangee` = texte d'une RANGÉE (sous-chaîne, mêmes normalisations) : quand chaque rangée d'une liste
 * porte le même bouton (cinq « Choisir » dans la modale « Choisir la campagne »), seuls comptent les
 * boutons de la rangée qui porte ce texte — l'ancêtre le plus proche de ce texte qui contient un
 * bouton candidat. Ni `dans` ni `exact` ne départagent des boutons de même libellé dans la même racine.
 *
 * `modifiers` = les touches TENUES pendant le clic (`MOD_ALT`), même paramètre que `survoler`.
 *
 * `attendreChangement` (`true` = `DELAI_CHANGEMENT`, ou un délai en ms) : LÈVE si le DOM ne
 * change pas dans le délai qui suit le clic (`avecEffet`, friction #2290).
 *
 * Le texte cherché est confronté au NOM ACCESSIBLE du contrôle (`CORPS_NOM_ACCESSIBLE` : `aria-label`
 * explicite, sinon texte ; `title` si le nom obtenu est vide). Un portrait `button.ptile` peut
 * porter ses Blessures en texte ; son `aria-label` nomme le héros et le geste. `attenteMs` : l'attente de la
 * cible et d'un recouvrement transitoire. C'est `geste` sur `{ nom, dans, rangee, exact }`.
 */
export async function clickButtonByText(session, texte, { exact = true, dans, rangee, modifiers = 0, attendreChangement = false, attenteMs = ATTENTE_CIBLE, delaiEntreeMs = DELAI_ENTREE } = {}) {
  return geste(session, { nom: texte, exact, dans, rangee }, { qui: 'clickButtonByText', attenteMs, delaiEntreeMs },
    (loc, emettre) => avecEffet(session, `clickButtonByText « ${texte} »`, attendreChangement, () => clic({ modifiers })(loc, emettre)));
}

/** Délai par défaut de `attendreChangement` (`clickButtonByText`, `cliquerSelecteur`). */
export const DELAI_CHANGEMENT = 2000;

/** Hachage (PURE, expression-fonction de page) d'une chaîne en court jeton base 36 — djb2 : les
 *  empreintes de page (`EMPREINTE_PAGE`) se comparent, jamais se lisent. */
const FN_HACHER = `(s) => { let x = 5381; for (let i = 0; i < s.length; i++) x = ((x * 33) ^ s.charCodeAt(i)) >>> 0; return x.toString(36); }`;

/** Attributs de rendu qui peuvent changer à chaque image : compteur d’images et file du canevas.
 *  L’empreinte les ignore pour détecter l’effet du geste. */
export const ATTRIBUTS_VOLATILS = Object.freeze(['data-rendus', 'data-file']);
/** Marque de localisation, exclue de l’empreinte de page ; le contrôle de cible la retire. */
const ATTR_CIBLE = 'data-recette-cible';
const MOTIF_VOLATILS = `\\s(?:${[...ATTRIBUTS_VOLATILS, ATTR_CIBLE].join('|')})="[^"]*"`;

/** Empreinte du DOM (`body.innerHTML`, sans les attributs volatils ni la marque de ciblage). */
const EMPREINTE_PAGE = `(() => {
  const hacher = ${FN_HACHER};
  const dom = (document.body ? document.body.innerHTML : '').replace(new RegExp(${JSON.stringify(MOTIF_VOLATILS)}, 'g'), '');
  return hacher(dom);
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
    if (Date.now() >= fin) throw new Error(`${qui} : le clic n'a RIEN changé, le DOM n'a pas bougé en ${delai} ms`);
    await sleep(100);
  }
}

// ─────────────────────────── GESTES D'ENTRÉE : un émetteur, une cible (#1953) ───────────────────────────
//
// `geste` est le SEUL émetteur d'événements souris et tactiles du kit, `frappe` le seul émetteur
// clavier : l'émetteur BRUT du CDP (`emetteursBruts`, posé par `brancherCdp`) n'est lu que par eux, et
// `session.rpc` refuse le domaine `Input` (garde `scripts/guards/lib/emetteurEntreeExclusivity.mjs`).

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
 * CLIC RÉEL d'un contrôle désigné par un SÉLECTEUR — le pendant de `clickButtonByText` quand le
 * contrôle n'a pas de texte (un bouton à GLYPHE : tiroir du journal, menu ☰, ouvreur d'écran).
 * `geste` sur `{ selecteur }` : la cible attendue jusqu'à `attenteMs`, unique, ouverte, atteinte au
 * point. `attendreChangement` : même option que `clickButtonByText` (`avecEffet`).
 * @returns {Promise<{ x: number, y: number, label: string, ferme: null }>}
 */
export async function cliquerSelecteur(session, selecteur, { modifiers = 0, attendreChangement = false, attenteMs = ATTENTE_CIBLE, delaiEntreeMs = DELAI_ENTREE } = {}) {
  return geste(session, { selecteur }, { qui: 'cliquerSelecteur', attenteMs, delaiEntreeMs },
    (loc, emettre) => avecEffet(session, `cliquerSelecteur « ${selecteur} »`, attendreChangement, () => clic({ modifiers })(loc, emettre)));
}

/** Item de liste sans rôle interactif : `selecteur` délimite les items, `nom` leur texte propre. */
export async function clickItemByText(session, texte, { selecteur, nom, dans, exact = true, modifiers = 0, attenteMs = ATTENTE_CIBLE, delaiEntreeMs = DELAI_ENTREE } = {}) {
  if (!selecteur) throw new Error('clickItemByText : { selecteur } des items obligatoire');
  return geste(session, { nom: texte, selecteur, libelle: nom, dans, exact }, { qui: 'clickItemByText', attenteMs, delaiEntreeMs }, clic({ modifiers }));
}

/** Les contrôles qu'un localisateur par TEXTE vise — SOURCE UNIQUE (`geste` sur `{ nom }` sans
 *  `selecteur`) : un `<summary>` de `<details>` est un contrôle (« + Op mécanique », `AddMenu`). */
export const SELECTEUR_CONTROLES = 'button, [role="button"], summary';

/** Les CHAMPS d'un formulaire : leur nom accessible vient de leur `<label>` (`champParLibelle`). */
const SELECTEUR_CHAMPS = 'input, select, textarea';

/** `nomAccessible(el)` (fonction de PAGE, `norm` en portée) : le NOM d'un contrôle désigné par texte —
 *  son `aria-label` explicite, sinon texte (pour un CHAMP, le texte de son premier `<label>`, champs
 *  imbriqués retirés) ; `title` si le nom est vide. SOURCE UNIQUE des localisateurs par TEXTE
 *  (`CORPS_NOM_ACCESSIBLE` dans une expression, `pageLocaliser`). */
const FN_NOM_ACCESSIBLE = `(b) => norm(b.getAttribute('aria-label')) || norm(b.matches('${SELECTEUR_CHAMPS}') ? (() => { const l = b.labels && b.labels[0] ? b.labels[0].cloneNode(true) : null; if (l) l.querySelectorAll('${SELECTEUR_CHAMPS}').forEach((c) => c.remove()); return l ? l.textContent : ''; })() : b.textContent) || norm(b.getAttribute('title'))`;
const CORPS_NOM_ACCESSIBLE = `const nomAccessible = ${FN_NOM_ACCESSIBLE};`;

/** `nommer(el)` (fonction de PAGE) : le NOM d'un élément, `tag#id.classe…` (classe SVG comprise), lisible
 *  même sans texte. SOURCE UNIQUE (`pageLocaliser`, `pageControler`, `frappe`,
 *  les scripts de pilotage). */
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
const nouveauJeton = () => `c${process.pid}-${++compteurJetons}`;

/** Délai par défaut d'une ATTENTE de cible (`attenteMs` : apparition, recouvrement transitoire). */
export const ATTENTE_CIBLE = 8000;

/** Forme EXPLICITE d'une cible de geste, validée avant toute lecture de page. */
function formeDeCible(cible, qui) {
  const o = cible && typeof cible === 'object' ? cible : null;
  const ok = o && (o.surface !== undefined
    ? typeof o.surface === 'string' && Number.isFinite(o.x) && Number.isFinite(o.y)
    : o.nom !== undefined ? typeof o.nom === 'string' && o.nom !== '' : typeof o.selecteur === 'string' && o.selecteur !== '');
  if (!ok) throw new Error(`${qui} : cible ${JSON.stringify(cible)} — formes admises : { nom, selecteur?, libelle? | propre?, dans?, rangee?, exact? } · { selecteur, dans? } · { surface, x, y } — aucun événement émis`);
  return o;
}

/** Libellé d'une cible dans une levée. */
const decrireCible = (c) => c.surface !== undefined
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
 *  rend le `jeton` posé, `null` si la cible est absente et lève si plusieurs candidats correspondent. */
async function marquer(session, cible, qui) {
  const jeton = nouveauJeton();
  const loc = await evaluerFn(session, pageLocaliser, formeDeCible(cible, qui), jeton, ATTR_CIBLE, qui, false, 'aucun', SELECTEUR_CONTROLES, FN_NOM_ACCESSIBLE, FN_COUCHE, FN_NOMMER_ELEMENT);
  return loc.absente ? null : jeton;
}

/** Sélecteur de l'élément marqué `jeton`. */
const marqueDe = (jeton) => `[${ATTR_CIBLE}="${jeton}"]`;

/** Retire la marque `jeton` d'une cible dont le geste n'aura pas lieu. */
const retirerJeton = (session, jeton) => evaluerFn(session, (jeton, attr) => { for (const v of document.querySelectorAll('[' + attr + '="' + jeton + '"]')) v.removeAttribute(attr); }, jeton, ATTR_CIBLE);

/** LOCALISE la cible (`pageLocaliser`), en attendant son APPARITION jusqu'à `attenteMs` ; LÈVE au nom
 *  du geste `qui` si elle reste absente, ou si elle n'a ni boîte ni partie visible. */
async function localiser(session, cible, { jeton, qui, defiler = true, point = 'centre', attenteMs = ATTENTE_CIBLE }) {
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
async function controler(session, x, y, { jeton, libelle, qui, intention, attenteMs, mode }) {
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

/** CLIC DROIT réel sur une `cible` (`geste`) : le navigateur en tire le `contextmenu`. */
export async function clicDroit(session, cible, { defiler = true, modifiers = 0, intention = 'agir', delaiEntreeMs = DELAI_ENTREE } = {}) {
  return geste(session, cible, { qui: 'clicDroit', intention, defiler, delaiEntreeMs }, clic({ bouton: 'right', modifiers }));
}

/** APPUI LONG réel à la souris : bouton gauche TENU `ms` millisecondes sur la `cible` (`geste`). */
export async function appuiLong(session, cible, ms = 800, { defiler = true, modifiers = 0, intention = 'agir', delaiEntreeMs = DELAI_ENTREE } = {}) {
  return geste(session, cible, { qui: 'appuiLong', intention, defiler, delaiEntreeMs }, clic({ dureeMs: ms, modifiers }));
}

/**
 * TOUCHER réel (`touchStart`, puis `touchEnd` après `dureeMs`) sur une `cible` (`geste`). Intention
 * `agir` par défaut ; `{ intention: 'lire' }` touche un contrôle refusé pour en lire la raison
 * (`GatedAction` : le refus se lit au doigt). LIMITE mesurée (#1822) : l'émulation tactile du CDP
 * n'émet ni `contextmenu` ni `pointercancel` pendant un appui long.
 */
export async function toucher(session, cible, { dureeMs = 0, defiler = true, intention = 'agir', delaiEntreeMs = DELAI_ENTREE } = {}) {
  return geste(session, cible, { qui: 'toucher', intention, defiler, delaiEntreeMs }, async ({ x, y }, emettre) => {
    await emettre('tactile', { type: 'touchStart', touchPoints: [{ x, y }] });
    if (dureeMs > 0) await sleep(dureeMs);
    await emettre('tactile', { type: 'touchEnd', touchPoints: [] });
  });
}

/**
 * MOLETTE RÉELLE (`mouseWheel`) de `deltaY` px sur une `cible` (`geste`), au centre de sa partie
 * VISIBLE, le pointeur d'abord posé là (`mouseMoved`) comme la main d'un joueur : un canevas Godot Web
 * tourne la molette au dernier point du pointeur, pas à celui de l'événement (#3086). Sans
 * `scrollIntoView` : c'est la molette qui fait défiler. Le cran est contrôlé par COUCHE : l'élément au
 * point doit être de la même couche défilante que la cible. `crans` crans tournés d'un même geste, au
 * même point. Intention `lire` par défaut. Rend la localisation.
 */
export async function molette(session, cible, deltaY, { deltaX = 0, crans = 1, intention = 'lire', delaiEntreeMs = DELAI_ENTREE } = {}) {
  return geste(session, cible, { qui: 'molette', intention, defiler: false, point: 'visible', controle: 'couche', delaiEntreeMs }, async ({ x, y }, emettre) => {
    await emettre('souris', { type: 'mouseMoved', x, y });
    for (let n = 0; n < crans; n++) await emettre('souris', { type: 'mouseWheel', x, y, deltaX, deltaY });
  });
}

/**
 * AMÈNE `selecteur` à l'écran par la MOLETTE : chaque cran (`pasPx` au plus) tourne au centre de la
 * partie visible de la COUCHE de la cible (son premier ancêtre défilant, la fenêtre à défaut), vers
 * elle, jusqu'à ce qu'elle y tienne. Chaque cran est un `geste` contrôlé par couche. LÈVE en le
 * nommant : élément absent, boîte nulle, hors fenêtre, autre couche, molette FIGÉE, ou `maxPas`
 * crans épuisés. Rend le centre de l'élément.
 */
async function amenerParMolette(session, selecteur, { pasPx = 240, maxPas = 40, pauseMs = 80, attenteMs = ATTENTE_CIBLE, delaiEntreeMs = DELAI_ENTREE } = {}) {
  let ecartPrecedent = null;
  for (let k = 0; ; k++) {
    const loc = await geste(session, { selecteur }, { qui: 'deplierVers', intention: 'lire', defiler: false, point: 'defilant', controle: 'couche', attenteMs, delaiEntreeMs }, async (l, emettre) => {
      if (l.visible) return;
      if (ecartPrecedent !== null && Math.abs(l.ecart - ecartPrecedent) < 1) {
        throw new Error(`deplierVers : FIGÉ — la molette ne fait plus défiler vers « ${selecteur} » (écart figé à ${Math.round(l.ecart)} px)`);
      }
      if (k >= maxPas) throw new Error(`deplierVers : « ${selecteur} » toujours hors de vue après ${maxPas} crans de molette`);
      await emettre('souris', { type: 'mouseWheel', x: l.x, y: l.y, deltaX: 0, deltaY: Math.sign(l.ecart) * Math.min(pasPx, Math.abs(l.ecart)) });
    });
    if (loc.visible) return loc.centre;
    ecartPrecedent = loc.ecart;
    await sleep(pauseMs);
  }
}

/** Marque du `<summary>` que `deplierVers` ouvre (distincte de la marque de cible du geste). */
const ATTR_DEPLIER = 'data-recette-deplier';

/**
 * DÉPLIE vers `selecteur` comme un joueur : chaque `<details>` FERMÉ qui l'enveloppe s'ouvre, du plus
 * extérieur au plus intérieur, par un CLIC RÉEL sur son `<summary>` (amené à l'écran par la molette) ;
 * puis `selecteur` est amené à l'écran par la molette (`amenerParMolette`) — jamais `scrollIntoView`,
 * qui ne ramène pas un champ d'un `<details>` replié (#1853 L3). LÈVE si `selecteur` désigne plusieurs
 * éléments, si un `<details>` n'a pas de `<summary>`, ou si le clic n'ouvre pas le sien. Rend le
 * centre de `selecteur`.
 */
export async function deplierVers(session, selecteur, options = {}) {
  let precedent = null;
  for (;;) {
    const jeton = nouveauJeton();
    const cible = await marquer(session, { selecteur }, 'deplierVers');
    const r = !cible ? { absente: true } : await evaluerFn(session, (marque, attrCible, jeton, attr) => {
      const el = document.querySelector(marque);
      el.removeAttribute(attrCible);
      let ferme = null;
      for (let a = el.parentElement; a; a = a.parentElement) if (a.tagName === 'DETAILS' && !a.open) ferme = a;
      if (!ferme) return { deplie: true };
      const s = Array.from(ferme.children).find((x) => x.tagName === 'SUMMARY');
      if (!s) return { sansSommaire: true };
      for (const v of document.querySelectorAll('[' + attr + ']')) v.removeAttribute(attr);
      s.setAttribute(attr, jeton);
      return { sommaire: (s.textContent || '').replace(/\s+/g, ' ').trim() };
    }, marqueDe(cible), ATTR_CIBLE, jeton, ATTR_DEPLIER);
    if (r.absente) throw new Error(`deplierVers : « ${selecteur} » absent du DOM`);
    if (r.deplie) return amenerParMolette(session, selecteur, options);
    if (r.sansSommaire) throw new Error(`deplierVers « ${selecteur} » : un <details> fermé qui l'enveloppe n'a aucun <summary> à cliquer`);
    if (r.sommaire === precedent) throw new Error(`deplierVers « ${selecteur} » : le clic sur « ${r.sommaire} » n'a pas ouvert son <details>`);
    precedent = r.sommaire;
    const sommaire = `[${ATTR_DEPLIER}=${JSON.stringify(jeton)}]`;
    await amenerParMolette(session, sommaire, options);
    await geste(session, { selecteur: sommaire }, { qui: 'deplierVers', defiler: false, attenteMs: options.attenteMs, delaiEntreeMs: options.delaiEntreeMs }, clic());
    await sleep(options.pauseMs ?? 80);
  }
}

/** Le PREMIER des `libelles` (ordre de préférence) que porte un des `offerts` (sous-chaîne), ou `null`. */
const premierLibelleOffert = (libelles, offerts) => libelles.map((l) => offerts.find((t) => t.includes(l))).find(Boolean) ?? null;

function browserControlesVisibles(racine, selecteur, nomAccessible) {
  const controles = [];
  for (const el of racine.querySelectorAll(selecteur)) {
    const r = el.getBoundingClientRect();
    let gauche = Math.max(0, r.left ?? r.x), haut = Math.max(0, r.top ?? r.y);
    let droite = Math.min(window.innerWidth, r.right ?? r.x + r.width), bas = Math.min(window.innerHeight, r.bottom ?? r.y + r.height);
    let visible = r.width > 0 && r.height > 0;
    for (let a = el; visible && a; a = a.parentElement) {
      const style = getComputedStyle(a);
      if (a.hidden || a.hasAttribute('inert') || style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || (style.opacity !== '' && Number(style.opacity) === 0)) visible = false;
      if (a.tagName === 'DETAILS' && !a.open) {
        const summary = a.querySelector(':scope > summary');
        if (!summary || (summary !== el && !summary.contains(el))) visible = false;
      }
      if (a !== el) {
        const clipX = /^(auto|scroll|hidden|clip)$/.test(style.overflowX || style.overflow);
        const clipY = /^(auto|scroll|hidden|clip)$/.test(style.overflowY || style.overflow);
        if (clipX || clipY) {
          const p = a.getBoundingClientRect();
          const sx = a.offsetWidth ? p.width / a.offsetWidth : 1, sy = a.offsetHeight ? p.height / a.offsetHeight : 1;
          const x = (p.left ?? p.x) + a.clientLeft * sx, y = (p.top ?? p.y) + a.clientTop * sy;
          if (clipX) { gauche = Math.max(gauche, x); droite = Math.min(droite, x + (a.offsetWidth ? a.clientWidth * sx : p.width)); }
          if (clipY) { haut = Math.max(haut, y); bas = Math.min(bas, y + (a.offsetHeight ? a.clientHeight * sy : p.height)); }
        }
      }
    }
    if (!visible || droite <= gauche || bas <= haut) continue;
    controles.push({
      el, nom: nomAccessible(el), tag: el.tagName.toLowerCase(),
      aria: { label: el.getAttribute('aria-label'), disabled: el.getAttribute('aria-disabled'), pressed: el.getAttribute('aria-pressed'), expanded: el.getAttribute('aria-expanded') },
      rect: { x: gauche, y: haut, width: droite - gauche, height: bas - haut },
      ouvert: !el.disabled && el.getAttribute('aria-disabled') !== 'true',
    });
  }
  return controles;
}

const CORPS_CONTROLES_VISIBLES = `const observerControles = (racine) => (${browserControlesVisibles.toString()})(racine, ${JSON.stringify(SELECTEUR_CONTROLES)}, nomAccessible);`;

const expressionInventaireControles = (dans) => `(() => {
  const racine = document.querySelector(${JSON.stringify(dans)});
  if (!racine) throw new Error('controlesVisibles : racine absente « ' + ${JSON.stringify(dans)} + ' »');
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').replace(/[\\u2019']/g, "'").trim();
  ${CORPS_NOM_ACCESSIBLE}
  ${CORPS_CONTROLES_VISIBLES}
  return observerControles(racine).map((c) => ({ nom: c.nom, tag: c.tag, aria: c.aria, rect: c.rect, ouvert: c.ouvert }));
})()`;

export async function controlesVisibles(session, { dans = 'body' } = {}) {
  return evaluate(session, expressionInventaireControles(dans));
}

const expressionControlesOuverts = (dans) => `(${expressionInventaireControles(dans)}).filter((c) => c.ouvert && c.nom).map((c) => c.nom)`;

/**
 * CLIQUE le premier des `libelles` (ordre de préférence) qu'offre un contrôle OUVERT de `dans` — le
 * geste d'une fenêtre qu'on fait avancer, quitte ou referme par la liste de ses issues. `offerts` :
 * les textes déjà lus par l'appelant (sinon lus ici). Rend le texte cliqué ; sans aucun libellé
 * offert, LÈVE en nommant les contrôles ouverts — aucun clic émis. `attenteMs` : l'attente d'un
 * recouvrement transitoire (`geste`).
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
 * SURVOL RÉEL (`mouseMoved`) d'une `cible` (`geste`) — le geste par lequel une raison de refus se
 * lit (arbitrage user 2026-08-24 : au survol/focus/tap, jamais inline). Intention `lire` par défaut :
 * un contrôle refusé (`aria-disabled`, `GatedAction`) est survolé, et sa fermeture rendue
 * (`ferme: { mecanisme, raison }`) ; `{ intention: 'agir' }` le refuse.
 *
 * `attenteMs` laisse l'infobulle s'ouvrir (elle naît sur `pointerenter`, pas au rendu suivant).
 * `modifiers` porte les touches TENUES pendant le geste (`MOD_ALT` sous un Alt maintenu) : sans lui,
 * l'événement dirait au navigateur que la touche vient d'être relâchée.
 * `defiler: false` survole SANS `scrollIntoView` (friction #700 : le défilement du helper faussait un
 * test « le survol ne fait pas défiler ») — la cible doit alors être déjà à l'écran.
 * Une cible recouverte LÈVE en nommant le recouvreur, au lieu d'une infobulle nulle qui se lirait
 * comme un refus muet (#1953). Rend la localisation `{ x, y, ferme }`.
 */
export async function survoler(session, cible, { attenteMs = 500, modifiers = 0, defiler = true, intention = 'lire', delaiEntreeMs = DELAI_ENTREE } = {}) {
  const r = await geste(session, cible, { qui: 'survoler', intention, defiler, delaiEntreeMs }, ({ x, y }, emettre) =>
    emettre('souris', { type: 'mouseMoved', x, y, buttons: 0, modifiers }));
  await sleep(attenteMs);
  return r;
}

/**
 * L'INFOBULLE ouverte et sa position RELATIVE à la cible : `{ texte, dx, dy }` — `dx`/`dy` sont les
 * écarts entre les deux boîtes (0 quand elles se touchent ou se recouvrent sur cet axe). Une bulle
 * posée loin de sa cible est le symptôme d'un rect mesuré à 0×0 (piège vécu : `display: contents`
 * sur l'enveloppe → bulle au coin haut-gauche, (8, 6) pour un contrôle à (1050, 258)).
 * `{ texte: null }` = aucune infobulle ouverte — un refus muet, pas une erreur de recette. Deux
 * bulles ouvertes LÈVENT (localiseur unique) : une bulle périmée ne se lit pas pour la bonne.
 */
export async function infobulleDe(session, cible) {
  const jeton = nouveauJeton();
  await localiser(session, formeDeCible(cible, 'infobulleDe'), { jeton, qui: 'infobulleDe', defiler: false, attenteMs: 0 });
  let jetonBulle;
  try {
    jetonBulle = await marquer(session, { selecteur: '[role="tooltip"]' }, 'infobulleDe');
  } catch (e) {
    await leverApresNettoyage(e, () => retirerJeton(session, jeton));
  }
  return evaluerFn(session, (jeton, jetonBulle, attr) => {
    const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const el = document.querySelector('[' + attr + '="' + jeton + '"]');
    el.removeAttribute(attr);
    const bulle = jetonBulle && document.querySelector('[' + attr + '="' + jetonBulle + '"]');
    if (bulle) bulle.removeAttribute(attr);
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
  }, jeton, jetonBulle, ATTR_CIBLE);
}

/**
 * CHOISIT une option d'un `<select>` AU GESTE (`session, selecteur, valeur`) — le pendant « liste
 * déroulante » de `clickButtonByText`/`typeInField`.
 *
 * La popup native d'un `<select>` est hors DOM et peut rester ouverte en headless. Le helper
 * focalise la liste par un clic CDP, pose sa valeur par le setter natif, puis dispatche `input`
 * et `change`, sans émettre de frappe clavier. Trois étages :
 *  1. FOCUS par un vrai clic CDP (comme `typeInField`) — la liste reçoit le geste, pas le `<body>` ;
 *  2. `value` posé par le SETTER NATIF (`HTMLSelectElement.prototype.value`), jamais par un
 *     `setState` React : c'est ce qui fait voir la nouvelle valeur au `onChange` d'un champ CONTRÔLÉ ;
 *  3. `input` puis `change` dispatchés `{ bubbles: true }` — React écoute `change` sur la racine.
 *
 * L'option se désigne par son LIBELLÉ VISIBLE (défaut) ; `{ par: 'valeur' }` vise la valeur interne.
 * Plusieurs options correspondantes sont refusées AVANT le focus et tout événement.
 * Refus EXPLICITES : liste absente, aucune option ne
 * correspond (les libellés, ou les valeurs, offerts sont remontés dans le message), ou option FERMÉE
 * (`disabled`, comme un contrôle fermé de `geste`). Rend `{ valeur, libelle }` LUS après le geste —
 * un `onChange` qui refuse la valeur se voit donc au retour, jamais en silence.
 */
export async function selectOption(session, selecteur, valeur, { par = 'libelle', delaiEntreeMs = DELAI_ENTREE } = {}) {
  const liste = await marquer(session, { selecteur }, 'selectOption');
  if (!liste) throw new Error(`selectOption : aucune liste ne matche « ${selecteur} »`);
  let option;
  try {
    option = await marquer(session, par === 'valeur'
      ? { selecteur: `option[value=${JSON.stringify(String(valeur))}]`, dans: marqueDe(liste) }
      : { nom: String(valeur), selecteur: 'option', dans: marqueDe(liste) }, 'selectOption');
  } catch (e) {
    await retirerJeton(session, liste);
    throw e;
  }
  const rect = await evaluerFn(session, (marque, marqueOption, attr, par) => {
    const el = document.querySelector(marque);
    el.removeAttribute(attr);
    const choisie = marqueOption && document.querySelector(marqueOption);
    if (!choisie) return { absente: true, offertes: Array.from(el.options).map((o) => (par === 'valeur' ? o.value : (o.textContent || '').replace(/\s+/g, ' ').trim())) };
    choisie.removeAttribute(attr);
    if (choisie.disabled) return { fermee: true };
    return { valeur: choisie.value };
  }, marqueDe(liste), option && marqueDe(option), ATTR_CIBLE, par);
  if (rect.absente) throw new Error(`selectOption « ${selecteur} » : aucune option ${par === 'valeur' ? 'de VALEUR' : 'de LIBELLÉ'} « ${valeur} » — ${par === 'valeur' ? 'valeurs' : 'libellés'} offerts : ${rect.offertes.join(' | ')}`);
  if (rect.fermee) throw new Error(`selectOption « ${selecteur} » : option « ${valeur} » FERMÉE (disabled) — aucun choix émis`);
  await geste(session, { selecteur }, { qui: 'selectOption', delaiEntreeMs }, clic());
  const focalisee = await marquer(session, { selecteur }, 'selectOption');
  if (!focalisee) throw new Error(`selectOption « ${selecteur} » : la liste a quitté le DOM après le focus — aucun choix émis`);
  return evaluate(session, `(() => {
    const el = document.querySelector(${JSON.stringify(marqueDe(focalisee))});
    el.removeAttribute(${JSON.stringify(ATTR_CIBLE)});
    const choisie = Array.from(el.options).filter((o) => o.value === ${JSON.stringify(rect.valeur)});
    if (choisie.length !== 1 || choisie[0].disabled) throw new Error('selectOption : option préparée disparue, ambiguë ou fermée après le focus');
    el.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    setter.call(el, ${JSON.stringify(rect.valeur)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { valeur: el.value, libelle: (el.selectedOptions[0] || {}).textContent || '' };
  })()`);
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
 * Racine absente = `null`, comme un libellé introuvable. Plusieurs champs porteurs du libellé dans la
 * portée : LÈVE en les comptant, aucune marque posée — jamais le premier (#1969).
 */
export async function champParLibelle(session, libelle, { exact = true, dans } = {}) {
  const jeton = await marquer(session, { nom: libelle, selecteur: SELECTEUR_CHAMPS, exact, ...(dans ? { dans } : {}) }, 'champParLibelle')
  if (!jeton) return null
  const marque = `recette-champ-${Math.random().toString(36).slice(2, 8)}`
  await evaluerFn(session, (jeton, attr, marque) => {
    const el = document.querySelector('[' + attr + '="' + jeton + '"]')
    el.removeAttribute(attr)
    el.setAttribute('data-recette', marque)
  }, jeton, ATTR_CIBLE, marque)
  return `[data-recette="${marque}"]`
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
  const jeton = await marquer(session, { selecteur, ...(dans ? { dans } : {}) }, 'poserFichier');
  if (!jeton) throw new Error(`poserFichier « ${selecteur} » : aucun input${dans ? ` dans « ${dans} » (racine absente, ou input absent de la racine)` : ''}`);
  const absolu = resolve(chemin);
  try {
    await session.rpc('DOM.enable');
    const { root } = await session.rpc('DOM.getDocument', { depth: 0 });
    const { nodeId } = await session.rpc('DOM.querySelector', { nodeId: root.nodeId, selector: marqueDe(jeton) });
    if (!nodeId) throw new Error(`poserFichier « ${selecteur} » : l'input a quitté le DOM avant la pose`);
    await session.rpc('DOM.setFileInputFiles', { nodeId, files: [absolu] });
  } catch (e) {
    await leverApresNettoyage(e, () => retirerJeton(session, jeton));
  }
  await retirerJeton(session, jeton);
  return absolu;
}

/**
 * VERDICT DE DÉBORDEMENT à la largeur courante — le contrôle le plus fréquent de la règle stricte 4
 * (responsive en largeur) : un écran qui déborde ne se voit pas sur une capture, il se MESURE.
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

/**
 * Envoie une frappe RÉELLE (`frappe` : `rawKeyDown`, `char` s'il y a un texte, `keyUp`) — traverse
 * les mêmes handlers que le clavier physique (`keybindings.ts`), contrairement à un `KeyboardEvent`
 * JS synthétique (souvent ignoré par les listeners posés en natif sur `window`).
 * `focus` (un sélecteur) : la cible de la frappe, qui doit avoir le focus (`frappe`) ; sans lui, la
 * touche est GLOBALE (Échap, raccourci du jeu), sans cible contrôlée.
 * @param {{ key: string, code?: string, windowsVirtualKeyCode?: number, modifiers?: number }} touche
 * @param {{ focus?: string, delaiEntreeMs?: number }} [options]
 */
export async function realKey(session, touche, { focus, delaiEntreeMs = DELAI_ENTREE } = {}) {
  const common = champsCDP(touche);
  await frappe(session, { focus, qui: 'realKey', delaiEntreeMs }, async (emettre) => {
    await emettre('touche', { type: 'rawKeyDown', ...common });
    const texte = texteDeTouche(touche.key);
    if (texte !== null) await emettre('touche', { type: 'char', text: texte, ...common });
    await emettre('touche', { type: 'keyUp', ...common });
  });
}

/** Le TEXTE qu'une touche produit, ce qui fait d'elle une frappe qui AGIT : un caractère se tape,
 *  Entrée produit `\r` — c'est lui qui active le bouton focalisé (sans, Chrome ne clique rien).
 *  Les touches sans texte (Échap, flèches, Tab, modificateurs) rendent `null`. */
function texteDeTouche(key) {
  if (key.length === 1) return key;
  return key === 'Enter' ? '\r' : null;
}

/** Alt GAUCHE, tel que CDP le nomme — la touche des gestes MAINTENUS du jeu (`decor-reveler`). */
export const ALT = { key: 'Alt', code: 'AltLeft', windowsVirtualKeyCode: 18 };
/** Bit de modificateur CDP pour Alt — à passer en `modifiers` aux gestes ÉMIS PENDANT le maintien. */
export const MOD_ALT = 1;

/**
 * APPUI et RELÂCHEMENT SÉPARÉS (`realKeyDown` / `realKeyUp`) — ce que `realKey` ne sait pas faire :
 * un geste MAINTENU (Alt tenu qui révèle les utilisables) dure entre les deux, et tout ce que la
 * recette fait dans l'intervalle doit porter le modificateur (`modifiers`), sans quoi les événements
 * émis déclareraient la touche relâchée et l'état tenu ne serait plus celui de l'écran. `{ focus }` :
 * même option que `realKey`.
 */
export async function realKeyDown(session, touche, { focus, delaiEntreeMs = DELAI_ENTREE } = {}) {
  const champs = champsCDP(touche);
  await frappe(session, { focus, qui: 'realKeyDown', delaiEntreeMs }, (emettre) => emettre('touche', { type: 'rawKeyDown', ...champs }));
}

export async function realKeyUp(session, touche, { focus, delaiEntreeMs = DELAI_ENTREE } = {}) {
  // Le relâchement ne porte aucun modificateur : c'est l'événement qui déclare la touche relâchée.
  const champs = champsCDP({ ...touche, modifiers: undefined });
  await frappe(session, { focus, qui: 'realKeyUp', delaiEntreeMs }, (emettre) => emettre('touche', { type: 'keyUp', ...champs }));
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
 *     `evaluate()` + `.value = …`, qui écrit dans le DOM sans réveiller React.
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
export async function typeInField(session, selecteur, texte, { clear = true, attendu, delaiEntreeMs = DELAI_ENTREE } = {}) {
  await geste(session, { selecteur }, { qui: 'typeInField', delaiEntreeMs }, clic());
  // La frappe va à l'élément FOCALISÉ : un champ qui n'a pas le focus après le clic (#1853 L3,
  // `<input type=number>`) recevrait une insertion perdue, que la relecture dirait « inchangée ».
  if (clear) await evaluerFn(session, (selecteur) => { const el = document.querySelector(selecteur); if (document.activeElement === el) el.select(); }, selecteur);
  await frappe(session, { focus: selecteur, qui: 'typeInField', delaiEntreeMs }, (emettre) => emettre('texte', { text: texte }));
  const lu = await evaluate(session, `document.querySelector(${JSON.stringify(selecteur)}).value`);
  if (attendu !== undefined) {
    const ok = typeof attendu === 'function' ? attendu(lu) : lu === attendu;
    if (!ok) throw new Error(`typeInField « ${selecteur} » : champ à « ${lu} », attendu « ${attendu} » (frappé « ${texte} »)`);
  } else if (lu !== texte) {
    console.warn(`typeInField « ${selecteur} » : champ à « ${lu} » après avoir frappé « ${texte} » — transformation du onChange (casse, filtre) OU frappe additive : contrôler avant de continuer.`);
  }
  return lu;
}

/** Frappe RÉELLE d'une touche — alias FRANÇAIS de `realKey` (même geste, même pipeline CDP). */
export const frapperTouche = realKey;
/** Vrai si l'échec d'un appel de fermeture dit que la cible ou la socket est DÉJÀ partie : erreur de
 *  navigation (`isNavigationError`, dont la socket coupée de `brancherCdp`), ou session inconnue du
 *  navigateur. */
const cibleDejaPartie = (e) => isNavigationError(e) || /No session with given id/i.test(String(e?.message ?? ''));

/** Le Chrome inscrit au `SingletonLock` d'un profil (lien `hôte-pid` que Chrome pose sous POSIX, sans naissance) :
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
 *  - son lanceur, consigné dans son nom (`pidDeProfil`), est MORT : PID absent, ou RÉUTILISÉ depuis la naissance
 *    du nom (`estPidVivantDepuis`) ;
 *  - hors win32, EN PLUS, le Chrome de son `SingletonLock` (`verrouChrome`) est mort, sur CET hôte (son
 *    existence seule, `NAISSANCE_ABSENTE` : le verrou de Chrome n'en porte pas), ou
 *    le verrou est absent : hors du job object de win32 (`OPTIONS_SPAWN_CHROME`), Chrome peut survivre
 *    à son lanceur.
 * Lanceur ou Chrome vivant → compté dans `vivants`. Nom sans PID, verrou illisible ou d'un autre hôte →
 * chemin listé dans `sansPreuve`, laissé intact. Rend `{ trouves, purges, vivants, sansPreuve, echecs }`
 * — chaque purge est VÉRIFIÉE.
 */
export async function purgerProfilsOrphelins({
  dossier = os.tmpdir(), disque = DISQUE, vivant = estPidVivant, identite = IDENTITE_MESUREE, plateforme = process.platform, hote = os.hostname(),
} = {}) {
  const trouves = disque.lister(dossier).filter((n) => n.startsWith(PREFIXE_PROFIL));
  const bilan = { trouves: trouves.length, purges: 0, vivants: 0, sansPreuve: [], echecs: [] };
  for (const nom of trouves) {
    const profil = join(dossier, nom);
    const lanceur = pidDeProfil(nom);
    if (lanceur === null) { bilan.sansPreuve.push(profil); continue; }
    if (estPidVivantDepuis(lanceur.pid, lanceur.naissance, identite, { estVivant: vivant })) { bilan.vivants += 1; continue; }
    if (plateforme !== 'win32') {
      const verrou = verrouChrome(profil, { disque });
      if (!verrou.absent && (verrou.pid === undefined || verrou.hote !== hote)) { bilan.sansPreuve.push(profil); continue; }
      if (!verrou.absent && estPidVivantDepuis(verrou.pid, NAISSANCE_ABSENTE, identite, { estVivant: vivant })) { bilan.vivants += 1; continue; }
    }
    if (purgerProfil(profil, { disque, echeanceMs: 1500 })) bilan.purges += 1;
    else bilan.echecs.push(profil);
  }
  return bilan;
}
