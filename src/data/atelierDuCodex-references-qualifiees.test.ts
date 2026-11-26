import { afterEach, describe, expect, it } from 'vitest';
import { enregistrerEntree } from './atelierDuCodex';
import { datasetArray, setDataset, type DatasetKey } from './overrides';
import { RACINES_VIVANTES } from './_racines-vivantes.generated';
import { versDisque } from './schemas/grammaire/prose';
import { specAuCatalogue } from './schemas/grammaire/ref';
import { validateDataset } from './schemas/validate';
import { abonnerAuxDatasets } from './versionDataset';
import { catalogueDuProcessus } from './catalogueDuProcessus';

type Entree = Record<string, unknown>;

const restaurations: (() => void)[] = [];
afterEach(() => {
  for (const restaurer of restaurations.splice(0).reverse()) restaurer();
});

function ajouter(cle: DatasetKey, ...entrees: Entree[]): void {
  const avant = datasetArray(cle).slice();
  setDataset(cle, [...avant, ...entrees] as Parameters<typeof setDataset>[1]);
  restaurations.push(() => setDataset(cle, avant));
}

function fiche(type: string, nom: string) {
  return { type, id: `qualification-test-${nom}`, label: nom };
}

function sourceDeTest() {
  const livre = fiche('books', 'livre');
  ajouter('books', { ...livre, abbr: 'QLF', language: null });
  return { book: livre.id, page: 1 };
}

function groupe(nom: string, source: ReturnType<typeof sourceDeTest>) {
  return { ...fiche('weaponGroups', nom), kind: 'weapon', maniement: 'lame1m', source };
}

function objet(nom: string, source: ReturnType<typeof sourceDeTest>) {
  return { ...fiche('trappings', nom), categorie: 'trapping', subType: null, availability: null, qualities: [], price: null, source };
}

function verifierRefusPuisEdition(
  cle: DatasetKey,
  origine: { id: string },
  invalide: Entree,
  lecteur: string,
  diagnostic: string,
  compatible: Entree,
  { creation = false, verifierEdition }: { creation?: boolean; verifierEdition?: () => void } = {},
): void {
  const catalogue = datasetArray(cle);
  const entrees = catalogue.slice();
  const valeurs = structuredClone(entrees);
  const index = catalogue.findIndex((e) => 'id' in e && e.id === origine.id);
  expect(index).toBeGreaterThanOrEqual(0);
  const racine = RACINES_VIVANTES[lecteur];
  const relire = () => validateDataset(lecteur, versDisque(racine), catalogueDuProcessus());
  expect(relire()).toBeNull();

  const observations: (string | null)[] = [];
  const desabonner = abonnerAuxDatasets(() => { observations.push(relire()); });
  try {
    const refus = enregistrerEntree(cle, invalide, creation ? -1 : index);
    if (refus.ok) refus.reprendre();
    expect(refus).toMatchObject({
      ok: false,
      erreurs: expect.arrayContaining([expect.stringContaining(lecteur), expect.stringContaining(diagnostic)]),
    });
    expect(observations).toEqual([]);
    expect(datasetArray(cle)).toBe(catalogue);
    expect(catalogue).toEqual(valeurs);
    expect(catalogue.every((entree, i) => entree === entrees[i])).toBe(true);
    expect(RACINES_VIVANTES[lecteur]).toBe(racine);
    expect(relire()).toBeNull();

    const edition = enregistrerEntree(cle, compatible, creation ? -1 : index);
    expect(edition.ok, edition.ok ? '' : edition.erreurs.join('\n')).toBe(true);
    if (!edition.ok) return;
    try {
      expect(JSON.parse(edition.texte)).toContainEqual(expect.objectContaining(compatible));
      expect(observations).toEqual([null]);
      verifierEdition?.();
    } finally {
      edition.reprendre();
    }
    expect(catalogue[index]).toBe(entrees[index]);
    expect(relire()).toBeNull();
  } finally {
    desabonner();
  }
}

function specialisationDeTest() {
  const source = sourceDeTest();
  const club = { ...groupe('club', source), combat: 'melee' };
  const arc = { ...groupe('arc', source), combat: 'distance' };
  ajouter('weaponGroups', club, arc);
  const competence = { ...fiche('skills', 'competence'), desc: 'Compétence de test', source, characteristic: 'capacite-de-tir', acces: 'avancee' };
  ajouter('skills', { ...competence, specsSource: 'weaponGroupsRanged' });
  const classe = { ...fiche('classes', 'classe'), desc: 'Classe de test', source, trappings: [] };
  ajouter('classes', classe);
  const carriere = { ...fiche('careers', 'carriere'), desc: 'Carrière de test', source, class: { id: classe.id } };
  ajouter('careers', carriere);
  const niveau = {
    ...fiche('careerLevels', 'niveau'),
    id: `${carriere.id}-1`,
    career: { id: carriere.id },
    level: 1,
    skills: [{ id: competence.id, spec: arc.id }],
    talents: [],
    trappings: [],
    characteristics: ['capacite-de-tir', 'agilite', 'dexterite'],
    status: { tier: 'bronze', standing: 1 },
    source,
  };
  ajouter('careerLevels', niveau,
    ...['initiative', 'endurance', 'force'].map((caracteristique, i) => ({
      ...niveau, id: `${carriere.id}-${i + 2}`, level: i + 2, characteristics: [caracteristique],
    })),
  );
  return { arc, club, competence, niveau };
}

