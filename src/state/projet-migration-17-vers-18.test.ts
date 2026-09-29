/**
 * GARDE — `PROJECT_MIGRATIONS[17]` (#679) : un projet AUTHORÉ AVANT le registre `narratif.documents`
 * se charge encore, ses Effects `document` EN LIGNE soulevés au registre de SON document.
 *
 * QUESTION : un `.json` de bibliothèque utilisateur au format 17, dont des Effects `{ type: 'document',
 * title, desc }` vivent à toute profondeur (choix de dialogue sous un `if`, Flow PORTÉ par un
 * `delayedEffect`, péril de route de la carte du monde), ressort-il avec chaque texte au registre, à un
 * id UNIQUE — deux titres identiques, un id déjà pris par une affaire — et chaque Effect par `documentId` ?
 *
 * FIXTURE GELÉE : le document ci-dessous porte la forme `schema: 17`. Il est FIGÉ ; le « moderniser »
 * détruirait ce que la garde mesure.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseProject, migreSceneDeProjet, ProjetRefuse, CURRENT_PROJECT_SCHEMA, PROJECT_MIGRATIONS } from './worldMap';
import { DEFAULT_RELIEF_DEFAULTS, DEFAULT_ROOF_DEFAULTS } from './scene';
import { autosaveLoad, __resetAutosaveForTest } from './editorAutosave';
import { __setOuvertureIdbForTest } from '../lib/indexedDb';
import { brancherBasesSimulees } from '../lib/indexedDb.testkit';
import { souleveLesDocuments, idDeDocumentSouleve } from '../data/documentsAuNarratif';
import { depot, efface, joue, lireDans, rienTouche } from '../../scripts/migrations/lib/joue.mjs';

const INTUITION_PERCEE = { type: 'document', title: 'Votre intuition', desc: 'Un éclair de calcul froid passe dans son regard.' };
const INTUITION_MUETTE = { type: 'document', title: 'Votre intuition', desc: 'Rien ne transparaît.' };
const LETTRE = { type: 'document', title: 'Lettre cachetée', desc: '« Rendez-vous au moulin. »' };
const AFFICHE = { type: 'document', title: 'Affiche de la foire', desc: 'Grande foire d’Ubersreik, le jour de Marktag.' };

/** Scène au format 17 portant trois Effects en ligne : deux sous un `if` de choix de dialogue, un dans
 *  le Flow PORTÉ d'un `delayedEffect` de déclencheur. */
const sceneFormat17 = () => ({
  type: 'scene',
  id: 'auberge',
  label: 'L’auberge',
  dimensions: { w: 2, h: 2 },
  reliefDefaults: { ...DEFAULT_RELIEF_DEFAULTS },
  roofDefaults: { ...DEFAULT_ROOF_DEFAULTS },
  layers: [{ z: 0, tiles: ['plancher', 'plancher', 'plancher', 'plancher'] }],
  dialogues: [{
    id: 'dlg',
    start: 'n1',
    nodes: [{
      id: 'n1',
      desc: 'Dame Kramer vous toise.',
      choices: [{
        label: 'L’observer',
        flow: { kind: 'if', cond: { kind: 'flag', expr: 'kramer_vue' }, then: { kind: 'do', effect: INTUITION_PERCEE }, else: { kind: 'do', effect: INTUITION_MUETTE } },
      }],
    }],
  }],
  triggers: [{
    id: 'courrier',
    rect: { x: 0, y: 0, w: 1, h: 1 },
    flow: { kind: 'do', effect: { type: 'delayedEffect', afterMinutes: 10, flow: { kind: 'do', effect: LETTRE } } },
  }],
});

/** Document schema 17 — FIGÉ. Une affaire porte déjà l'id que la règle donnerait au premier document. */
const PROJET_FORMAT_17 = {
  type: 'projet',
  schema: 17,
  id: 'campagne-gelee-17',
  label: 'Campagne gelée (format 17)',
  versionContenu: 1,
  maison: 'fixture de test — aucun livre ne la publie',
  narratif: { affaires: [{ id: 'document-votre-intuition', titre: 'Une affaire au nom déjà pris' }], indices: [], presetsPnj: [], objets: [] },
  scenes: [sceneFormat17()],
  worldMap: {
    id: 'carte',
    label: 'La carte',
    places: [
      { id: 'bourg', label: 'Le bourg', pos: { x: 0, y: 0 }, scene: 'auberge' },
      { id: 'foire', label: 'La foire', pos: { x: 10, y: 0 }, scene: 'auberge' },
    ],
    routes: [{ id: 'route', a: 'bourg', b: 'foire', km: 5, modes: ['pied'], perils: [{ label: 'Crieur', chancePct: 10, effects: [AFFICHE] }] }],
  },
};

