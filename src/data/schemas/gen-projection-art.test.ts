import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { projeterDefs } from '../../../scripts/gen-registry.mjs';

/**
 * Projection des registres de rendu vers la donnée (`scripts/gen-registry.mjs › projeterDefs`, option
 * `projection` des REGISTRIES) : les deux styles de guillemets se lisent, et un def sans champ
 * littéral UNIQUE fait échouer la génération en se nommant.
 */
describe('projection d’un registre de defs', () => {
  const racine = mkdtempSync(join(tmpdir(), 'gen-registry-projection-'));
  afterAll(() => rmSync(racine, { recursive: true, force: true }));
  const dossier = (nom: string, fichiers: Record<string, string>): string => {
    const dir = join(racine, nom);
    mkdirSync(dir);
    for (const [f, src] of Object.entries(fichiers)) writeFileSync(join(dir, f), src);
    return dir;
  };

  it('ids en guillemets simples ET doubles, triés ; avec `champ`, la valeur par id', () => {
    const dir = dossier('guillemets', {
      'B.ts': "export const def = {\n  label: 'B',\n  id: \"bete\",\n  sex: 'F',\n};\n",
      'A.ts': "export const def = {\n  id: 'arbre',\n  sex: \"M\",\n};\n",
    });
    expect(projeterDefs(dir, { nom: 'X' })).toEqual([['arbre'], ['bete']]);
    expect(projeterDefs(dir, { nom: 'X', champ: 'sex' })).toEqual([['arbre', 'M'], ['bete', 'F']]);
  });

  it('un def sans `id` littéral ÉCHOUE en se nommant', () => {
    const dir = dossier('sans-id', { 'Calcule.ts': 'export const def = {\n  id: slug(label),\n};\n' });
    expect(() => projeterDefs(dir, { nom: 'X' })).toThrow(/Calcule\.ts : 0 champ\(s\) « id » littéral\(aux\)/);
  });

  it('un def à DEUX `id` littéraux ÉCHOUE en se nommant', () => {
    const dir = dossier('deux-id', { 'Double.ts': "export const def = {\n  id: 'a',\n  perso: {\n    id: 'b',\n  },\n};\n" });
    expect(() => projeterDefs(dir, { nom: 'X' })).toThrow(/Double\.ts : 2 champ\(s\) « id »/);
  });

  it('une coiffure sans `sex` ÉCHOUE en se nommant', () => {
    const dir = dossier('sans-sexe', { 'Chauve.ts': "export const hairstyle = {\n  id: 'chauve',\n};\n" });
    expect(() => projeterDefs(dir, { nom: 'SEXE_DE_COIFFURE', champ: 'sex' })).toThrow(/Chauve\.ts : 0 champ\(s\) « sex »/);
  });

  it('un id porté par deux defs ÉCHOUE en nommant l’id', () => {
    const dir = dossier('doublon', { 'A.ts': "  id: 'meme',\n", 'B.ts': '  id: "meme",\n' });
    expect(() => projeterDefs(dir, { nom: 'X' })).toThrow(/id « meme » porté par deux defs/);
  });
});
