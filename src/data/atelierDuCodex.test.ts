/**
 * Contrat des transactions d'une entrée du Codex (`enregistrerEntree`, #3059 ; `supprimerEntree`, #4020) : l'entrée
 * valide est posée ou retirée et la source rendue sérialisée ; une entrée refusée laisse le dataset tel qu'avant. Ce qui
 * désigne une entrée (`designations`) se mesure au parse, dans `src/data` et dans les paquets passés.
 * Le dataset se pose et se restaure par son seam (`setDataset`, `resetData`).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { designations, enregistrerEntree, supprimerEntree, validateEntry } from './atelierDuCodex';
import { reperesDuParse } from './schemas/grammaire/ref';
import { rangee } from './schemas/defs/mutationTables';
import { validateDataset } from './schemas/validate';
import { projetSchema } from './schemas/defs-scenes/projet';
import { versDisque } from './schemas/grammaire/prose';
import { suivreLeChemin } from './schemas/grammaire/cle-d-espace';
import { DATASET_DE_LA_CATEGORIE } from './schemas/_cles-de-dataset.generated';
import { RACINES_VIVANTES } from './_racines-vivantes.generated';
import paquetDeTest from '../scenes/fixtures/paquet-de-test.json';
import { ancetreDuDe, champDEnTete, datasetArray, datasetObject, deDeLaTable, entreesDuDataset, resetData, setDataset, type DatasetKey } from './overrides';
import { CATEGORY_DATASET_DERIVE } from './schemas/exposition-derivee';
import { effectTableDie, findEffectTableById } from './effectTables';
import { findCareerById, levelsForCareer, tableDesRacesAleatoires } from './index';
import { abonnerAuxDatasets } from './versionDataset';
import { rollSeasonalCargo, type CargoEntry } from '../engine/cargo';
import { randomSpeciesTable } from '../engine/creation';
import { findTableEntry } from '../engine/tables';
import { miscastDie, miscastRowAt } from '../engine/miscast';
import { deDuVoyageRapide, resolveFastVoyage } from '../engine/seaVoyage';
import { makeRNG, type DiceSpec } from '../engine/dice';
import { deSelonLaPlage } from '../engine/dice.testkit';
import { scatter } from '../engine/scatter';
import { SIZE_RANGED_MOD } from '../engine/size';
import { tirerLaReactionAuStatut, tirerLeCapricieux } from '../engine/social';
import { auChemin } from '../lib/objet.mjs';
import { catalogueDuProcessus } from './catalogueDuProcessus';

type Entree = Record<string, unknown>;
const traits = () => datasetArray('traits');
let avant = traits().slice();
beforeEach(() => { avant = traits().slice(); });
afterEach(() => { setDataset('traits', avant); });

describe('enregistrerEntree — transaction d’une entrée éditée', () => {
  it('une entrée valide est posée à sa position et rendue en forme disque', () => {
    const editee = { ...avant[0], label: 'Libellé édité' };
    const issue = enregistrerEntree('traits', editee, 0);
    expect(issue.ok).toBe(true);
    if (!issue.ok) return;
    expect(issue.fichier).toBe('traits.json');
    expect(issue.texte).toContain('"label": "Libellé édité"');
    expect(traits()[0].label).toBe('Libellé édité');
    expect(traits()).toHaveLength(avant.length);
  });

  it('une entrée NEUVE (index −1) est ajoutée en fin de dataset', () => {
    const neuve = { ...avant[0], id: 'trait-neuf-du-contrat', label: 'Trait neuf' };
    expect(enregistrerEntree('traits', neuve, -1).ok).toBe(true);
    expect(traits()[traits().length - 1].id).toBe('trait-neuf-du-contrat');
    expect(traits()).toHaveLength(avant.length + 1);
  });

  it('une racine que son schéma refuse est REPRISE : le dataset revient à l’état d’avant', () => {
    const issue = enregistrerEntree('traits', { ...avant[0], label: 42 }, 0);
    expect(issue.ok).toBe(false);
    if (issue.ok) return;
    expect(issue.erreurs.length).toBeGreaterThan(0);
    expect(traits()).toEqual(avant);
    expect(traits()[0]).toBe(avant[0]);
  });

  it('un dataset-objet refusé garde la table de Tailles lue par le moteur (#4047)', () => {
    const tailles = datasetObject('sizes');
    const vueMoteur = SIZE_RANGED_MOD;
    const etatInitial = structuredClone(tailles);
    expect(tailles.rangedMod).toBe(vueMoteur);

    const { rangedMod: _modificateurs, ...incomplet } = etatInitial;
    const refus = enregistrerEntree('sizes', incomplet, 0);
    if (refus.ok) refus.reprendre();
    expect(refus.ok).toBe(false);
    expect(datasetObject('sizes')).toBe(tailles);
    expect(tailles).toEqual(etatInitial);
    expect(tailles.rangedMod).toBe(vueMoteur);

    const minuscule = etatInitial.rangedMod.minuscule + 1;
    const valide = enregistrerEntree('sizes', { ...etatInitial, rangedMod: { ...etatInitial.rangedMod, minuscule } }, 0);
    expect(valide.ok).toBe(true);
    if (!valide.ok) return;
    try {
      expect(tailles.rangedMod).toBe(vueMoteur);
      expect(vueMoteur.minuscule).toBe(minuscule);
    } finally {
      valide.reprendre();
    }
    expect(tailles.rangedMod).toBe(vueMoteur);
    expect(tailles).toEqual(etatInitial);
  });

  it('une collision d’id est refusée sans rien poser', () => {
    const issue = enregistrerEntree('traits', { ...avant[0], id: avant[1].id }, 0);
    expect(issue).toEqual({ ok: false, erreurs: [`id « ${String(avant[1].id)} » déjà pris par une autre entrée`] });
    expect(traits()[0]).toBe(avant[0]);
  });

  it.each([{}, { id: '' }])('une référence d’op requise non élue est refusée avant la transaction (%j)', (talent) => {
    const entree = { ...avant[0], passive: [{ op: 'grantTalent', talent }] };
    const erreurs = validateEntry('traits', entree, avant, 0);
    expect(erreurs).toEqual([expect.stringMatching(/Talent › identifiant : GameOp « grantTalent »/u)]);
    expect(enregistrerEntree('traits', entree, 0)).toEqual({ ok: false, erreurs });
    expect(traits()[0]).toBe(avant[0]);
  });
  it('une référence vide dans une opération imbriquée reste visible avant la transaction', () => {
    const entree = {
      ...avant[0], passive: [{
        op: 'rollTable', die: { n: 1, sides: 10 },
        entries: [{ min: 1, max: 10, ops: [{ op: 'grantTalent', talent: { id: '' } }] }],
      }],
    };
    const erreurs = validateEntry('traits', entree, avant, 0);
    expect(erreurs).toEqual([expect.stringMatching(/Talent › identifiant : GameOp « grantTalent »/u)]);
    expect(enregistrerEntree('traits', entree, 0)).toEqual({ ok: false, erreurs });
    expect(traits()[0]).toBe(avant[0]);
  });
});

describe('enregistrerEntree — une référence morte d’un champ typé est refusée au parse, son catalogue nommé', () => {
  afterEach(() => resetData());
  /** L'issue d'une entrée `modifiee` de `categorie` à la position 0 ; le dataset reste celui d'avant. */
  const refus = (categorie: string, modifiee: (e: Entree) => Entree): string => {
    const ds = CATEGORY_DATASET_DERIVE[categorie] as DatasetKey;
    const premiere = entreesDuDataset(ds)[0];
    const issue = enregistrerEntree(categorie, modifiee(premiere), 0);
    expect(issue.ok, categorie).toBe(false);
    expect(entreesDuDataset(ds)[0], categorie).toBe(premiere);
    return issue.ok ? '' : issue.erreurs.join('\n');
  };

  it('une référence d’op inventée nomme son catalogue et restaure la rangée', () => {
    expect(refus('traits', (e) => ({
      ...e, passive: [{ op: 'grantTalent', talent: { id: 'talent-fantome-1468' } }],
    }))).toMatch(/GameOp « grantTalent » : « talent-fantome-1468 » est absent du catalogue des talents/u);
  });

  it('un Trait inconnu d’une créature', () => {
    expect(refus('creatures', (e) => ({ ...e, traits: [{ id: 'trait-fantome' }] }))).toMatch(/« trait-fantome » est absent du catalogue des traits/);
  });

  it('un LIBELLÉ écrit à la place de l’id d’une séquelle de Critique (#173)', () => {
    expect(refus('criticalsTete', (e) => ({ ...e, traumas: ['Fracture'] }))).toMatch(/« Fracture » est absent du catalogue des séquelles/);
  });

  it('une dotation de POSSESSION `{ id, type }` d’un véhicule inconnu', () => {
    const marchand = datasetArray('careerLevels').findIndex((e) => e.id === 'marchand-1');
    const entree = datasetArray('careerLevels')[marchand];
    const trappings = entree.trappings.map((t) => ('type' in t && t.type === 'vehicle' ? { ...t, id: 'vehicule-fantome' } : t));
    const issue = enregistrerEntree('careerLevels', { ...entree, trappings }, marchand);
    expect(issue.ok).toBe(false);
    expect(issue.ok ? '' : issue.erreurs.join('\n')).toMatch(/« vehicule-fantome » est absent du catalogue des véhicules/);
  });
});

