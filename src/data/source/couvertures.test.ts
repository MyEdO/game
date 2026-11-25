/** Les liens `couvre` / `ecartes` d'un projet et leurs fautes de référence (#2290). */
import { describe, it, expect } from 'vitest';
import { couverturesDuProjet, fautesDeReference, KINDS_DE_PORTEUR, type ProjetLu } from './couvertures';

describe('couverturesDuProjet / fautesDeReference', () => {
  const C = (id: string, couvre: string[]) => ({ id, couvre });
  const projet: ProjetLu = {
    narratif: { presetsPnj: [C('pnj', ['A-01#pnj1'])], indices: [C('ind', ['A-01#ind1'])], ecartes: [{ entree: 'A-01#b9', motif: 'm' }] },
    scenes: [{
      ...C('sc', ['A-01#lieu1']),
      entities: [C('ent', ['A-01#b1'])],
      effectZones: [C('zone', ['A-01#lieu2'])],
      triggers: [C('trig', ['A-01#d1'])],
      dialogues: [C('dlg', ['A-01#txt1'])],
      encounters: [C('enc', ['A-01#renc1'])],
    }],
    worldMap: { places: [C('place', ['A-01#lieu3'])], routes: [C('route', ['A-01#lieu4'])] },
  };

  it('rend chaque `couvre` des dix porteurs, avec la scène des porteurs de scène, puis les écarts', () => {
    const lu = couverturesDuProjet(projet);
    expect(lu.couvertures.map((c) => c.porteur.kind)).toEqual([...KINDS_DE_PORTEUR]);
    expect(lu.couvertures.find((c) => c.porteur.kind === 'entite')).toEqual({ entree: 'A-01#b1', porteur: { kind: 'entite', id: 'ent', sceneId: 'sc' } });
    expect(lu.couvertures.find((c) => c.porteur.kind === 'scene')).toEqual({ entree: 'A-01#lieu1', porteur: { kind: 'scene', id: 'sc' } });
    expect(lu.ecartes).toEqual([{ entree: 'A-01#b9', motif: 'm' }]);
  });

  it('une entrée non couverte ne rougit jamais ; une entrée inexistante, ou couverte ET écartée, rougit en se nommant', () => {
    const lu = couverturesDuProjet(projet);
    const toutes = new Set([...lu.couvertures.map((c) => c.entree), 'A-01#b9', 'A-01#b42']);
    expect(fautesDeReference('p', lu, toutes)).toEqual([]);

    const sansPnj = new Set([...toutes].filter((e) => e !== 'A-01#pnj1' && e !== 'A-01#b9'));
    expect(fautesDeReference('p', lu, sansPnj)).toEqual([
      'p : PNJ `pnj` couvre « A-01#pnj1 », absente des fiches commitées',
      'p : écart « A-01#b9 », absente des fiches commitées',
    ]);

    const couverteEtEcartee = couverturesDuProjet({ ...projet, narratif: { ...projet.narratif, ecartes: [{ entree: 'A-01#d1', motif: 'm' }] } });
    expect(fautesDeReference('p', couverteEtEcartee, toutes)).toEqual(['p : « A-01#d1 » à la fois couverte et écartée']);
  });
});