const charge = () => parseProject(structuredClone(PROJET_FORMAT_17));

describe('PROJECT_MIGRATIONS[17] — les documents en ligne passent au registre (#679)', () => {
  it('le document gelé est bien au format ANTÉRIEUR (sans quoi la garde ne mesurerait rien)', () => {
    expect(PROJET_FORMAT_17.schema).toBe(17);
    expect(PROJET_FORMAT_17.schema).toBeLessThan(CURRENT_PROJECT_SCHEMA);
  });

  it('chaque texte entre au registre, dans l’ordre du document, à un id UNIQUE (titres identiques, id déjà pris)', () => {
    expect(charge().narratif.documents).toEqual([
      { id: 'document-votre-intuition-2', titre: 'Votre intuition', prose: INTUITION_PERCEE.desc },
      { id: 'document-votre-intuition-3', titre: 'Votre intuition', prose: INTUITION_MUETTE.desc },
      { id: 'document-lettre-cachetee', titre: 'Lettre cachetée', prose: LETTRE.desc },
      { id: 'document-affiche-de-la-foire', titre: 'Affiche de la foire', prose: AFFICHE.desc },
    ]);
  });

  it('chaque Effect désigne son entrée par `documentId`, où qu’il soit niché', () => {
    const doc = charge();
    const [scene] = doc.scenes;
    expect(scene.dialogues[0].nodes[0].choices[0].flow).toEqual({
      kind: 'if', cond: { kind: 'flag', expr: 'kramer_vue' },
      then: { kind: 'do', effect: { type: 'document', documentId: 'document-votre-intuition-2' } },
      else: { kind: 'do', effect: { type: 'document', documentId: 'document-votre-intuition-3' } },
    });
    expect(scene.triggers[0].flow).toEqual({
      kind: 'do', effect: { type: 'delayedEffect', afterMinutes: 10, flow: { kind: 'do', effect: { type: 'document', documentId: 'document-lettre-cachetee' } } },
    });
    expect(doc.worldMap!.routes[0].perils![0].effects).toEqual([{ type: 'document', documentId: 'document-affiche-de-la-foire' }]);
  });

  it('SANS le migrateur, l’Effect en ligne serait REFUSÉ au parse', () => {
    const bricole = { ...structuredClone(PROJET_FORMAT_17), schema: CURRENT_PROJECT_SCHEMA };
    expect(() => parseProject(bricole)).toThrow(/title/);
  });

  it('un projet SANS Effect en ligne ressort INCHANGÉ, hormis `narratif.documents: []`', () => {
    const { dialogues: _d, triggers: _t, ...sceneMuette } = sceneFormat17();
    const sans = { ...structuredClone(PROJET_FORMAT_17), scenes: [sceneMuette], worldMap: undefined };
    const { version: _v, schema, narratif, ...reste } = PROJECT_MIGRATIONS[17]!({ ...structuredClone(sans), version: 17 } as never) as Record<string, unknown>;
    const { schema: _s, narratif: narratifAvant, ...resteAvant } = sans;
    expect(schema).toBe(18);
    expect(reste).toEqual(resteAvant);
    expect(narratif).toEqual({ ...narratifAvant, documents: [] });
  });

  it('la règle d’id évite aussi la règle GLOBALE (prédicat de l’appelant)', () => {
    const global = new Set(['document-lettre-cachetee']);
    expect(idDeDocumentSouleve('Lettre cachetée', (id) => global.has(id))).toBe('document-lettre-cachetee-2');
    const monte = souleveLesDocuments(structuredClone(PROJET_FORMAT_17), (id) => global.has(id)) as { narratif: { documents: { id: string }[] } };
    expect(monte.narratif.documents.map((d) => d.id)).toContain('document-lettre-cachetee-2');
  });
});

