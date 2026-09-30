/**
 * `speciesSingular` — l'espèce d'un INDIVIDU telle que le joueur la lit sur sa fiche (B1) : « Nain »,
 * « Humain (Reiklander) », jamais le libellé de catégorie « Nains ». Lue par l'`id` de l'espèce : le nom
 * singulier de sa race au catalogue (`espece.individu.<refChar>`), la variante en donnée (`variant`).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { speciesSingular, species } from './index';
import { fr } from '../i18n/messages/fr';

const catalogue = fr as Record<string, string>;
const livre = { ...catalogue };
afterEach(() => { Object.assign(catalogue, livre); });

describe('speciesSingular — affichage singulier d’un individu (B1), par id', () => {
  it('espèce nominale → nom singulier de sa race', () => {
    expect(speciesSingular('nains')).toBe('Nain');
    expect(speciesSingular('halflings')).toBe('Halfling');
    expect(speciesSingular('gnomes')).toBe('Gnome');
    expect(speciesSingular('ogres')).toBe('Ogre');
    expect(speciesSingular('hauts-elfes')).toBe('Haut elfe');
    expect(speciesSingular('elfes-sylvains')).toBe('Elfe sylvain');
  });

  it('variante régionale → race au singulier, variante entre parenthèses', () => {
    expect(speciesSingular('humains-reiklander')).toBe('Humain (Reiklander)');
    expect(speciesSingular('nains-norse')).toBe('Nain (Norse)');
    expect(speciesSingular('halflings-pochegaree')).toBe('Halfling (Pochégarée)');
    expect(speciesSingular('humains-bjornling-norse')).toBe('Humain (Bjornling Norse)');
  });

  it('chaque espèce du catalogue a son nom singulier au catalogue de messages', () => {
    for (const s of species) expect(speciesSingular(s.id), s.id).not.toMatch(/espece\.individu\./);
  });

  it('le texte suit le catalogue, jamais le libellé de la donnée', () => {
    catalogue['espece.individu.nain'] = 'Dwarf';
    expect(speciesSingular('nains-norse')).toBe('Dwarf (Norse)');
  });

  it('id inconnu → absence nommée ; sans espèce → rien', () => {
    expect(speciesSingular('skavens')).toBe('race « skavens » retirée du Compendium');
    expect(speciesSingular(undefined)).toBe('');
  });
});
