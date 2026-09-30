import { describe, it, expect } from 'vitest';
import {
  emplacementsDeDotation,
  emplacementTranche,
  estEmplacementDeDotation,
  estEmplacementRacine,
  resolveTrappingChoices,
  type ChoixDeDotation,
} from './trappingChoices';
import { adresseDeCreation } from './adresseDeCreation';
import { avecDotations, CARRIERE_FIXTURE, DOTATIONS_FIXTURE } from '../data/dotations.fixture';
import { trappingRefLabel, fabricationAtouts, trappings, type TrappingRef } from '../data/index';
import { setDataset } from '../data/overrides';

const dot = adresseDeCreation.dotation;
const avecFixture = <T>(fn: () => T): T => avecDotations(CARRIERE_FIXTURE, DOTATIONS_FIXTURE, fn);
const resoudre = (choices: ChoixDeDotation): TrappingRef[] => resolveTrappingChoices(CARRIERE_FIXTURE, 1, choices);

describe('emplacementsDeDotation — énumération canonique (classe PUIS niveau, chemin des branches)', () => {
  it('adresse chaque emplacement par sa position dans les dotations (classe puis niveau), puis ses indices de branche', () => {
    avecFixture(() => {
      expect(emplacementsDeDotation(CARRIERE_FIXTURE, 1).map((e) => [e.adresse, e.sorte])).toEqual([
        [dot([0]), 'branches'],
        [dot([0, 1]), 'atout'],
        [dot([1]), 'joker'],
        [dot([3]), 'branches'],
        [dot([3, 0]), 'branches'],
        [dot([3, 0, 1]), 'joker'],
        [dot([4]), 'atout'],
      ]);
      expect(emplacementsDeDotation(CARRIERE_FIXTURE, 1).filter(estEmplacementRacine).map((e) => e.adresse)).toEqual([dot([0]), dot([1]), dot([3]), dot([4])]);
    });
  });

  it('`estEmplacementDeDotation` : `{choice}`, `{wildcard}`, `{id, qualityChoice}` ; une ref concrète n\'en est pas un', () => {
    expect([{ choice: [] }, { wildcard: 'arme' }, { id: 'fleuret', qualityChoice: true }].map((r) => estEmplacementDeDotation(r as TrappingRef))).toEqual([true, true, true]);
    expect(([{ id: 'dague' }, { text: 'Toges' }, { creatureId: 'cheval' }, { vehicleId: 'charrette' }] as TrappingRef[]).map(estEmplacementDeDotation)).toEqual([false, false, false, false]);
  });
});