describe('enregistrerEntree — invariants de collection entre datasets (#4047)', () => {
  afterEach(() => resetData());

  it('refuse une Espèce qui rend ambigu le tableau de ses Races', () => {
    const especes = datasetArray('species');
    const index = especes.findIndex((e) => e.id === 'gnomes');
    const gnomes = especes[index];
    const racesDuLdb = new Set<typeof gnomes.refChar>(['humain', 'halfling', 'nain', 'haut-elfe', 'elfe-sylvain']);
    const table = tableDesRacesAleatoires(racesDuLdb);
    expect(table.id).toBe('races-ldb');

    const refCharsVus: (typeof gnomes.refChar)[] = [];
    const desabonner = abonnerAuxDatasets(() => { refCharsVus.push(especes[index].refChar); });
    let issue;
    try {
      issue = enregistrerEntree('races', { ...gnomes, refChar: 'nain' }, index);
    } finally {
      desabonner();
    }

    expect(issue).toMatchObject({
      ok: false,
      erreurs: expect.arrayContaining([
        expect.stringContaining('especes-aleatoires.json'),
        expect.stringContaining('un seul document par jeu de races'),
      ]),
    });
    expect(refCharsVus).toEqual([]);
    expect(especes[index]).toBe(gnomes);
    expect(tableDesRacesAleatoires(racesDuLdb)).toBe(table);
  });

  it.each([
    {
      cas: 'refuse un tableau de Races manquant quand une Espèce change de Race',
      id: 'humains-reiklander',
      modification: { refChar: 'nain' },
      diagnostic: 'aucun document pour le jeu de races',
    },
    {
      cas: 'refuse un tableau de Races manquant quand une Espèce devient optionnelle',
      id: 'hauts-elfes',
      modification: { gatedByRule: { id: 'creation-gnome-jouable' } },
      diagnostic: 'aucun document pour le jeu de races',
    },
    {
      cas: 'refuse deux rangées pour la même Race quand une Espèce change de Race',
      id: 'hauts-elfes',
      modification: { refChar: 'nain' },
      diagnostic: 'plusieurs rangées pour la race « nain »',
    },
  ])('$cas', ({ id, modification, diagnostic }) => {
    const especes = datasetArray('species');
    const index = especes.findIndex((e) => e.id === id);
    const espece = especes[index];
    const table = randomSpeciesTable();

    const issue = enregistrerEntree('races', { ...espece, ...modification }, index);

    expect(issue).toMatchObject({
      ok: false,
      erreurs: expect.arrayContaining([
        expect.stringContaining('especes-aleatoires.json'),
        expect.stringContaining(diagnostic),
      ]),
    });
    expect(especes[index]).toBe(espece);
    expect(randomSpeciesTable()).toEqual(table);
  });

  it('refuse une Carrière créée sans aucun Niveau (LDB 07 l.26)', () => {
    const carrieres = datasetArray('careers');
    const existantes = carrieres.slice();
    const id = 'carriere-sans-niveau';
    expect(findCareerById(id)).toBeUndefined();

    const issue = enregistrerEntree('careers', { ...carrieres[0], id, label: 'Carrière sans Niveau' }, -1);

    expect(issue).toMatchObject({
      ok: false,
      erreurs: expect.arrayContaining([
        expect.stringContaining('careerLevels.json'),
        expect.stringContaining(`la carrière « ${id} » doit porter les niveaux 1, 2, 3 et 4 une fois chacun`),
      ]),
    });
    expect(carrieres).toEqual(existantes);
    expect(carrieres[0]).toBe(existantes[0]);
    expect(findCareerById(id)).toBeUndefined();
    expect(levelsForCareer(id)).toEqual([]);
  });

  const mutationsDeCargaison = [
    {
      cas: 'qui quitte la voie de sa table',
      modifier: (cargaison: CargoEntry) => ({ ...cargaison, voie: 'terre' }),
      message: 'hors de la sous-liste « mer »',
    },
    {
      cas: 'qui devient un marqueur sans prix',
      modifier: ({ price: _prix, ...cargaison }: CargoEntry) => ({ ...cargaison, echangeable: false }),
      message: 'ne porte aucun prix',
    },
  ];

  it.each(mutationsDeCargaison)('refuse une cargaison $cas', ({ modifier, message }) => {
    const cargaisons = datasetArray('cargoes');
    const index = cargaisons.findIndex((c) => c.id === 'cereales');
    const cereales = cargaisons[index];
    const de = deSelonLaPlage((min) => min);
    expect(rollSeasonalCargo('mer', 'printemps', de)).toBe(cereales);

    const issue = enregistrerEntree('cargoes', modifier(cereales), index);

    expect(issue).toMatchObject({
      ok: false,
      erreurs: expect.arrayContaining([
        expect.stringContaining('cargaisons-aleatoires.json'),
        expect.stringContaining(message),
      ]),
    });
    expect(cargaisons[index]).toBe(cereales);
    expect(rollSeasonalCargo('mer', 'printemps', de)).toBe(cereales);
  });

  it('publie la Carrière valide avec ses Niveaux et peut reprendre son édition', () => {
    const carriere = datasetArray('careers')[0];
    const label = 'Libellé de Carrière édité';
    const observations: { label: string | undefined; niveaux: number[] }[] = [];
    const desabonner = abonnerAuxDatasets(() => {
      observations.push({
        label: findCareerById(carriere.id)?.label,
        niveaux: levelsForCareer(carriere.id).map((niveau) => niveau.level),
      });
    });
    let issue;
    try {
      issue = enregistrerEntree('careers', { ...carriere, label }, 0);
    } finally {
      desabonner();
    }

    expect(issue.ok).toBe(true);
    if (!issue.ok) return;
    expect(issue.fichier).toBe('careers.json');
    expect(JSON.parse(issue.texte)[0]).toMatchObject({ id: carriere.id, label });
    expect(findCareerById(carriere.id)?.label).toBe(label);
    expect(observations).toEqual([{ label, niveaux: [1, 2, 3, 4] }]);

    issue.reprendre();

    expect(findCareerById(carriere.id)).toBe(carriere);
  });
});

