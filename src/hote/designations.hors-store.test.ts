/**
 * LES DÉSIGNATIONS DES VERBES (#2898, #2928) : la table du noyau (`DESIGNATIONS`, src/noyau/designations.ts) est la seule
 * source des ids qu'un paramètre de verbe désigne : les paramètres des verbes (`VERBES`, lus du type du noyau) portent
 * chacune de ses clés, et aucune autre, avec les valeurs des réglages de jet (`REGLAGES`) ; `argumentsDuVerbe`
 * (`geste.ts`) contrôle un id contre elle, et la valeur d'un réglage contre la forme du sien (#3368).
 */
import { describe, it, expect, afterAll } from 'vitest';
import { DESIGNATIONS } from '../noyau/index';
import { REGLAGES, VERBES } from './verbes.generated';
import type { Forme } from './formes';
import { gesteDuVerbe, SANS_PISTE } from './geste';
import { ErreurDeGeste, nouvelEntete, ouvrirLaPartie } from './partie';

/** Les désignations que les formes d'une liste de paramètres portent. */
function designationsDe(f: Forme): string[] {
  switch (f.genre) {
    case 'chaine': return f.designe ? [f.designe.cle] : [];
    case 'objet': return [...(f.designe ? [f.designe.cle] : []), ...(f.champs ?? []).flatMap((c) => designationsDe(c.forme))];
    case 'union': return f.membres.flatMap(designationsDe);
    case 'tableau': return designationsDe(f.element);
    default: return [];
  }
}

describe('la table du noyau est la seule source des désignations', () => {
  it('chaque désignation de la table est portée par un paramètre de verbe, et aucune autre', () => {
    const portees = new Set([
      ...Object.values(VERBES).flatMap((ps) => ps.flatMap((p) => designationsDe(p.forme))),
      ...Object.values(REGLAGES).flatMap((formes) => Object.values(formes).flatMap(designationsDe)),
    ]);
    expect([...portees].sort()).toEqual(Object.keys(DESIGNATIONS).sort());
  });
});

describe('la valeur d’un réglage de jet se contrôle contre la forme de son réglage (`REGLAGES`)', () => {
  const { partie } = ouvrirLaPartie(nouvelEntete('dome', { graine: 7 }), () => {});
  afterAll(() => partie.fermer());
  const etat = partie.etat();
  const refus = (args: unknown[]): string | null => {
    try {
      gesteDuVerbe(etat, { type: 'jetRegler', args }, SANS_PISTE);
      return null;
    } catch (e) {
      if (e instanceof ErreurDeGeste && e.categorie === 'validation') return e.message;
      throw e;
    }
  };

  it('une valeur à la forme de son réglage passe', () => {
    expect(refus(['attack', 'localisation', 'tete'])).toBeNull();
    expect(refus(['attack', 'localisation', null])).toBeNull();
    expect(refus(['cast', 'surincantationDuree', 2])).toBeNull();
  });

  it('une valeur d’une autre forme, un réglage ou un flux que la partie ne déclare pas se refusent', () => {
    expect(refus(['attack', 'localisation', 42]), 'un nombre n’est pas une Localisation').not.toBeNull();
    expect(refus(['attack', 'deuxArmes', 'oui']), 'une bascule est un booléen').not.toBeNull();
    expect(refus(['cast', 'surincantationDuree', true]), 'des pas sont un nombre').not.toBeNull();
    expect(refus(['cast', 'localisation', 'tete'])).toContain('n’est pas un réglage du flux cast');
    expect(refus(['run', 'localisation', 'tete'])).toContain('n’est pas un flux réglé');
  });

  it('un id que l’état ne désigne pas se refuse en nommant les ids valides', () => {
    expect(refus(['shanty', 'chanson', 'pas-une-chanson'])).toContain('pas-une-chanson');
  });
});
