// @vitest-environment jsdom
/** #367 : « Ouvrir » liste AUSSI les campagnes built-in (Arène + campagnes du jeu), dans une
 *  section distincte de « Mes projets » — ouvrir une built-in ouvre une COPIE de travail (jamais
 *  d'écriture sur le JSON commité), signalée à l'écran. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { OpenProjectModal, refusDeLaPorteDuProjet, refusMotive, type GesteDePorte } from './ProjectModals';
import { ChipDeRefus, type RefusRendu } from '../ChipDeRefus';
import { allBuiltinCampaigns } from '../../scenes/campaign';
import { testScenarios } from '../../scenes/test-scenarios';
import { parseProject, parseSceneDeProjet } from '../../state/worldMap';
import { emptyScene } from '../../state/scene';
import { emptyNarratif } from '../../state/campaignNarratif';
import { IMPORT_FORME_DEPOT, MARQUE_AUTRE_FORMAT, initLibrary, projectsLoad, projectSave, projetDeLEntree, type EntreeListee, type SavedProject } from '../../state/projectLibrary';
import { __setFabriqueIdbForTest } from '../../lib/indexedDb';
import { brancherBasesSimulees } from '../../lib/indexedDb.testkit';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

describe('OpenProjectModal — section « Campagnes du jeu » (#367)', () => {
  it('liste toutes les campagnes built-in (Arène + builtinCampaigns), pas seulement les projets localStorage', () => {
    const html = renderToStaticMarkup(
      <OpenProjectModal onScenario={() => {}} onProject={() => {}} onBuiltin={() => {}} onClose={() => {}} />,
    );
    expect(html).toContain('Campagnes du jeu');
    expect(allBuiltinCampaigns.length).toBeGreaterThan(0);
    expect(html).toContain('Arène'); // « L'Arène » (apostrophe = entité HTML en SSR)
    for (const bc of allBuiltinCampaigns.slice(1)) {
      expect(html).toContain(bc.label);
    }
    expect(html).toContain('s’ouvre en copie');
  });

  it('« Ouvrir » sur une campagne built-in appelle onBuiltin avec cette campagne (jamais onProject)', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    const onBuiltin = vi.fn();
    const onProject = vi.fn();
    await act(async () => {
      root.render(<OpenProjectModal onScenario={() => {}} onProject={onProject} onBuiltin={onBuiltin} onClose={() => {}} />);
    });
    const first = allBuiltinCampaigns[0];
    const row = Array.from(container.querySelectorAll('.listrow')).find((el) => el.textContent?.includes(first.label));
    expect(row).toBeTruthy();
    const btn = row!.querySelector('button.btn-primary') as HTMLButtonElement;
    await act(async () => {
      btn.click();
    });
    expect(onBuiltin).toHaveBeenCalledWith(first);
    expect(onProject).not.toHaveBeenCalled();
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('sortie visible : « Fermer » dans la zone d’actions appelle onClose (le refus s’y affiche)', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    const onClose = vi.fn();
    try {
      await act(async () => {
        root.render(<OpenProjectModal onScenario={() => {}} onProject={() => {}} onBuiltin={() => {}} onClose={onClose} />);
      });
      const fermer = document.querySelector('[role="dialog"] .cadre-pied button') as HTMLButtonElement | null;
      expect(fermer?.textContent).toBe('Fermer');
      await act(async () => fermer!.click());
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  });

  it('« Scénarios de test » : l’icône de chaque scénario est DESSINÉE, jamais son id écrit en texte', () => {
    const container = document.createElement('div');
    container.innerHTML = renderToStaticMarkup(
      <OpenProjectModal onScenario={() => {}} onProject={() => {}} onBuiltin={() => {}} onClose={() => {}} />,
    );
    expect(testScenarios.length).toBeGreaterThan(0);
    for (const sc of testScenarios) {
      const row = Array.from(container.querySelectorAll('.listrow')).find((el) => el.textContent?.includes(sc.title));
      expect(row, sc.title).toBeTruthy();
      expect(row!.querySelector('.lr-name svg.icon'), sc.title).not.toBeNull();
      expect(row!.textContent).not.toContain(sc.icon);
    }
  });

  it('« Scénarios de test » : la note d’équipe est la ligne secondaire (`subtitle`) sous le titre, jamais une `.chip`', () => {
    const container = document.createElement('div');
    container.innerHTML = renderToStaticMarkup(
      <OpenProjectModal onScenario={() => {}} onProject={() => {}} onBuiltin={() => {}} onClose={() => {}} />,
    );
    for (const sc of testScenarios) {
      const row = Array.from(container.querySelectorAll('.listrow')).find((el) => el.textContent?.includes(sc.title));
      expect(row, sc.title).toBeTruthy();
      const chips = Array.from(row!.querySelectorAll('.chip'));
      expect(chips.some((c) => c.textContent?.includes(sc.partyNote)), sc.title).toBe(false);
      expect(row!.querySelector('.lr-name > .lr-sub')?.textContent, sc.title).toBe(sc.partyNote);
    }
  });
});

/** Un document courant, sain, dont un décor NOMME son type — les cas ci-dessous le cassent un à un. */
const projet = (): Record<string, unknown> => ({
  type: 'projet', id: 'proj', label: 'Projet', versionContenu: 1,
  maison: 'fixture de test', narratif: emptyNarratif(),
  scenes: [{ ...emptyScene(4, 4), id: 's1', label: 'Salle du banc', entities: [{ id: 'p0', kind: 'prop', pos: { x: 1, y: 1 }, label: 'Le tonneau', ref: 'tonneau' }] }],
});
const decorSansType = (doc: Record<string, unknown>) => ({
  ...doc,
  scenes: (doc.scenes as { entities: { ref?: string }[] }[]).map((s) => ({ ...s, entities: s.entities.map(({ ref: _ref, ...e }) => e) })),
});

