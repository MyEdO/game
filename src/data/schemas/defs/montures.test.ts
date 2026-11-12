/** EDOC 07 l.12-93 ; `mountProfileForCreature` (`src/engine/mountTravel.ts`). */
import { describe, expect, it } from 'vitest';
import monturesJson from '../../montures.json';
import { validateDataset } from '../validate';

const FICHIER = 'montures.json';

describe('montures.json — une créature, un seul profil', () => {
  it('accepte la donnée réelle', () => {
    expect(validateDataset(FICHIER, monturesJson)).toBeNull();
  });

  it('REFUSE, en les nommant, deux profils qui citent la même créature', () => {
    const dernier = monturesJson[monturesJson.length - 1];
    const clone = { ...dernier, id: `${dernier.id}-croissance` };
    expect(validateDataset(FICHIER, [...monturesJson, clone])).toContain(
      `la créature « ${dernier.creatureIds[0]} » est citée par les profils « ${dernier.id} » et « ${clone.id} » — une créature, un seul profil de monture.`,
    );
  });
});
