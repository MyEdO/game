import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { describe, expect, it } from 'vitest';
import { TEINTE, scenario } from './teinte-au-combat';
import { porteeDuCombattant } from '../../noyau/apparence/combattant';
import { piecesDeLObjet } from '../../data';
import { spawnEnemy } from '../../noyau/monde/spawn';
import { findCreatureById } from '../../data';

const { party } = scenario.construire(idsDeTest);
const lame = party.find((h) => h.id === 'lame-aethyrique')!;

describe('scénario « Teinte et armure au combat » (#3456)', () => {
  it('sans aucun geste, la Lame aethyrique tient l’épée teinte en main principale et porte les pièces de ses brassards', () => {
    const { portees } = porteeDuCombattant(lame)!;
    expect(portees.filter((p) => p.cle.champ === 'apparence').map((p) => [p.point, p.cle.id, p.teinte])).toEqual([['main', 'epee', TEINTE]]);
    expect(portees.filter((p) => p.par?.id === 'brassards').map((p) => p.cle.id)).toEqual([...piecesDeLObjet('brassards')]);
  });

  it('l’orc de la rencontre revêt les pièces de son armure de statbloc déclarée portée', () => {
    const orc = spawnEnemy({ presetCreature: findCreatureById('orc')!, presetId: 'orc' }, 'orc-1', { x: 0, y: 0 });
    expect(orc.appearanceOverride?.armurePortee ?? findCreatureById('orc')?.appearance?.armurePortee).toBe(true);
    expect(porteeDuCombattant(orc)!.portees.some((p) => p.cle.champ === 'piece' && p.par === undefined)).toBe(true);
  });
});
