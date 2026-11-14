/**
 * Le propriétaire de l'état hors du web (`proprietaireDuJeu.ts`) applique la transition du jeu après chaque
 * écriture : le maximum des Blessures suit ses porteurs (LDB 05 l.1001, LDB 48 l.23), à chaque chemin de combattant
 * de l'état, et le courant suit le delta (LDB 48 l.27).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { draineCascade } from './cascade.testkit';
import { applyMutation } from './corruptionFlow';
import { seedBattleRng } from './battleRng';
import { CHEMINS_NOMMES, lireAuChemin, poserAuChemin } from './combattantsDeLEtat.testkit';
import { blesseDeTest } from '../engine/combattantDeTest.testkit';
import { ID_DE_PORTEUR, PORTEURS } from '../engine/porteursDePassifs.testkit';
import { createHero } from '../engine/character';
import { datasetArray, resetData, setDataset } from '../data/overrides';
import type { OpPassive } from '../engine/ops';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const plus3 = (): OpPassive[] => [{ op: 'attrMod', attr: 'wounds', mod: 3 }];

afterEach(() => resetData());

describe('écriture du store : le maximum suit, à chaque chemin de combattant de l’état', () => {
  describe.each(CHEMINS_NOMMES)('%s', (_, chemin) => {
    it.each(PORTEURS)('%s posé sans réconciliation', (_n, _champ, poser) => {
      const c = blesseDeTest(10, { kind: 'heros' });
      poser(c, plus3());
      banc.setState(poserAuChemin(banc.getState(), chemin, c));
      expect(lireAuChemin(banc.getState(), chemin).wounds).toMatchObject({ max: 15, current: 13 });
    });
  });
});

describe('mutation de Corruption (LDB 19 l.76, l.83) : la transition réconcilie le porteur muté', () => {
  it('la dernière étape à table attache la mutation : le maximum et le courant du héros suivent', () => {
    setDataset('mutations', [...datasetArray('mutations'), { id: ID_DE_PORTEUR, type: 'mutations', label: 'Mutation de test', desc: '', kind: 'physique', passive: plus3() }]);
    setDataset('mutationTables', datasetArray('mutationTables').map((t) => ({ ...t, entries: [{ min: 1, max: 100, mutation: ID_DE_PORTEUR }] })) as never);
    const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 4 });
    h.corruption = 6;
    banc.setState({ party: [h] });
    const { max, current } = banc.getState().party[0].wounds;
    seedBattleRng(5);
    applyMutation(banc.getState, banc.setState, banc.getState().party[0]);
    draineCascade(banc.getState);
    const heros = banc.getState().party[0];
    expect(heros.mutations?.map((m) => m.id)).toEqual([ID_DE_PORTEUR]);
    expect(heros.wounds).toMatchObject({ max: max + 3, current: current + 3 });
  });
});
