/**
 * LES DÉSIGNATIONS DES VERBES (#2898, #2928) : la table du noyau (`DESIGNATIONS`, src/noyau/designations.ts) est la seule
 * source des ids qu'un paramètre de verbe désigne : les paramètres des verbes (`VERBES`, lus du type du noyau) portent
 * chacune de ses clés, et aucune autre, avec les valeurs des réglages de jet (`REGLAGES`) et des choix de fenêtre
 * (`CHOIX`) ; `argumentsDuVerbe` (`geste.ts`) contrôle un id contre elle, et la valeur d'un réglage ou d'un choix contre
 * la forme du sien (#3368, #3369).
 */
import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { DESIGNATIONS, type Designation } from '../noyau/index';
import { CHOIX, REGLAGES, VERBES } from './verbes.generated';
import type { Forme } from './formes';
import { argumentsDuVerbe, gesteDuVerbe, SANS_PISTE } from './geste';
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
    expect(refus(['attaque', 'localisation', 'tete'])).toBeNull();
    expect(refus(['attaque', 'localisation', null])).toBeNull();
    expect(refus(['incantation', 'surincantationDuree', 2])).toBeNull();
  });

  it('une valeur d’une autre forme, un réglage ou un flux que la partie ne déclare pas se refusent', () => {
    expect(refus(['attaque', 'localisation', 42]), 'un nombre n’est pas une Localisation').not.toBeNull();
    expect(refus(['attaque', 'deuxArmes', 'oui']), 'une bascule est un booléen').not.toBeNull();
    expect(refus(['incantation', 'surincantationDuree', true]), 'des pas sont un nombre').not.toBeNull();
    expect(refus(['incantation', 'localisation', 'tete'])).toContain('n’est pas un réglage du flux incantation');
    expect(refus(['course', 'localisation', 'tete'])).toContain('n’est pas un flux réglé');
  });

  it('un id que l’état ne désigne pas se refuse en nommant les ids valides', () => {
    expect(refus(['chansonDeMarin', 'chanson', 'pas-une-chanson'])).toContain('pas-une-chanson');
  });
  describe('un choix de fenêtre', () => {
    const choix = refusDe('fenetreChoisir');

    it('une valeur à la forme de son choix passe', () => {
      expect(choix(['destin', 'issue', 'accepter'])).toBeNull();
      expect(choix(['renier', 'renier', false])).toBeNull();
      expect(choix(['infirmerie', 'patient', etat.party[0].id])).toBeNull();
    });

    it('une valeur d’une autre forme, un id que l’état ne désigne pas, un choix ou une fenêtre que la partie ne déclare pas se refusent', () => {
      expect(choix(['destin', 'issue', 'fuir']), 'une issue hors du Destin').not.toBeNull();
      expect(choix(['renier', 'renier', 'oui']), 'renier est un booléen').not.toBeNull();
      expect(choix(['infirmerie', 'patient', 'pas-un-heros'])).toContain('pas-un-heros');
      expect(choix(['infirmerie', 'paie', 'x'])).toContain('n’est pas un choix de la fenêtre infirmerie');
      expect(choix(['cascade', 'abandon', true])).toContain('n’est pas une fenêtre à choix');
    });

    it('la rangée (`pid`) d’un choix de rangée désigne un héros du groupe, aucun flux de jet ouvert', () => {
      const heroId = etat.party[0].id;
      expect(argumentsDuVerbe(etat, 'fenetreChoisir', ['repos', 'couchage', 'commune', heroId], VERBES.fenetreChoisir)).toEqual(['repos', 'couchage', 'commune', heroId]);
    });
  });
});

describe('une désignation nomme ses ids sur ce qu’elle a lu une fois de l’état (#3975)', () => {
  it('nommer un id, connu ou non, ne relit aucun champ de l’état', () => {
    const { partie } = ouvrirLaPartie(nouvelEntete('dome', { graine: 7 }), () => {});
    try {
      const etat = partie.etat();
      const lus: string[] = [];
      const espionne = new Proxy(etat, {
        get: (cible, cle, recepteur) => {
          lus.push(String(cle));
          return Reflect.get(cible, cle, recepteur);
        },
      });
      const relus: string[] = [];
      let nommes = 0;
      for (const [cle, designation] of Object.entries(DESIGNATIONS) as [string, Designation][]) {
        const nommer = designation.nom(espionne);
        lus.length = 0;
        for (const id of [...designation.lire(etat), 'id-absent']) if (nommer(id) !== null) nommes += 1;
        if (lus.length) relus.push(`${cle} : ${[...new Set(lus)].join(', ')}`);
      }
      expect(relus).toEqual([]);
      expect(nommes, 'aucun id nommé : la fixture ne désigne rien').toBeGreaterThan(0);
    } finally {
      partie.fermer();
    }
  });
});
