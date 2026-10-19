import { describe, it, expect } from 'vitest';
import { decorEnCase, decorEnCaseEtage, entitesEnCaseEtage } from './decorIndex';
import { emptyScene, type Scene, type SceneEntity } from './scene';

/**
 * Index case → entités (`noyau/monde/decorIndex.ts`), vue ANCRAGE (`entitesEnCaseEtage`) : la lecture PAR
 * POSITION du picking (`gameIso/stage/useStagePointer.ts`). Elle répond sur la case d'ANCRAGE, TOUTES
 * natures, dans l'ordre du document — là où les deux vues d'EMPREINTE (`decorEnCase`/`decorEnCaseEtage`)
 * ne répondent que du DÉCOR qui couvre la case.
 *
 * Scène FABRIQUÉE : aucune scène livrée n'est lue ici (les cases et les étages sont le contrat, pas le
 * contenu d'une carte de campagne).
 */

const ent = (id: string, kind: SceneEntity['kind'], x: number, y: number, z?: number): SceneEntity => ({
  id,
  kind,
  pos: { x, y },
  ...(z !== undefined ? { z } : {}),
  ...(kind === 'prop' ? { ref: 'tonneau' } : {}),
});

const sceneAvec = (entities: SceneEntity[]): Scene => ({ ...emptyScene(8, 8), entities });

describe('decorIndex — vue ANCRAGE (entitesEnCaseEtage)', () => {
  it('rend les entités d’une même case dans l’ORDRE DU DOCUMENT', () => {
    const scene = sceneAvec([ent('a', 'prop', 3, 3), ent('b', 'personnage', 3, 3), ent('c', 'prop', 3, 3)]);

    expect(entitesEnCaseEtage(scene, 3, 3, 0).map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('sépare les étages : même (x,y) à z=0 et z=1 → deux listes', () => {
    const scene = sceneAvec([ent('sol', 'personnage', 2, 5, 0), ent('haut', 'personnage', 2, 5, 1)]);

    expect(entitesEnCaseEtage(scene, 2, 5, 0).map((e) => e.id)).toEqual(['sol']);
    expect(entitesEnCaseEtage(scene, 2, 5, 1).map((e) => e.id)).toEqual(['haut']);
  });

  it('rend TOUTES les natures là où les vues d’EMPREINTE ne rendent que le décor', () => {
    const scene = sceneAvec([ent('pnj', 'personnage', 4, 1), ent('coffre', 'prop', 4, 1)]);

    expect(entitesEnCaseEtage(scene, 4, 1, 0).map((e) => e.id)).toEqual(['pnj', 'coffre']);
    expect(decorEnCaseEtage(scene, 4, 1, 0)?.id).toBe('coffre');
    expect(decorEnCase(scene, 4, 1)?.id).toBe('coffre');
  });

  it('case vide → tableau vide, et la MÊME référence à chaque appel (aucune allocation)', () => {
    const scene = sceneAvec([ent('ailleurs', 'prop', 0, 0)]);

    const un = entitesEnCaseEtage(scene, 6, 6, 0);
    const deux = entitesEnCaseEtage(scene, 6, 6, 0);
    expect(un).toEqual([]);
    expect(deux).toBe(un);
  });

  it('mémoïse par IDENTITÉ de la liste d’entités : même scène → même tableau, liste neuve → recalcul', () => {
    const entities = [ent('a', 'personnage', 1, 1), ent('b', 'prop', 1, 1)];
    const scene = sceneAvec(entities);

    const premier = entitesEnCaseEtage(scene, 1, 1, 0);
    expect(entitesEnCaseEtage(scene, 1, 1, 0)).toBe(premier);

    const apresMutation = sceneAvec([...entities]);
    const recalcule = entitesEnCaseEtage(apresMutation, 1, 1, 0);
    expect(recalcule).not.toBe(premier);
    expect(recalcule.map((e) => e.id)).toEqual(['a', 'b']);
  });
});
