/**
 * Registre du PROJET des feuilles `idDe` OUVERTES (#1988 B4a) : le registre global admet sans le juger
 * un id absent de son espace (`ref.ts`, `ouverte`) ; le schéma de PROJET le rejuge, où que la feuille
 * vive dans le document (co-descente, `projetDoc`), contre les objets du projet puis le catalogue. Un
 * objet du projet s'instancie par son seul id : il est jugé par `INSTANCIABLE_PAR_ID`.
 *
 * Chaque refus est NOMMÉ, à son LIEU (`validateDocument`).
 */
import { describe, it, expect } from 'vitest';
import { projetSchema, SCHEMA_PROJET } from './projet';
import { cheminLisible, validateDocument } from '../validate';
import { trappings } from '../../index';
import { EXIGE_UNE_CREATURE } from '../grammaire/sousListes';
import { document, type Exposition } from '../grammaire/document';
import { objetDeSceneSchema } from '../grammaire/mecanique';

type Jouet = Record<string, unknown>;

/** Un objet du PROJET, cloné d'une dague du catalogue sous un id que le catalogue ne porte pas. */
const SCEAU = { ...trappings.find((t) => t.id === 'dague')!, id: 'projet-sceau-du-comte', label: 'Sceau du comte' };

/** Projet-JOUET au format COURANT : une scène dont une action porte `effets`, un trigger gardé par `herse`. */
const projet = (effets: Jouet[], { objets = [SCEAU] as Jouet[], herse = { kind: 'flag', expr: 'ouverte' } as Jouet } = {}): Jouet => ({
  type: 'projet',
  schema: SCHEMA_PROJET,
  id: 'projet-jouet',
  label: 'Projet jouet',
  versionContenu: 1,
  maison: 'fixture de test — aucun livre ne publie ce projet-jouet',
  narratif: { affaires: [], indices: [], presetsPnj: [], objets },
  scenes: [{
    type: 'scene',
    id: 'caveau',
    label: 'Le caveau',
    dimensions: { w: 4, h: 4 },
    reliefDefaults: { cliff: 'terre', ramp: 'terre', deck: 'pierre', pilier: 'pilier' },
    roofDefaults: { material: 'toit-ardoise', pitchDeg: 45, riseMaxStoreys: 1 },
    entities: [{ id: 'coffre', kind: 'prop', ref: 'tonneau', pos: { x: 0, y: 0 }, usable: { actions: [{ id: 'fouiller', flow: { kind: 'seq', steps: effets.map((effect) => ({ kind: 'do', effect })) } }] } }],
    triggers: [{ id: 'herse', rect: { x: 0, y: 0, w: 1, h: 1 }, when: herse, flow: { kind: 'seq', steps: [] } }],
  }],
});

/** LIEU + message de chaque faute, tels que la porte les rend. */
const fautes = (doc: Jouet): string[] => (validateDocument(projetSchema, doc) ?? []).map((f) => `${cheminLisible(f.lieu)} :: ${f.message}`);

const HORS_REGISTRE = 'ni un objet du projet (narratif.objets) ni une entrée du catalogue des objets (trappings.json)';
const ACTION = 'scenes « caveau » › entities « coffre » › usable › actions « fouiller » › flow.steps.0.effect';
const DU_PROJET = 'des objets du projet (narratif.objets)';
const DESIGNE = 'objet du projet désigné par son id';

