/**
 * LA CRÉATION EN PAGES (#3328) : un hôte joue l'assistant page à page, chaque option par le geste qu'elle porte ; aucun
 * dé ne parle avant le geste qui le jette.
 */
import { describe, it, expect } from 'vitest';
import {
  buildHero,
  charRolls,
  draftFromHero,
  rollDraftDetails,
  carrieresOffertes,
  draftSpecies,
  newDraft,
  rollDraftCareer,
  rollDraftChars,
  rollDraftWealth,
  withCareer,
  withCoastalSwap,
  withSpecies,
  type CreatorDraft,
} from './brouillon';
import { apresLeGeste, brouillonDeLaPartie, pagesDeCreation, rubriquesDeLaPage, type RubriqueDeCreation } from './vueDeLaCreation';
import {
  carrieresAleatoires,
  especesAleatoires,
  eyes,
  fabricationAtouts,
  findQualityById,
  names,
  offreDuJet,
  species,
  talentsAleatoires,
  varianteDe,
} from '../../data';
import { avecDotations, CARRIERE_FIXTURE, DOTATIONS_FIXTURE } from '../../data/dotations.fixture';
import { adresseDeCreation } from '../../engine/adresseDeCreation';
import { setDataset, type DatasetKey } from '../../data/overrides';
import { enregistrerEntree } from '../../data/atelierDuCodex';
import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { codexLookupById } from '../codex/registry';
import { rollCareer } from '../../engine/creation';
import { deFixe, deMin } from '../../engine/dice.testkit';

const rubrique = (r: RubriqueDeCreation[], id: string): RubriqueDeCreation => {
  const x = r.find((e) => e.id === id);
  if (!x) throw new Error(`aucune rubrique ${id} : ${r.map((e) => e.id).join(', ')}`);
  return x;
};
const options = (r: RubriqueDeCreation) => (r.genre === 'choix' ? r.options : []);

