// Mécanique de scan du garde-fou « lock npm amputé » (#528) : une régénération avec npm 11 ne
// matérialise pas les entrées HOISTÉES `node_modules/@emnapi/core`/`node_modules/@emnapi/runtime`
// (peerDependencies de `@napi-rs/wasm-runtime`) que npm 10 (Node 22, admis par `engines`) exige —
// `npm ci` casse sous npm 10 sans que rien ne le révèle sous npm 11. Module ESM pur, exécutable par
// `node` nu — consommé par
// src/npm-lock-hoisted-guard.test.ts ET par scripts/git-hooks/pre-commit.mjs. Garde MUETTE si le
// lock ne référence plus `@napi-rs/wasm-runtime` du tout (dépendance disparue = non-sujet, jamais
// figée sur un nom de paquet précis à l'infini).

/** Recette de régénération EXACTE — reprise verbatim dans le détail d'offense.
 * @type {string} */
export const REGEN_RECIPE =
  'npx --yes npm@10.9.3 install --package-lock-only, puis valider avec npx npm@10.9.3 ci --dry-run';

const REQUIRED_KEYS = ['node_modules/@emnapi/core', 'node_modules/@emnapi/runtime'];

/** Numéro de ligne (1-based) de la première occurrence de `needle` dans `contenu`, ou `fallback`
 *  si absent.
 * @param {string} contenu @param {string} needle @param {number} fallback @returns {number} */
function lineOf(contenu, needle, fallback) {
  const idx = contenu.indexOf(needle);
  if (idx === -1) return fallback;
  return contenu.slice(0, idx).split('\n').length;
}

/**
 * Scan d'un `package-lock.json` (contenu brut) : si le lock référence `@napi-rs/wasm-runtime`
 * quelque part dans `packages` (racine `node_modules/@napi-rs/wasm-runtime` ou imbriqué sous un
 * autre paquet), exige la présence des entrées hoistées `node_modules/@emnapi/core` et
 * `node_modules/@emnapi/runtime`. Un lock illisible (JSON invalide) ou sans `packages` ne lève rien
 * (pas le rôle de ce garde).
 * @param {string} contenu
 * @returns {{ line: number, detail: string }[]}
 */
export function scanNpmLockHoisted(contenu) {
  let lock;
  try {
    lock = JSON.parse(contenu);
  } catch {
    return [];
  }
  const packages = lock && typeof lock === 'object' ? lock.packages : undefined;
  if (!packages || typeof packages !== 'object') return [];

  const referencesWasmRuntime = Object.keys(packages).some(
    (k) => k === 'node_modules/@napi-rs/wasm-runtime' || k.endsWith('/@napi-rs/wasm-runtime'),
  );
  if (!referencesWasmRuntime) return [];

  const anchorLine = lineOf(contenu, '"@napi-rs/wasm-runtime"', 1);
  const findings = [];
  for (const key of REQUIRED_KEYS) {
    if (!(key in packages)) {
      findings.push({
        line: anchorLine,
        detail: `entrée hoistée manquante "${key}" (régénération npm 11 désynchronisée — régénérer avec npm 10 : ${REGEN_RECIPE})`,
      });
    }
  }
  return findings;
}
