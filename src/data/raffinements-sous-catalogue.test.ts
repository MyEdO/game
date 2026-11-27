/**
 * Les raffinements croisés de la grammaire et des defs se jugent contre le catalogue passé (#5070, `catalogueLu`) : le
 * trait octroyé (`grantTrait`) et sa Cible tirée, la Cible d'un état psy posé (`beginPsych`), le Trait posé, la prose
 * d'un livre extrait, l'apparence d'un objet, les jeux de races (`especes-aleatoires.json`).
 * Fixtures : des traits, des états psy, un Groupe, un livre, un objet, une rangée d'obsessions, une espèce et une règle
 * optionnelle présents SEULEMENT dans le catalogue de la suite (`catalogueAvec`).
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { catalogueAvec, copie } from './catalogueAvec.testkit';
import { catalogueDuProcessus } from './catalogueDuProcessus';
import { parserSousCatalogue } from './schemas/catalogue/references';
import { gameOpSchema, mecaniqueDe } from './schemas/grammaire/mecanique';
import { fichiersLisantLeCatalogue, validateDataset } from './schemas/validate';
import { renvoiDeLEspaceVivant } from './overrides';
import { refMorte } from './schemas/grammaire/ref';
import { traitInstanceSchema } from './schemas/grammaire/reference';
import { proseAdressable, refineProse } from './schemas/grammaire/prose';
import { apparencesDObjetsSchema } from './schemas/grammaire/valeurs';
import { estLivreExtrait } from './schemas/source/livre-extrait';
import especesAleatoiresJson from './especes-aleatoires.json';

const TRAIT = 'trait-lanceur-du-livre-de-test';
const PSY = 'psy-a-cible-du-livre-de-test';
const PSY_D_AMOUR = 'psy-d-amour-du-livre-de-test';
const TRAIT_DE_L_AMOUR_DU_LIVRE = 'trait-de-l-amour-du-livre-de-test';
const GROUPE = 'groupe-du-livre-de-test';
const ESPECE = 'gnomes-du-livre-de-test';
const TRAIT_D_AMOUR = 'amour-du-livre-de-test';
const TRAIT_A_DISTANCE = 'a-distance-du-livre-de-test';
const LIVRE = 'livre-extrait-de-test';
const OBJET = 'hallebarde-du-livre-de-test';
const GROUPE_TIRE: string = 'groupe-tire-du-livre-de-test';
const REGLE: string = 'regle-du-livre-de-test';

const base = catalogueDuProcessus();
type Espece = (typeof base)['species.json'][number];
const especes = base['species.json'];
/** Une rangée du Tableau des Obsessions : son Groupe est un id hors de l'index des ids typés (`Id<T>`). */
type Rangee = (typeof base)['obsessions.json']['entries'][number];
/** L'espèce du livre de test, gardée par la règle du livre de test : un id hors de l'index des ids typés (`Id<T>`). */
const espece: Espece = { ...copie(especes, 'gnomes', ESPECE), gatedByRule: { id: REGLE } as Espece['gatedByRule'] };

const livre = { ...base['books.json'].find((b) => estLivreExtrait(b))!, id: LIVRE };
type Trait = (typeof base)['traits.json'][number];
const amour = copie(base['traits.json'], 'amour', TRAIT_DE_L_AMOUR_DU_LIVRE);
/** Un Trait d'Amour dont le type est l'état psy du livre de test : un id hors de l'index des ids typés (`Id<T>`). */
const traitDeLAmourDuLivre: Trait = { ...amour, capabilities: { ...amour.capabilities, psychType: PSY_D_AMOUR as NonNullable<Trait['capabilities']>['psychType'] } };

