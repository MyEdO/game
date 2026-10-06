/**
 * Registre `narratif.documents` et références narratives au parse (#679).
 *
 * Contrats : chaque registre de `REGISTRES_NARRATIFS` participe à l'unicité inter-registres (un id de
 * document pris par N'IMPORTE QUEL autre registre est refusé, nommé) et à l'anti-collision globale ; un
 * document a titre et prose non vides ; un stade d'indice porte sa prose, son document, ou les deux, et
 * son `documentId` résout ; au parse du projet, `document.documentId`, `revealClue.indiceId`/`stade` et
 * `discreditClue.indiceId` résolvent au narratif du document, jusque dans un Flow PORTÉ et dans la carte
 * du monde — la faute NOMME son chemin.
 */
import { describe, it, expect } from 'vitest';
import { projetSchema, SCHEMA_PROJET } from './projet';
import { narratifSchema } from './narratif';
import { REGISTRES_NARRATIFS, type CleDeRegistreNarratif } from './registres-narratifs';
import { cheminLisible, validateDocument } from '../validate';
import { emptyNarratif } from '../../../state/campaignNarratif';

type Jouet = Record<string, unknown>;

const fautes = (valeur: unknown, schema: typeof projetSchema | typeof narratifSchema = projetSchema): string[] =>
  (validateDocument(schema, valeur) ?? []).map((f) => `${cheminLisible(f.lieu)} :: ${f.message}`);

/** Une entrée VALIDE de chaque registre, à l'id donné — son type exige une ligne par registre. */
const ENTREE_DE: { readonly [K in CleDeRegistreNarratif]: (id: string) => Jouet } = {
  affaires: (id) => ({ id, titre: 'Une affaire' }),
  indices: (id) => ({ id, affaireId: 'aff-socle', kind: 'indice', titre: 'Un indice', stades: [{ id: 's1', prose: 'Un indice.' }] }),
  presetsPnj: (id) => ({ id, base: 'gobelin' }),
  objets: (id) => ({ id, label: 'Un objet' }),
  documents: (id) => ({ id, titre: 'Un document', prose: 'Un texte.' }),
};

/** Narratif portant l'affaire socle (à laquelle un indice se rattache) et `over`. */
const narratif = (over: Jouet = {}): Jouet => ({ ...emptyNarratif(), affaires: [ENTREE_DE.affaires('aff-socle')], ...over });

const LETTRE = { id: 'doc-lettre', titre: 'Lettre', prose: '« Au moulin. »' };
const INDICE = { id: 'ind-moulin', affaireId: 'aff-socle', kind: 'indice', titre: 'Le moulin', stades: [{ id: 's1', prose: 'Un moulin.' }, { id: 's2', documentId: 'doc-lettre' }] };

const scene = (over: Jouet = {}): Jouet => ({
  type: 'scene',
  id: 'scene-1',
  label: 'Une salle',
  desc: 'Scène minimale de fixture.',
  dimensions: { w: 4, h: 4 },
  reliefDefaults: { cliff: 'terre', ramp: 'terre', deck: 'pierre', pilier: 'pilier' },
  roofDefaults: { material: 'toit-ardoise', pitchDeg: 45, riseMaxStoreys: 1 },
  ...over,
});

const projet = (over: Jouet = {}): Jouet => ({
  type: 'projet',
  schema: SCHEMA_PROJET,
  id: 'projet-jouet',
  label: 'Projet jouet',
  versionContenu: 1,
  maison: 'fixture de test — aucun livre ne publie ce projet-jouet',
  narratif: narratif({ documents: [LETTRE], indices: [INDICE] }),
  scenes: [scene()],
  ...over,
});

/** Un déclencheur dont le Flow porte `effet` sous un `delayedEffect` (Flow PORTÉ). */
const declencheurPortant = (effet: Jouet): Jouet => ({
  id: 'courrier',
  rect: { x: 0, y: 0, w: 1, h: 1 },
  flow: { kind: 'seq', steps: [{ kind: 'do', effect: { type: 'delayedEffect', afterMinutes: 5, flow: { kind: 'do', effect: effet } } }] },
});

describe('registre `documents` — un registre narratif comme les autres (table unique)', () => {
  it.each(REGISTRES_NARRATIFS.filter((r) => r.cle !== 'documents').map((r) => [r.cle, r.de] as const))(
    'un id de document déjà pris au registre `%s` est refusé, nommé',
    (cle, de) => {
      const doc = narratif({ [cle]: [...((narratif()[cle] as unknown[]) ?? []), ENTREE_DE[cle]('commun')], documents: [ENTREE_DE.documents('commun')] });
      expect(fautes(doc, narratifSchema)).toContain(`documents « commun » › id :: l'id de document « commun » collisionne avec un id ${de}.`);
    },
  );

  it('un id de document qui résout dans la règle globale est refusé, nommé', () => {
    expect(fautes(narratif({ documents: [ENTREE_DE.documents('gobelin')] }), narratifSchema)).toEqual([
      'documents « gobelin » › id :: l\'id de document « gobelin » collisionne avec un id de la règle globale (créature/possession).',
    ]);
  });

  it('titre et prose VIDES sont refusés, nommés', () => {
    expect(fautes(narratif({ documents: [{ id: 'd', titre: '', prose: '' }] }), narratifSchema)).toEqual([
      'documents « d » › titre :: titre vide.',
      'documents « d » › prose :: prose vide.',
    ]);
  });

  it('un narratif valide porteur d’un document et d’un stade qui le croise passe', () => {
    expect(fautes(projet())).toEqual([]);
  });
});