describe('la création en pages', () => {
  it('un brouillon neuf par rang, le même pour la même partie', () => {
    expect(brouillonDeLaPartie(7, 0)).toEqual(brouillonDeLaPartie(7, 0));
    expect(brouillonDeLaPartie(7, 1).seed).not.toBe(brouillonDeLaPartie(7, 0).seed);
  });

  it('aucun dé ne parle avant son geste : chaque tirage est un geste, son jet dit après', () => {
    const d = withCareer(withSpecies(brouillonDeLaPartie(7, 0), 'humains-reiklander'), 'soldat');
    for (const p of pagesDeCreation(d)) expect(rubriquesDeLaPage(d, p).filter((r) => r.genre === 'jet'), p).toEqual([]);
    const tirage = rubrique(rubriquesDeLaPage(d, 'chars'), 'tirage');
    expect(rubriquesDeLaPage(d, 'chars').filter((r) => r.id.startsWith('carac/')).map((r) => r.genre === 'valeur' && r.valeur), 'les Caractéristiques se taisent avant les dés').toEqual(Array(10).fill(null));
    const tiree = apresLeGeste(d, (tirage as Extract<RubriqueDeCreation, { genre: 'geste' }>).geste);
    expect(rubriquesDeLaPage(tiree, 'chars').filter((r) => r.id.startsWith('carac/')).every((r) => r.genre === 'valeur' && /^\d+$/.test(r.valeur!)), 'puis se disent').toBe(true);
  });

  it('chaque option se choisit par son geste ; au-delà du quota, plus rien à répartir', () => {
    const d = brouillonDeLaPartie(7, 0);
    const halflings = options(rubrique(rubriquesDeLaPage(d, 'species'), 'famille')).find((o) => o.libelle === 'Halflings')!;
    expect(options(rubrique(rubriquesDeLaPage(apresLeGeste(d, halflings.geste), 'species'), 'famille')).filter((o) => o.choisie).map((o) => o.libelle)).toEqual(['Halflings']);

    let c = withCareer(withSpecies(d, 'humains-reiklander'), 'soldat');
    c = apresLeGeste(c, (rubrique(rubriquesDeLaPage(c, 'chars'), 'tirage') as Extract<RubriqueDeCreation, { genre: 'geste' }>).geste);
    const [premiere, seconde] = rubriquesDeLaPage(c, 'chars').filter((r) => r.id.startsWith('augmentation/'));
    c = apresLeGeste(c, options(premiere).find((o) => o.libelle === '5')!.geste);
    expect(options(rubrique(rubriquesDeLaPage(c, 'chars'), seconde.id)).map((o) => [o.libelle, o.refus !== null])).toEqual([['0', false], ['1', true], ['2', true], ['3', true], ['4', true], ['5', true]]);
  });

  it.each([
    ['hauts-elfes', 'haut-elfe', 'Citrine et Turquoise'],
    ['elfes-sylvains', 'elfe-sylvain', 'Châtain clair et Châtaigne'],
  ] as const)('affiche et restitue les deux couleurs de %s sans déplacer les autres jets', (espece, colonne, libelle) => {
    const initial = withCareer(withSpecies(newDraft(7), espece), 'soldat');
    const physique = rubrique(rubriquesDeLaPage(initial, 'details'), 'physique');
    if (physique.genre !== 'geste') throw new Error('Le physique doit s’offrir aux dés');
    const tire = apresLeGeste(initial, physique.geste);
    const attendu = [{ id: 'marron-fonce', colonne }, { id: 'gris-pale', colonne }];
    const heros = buildHero(tire, idsDeTest, 'heros-elfe');
    expect(heros.details?.eyes).toEqual(attendu);
    const rouvert = draftFromHero(heros, 7);
    expect(rouvert.eyes).toEqual(attendu);
    expect(rubrique(rubriquesDeLaPage(rouvert, 'details'), 'yeux')).toMatchObject({ valeur: libelle });

    const autresTirages = (d: CreatorDraft) => ({
      carriere: rollDraftCareer(d).careerRolls,
      caracteristiques: charRolls(rollDraftChars(d)),
      bourse: rollDraftWealth(d).wealthRoll,
    });
    expect(autresTirages(tire)).toEqual(autresTirages(initial));
    expect(apresLeGeste(rollDraftChars(initial), physique.geste).eyes).toEqual(attendu);
  });

  it('choisit manuellement des rangées par leur id et peut laisser une seule couleur aux elfes', () => {
    const page = (d: CreatorDraft) => rubriquesDeLaPage(d, 'details');
    const prendre = (d: CreatorDraft, rubriqueId: string, rang: 0 | 1, id: string | null): CreatorDraft => {
      const o = options(rubrique(page(d), rubriqueId)).find((o) => o.geste.geste === 'couleurDesYeux'
        && o.geste.args[0] === rang && o.geste.args[1] === id);
      if (!o) throw new Error(`Choix d’yeux absent : ${id}`);
      return apresLeGeste(d, o.geste);
    };
    const initial = withCareer(withSpecies(newDraft(7), 'hauts-elfes'), 'soldat');
    const premier = prendre(initial, 'choixYeux', 0, 'au-choix');
    expect(premier.eyes).toEqual([{ id: 'au-choix', colonne: 'haut-elfe' }]);
    expect(rubrique(page(premier), 'physique')).toMatchObject({ genre: 'geste' });
    const deux = prendre(premier, 'choixSecondeCouleur', 1, 'bleu');
    expect(rubrique(page(deux), 'yeux')).toMatchObject({ valeur: 'Jais et Saphir' });
    const modifie = prendre(deux, 'choixYeux', 0, 'bleu');
    expect(buildHero(modifie, idsDeTest, 'heros-choisi').details?.eyes).toEqual([
      { id: 'bleu', colonne: 'haut-elfe' }, { id: 'bleu', colonne: 'haut-elfe' },
    ]);
    expect(prendre(modifie, 'choixSecondeCouleur', 1, null).eyes).toEqual([{ id: 'bleu', colonne: 'haut-elfe' }]);

    const passeHumain = withSpecies(deux, 'humains-reiklander');
    expect(rubrique(page(passeHumain), 'yeux')).toMatchObject({ valeur: 'Jais et Saphir' });
    expect(page(passeHumain).some((r) => r.id === 'choixSecondeCouleur')).toBe(false);
    expect(options(rubrique(page(passeHumain), 'choixYeux')).map((o) => o.libelle)).not.toContain('Au choix');
    expect(prendre(passeHumain, 'choixYeux', 0, 'vert').eyes).toEqual([{ id: 'vert', colonne: 'humain' }]);
  });
});

