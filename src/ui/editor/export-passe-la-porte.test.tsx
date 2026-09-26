// @vitest-environment jsdom
/**
 * `parseProject` est la porte UNIQUE des documents de projet (#811, #877) : « Exporter JSON »,
 * « Importer JSON… » et « ▶ Tester » la passent comme « Enregistrer ». La modale « Avancé » passe
 * sa propre porte, le schéma des blocs (`SCHEMA_BLOCS_AVANCES` + `formatZodError`, `saveAdvanced`).
 * Mesuré sur le chemin RÉEL : `<Editor>` monté, menu Fichier déroulé, et le Blob que
 * `downloadText` fabrique intercepté.
 *
 * L'état FAUTIF est fabriqué par l'outillage de recette lui-même (`__wfrp.editorPatchEntity`, pont
 * `state/editeurBridge`) : la porte et le helper se prouvent l'un par l'autre, sur un seul chemin.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Editor } from './Editor';
import { buildApi } from '../../state/devtools';
import { parseProject, CURRENT_PROJECT_SCHEMA } from '../../state/worldMap';
import { emptyScene, type Scene } from '../../state/scene';
import { useGame } from '../../state/store';
import { makeShowcaseParty } from '../../data/pregens';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

/** Un type de décor que le catalogue ne porte pas : la faute que la voie de recette sait poser. */
const DECOR_MORT = 'decor-absent-du-catalogue';

/** Une scène SAINE : son unique décor nomme son type (`ref`) — ce que #877 rend REQUIS. */
const sceneSaine = (): Scene => ({
  ...emptyScene(4, 4),
  id: 'scene-export',
  label: 'Salle d’export',
  entities: [{ id: 'p0', kind: 'prop', pos: { x: 1, y: 1 }, label: 'La jetée', ref: 'tonneau' }],
});

let root: Root | null = null;
let container: HTMLElement | null = null;
/** Le brouillon COURANT de l'éditeur, publié par `onSceneChange` — la seule lecture non intrusive de
 *  ce que le geste a écrit (l'état de scène est LOCAL à React, il ne vit pas dans le store). */
let sceneCourante: Scene | null = null;

afterEach(async () => {
  if (root) await act(async () => { root!.unmount(); });
  container?.remove();
  root = null;
  container = null;
  sceneCourante = null;
});

function bouton(label: string): HTMLButtonElement {
  const el = Array.from(container!.querySelectorAll('button')).find((b) => b.textContent?.trim().includes(label));
  if (!el) throw new Error(`bouton introuvable : « ${label} »`);
  return el as HTMLButtonElement;
}

async function monter(scene: Scene): Promise<void> {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  sceneCourante = scene;
  await act(async () => { root!.render(<Editor initialScene={scene} onSceneChange={(s) => { sceneCourante = s; }} />); });
}

/**
 * Joue « Fichier → Exporter JSON » et rend CE QUI PART AU DISQUE : le texte du Blob que
 * `downloadText` fabrique (`''` si RIEN n'a été téléchargé), et le refus affiché s'il y en a un.
 * Surcharges PLATES, restaurées — jamais `vi.mock`/`vi.spyOn` (suite `isolate:false`).
 */
async function exporte(): Promise<{ telecharge: string; refus: string | null }> {
  const OrigBlob = globalThis.Blob;
  const OrigCreateObjectURL = URL.createObjectURL;
  const OrigRevokeObjectURL = URL.revokeObjectURL;
  let telecharge = '';
  class CapturingBlob extends OrigBlob {
    constructor(parts: BlobPart[], opts?: BlobPropertyBag) {
      super(parts, opts);
      // Le seul Blob qui nous regarde est CELUI de l'export (`downloadText`, `application/json`) :
      // le monde volumique de l'éditeur en fabrique d'autres en continu (rastérisation SVG des
      // billboards), et les compter ferait passer le test pour un téléchargement.
      if ((opts?.type ?? 'application/json') === 'application/json') telecharge = parts.map((p) => String(p)).join('');
    }
  }
  (globalThis as unknown as { Blob: unknown }).Blob = CapturingBlob;
  URL.createObjectURL = () => 'blob:fake';
  URL.revokeObjectURL = () => {};
  try {
    await act(async () => { bouton('Fichier').click(); });
    await act(async () => { bouton('Exporter JSON').click(); });
  } finally {
    (globalThis as unknown as { Blob: unknown }).Blob = OrigBlob;
    URL.createObjectURL = OrigCreateObjectURL;
    URL.revokeObjectURL = OrigRevokeObjectURL;
  }
  return { telecharge, refus: container!.querySelector('.modal [role="alert"]')?.textContent ?? null };
}