/** Ce que le traducteur rend du refus de la porte pour ce document et ce geste. */
function rendu(doc: unknown, geste: GesteDePorte) {
  try {
    parseProject(doc);
  } catch (e) {
    return refusDeLaPorteDuProjet(e, geste);
  }
  throw new Error('la porte a laissé passer le document');
}

const GESTES: GesteDePorte[] = ['ouverture', 'enregistrement', 'export', 'import', 'test'];

describe('refusDeLaPorteDuProjet — UN traducteur, qui classe les fautes par CHEMIN', () => {
  it('le document de base passe la porte (sans quoi aucun cas ne mesurerait rien)', () => {
    expect(() => parseProject(projet())).not.toThrow();
  });

  it('import du FICHIER DU DÉPÔT d’une campagne livrée : la phrase de l’import joueur, les nœuds nommés en détail', () => {
    const r = rendu(JSON.parse(readFileSync(join(__dirname, '../../scenes/diligence/diligence-projet.json'), 'utf8')), 'import');
    expect(r.message).toBe(`Import refusé : ${IMPORT_FORME_DEPOT.charAt(0).toLowerCase()}${IMPORT_FORME_DEPOT.slice(1)}`);
    expect(r.detail).toMatch(/narratif\.presetsPnj\[\d+\]\.profil/);
  });

  it.each(GESTES)('%s — projet SANS NOM : mots d’auteur, rapport de la porte replié en détail', (geste) => {
    const r = rendu({ ...projet(), label: '' }, geste);
    expect(r.message).toMatch(/^.+ : ce projet n’a pas de nom\.$/);
    expect(r.detail).toContain('  - label: ');
  });

  it('ouverture SANS NOM : le verbe du geste et la cause, en une phrase', () => {
    expect(rendu({ ...projet(), id: undefined }, 'ouverture').message).toBe('Ouverture refusée : ce projet n’a pas de nom.');
  });

  it('`versionContenu` n’est PAS un nom : faute rendue au générique « Faute : », sous le LIBELLÉ du champ', () => {
    const r = rendu({ ...projet(), versionContenu: 'un' }, 'enregistrement');
    expect(r.message).toMatch(/^Enregistrement refusé : ce projet ne pourrait plus être rouvert\. Faute : Version de contenu — /);
    expect(r.detail).toBeUndefined();
  });

  it('projet SANS SCÈNE : la porte le refuse, et la faute se dit sous le libellé « Scènes »', () => {
    const r = rendu({ ...projet(), scenes: [] }, 'enregistrement');
    expect(r.message).toBe(
      'Enregistrement refusé : ce projet ne pourrait plus être rouvert. Faute : Scènes — le projet ne porte aucune scène : il en faut au moins une pour l’ouvrir ou le jouer.',
    );
  });

  it('ouverture d’un projet enregistré au contenu fautif : le message dit l’autre format, la faute vit au détail seulement (#2404)', () => {
    const r = rendu(decorSansType(projet()), 'ouverture');
    expect(r.message).toBe('Ouverture refusée : projet d’un autre format, ou mal formé.');
    expect(r.detail).toMatch(/^ {2}- scenes « s1 » › entities « p0 » › ref: /m);
  });

  it('enregistrement d’un contenu fautif : la scène et l’entité NOMMÉES par leur libellé, le décor UNE fois', () => {
    const r = rendu(decorSansType(projet()), 'enregistrement');
    expect(r.message).toBe(
      'Enregistrement refusé : ce projet ne pourrait plus être rouvert. Faute : Scènes « Salle du banc » › entities « Le tonneau » › ref — « ref » absente — un décor NOMME son type au catalogue (props.json)',
    );
  });

  it('les fautes suivantes sont COMPTÉES', () => {
    const doc = decorSansType(projet());
    const r = rendu({ ...doc, versionContenu: 'un' }, 'enregistrement');
    expect(r.message).toMatch(/\(et 1 autre à corriger\)$/);
  });

  it('fautes COMPTÉES : le rapport de la porte, qui les liste TOUTES, est replié en détail', () => {
    const doc = { ...decorSansType(projet()), versionContenu: 'un' };
    const r = rendu(doc, 'enregistrement');
    expect(r.detail).toMatch(/^ {2}- versionContenu: /m);
    expect(r.detail).toMatch(/^ {2}- scenes « s1 » › entities « p0 » › ref: /m);
  });

  it('une SEULE faute : le message la reprend entière, aucun détail', () => {
    expect(rendu(decorSansType(projet()), 'enregistrement').detail).toBeUndefined();
  });

  it.each([
    ['ouverture', 'Ouverture refusée :'],
    ['import', 'Import refusé :'],
  ] as const)('%s, geste qui RELIT une donnée persistée : le titre dit l’autre format, la faute vit au détail seulement (#2404)', (geste, tete) => {
    const r = rendu(decorSansType(projet()), geste);
    expect(r.message).toBe(`${tete} projet d’un autre format, ou mal formé.`);
    expect(r.detail).toMatch(/^ {2}- scenes « s1 » › entities « p0 » › ref: /m);
  });

  it('reprise d’une sauvegarde locale au contenu fautif : le titre dit la scène d’un autre format, la faute vit au détail seulement (#2404)', () => {
    let erreur: unknown;
    try {
      parseSceneDeProjet({ ...emptyScene(4, 4), id: 's1', label: 'Salle', entities: [{ id: 'p0', kind: 'prop', pos: { x: 1, y: 1 } }] });
    } catch (e) {
      erreur = e;
    }
    const r = refusDeLaPorteDuProjet(erreur, 'reprise');
    expect(r.message).toBe('Restauration refusée : scène d’un autre format, ou mal formée.');
    expect(r.detail).toMatch(/^ {2}- entities « p0 » › ref: /m);
  });

  it('un numéro de forme `schema` (autre format) : en mots d’AUTEUR, le rapport technique en détail seulement', () => {
    const r = rendu({ ...projet(), schema: 999 }, 'import');
    expect(r.message).toBe('Import refusé : projet d’un autre format, ou mal formé.');
    expect(r.detail).toMatch(/\(racine\): Clé non reconnue : "schema"/);
  });

  it.each([
    ['document absent', null],
    ['tableau nu', []],
    ['JSON quelconque', { foo: 1 }],
    ['schema texte', { schema: '12', scenes: [] }],
  ])('%s : fautif à sa RACINE, en mots d’AUTEUR, jamais « (racine) »', (_nom, doc) => {
    const r = rendu(doc, 'ouverture');
    expect(r.message).toBe('Ouverture refusée : projet d’un autre format, ou mal formé.');
    expect(r.detail).toMatch(/^Projet d’un autre format, ou mal formé — /);
  });

  it('une erreur qui n’est PAS un refus de la porte remonte telle quelle', () => {
    const bug = new TypeError('bug');
    expect(() => refusDeLaPorteDuProjet(bug, 'import')).toThrow(bug);
  });

  it('refus HORS porte : le verbe du geste, par la même table', () => {
    expect(refusMotive('import', 'ce fichier n’est pas du JSON').message).toBe('Import refusé : ce fichier n’est pas du JSON.');
    expect(refusMotive('test', 'aucun aventurier au groupe').message).toBe('Mise à l’essai refusée : aucun aventurier au groupe.');
  });
});

