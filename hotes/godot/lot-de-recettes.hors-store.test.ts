/**
 * LES JEUX PARAMÉTRÉS DU LOT DES RECETTES (#4746, `lot-de-recettes.mjs`) : ce que `--jeux` nomme par un préfixe devient
 * le parcours de `recette.mjs` et ses arguments.
 */
import { expect, test } from 'vitest';
import { JEUX_PARAMETRES } from './lot-de-recettes.mjs';

test('planche:<nom> et preset:<id>[:<clip>:<instant>] nomment leur parcours, leurs arguments et leur dossier', () => {
  expect(JEUX_PARAMETRES['planche:']('fiche')).toEqual({ parcours: 'planche', args: ['--planche', 'fiche'], dossier: 'planche', journal: 'fiche.journal.txt' });
  expect(JEUX_PARAMETRES['preset:']('gladiateur')).toEqual({ parcours: 'preset', args: ['--preset', 'gladiateur'], dossier: 'preset-gladiateur', journal: 'journal.txt' });
  expect(JEUX_PARAMETRES['preset:']('sorcier:Sword_Attack:0.4'))
    .toEqual({ parcours: 'preset', args: ['--preset', 'sorcier', '--clip', 'Sword_Attack', '--instant', '0.4'], dossier: 'preset-sorcier', journal: 'journal.txt' });
});

test('ROUGE : preset refuse un clip sans instant, un instant qui n’est pas un nombre, un paramètre de trop', () => {
  for (const parametres of ['sorcier:Sword_Attack', 'sorcier:Sword_Attack:tot', 'sorcier:Sword_Attack:0.4:x']) expect(JEUX_PARAMETRES['preset:'](parametres), parametres).toBeNull();
});
