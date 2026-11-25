/** LES BORNES DE SORTIE DE L'HÔTE TEXTE (#2898, M2) sur le pire scénario mesuré du jeu de rôle (`ecuries-clayonnage` :
 *  673 combattants, une ligne de cibles de 13 649 caractères avant les bornes), l'hôte remis à son contenu. */
import { afterEach, describe, it } from 'vitest';
import { fermerLaTable, table } from '../../../hotes/texte/hote.testkit';
import { lesBornesDuCombat } from '../../../hotes/texte/bornes.testkit';
import { contenu } from '../contenu';

afterEach(fermerLaTable);

describe('les bornes de sortie sur `ecuries-clayonnage`', () => {
  it('nouvelle, jouer, vue, offres, carte, cases, fiche et journal tiennent leurs bornes', { timeout: 240_000 }, () => {
    lesBornesDuCombat(table(undefined, contenu.scenarios), 'ecuries-clayonnage');
  });
});
