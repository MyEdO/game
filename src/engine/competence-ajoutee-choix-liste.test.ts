/**
 * `competenceEnCarriere` lit un ajout de Compétence à `choix` comme `talentsAjoutesALaCarriere` lit un
 * ajout de Talent : l'ajout se DÉPLIE sur son pool. LDB 10 l.745 ; EDOC 13 l.524.
 * Aucune donnée réelle ne porte un `grantCareerSkill` à `choix` en liste : l'op d'Artiste est remplacée
 * au seam (`setDataset`) le temps du test, instantané restitué en `afterEach`.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Combatant } from './types';
import { competenceEnCarriere } from './talentEffects';
import type { TalentData } from '../data';
import { setDataset, datasetArray } from '../data/overrides';

const TALENTS_LIVRES = [...(datasetArray('talents') as TalentData[])];

beforeEach(() => {
  setDataset(
    'talents',
    TALENTS_LIVRES.map((t) =>
      t.id === 'artiste' ? { ...t, passive: [{ op: 'grantCareerSkill', skill: { id: 'art', choix: ['dessin', 'redaction'] } }] } : t,
    ),
  );
});
afterEach(() => {
  setDataset('talents', TALENTS_LIVRES);
});

const heros = { id: 'h', kind: 'hero', skills: [], talents: [{ talentId: 'artiste', times: 1 }] } as unknown as Combatant;

describe('ajout de Compétence à `choix` en liste — dépliage sur la liste', () => {
  it('admet chaque spécialisation de la liste', () => {
    expect(competenceEnCarriere(heros, [], {}, 'art', 'dessin').statut).toBe('ajout');
    expect(competenceEnCarriere(heros, [], {}, 'art', 'redaction').statut).toBe('ajout');
  });
  it('refuse une spécialisation du pool de la Compétence absente de la liste', () => {
    expect(competenceEnCarriere(heros, [], {}, 'art', 'boucherie').statut).toBeNull();
  });
});
