import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { scanNpmLockHoisted } from '../scripts/guards/lib/npmLockHoisted.mjs';

/**
 * Garde-fou « lock npm amputé » (#528) : une régénération de `package-lock.json` avec npm 11 ne
 * matérialise pas les entrées hoistées `node_modules/@emnapi/core`/`node_modules/@emnapi/runtime`
 * (peerDependencies de `@napi-rs/wasm-runtime`) que npm 10 (Node 22, admis par `engines`) exige —
 * le lock passe sous npm 11 et casse `npm ci` sous npm 10. MÉCANIQUE pure dans
 * `scripts/guards/lib/npmLockHoisted.mjs`,
 * consommée aussi par `scripts/git-hooks/pre-commit.mjs` (bloquant au commit).
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url)); // src/ → racine du projet

describe('garde-fou « lock npm amputé » — @emnapi/core+runtime hoistés (#528)', () => {
  it('le package-lock.json du repo (sain) ne lève aucune offense', () => {
    const lockText = readFileSync(`${ROOT}/package-lock.json`, 'utf8');
    expect(scanNpmLockHoisted(lockText)).toEqual([]);
  });

  it('fail-closed : un lock qui référence @napi-rs/wasm-runtime SANS les entrées @emnapi/* hoistées lève 2 offenses avec la recette', () => {
    const amputated = JSON.stringify({
      lockfileVersion: 3,
      packages: {
        '': { name: 'x' },
        'node_modules/@napi-rs/wasm-runtime': { version: '1.1.6' },
      },
    });
    const findings = scanNpmLockHoisted(amputated);
    expect(findings.length).toBe(2);
    for (const f of findings) {
      expect(f.detail).toContain('node_modules/@emnapi/');
      expect(f.detail).toContain('npx --yes npm@10.9.3 install --package-lock-only');
      expect(f.detail).toContain('npx npm@10.9.3 ci --dry-run');
    }
  });

  it('un lock qui référence @napi-rs/wasm-runtime avec les 2 entrées @emnapi/* présentes ne lève rien', () => {
    const complete = JSON.stringify({
      lockfileVersion: 3,
      packages: {
        '': { name: 'x' },
        'node_modules/@emnapi/core': { version: '1.11.2' },
        'node_modules/@emnapi/runtime': { version: '1.11.2' },
        'node_modules/@napi-rs/wasm-runtime': { version: '1.1.6' },
      },
    });
    expect(scanNpmLockHoisted(complete)).toEqual([]);
  });

  it('un lock qui ne référence PAS @napi-rs/wasm-runtime du tout est muet (dépendance disparue = non-sujet)', () => {
    const noWasmRuntime = JSON.stringify({
      lockfileVersion: 3,
      packages: {
        '': { name: 'x' },
        'node_modules/lodash': { version: '4.17.21' },
      },
    });
    expect(scanNpmLockHoisted(noWasmRuntime)).toEqual([]);
  });

  it('un lock imbriqué (@napi-rs/wasm-runtime sous un autre paquet) est aussi couvert', () => {
    const nested = JSON.stringify({
      lockfileVersion: 3,
      packages: {
        '': { name: 'x' },
        'node_modules/foo/node_modules/@napi-rs/wasm-runtime': { version: '1.1.6' },
      },
    });
    expect(scanNpmLockHoisted(nested).length).toBe(2);
  });
});
