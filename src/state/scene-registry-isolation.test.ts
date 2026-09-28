import { describe, it, expect } from 'vitest';
import { useGame, registerScene } from './store';
import { emptyScene } from './scene';

/**
 * CONTRAT de la sentinelle `resetSceneRegistry()` de l'`afterEach` global (`src/test-setup.ts`) —
 * garde POSITIVE, à lire avant d'écrire un test qui enregistre une scène.
 *
 * Le `sceneRegistry` (`state/store`) est un singleton de module partagé par tous les fichiers d'un
 * worker (`isolate: false`). La sentinelle le VIDE APRÈS CHAQUE TEST : aucune scène enregistrée par un test ne fuit vers un autre fichier — mais un enregistrement
 * fait EN TÊTE DE FICHIER (module, `beforeAll`) ne survit qu'au PREMIER test du fichier. Un fichier
 * qui a besoin du registre sur PLUSIEURS tests (ré)enregistre en `beforeEach` (patron :
 * `shipwreck.test.ts`, via `freshState`).
 *
 * Les deux `it` ci-dessous sont ORDONNÉS : le second mesure l'effet du teardown du premier.
 */
const PROBE_ID = 'sonde-registre-scenes';
const probe = emptyScene(2, 2);
probe.id = PROBE_ID;
registerScene(probe); // enregistrement de TÊTE DE FICHIER (portée module)

/** La scène sonde est-elle CONNUE du registre ? Mesuré au seam réel : `transitionTo` est un no-op sur
 *  une scène inconnue (`state/store.ts`), la scène courante ne change alors pas. */
function sceneKnown(): boolean {
  useGame.setState({ scene: null } as never);
  useGame.getState().transitionTo(PROBE_ID);
  return useGame.getState().scene?.id === PROBE_ID;
}

describe('sentinelle sceneRegistry (test-setup) — portée RÉELLE d’un enregistrement', () => {
  it('le PREMIER test du fichier voit l’enregistrement de tête de fichier', () => {
    expect(sceneKnown()).toBe(true);
  });

  it('le SUIVANT ne le voit plus : l’afterEach global a rendu le registre à ses scènes par défaut', () => {
    expect(sceneKnown()).toBe(false);
  });
});