describe('ChipDeRefus — le détail replié par la primitive `.fold`, une ligne du rapport par bloc', () => {
  it('compose `.fold` / `.fold-title` / `.fold-body`, et garde les retours à la ligne du rapport', () => {
    const html = renderToStaticMarkup(<ChipDeRefus refus={{ message: 'M', detail: 'Projet — entête\n  - id: a\n  - label: b' }} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('<p class="chip tone-danger chip-phrase">M</p>');
    expect(html).toContain('<details class="fold">');
    expect(html).toContain('class="fold-title"');
    expect(html).toContain('<div>  - id: a</div><div>  - label: b</div>');
  });

  it('sans détail, aucun repli', () => {
    expect(renderToStaticMarkup(<ChipDeRefus refus={{ message: 'M' }} />)).not.toContain('fold');
  });
});

describe('OpenProjectModal — une entrée dont le CONTENU est refusé au geste est marquée (#2404)', () => {
  /** La modale tenue comme l'éditeur la tient : « Ouvrir » passe la porte (`projetDeLEntree`), un
   *  refus devient l'`error` de la modale. */
  function Harnais() {
    const [erreur, setErreur] = useState<RefusRendu | null>(null);
    const ouvrir = (p: EntreeListee) => {
      try {
        projetDeLEntree(p);
      } catch (e) {
        setErreur(refusDeLaPorteDuProjet(e, 'ouverture'));
      }
    };
    return <OpenProjectModal onScenario={() => {}} onProject={ouvrir} onBuiltin={() => {}} onClose={() => {}} error={erreur} />;
  }

  it('enveloppe valide, contenu refusé : listée sans marque, puis, après « Ouvrir » refusé, MARQUÉE et son « Ouvrir » perd le rang principal', async () => {
    const entree: SavedProject = { id: 'oeuvre', label: 'Mon oeuvre', startSceneId: 's1', savedAt: 1, published: false, project: decorSansType(projet()) as SavedProject['project'] };
    await projectSave(entree);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    try {
      await act(async () => {
        root.render(<Harnais />);
      });
      const ligne = () => [...document.querySelectorAll('.listrow')].find((el) => el.textContent?.includes('Mon oeuvre'))!;
      const ouvrir = () => [...ligne().querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Ouvrir')!;
      expect(ligne().querySelector('.chip.tone-danger'), 'rien n’est encore refusé').toBeNull();
      expect(ouvrir().classList.contains('btn-primary')).toBe(true);
      await act(async () => {
        ouvrir().click();
      });
      expect(document.querySelector('[role="alert"] .chip.tone-danger')?.textContent).toBe('Ouverture refusée : projet d’un autre format, ou mal formé.');
      expect(ligne().querySelector('.chip.tone-danger')?.textContent).toBe(MARQUE_AUTRE_FORMAT);
      expect(ouvrir().classList.contains('btn-primary'), '« Ouvrir » n’est plus l’action principale').toBe(false);
    } finally {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  });

  it('chaque refus posé est RAMENÉ EN VUE au geste, le second compris (la liste a pu défiler sous la pastille)', async () => {
    const entree: SavedProject = { id: 'oeuvre', label: 'Mon oeuvre', startSceneId: 's1', savedAt: 1, published: false, project: decorSansType(projet()) as SavedProject['project'] };
    await projectSave(entree);
    const original = Element.prototype.scrollIntoView;
    const cibles: Element[] = [];
    Element.prototype.scrollIntoView = function (this: Element) { cibles.push(this); };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    try {
      await act(async () => {
        root.render(<Harnais />);
      });
      const ouvrir = () => [...[...document.querySelectorAll('.listrow')].find((el) => el.textContent?.includes('Mon oeuvre'))!.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Ouvrir')!;
      expect(cibles, 'aucun refus, rien à ramener').toEqual([]);
      await act(async () => { ouvrir().click(); });
      const alerte = document.querySelector('[role="alert"]');
      expect(cibles, 'le premier refus est ramené en vue').toEqual([alerte]);
      await act(async () => { ouvrir().click(); });
      expect(cibles, 'le second refus, même texte, est ramené en vue à son tour').toEqual([alerte, alerte]);
    } finally {
      Element.prototype.scrollIntoView = original;
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  });
});

describe('OpenProjectModal — « Suppr. », geste de l’auteur, retire une entrée REFUSÉE (#2404)', () => {
  afterEach(() => {
    __setFabriqueIdbForTest(null);
  });

  it('l’entrée dont l’enveloppe est refusée est listée MARQUÉE, son « Ouvrir » n’est pas l’action principale, et « Suppr. » la retire de la liste et de la base', async () => {
    const oeuvre = { id: 'oeuvre', label: 'Mon oeuvre', startSceneId: 's1', savedAt: 1, published: false, project: { scenes: [{ id: 's1' }] }, champEnTrop: 1 };
    const contenu = brancherBasesSimulees().amorcer('wfrp4-library', { projects: { keyPath: 'id' } }).magasins.get('projects')!.contenu;
    contenu.set(oeuvre.id, oeuvre);
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    await initLibrary();
    consoleErr.mockRestore();
    expect(projectsLoad().map((e) => [e.id, e.refus !== undefined])).toEqual([['oeuvre', true]]);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    try {
      await act(async () => {
        root.render(<OpenProjectModal onScenario={() => {}} onProject={() => {}} onBuiltin={() => {}} onClose={() => {}} />);
      });
      const ligne = () => [...document.querySelectorAll('.listrow')].find((el) => el.textContent?.includes('Mon oeuvre'));
      expect(ligne()!.querySelector('.chip.tone-danger')?.textContent).toBe(MARQUE_AUTRE_FORMAT);
      const ouvrir = [...ligne()!.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Ouvrir')!;
      expect(ouvrir.classList.contains('btn-primary')).toBe(false);
      const suppr = [...ligne()!.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Suppr.')!;
      await act(async () => {
        suppr.click();
        await new Promise((r) => setTimeout(r, 0));
      });
      expect(ligne()).toBeUndefined();
      expect(projectsLoad()).toEqual([]);
      expect(contenu.has('oeuvre')).toBe(false);
    } finally {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  });
});
