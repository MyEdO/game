import { describe, it, expect, afterEach } from 'vitest';
import { materials, matieresDe, matieresCouvrantes, matierePlan, findPropMaterialById } from './index';
import { setDataset, resetData } from './overrides';
import type { MaterialEntry } from './materials.types';
import { propMaterial } from '../gameIso/catalog/propMaterials';
import { roofMaterial } from '../gameIso/catalog/roofs';
import { reliefMaterial } from '../gameIso/catalog/relief';
import { validateScene } from '../state/validateScene';
import { emptyScene, type Scene } from '../state/scene';

/**
 * FRAÎCHEUR DES MATIÈRES (#1686 lot 3a-1) — le document des matières se mute EN PLACE
 * (`overrides.setDataset`, seam de l'éditeur du Codex et des surcharges de campagne). Toute vue de ce
 * document — les vues par domaine, les trois façades de rendu, le sous-filtre des couvertures — doit
 * donc voir la valeur NEUVE au coup d'après, sans rechargement de page.
 *
 * Ce que la garde interdit, nommément : re-figer une vue au niveau MODULE (`const MAP = …`,
 * `const propMaterials = matieresDe('prop')`). Une telle vue rend VERT tout test qui lit la donnée
 * committée, et FAUX tout ce que l'éditeur affiche après une retouche.
 *
 * L'édition est jouée par `setDataset('materials', …)` — le dataset est une clé d'`ARRAYS`
 * (`data/overrides.ts`) : c'est ce qui rend le splice en place possible. Aucune route d'ÉDITION
 * (`exposition.edit`) n'est encore déclarée au def : le dataset ne se SAUVEGARDE pas, mais il se mute,
 * et c'est la mutation que les vues doivent suivre.
 */

/** Le document, cloné puis retouché entrée par entrée — jamais une liste écrite à la main. */
function editees(patch: (e: MaterialEntry) => MaterialEntry): MaterialEntry[] {
  return materials.map((e) => patch(structuredClone(e)));
}

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

    // Vues par domaine (`matieresDe`) …
    expect(matieresDe('prop').find((m) => m.id === prop.id)!.color).toBe(COULEUR_NEUVE);
    expect(matieresDe('roof').find((m) => m.id === roof.id)!.N).toBe(PENTE_NEUVE);
    expect(matieresDe('relief').find((m) => m.id === relief.id)!.face).toBe(FACE_NEUVE);
    // … façades de RENDU (`catalogEntry` sur une résolution vivante) …
    expect(propMaterial(prop.id).color).toBe(COULEUR_NEUVE);
    expect(roofMaterial(roof.id).N).toBe(PENTE_NEUVE);
    expect(reliefMaterial(relief.id).face).toBe(FACE_NEUVE);
    // … et la porte par id de la façade `src/data`.
    expect(findPropMaterialById(prop.id)!.color).toBe(COULEUR_NEUVE);
  });

  it('une matière AJOUTÉE au document est résolvable sans rechargement', () => {
    const neuve: MaterialEntry = {
      id: 'matiere-neuve-du-banc', type: 'materials', label: 'Matière neuve du banc',
      domain: 'prop', color: COULEUR_NEUVE, roughness: 0.5, metalness: 0,
    };
    expect(findPropMaterialById(neuve.id)).toBeUndefined();
    setDataset('materials', [...materials.map((e) => structuredClone(e)), neuve]);
    expect(findPropMaterialById(neuve.id)!.label).toBe(neuve.label);
    expect(propMaterial(neuve.id).color).toBe(COULEUR_NEUVE);
  });

  it('le sous-filtre des COUVERTURES suit la donnée — et le validateur de scène avec lui', () => {
    const plan = matieresDe('roof').find((m) => !m.couverture)!;
    expect(matieresCouvrantes().map((m) => m.id)).not.toContain(plan.id);
    // La scène minimale qui pose UNE masse de toit sur la matière non couvrante : refusée, nommément.
    const scene = (materiau: string): Scene => ({
      ...emptyScene(),
      id: 'toiture', label: 'Toiture',
      architecture: [{
        id: 'corps', style: 'colombage', storeys: [], facades: [],
        masses: [{ id: 'toit', z: 0, footprint: [{ x: 0, y: 0, w: 2, h: 2 }], levels: 1, profile: 'gable', pitchDeg: 40, material: materiau, ridge: 'x' }],
      }],
    });
    const erreursDeCouverture = (materiau: string) =>
      validateScene([scene(materiau)]).filter((w) => w.refId === 'toit' && w.message.includes('couverture'));
    expect(erreursDeCouverture(plan.id)).toHaveLength(1);

    // La donnée DÉCLARE `plan` couvrant : le sous-filtre et le validateur le suivent, au coup d'après.
    setDataset('materials', editees((e) => (e.id === plan.id && e.domain === 'roof' ? { ...e, couverture: true } : e)));
    expect(matieresCouvrantes().map((m) => m.id)).toContain(plan.id);
    expect(erreursDeCouverture(plan.id)).toEqual([]);
  });

  it('le PLAN vu du dessus se lit à la donnée, et son absence est une anomalie NOMMÉE', () => {
    expect(matierePlan().vueDeDessus).toBe(true);
    setDataset('materials', editees((e) => (e.domain === 'roof' ? { ...e, vueDeDessus: undefined } : e)));
    expect(() => matierePlan()).toThrow(/vueDeDessus.*materials\.json/);
  });
});