const CAT = catalogueAvec({
  'traits.json': [copie(base['traits.json'], 'lanceur-de-sorts', TRAIT), copie(base['traits.json'], 'amour', TRAIT_D_AMOUR), copie(base['traits.json'], 'a-distance', TRAIT_A_DISTANCE), traitDeLAmourDuLivre],
  'psychology.json': [copie(base['psychology.json'], 'haine', PSY), { ...copie(base['psychology.json'], 'amour', PSY_D_AMOUR), label: 'Amour du livre' }],
  'groups.json': [copie(base['groups.json'], 'nain', GROUPE)],
  'species.json': [espece],
  'books.json': [livre],
  'trappings.json': [copie(base['trappings.json'], 'hallebarde', OBJET)],
});
/** Le Tableau des Obsessions augmenté d'une rangée qui tire un Groupe hors du catalogue de spécialisations de la Haine. */
const CAT_A_L_OBSESSION = catalogueAvec({
  'obsessions.json': { ...base['obsessions.json'], entries: [{ id: GROUPE_TIRE, min: 21, max: 21 } as Rangee] },
});
const CAT_AVEC_LA_REGLE = catalogueAvec({
  'species.json': [espece],
  'reglesOptionnelles.json': [copie(base['reglesOptionnelles.json'], 'creation-gnome-jouable', REGLE)],
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
    expect(messages(gameOpSchema, { op: 'grantTrait', trait: { id: 'haine' }, cible: { pick: 1, table: { id: 'obsessions' } } }, CAT_A_L_OBSESSION)).toContain(
      `GameOp « grantTrait » : Trait « haine » : la table de Cibles « obsessions » tire un Groupe absent du catalogue de spécialisations de ce Trait (« ${GROUPE_TIRE} »…).`,
    );
  });

  it('les documents qui octroient un Trait à Cible tirée lisent le Tableau des Obsessions (`catalogueLu`)', () => {
    expect(fichiersLisantLeCatalogue('obsessions.json', renvoiDeLEspaceVivant)).toContain('mutations.json');
  });
});

describe('le Trait posé (`traitInstanceSchema`) se lit dans le catalogue passé', () => {
  it('un Trait psy du seul catalogue refuse la variante de Cible que son type n’admet pas', () => {
    expect(messages(traitInstanceSchema, { id: TRAIT_D_AMOUR, arg: 'nain' })).toContain(`Trait « ${TRAIT_D_AMOUR} » : Amour ne vise pas un Groupe (« nain »).`);
  });

  it('un Trait psy refuse la variante de Cible d’un Groupe du seul catalogue que son type n’admet pas', () => {
    expect(messages(traitInstanceSchema, { id: TRAIT_D_AMOUR, arg: GROUPE })).toContain(`Trait « ${TRAIT_D_AMOUR} » : Amour ne vise pas un Groupe (« ${GROUPE} »).`);
  });

  it('le refus de variante de Cible nomme l’état psy du seul catalogue par son libellé', () => {
    expect(messages(traitInstanceSchema, { id: TRAIT_DE_L_AMOUR_DU_LIVRE, arg: 'nain' })).toContain(`Trait « ${TRAIT_DE_L_AMOUR_DU_LIVRE} » : Amour du livre ne vise pas un Groupe (« nain »).`);
  });

  it('un Trait psy du seul catalogue refuse, hors d’une scène, la Cible d’un individu', () => {
    expect(messages(traitInstanceSchema, { id: TRAIT_D_AMOUR, arg: '@pnj' })).toContain(`Trait « ${TRAIT_D_AMOUR} » : « @pnj » désigne une personne de la scène ; hors d'une scène, sa Cible est un Groupe.`);
  });

  it('un Trait à distance du seul catalogue refuse l’Allonge de son profil d’arme', () => {
    expect(messages(traitInstanceSchema, { id: TRAIT_A_DISTANCE, profilDArme: { allonge: 'Longue' } })).toContain('L’Allonge se pose sur un profil de mêlée.');
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
  const refus = `L’objet « ${OBJET} » n’admet pas l’apparence « arc ».`;
  it('un objet donné du seul catalogue refuse une apparence qu’il n’admet pas', () => {
    expect(messages(gameOpSchema, { op: 'giveTrapping', objet: { id: OBJET }, apparence: { id: 'arc' } })).toContain(`GameOp « giveTrapping » : ${refus}`);
  });

  it('une apparence par objet porté, sur un objet du seul catalogue, refuse une apparence qu’il n’admet pas', () => {
    expect(messages(apparencesDObjetsSchema, { [OBJET]: { id: 'arc' } })).toContain(refus);
  });
});

describe('la Cible d’un état psy posé (`beginPsych`) se lit dans le catalogue passé', () => {
  it('un état du seul catalogue qui vise un Groupe en admet un', () => {
    expect(messages(gameOpSchema, { op: 'beginPsych', type: { id: PSY }, cible: { id: 'nain' } })).toEqual([]);
  });
});

describe('les jeux de races (`especes-aleatoires.json`) se lisent dans le catalogue passé', () => {
  it('une espèce du seul catalogue, gardée par une règle qu’il ne porte pas, est refusée', () => {
    expect(validateDataset('especes-aleatoires.json', especesAleatoiresJson, CAT)).toContain(refMorte('regleOptionnelle', REGLE));
  });

  it('la même espèce, gardée par une règle du seul catalogue, est admise', () => {
    expect(validateDataset('especes-aleatoires.json', especesAleatoiresJson, CAT_AVEC_LA_REGLE)).toBeNull();
  });
});
