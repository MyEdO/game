/**
 * LECTEUR — les poses de concept de la grammaire (#3012) : chaque id de la table se lit sur un nœud
 * qu'un def atteint, une double pose lève, un clone d'un nœud posé n'est pas lu, et aucun concept posé
 * n'est perdu par la descente des defs.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { SCHEMA_DEFS } from '../_registry.generated';
import { SCHEMA_DEFS_SCENES } from '../_registry-scenes.generated';
import { conceptDe, noeudDuConcept, posesPerdues } from './concepts';
import { marquerConcept, marquerConceptDeClasse } from './interne/concepts';
import { descendre } from './descente';
import { ref, refOuSpec, pick } from './ref';
import { nommerNoeud } from './meta';
import { descRefSchemaDe, diceSpecSchema, moneySchema } from './valeurs';

const RACINES = [...Object.values(SCHEMA_DEFS), ...Object.values(SCHEMA_DEFS_SCENES)].map((d) => d.schema);

describe('lecture — un id par entrée de la table', () => {
  it('la descente des defs lit chaque concept posé, nœud ou classe', () => {
    const lus = new Set<string>();
    descendre(RACINES, ({ noeud }) => {
      const id = conceptDe(noeud);
      if (id) lus.add(id);
    });
    expect([...lus].sort()).toEqual([
      'adresse', 'billet-de-route', 'cloture', 'condition-flag', 'de', 'degats-arme', 'dotation', 'effet-d-etat-designer', 'effet-d-etat-poser',
      'effet-narratif-document', 'effet-narratif-indice', 'formule-minimum', 'formule-peche', 'formule-somme',
      'formule-tranche', 'fragment-blocs', 'fragment-cellule', 'identite-de-heros', 'ligne-d-identite', 'marchandage-de-billet',
      'monnaie', 'monnaie-partielle', 'ouverture', 'palette-d-objet', 'palier-de-billet', 'plage', 'plage-ouverte', 'prix-saisonnier',
      'profil-de-propulsion', 'profil-de-voile', 'prose-nommee', 'provenance-de-valeur', 'provenances-de-route', 'quantite',
      'reference', 'reference-a-specialisation', 'reference-chiffree', 'reference-typee', 'source', 'source-secondaire', 'special-de-jeu', 'test',
      'tirage-parmi', 'tirage-sur-table', 'trait-pose', 'valeur-d-identite',
    ]);
  });

  it('pose de nœud : le nœud se lit sur le concept, et le concept sur le nœud', () => {
    expect([noeudDuConcept('monnaie'), conceptDe(moneySchema)]).toEqual([moneySchema, 'monnaie']);
  });

  it('pose de classe : toute instance neuve de la classe porte le concept', () => {
    expect([descRefSchemaDe(), ref('skill'), refOuSpec('skill'), pick('skill')].map(conceptDe)).toEqual([
      'adresse', 'reference', 'reference-a-specialisation', 'tirage-parmi',
    ]);
    expect(noeudDuConcept('reference')).toEqual({ fabrique: 'objetDeRef', roles: ['ref'], clesDExtra: [] });
  });

  it('une classe compte ses clés d’extra : un appelant qui en apporte une autre n’hérite pas du concept', () => {
    const valeur = nommerNoeud(z.number(), { nom: 'valeur' });
    expect(conceptDe(ref('skill', { value: valeur }))).toBeUndefined();
    expect(conceptDe(refOuSpec('skill', { value: valeur }))).toBe('reference-chiffree');
  });
});

describe('écriture — une double pose lève', () => {
  it('un autre concept sur un nœud déjà posé', () => {
    expect(() => marquerConcept('monnaie', diceSpecSchema)).toThrow('le nœud porte déjà le concept « de »');
  });
  it('un concept déjà posé, sur un autre nœud', () => {
    expect(() => marquerConcept('monnaie', z.strictObject({}))).toThrow('Concept « monnaie » : déjà posé');
  });
  it('un autre concept sur une classe déjà posée', () => {
    expect(() => marquerConceptDeClasse('monnaie', { fabrique: 'objetDeRef', roles: ['ref'], clesDExtra: [] })).toThrow('la classe objetDeRef:ref: porte déjà le concept « reference »');
  });
  it('un concept déjà posé, sur une autre classe', () => {
    expect(() => marquerConceptDeClasse('reference', { fabrique: 'objetDeRef', roles: ['inconnu'], clesDExtra: [] })).toThrow('Concept « reference » : déjà posé');
    expect([conceptDe(ref('skill')), noeudDuConcept('reference')]).toEqual(['reference', { fabrique: 'objetDeRef', roles: ['ref'], clesDExtra: [] }]);
  });
});

describe('registre sans clone', () => {
  it('un clone `.superRefine()` d’un nœud posé ne porte pas le concept', () => {
    expect(conceptDe(moneySchema.superRefine(() => {}))).toBeUndefined();
  });
});

describe('poses perdues', () => {
  it('aucun concept posé n’échappe à la descente des defs', () => {
    expect(posesPerdues(RACINES)).toEqual([]);
  });
  it('un concept que la descente n’atteint pas est perdu', () => {
    const perdues = posesPerdues([moneySchema]);
    expect([perdues.includes('monnaie'), perdues.includes('de')]).toEqual([false, true]);
  });
});
