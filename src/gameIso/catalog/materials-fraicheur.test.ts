import { describe, it, expect, afterEach } from 'vitest';
import { materials, matieresDe } from '../../data/index';
import { setDataset, resetData } from '../../data/overrides';
import type { MaterialEntry } from '../../data/materials.types';
import type { EntreeVivante } from '../../data/datasets';
import { editees } from '../../data/materials.testkit';
import { propMaterial } from '../../noyau/monde/volume/matieres';
import { roofMaterial } from '../../noyau/monde/volume/matieres';
import { reliefMaterial } from '../../noyau/monde/volume/matieres';

/**
 * FRAÎCHEUR DES MATIÈRES (#1686 lot 3a-1), côté RENDU — les trois façades de rendu (`catalogEntry` sur une
 * résolution vivante) voient la valeur NEUVE du document muté EN PLACE (`overrides.setDataset`) au coup
 * d'après ; les vues de la donnée : `data/materials-fraicheur.test.ts`.
 */

const COULEUR_NEUVE = '#0f0f0f';
const PENTE_NEUVE = '#0e0e0e';
const FACE_NEUVE = '#0d0d0d';

afterEach(() => resetData());

describe('matières — toute vue du document est VIVANTE (aucun index figé à l’import)', () => {
  it('les trois domaines, les trois façades de rendu et `findPropMaterialById` voient la valeur ÉDITÉE', () => {
    const prop = matieresDe('prop')[0];
    const roof = matieresDe('roof').find((m) => m.N !== undefined)!;
    const relief = matieresDe('relief')[0];
    expect(prop.color, 'la sonde partirait d’une valeur déjà égale à la valeur neuve').not.toBe(COULEUR_NEUVE);
    expect(roof.N).not.toBe(PENTE_NEUVE);
    expect(relief.face).not.toBe(FACE_NEUVE);

    setDataset('materials', editees((e) => {
      if (e.id === prop.id && e.domain === 'prop') return { ...e, color: COULEUR_NEUVE };
      if (e.id === roof.id && e.domain === 'roof') return { ...e, N: PENTE_NEUVE };
      if (e.id === relief.id && e.domain === 'relief') return { ...e, face: FACE_NEUVE };
      return e;
    }));

    // … façades de RENDU (`catalogEntry` sur une résolution vivante) …
    expect(propMaterial(prop.id).color).toBe(COULEUR_NEUVE);
    expect(roofMaterial(roof.id).N).toBe(PENTE_NEUVE);
    expect(reliefMaterial(relief.id).face).toBe(FACE_NEUVE);
  });

  it('une matière AJOUTÉE au document est résolvable sans rechargement', () => {
    const neuve: EntreeVivante<MaterialEntry> = {
      id: 'matiere-neuve-du-banc', type: 'materials', label: 'Matière neuve du banc',
      domain: 'prop', color: COULEUR_NEUVE, roughness: 0.5, metalness: 0,
    };
    setDataset('materials', [...materials.map((e) => structuredClone(e)), neuve]);
    expect(propMaterial(neuve.id).color).toBe(COULEUR_NEUVE);
  });
});
