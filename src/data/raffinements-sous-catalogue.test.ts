/**
 * Les raffinements croisés de la grammaire et des defs se jugent contre le catalogue passé (#5070, `catalogueLu`) : le
 * trait octroyé (`grantTrait`) et sa Cible tirée, la Cible d'un état psy posé (`beginPsych`), le Trait posé, la Cible
 * d'individu d'une péripétie de route (`refuserLesIndividus`), la prose
 * d'un livre extrait, l'apparence d'un objet, les jeux de races (`especes-aleatoires.json`), l'enjeu d'un dataset
 * (`catalogStakeSchema`).
 * Fixtures : des traits, des états psy, un Groupe, un livre, un objet et son apparence, un Tableau des Obsessions, des
 * espèces, des enjeux, une manœuvre, une Activité, une météo et une règle optionnelle DÉCLARÉS par la suite, seuls au catalogue (`catalogueDeTest`).
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { catalogueDeTest, type LivreDeTest } from './schemas/catalogue/catalogueDeTest.testkit';
import { idDeFixture } from './idDeFixture.testkit';
import { CHAR_KEYS } from '../engine/types';
import { parserSousCatalogue } from './schemas/catalogue/references';
import { catalogStakeSchema, gameOpSchema, mecaniqueDe } from './schemas/grammaire/mecanique';
import { fichiersLisantLeCatalogue, validateDataset } from './schemas/validate';
import { renvoiDeLEspaceVivant } from './overrides';
import { refMorte } from './schemas/grammaire/ref';
import { traitInstanceSchema } from './schemas/grammaire/reference';
import { routePerilSchema } from './schemas/defs-scenes/worldmap';
import { proseAdressable, refineProse } from './schemas/grammaire/prose';
import { apparencesDObjetsSchema } from './schemas/grammaire/valeurs';
import { tableTotale } from '../lib/tableTotale';

const ID_DU_LIVRE = 'livre-extrait-de-test';
const LIVRE = idDeFixture('book', ID_DU_LIVRE);
const SOURCE = { book: LIVRE, page: 1 };
const TRAIT = 'trait-lanceur-du-livre-de-test';
const TRAIT_A_CIBLE_TIREE = 'trait-a-cible-tiree-du-livre-de-test';
const PSY = 'psy-a-cible-du-livre-de-test';
const PSY_AMOUR = 'psy-amour-du-livre-de-test';
const PSY_D_AMOUR = 'psy-d-amour-du-livre-de-test';
const TRAIT_DE_L_AMOUR_DU_LIVRE = 'trait-de-l-amour-du-livre-de-test';
const GROUPE = 'groupe-du-livre-de-test';
const ESPECE = 'gnomes-du-livre-de-test';
const ESPECE_OUVERTE = 'humains-du-livre-de-test';
const TRAIT_D_AMOUR = 'amour-du-livre-de-test';
const TRAIT_A_DISTANCE = 'a-distance-du-livre-de-test';
const OBJET = 'objet-du-livre-de-test';
const APPARENCE = 'apparence-du-livre-de-test';
const GROUPE_TIRE = idDeFixture('groupe', 'groupe-tire-du-livre-de-test');
const REGLE = 'regle-du-livre-de-test';

/** Les champs d'une espèce que les jeux de races ne lisent pas. */
const PROFIL_D_ESPECE = { family: 'Livre de test', refCareer: 'humain' as const, movement: 4, fate: { fate: 0, resilience: 0, extra: 0 }, baseChar: tableTotale(CHAR_KEYS, () => 0), skills: [], talents: [], grantGroups: [], source: SOURCE };
/** Une espèce ouverte (humaine) et une espèce gnome gardée par la règle du livre de test. */
const ESPECES: LivreDeTest['species.json'] = [
  { ...PROFIL_D_ESPECE, id: ESPECE_OUVERTE, type: 'species', label: 'Humains du livre de test', refChar: 'humain' },
  { ...PROFIL_D_ESPECE, id: ESPECE, type: 'species', label: 'Gnomes du livre de test', refChar: 'gnome', gatedByRule: { id: idDeFixture('regleOptionnelle', REGLE) } },
];
/** Les Tableaux des Races aléatoires des deux jeux de races atteignables : sans la règle, et avec. */
const TABLEAUX_DES_RACES = [
  { id: 'races-du-livre-de-test', type: 'especes-aleatoires', label: 'Races', die: { n: 1, sides: 100 }, source: SOURCE, entries: [{ id: ESPECE_OUVERTE, min: 1, max: 100 }] },
  { id: 'races-gnome-du-livre-de-test', type: 'especes-aleatoires', label: 'Races avec le Gnome', die: { n: 1, sides: 100 }, source: SOURCE, entries: [{ id: ESPECE_OUVERTE, min: 1, max: 99 }, { id: ESPECE, min: 100, max: 100 }] },
];

