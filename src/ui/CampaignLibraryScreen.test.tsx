// @vitest-environment jsdom
/** #766 lot C : la bibliothèque de campagnes (menu principal) — liste les campagnes du jeu + la
 *  bibliothèque locale, importe un projet portable (JSON → `SavedProject` publié), en supprime un
 *  (local seulement). Contrats POSITIFS. */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CampaignLibraryScreen, buildImportedProject, importDecision, playerImportError, PlayerFacingImportError } from './CampaignLibraryScreen';
import { allBuiltinCampaigns, paquetDuJeu } from '../scenes/campaign';
import { CURRENT_PROJECT_SCHEMA, ProjetRefuse } from '../state/worldMap';
import {
  projectSave,
  projectsLoad,
  publishedProjects,
  __resetLibraryForTest,
  type SavedProject,
} from '../state/projectLibrary';
import { __setOuvertureIdbForTest } from '../lib/indexedDb';
import { brancherBasesSimulees, type PanneSimulee } from '../lib/indexedDb.testkit';
import { emptyScene, type Scene } from '../state/scene';
import { useGame } from '../state/store';
import { datasetArray, setDataset } from '../data/overrides';
import { emptyNarratif } from '../state/campaignNarratif';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
beforeEach(async () => {
  await __resetLibraryForTest();
});

/** Branche la bibliothèque IndexedDB sur une base simulée en `panne`. */
function brancherBibliotheque(panne: PanneSimulee): void {
  brancherBasesSimulees().base('wfrp4-library').panne = panne;
}

/** Document de projet PORTABLE valide au format ANTÉRIEUR (schema 3), construit depuis une
 *  campagne du jeu : l'import le fait traverser TOUTE la chaîne de migration (3→7). Son identité
 *  vit dans la poche `meta` — la forme qu'un document de ce schéma portait — et elle est REQUISE
 *  depuis #1552 : la migration n'en invente pas, un paquet anonyme se fait refuser à la porte. */
function builtinDocJson(idx = 0): string {
  const bc = paquetDuJeu(allBuiltinCampaigns[idx]);
  return JSON.stringify({
    schema: 3,
    meta: { id: bc.id, label: bc.label, icon: bc.icon, version: 1 },
    maison: 'fixture de test — copie d’une campagne du jeu, aucun folio à citer',
    scenes: bc.scenes,
    ...(bc.worldMap ? { worldMap: bc.worldMap } : {}),
    narratif: bc.narratif,
  });
}

describe('buildImportedProject — import portable (#766)', () => {
  it('construit un SavedProject publié à partir d’un document de projet valide', () => {
    const entry = buildImportedProject(builtinDocJson(0));
    expect(entry.published).toBe(true);
    expect(entry.project.schema).toBe(CURRENT_PROJECT_SCHEMA);
    expect(entry.project.scenes.length).toBe(allBuiltinCampaigns[0].paquet.scenes.length);
    expect(entry.startSceneId).toBe(entry.project.scenes[0].id);
    expect(entry.id).toBeTruthy();
    expect(entry.label).toBeTruthy();
  });

  it('ROUND-TRIP : `activeAxes` SURVIT à l’import puis au ré-export (#409, #1467 L1b)', () => {
    // Le document PORTABLE porte ses axes actifs. Ils traversent `parseProject` — qui les rend
    // nommément — et doivent être RECONDUITS au `SavedProject` : sinon une campagne importée perd
    // ses axes en silence, et son ré-export les perd pour de bon.
    const bc = paquetDuJeu(allBuiltinCampaigns[0]);
    const axes = ['negoce', 'navigation'];
    const doc = JSON.stringify({
      type: 'projet',
      schema: CURRENT_PROJECT_SCHEMA,
      id: 'axes-fixture',
      label: 'Campagne à axes',
      versionContenu: 1,
      maison: 'fixture de test — aucun folio à citer',
      scenes: bc.scenes,
      ...(bc.worldMap ? { worldMap: bc.worldMap } : {}),
      activeAxes: axes,
      narratif: bc.narratif,
    });

    const entry = buildImportedProject(doc);
    expect(entry.project.activeAxes, 'axes PERDUS à l’import').toEqual(axes);

    // Second tour : ce qui a été stocké se relit encore avec ses axes.
    const relu = buildImportedProject(JSON.stringify(entry.project));
    expect(relu.project.activeAxes, 'axes PERDUS au ré-export').toEqual(axes);
  });

  it('l’entrée porte l’identité DU DOCUMENT — et un document ANONYME est REFUSÉ (#1552)', () => {
    // L'entrée reprend l'identité DU DOCUMENT (#1552 — l'invariant et le verbatim qui le fonde sont
    // au contrat du schéma, `src/data/schemas/defs-scenes/projet-schema.test.ts` cas (d bis)) ; un
    // document anonyme est refusé à la porte, l'import ne fabrique aucun nom.
    const entry = buildImportedProject(builtinDocJson(0));
    expect(entry.id).toBe(allBuiltinCampaigns[0].id);
    expect(entry.label).toBe(allBuiltinCampaigns[0].label);

    const anonyme = JSON.parse(builtinDocJson(0));
    delete anonyme.meta;
    expect(() => buildImportedProject(JSON.stringify(anonyme))).toThrow(/id/);
  });

  it('lève un message clair (pas de crash) sur JSON illisible', () => {
    expect(() => buildImportedProject('{ pas du json')).toThrow(/JSON/i);
  });

  it('lève sur un projet structurellement invalide (validation parseProject)', () => {
    expect(() => buildImportedProject(JSON.stringify({ schema: 999 }))).toThrow();
  });

  it('un import enregistré alimente la bibliothèque ET les projets publiés', () => {
    const entry = buildImportedProject(builtinDocJson(0));
    projectSave(entry);
    expect(projectsLoad().some((p) => p.id === entry.id)).toBe(true);
    expect(publishedProjects().some((p) => p.id === entry.id)).toBe(true);
  });
});

