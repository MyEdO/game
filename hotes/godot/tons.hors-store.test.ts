/**
 * LES TONS DE L'HÔTE GODOT : chaque ton qu'une variation du thème dessine (`TONS_DU_THEME`, `src/hote/elements.ts`) est
 * une variation du thème du projet (`theme/custom` de `project.godot`), qui le dessine sous tout thème de portée qui ne
 * la redéfinit pas.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TONS_DU_THEME } from '../../src/hote/elements';

const PROJET = new URL('./projet/', import.meta.url);
const lire = (chemin: string): string => readFileSync(new URL(chemin.replace(/^res:\/\//, ''), PROJET), 'utf8');

/** Les variations que le thème `texte` déclare (`<variation>/base_type`). */
const variationsDu = (texte: string): string[] => [...texte.matchAll(/^(\w+)\/base_type = /gm)].map(([, v]) => v);

describe('les tons de l’hôte Godot', () => {
  it('chaque ton du thème est une variation du thème du projet', () => {
    const theme = /^theme\/custom="([^"]+)"$/m.exec(lire('project.godot'))?.[1];
    expect(theme, 'le thème du projet').toBeDefined();
    const variations = new Set(variationsDu(lire(theme!)));
    expect(TONS_DU_THEME.filter((t) => !variations.has(t))).toEqual([]);
  });
});