describe('Éditeur — « Exporter JSON » passe la MÊME porte qu’« Enregistrer » (#877)', () => {
  it('projet SAIN : le fichier téléchargé RE-PARSE par `parseProject`', async () => {
    await monter(sceneSaine());
    const { telecharge, refus } = await exporte();
    expect(refus).toBeNull();
    expect(telecharge.length).toBeGreaterThan(0);
    const relu = parseProject(JSON.parse(telecharge));
    expect(relu.scenes.map((s) => s.id)).toEqual(['scene-export']);
    expect(relu.scenes[0].entities[0].ref).toBe('tonneau');
  });

  it('projet FAUTIF (décor à type MORT) : RIEN n’est téléchargé, et le refus nomme la scène et l’entité', async () => {
    await monter(sceneSaine());
    // L'état fautif se FABRIQUE par la voie de recette, jamais par un document forgé à côté. Un type
    // RETIRÉ ne se fabrique plus (`editEntity` refuse, #1882) : la faute posée est un type absent du catalogue.
    let verdict = '';
    await act(async () => { verdict = await buildApi().editorPatchEntity('p0', { ref: DECOR_MORT }); });
    expect(verdict, 'le helper dit CE qu’il a posé').toContain('posé : ref');

    const { telecharge, refus } = await exporte();
    expect(telecharge, 'aucun téléchargement : `downloadText` n’est pas appelé').toBe('');
    expect(refus).toContain('Export refusé');
    expect(refus, 'et non le verbe de l’enregistrement').not.toContain('Enregistrement refusé');
    expect(refus, 'la CONSÉQUENCE est celle de l’export : un FICHIER, pas le projet enregistré')
      .toContain('ce fichier ne pourrait plus être rouvert');
    expect(refus, 'la scène est nommée').toContain('Salle d’export');
    expect(refus, 'l’entité fautive est nommée').toContain('La jetée');
    expect(refus, 'et la faute est dite').toContain(DECOR_MORT);
  });
});

/**
 * Joue « Fichier → Importer JSON… » sur un contenu donné et rend ce que l'écran MONTRE : le refus
 * affiché, le texte de l'éditeur (pour juger si quelque chose a été chargé), et le compte d'appels à
 * `window.alert` — un refus de l'éditeur ne part JAMAIS à une boîte du navigateur (#877).
 */
async function importe(contenu: string): Promise<{ refus: string | null; scenesChargees: string; boites: number }> {
  const OrigAlert = globalThis.alert;
  let boites = 0;
  (globalThis as unknown as { alert: unknown }).alert = () => { boites += 1; };
  try {
    await act(async () => { bouton('Fichier').click(); });
    const input = container!.querySelector('input[type="file"]') as HTMLInputElement;
    const fichier = new File([contenu], 'projet.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', { value: [fichier], configurable: true });
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  } finally {
    (globalThis as unknown as { alert: unknown }).alert = OrigAlert;
  }
  return {
    refus: container!.querySelector('.modal [role="alert"]')?.textContent ?? null,
    // CE QUI EST CHARGÉ se lit au sélecteur de scènes du projet, jamais au texte de l'écran entier :
    // un refus NOMME la scène fautive, donc son libellé est à l'écran PRÉCISÉMENT quand il est refusé.
    scenesChargees: container!.querySelector('[aria-label="Scène active"]')?.textContent ?? '',
    boites,
  };
}