const LIVRES: LivreDeTest['books.json'] = [{ id: ID_DU_LIVRE, type: 'books', label: 'Livre extrait de test', abbr: 'LDT', dir: 'Source/livre-de-test', language: null, folder: null }];

const CAT = catalogueDeTest({
  'traits.json': [
    { id: TRAIT, type: 'traits', label: 'Lanceur du livre', capabilities: { spellcaster: true }, source: SOURCE },
    { id: TRAIT_A_CIBLE_TIREE, type: 'traits', label: 'Trait à Cible tirée', specsSource: 'ciblesPsy', source: SOURCE },
    { id: TRAIT_D_AMOUR, type: 'traits', label: 'Amour du livre de test', specsSource: 'ciblesPsy', capabilities: { psychType: idDeFixture('psychology', PSY_AMOUR) }, source: SOURCE },
    { id: TRAIT_DE_L_AMOUR_DU_LIVRE, type: 'traits', label: 'Trait de l’Amour du livre', specsSource: 'ciblesPsy', capabilities: { psychType: idDeFixture('psychology', PSY_D_AMOUR) }, source: SOURCE },
    { id: TRAIT_A_DISTANCE, type: 'traits', label: 'À distance du livre de test', specsSource: 'weaponsRanged', source: SOURCE },
  ],
  'psychology.json': [
    { id: PSY, type: 'psychology', label: 'Haine du livre', cibles: ['groupe'], source: SOURCE },
    { id: PSY_AMOUR, type: 'psychology', label: 'Amour', cibles: ['individu'], source: SOURCE },
    { id: PSY_D_AMOUR, type: 'psychology', label: 'Amour du livre', cibles: ['individu'], source: SOURCE },
  ],
  'groups.json': [{ id: GROUPE, type: 'groups', label: 'Groupe du livre de test' }],
  'species.json': ESPECES,
  'books.json': LIVRES,
  'trappings.json': [{ id: OBJET, type: 'trappings', label: 'Objet du livre de test', categorie: 'trapping', subType: null, availability: null, qualities: [], price: null, source: SOURCE }],
  'apparences.json': [{ id: APPARENCE, type: 'apparences', label: 'Apparence du livre de test' }],
  'obsessions.json': { id: 'obsessions', type: 'obsessions', label: 'Obsessions', die: { n: 1, sides: 10 }, source: SOURCE, entries: [{ id: GROUPE_TIRE, min: 1, max: 10 }] },
  'reglesOptionnelles.json': [],
});
const CAT_AVEC_LA_REGLE = catalogueDeTest({
  'books.json': LIVRES,
  'species.json': ESPECES,
  'reglesOptionnelles.json': [{ id: REGLE, type: 'reglesOptionnelles', label: 'Règle du livre de test', ref: 'LDT 1', group: 'Test', kind: 'flag', default: false, source: SOURCE }],
});

const messages = (schema: z.ZodType, op: unknown, cat = CAT) => parserSousCatalogue(schema, op, cat).error?.issues.map((i) => i.message) ?? [];
/** La famille où le choix d'un Trait octroyé est admis (`grantTrait.choix`, celle des rangées de `defs/tables.ts`). */
const opAChoix = mecaniqueDe({ 'grantTrait.choix': 'admis' }).gameOp;

describe('le trait octroyé (`grantTrait`) se lit dans le catalogue passé', () => {
  it('le choix d’un trait de lanceur de sorts du seul catalogue est admis', () => {
    expect(messages(opAChoix, { op: 'grantTrait', trait: { id: TRAIT }, choix: true })).toEqual([]);
  });
});