describe('feuilles OUVERTES — rejugées par le registre du PROJET', () => {
  it('un objet du projet et une entrée du catalogue sont admis, où que la feuille vive', () => {
    expect(fautes(projet(
      [{ type: 'giveTrapping', trappingId: SCEAU.id }, { type: 'giveTrapping', trappingId: 'dague' }],
      { herse: { kind: 'hasItem', trappingId: SCEAU.id } },
    ))).toEqual([]);
  });

  it('un id que ni le projet ni le catalogue ne portent : Effet `giveTrapping` → refus NOMMÉ, à son lieu', () => {
    expect(fautes(projet([{ type: 'giveTrapping', trappingId: 'babiole-onirique' }]))).toEqual([
      `${ACTION}.trappingId :: « babiole-onirique » n'est ${HORS_REGISTRE}.`,
    ]);
  });

  it('même refus pour la Condition `hasItem` et l’outil d’un Test — la descente ne nomme aucun porteur', () => {
    expect(fautes(projet([], { herse: { kind: 'hasItem', trappingId: 'cle-du-caveau' } }))).toEqual([
      `scenes « caveau » › triggers « herse » › when.trappingId :: « cle-du-caveau » n'est ${HORS_REGISTRE}.`,
    ]);
    const test = { kind: 'test', test: { skill: { id: 'crochetage' }, tool: 'rossignol-onirique', stake: { authored: 'La serrure cède.' } }, success: { kind: 'seq', steps: [] }, fail: { kind: 'seq', steps: [] } };
    const doc = projet([]);
    ((doc.scenes as Jouet[])[0].triggers as Jouet[])[0].flow = test;
    expect(fautes(doc)).toEqual([
      `scenes « caveau » › triggers « herse » › flow.test.tool :: « rossignol-onirique » n'est ${HORS_REGISTRE}.`,
    ]);
  });

  it('un objet du projet hors de la sous-liste de la feuille (`service`) est refusé par elle, sous son LIBELLÉ', () => {
    const service = { ...SCEAU, service: true };
    expect(fautes(projet([{ type: 'giveTrapping', trappingId: SCEAU.id }], { objets: [service] }))).toEqual([
      `narratif › objets « ${SCEAU.id} » :: ${DESIGNE} : « ${SCEAU.id} » porte « Objet-service » : cette référence écarte ${DU_PROJET} les entrées qui le portent.`,
      `${ACTION}.trappingId :: « ${SCEAU.id} » porte « Objet-service » : cette référence écarte ${DU_PROJET} les entrées qui le portent.`,
    ]);
  });
});

describe('objets du PROJET — instanciables par leur seul id', () => {
  it(`un objet du projet qui porte \`${EXIGE_UNE_CREATURE}\` est refusé NOMMÉMENT, à son lieu`, () => {
    const piece = { ...SCEAU, [EXIGE_UNE_CREATURE]: true };
    expect(fautes(projet([], { objets: [piece] }))).toEqual([
      `narratif › objets « ${SCEAU.id} » :: ${DESIGNE} : « ${SCEAU.id} » porte « Exige une créature » : cette référence écarte ${DU_PROJET} les entrées qui le portent.`,
    ]);
  });
});

/**
 * HORS d'un projet, aucun objet du projet n'existe : la feuille OUVERTE d'un document qui ne déclare
 * aucun registre (`document()`, `registresOuverts`) est jugée FERMÉE, par la même co-descente.
 */
describe('feuilles OUVERTES — jugées FERMÉES hors d’un document qui déclare leur registre', () => {
  const EXPOSITION: Exposition = { codex: { keys: ['talents'] }, edit: { dataset: 'talents.json' } };
  const jouet = document('jouet', 'entite', { outil: objetDeSceneSchema }, { outil: { label: 'Outil' } }, EXPOSITION);
  const entree = (outil: string) => [{ id: 'a', type: 'jouet', label: 'A', maison: 'fixture de test', outil }];
  const messages = (outil: string) => (validateDocument(jouet.schema, entree(outil)) ?? []).map((f) => f.message);

  it('une entrée du catalogue est admise', () => {
    expect(messages('dague')).toEqual([]);
  });

  it('un id absent du catalogue est refusé comme par une feuille fermée — aucun registre de projet à consulter', () => {
    expect(messages('babiole-onirique')).toEqual(['« babiole-onirique » est absent du catalogue des objets (trappings.json).']);
  });
});