describe('enregistrerEntree — écritures d’en-tête de la table (#1667)', () => {
  afterEach(() => resetData());
  const rangees = () => datasetArray('drunkenness');
  const de = (valeur: DiceSpec) => [{ ancetre: '', champ: 'die', valeur }];

  it('le dé posé s’écrit avec l’entrée, et la forme disque le porte', () => {
    const issue = enregistrerEntree('drunkenness', rangees()[0], 0, de({ n: 2, sides: 10 }));
    expect(issue.ok).toBe(true);
    if (!issue.ok) return;
    expect(deDeLaTable('drunkenness')).toEqual({ n: 2, sides: 10 });
    expect(issue.texte).toMatch(/"die": \{\s*"n": 2,\s*"sides": 10\s*\}/);
  });

  it('un dé hors NdM (zéro dé) : la racine refusée REPREND l’en-tête', () => {
    const issue = enregistrerEntree('drunkenness', rangees()[0], 0, de({ n: 0, sides: 10 }));
    expect(issue.ok).toBe(false);
    expect(deDeLaTable('drunkenness')).toEqual({ n: 1, sides: 10 });
  });

  it('une racine refusée par son schéma REPREND l’entrée ET l’en-tête, champ ajouté compris', () => {
    const entree = rangees()[0];
    const issue = enregistrerEntree('drunkenness', { ...entree, label: 42 }, 0, [...de({ n: 2, sides: 10 }), { ancetre: '', champ: 'ajout', valeur: 'x' }]);
    expect(issue.ok).toBe(false);
    expect(rangees()[0]).toBe(entree);
    expect(deDeLaTable('drunkenness')).toEqual({ n: 1, sides: 10 });
    expect(champDEnTete('drunkenness', '', 'ajout')).toBeUndefined();
  });

  it('toute catégorie dont un ancêtre porte le dé refuse un dé hors NdM et garde le sien', () => {
    const portees = Object.entries(CATEGORY_DATASET_DERIVE).flatMap(([categorie, ds]) => {
      const ancetre = ancetreDuDe(ds as DatasetKey);
      return ancetre === undefined ? [] : [{ categorie, ds: ds as DatasetKey, ancetre }];
    });
    expect(portees.length).toBeGreaterThan(0);
    for (const { categorie, ds, ancetre } of portees) {
      const avantDe = deDeLaTable(ds);
      const issue = enregistrerEntree(categorie, entreesDuDataset(ds)[0], 0, [{ ancetre, champ: 'die', valeur: { n: 0, sides: 10 } }]);
      expect(issue.ok, categorie).toBe(false);
      expect(deDeLaTable(ds), categorie).toEqual(avantDe);
    }
  });
});