describe('resolveTrappingChoices — les choix par adresse', () => {
  it('contrat positif : branche B d\'un `{choice}`, arme d\'un `{wildcard}`, Atout d\'un `{id, qualityChoice}`', () => {
    avecFixture(() => {
      expect(resoudre({ [dot([0])]: 1, [dot([0, 1])]: 'solide', [dot([1])]: 'baton-de-combat', [dot([3])]: 1, [dot([4])]: 'leger' })).toEqual([
        { id: 'fleuret', qualities: [{ id: 'solide', value: 1 }] },
        { id: 'baton-de-combat' },
        { id: 'pinceau' },
        { id: 'grande-hache' },
        { id: 'fleuret', qualities: [{ id: 'leger' }] },
      ]);
    });
  });

  it('un `{choice}` imbriqué se résout par le chemin de ses branches', () => {
    avecFixture(() => {
      expect(resoudre({ [dot([3])]: 0, [dot([3, 0])]: 1, [dot([3, 0, 1])]: 'dague' })[3]).toEqual({ id: 'dague' });
    });
  });

  it('sans choix : `{choice}` et joker restent tels quels, l’Atout prend son défaut (raffine)', () => {
    avecFixture(() => {
      expect(resoudre({})).toEqual([
        DOTATIONS_FIXTURE.classe[0],
        { wildcard: 'arme' },
        { id: 'pinceau' },
        DOTATIONS_FIXTURE.niveau[2],
        { id: 'fleuret', qualities: [{ id: 'raffine' }] },
      ]);
    });
  });

  it('une branche choisie dont le `{choice}` imbriqué n’est pas tranché rend ce `{choice}` tel quel', () => {
    avecFixture(() => {
      expect(resoudre({ [dot([3])]: 0 })[3]).toEqual({ choice: [{ id: 'dague' }, { wildcard: 'arme' }] });
    });
  });

  it('les MÊMES choix survivent à un renommage du `label` des objets dans la donnée', () => {
    avecFixture(() => {
      const choix = { [dot([0])]: 1, [dot([1])]: 'baton-de-combat', [dot([3])]: 1 };
      const avant = resoudre(choix);
      const origine = [...trappings];
      setDataset('trappings', origine.map((t) => ({ ...t, label: `${t.label} (renommé)` })));
      try {
        expect(trappingRefLabel({ id: 'grande-hache' })).toMatch(/renommé/);
        expect(resoudre(choix)).toEqual(avant);
      } finally {
        setDataset('trappings', origine);
      }
    });
  });

  it('une valeur hors des branches laisse le `{choice}` tel quel', () => {
    avecFixture(() => {
      expect(resoudre({ [dot([3])]: 9 })[3]).toEqual(DOTATIONS_FIXTURE.niveau[2]);
    });
  });

  it('trappingRefLabel({choice}) joint les branches par " ou "', () => {
    expect(trappingRefLabel({ choice: [{ text: 'A' }, { text: 'B' }] })).toBe('A ou B');
  });

  it('trappingRefLabel affiche « (qualité au choix) » / les Atouts attachés', () => {
    expect(trappingRefLabel({ id: 'fleuret', qualityChoice: true })).toBe('Fleuret (qualité au choix)');
    expect(trappingRefLabel({ id: 'fleuret', qualities: [{ id: 'solide' }] })).toBe('Fleuret (Solide)');
  });

  it('fabricationAtouts() est DÉRIVÉ de qualities.json (atout/objet), pas une liste codée', () => {
    expect(fabricationAtouts()).toEqual(['leger', 'pratique', 'raffine', 'solide']);
  });
});

describe('emplacementTranche — le joueur a-t-il tranché ?', () => {
  const emplacement = (adresse: string) => emplacementsDeDotation(CARRIERE_FIXTURE, 1).find((e) => e.adresse === adresse)!;

  it('un `{choice}` exige sa branche, et le choix de l\'emplacement que porte cette branche', () => {
    avecFixture(() => {
      const e = emplacement(dot([3]));
      expect(emplacementTranche(e, {})).toBe(false);
      expect(emplacementTranche(e, { [dot([3])]: 1 })).toBe(true);
      expect(emplacementTranche(e, { [dot([3])]: 0 })).toBe(false);
      expect(emplacementTranche(e, { [dot([3])]: 0, [dot([3, 0])]: 1 })).toBe(false);
      expect(emplacementTranche(e, { [dot([3])]: 0, [dot([3, 0])]: 1, [dot([3, 0, 1])]: 'dague' })).toBe(true);
      expect(emplacementTranche(e, { [dot([3])]: 7 })).toBe(false);
    });
  });

  it('un `{wildcard}` exige un objet ; un `{id, qualityChoice}` l\'est toujours, seul ou sous une branche', () => {
    avecFixture(() => {
      expect(emplacementTranche(emplacement(dot([1])), {})).toBe(false);
      expect(emplacementTranche(emplacement(dot([1])), { [dot([1])]: 'dague' })).toBe(true);
      expect(emplacementTranche(emplacement(dot([4])), {})).toBe(true);
      expect(emplacementTranche(emplacement(dot([0])), { [dot([0])]: 1 })).toBe(true);
    });
  });
});
