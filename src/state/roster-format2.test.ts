/**
 * Brouillon du roster au format des choix 2 (`trappingChoices` par libellé d'emplacement) relu au
 * format 3 (par adresse, #1988). Tout le fichier tourne sous un catalogue de messages dont CHAQUE texte
 * est remplacé (le catalogue est lu à l'appel de `t()`) : la relecture ne dépend que de la donnée et des
 * liants figés du format 2.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rosterLoad } from './roster';
import { FORMAT_DES_CHOIX } from '../engine/character';
import { adresseDeCreation } from '../engine/adresseDeCreation';
import { resolveTrappingChoices } from '../engine/trappingChoices';
import { avecDotations, CARRIERE_FIXTURE, DOTATIONS_FIXTURE } from '../data/dotations.fixture';
import { t } from '../i18n';
import { fr } from '../i18n/messages/fr';

const dot = adresseDeCreation.dotation;
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
  return rosterLoad()[0].draft;
};

/** Brouillon écrit au format 2 pour `DOTATIONS_FIXTURE` : clés et branches en libellés FR. */
const FORMAT2 = {
  v: 2,
  speciesId: 'humains-reiklander',
  careerId: CARRIERE_FIXTURE,
  label: 'Ancien',
  specChoices: { 'carriere:competences:1': 'histoire' },
  speciesTalentChoices: { 'espece:talents:0': 1 },
  trappingChoices: {
    'Miroir à main ou Fleuret (qualité au choix)': 'Fleuret (qualité au choix)',
    'Fleuret (qualité au choix)': 'solide',
    'Arme (au choix)': 'baton-de-combat',
    'Dague ou Arme (au choix) ou Grande hache': 'Dague ou Arme (au choix)',
    'Dague ou Arme (au choix)': 'Arme (au choix)',
    'Épée ou rien': 'Épée',
  },
};

describe('rosterLoad — brouillon au format 2 relu au format 3', () => {
  const catalogue = fr as Record<string, string>;
  const livre = { ...catalogue };
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
    for (const k of Object.keys(catalogue)) catalogue[k] = `«${k}»`;
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
    Object.assign(catalogue, livre);
  });

  it('le catalogue de messages de ce fichier est bien remplacé', () => {
    expect(t('ref.auChoix', { base: 'x' })).toBe('«ref.auChoix»');
  });

  it('chaque clé-libellé devient l\'adresse de chaque emplacement qu\'elle nommait, la branche son index ; une clé orpheline ne se reporte pas', () => {
    avecDotations(CARRIERE_FIXTURE, DOTATIONS_FIXTURE, () => {
      const draft = relire(FORMAT2)!;
      expect(draft.v).toBe(FORMAT_DES_CHOIX);
      expect(draft.specChoices).toEqual({ [adresseDeCreation.carriereCompetence(1)]: 'histoire' });
      expect(draft.speciesTalentChoices).toEqual({ [adresseDeCreation.especeTalent(0)]: 1 });
      expect(draft.trappingChoices).toEqual({
        [dot([0])]: 1,
        [dot([0, 1])]: 'solide',
        [dot([1])]: 'baton-de-combat',
        [dot([3])]: 0,
        [dot([3, 0])]: 1,
        [dot([3, 0, 1])]: 'baton-de-combat',
        [dot([4])]: 'solide',
      });
    });
  });

  it('les choix effectifs sont ceux du format 2', () => {
    avecDotations(CARRIERE_FIXTURE, DOTATIONS_FIXTURE, () => {
      expect(resolveTrappingChoices(CARRIERE_FIXTURE, 1, relire(FORMAT2)!.trappingChoices!)).toEqual([
        { id: 'fleuret', qualities: [{ id: 'solide', value: 1 }] },
        { id: 'baton-de-combat' },
        { id: 'pinceau' },
        { id: 'baton-de-combat' },
        { id: 'fleuret', qualities: [{ id: 'solide', value: 1 }] },
      ]);
    });
  });

  it('idempotente : un brouillon relu se relit à l\'identique', () => {
    avecDotations(CARRIERE_FIXTURE, DOTATIONS_FIXTURE, () => {
      const une = relire(FORMAT2)!;
      expect(relire(une)).toEqual(une);
    });
  });

  it('un brouillon sans `trappingChoices` traverse', () => {
    const draft = relire(Object.fromEntries(Object.entries(FORMAT2).filter(([k]) => k !== 'trappingChoices')))!;
    expect(draft.v).toBe(FORMAT_DES_CHOIX);
    expect(draft).not.toHaveProperty('trappingChoices');
  });

  it('au format 3, une clé qui n\'a pas la forme d\'une adresse n\'est pas lue', () => {
    const draft = relire({ ...FORMAT2, v: FORMAT_DES_CHOIX, trappingChoices: { [dot([1])]: 'dague', 'Arme (au choix)': 'dague' } })!;
    expect(draft.trappingChoices).toEqual({ [dot([1])]: 'dague' });
  });
});
