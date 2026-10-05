/**
 * Relecture du brouillon persisté du roster (`brouillonRelu`, `state/roster.ts`) : au format
 * `FORMAT_DES_CHOIX`, ses choix par adresse sont relus par `adresseLue` ; tout autre format est écarté (#1897).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rosterLoad } from './roster';
import { FORMAT_DES_CHOIX } from '../engine/character';
import { adresseDeCreation } from '../engine/adresseDeCreation';

const KEY = 'wfrp4.roster.v1';

function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  } as Storage;
}

const entree = (draft: object) => ({ hero: { id: 'h', label: 'Héros', kind: 'hero' }, wealth: { gold: 0, silver: 0, brass: 0 }, draft });
const relire = (draft: object) => {
  localStorage.setItem(KEY, JSON.stringify([entree(draft)]));
  return rosterLoad()[0];
};

const COURANT = {
  v: FORMAT_DES_CHOIX,
  speciesId: 'humains-reiklander',
  careerId: 'sorcier',
  label: 'Courant',
  specChoices: { [adresseDeCreation.carriereCompetence(1)]: 'histoire', 'Savoir (au choix)': 'histoire' },
  speciesTalentChoices: { [adresseDeCreation.especeTalent(0)]: { id: 'perspicace' }, 'Perspicace ou Affable': { id: 'perspicace' } },
  randomSpecPicks: { [adresseDeCreation.especeTirage(2, 0)]: 'arithmetique', 'Savoir': 'arithmetique' },
  talentRerolls: { [adresseDeCreation.especeTirage(2, 1)]: 1, 'Talent aléatoire': 1 },
  trappingChoices: { [adresseDeCreation.dotation([1])]: 'dague', [adresseDeCreation.dotation([0, 1])]: 1, 'Arme (au choix)': 'dague' },
};

describe('rosterLoad — brouillon persisté', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it('au format courant, chaque choix est relu par son adresse ; une clé sans forme d\'adresse est écartée', () => {
    const draft = relire(COURANT).draft!;
    expect(draft.v).toBe(FORMAT_DES_CHOIX);
    expect(draft.specChoices).toEqual({ [adresseDeCreation.carriereCompetence(1)]: 'histoire' });
    expect(draft.speciesTalentChoices).toEqual({ [adresseDeCreation.especeTalent(0)]: { id: 'perspicace' } });
    expect(draft.randomSpecPicks).toEqual({ [adresseDeCreation.especeTirage(2, 0)]: 'arithmetique' });
    expect(draft.talentRerolls).toEqual({ [adresseDeCreation.especeTirage(2, 1)]: 1 });
    expect(draft.trappingChoices).toEqual({ [adresseDeCreation.dotation([1])]: 'dague', [adresseDeCreation.dotation([0, 1])]: 1 });
  });

  it('un brouillon au format 4 est écarté, le héros reste', () => {
    const lue = relire({ ...COURANT, v: 4, trappingChoices: { 'Arme (au choix)': 'dague' } });
    expect(lue.hero.label).toBe('Héros');
    expect(lue.draft).toBeUndefined();
  });
});