describe('enregistrerEntree — les tables tirées s’éditent et le lecteur suit (#1667)', () => {
  afterEach(() => resetData());

  it('table d’effets : le dé et une rangée édités changent ce que tire le lecteur', () => {
    const tables = datasetArray('effectTables');
    const index = tables.findIndex((t) => t.id === 'allure-demoniaque-nurgle');
    const table = tables[index];
    expect(findTableEntry(findEffectTableById('allure-demoniaque-nurgle').entries, 10).label).toBe(table.entries[9].label);
    const entries = table.entries.map((r, i) => (i === table.entries.length - 1 ? { ...r, max: 20, label: 'Rangée éditée' } : r));
    expect(enregistrerEntree('effectTables', { ...table, die: { n: 1, sides: 20 }, entries }, index).ok).toBe(true);
    expect(effectTableDie('allure-demoniaque-nurgle').sides).toBe(20);
    expect(findTableEntry(findEffectTableById('allure-demoniaque-nurgle').entries, 15).label).toBe('Rangée éditée');
  });

  it('miscast VDM : une rangée puis le dé édités changent ce que tire le lecteur', () => {
    const rangees = datasetArray('imparfaiteMineureVdm');
    // Lecture AVANT l'édition : le lecteur mémoïsé est construit, l'édition doit l'invalider.
    expect(miscastRowAt('miscast-mineure-vdm', 1).label).toBe(rangees[0].label);
    expect(enregistrerEntree('imparfaiteMineureVdm', { ...rangees[0], label: 'Contrecoup édité' }, 0).ok).toBe(true);
    expect(miscastRowAt('miscast-mineure-vdm', 1).label).toBe('Contrecoup édité');
    expect(enregistrerEntree('imparfaiteMineureVdm', rangees[1], 1, [{ ancetre: '[miscast-mineure-vdm]', champ: 'die', valeur: { n: 2, sides: 50 } }]).ok).toBe(true);
    expect(miscastDie('miscast-mineure-vdm')).toMatchObject({ n: 2, sides: 50 });
  });

  it('Voyage rapide : une rangée puis le dé édités changent ce que tire le lecteur', () => {
    const paliers = datasetArray('seaFastVoyage');
    const parfait = paliers.findIndex((p) => p.id === 'parfait');
    // Lecture AVANT l'édition : le lecteur mémoïsé est construit, l'édition doit l'invalider.
    expect(resolveFastVoyage(20, 0, 0, makeRNG(1)).palier.label).toBe(paliers[parfait].label);
    expect(enregistrerEntree('seaFastVoyage', { ...paliers[parfait], label: 'Palier édité' }, parfait).ok).toBe(true);
    expect(resolveFastVoyage(20, 0, 0, makeRNG(1)).palier.label).toBe('Palier édité');
    expect(enregistrerEntree('seaFastVoyage', paliers[0], 0, [{ ancetre: 'fastVoyage', champ: 'die', valeur: { n: 1, sides: 20 } }]).ok).toBe(true);
    expect(deDuVoyageRapide()).toMatchObject({ n: 1, sides: 20 });
  });

  it('Dispersion : le dé édité est celui que tire le lecteur', () => {
    const rangees = datasetArray('dispersion');
    setDataset('dispersion', rangees.filter((r) => r.max <= 8));
    expect(enregistrerEntree('dispersion', rangees[0], 0, [{ ancetre: ancetreDuDe('dispersion')!, champ: 'die', valeur: { n: 1, sides: 8 } }]).ok).toBe(true);
    const plages: number[] = [];
    const de = deSelonLaPlage((_min, max) => { plages.push(max); return max; });
    // Face 8 du d8 = (+1, +1) ; 2d10 = 20 m, demi-distance 20 m → 10 tuiles.
    expect(scatter({ x: 0, y: 0 }, { x: 20, y: 20 }, de, 2)).toEqual({ x: 30, y: 30 });
    expect(plages[0]).toBe(8);
  });

  it('Capricieux et Réaction au Statut : le dé édité est celui que tire le lecteur', () => {
    const plages: number[] = [];
    const de = deSelonLaPlage((_min, max) => { plages.push(max); return max; });
    const capricieux = datasetArray('tableauCapricieux');
    setDataset('tableauCapricieux', capricieux.filter((r) => r.max <= 3));
    expect(enregistrerEntree('tableauCapricieux', capricieux[0], 0, [{ ancetre: ancetreDuDe('tableauCapricieux')!, champ: 'die', valeur: { n: 1, sides: 3 } }]).ok).toBe(true);
    expect(tirerLeCapricieux(de)).toEqual({ roll: 3, dr: -1 });
    const reaction = datasetArray('reactionAuStatut');
    setDataset('reactionAuStatut', reaction.filter((r) => r.max <= 2));
    expect(enregistrerEntree('reactionAuStatut', reaction[0], 0, [{ ancetre: ancetreDuDe('reactionAuStatut')!, champ: 'die', valeur: { n: 1, sides: 2 } }]).ok).toBe(true);
    expect(tirerLaReactionAuStatut(de)).toBe('braver-le-statut');
    expect(plages).toEqual([3, 2]);
  });
});