describe('Éditeur — « Importer JSON… » : DEUX causes de refus, chacune LUE (#877)', () => {
  it('fichier non parsable : le refus dit que ce n’est pas du JSON, rien n’est chargé, aucune boîte du navigateur', async () => {
    await monter(sceneSaine());
    const { refus, scenesChargees, boites } = await importe('{ ceci n’est pas du JSON');
    expect(boites, 'aucun `window.alert`').toBe(0);
    expect(refus).toContain('ce fichier n’est pas du JSON');
    expect(scenesChargees, 'la scène ouverte n’a pas bougé').toContain('Salle d’export');
  });

  it('JSON que la PORTE refuse (décor sans type) : le refus NOMME la scène et l’entité, rien n’est chargé', async () => {
    await monter(sceneSaine());
    const fautif = JSON.stringify({
      type: 'projet', schema: CURRENT_PROJECT_SCHEMA, id: 'proj-fautif', label: 'Campagne fautive',
      versionContenu: 1, maison: 'fixture de test',
      narratif: { affaires: [], indices: [], presetsPnj: [], objets: [] },
      scenes: [{
        ...emptyScene(4, 4), id: 'scene-importee', label: 'Salle importée',
        entities: [{ id: 'p0', kind: 'prop', pos: { x: 1, y: 1 }, label: 'Le ponton' }],
      }],
    });
    const { refus, scenesChargees, boites } = await importe(fautif);
    expect(boites, 'aucun `window.alert`').toBe(0);
    expect(refus).toContain('Import refusé');
    expect(refus, 'rien n’a jamais été ouvert ni écrit : la conséquence le DIT')
      .toContain('ce fichier ne peut pas être ouvert');
    expect(refus, 'le fragment de localisation est INTRODUIT, jamais recollé nu après le point')
      .toContain('. Faute : scène');
    expect(refus, 'la scène est nommée').toContain('Salle importée');
    expect(refus, 'l’entité fautive est nommée').toContain('Le ponton');
    expect(refus, 'et la règle enfreinte est dite').toContain('« ref » absente');
    expect(scenesChargees, 'rien du document refusé n’est chargé').not.toContain('Salle importée');
    expect(scenesChargees, 'la scène ouverte est intacte').toContain('Salle d’export');
  });

  it.each([
    ['scènes nulles', { schema: 2, id: 'x', label: 'X', versionContenu: 1, scenes: [null] }],
    ['scène en chaîne', { schema: 2, id: 'x', label: 'X', scenes: ['a'] }],
  ])('JSON que la MIGRATION ne traverse pas (%s) : le refus se LIT, jamais un rejet muet', async (_nom, doc) => {
    await monter(sceneSaine());
    const { refus, scenesChargees } = await importe(JSON.stringify(doc));
    expect(refus).toContain('Import refusé : ce fichier ne peut pas être ouvert. Ce document n’est pas un projet lisible.');
    expect(refus, 'le rapport de la porte reste consultable en détail').toContain('Projet invalide : document mal formé');
    expect(scenesChargees).toContain('Salle d’export');
  });

  it('document SAIN : il charge, et aucun refus ne s’affiche', async () => {
    await monter(sceneSaine());
    const sain = JSON.stringify({
      type: 'projet', schema: CURRENT_PROJECT_SCHEMA, id: 'proj-sain', label: 'Campagne saine',
      versionContenu: 1, maison: 'fixture de test',
      narratif: { affaires: [], indices: [], presetsPnj: [], objets: [] },
      scenes: [{ ...emptyScene(4, 4), id: 'scene-importee', label: 'Salle importée', entities: [] }],
    });
    const { refus, scenesChargees } = await importe(sain);
    expect(refus).toBeNull();
    expect(scenesChargees).toContain('Salle importée');
  });
});