describe('les deux noms offerts aux ogres (ADE II 02 l.325-382)', () => {
  const ogre = withSpecies(newDraft(7), 'ogres');
  const reiklander = withSpecies(newDraft(7), 'humains-reiklander');
  const page = (d: CreatorDraft) => rubriquesDeLaPage(d, 'details');
  const tirer = (d: CreatorDraft, id: string) => {
    const r = rubrique(page(d), id);
    if (r.genre !== 'geste') throw new Error('Le nom doit s’offrir aux dés');
    return apresLeGeste(d, r.geste);
  };

  it('propose un nom traditionnel et un nom humain à l’Ogre', () => {
    expect(rubrique(page(ogre), 'nom')).toMatchObject({ libelle: 'Nom ogre aux dés' });
    expect(rubrique(page(ogre), 'nom-humain')).toMatchObject({ libelle: 'Nom humain aux dés' });
    expect(rubrique(page(reiklander), 'nom')).toMatchObject({ libelle: 'Nom aux dés' });
    expect(page(reiklander).map((r) => r.id).filter((id) => id.startsWith('nom'))).toEqual(['nom']);
    const traditionnel = tirer(ogre, 'nom');
    expect(traditionnel.label).toBe('Marenn');
    expect(rubrique(page(traditionnel), 'nomTire')).toMatchObject({ valeur: 'Marenn' });
    expect(tirer(ogre, 'nom-humain').label).toBe(tirer(reiklander, 'nom').label);
  });

  it('relit la banque humaine éditée au Codex quand le joueur choisit le nom humain', () => {
    const index = names.findIndex((pool) => pool.id === 'humain');
    const humain = names[index];
    const avant = tirer(ogre, 'nom-humain').label;
    const transaction = enregistrerEntree('names', {
      ...humain, maleFirstNames: ['Aubrin'], femaleFirstNames: ['Aubrine'], lastNames: ['Des Saules'],
    }, index);
    if (!transaction.ok) throw new Error(transaction.erreurs.join(', '));
    try {
      expect(transaction.texte).toContain('Des Saules');
      expect(tirer(ogre, 'nom-humain').label).toBe('Aubrin Des Saules');
      expect(tirer(reiklander, 'nom').label).toBe('Aubrin Des Saules');
      expect(tirer(ogre, 'nom').label).toBe('Marenn');
    } finally {
      transaction.reprendre();
    }
    expect(tirer(ogre, 'nom-humain').label).toBe(avant);
  });

  it.each([
    ['une racine sans terminaison', { firstNameSuffixes: undefined }, 'vont de pair'],
    ['une banque vide', { firstNamePrefixes: undefined, firstNameSuffixes: undefined }, 'former un nom'],
    ['des composantes avec des noms de famille', { lastNames: ['Des Saules'] }, 'remplacent les listes de noms'],
    ['des composantes avec des suffixes patronymiques', { lastNameSuffixes: { M: ['sson'], F: ['sdottir'] } }, 'remplacent les listes de noms'],
    ['une terminaison blanche', { firstNameSuffixes: [' '] }, 'former un seul mot'],
    ['une racine à plusieurs mots', { firstNamePrefixes: ['Grum tar'] }, 'former un seul mot'],
  ] as const)('refuse %s au Codex', (_, champs, erreur) => {
    const index = names.findIndex((pool) => pool.id === 'ogre');
    const transaction = enregistrerEntree('names', { ...names[index], ...champs }, index);
    if (transaction.ok) {
      transaction.reprendre();
      throw new Error('La banque aurait dû être refusée : ' + erreur);
    }
    expect(transaction.erreurs.join(' ')).toContain(erreur);
  });

  it('relit une ancienne banque complète de prénoms et de noms de famille', () => {
    const index = names.findIndex((pool) => pool.id === 'ogre');
    const banque = names[index];
    const ancienne = enregistrerEntree('names', {
      ...banque, firstNamePrefixes: undefined, firstNameSuffixes: undefined,
      maleFirstNames: ['Athel'], femaleFirstNames: ['Athèle'], lastNames: ['Bauer'],
    }, index);
    if (!ancienne.ok) throw new Error(ancienne.erreurs.join(', '));
    try {
      expect(tirer(ogre, 'nom').label).toBe('Athel Bauer');
    } finally {
      ancienne.reprendre();
    }
  });

  it('édite les deux composantes ogres au Codex et les relit dans le tirage traditionnel', () => {
    const index = names.findIndex((pool) => pool.id === 'ogre');
    const banque = names[index];
    const transaction = enregistrerEntree('names', { ...banque, firstNamePrefixes: ['Grum'], firstNameSuffixes: ['attha'] }, index);
    if (!transaction.ok) throw new Error(transaction.erreurs.join(', '));
    try {
      expect(transaction.texte).toContain('attha');
      expect(codexLookupById('names', 'ogre')?.sections).toEqual([
        { title: 'Racines de prénoms', layout: 'chips', rows: [{ t: 'text', text: 'Grum' }] },
        { title: 'Terminaisons de prénoms', layout: 'chips', rows: [{ t: 'text', text: 'attha' }] },
      ]);
      expect(tirer(ogre, 'nom').label).toBe('Grumattha');
    } finally {
      transaction.reprendre();
    }
    expect(tirer(ogre, 'nom').label).toBe('Marenn');
  });
});