describe('la Cible tirée d’un trait octroyé (`grantTrait.cible`) se lit dans les rangées du catalogue passé', () => {
  it('une rangée du seul catalogue qui tire un Groupe hors des spécialisations du Trait est refusée', () => {
    expect(messages(gameOpSchema, { op: 'grantTrait', trait: { id: TRAIT_A_CIBLE_TIREE }, cible: { pick: 1, table: { id: 'obsessions' } } })).toContain(
      `GameOp « grantTrait » : Trait « ${TRAIT_A_CIBLE_TIREE} » : la table de Cibles « obsessions » tire un Groupe absent du catalogue de spécialisations de ce Trait (« ${GROUPE_TIRE} »…).`,
    );
  });

  it('les documents qui octroient un Trait à Cible tirée lisent le Tableau des Obsessions (`catalogueLu`)', () => {
    expect(fichiersLisantLeCatalogue('obsessions.json', renvoiDeLEspaceVivant)).toContain('mutations.json');
  });
});

describe('le Trait posé (`traitInstanceSchema`) se lit dans le catalogue passé', () => {
  it('un Trait psy refuse la variante de Cible d’un Groupe du seul catalogue que son type n’admet pas', () => {
    expect(messages(traitInstanceSchema, { id: TRAIT_D_AMOUR, arg: GROUPE })).toContain(`Trait « ${TRAIT_D_AMOUR} » : Amour ne vise pas un Groupe (« ${GROUPE} »).`);
  });

  it('le refus de variante de Cible nomme l’état psy du seul catalogue par son libellé', () => {
    expect(messages(traitInstanceSchema, { id: TRAIT_DE_L_AMOUR_DU_LIVRE, arg: GROUPE })).toContain(`Trait « ${TRAIT_DE_L_AMOUR_DU_LIVRE} » : Amour du livre ne vise pas un Groupe (« ${GROUPE} »).`);
  });

  it('un Trait psy du seul catalogue refuse, hors d’une scène, la Cible d’un individu', () => {
    expect(messages(traitInstanceSchema, { id: TRAIT_D_AMOUR, arg: '@pnj' })).toContain(`Trait « ${TRAIT_D_AMOUR} » : « @pnj » désigne une personne de la scène ; hors d'une scène, sa Cible est un Groupe.`);
  });

  it('un Trait à distance du seul catalogue refuse l’Allonge de son profil d’arme', () => {
    expect(messages(traitInstanceSchema, { id: TRAIT_A_DISTANCE, profilDArme: { allonge: 'Longue' } })).toContain('L’Allonge se pose sur un profil de mêlée.');
  });
});

describe('la Cible d’individu d’une péripétie de route (`refuserLesIndividus`) se lit dans le catalogue passé', () => {
  /** L'entrée minimale qui fait de l'`arg` d'un Trait une Cible psy, sa `specsSource`, et les champs qu'exige son type. */
  const TRAIT_A_CIBLE = 'trait-a-cible-du-livre-de-test';
  const CAT_AU_TRAIT_A_CIBLE = catalogueDeTest({ 'traits.json': [{ id: TRAIT_A_CIBLE, type: 'traits', label: 'Trait à Cible', specsSource: 'ciblesPsy', source: SOURCE }] });
  const peril = { label: 'Péril', chancePct: 10, effects: [{ type: 'givePossession', nature: 'bete', ref: { custom: { type: 'statblock', label: 'Chien', char: {}, traits: [{ id: TRAIT_A_CIBLE, arg: '@p' }] } } }] };

  it('un statbloc qui nomme un individu par un Trait à Cible du seul catalogue est refusé', () => {
    expect(messages(routePerilSchema, peril, CAT_AU_TRAIT_A_CIBLE)).toContain('Cible psy « p » : une péripétie de route n\'a pas de personnages de scène, sa Cible est un Groupe.');
  });
});

describe('la prose d’un livre extrait (`refineProse`) se lit dans le registre du catalogue passé', () => {
  it('un texte recopié d’un livre extrait du seul catalogue est refusé', () => {
    expect(messages(z.looseObject({}).check(refineProse({ type: 'projet', exigeProse: false })), { desc: 'Texte.', source: { book: LIVRE } })).toContain(
      'texte recopié d’un livre extrait : adresse le passage au lieu de le recopier.',
    );
  });

  it('un passage adressé à un livre extrait du seul catalogue est résoluble sous lui, introuvable hors de lui', () => {
    const schema = proseAdressable(z.strictObject({ id: z.string() }), { type: 'projet', exigeProse: false });
    const valeur = { id: 'a', descRef: { book: LIVRE, ch: '01', parts: [{ kind: 'blocs', sec: 's', secOcc: 1, b0: 1, b1: 1, sum: '0123456789abcdef' }] } };
    const introuvable = `passage introuvable : le livre « ${LIVRE} » n’est pas extrait.`;
    expect(messages(schema, valeur)).not.toContain(introuvable);
    expect(schema.safeParse(valeur).error?.issues.map((i) => i.message)).toContain(introuvable);
  });
});

