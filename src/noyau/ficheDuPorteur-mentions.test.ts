/** Les mentions d'un porteur sur sa fiche, sous leur nature (#4053). */
import { describe, it, expect } from 'vitest';
import { ficheDuCombattant } from './ficheDuPorteur';
import { porterAuParcours } from '../engine/pnjDeCarriere';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';

describe('ficheDuCombattant — les mentions, une rubrique par nature', () => {
  it('l’Agitateur de Niveau 4 montre ses Pamphlétaires et son Mécène sous « Personnes », comptés', () => {
    const c = combattantDeTest({ id: 'tribun' });
    porterAuParcours(c, { carrieres: { agitateur: 4 } });
    const fiche = ficheDuCombattant(c, () => undefined)!;
    expect(fiche.mentions.find((m) => m.nature === 'personne')).toEqual({
      nature: 'personne',
      titre: 'Personnes',
      mentions: [{ libelle: 'Pamphlétaire', nombre: 1 }, { libelle: 'Pamphlétaires', nombre: 3 }, { libelle: 'Mécène', nombre: 1 }],
    });
  });
});