describe('scène d’autosave dont la montée soulèverait un document — REFUSÉE nommément (#679)', () => {
  const NOM = 'wfrp4-editor-autosave';
  let bases: ReturnType<typeof brancherBasesSimulees>;
  beforeEach(async () => {
    bases = brancherBasesSimulees();
    bases.amorcer(NOM, 1, { autosave: { keyPath: 'sceneId' } });
    await __resetAutosaveForTest();
  });
  afterEach(() => __setOuvertureIdbForTest(null));

  it('la porte de scène lève un `ProjetRefuse` qui nomme les Effects à soulever', () => {
    let refus: unknown;
    try { migreSceneDeProjet(sceneFormat17(), 17); } catch (e) { refus = e; }
    expect(refus).toBeInstanceOf(ProjetRefuse);
    expect((refus as ProjetRefuse).cause).toBe('mal-forme');
    expect((refus as ProjetRefuse).message).toMatch(/3 Effect\(s\) « document » en ligne/);
    expect((refus as ProjetRefuse).message).toContain('scenes.0.triggers.0.flow.effect.flow.effect');
  });

  it('la reprise locale rend `{ ok: false }`, jamais une scène tronquée', async () => {
    bases.contenu(NOM, 'autosave').set('auberge', { sceneId: 'auberge', scene: sceneFormat17(), savedAt: 1, schema: 17 });
    const lu = await autosaveLoad('auberge');
    expect(lu?.ok).toBe(false);
  });

  it('une scène SANS document en ligne se reprend (le refus ne vise que le soulèvement)', async () => {
    const { dialogues: _d, triggers: _t, ...sceneMuette } = sceneFormat17();
    bases.contenu(NOM, 'autosave').set('auberge', { sceneId: 'auberge', scene: sceneMuette, savedAt: 1, schema: 17 });
    expect((await autosaveLoad('auberge'))?.ok).toBe(true);
  });
});

/**
 * PARITÉ des DEUX pendants du même bump : la MÊME fixture est jouée par le script de DÉPÔT
 * (`scripts/migrations/2026-09-29-679-documents-au-narratif.mjs`, dans un dépôt jetable) et par le
 * CHARGEMENT (`PROJECT_MIGRATIONS[17]`). Le script écrit EXACTEMENT ce que le chargement rend.
 */
const SCRIPT_DEPOT = '2026-09-29-679-documents-au-narratif.mjs';
const REL = `src/scenes/${PROJET_FORMAT_17.id}/${PROJET_FORMAT_17.id}-projet.json`;
const canonique = (doc: unknown) => `${JSON.stringify(doc, null, 1)}\n`;
/** Les entrées du script : la primitive et sa dépendance, les catalogues de la règle globale. */
const ENTREES = ['src/data/documentsAuNarratif.ts', 'src/data/slug.ts', 'src/data/creatures.json', 'src/data/trappings.json'];

function parLeDepot(doc: unknown): { code: number | null; sortie: string; doc: unknown; touches: string[] } {
  const d = depot({ [REL]: canonique(doc) }, ENTREES);
  try {
    const r = joue(d.racine, SCRIPT_DEPOT);
    return {
      code: r.code,
      sortie: r.sortie,
      doc: r.code === 0 ? JSON.parse(lireDans(d.racine, REL)) : null,
      touches: r.code === 0 ? [] : rienTouche(d.racine, d.avant),
    };
  } finally {
    efface(d.racine);
  }
}

function parLeChargement(doc: unknown): unknown {
  const { version: _travail, ...migre } = PROJECT_MIGRATIONS[17]!({ ...structuredClone(doc as object), version: 17 } as never) as Record<string, unknown>;
  return migre;
}

describe('PARITÉ dépôt ⇄ chargement du bump 17 → 18 — une fixture, deux pendants (#679)', () => {
  it('le script écrit EXACTEMENT ce que le chargement rend, et `parseProject` accepte ce qu’il écrit', () => {
    const r = parLeDepot(PROJET_FORMAT_17);
    expect(r.code, r.sortie).toBe(0);
    expect(JSON.stringify(r.doc)).toBe(JSON.stringify(parLeChargement(PROJET_FORMAT_17)));
    expect(() => parseProject(r.doc)).not.toThrow();
  });

  it('rejoué sur ce qu’il a écrit, le script n’écrit plus rien', () => {
    const premier = parLeDepot(PROJET_FORMAT_17);
    const second = parLeDepot(premier.doc);
    expect(second.code, second.sortie).toBe(0);
    expect(JSON.stringify(second.doc)).toBe(JSON.stringify(premier.doc));
  });

  it('schema 16 : le script le refuse (sa borne basse), rien d’écrit', () => {
    const r = parLeDepot({ ...structuredClone(PROJET_FORMAT_17), schema: 16 });
    expect(r.code, r.sortie).toBe(1);
    expect(r.sortie).toMatch(/ARBITRAGE REQUIS/);
    expect(r.sortie).toContain('`schema` inattendu 16');
    expect(r.touches).toEqual([]);
  });
});
