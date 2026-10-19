// Couche CDP de base du kit de recette : attente, erreurs de navigation, évaluation bornée en page.
// Voir docs/recette-navigateur.md § « Preuve headless (agents) ».

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
export function cdpError(message) {
  const e = new Error(message);
  if (isNavigationError(e)) e.code = TARGET_NAVIGATED;
  return e;
}

/** L'erreur PRINCIPALE et celle du NETTOYAGE qui l'a suivie, JOINTES (`AggregateError`, message et
 *  `code` de la principale en tête) : aucune n'avale l'autre. */
export function joindre(principale, nettoyage) {
  const e = new AggregateError([principale, nettoyage], `${principale.message} — et le nettoyage a échoué : ${nettoyage.message}`, { cause: principale });
  if (principale.code) e.code = principale.code;
  return e;
}

/** `erreur` PORTE-t-elle déjà `r` : elle-même, sa `cause` ou ses `errors` (`joindre`), en profondeur. */
export function porteErreur(erreur, r) {
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
