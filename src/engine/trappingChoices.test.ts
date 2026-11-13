import { describe, it, expect } from 'vitest';
import {
  dotationsDuHeros,
  emplacementsDeDotation,
  emplacementTranche,
  estEmplacementDeDotation,
  estEmplacementRacine,
  resolveTrappingChoices,
  valeursDeLEmplacement,
  type ChoixDeDotation,
} from './trappingChoices';
import { adresseDeCreation } from './adresseDeCreation';
import { avecDotations, CARRIERE_FIXTURE, DOTATIONS_FIXTURE } from '../data/dotations.fixture';
import { careerLevels, findTrappingById, groupeDeLArme, trappingRefLabel, fabricationAtouts, qualities, trappings, type BrancheDeDotation, type QualityData, type TrappingRef } from '../data/index';
import { setDataset } from '../data/overrides';
import type { EntreeVivante } from '../data/datasets';

const dot = adresseDeCreation.dotation;
const avecFixture = <T>(fn: () => T): T => avecDotations(CARRIERE_FIXTURE, DOTATIONS_FIXTURE, fn);
const resoudre = (choices: ChoixDeDotation): TrappingRef[] => resolveTrappingChoices(dotationsDuHeros(CARRIERE_FIXTURE), choices);

describe('emplacementsDeDotation — énumération canonique (classe PUIS niveau, chemin des branches)', () => {
  it('adresse chaque emplacement par sa position dans les dotations (classe puis niveau), puis ses indices de branche', () => {
    avecFixture(() => {
      expect(emplacementsDeDotation(dotationsDuHeros(CARRIERE_FIXTURE)).map((e) => [e.adresse, e.sorte])).toEqual([
        [dot([0]), 'branches'],
        [dot([0, 1]), 'atout'],
        [dot([1]), 'joker'],
        [dot([3]), 'branches'],
        [dot([3, 0]), 'branches'],
        [dot([3, 0, 1]), 'joker'],
        [dot([4]), 'atout'],
        [dot([5]), 'branches'],
        [dot([6]), 'joker'],
        [dot([7]), 'joker'],
        [dot([7, 0]), 'atout'],
      ]);
      expect(emplacementsDeDotation(dotationsDuHeros(CARRIERE_FIXTURE)).filter(estEmplacementRacine).map((e) => e.adresse)).toEqual([dot([0]), dot([1]), dot([3]), dot([4]), dot([5]), dot([6]), dot([7])]);
    });
  });

  it('`estEmplacementDeDotation` : `{pick, of}`, `{wildcard}`, `{id, qualityChoice}` ; une ref concrète n\'en est pas un', () => {
    expect([{ pick: 1, of: [] }, { wildcard: 'arme' }, { wildcard: 'arme', groupe: { id: 'lancer' } }, { id: 'fleuret', qualityChoice: true }].map((r) => estEmplacementDeDotation(r as TrappingRef))).toEqual([true, true, true, true]);
    expect(([{ id: 'dague' }, { text: 'Toges' }, { id: 'cheval', type: 'creature' }, { id: 'charrette', type: 'vehicle' }] as TrappingRef[]).map(estEmplacementDeDotation)).toEqual([false, false, false, false]);
  });
});