describe('les qualifications entre catalogues à la frontière d’écriture du Codex', () => {
  it('refuse qu’une possession garantie quitte la sous-liste des objets instanciables', () => {
    const possession = objet('possession', sourceDeTest());
    ajouter('trappings', possession);
    ajouter('merchants', { ...fiche('merchants', 'marchand'), category: {}, resaleRate: 0.5, bargainSkill: 40, curated: [possession.id] });

    verifierRefusPuisEdition('trappings', possession, { ...possession, service: true }, 'merchants.json', 'service', { ...possession, enc: 2 });
  });

  it('refuse de marquer un Groupe de possessions comme Groupe de siège', () => {
    const source = sourceDeTest();
    const commun = groupe('commun', source);
    ajouter('weaponGroups', commun);
    ajouter('trappings', { ...objet('arme', source), categorie: 'melee', subType: { id: commun.id } });

    verifierRefusPuisEdition('weaponGroups', commun, { ...commun, siege: true }, 'trappings.json', 'engin de siège', { ...commun, label: 'Groupe de campagne' });
  });

  it('refuse de retirer le marqueur du Groupe d’un engin de siège', () => {
    const source = sourceDeTest();
    const commun = groupe('siege', source);
    const siege = { ...commun, siege: true };
    ajouter('weaponGroups', siege);
    ajouter('siegeEngines', {
      ...fiche('siege-engines', 'engin'), categorie: 'distance', subType: { id: siege.id },
      source, qualities: [], availability: 'rare', price: { gold: 1, silver: 0, brass: 0 },
    });

    verifierRefusPuisEdition('weaponGroups', siege, commun, 'siege-engines.json', 'siège', { ...siege, label: 'Groupe renommé' });
  });

  it('refuse de retirer le marqueur de la Qualité d’une variante', () => {
    const qualite = {
      ...fiche('qualities', 'qualite'), polarite: 'atout', subType: 'objet', desc: 'Qualité de test', source: sourceDeTest(),
    };
    const aspect = { ...qualite, aspect: true };
    const forme = fiche('apparences', 'forme');
    ajouter('qualities', aspect);
    ajouter('apparences', forme, { ...fiche('apparences', 'variante'), forme: { id: forme.id }, qualites: [qualite.id] });

    verifierRefusPuisEdition('qualities', aspect, qualite, 'apparences.json', qualite.id, { ...aspect, label: 'Qualité renommée' });
  });

  it('refuse qu’une race de rendu emploie l’id d’un emplacement', () => {
    const gabarit = fiche('gabarits', 'gabarit');
    ajouter('gabarits', { ...gabarit, sl: 1, st: 1, legs: 1 });
    const race = { ...fiche('raceAppearance', 'race'), gabarit: { id: gabarit.id } };
    const emplacement = { ...fiche('garde-robe', 'emplacement'), kind: 'emplacement' };
    ajouter('raceAppearance', race);
    ajouter('gardeRobe', emplacement);

    verifierRefusPuisEdition(
      'raceAppearance', race, { ...race, id: emplacement.id }, 'garde-robe.json',
      emplacement.id, { ...race, id: `${race.id}-ajoutee` }, { creation: true },
    );
  });

  it('refuse qu’un Groupe sorte de l’univers d’une Spécialisation utilisée', () => {
    const { arc, competence } = specialisationDeTest();
    expect(specAuCatalogue('skill', competence.id, arc.id)).toBe(true);

    verifierRefusPuisEdition('weaponGroups', arc, { ...arc, combat: 'melee' }, 'careerLevels.json', arc.id, { ...arc, label: 'Arc renommé' });
    expect(specAuCatalogue('skill', competence.id, arc.id)).toBe(true);
  });

  it('relit la source de l’univers et accepte une nouvelle Spécialisation du Niveau après édition', () => {
    const { arc, club, competence, niveau } = specialisationDeTest();
    const nouvelle = 'qualification-test-autre-specialisation';
    expect(specAuCatalogue('skill', competence.id, arc.id)).toBe(true);
    expect(specAuCatalogue('skill', competence.id, club.id)).toBe(false);
    expect(specAuCatalogue('skill', competence.id, nouvelle)).toBe(false);
    const compatible = {
      ...competence, specs: [{ id: arc.id, label: 'Arc' }, { id: nouvelle, label: 'Autre spécialisation' }],
    };
    verifierRefusPuisEdition(
      'skills', competence, { ...competence, specsSource: 'weaponGroupsMelee' },
      'careerLevels.json', arc.id, compatible,
      {
        verifierEdition: () => {
          expect(specAuCatalogue('skill', competence.id, nouvelle)).toBe(true);
          const rang = datasetArray('careerLevels').findIndex((e) => e.id === niveau.id);
          const transforme = { ...niveau, skills: [{ id: competence.id, spec: nouvelle }] };
          const porteur = enregistrerEntree('careerLevels', transforme, rang);
          expect(porteur.ok, porteur.ok ? '' : porteur.erreurs.join('\n')).toBe(true);
          if (!porteur.ok) return;
          try {
            expect(datasetArray('careerLevels')[rang]).toEqual(transforme);
          } finally {
            porteur.reprendre();
          }
        },
      },
    );
    expect(specAuCatalogue('skill', competence.id, nouvelle)).toBe(false);
  });
});
