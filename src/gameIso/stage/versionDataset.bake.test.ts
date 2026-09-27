/**
 * LA PRÉMISSE DU BANC EST UN CONTRAT (#1692, #1788).
 *
 * Le banc `versionDataset.bench.ts` compare le surcoût d'une lecture d'index VIVANT au bake réel des
 * scènes de la Diligence. Que ce bake donne du TRAVAIL — des scènes, et du décor émis à chaque
 * passe — n'est pas une durée : c'est un fait d'artefact, et il se prouve ici, sur la MÊME fixture
 * (`versionDataset.fixture.ts`). Sans lui, un bake devenu vide rendrait le banc vert par vacuité :
 * il comparerait un surcoût à zéro travail, et ne dirait plus rien.
 */
import { describe, it, expect } from 'vitest';
import { bakerLesScenes, emisDeDecor, scenesDeLaDiligence } from './versionDataset.fixture';

describe('#1692 — le bake de la Diligence, échelle à laquelle le coût d’un index vivant se compare', () => {
  it('donne bien du TRAVAIL : des scènes, et du décor émis à chaque bake', () => {
    const scenes = scenesDeLaDiligence();
    expect(scenes.length, 'aucune scène : tout ce qui se compare à ce bake mesurerait le vide').toBeGreaterThan(0);
    expect(emisDeDecor(scenes), 'aucun élément de décor émis : le bake ne lirait aucun index').toBeGreaterThan(15);
    expect(bakerLesScenes(scenes), 'le bake complet (sols + décor) n’émet rien').toBeGreaterThan(emisDeDecor(scenes));
  });
});