/** Joue « Fichier → ▶ Tester » (mise à l'essai en JEU) et rend le refus affiché + l'écran atteint. */
async function metALEssai(): Promise<{ refus: string | null; titre: string | null; ecran: string }> {
  await act(async () => { bouton('Tester').click(); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return {
    refus: container!.querySelector('.modal [role="alert"]')?.textContent ?? null,
    titre: container!.querySelector('.modal h3')?.textContent ?? null,
    ecran: useGame.getState().screen,
  };
}

describe('Éditeur — « ▶ Tester » passe la MÊME porte que les autres sorties (#877)', () => {
  it('groupe VIDE : refus titré, l’écran reste l’éditeur', async () => {
    useGame.getState().setParty([]);
    await monter(sceneSaine());
    const { refus, titre, ecran } = await metALEssai();
    expect(titre).toBe('Tester la scène');
    expect(refus).toContain('aucun aventurier au groupe');
    // Le banc monte `<Editor>` seul : l'écran du store n'est pas `editor`. Ce qui se mesure est
    // qu'il n'a PAS basculé en jeu — c'est `setScreen('campaign')` que le refus doit empêcher.
    expect(ecran, 'rien n’est chargé en jeu').not.toBe('campaign');
  });

  it('projet FAUTIF avec un groupe : le refus NOMME scène et entité, l’écran reste l’éditeur', async () => {
    useGame.getState().setParty(makeShowcaseParty());
    await monter(sceneSaine());
    await act(async () => { await buildApi().editorPatchEntity('p0', { ref: DECOR_MORT }); });
    const { refus, titre, ecran } = await metALEssai();
    expect(titre).toBe('Tester la scène');
    expect(refus).toContain('Mise à l’essai refusée');
    expect(refus).toContain('ce projet ne pourrait pas être joué');
    expect(refus, 'la scène est nommée').toContain('Salle d’export');
    expect(refus, 'l’entité fautive est nommée').toContain('La jetée');
    expect(ecran, 'aucun monde à moitié cuit').not.toBe('campaign');
  });
});

/** Ouvre « Avancé — JSON » sur un texte donné, clique « Appliquer », et rend le refus + la scène. */
async function appliqueAvance(texte: string): Promise<{ refus: string | null; scene: Scene }> {
  await act(async () => { bouton('Fichier').click(); });
  await act(async () => { bouton('Avancé').click(); });
  const zone = container!.querySelector('textarea.json-editor') as HTMLTextAreaElement;
  const poser = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
  await act(async () => {
    poser.call(zone, texte);
    zone.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => { bouton('Appliquer').click(); });
  const lues = await buildApi().editorEntities();
  void lues; // force un aller-retour par le pont : la commande publiée ferme sur le rendu COURANT
  return {
    refus: container!.querySelector('.modal [role="alert"]')?.textContent ?? null,
    scene: sceneCourante!,
  };
}

describe('Éditeur — modale « Avancé » : ce qu’on colle passe le SCHÉMA des blocs (#877)', () => {
  it('`{"dialogues": 42}` : refusé en nommant le chemin, la scène reste INTACTE', async () => {
    await monter(sceneSaine());
    const avant = sceneCourante!;
    const { refus, scene } = await appliqueAvance('{"dialogues": 42}');
    expect(refus).toContain('dialogues');
    expect(scene, 'aucune écriture dans la scène').toEqual(avant);
  });

  it('texte non parsable : le refus dit que ce n’est pas du JSON, et le message du moteur JS n’y est PAS', async () => {
    await monter(sceneSaine());
    const avant = sceneCourante!;
    const { refus, scene } = await appliqueAvance('{ pas du JSON');
    expect(refus).toContain('Ce texte n’est pas du JSON');
    expect(refus, 'aucun anglais du moteur').not.toMatch(/Unexpected|Expected|token|JSON\.parse/);
    expect(scene).toEqual(avant);
  });

  it('JSON SANS `triggers` : les triggers de la scène sont CONSERVÉS, les dialogues remplacés', async () => {
    const avecTriggers: Scene = {
      ...sceneSaine(),
      triggers: [{ id: 't0', rect: { x: 0, y: 0, w: 1, h: 1 }, flow: { kind: 'seq', steps: [] } }],
    };
    await monter(avecTriggers);
    const { refus, scene } = await appliqueAvance('{"dialogues": []}');
    expect(refus).toBeNull();
    expect(scene.triggers?.map((t) => t.id), 'clé absente = bloc INTACT').toEqual(['t0']);
    expect(scene.dialogues, 'clé présente = bloc remplacé').toEqual([]);
  });
});

describe('__wfrp.editorPatchEntity — SETUP de recette par le pont d’INTENTION (#877)', () => {
  it('pose une clé, en retire une autre, et le DOCUMENT exporté le porte', async () => {
    await monter(sceneSaine());
    let verdict = '';
    await act(async () => { verdict = await buildApi().editorPatchEntity('p0', { ref: 'caisse', label: undefined }); });
    expect(verdict).toContain('✓');
    expect(verdict).toContain('posé : ref');
    expect(verdict).toContain('retiré : label');

    const { telecharge, refus } = await exporte();
    expect(refus, 'une entité sans `label` reste valide : rien ne doit être refusé').toBeNull();
    const entite = parseProject(JSON.parse(telecharge)).scenes[0].entities[0];
    expect(entite.ref).toBe('caisse');
    expect('label' in entite, 'la clé est ABSENTE du document, pas posée à `undefined`').toBe(false);
  });

  it('clé d’IDENTITÉ (`id`, `kind`) : refus NOMMÉ, et la scène n’est pas touchée', async () => {
    await monter(sceneSaine());
    const avant = sceneCourante!;
    let verdict = '';
    await act(async () => { verdict = await buildApi().editorPatchEntity('p0', { id: 'p9', ref: 'caisse' }); });
    expect(verdict, 'jamais un « ✓ posé : id » qui annoncerait une scène corrompue').toContain('✗');
    expect(verdict).toContain('IDENTITÉ');
    expect(verdict).toContain('id');
    expect(sceneCourante, 'refus = AUCUNE écriture, pas même la partie légitime du patch').toEqual(avant);

    await act(async () => { verdict = await buildApi().editorPatchEntity('p0', { kind: 'personnage' }); });
    expect(verdict).toContain('✗');
    expect(verdict).toContain('kind');
  });

  it('retirer le type d’une entité : refus NOMMÉ à la porte de patch, et la scène n’est pas touchée (#1882)', async () => {
    await monter(sceneSaine());
    const avant = sceneCourante!;
    let verdict = '';
    await act(async () => { verdict = await buildApi().editorPatchEntity('p0', { ref: undefined }); });
    expect(verdict).toContain('✗');
    expect(verdict).toContain('décor « p0 » : « ref » absente');
    expect(sceneCourante).toEqual(avant);
  });

  it('entité inconnue : refus NOMMÉ, portant les ids de la scène', async () => {
    await monter(sceneSaine());
    let verdict = '';
    await act(async () => { verdict = await buildApi().editorPatchEntity('p-fantome', { ref: 'caisse' }); });
    expect(verdict).toContain('✗');
    expect(verdict).toContain('p-fantome');
    expect(verdict, 'les ids ouvrables sont rendus').toContain('p0');
  });
});
