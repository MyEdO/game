import { describe, expect, it, vi } from 'vitest';
import artilleryMisfireJson from '../data/artillery-misfire.json';
import { artilleryMisfireDie } from '../data/artilleryMisfire';
import { deDeTirageDe } from '../data/rangees';
import { RIVER_CRIT_SET } from '../data/shipCriticals';
import { deDeLaTable, setDeDeTable, type DatasetKey } from '../data/overrides';
import { rollShipCritical } from '../engine/shipCritical';
import { rollStructureCritical } from '../engine/structureCritical';

/** `corps` joué sous le dé `die` posé au seam (`setDeDeTable`) sur la table de `cle`, le dé imprimé rendu ensuite. */
function sousLeDe(cle: DatasetKey, die: string, corps: () => void): void {
  const imprime = deDeLaTable(cle)!;
  setDeDeTable(cle, die);
  try { corps(); } finally { setDeDeTable(cle, imprime); }
}

describe('dés authorés des tables — câblage aux lecteurs', () => {
  it.each(['2d10', 'd10+1'])('la Salve refuse une expression incompatible avec sa porte : %s', (die) => {
    sousLeDe('artilleryMisfire', die, () => {
      expect(() => artilleryMisfireDie()).toThrow('exige un dé unique sans modificateur');
    });
  });
  it('la Salve expose le dé authoré à sa porte', () => {
    expect(artilleryMisfireDie()).toEqual(deDeTirageDe(artilleryMisfireJson));
  });
  it('le critique de structure tire le dé authoré', () => {
    sousLeDe('structureCriticals', 'd6', () => {
      const int = vi.fn(() => 3);
      rollStructureCritical({ int });
      expect(int).toHaveBeenCalledExactlyOnceWith(1, 6);
    });
  });
  it('le critique de navire tire le dé authoré', () => {
    sousLeDe('shipCriticalsAvirons', 'd6', () => {
      const int = vi.fn(() => 3);
      rollShipCritical('avirons', { int });
      expect(int).toHaveBeenCalledExactlyOnceWith(1, 6);
    });
  });
  it('le critique fluvial certain ne consomme aucun tirage', () => {
    const int = vi.fn(() => 3);
    expect(rollShipCritical('avirons', { int }, undefined, RIVER_CRIT_SET).id).toBe('rames-fluvial');
    expect(int).not.toHaveBeenCalled();
  });
});