describe('mutationTables — références et couverture dans la transaction de l’atelier', () => {
  const fichier = 'mutationTables.json';
  const premierId = 'premiere-mutation-3915';
  const secondId = 'seconde-mutation-3915';
  const table = {
    id: 'table-de-corruption-3915',
    type: 'mutationTables' as const,
    label: 'Table de test',
    maison: 'Table de test',
    die: { n: 1, sides: 20 },
  };
  const rangs = [
    { id: premierId, min: 1, max: 10 },
    { id: secondId, min: 11, max: 20 },
  ];

  beforeEach(() => {
    const mutations = [premierId, secondId].map((id) => ({
      id, type: 'mutations' as const, label: id, maison: 'Mutation de test', desc: 'Mutation de test.', kind: 'physique' as const,
    }));
    setDataset('mutations', [...datasetArray('mutations'), ...mutations]);
    setDataset('mutationTables', [...datasetArray('mutationTables'), { ...table, entries: rangs.map((r) => rangee.parse(r)) }]);
  });
  afterEach(() => resetData());

  it.each([
    ['un identifiant absent du catalogue', [{ ...rangs[0], id: 'mutation-3915-inexistante' }, rangs[1]], /mutation-3915-inexistante.*absent du catalogue des mutations/],
    ['une borne basse hors du dé', [{ ...rangs[0], min: 0 }, rangs[1]], /commence à 0 au lieu de 1/],
    ['un trou entre deux rangées', [rangs[0], { ...rangs[1], min: 12 }], /commence à 12 au lieu de 11/],
    ['un chevauchement entre deux rangées', [rangs[0], { ...rangs[1], min: 10 }], /commence à 10 au lieu de 11/],
    ['deux bornes fractionnaires consécutives', [{ ...rangs[0], max: 9.5 }, { ...rangs[1], min: 10.5 }], /entier attendu/],
  ] as const)('refuse %s au schéma et restaure l’entrée', (_cas, entries, erreur) => {
    const index = datasetArray('mutationTables').length - 1;
    const avant = datasetArray('mutationTables')[index];
    const editee = { ...table, entries };
    expect(validateDataset(fichier, [avant], catalogueDuProcessus())).toBeNull();
    expect(validateDataset(fichier, [editee], catalogueDuProcessus())).toMatch(erreur);
    const resultat = enregistrerEntree('mutationTables', editee, index);
    if (resultat.ok) resultat.reprendre();
    expect(resultat).toEqual({ ok: false, erreurs: expect.arrayContaining([expect.stringMatching(erreur)]) });
    expect(datasetArray('mutationTables')[index]).toBe(avant);
  });

  it('désigne la mutation par son catalogue et protège son retrait', () => {
    const designe = designations('mutations', premierId, []);
    expect(designe).toEqual([expect.stringContaining(`${fichier} › élément « ${table.id} »`)]);
    const mutations = datasetArray('mutations').slice();
    const index = mutations.findIndex((m: { id: string }) => m.id === premierId);
    expect(supprimerEntree('mutations', index, []).ok).toBe(false);
    expect(datasetArray('mutations')).toEqual(mutations);
  });
});