describe('importDecision — remplacement PROPOSÉ jamais silencieux (#766 lot C)', () => {
  function withVersion(entry: ReturnType<typeof buildImportedProject>, version: number) {
    return { ...entry, project: { ...entry.project, id: entry.id, label: entry.label, versionContenu: version } };
  }

  it('aucun existant de même id → \'new\' (import direct)', () => {
    const entry = buildImportedProject(builtinDocJson(0));
    expect(importDecision(entry, undefined)).toBe('new');
  });

  it('même id, version importée SUPÉRIEURE → \'replace-newer\'', () => {
    const base = buildImportedProject(builtinDocJson(0));
    const existing = withVersion(base, 1);
    const incoming = withVersion(base, 2);
    expect(importDecision(incoming, existing)).toBe('replace-newer');
  });

  it('même id, version importée ÉGALE → \'replace-older-or-equal\'', () => {
    const base = buildImportedProject(builtinDocJson(0));
    const existing = withVersion(base, 3);
    const incoming = withVersion(base, 3);
    expect(importDecision(incoming, existing)).toBe('replace-older-or-equal');
  });

  it('même id, version importée INFÉRIEURE → \'replace-older-or-equal\'', () => {
    const base = buildImportedProject(builtinDocJson(0));
    const existing = withVersion(base, 5);
    const incoming = withVersion(base, 1);
    expect(importDecision(incoming, existing)).toBe('replace-older-or-equal');
  });
});