describe('l’apparence d’un objet se lit dans le catalogue passé', () => {
  const refus = `L’objet « ${OBJET} » n’admet pas l’apparence « ${APPARENCE} ».`;
  it('un objet donné du seul catalogue refuse une apparence qu’il n’admet pas', () => {
    expect(messages(gameOpSchema, { op: 'giveTrapping', objet: { id: OBJET }, apparence: { id: APPARENCE } })).toContain(`GameOp « giveTrapping » : ${refus}`);
  });

  it('une apparence par objet porté, sur un objet du seul catalogue, refuse une apparence qu’il n’admet pas', () => {
    expect(messages(apparencesDObjetsSchema, { [OBJET]: { id: APPARENCE } })).toContain(refus);
  });
});

describe('la Cible d’un état psy posé (`beginPsych`) se lit dans le catalogue passé', () => {
  it('un état du seul catalogue qui vise un Groupe en admet un', () => {
    expect(messages(gameOpSchema, { op: 'beginPsych', type: { id: PSY }, cible: { id: GROUPE } })).toEqual([]);
  });
});

describe('les jeux de races (`especes-aleatoires.json`) se lisent dans le catalogue passé', () => {
  it('une espèce du seul catalogue, gardée par une règle qu’il ne porte pas, est refusée', () => {
    expect(validateDataset('especes-aleatoires.json', TABLEAUX_DES_RACES, CAT)).toContain(refMorte('regleOptionnelle', REGLE));
  });

  it('la même espèce, gardée par une règle du seul catalogue, est admise', () => {
    expect(validateDataset('especes-aleatoires.json', TABLEAUX_DES_RACES, CAT_AVEC_LA_REGLE)).toBeNull();
  });
});