it('une couleur renommée au Codex suit le même héros rouvert dans la création', () => {
  const initial = withCareer(withSpecies(newDraft(7), 'humains-reiklander'), 'soldat');
  const d = rollDraftDetails(initial);
  const heros = buildHero(d, idsDeTest, 'heros-couleurs');
  const rouvert = draftFromHero(heros, 7);
  const yeux = () => rubrique(rubriquesDeLaPage(rouvert, 'details'), 'yeux');
  expect(heros.details?.eyes).toEqual([{ id: 'gris', colonne: 'humain' }]);
  expect(rouvert.eyes).toEqual(heros.details?.eyes);
  expect(yeux()).toMatchObject({ genre: 'valeur', valeur: 'Gris' });

  const index = eyes.findIndex((r) => r.id === 'gris');
  const rangee = eyes[index];
  const transaction = enregistrerEntree('eyes', { ...rangee, color: { ...rangee.color, humain: 'Gris perle' } }, index);
  if (!transaction.ok) throw new Error(transaction.erreurs.join(', '));
  try {
    expect(transaction.texte).toContain('Gris perle');
    expect(yeux()).toMatchObject({ genre: 'valeur', valeur: 'Gris perle' });
    expect(heros.details?.eyes).toEqual([{ id: 'gris', colonne: 'humain' }]);
  } finally {
    transaction.reprendre();
  }
});

describe('la race puis la lignée : les espèces se groupent par race (`refChar`), jamais par leur libellé `family`', () => {
  it('une lignée au `family` renommé reste dans sa race, sous le libellé de l’espèce canonique', () => {
    const origine = [...species];
    const renommee = origine.map((s) => (s.id === 'nains-norse' ? { ...s, family: 'Nains du Norsca' } : s));
    setDataset('species', renommee);
    try {
      const page = rubriquesDeLaPage(withSpecies(newDraft(1), 'nains'), 'species');
      const races = options(rubrique(page, 'famille')).map((o) => o.libelle);
      expect(races.filter((l) => l.startsWith('Nains'))).toEqual(['Nains']);
      expect(options(rubrique(page, 'lignee')).map((o) => o.libelle)).toEqual(renommee.filter((s) => s.refChar === 'nain').map((s) => s.variant ?? s.label));
    } finally {
      setDataset('species', origine);
    }
  });
});

