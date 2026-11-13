import { describe, it, expect } from 'vitest';
import {
  atoutChoisi,
  dotationsDuHeros,
  emplacementsDeDotation,
  emplacementTranche,
  estEmplacementDeDotation,
  estEmplacementRacine,
  libelleDeLaValeur,
  resolveTrappingChoices,
  valeurParDefaut,
  valeursDeLEmplacement,
  type ChoixDeDotation,
} from './trappingChoices';
import { craftAtoutCount } from './qualities/craftEconomy';
import { adresseDeCreation } from './adresseDeCreation';
import { avecDotations, CARRIERE_FIXTURE, DOTATIONS_FIXTURE } from '../data/dotations.fixture';
import { careerLevels, findTrappingById, groupeDeLArme, trappingRefLabel, fabricationAtouts, qualities, qualityInstance, trappings, type BrancheDeDotation, type QualityData, type TrappingRef } from '../data/index';
import { setDataset } from '../data/overrides';

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
    expect([{ pick: 1, of: [] }, { wildcard: 'arme' }, { wildcard: 'arme', groupe: { id: 'lancer' } }, { id: 'fleuret', qualityChoice: 'qualite' }].map((r) => estEmplacementDeDotation(r as TrappingRef))).toEqual([true, true, true, true]);
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
    expect(trappingRefLabel({ id: 'fleuret', qualityChoice: 'qualite' })).toBe('Fleuret (qualité au choix)');
    expect(trappingRefLabel({ id: 'costume-de-cour', qualityChoice: 'haute' })).toBe('Habit de cour (Haute Qualité au choix)');
    expect(trappingRefLabel({ id: 'fleuret', qualities: [{ id: 'solide' }] })).toBe('Fleuret (Solide)');
  });

  it('fabricationAtouts() est DÉRIVÉ de qualities.json (atout/objet, hors magie), pas une liste codée', () => {
    const modele = qualities.find((q) => q.polarite === 'atout' && q.subType === 'objet')!;
    const fixture = (id: string, patch: Partial<QualityData> = {}): QualityData => ({ ...modele, id, label: id, capabilities: undefined, ...patch });
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

/** Trois Atouts de Fabrication de fixture, dans un ordre de donnée qui n'est pas celui des ids : `raffine`
 *  (`DEFAULT_FABRICATION_ATOUT`) et `alpha-indice` (indicé) peuvent être pris plusieurs fois, `zeta-unique` non ; et un
 *  objet d'Encombrement 1. */
function avecAtoutsDeFixture<T>(fn: () => T): T {
  const modele = qualities.find((q) => q.polarite === 'atout' && q.subType === 'objet')!;
  const atout = (id: string, patch: Partial<QualityData> = {}): QualityData => ({ ...modele, id, label: id, capabilities: undefined, indice: undefined, ...patch });
  const qualitesAvant = qualities.slice();
  const objetsAvant = trappings.slice();
  setDataset('qualities', [
    atout('raffine', { capabilities: { repetable: true } }),
    atout('zeta-unique'),
    atout('alpha-indice', { indice: { label: 'Indice' }, capabilities: { repetable: true } }),
  ]);
  setDataset('trappings', [...objetsAvant, { ...findTrappingById('vetements')!, id: 'objet-d-encombrement-1', enc: 1 }]);
  try {
    return fn();
  } finally {
    setDataset('qualities', qualitesAvant);
    setDataset('trappings', objetsAvant);
  }
}

describe('emplacement `atout` : les combinaisons d’Atouts de sa classe de qualité (LDB 60 l.7 ; LDB 60 l.11)', () => {
  const atoutDe = (ref: TrappingRef) => {
    const [e] = emplacementsDeDotation([ref]);
    if (e?.sorte !== 'atout') throw new Error(`pas un emplacement atout : ${JSON.stringify(ref)}`);
    return e;
  };
  const deQualite = () => atoutDe({ id: 'objet-d-encombrement-1', qualityChoice: 'qualite' });
  const deHauteQualite = () => atoutDe({ id: 'objet-d-encombrement-1', qualityChoice: 'haute' });
  const resolu = (ref: TrappingRef, v?: string) => resolveTrappingChoices([ref], v === undefined ? {} : { [dot([0])]: v })[0];

  it('de Qualité : chaque Atout de Fabrication seul, dans l’ordre de la donnée', () => {
    avecAtoutsDeFixture(() => {
      expect(valeursDeLEmplacement(deQualite())).toEqual(['raffine', 'zeta-unique', 'alpha-indice']);
    });
  });

  it('de Haute Qualité sur un objet d’Encombrement 1 : toutes les paires, un doublon pour le seul Atout qui peut être pris plusieurs fois (LDB 60 l.26 ; LDB 60 l.30)', () => {
    avecAtoutsDeFixture(() => {
      expect(valeursDeLEmplacement(deHauteQualite())).toEqual(['raffine+raffine', 'raffine+zeta-unique', 'alpha-indice+raffine', 'alpha-indice+zeta-unique', 'alpha-indice+alpha-indice']);
    });
  });

  it('sans choix, l’emplacement pose sa combinaison par défaut : autant de Raffiné que d’Atouts', () => {
    avecAtoutsDeFixture(() => {
      expect(valeurParDefaut(deQualite())).toBe('raffine');
      expect(valeurParDefaut(deHauteQualite())).toBe('raffine+raffine');
      expect(resolu({ id: 'objet-d-encombrement-1', qualityChoice: 'haute' })).toEqual({ id: 'objet-d-encombrement-1', qualities: [{ id: 'raffine' }, { id: 'raffine' }] });
    });
  });

  it('un Atout indicé pris deux fois est une entrée d’Indice 2, un autre deux entrées ; une paire mixte, une entrée par Atout (LDB 60 l.30-32)', () => {
    avecAtoutsDeFixture(() => {
      const habit: TrappingRef = { id: 'objet-d-encombrement-1', count: { fixed: 4 }, qualityChoice: 'haute' };
      expect(resolu(habit, 'alpha-indice+alpha-indice')).toEqual({ id: 'objet-d-encombrement-1', count: { fixed: 4 }, qualities: [{ id: 'alpha-indice', value: 2 }] });
      expect(resolu(habit, 'raffine+raffine')).toEqual({ id: 'objet-d-encombrement-1', count: { fixed: 4 }, qualities: [{ id: 'raffine' }, { id: 'raffine' }] });
      expect(resolu(habit, 'alpha-indice+raffine')).toEqual({ id: 'objet-d-encombrement-1', count: { fixed: 4 }, qualities: [{ id: 'raffine' }, { id: 'alpha-indice', value: 1 }] });
    });
  });

  it('une valeur hors des combinaisons offertes prend la valeur par défaut, jamais un Atout découpé ou étranger', () => {
    avecAtoutsDeFixture(() => {
      const habit: TrappingRef = { id: 'objet-d-encombrement-1', qualityChoice: 'haute' };
      for (const v of ['zeta-unique+zeta-unique', 'zeta-unique+raffine', 'raffine', 'maudit', 'raffine+raffine+raffine']) {
        expect(atoutChoisi(deHauteQualite(), { [dot([0])]: v }), v).toBe('raffine+raffine');
        expect(resolu(habit, v)!, v).toEqual({ id: 'objet-d-encombrement-1', qualities: [{ id: 'raffine' }, { id: 'raffine' }] });
      }
      expect(resolu({ id: 'objet-d-encombrement-1', qualityChoice: 'qualite' }, 'raffine+raffine')).toEqual({ id: 'objet-d-encombrement-1', qualities: [{ id: 'raffine' }] });
    });
  });

  it('le libellé d’une combinaison nomme chacune de ses prises, celui d’un Atout seul son Atout', () => {
    avecAtoutsDeFixture(() => {
      expect(libelleDeLaValeur(deHauteQualite(), 'alpha-indice+raffine')).toBe('raffine, alpha-indice');
      expect(libelleDeLaValeur(deHauteQualite(), 'raffine+raffine')).toBe('raffine, raffine');
      expect(libelleDeLaValeur(deQualite(), 'zeta-unique')).toBe('zeta-unique');
    });
  });

  it('le choix « maudit » sur des vêtements de qualité pose le défaut : Maudit n’est pas un Atout de Fabrication', () => {
    expect(resolveTrappingChoices([{ id: 'vetements', qualityChoice: 'qualite' }], { [dot([0])]: 'maudit' })).toEqual([{ id: 'vetements', qualities: [{ id: 'raffine' }] }]);
  });

  it('un Habit de cour de Haute Qualité (LDB 65 l.21, Encombrement 1) offre huit paires d’Atouts, chacune de deux prises (arbitrage #4053)', () => {
    const habit: TrappingRef = { id: 'costume-de-cour', qualityChoice: 'haute' };
    const valeurs = valeursDeLEmplacement(atoutDe(habit)).map(String);
    expect(valeurs).toHaveLength(8);
    expect(valeurs).toEqual(expect.arrayContaining(['raffine+raffine', 'solide+solide', 'leger+pratique']));
    expect(valeurs).not.toEqual(expect.arrayContaining(['leger+leger']));
    expect(valeurs).not.toEqual(expect.arrayContaining(['pratique+pratique']));
    for (const v of valeurs) {
      const qs = (resolu(habit, v) as { qualities: { id: string; value?: number }[] }).qualities;
      expect(craftAtoutCount({ qualities: qs.map(qualityInstance) }), v).toBe(2);
    }
  });
});

