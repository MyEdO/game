// Garde STRUCTURELLE #415 : tout timer RÉEL qui mute l'état passe par `scheduleCombatTimer`/
// `scheduleFlowTimer` (`src/state/combatTimers.ts`) — un `setTimeout`/`setInterval` NU ailleurs sous
// `SCAN_DIRS` est INEXPRIMABLE. Module ESM pur (node nu), patron `weatherTestModQuarantine.mjs`.

/** Retire le CONTENU des commentaires bloc `/* … *\/` puis ligne `// …`, en préservant les `\n`
 *  (les numéros de ligne restent alignés sur l'original). */
function stripComments(content) {
  const noBlock = content.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlock.replace(/\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '));
}

/** Détecte un appel `setTimeout(`/`setInterval(` dans le CODE (pas les commentaires) : NU, OU via
 *  l'objet global (`window.`/`globalThis.`/`self.`/`global.`) — ces deux formes sont de VRAIS
 *  timers non tracés. Ignore les méthodes d'un objet quelconque (`foo.setTimeout(`), les références
 *  de TYPE (`ReturnType<typeof setTimeout>`) et `clearTimeout`/`clearInterval`.
 *  @param {string} content @returns {{ line: number, call: string }[]} */
export function scanNakedTimers(content) {
  const stripped = stripComments(content);
  const rx = /(?<![.\w$])(?:(?:window|globalThis|self|global)\s*\.\s*)?(setTimeout|setInterval)\s*\(/g;
  const findings = [];
  let m;
  while ((m = rx.exec(stripped)) !== null) {
    const line = stripped.slice(0, m.index).split('\n').length;
    findings.push({ line, call: m[1] });
  }
  return findings;
}

/** Dossiers scannés, POSIX relatifs à la racine du repo : le store et la couche neutre qu'il importe (#1956). */
export const SCAN_DIRS = ['src/state', 'src/lib'];

/** `combatTimers.ts` seul reste exempté au niveau FICHIER — c'est le wrapper : sa nature est
 *  d'être plein de timers nus qu'il encapsule, ce n'est pas un contournement de son propre suivi.
 *  Toute autre exemption doit être PAR SITE (`fichier :: motif`, cf. `ALLOWED_SITES` dans
 *  `naked-timer-guard.test.ts`, #776 LOT 6) — une whitelist de FICHIER ENTIER pour un timer isolé
 *  fait disparaître la couverture de tout le reste de ce fichier (défaut mesuré #776). */
export const ALLOWED = ['src/state/combatTimers.ts'];