describe('CampaignLibraryScreen — rendu (#766)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  async function mount() {
    await act(async () => {
      root.render(<CampaignLibraryScreen onClose={() => {}} />);
    });
  }
  async function unmount() {
    if (!container.isConnected) return;
    await act(async () => root.unmount());
    container.remove();
  }
  afterEach(unmount);

  it('liste les campagnes du jeu et les entrées de la bibliothèque locale', async () => {
    const entry = buildImportedProject(builtinDocJson(0));
    entry.label = 'Ma copie de test';
    entry.id = 'lib-fixture-1';
    projectSave(entry);

    await mount();
    const txt = container.textContent ?? '';
    for (const bc of allBuiltinCampaigns) expect(txt).toContain(bc.label);
    expect(txt).toContain('Ma copie de test');
    await unmount();
  });

  it('une entrée SANS NOM se rend « (sans nom) », jamais une rangée muette', async () => {
    // Recette #1552 : une entrée dont le libellé manque (stock d'avant, entrée fabriquée hors
    // éditeur) s'affichait vide — la rangée n'était plus désignable. Le repli est celui de
    // `nomDeProjet`, partagé avec la modale « Ouvrir » de l'éditeur.
    const entry = buildImportedProject(builtinDocJson(0));
    entry.label = '';
    entry.id = 'lib-fixture-anonyme';
    projectSave(entry);

    await mount();
    expect(container.textContent ?? '').toContain('(sans nom)');
    await unmount();
  });

  it.each([
    ['Jouer', /ne peut pas être jouée en l’état/],
    ['Exporter', /ne peut pas être exportée en l’état/],
  ] as const)('« %s » une entrée que la porte REFUSE : message JOUEUR du GESTE AU PANNEAU DE DÉTAIL, effacé au changement de sélection', async (geste, message) => {
    const entry = buildImportedProject(builtinDocJson(0));
    entry.id = 'lib-fixture-refusee';
    entry.label = 'Campagne refusée';
    entry.project = { ...entry.project, schema: 999 as typeof CURRENT_PROJECT_SCHEMA };
    projectSave(entry);
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onClose = vi.fn();

    await act(async () => {
      root.render(<CampaignLibraryScreen onClose={onClose} />);
    });
    const row = Array.from(container.querySelectorAll('button.listrow')).find((el) => el.textContent?.includes('Campagne refusée')) as HTMLButtonElement;
    await act(async () => row.click());
    const bouton = Array.from(container.querySelectorAll('.row[data-justify="end"] button')).find((el) => el.textContent === geste) as HTMLButtonElement;
    await act(async () => bouton.click());

    const alertes = container.querySelectorAll('[role="alert"]');
    expect(alertes).toHaveLength(1);
    const alerte = alertes[0];
    expect(alerte.closest('.master-detail-list'), 'jamais au rail de la liste').toBeNull();
    expect(bouton.closest('.row[data-justify="end"]')!.parentElement!.contains(alerte), 'près des boutons de l’entrée').toBe(true);
    expect(alerte.classList.contains('chip') && alerte.classList.contains('tone-danger')).toBe(true);
    const txt = alerte.textContent ?? '';
    expect(txt).toMatch(message);
    expect(txt).toMatch(/Demandez-en une nouvelle version à son auteur\./);
    expect(txt.toLowerCase()).not.toMatch(/schema|migration/);
    expect(consoleErr).toHaveBeenCalled();
    expect(onClose, 'l’écran reste ouvert').not.toHaveBeenCalled();

    const autre = Array.from(container.querySelectorAll('button.listrow')).find((el) => el.textContent?.includes(allBuiltinCampaigns[0].label)) as HTMLButtonElement;
    await act(async () => autre.click());
    expect(container.querySelector('[role="alert"]'), 'effacé au changement de sélection').toBeNull();

    consoleErr.mockRestore();
    await unmount();
  });

  /** Clique la rangée nommée `nom` puis le bouton `geste` de son panneau de détail. */
  async function clique(nom: string, geste: string) {
    const row = Array.from(container.querySelectorAll('button.listrow')).find((el) => el.textContent?.includes(nom)) as HTMLButtonElement;
    await act(async () => row.click());
    const bouton = Array.from(container.querySelectorAll('.row[data-justify="end"] button')).find((el) => el.textContent === geste) as HTMLButtonElement;
    await act(async () => bouton.click());
  }

  it('« Jouer » une entrée d’AVANT #1552 (document sans identité) : elle SE JOUE, sans refus — même lecture que l’éditeur (#1343)', async () => {
    const { type: _muette, ...sceneMuette } = { ...emptyScene(4, 4), id: 'scene-ancienne', label: 'Salle ancienne' };
    const ancienne = {
      id: 'proj-ancien', label: 'Campagne d’avant', startSceneId: 'scene-ancienne', savedAt: 1, published: true,
      project: { schema: 6, scenes: [sceneMuette as Scene], narratif: emptyNarratif() },
    } as SavedProject;
    await projectSave(ancienne);
    useGame.setState({ pendingCampaign: null } as never);
    const onClose = vi.fn();

    await act(async () => {
      root.render(<CampaignLibraryScreen onClose={onClose} />);
    });
    await clique('Campagne d’avant', 'Jouer');

    expect(container.querySelector('[role="alert"]'), 'aucun refus').toBeNull();
    expect(onClose).toHaveBeenCalled();
    const pc = useGame.getState().pendingCampaign;
    expect(pc?.id).toBe('proj-ancien');
    expect(pc?.scenes.map((s) => s.id)).toEqual(['scene-ancienne']);
    await unmount();
  });

  it('un id renommé au Codex (#1692) : l’écran reste debout, et « Jouer » d’une campagne du jeu qui le référence refuse par la voie des projets', async () => {
    const avant = [...datasetArray('props')];
    const campagne = allBuiltinCampaigns.find((bc) => JSON.stringify(bc.paquet).includes('"ref":"tonneau"'));
    expect(campagne, 'une campagne du jeu référence le décor `tonneau`').toBeDefined();
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    setDataset('props', avant.map((p) => (p.id === 'tonneau' ? { ...p, id: 'tonneau-renomme' } : p)));
    try {
      useGame.setState({ pendingCampaign: null, scene: null });
      await mount();
      for (const bc of allBuiltinCampaigns) expect(container.textContent).toContain(bc.label);
      await clique(campagne!.label, 'Jouer');
      expect(container.querySelector('[role="alert"]')?.textContent).toBe(
        'Cette campagne ne peut pas être jouée en l’état. Demandez-en une nouvelle version à son auteur.',
      );
      expect(useGame.getState().pendingCampaign, 'aucune campagne posée').toBeNull();
      expect(useGame.getState().scene, 'aucune scène posée').toBeNull();
    } finally {
      setDataset('props', avant);
      consoleErr.mockRestore();
    }
  });

  it('« Jouer » une entrée au départ INCONNU : le message dit le JEU refusé, et l’EXPORT de la même entrée réussit', async () => {
    const entry = buildImportedProject(builtinDocJson(0));
    entry.id = 'lib-fixture-depart';
    entry.label = 'Départ perdu';
    entry.startSceneId = 'SCENE-INEXISTANTE';
    await projectSave(entry);
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});

    await mount();
    await clique('Départ perdu', 'Jouer');
    const txt = container.querySelector('[role="alert"]')?.textContent ?? '';
    expect(txt).toBe('Cette campagne ne peut pas être jouée en l’état. Demandez-en une nouvelle version à son auteur.');

    const OrigCreateObjectURL = URL.createObjectURL;
    const OrigRevokeObjectURL = URL.revokeObjectURL;
    const telecharges: Blob[] = [];
    URL.createObjectURL = (b: Blob | MediaSource) => { telecharges.push(b as Blob); return 'blob:fake'; };
    URL.revokeObjectURL = () => {};
    try {
      const bouton = Array.from(container.querySelectorAll('.row[data-justify="end"] button')).find((el) => el.textContent === 'Exporter') as HTMLButtonElement;
      await act(async () => bouton.click());
    } finally {
      URL.createObjectURL = OrigCreateObjectURL;
      URL.revokeObjectURL = OrigRevokeObjectURL;
    }
    expect(container.querySelector('[role="alert"]'), 'l’export n’échoue pas').toBeNull();
    expect(telecharges).toHaveLength(1);

    consoleErr.mockRestore();
    await unmount();
  });

  it('« Exporter » une copie au nom d’entrée DIVERGENT : le document exporté porte le nom que la liste montre (#1343)', async () => {
    const { paquet: _pq, label: _lb, ...identiteDuPaquet } = allBuiltinCampaigns[0];
    const copie = {
      id: 'entree-copie', label: 'Mon nom', startSceneId: 'scene-copie', savedAt: 1, published: true,
      project: {
        ...identiteDuPaquet, type: 'projet', schema: CURRENT_PROJECT_SCHEMA, label: 'Nom du paquet',
        scenes: [{ ...emptyScene(4, 4), id: 'scene-copie', label: 'Salle copiée' }],
        narratif: emptyNarratif(),
      },
    } as unknown as SavedProject;
    await projectSave(copie);

    await mount();
    // Patron `export-passe-la-porte.test.tsx` : surcharges PLATES le temps du geste, puis restaurées.
    const OrigCreateObjectURL = URL.createObjectURL;
    const OrigRevokeObjectURL = URL.revokeObjectURL;
    const telecharges: Blob[] = [];
    URL.createObjectURL = (b: Blob | MediaSource) => { telecharges.push(b as Blob); return 'blob:fake'; };
    URL.revokeObjectURL = () => {};
    try {
      await clique('Mon nom', 'Exporter');
    } finally {
      URL.createObjectURL = OrigCreateObjectURL;
      URL.revokeObjectURL = OrigRevokeObjectURL;
    }

    expect(container.querySelector('[role="alert"]'), 'aucun refus').toBeNull();
    expect(telecharges).toHaveLength(1);
    const exporte = JSON.parse(await telecharges[0].text()) as { label: string; id: string };
    expect(exporte.label).toBe('Mon nom');
    expect(exporte.id).toBe(allBuiltinCampaigns[0].id);
    await unmount();
  });

  it('« Supprimer » retire l’entrée locale de la bibliothèque (jamais une campagne du jeu)', async () => {
    const entry = buildImportedProject(builtinDocJson(0));
    entry.label = 'À supprimer';
    entry.id = 'lib-fixture-del';
    projectSave(entry);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await mount();
    // Sélectionne l’entrée locale.
    const rows = Array.from(container.querySelectorAll('button.listrow'));
    const row = rows.find((el) => el.textContent?.includes('À supprimer')) as HTMLButtonElement;
    expect(row).toBeTruthy();
    await act(async () => row.click());
    // Le bouton Supprimer du détail.
    const del = Array.from(container.querySelectorAll('button.danger')).find(
      (el) => el.textContent?.includes('Supprimer'),
    ) as HTMLButtonElement;
    expect(del).toBeTruthy();
    await act(async () => del.click());

    expect(projectsLoad().some((p) => p.id === 'lib-fixture-del')).toBe(false);
    await unmount();
  });

  it('ré-importer un même id PROPOSE le remplacement (window.confirm) au lieu d’écraser silencieusement (#766)', async () => {
    const bc = paquetDuJeu(allBuiltinCampaigns[0]);
    const docFor = (version: number) => JSON.stringify({
      schema: 3,
      scenes: bc.scenes,
      ...(bc.worldMap ? { worldMap: bc.worldMap } : {}),
      narratif: bc.narratif,
      meta: { id: 'dup-fixture', label: 'Doublon', version },
    });
    const v1 = buildImportedProject(docFor(1));
    projectSave(v1);
    expect(projectsLoad().find((p) => p.id === 'dup-fixture')?.project.versionContenu).toBe(1);

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await mount();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    const file = new File([docFor(2)], 'dup.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', { value: [file] });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => {}); // laisse le .then(file.text()) se résoudre

    expect(confirmSpy).toHaveBeenCalled();
    // Confirmation REFUSÉE → la version en bibliothèque reste inchangée (jamais un écrasement silencieux).
    expect(projectsLoad().find((p) => p.id === 'dup-fixture')?.project.versionContenu).toBe(1);
    await unmount();
  });

  it('échec réel de sauvegarde (IndexedDB en échec ET projet trop gros pour le miroir) : message visible au joueur (#776)', async () => {
    const bc = paquetDuJeu(allBuiltinCampaigns[0]);
    const doc = JSON.stringify({
      schema: 3,
      scenes: bc.scenes,
      ...(bc.worldMap ? { worldMap: bc.worldMap } : {}),
      narratif: bc.narratif,
      // Champ méta hors-schéma volontairement énorme : dépasse la borne PAR PROJET du miroir
      // localStorage (500 000 caractères), pour exercer le chemin de PERTE RÉEL.
      meta: { id: 'big-fixture', label: 'Grosse campagne', version: 1, desc: 'x'.repeat(600_000) },
    });
    brancherBibliotheque((q) => (q.geste === 'put' && (q.valeur as SavedProject).id === 'big-fixture' ? new DOMException('put refusé', 'QuotaExceededError') : null));

    await mount();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([doc], 'big.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', { value: [file] });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => {}); // laisse le `.then(file.text())` + l'await de `projectSave` se résoudre
    await act(async () => {});

    const alert = container.querySelector('[role="alert"]');
    expect(alert).toBeTruthy();
    const txt = alert?.textContent ?? '';
    // Langage JOUEUR : aucun nom de clé technique, aucun moteur-speak (IndexedDB/localStorage/quota).
    expect(txt.toLowerCase()).not.toMatch(/indexeddb|localstorage|quota/);
    // Sous-chaîne DISTINCTIVE du message d'échec de `projectSave` (jamais produite par un `throw` de
    // `buildImportedProject`, qui parle de fichier/JSON/scènes, jamais de volume) : prouve qu'on a
    // bien emprunté le chemin d'échec de sauvegarde, pas juste un alert qui ressemble.
    expect(txt.toLowerCase()).toMatch(/volumineuse/);

    __setOuvertureIdbForTest(null);
    await unmount();
  });

  it('échec réel de suppression (IndexedDB en échec) : message visible au joueur (#776 pt.6)', async () => {
    const entry = buildImportedProject(builtinDocJson(0));
    entry.id = 'del-fail-fixture';
    entry.label = 'Del fail';
    await projectSave(entry);

    brancherBibliotheque((q) => (q.geste === 'delete' && q.cle === 'del-fail-fixture' ? new DOMException('delete refusé', 'UnknownError') : null));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    // Force aussi l'écriture des TOMBES en échec (sinon `projectRemove` masque l'échec IndexedDB :
    // la tombe seule suffit à empêcher la résurrection, cf. `LibraryWriteOutcome`).
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation((k) => {
      if (k.includes('tombstones')) throw new Error('setItem refusé');
    });

    await mount();
    const rows = Array.from(container.querySelectorAll('button.listrow'));
    const row = rows.find((el) => el.textContent?.includes('Del fail')) as HTMLButtonElement;
    expect(row).toBeTruthy();
    await act(async () => row.click());
    const del = Array.from(container.querySelectorAll('button.danger')).find(
      (el) => el.textContent?.includes('Supprimer'),
    ) as HTMLButtonElement;
    expect(del).toBeTruthy();
    await act(async () => del.click());
    await act(async () => {}); // laisse l'await de `projectRemove` se résoudre
    await act(async () => {});

    const alert = container.querySelector('[role="alert"]');
    expect(alert).toBeTruthy();
    const txt = alert?.textContent ?? '';
    // Sous-chaîne DISTINCTIVE du message d'échec de `projectRemove` (jamais produite par le chemin
    // d'échec de sauvegarde, qui parle de « volumineuse ») : prouve qu'on a bien emprunté le chemin
    // d'échec de suppression, pas juste un alert qui ressemble.
    expect(txt.toLowerCase()).toMatch(/réapparaître/);

    setItemSpy.mockRestore();
    __setOuvertureIdbForTest(null);
    await unmount();
  });

  it('import d’un JSON valide mais structurellement invalide : message JOUEUR, jamais le langage de schéma (#780)', async () => {
    // schema=999 : JSON valide, `parseProject` refuse (aucune migration disponible) — ce message
    // parle de `schema=` et de migration, PAS pour l'écran.
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    await mount();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([JSON.stringify({ schema: 999 })], 'incompatible.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', { value: [file] });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => {}); // laisse le `.then(file.text())` se résoudre

    const alert = container.querySelector('[role="alert"]');
    expect(alert).toBeTruthy();
    const txt = alert?.textContent ?? '';
    // Message JOUEUR distinctif, en français simple.
    expect(txt).toMatch(/n’est pas une campagne exploitable/);
    // Aucun vocabulaire de schéma/authoring à l'écran (nom de champ, mot « schema », version numérique).
    expect(txt.toLowerCase()).not.toMatch(/schema|meta\.|migration/);
    // Le détail technique reste disponible au diagnostic, jamais perdu.
    expect(consoleErr).toHaveBeenCalled();

    consoleErr.mockRestore();
    await unmount();
  });
});

describe('playerImportError — frontière d’affichage (#780)', () => {
  it('laisse passer un message porté par `PlayerFacingImportError` (tri STRUCTUREL, jamais sur le texte — #776 pt.1)', () => {
    expect(playerImportError(new PlayerFacingImportError('Fichier illisible : ce n’est pas du JSON valide.')))
      .toBe('Fichier illisible : ce n’est pas du JSON valide.');
  });

  it('un `Error` simple portant le même TEXTE n’est PAS traité comme un message joueur : il remonte (discrimination par classe, pas par texte)', () => {
    const bogue = new Error('Fichier illisible : ce n’est pas du JSON valide.');
    expect(() => playerImportError(bogue)).toThrow(bogue);
  });

  it('remplace un refus de la porte par un langage JOUEUR, sans terme de schéma', () => {
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    const msg = playerImportError(new ProjetRefuse('schema', [], 'Projet invalide : meta.version doit être un nombre.'));
    expect(msg).toMatch(/n’est pas une campagne exploitable/);
    expect(msg.toLowerCase()).not.toMatch(/meta\.version|schema/);
    expect(consoleErr).toHaveBeenCalled();
    consoleErr.mockRestore();
  });
});