describe('les carrières offertes : celles que le tirage offre sur la table effective (LDB 05 l.204-212 ; MDG 09 l.9)', () => {
  /** Ce qu'offrent les jets de `rollCareer`, d100 de 1 à 100, à l'espèce du brouillon sous son remplacement, sans ou avec
   *  chaque rangée du second lancer (`offreDuJet`, `varianteDe`). */
  const tirees = (d: CreatorDraft) => {
    const sp = draftSpecies(d)!;
    return [...new Set(Array.from({ length: 100 }, (_, i) => {
      const { id } = rollCareer(sp, d.coastalSwap, deFixe(i + 1));
      return [...offreDuJet(sp, { id }), ...(varianteDe(id, sp)?.entries ?? []).flatMap((second) => offreDuJet(sp, { id, second }))];
    }).flat())].sort();
  };
  const offertes = (d: CreatorDraft) => carrieresOffertes(d).map((c) => c.id).sort();
  const brouillon = (speciesId: string, swap: boolean) => withCoastalSwap(withSpecies(newDraft(1), speciesId), swap);

  it('par espèce × remplacement, les offertes sont exactement les tirées', () => {
    for (const sp of species) for (const swap of [false, true]) {
      const d = brouillon(sp.id, swap);
      expect(offertes(d), `${sp.id} swap=${swap}`).toEqual(tirees(d));
    }
  });

  it('une colonne éditée au Codex qui porte une carrière de la Classe remplacée : la carrière tirée reste offerte', () => {
    const imprimes = structuredClone([...carrieresAleatoires]);
    try {
      // Officier (Côtiers, portion `cotiers-humain`) sans remplacement, Batelier (Riverains, colonne `humain`) avec.
      for (const [swap, document, id] of [[false, 'cotiers-humain', 'officier'], [true, 'humain', 'batelier']] as const) {
        const edite = structuredClone(imprimes);
        edite.find((x) => x.id === 'humain')!.entries[0].id = imprimes.find((x) => x.id === document)!.entries.find((r) => r.id === id)!.id;
        setDataset('carrieresAleatoires', edite);
        const d = brouillon('humains-reiklander', swap);
        expect(rollCareer(draftSpecies(d)!, swap, deMin).id).toBe(id);
        expect(offertes(d), `swap=${swap}`).toContain(id);
        expect(offertes(d), `swap=${swap}`).toEqual(tirees(d));
      }
    } finally {
      setDataset('carrieresAleatoires', imprimes);
    }
  });
});

describe('le second lancer : un geste offert au jet dont la carrière a une variante (AA 02 l.109-111 ; VDM 03 l.17-19)', () => {
  /** Le premier brouillon d'un Reiklander, graines 1.., dont le premier jet de carrière vérifie `voulu`. */
  const premierJetOu = (voulu: (d: CreatorDraft) => boolean) => {
    for (let graine = 1; graine < 5000; graine++) {
      const d = rollDraftCareer(withSpecies(newDraft(graine), 'humains-reiklander'));
      if (voulu(d)) return d;
    }
    throw new Error('aucune graine');
  };
  const aUneVariante = (d: CreatorDraft) => !!varianteDe(d.careerRolls[0].id, draftSpecies(d)!);

  it('offert sur un jet à variante, il tire le second d100, que le tirage dit, puis ne s’offre plus', () => {
    const soldat = premierJetOu((d) => d.careerRolls[0].id === 'soldat');
    const offert = rubrique(rubriquesDeLaPage(soldat, 'career'), 'variante/0');
    expect(offert.genre === 'geste' && offert.libelle).toBe('Second lancer : Soldat');
    const engage = apresLeGeste(soldat, (offert as Extract<RubriqueDeCreation, { genre: 'geste' }>).geste);
    const [jet] = engage.careerRolls;
    const page = rubriquesDeLaPage(engage, 'career');
    expect(page.filter((r) => r.id.startsWith('variante/')), 'fait, le second lancer ne s’offre plus').toEqual([]);
    const tirage = rubrique(page, 'tirage');
    expect(tirage.genre === 'jet' && tirage.resultat, 'le tirage dit les deux d100').toBe(`${jet.roll} → ${jet.second!.roll}`);
  });

  it('absent sur un jet dont la carrière n’a pas de variante', () => {
    const sans = premierJetOu((d) => !aUneVariante(d));
    expect(rubriquesDeLaPage(sans, 'career').filter((r) => r.id.startsWith('variante/'))).toEqual([]);
  });
});