describe('designations et supprimerEntree — ce qui désigne une entrée, et son retrait (#4020)', () => {
  afterEach(() => resetData());
  const niveau = () => datasetArray('careerLevels')[0];

  it('un talent qu’un niveau de carrière accorde est désigné par lui, dit « fichier › chemin » ; une entrée neuve, par personne', () => {
    const cite = niveau().talents.flatMap((r) => ('id' in r ? [r.id] : []))[0];
    expect(designations('talents', cite, [])).toContain(`careerLevels.json › élément « ${niveau().id} » › Talents du Niveau 1 › identifiant`);
    expect(enregistrerEntree('talents', { ...datasetArray('talents')[0], id: 'talent-sans-renvoi', label: 'Talent sans renvoi' }, -1).ok).toBe(true);
    expect(designations('talents', 'talent-sans-renvoi', [])).toEqual([]);
  });

  it('une entrée qui se désigne elle-même ne compte pas', () => {
    const entree = { ...datasetArray('talents')[0], id: 'talent-reflexif', label: 'Talent réflexif', passive: [{ op: 'grantTalent', talent: { id: 'talent-reflexif' } }] };
    expect(enregistrerEntree('talents', entree, -1).ok).toBe(true);
    expect(designations('talents', 'talent-reflexif', [])).toEqual([]);
  });

  it('une op posée dans une autre entrée désigne sa cible', () => {
    const base = datasetArray('talents')[0];
    expect(enregistrerEntree('talents', { ...base, id: 'talent-accorde', label: 'Talent accordé' }, -1).ok).toBe(true);
    expect(enregistrerEntree('talents', { ...base, id: 'talent-qui-accorde', label: 'Talent qui accorde', passive: [{ op: 'grantTalent', talent: { id: 'talent-accorde' } }] }, -1).ok).toBe(true);
    expect(designations('talents', 'talent-accorde', []).filter((d) => d.startsWith('talents.json › élément « talent-qui-accorde » › '))).toHaveLength(1);
  });

  it('une référence typée vers un autre espace qui porte le même id ne désigne pas', () => {
    const competence = niveau().skills.flatMap((c) => ('id' in c ? [c.id] : []))[0];
    const parLaCompetence = designations('skills', competence, []).filter((d) => d.startsWith(`careerLevels.json › élément « ${niveau().id} » › `));
    expect(parLaCompetence.length).toBeGreaterThan(0);
    expect(enregistrerEntree('talents', { ...datasetArray('talents')[0], id: competence, label: 'Talent homonyme' }, -1).ok).toBe(true);
    const datasetsDeLId = new Map<string, Set<string>>();
    for (const d of Object.values(DATASET_DE_LA_CATEGORIE)) {
      const collection = suivreLeChemin(RACINES_VIVANTES[d.fichier], d.chemin);
      for (const e of Array.isArray(collection) ? (collection as { id?: unknown }[]) : []) {
        if (typeof e.id === 'string') datasetsDeLId.set(e.id, (datasetsDeLId.get(e.id) ?? new Set()).add(d.cle));
      }
    }
    const collisions = [...datasetsDeLId].filter(([, cles]) => cles.size > 1);
    const diagnostic = `${collisions.length} id(s) portés par plusieurs datasets, qu'une chaîne non typée désigne tous : ${collisions.slice(0, 20).map(([id, cles]) => `${id} (${[...cles].join(', ')})`).join(' ; ')}`;
    expect(designations('talents', competence, []).filter((d) => parLaCompetence.includes(d)), diagnostic).toEqual([]);
    expect(designations('talents', competence, []).filter((d) => d.startsWith(`skills.json › élément « ${competence} »`)), 'la clé d’identité de la compétence homonyme ne désigne pas').toEqual([]);
  });

  it('un paquet passé compte : sa référence le désigne, dite sous son fichier', () => {
    const repere = reperesDuParse(projetSchema, versDisque(paquetDeTest)).find((r) => r.type === 'creature' && !r.parCle)!;
    const id = auChemin(paquetDeTest, repere.path) as string;
    const paquet = { fichier: 'paquet-de-test.json', projet: paquetDeTest };
    expect(designations('creatures', id, [paquet]).filter((d) => d.startsWith('paquet-de-test.json › ')).length).toBeGreaterThan(0);
    expect(designations('creatures', id, []).filter((d) => d.startsWith('paquet-de-test.json › '))).toEqual([]);
  });

  it('supprimer une entrée désignée est refusé sans rien retirer', () => {
    const talents = datasetArray('talents').slice();
    const cite = talents.findIndex((t) => t.id === niveau().talents.flatMap((r) => ('id' in r ? [r.id] : []))[0]);
    const issue = supprimerEntree('talents', cite, []);
    expect(issue.ok).toBe(false);
    expect(issue.ok ? [] : issue.erreurs).toContain(`désignée par careerLevels.json › élément « ${niveau().id} » › Talents du Niveau 1 › identifiant`);
    expect(datasetArray('talents')).toEqual(talents);
  });

  it('supprimer une entrée que personne ne désigne la retire, et rend la source sans elle', () => {
    expect(enregistrerEntree('talents', { ...datasetArray('talents')[0], id: 'talent-a-retirer', label: 'Talent à retirer' }, -1).ok).toBe(true);
    const issue = supprimerEntree('talents', datasetArray('talents').findIndex((t) => (t.id as string) === 'talent-a-retirer'), []);
    expect(issue.ok).toBe(true);
    expect(issue.ok && issue.texte.includes('talent-a-retirer')).toBe(false);
    expect(datasetArray('talents').some((t) => (t.id as string) === 'talent-a-retirer')).toBe(false);
  });

  it('une racine que son schéma refuse sans l’entrée est REPRISE : le dataset revient à l’état d’avant', () => {
    const bandes = datasetArray('advancementCosts').slice();
    const issue = supprimerEntree('advancementCosts', 1, []);
    expect(issue.ok).toBe(false);
    expect(issue.ok ? '' : issue.erreurs.join('\n')).toMatch(/ne couvrent pas les Augmentations déjà achetées d'un seul tenant/);
    expect(datasetArray('advancementCosts')).toEqual(bandes);
    expect(datasetArray('advancementCosts')[1]).toBe(bandes[1]);
  });

  it('une configuration unique ne se supprime pas', () => {
    expect(supprimerEntree('details', 0, [])).toEqual({ ok: false, erreurs: ['« details » n’est pas une liste d’entrées : rien ne s’y supprime'] });
  });
});