describe('stade d’indice — prose, document, ou les deux', () => {
  it('un stade sans prose ni document est refusé, nommé', () => {
    const doc = narratif({ indices: [{ ...INDICE, stades: [{ id: 's1' }] }], documents: [LETTRE] });
    expect(fautes(doc, narratifSchema)).toEqual(['indices « ind-moulin » › stades « s1 » :: ni prose ni document : un stade en porte au moins un.']);
  });

  it('un `documentId` de stade qui ne résout pas est refusé, nommé', () => {
    const doc = narratif({ indices: [{ ...INDICE, stades: [{ id: 's1', documentId: 'doc-fantome' }] }], documents: [LETTRE] });
    expect(fautes(doc, narratifSchema)).toEqual(['indices « ind-moulin » › stades « s1 » › documentId :: document inconnu « doc-fantome » (narratif.documents).']);
  });
});

describe('références narratives des Effects — résolues au parse du projet', () => {
  it('`document.documentId` inconnu, dans un Flow PORTÉ : refusé à son chemin complet', () => {
    const f = fautes(projet({ scenes: [scene({ triggers: [declencheurPortant({ type: 'document', documentId: 'doc-fantome' })] })] }));
    expect(f).toHaveLength(1);
    expect(f[0]).toMatch(/triggers.*steps.*effect.*flow.*effect.*documentId :: document inconnu « doc-fantome » \(narratif\.documents\)\.$/);
  });

  it('`revealClue.indiceId` inconnu et `stade` inconnu : refusés, nommés', () => {
    const choix = (effect: Jouet) => ({ label: 'Lire', flow: { kind: 'if', cond: { kind: 'flag', expr: 'x' }, then: { kind: 'do', effect } } });
    const dialogue = { id: 'dlg', start: 'n1', nodes: [{ id: 'n1', desc: 'Un meunier.', choices: [
      choix({ type: 'revealClue', indiceId: 'ind-fantome' }),
      choix({ type: 'revealClue', indiceId: 'ind-moulin', stade: 's9' }),
      choix({ type: 'discreditClue', indiceId: 'ind-perdu' }),
    ] }] };
    const f = fautes(projet({ scenes: [scene({ dialogues: [dialogue] })] }));
    expect(f).toHaveLength(3);
    expect(f[0]).toMatch(/choices\.0.*then.*indiceId :: indice inconnu « ind-fantome » \(narratif\.indices\)\.$/);
    expect(f[1]).toMatch(/choices\.1.*then.*stade :: stade inconnu « s9 » de l'indice « ind-moulin »\.$/);
    expect(f[2]).toMatch(/choices\.2.*then.*indiceId :: indice inconnu « ind-perdu » \(narratif\.indices\)\.$/);
  });

  it('dans la carte du monde (péril de route) : refusé, nommé', () => {
    const worldMap = {
      id: 'carte', label: 'Carte',
      places: [{ id: 'a', label: 'A', pos: { x: 0, y: 0 }, scene: 'scene-1' }, { id: 'b', label: 'B', pos: { x: 1, y: 0 }, scene: 'scene-1' }],
      routes: [{ id: 'r', a: 'a', b: 'b', km: 1, modes: ['pied'], perils: [{ label: 'Crieur', chancePct: 5, effects: [{ type: 'document', documentId: 'doc-fantome' }] }] }],
    };
    const f = fautes(projet({ worldMap }));
    expect(f).toHaveLength(1);
    expect(f[0]).toMatch(/worldMap.*perils.*effects.*documentId :: document inconnu « doc-fantome »/);
  });

  it('`documentId` pendant sous une ACTION d’entité (`usable.actions[].flow`) : refusé à son chemin complet', () => {
    const coffre = { id: 'coffre', kind: 'prop', pos: { x: 1, y: 1 }, ref: 'coffre', usable: { actions: [
      { id: 'fouiller', flow: { kind: 'do', effect: { type: 'document', documentId: 'doc-fantome' } } },
    ] } };
    expect(fautes(projet({ scenes: [scene({ entities: [coffre] })] }))).toEqual([
      'scenes « scene-1 » › entities « coffre » › usable › actions « fouiller » › flow.effect.documentId :: document inconnu « doc-fantome » (narratif.documents).',
    ]);
  });

  it('`indiceId` pendant sous l’`onVictory` d’une RENCONTRE : refusé à son chemin complet', () => {
    const embuscade = { id: 'embuscade', onVictory: { kind: 'do', effect: { type: 'revealClue', indiceId: 'ind-fantome' } } };
    expect(fautes(projet({ scenes: [scene({ encounters: [embuscade] })] }))).toEqual([
      'scenes « scene-1 » › encounters « embuscade » › onVictory.effect.indiceId :: indice inconnu « ind-fantome » (narratif.indices).',
    ]);
  });

  it('les mêmes Effects, résolus, passent', () => {
    const f = fautes(projet({ scenes: [scene({ triggers: [
      declencheurPortant({ type: 'document', documentId: 'doc-lettre' }),
    ] })] }));
    expect(f).toEqual([]);
  });
});
