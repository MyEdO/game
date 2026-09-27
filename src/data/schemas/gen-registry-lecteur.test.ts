import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { lireDefs } from '../../../scripts/gen-registry.mjs';

/**
 * LECTEUR UNIQUE des exports d'un def (`scripts/gen-registry.mjs › lireExports`) : un export absent est
 * un champ absent, un export présent hors de sa forme canonique fait LEVER la génération en nommant le
 * def et le champ. Fixtures sous `os.tmpdir()`, un dossier par def (une levée arrête la lecture du dossier).
 */
describe('lecteur des exports d’un def (#1897)', () => {
  const racine = mkdtempSync(join(tmpdir(), 'gen-registry-lecteur-'));
  afterAll(() => rmSync(racine, { recursive: true, force: true }));
  const dossierDe = (nom: string, src: string): string => {
    const dir = join(racine, nom);
    mkdirSync(dir);
    writeFileSync(join(dir, `${nom}.ts`), src);
    return dir;
  };

  it('la forme CANONIQUE se lit : `file`, `famille`, la présence de `meta`', () => {
    const dir = dossierDe('canon', "export const file = 'a.json';\nexport const famille = 'entite';\nexport const meta = doc.meta;\n");
    expect(lireDefs(dir, ['file', 'famille', 'meta'])).toEqual([{ module: 'canon.ts', file: 'a.json', famille: 'entite', meta: true }]);
  });

  it('un export ABSENT est un champ absent, sans levée', () => {
    const dir = dossierDe('absent', "export const file = 'a.json';\n");
    expect(lireDefs(dir, ['file', 'meta'])).toEqual([{ module: 'absent.ts', file: 'a.json', meta: undefined }]);
  });

  const horsForme: [string, string, string][] = [
    ['commentaire-famille', "export const file = 'b.json';\nexport const famille = 'entite'; // commentaire\n", 'famille'],
    ['asconst-famille', "export const file = 'c.json';\nexport const famille = 'entite' as const;\n", 'famille'],
    ['type-famille', "export const file = 'd.json';\nexport const famille: string = 'entite';\n", 'famille'],
    ['guillemets-famille', "export const file = 'e.json';\nexport const famille = \"entite\";\n", 'famille'],
    ['guillemets-file', 'export const file = "e.json";\nexport const famille = \'entite\';\n', 'file'],
    ['espace-file', "export const file = 'f.json' ;\nexport const famille = 'entite';\n", 'file'],
    ['let-famille', "export const file = 'g.json';\nexport let famille = 'entite';\n", 'famille'],
  ];
  for (const [nom, src, champ] of horsForme) {
    it(`hors forme canonique LÈVE en nommant le def et le champ : ${nom}`, () => {
      const dir = dossierDe(nom, src);
      expect(() => lireDefs(dir, ['file', 'famille'])).toThrow(new RegExp(`${nom}\\.ts : export « ${champ} » hors de sa forme canonique`));
    });
  }
});

/** POINT D'ENTRÉE de la phase 1 : l'exécuter génère, l'IMPORTER (`vite.config.ts`, gardes) n'exécute rien. */
describe('point d’entrée de `scripts/gen-registry.mjs` (#1463)', () => {
  const jouer = (args: string[]) => spawnSync(process.execPath, args, { encoding: 'utf8' });

  it('importé, le générateur ne génère rien', () => {
    const r = jouer(['--input-type=module', '-e', "await import('./scripts/gen-registry.mjs');"]);
    expect(r.status).toBe(0);
    expect(r.stdout).not.toMatch(/^gen-registry:/m);
  });

  it('exécuté, il génère', () => {
    const r = jouer(['scripts/gen-registry.mjs']);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/^gen-registry: SCHEMA_DEFS ← /m);
  });
});
