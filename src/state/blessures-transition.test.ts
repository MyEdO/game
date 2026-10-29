import { describe, it, expect, afterEach } from 'vitest';
import { useGame } from './store';
import { draineCascade } from '../noyau/cascade.testkit';
import { applyMutation } from '../noyau/corruptionFlow';
import { seedBattleRng } from '../noyau/battleRng';
import { CHEMINS_NOMMES, lireAuChemin, poserAuChemin } from '../noyau/combattantsDeLEtat.testkit';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';
import { ID_DE_PORTEUR, PORTEURS_HORS_TALENT } from '../engine/porteursDePassifs.testkit';
import { createHero } from '../engine/character';
import { datasetArray, resetData, setDataset } from '../data/overrides';
import type { MutationTable } from '../data/mutations';
import type { OpPassive } from '../engine/ops';
import { blessuresDeBase } from '../engine/characteristics';

/**
 * Le maximum des Blessures suit ses porteurs à TOUTE écriture du store (LDB 05 l.1001, LDB 48 l.23) :
 * la transition du jeu (`transitionDuJeu`) réconcilie chaque combattant d'un champ remplacé ; le courant
 * suit le delta (LDB 48 l.27).
 */
const plus3 = (): OpPassive[] => [{ op: 'attrMod', attr: 'wounds', mod: 3 }];

afterEach(() => resetData());

describe('écriture du store : le maximum suit, à chaque chemin de combattant de l’état', () => {
  describe.each(CHEMINS_NOMMES)('%s', (_, chemin) => {
    it.each(PORTEURS_HORS_TALENT)('%s posé sans réconciliation', (_n, _champ, poser) => {
      const c = combattantDeTest({ kind: 'hero', wounds: blessuresDeBase(12, 10) });
      poser(c, plus3());
      useGame.setState(poserAuChemin(useGame.getState(), chemin, c));
      expect(lireAuChemin(useGame.getState(), chemin).wounds).toMatchObject({ max: 15, current: 13 });
    });
  });
});

describe('mutation de Corruption (LDB 19 l.76, l.83) : la transition réconcilie le porteur muté', () => {
  it('la dernière étape à table attache la mutation : le maximum et le courant du héros suivent', () => {
    setDataset('mutations', [...datasetArray('mutations'), { id: ID_DE_PORTEUR, type: 'mutations', label: 'Mutation de test', desc: '', kind: 'physique', passive: plus3() }] as never);
    setDataset('mutationTables', (datasetArray('mutationTables') as MutationTable[]).map((t) => ({ ...t, ranges: [{ min: 1, max: 100, mutation: ID_DE_PORTEUR }] })) as never);
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 4 });
    h.corruption = 6;
    useGame.setState({ battle: null, party: [h], pendingCascade: null, suspendedCascades: [] });
    const { max, current } = useGame.getState().party[0].wounds;
    seedBattleRng(5);
    applyMutation(useGame.getState, useGame.setState, useGame.getState().party[0]);
    draineCascade(useGame.getState);
    const heros = useGame.getState().party[0];
    expect(heros.mutations?.map((m) => m.id)).toEqual([ID_DE_PORTEUR]);
    expect(heros.wounds).toMatchObject({ max: max + 3, current: current + 3 });
  });
});