describe('resolveTrappingChoices — les choix par adresse', () => {
  it('contrat positif : branche B d\'un `{pick, of}`, arme d\'un `{wildcard}`, Atout d\'un `{id, qualityChoice}`', () => {
    avecFixture(() => {
      expect(resoudre({ [dot([0])]: 1, [dot([0, 1])]: 'solide', [dot([1])]: 'baton-de-combat', [dot([3])]: 1, [dot([4])]: 'leger' })).toEqual([
        { id: 'fleuret', qualities: [{ id: 'solide', value: 1 }] },
        { id: 'baton-de-combat' },
        { id: 'pinceau' },
        { id: 'grande-hache' },
        { id: 'fleuret', qualities: [{ id: 'leger' }] },
        DOTATIONS_FIXTURE.niveau[4],
        DOTATIONS_FIXTURE.niveau[5],
        DOTATIONS_FIXTURE.niveau[6],
      ]);
    });
  });

  it('un lot choisi rend ses membres à sa place ; un joker de groupe rend son arme ; un joker à Atout rend son arme et l’Atout choisi', () => {
    avecFixture(() => {
      expect(resoudre({ [dot([5])]: 1, [dot([6])]: 'grande-hache', [dot([7])]: 'rapiere', [dot([7, 0])]: 'solide' }).slice(4)).toEqual([
        { id: 'fleuret', qualities: [{ id: 'raffine' }] },
        { id: 'arc' },
        { id: 'fleche', count: { fixed: 10 } },
        { id: 'grande-hache' },
        { id: 'rapiere', qualities: [{ id: 'solide', value: 1 }] },
      ]);
      expect(resoudre({ [dot([5])]: 0, [dot([7])]: 'rapiere' }).slice(5), 'l’Atout non choisi du joker prend son défaut').toEqual([
        { id: 'dague' },
        DOTATIONS_FIXTURE.niveau[5],
        { id: 'rapiere', qualities: [{ id: 'raffine' }] },
      ]);
    });
  });

  it('un `{pick, of}` imbriqué se résout par le chemin de ses branches', () => {
    avecFixture(() => {
      expect(resoudre({ [dot([3])]: 0, [dot([3, 0])]: 1, [dot([3, 0, 1])]: 'dague' })[3]).toEqual({ id: 'dague' });
    });
  });

  it('sans choix : `{pick, of}` et joker restent tels quels, l’Atout prend son défaut (raffine)', () => {
    avecFixture(() => {
      expect(resoudre({})).toEqual([
        DOTATIONS_FIXTURE.classe[0],
        { wildcard: 'arme' },
        { id: 'pinceau' },
        DOTATIONS_FIXTURE.niveau[2],
        { id: 'fleuret', qualities: [{ id: 'raffine' }] },
        DOTATIONS_FIXTURE.niveau[4],
        DOTATIONS_FIXTURE.niveau[5],
        DOTATIONS_FIXTURE.niveau[6],
      ]);
    });
  });

  it('une branche choisie dont le `{pick, of}` imbriqué n’est pas tranché rend ce `{pick, of}` tel quel', () => {
    avecFixture(() => {
      expect(resoudre({ [dot([3])]: 0 })[3]).toEqual({ pick: 1, of: [{ id: 'dague' }, { wildcard: 'arme' }] });
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

  it('une valeur hors des branches laisse le `{pick, of}` tel quel', () => {
    avecFixture(() => {
      expect(resoudre({ [dot([3])]: 9 })[3]).toEqual(DOTATIONS_FIXTURE.niveau[2]);
    });
  });

  it('trappingRefLabel({pick, of}) joint les branches par " ou "', () => {
    expect(trappingRefLabel({ pick: 1, of: [{ text: 'A' }, { text: 'B' }] })).toBe('A ou B');
  });

  it('trappingRefLabel affiche « (qualité au choix) » / les Atouts attachés', () => {
    expect(trappingRefLabel({ id: 'fleuret', qualityChoice: true })).toBe('Fleuret (qualité au choix)');
    expect(trappingRefLabel({ id: 'fleuret', qualities: [{ id: 'solide' }] })).toBe('Fleuret (Solide)');
  });

  it('fabricationAtouts() est DÉRIVÉ de qualities.json (atout/objet, hors magie), pas une liste codée', () => {
    const modele = qualities.find((q) => q.polarite === 'atout' && q.subType === 'objet')!;
    const fixture = (id: string, patch: Partial<QualityData> = {}): EntreeVivante<QualityData> => ({ ...modele, id, label: id, capabilities: undefined, ...patch });
    const initiales = qualities.slice();
    try {
      setDataset('qualities', [
        fixture('atout-objet-de-fixture'),
        fixture('atout-magique-de-fixture', { capabilities: { magic: true } }),
        fixture('defaut-objet-de-fixture', { polarite: 'defaut' }),
        fixture('atout-d-arme-de-fixture', { subType: 'arme' }),
      ]);
      expect(fabricationAtouts()).toEqual(['atout-objet-de-fixture']);
    } finally {
      setDataset('qualities', initiales);
    }
  });
});

describe('emplacementTranche — le joueur a-t-il tranché ?', () => {
  const emplacement = (adresse: string) => emplacementsDeDotation(dotationsDuHeros(CARRIERE_FIXTURE)).find((e) => e.adresse === adresse)!;

  it('un `{pick, of}` exige sa branche, et le choix de l\'emplacement que porte cette branche', () => {
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

  it('un joker à Atout exige son arme, son Atout l’est toujours ; un lot choisi l’est', () => {
    avecFixture(() => {
      expect(emplacementTranche(emplacement(dot([7])), {})).toBe(false);
      expect(emplacementTranche(emplacement(dot([7])), { [dot([7])]: 'rapiere' })).toBe(true);
      expect(emplacementTranche(emplacement(dot([5])), { [dot([5])]: 1 })).toBe(true);
    });
  });
});

describe('valeursDeLEmplacement — le domaine d’une arme au choix', () => {
  const emplacement = (adresse: string) => emplacementsDeDotation(dotationsDuHeros(CARRIERE_FIXTURE)).find((e) => e.adresse === adresse)!;
  const groupeDe = (id: string) => groupeDeLArme(findTrappingById(id)!)?.id;
  const FAMILLES_SERVIES = ['armes-de-siege', 'munitions'];

  it('aucune pièce de siège ni munition parmi les armes d’un joker, nu ou de groupe (#156)', () => {
    avecFixture(() => {
      for (const adresse of [dot([1]), dot([6]), dot([7])]) {
        const familles = valeursDeLEmplacement(emplacement(adresse)).map((id) => findTrappingById(String(id))!.subType?.id);
        expect(familles.filter((f) => FAMILLES_SERVIES.includes(f ?? '')), adresse).toEqual([]);
      }
    });
  });

  it('un joker de groupe ne rend que les armes de son Groupe, et l’Atout de son joker les Atouts de Fabrication', () => {
    avecFixture(() => {
      const armes = valeursDeLEmplacement(emplacement(dot([6])));
      expect(armes.length).toBeGreaterThan(0);
      expect([...new Set(armes.map((id) => groupeDe(String(id))))]).toEqual(['deux-mains']);
      expect(valeursDeLEmplacement(emplacement(dot([7, 0])))).toEqual(fabricationAtouts());
    });
  });

  it('chaque Groupe d’armes nommé par un joker de la donnée offre au moins une arme', () => {
    const groupes = new Set<string>();
    const lire = (refs: readonly BrancheDeDotation[]): void => refs.forEach((r) => ('pick' in r ? lire(r.of) : 'wildcard' in r && r.groupe && groupes.add(r.groupe.id)));
    careerLevels.forEach((l) => lire(l.trappings));
    expect(groupes.size).toBeGreaterThan(0);
    for (const g of groupes) expect(valeursDeLEmplacement({ adresse: dot([0]), chemin: [0], sorte: 'joker', ref: { wildcard: 'arme', groupe: { id: g } } }).length, g).toBeGreaterThan(0);
  });
});
