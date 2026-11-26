/**
 * LA politique de visibilité, testée dans SA couche : `visibilityOf` ne connaît ni caméra, ni renderer,
 * ni teinte — les trois rendus (couleur de sommet three, voile CSS de l'iso, lumière d'ambiance POV) en
 * sont des APPLICATIONS, testées chez eux. Ce fichier tient la table de vérité et la FEUILLE (le module
 * n'importe rien à l'exécution, et son seul type vient d'une feuille de types de la donnée,
 * `src/data/schemas/ambiance.types.ts`, #2884 : c'est ce qui lui permet d'être partagé par les trois sans les coupler).
 */
import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { entreeDe } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { visibilityOf } from './visibility';

describe('visibilityOf — LA politique, sans caméra ni renderer', () => {
  const visible = new Set(['1,2,0']);
  const explored = new Set(['1,2,0', '3,4,0']);

  it('table de vérité : vue > mémorisée > inconnue', () => {
    expect(visibilityOf('1,2,0', visible, explored)).toBe('visible');
    expect(visibilityOf('3,4,0', visible, explored)).toBe('explored');
    expect(visibilityOf('9,9,1', visible, explored)).toBe('unknown');
  });

  it('la case VUE l’emporte même si elle n’a pas été mémorisée', () => {
    expect(visibilityOf('7,7,0', new Set(['7,7,0']), new Set())).toBe('visible');
  });

  it('sans vue ni mémoire : inconnue', () => {
    expect(visibilityOf('7,7,0', new Set(), new Set())).toBe('unknown');
  });

  it('l’étage fait partie de la clé (`x,y,z`)', () => {
    expect(visibilityOf('1,2,1', visible, explored)).toBe('unknown');
  });

  it('la clé est OPAQUE : la politique ne l’interprète pas (une colonne « x,y » se pose telle quelle)', () => {
    // Le POV interroge des COLONNES (`x,y`), l'iso et le monde three des cases (`x,y,z`) : la loi vaut
    // pour toute clé, elle ne parse jamais de coordonnée.
    expect(visibilityOf('6,4', new Set(['6,4']), new Set())).toBe('visible');
    expect(visibilityOf('6,4', new Set(), new Set(['6,4']))).toBe('explored');
  });
});

describe('FEUILLE — la loi partagée ne dépend de personne', () => {
  const SRC = entreeDe(resolve(__dirname, 'visibility.ts')).text;
  const TYPES = entreeDe(resolve(__dirname, '../data/schemas/ambiance.types.ts')).text;

  it('`visibility.ts` n’importe que le TYPE `Visibility`, d’une feuille de types qui n’importe rien', () => {
    // Angle mort ASSUMÉ : lecture TEXTUELLE des deux sources, pas du graphe de modules — la garde vaut pour
    // ces deux fichiers seuls.
    expect(SRC.match(/^import\s.*$/gm)).toEqual(["import type { Visibility } from '../data/schemas/ambiance.types';"]);
    expect(TYPES.match(/^import\s/gm)).toBeNull();
    for (const src of [SRC, TYPES]) {
      expect(src).not.toMatch(/\brequire\(/);
      expect(src).not.toMatch(/\bimport\(/);
      expect(src).not.toMatch(/^export .* from /m);
    }
  });
});
