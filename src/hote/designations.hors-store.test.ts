/**
 * LES DÉSIGNATIONS DES VERBES (#2898, #2928) : la table du noyau (`DESIGNATIONS`, src/noyau/designations.ts) est la seule
 * source des ids qu'un paramètre de verbe désigne : les paramètres des verbes (`VERBES`, lus du type du noyau) portent
 * chacune de ses clés, et aucune autre, avec les valeurs des réglages de jet (`REGLAGES`) et des choix de fenêtre
 * (`CHOIX`) ; `argumentsDuVerbe` (`geste.ts`) contrôle un id contre elle, et la valeur d'un réglage ou d'un choix contre
 * la forme du sien (#3368, #3369).
 */
import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { DESIGNATIONS } from '../noyau/index';
import { CHOIX, REGLAGES, VERBES } from './verbes.generated';
import type { Forme } from './formes';
import { gesteDuVerbe, SANS_PISTE } from './geste';
import { ErreurDeGeste, nouvelEntete, ouvrirLaPartie } from './partie';

/** Les désignations que les formes d'une liste de paramètres portent. */
function designationsDe(f: Forme): string[] {
  switch (f.genre) {
    case 'chaine': return f.designe ? [f.designe.cle] : [];
    case 'objet': return f.champs.flatMap((c) => designationsDe(c.forme));
    case 'dictionnaire': return [...designationsDe(f.cle), ...designationsDe(f.valeur), ...(f.champs ?? []).flatMap((c) => designationsDe(c.forme))];
    case 'tuple': return f.elements.flatMap(designationsDe);
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
      ...Object.values(CHOIX).flatMap((formes) => Object.values(formes).flatMap(designationsDe)),
    ]);
    expect([...portees].sort()).toEqual(Object.keys(DESIGNATIONS).sort());
  });
});

describe('la valeur d’un réglage de jet ou d’un choix de fenêtre se contrôle contre la forme de son axe (`REGLAGES`, `CHOIX`)', () => {
  let partie: ReturnType<typeof ouvrirLaPartie>['partie'];
  let etat: ReturnType<typeof partie.etat>;
  beforeAll(() => {
    ({ partie } = ouvrirLaPartie(nouvelEntete('dome', { graine: 7 }), () => {}));
    etat = partie.etat();
  });
  afterAll(() => partie.fermer());
  const refusDe = (type: string) => (args: unknown[]): string | null => {
    try {
      gesteDuVerbe(etat, { type, args }, SANS_PISTE);
      return null;
    } catch (e) {
      if (e instanceof ErreurDeGeste && e.categorie === 'validation') return e.message;
      throw e;
    }
  };
  const refus = refusDe('jetRegler');

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
  describe('un choix de fenêtre', () => {
    const choix = refusDe('fenetreChoisir');

    it('une valeur à la forme de son choix passe', () => {
      expect(choix(['fateSave', 'issue', 'accept'])).toBeNull();
      expect(choix(['renounce', 'renier', false])).toBeNull();
      expect(choix(['medic', 'patient', etat.party[0].id])).toBeNull();
    });

    it('une valeur d’une autre forme, un id que l’état ne désigne pas, un choix ou une fenêtre que la partie ne déclare pas se refusent', () => {
      expect(choix(['fateSave', 'issue', 'fuir']), 'une issue hors du Destin').not.toBeNull();
      expect(choix(['renounce', 'renier', 'oui']), 'renier est un booléen').not.toBeNull();
      expect(choix(['medic', 'patient', 'pas-un-heros'])).toContain('pas-un-heros');
      expect(choix(['medic', 'paie', 'x'])).toContain('n’est pas un choix de la fenêtre medic');
      expect(choix(['cascade', 'abandon', true])).toContain('n’est pas une fenêtre à choix');
    });
  });
});
