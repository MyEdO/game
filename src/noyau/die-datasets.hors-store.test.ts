import { describe, expect, it, vi } from 'vitest';
import artilleryMisfireJson from '../data/artillery-misfire.json';
import { deDeSalve } from '../data/artilleryMisfire';
import { deDeTirageDe } from '../data/rangees';
import * as critiquesDeNavire from '../data/shipCriticals';
import * as critiquesDeStructure from '../data/structureCriticals';
import { parseDiceRequired } from '../engine/dice';
import { DE_SALVE_MISFIRE } from '../engine/artilleryMisfire';
import { rollShipCritical } from '../engine/shipCritical';
import { rollStructureCritical } from '../engine/structureCritical';

const D6 = parseDiceRequired('d6', 'fixture');

describe('dés authorés des tables — câblage aux lecteurs', () => {
  it.each(['2d10', 'd10+1'])('la Salve refuse une expression incompatible avec sa porte : %s', (die) => {
    expect(() => deDeSalve(parseDiceRequired(die, 'fixture'), die)).toThrow('exige un dé unique sans modificateur');
  });
  it('la Salve expose le dé authoré à sa porte', () => {
    expect(DE_SALVE_MISFIRE).toEqual(deDeTirageDe(artilleryMisfireJson));
  });
  it('le critique de structure tire le dé authoré', () => {
    vi.spyOn(critiquesDeStructure, 'STRUCTURE_CRITICALS_DIE', 'get').mockReturnValue(D6);
    const int = vi.fn(() => 3);
    rollStructureCritical({ int });
    expect(int).toHaveBeenCalledExactlyOnceWith(1, 6);
  });
  it('le critique de navire tire le dé authoré', () => {
    const jeu = critiquesDeNavire.SHIP_CRIT_SET;
    vi.spyOn(critiquesDeNavire, 'SHIP_CRIT_SET', 'get').mockReturnValue({ ...jeu, die: D6 });
    const int = vi.fn(() => 3);
    rollShipCritical('avirons', { int });
    expect(int).toHaveBeenCalledExactlyOnceWith(1, 6);
  });
  it('le critique fluvial certain ne consomme aucun tirage', () => {
    const int = vi.fn(() => 3);
    expect(rollShipCritical('avirons', { int }, undefined, critiquesDeNavire.RIVER_CRIT_SET).id).toBe('rames-fluvial');
    expect(int).not.toHaveBeenCalled();
  });
});