describe('l’enjeu d’un dataset (`catalogStakeSchema`) se lit dans le catalogue passé', () => {
  const ENJEU = 'enjeu-du-livre-de-test';
  const ENJEU_A_TROU = 'enjeu-a-trou-du-livre-de-test';
  const ENJEU_DE_PSY = 'enjeu-de-psy-du-livre-de-test';
  const PSY_A_TROU = 'psy-a-trou-du-livre-de-test';
  const PSY_SANS_TROU = 'psy-sans-trou-du-livre-de-test';
  const ENJEU_DE_MANOEUVRE = 'enjeu-de-manoeuvre-du-livre-de-test';
  const MANOEUVRE = 'manoeuvre-du-livre-de-test';
  const ACTIVITE = 'activite-du-livre-de-test';
  const CAT_DES_ENJEUX = catalogueDeTest({
    'stakes.json': [
      { id: ENJEU, type: 'stakes', label: 'Enjeu du livre', cascade: 'flux', template: 'Ce qui se joue.', form: 'descripteur', source: SOURCE },
      { id: ENJEU_A_TROU, type: 'stakes', label: 'Enjeu à trou du livre', cascade: 'flux', template: 'Perte de {pertes}.', form: 'descripteur', source: SOURCE },
      { id: ENJEU_DE_PSY, type: 'stakes', label: 'Enjeu de psy du livre', cascade: 'flux', template: 'Ce qui se joue : {gabarit}.', form: 'descripteur', entryCategory: 'psychologies', source: SOURCE },
      { id: ENJEU_DE_MANOEUVRE, type: 'stakes', label: 'Enjeu de manœuvre du livre', cascade: 'combat', template: 'Ce qui se joue : {gabarit}.', form: 'descripteur', entryCategory: 'maneuvers', source: SOURCE },
    ],
    'maneuvers.json': [
      { id: MANOEUVRE, type: 'maneuvers', label: 'Manœuvre du livre', kind: 'arme', activation: 'action', coutEnAvantage: 0, stat: 'capacite-de-combat', defense: 'auto', ciblage: 'melee', effects: [], stake: 'Ce que la manœuvre met en jeu.', source: SOURCE },
    ],
    'activities.json': [
      { id: ACTIVITE, type: 'activities', label: 'Activité du livre', icon: 'navigation/activite', contexts: ['voyage'], desc: 'Activité du livre de test.', stake: 'Ce que l’activité met en jeu.', source: SOURCE },
    ],
    'psychology.json': [
      { id: PSY_A_TROU, type: 'psychology', label: 'Psy à trou', stake: 'Perte de {pertes}.', source: SOURCE },
      { id: PSY_SANS_TROU, type: 'psychology', label: 'Psy sans trou', stake: 'Ce que la psy met en jeu.', source: SOURCE },
    ],
  });
  const enjeu = (key: Record<string, string>) => messages(catalogStakeSchema, { key }, CAT_DES_ENJEUX);
  /** Les ids de météo sont l'énumération FERMÉE `weatherIdSchema` (`defs/weather.ts`) : la même condition se déclare
   *  avec enjeu dans un catalogue et sans enjeu dans l'autre. */
  const METEO = 'sec';
  const catAvecLaMeteo = (resistanceTest?: { difficulty: 'accessible'; onFail: 'extenue'; enjeu: string }) => catalogueDeTest({
    'weather.json': {
      id: 'weather', type: 'weather', label: 'Météo du livre', seasons: [], physicalTestChars: [],
      conditions: [{ id: METEO, label: 'Météo du livre', ...(resistanceTest ? { resistanceTest } : {}) }],
    },
  });

  it('une entrée de `stakes` du seul catalogue est admise', () => {
    expect(enjeu({ dataset: 'flux', kind: ENJEU })).toEqual([]);
  });

  it('une entrée de `stakes` absente du catalogue est refusée', () => {
    expect(messages(catalogStakeSchema, { key: { dataset: 'flux', kind: ENJEU } }, catalogueDeTest({}))).toContain(`aucune entrée d’enjeu « flux/${ENJEU} »`);
  });

  it('une entrée de `stakes` du seul catalogue dont le gabarit a un trou est refusée', () => {
    expect(enjeu({ dataset: 'flux', kind: ENJEU_A_TROU })).toContain(`l’entrée d’enjeu « flux/${ENJEU_A_TROU} » a des trous que seul le moteur remplit (pertes) : un document ne peut pas la viser`);
  });

  it('le texte d’une psychologie du seul catalogue prime sur le gabarit : son trou est refusé', () => {
    expect(enjeu({ dataset: 'flux', kind: ENJEU_DE_PSY, entryId: PSY_A_TROU })).toContain(`l’entrée d’enjeu « flux/${ENJEU_DE_PSY}/${PSY_A_TROU} » a des trous que seul le moteur remplit (pertes) : un document ne peut pas la viser`);
  });

  it('le texte sans trou d’une psychologie du seul catalogue est admis', () => {
    expect(enjeu({ dataset: 'flux', kind: ENJEU_DE_PSY, entryId: PSY_SANS_TROU })).toEqual([]);
  });

  it('le texte sans trou d’une manœuvre du seul catalogue prime sur le gabarit', () => {
    expect(enjeu({ dataset: 'combat', kind: ENJEU_DE_MANOEUVRE, entryId: MANOEUVRE })).toEqual([]);
  });

  it('l’enjeu d’une Activité du seul catalogue est admis', () => {
    expect(enjeu({ dataset: 'activite', kind: ACTIVITE })).toEqual([]);
  });

  it('l’enjeu d’une condition météo se lit dans le catalogue passé : admis s’il l’y porte, refusé sinon', () => {
    const cle = { key: { dataset: 'meteo', kind: METEO } };
    expect(messages(catalogStakeSchema, cle, catAvecLaMeteo({ difficulty: 'accessible', onFail: 'extenue', enjeu: 'Ce que la météo met en jeu.' }))).toEqual([]);
    expect(messages(catalogStakeSchema, cle, catAvecLaMeteo())).toContain(`aucune entrée d’enjeu « meteo/${METEO} »`);
  });

  it('une catégorie d’entrée sans pool est refusée', () => {
    expect(enjeu({ dataset: 'flux', kind: ENJEU, entryCategory: 'categorie-sans-pool' })).toContain(`la catégorie d’entrée « categorie-sans-pool » de l’enjeu « flux/${ENJEU} » n’a aucun pool`);
  });
});