describe('les tirages disent le dé de leur table, jamais un littéral (#3578)', () => {
  const libelle = (d: CreatorDraft, page: Parameters<typeof rubriquesDeLaPage>[1]) => rubrique(rubriquesDeLaPage(d, page), 'tirage').libelle;
  const sousLeDeDe = <K extends DatasetKey>(cle: K, documents: Parameters<typeof setDataset<K>>[1], corps: () => void) => {
    const imprimes = [...documents];
    setDataset(cle, imprimes.map((x) => (typeof x === 'object' && 'die' in x ? { ...x, die: { n: 1, sides: 10 } } : x)));
    try { corps(); } finally { setDataset(cle, imprimes); }
  };
  const humain = () => withSpecies(newDraft(1), 'humains-reiklander');

  it('sans surcharge, le dé imprimé', () => {
    expect(libelle(newDraft(1), 'species')).toBe('Race au 1d100 (+20 PX)');
    expect(libelle(humain(), 'career')).toBe('Carrière au 1d100 (+50 PX)');
    expect(libelle(rollDraftCareer(humain()), 'career')).toBe('Carrière au 1d100');
    expect(libelle(humain(), 'skills.talents')).toBe('Tirer 3 Talents au 1d100');
  });

  it('sous un dé posé au Codex, le dé de la table tirée', () => {
    sousLeDeDe('especesAleatoires', especesAleatoires, () => expect(libelle(newDraft(1), 'species')).toBe('Race au 1d10 (+20 PX)'));
    sousLeDeDe('carrieresAleatoires', carrieresAleatoires, () => {
      expect(libelle(humain(), 'career')).toBe('Carrière au 1d10 (+50 PX)');
      expect(libelle(rollDraftCareer(humain()), 'career')).toBe('Carrière au 1d10');
    });
    sousLeDeDe('talentsAleatoires', talentsAleatoires, () => expect(libelle(humain(), 'skills.talents')).toBe('Tirer 3 Talents au 1d10'));
  });
});

describe('les possessions : l’Atout au choix d’une arme au choix suit son arme, à son adresse (LDB 60 l.9-32)', () => {
  it('un joker à Atout donne deux rubriques, l’arme puis l’Atout à `[...chemin, 0]`, et le geste de l’Atout pose sa valeur là', () => {
    avecDotations(CARRIERE_FIXTURE, DOTATIONS_FIXTURE, () => {
      const dot = adresseDeCreation.dotation;
      const d = withCareer(withSpecies(brouillonDeLaPartie(7, 0), 'humains-reiklander'), CARRIERE_FIXTURE);
      const page = rubriquesDeLaPage(d, 'trappings');
      const ids = page.map((r) => r.id);
      expect(ids.indexOf(dot([7, 0])), 'l’Atout suit l’arme').toBe(ids.indexOf(dot([7])) + 1);
      expect(options(rubrique(page, dot([7]))).length).toBeGreaterThan(0);
      const atout = rubrique(page, dot([7, 0]));
      expect(options(atout).map((o) => o.libelle)).toEqual(fabricationAtouts().map((id) => findQualityById(id)!.label));
      const solide = options(atout).find((o) => o.libelle === findQualityById('solide')!.label)!;
      const pose = apresLeGeste(d, solide.geste);
      expect(pose.trappingChoices?.[dot([7, 0])]).toBe('solide');
      expect(options(rubrique(rubriquesDeLaPage(pose, 'trappings'), dot([7, 0]))).filter((o) => o.choisie).map((o) => o.libelle)).toEqual([solide.libelle]);
    });
  });
});
