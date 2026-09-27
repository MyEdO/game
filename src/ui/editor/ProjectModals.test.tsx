// @vitest-environment jsdom
/** #367 : « Ouvrir » liste AUSSI les campagnes built-in (Arène + campagnes du jeu), dans une
 *  section distincte de « Mes projets » — ouvrir une built-in ouvre une COPIE de travail (jamais
 *  d'écriture sur le JSON commité), signalée à l'écran. */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { OpenProjectModal, ChipDeRefus, refusDeLaPorteDuProjet, refusMotive, type GesteDePorte } from './ProjectModals';
import { allBuiltinCampaigns } from '../../scenes/campaign';
import { testScenarios } from '../../scenes/test-scenarios';
import { parseProject, CURRENT_PROJECT_SCHEMA } from '../../state/worldMap';
import { emptyScene } from '../../state/scene';

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

  it('« Scénarios de test » : la note d’équipe est un `.hint` sous le titre, jamais une `.chip`', () => {
    const container = document.createElement('div');
    container.innerHTML = renderToStaticMarkup(
      <OpenProjectModal onScenario={() => {}} onProject={() => {}} onBuiltin={() => {}} onClose={() => {}} />,
    );
    for (const sc of testScenarios) {
      const row = Array.from(container.querySelectorAll('.listrow')).find((el) => el.textContent?.includes(sc.title));
      expect(row, sc.title).toBeTruthy();
      const chips = Array.from(row!.querySelectorAll('.chip'));
      expect(chips.some((c) => c.textContent?.includes(sc.partyNote)), sc.title).toBe(false);
      expect(row!.querySelector('.lr-name > .hint')?.textContent, sc.title).toBe(sc.partyNote);
    }
  });
});

/** Un document courant, sain, dont un décor NOMME son type — les cas ci-dessous le cassent un à un. */
const projet = (): Record<string, unknown> => ({
  type: 'projet', schema: CURRENT_PROJECT_SCHEMA, id: 'proj', label: 'Projet', versionContenu: 1,
  maison: 'fixture de test', narratif: { affaires: [], indices: [], presetsPnj: [], objets: [] },
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

  it.each(GESTES)('%s — projet SANS NOM : mots d’auteur, rapport de la porte replié en détail', (geste) => {
    const r = rendu({ ...projet(), label: '' }, geste);
    expect(r.message).toMatch(/^Ce projet n’a pas de nom : impossible de .+ tel quel\.$/);
    expect(r.detail).toContain('  - label: ');
  });

  it('ouverture SANS NOM : le texte d’avant, à la lettre', () => {
    expect(rendu({ ...projet(), id: undefined }, 'ouverture').message).toBe('Ce projet n’a pas de nom : impossible de l’ouvrir tel quel.');
  });

  it('`versionContenu` n’est PAS un nom : faute rendue au générique « Faute : », sous le LIBELLÉ du champ', () => {
    const r = rendu({ ...projet(), versionContenu: 'un' }, 'ouverture');
    expect(r.message).toMatch(/^Ouverture refusée : ce projet ne peut pas être ouvert\. Faute : Version de contenu — /);
    expect(r.detail).toBeUndefined();
  });

  it('projet SANS SCÈNE : la porte le refuse, et la faute se dit sous le libellé « Scènes »', () => {
    const r = rendu({ ...projet(), scenes: [] }, 'ouverture');
    expect(r.message).toBe(
      'Ouverture refusée : ce projet ne peut pas être ouvert. Faute : Scènes — le projet ne porte aucune scène : il en faut au moins une pour l’ouvrir ou le jouer.',
    );
  });

  it('ouverture d’un contenu fautif : la scène et l’entité NOMMÉES par leur libellé, le décor UNE fois', () => {
    const r = rendu(decorSansType(projet()), 'ouverture');
    expect(r.message).toBe(
      'Ouverture refusée : ce projet ne peut pas être ouvert. Faute : Scènes « Salle du banc » › entities « Le tonneau » › ref — « ref » absente — un décor NOMME son type au catalogue (props.json)',
    );
  });

  it('les fautes suivantes sont COMPTÉES', () => {
    const doc = decorSansType(projet());
    const r = rendu({ ...doc, versionContenu: 'un' }, 'import');
    expect(r.message).toMatch(/\(et 1 autre à corriger\)$/);
  });

  it('fautes COMPTÉES : le rapport de la porte, qui les liste TOUTES, est replié en détail', () => {
    const doc = { ...decorSansType(projet()), versionContenu: 'un' };
    const r = rendu(doc, 'import');
    expect(r.detail).toMatch(/^ {2}- versionContenu: /m);
    expect(r.detail).toMatch(/^ {2}- scenes « s1 » › entities « p0 » › ref: /m);
  });

  it('une SEULE faute : le message la reprend entière, aucun détail', () => {
    expect(rendu(decorSansType(projet()), 'import').detail).toBeUndefined();
  });

  it('version sans migration : en mots d’AUTEUR, le rapport technique en détail seulement', () => {
    const r = rendu({ ...projet(), schema: 999 }, 'import');
    expect(r.message).toBe('Import refusé : ce fichier ne peut pas être ouvert. Ce projet vient d’une version du jeu que celle-ci ne sait pas lire.');
    expect(r.detail).toMatch(/schema=999/);
  });

  it('document mal formé (racine, ou intraversable par la migration) : en mots d’AUTEUR, jamais « (racine) »', () => {
    for (const doc of [null, { schema: 2, id: 'x', label: 'X', versionContenu: 1, scenes: [null] }]) {
      const r = rendu(doc, 'ouverture');
      expect(r.message).toBe('Ouverture refusée : ce projet ne peut pas être ouvert. Ce document n’est pas un projet lisible.');
      expect(r.detail).toMatch(/^Projet invalide : /);
    }
  });

  it.each([
    ['JSON quelconque', { foo: 1 }, 'Import refusé : ce fichier ne peut pas être ouvert. Ce document n’est pas un projet lisible.'],
    ['schema texte', { schema: '12', scenes: [] }, 'Import refusé : ce fichier ne peut pas être ouvert. Ce document n’est pas un projet lisible.'],
    ['schema futur', { schema: 99, scenes: [] }, 'Import refusé : ce fichier ne peut pas être ouvert. Ce projet vient d’une version du jeu que celle-ci ne sait pas lire.'],
  ])('%s : le texte d’écran suit la cause LUE', (_nom, doc, texte) => {
    expect(rendu(doc, 'import').message).toBe(texte);
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
    expect(html).toContain('<details class="fold">');
    expect(html).toContain('class="fold-title"');
    expect(html).toContain('<div>  - id: a</div><div>  - label: b</div>');
  });

  it('sans détail, aucun repli', () => {
    expect(renderToStaticMarkup(<ChipDeRefus refus={{ message: 'M' }} />)).not.toContain('fold');
  });
});
