// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { HeroSelector, PartyScreen, PartyScreenView, slotKeyNav } from './PartyScreen';
import { projectSave, __resetLibraryForTest, type SavedProject } from '../state/projectLibrary';
import { areneCampaign, builtinCampaigns, paquetDuJeu } from '../scenes/campaign';
import { datasetArray, setDataset } from '../data/overrides';
import { CURRENT_PROJECT_SCHEMA, resolveActiveAxes } from '../state/worldMap';
import { emptyScene } from '../state/scene';
import { allAxes } from '../data';
import { useGame } from '../state/store';
import { heroSubtitle } from './CharCard';
import { makePregens } from '../data/pregens';
import { rosterAdd } from '../state/roster';
import { initialNet, type NetState } from '../state/netFlow';
import { Combatant } from '../engine/types';
import { t } from '../i18n';

/** Storage isolé pour chaque fixture. */
function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  } as Storage;
}

function savedHero(): Combatant {
  const h: Combatant = JSON.parse(JSON.stringify(makePregens()[0]));
  h.id = 'roster-test-1';
  h.label = 'Aventurière Sauvegardée';
  return h;
}

const noop = () => {};

describe('HeroSelector — sélecteur dédié (écran plein-champ) : recrutement & remplacement', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', fakeStorage());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('recrutement : écran ScreenShell (voile plein champ) + onglets + cartes-portraits des pré-tirés', () => {
    const html = renderToStaticMarkup(<HeroSelector party={[]} mode="recruit" onPick={noop} onClose={noop} />);
    expect(html).toContain('worldmap-overlay'); // coquille plein-champ (ScreenShell), pas une petite modale
    expect(html).toContain('Choisir un aventurier'); // titre du mode recrutement
    expect(html).toContain('Pré-tirés');
    expect(html).toContain('Mes personnages');
    expect(html).toContain('candidate-card');
    expect(html).not.toContain('candidate-remplacement'); // recrutement = grandes cartes (gallery)
  });

  it('roster non vide : MÊME carte-portrait (nom complet + recruter + outils export/suppr)', () => {
    rosterAdd({ hero: savedHero(), wealth: { gold: 1, silver: 0, brass: 0 } });
    const html = renderToStaticMarkup(<HeroSelector party={[]} mode="recruit" onPick={noop} onClose={noop} />);
    expect(html).toContain('Aventurière Sauvegardée'); // nom COMPLET
    expect(html).toContain('candidate-name');
    expect(html).toContain('Recruter');
    expect(html).toContain('Supprimer'); // action secondaire SUR la carte
  });

  it('remplacement : cartes compactes, membre du groupe grisé « Déjà choisi »', () => {
    const h = savedHero();
    rosterAdd({ hero: h, wealth: { gold: 0, silver: 5, brass: 0 } });
    const html = renderToStaticMarkup(<HeroSelector party={[h]} mode="replace" replaceName={h.label} onPick={noop} onClose={noop} />);
    expect(html).toContain('Remplacer Aventurière Sauvegardée'); // titre du mode remplacement
    expect(html).toContain('candidate-remplacement');
    expect(html).toContain('Déjà choisi');
  });
});

describe('PartyScreen — LA COMPAGNIE SEULE (aucune galerie inline) : coop, hôte attribue', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', fakeStorage());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const render = (party: Combatant[], net: NetState, inProgress = false, campaign?: { name: string; canChange?: boolean }) =>
    renderToStaticMarkup(
      <PartyScreenView
        party={party}
        net={net}
        title="Votre groupe d'aventuriers"
        campaignName={campaign?.name}
        onChangeCampaign={campaign?.canChange ? noop : undefined}
        inProgress={inProgress}
        onMenu={noop}
        onQuitCoop={noop}
        onCreate={noop}
        onAddHero={noop}
        onRemoveHero={noop}
        onAssignSlot={noop}
        onStart={noop}
        onResume={noop}
      />,
    );

  it('solo : compagnie (grille de sièges vides), siège vide = actions Créer / Choisir, AUCUNE galerie inline', () => {
    const html = render([], initialNet());
    expect(html).toContain('party-roster');
    expect(html).toContain('seat-empty');
    expect(html).not.toContain('slot-owner'); // pas de bandeau joueur en solo
    expect(html).toContain('Créer'); // action sur siège vide
    expect(html).toContain('Choisir'); // ouvre le sélecteur dédié
    expect(html).not.toContain('candidate-gallery'); // plus de galerie sur l'écran de groupe
    expect(html).not.toContain('candidate-card'); // ni de cartes-candidats inline
    expect(html).toContain('Commencer');
    expect(html).not.toContain('Reprendre');
  });

  it('cartouche campagne : nom + « Changer » quand on peut choisir, lecture seule sinon', () => {
    const editable = render([], initialNet(), false, { name: "L'Arène", canChange: true });
    expect(editable).toContain('Arène');
    expect(editable).toContain('Changer');
    const guest = render([], { ...initialNet(), mode: 'guest', mySeat: 1 }, false, { name: 'Ma campagne' });
    expect(guest).toContain('Ma campagne');
    expect(guest).not.toContain('Changer');
    const absent = render([], initialNet());
    expect(absent).not.toContain('campaign-pill');
  });

  it('partie en cours : « Reprendre » prend la primauté, « Commencer » reste (rétrogradé)', () => {
    const h = savedHero();
    const html = render([h], initialNet(), true);
    expect(html).toMatch(/btn btn-primary[^>]*>Reprendre/);
    expect(html).toContain('Commencer');
    expect(html).not.toMatch(/btn btn-primary[^>]*>Commencer/);
  });

  it('invité : pas de « Reprendre » même partie en cours (l’hôte pilote)', () => {
    const html = render([], {
      ...initialNet(), mode: 'guest', mySeat: 1, seatNames: { 0: 'Hôte', 1: 'Antoine' }, ownership: {}, slots: [0, 1, 1, 0],
    }, true);
    expect(html).not.toContain('Reprendre');
  });

  it('invité : sièges des autres « en attente », son siège recrutable (Choisir), pas de « Commencer »', () => {
    const html = render([], {
      ...initialNet(), mode: 'guest', mySeat: 1, seatNames: { 0: 'Hôte', 1: 'Antoine' }, ownership: {}, slots: [0, 1, 1, 0],
    });
    expect(html).toContain('En attente de Hôte'); // sièges 0 et 3 (siège 0)
    expect(html).toContain('Choisir'); // l’invité recrute ses sièges via le sélecteur dédié
    expect(html).not.toContain('Commencer');
    expect(html).toContain('Quitter');
  });

  it('hôte : select de siège sur les sièges vides, « Commencer » grisé + RAISON portée tant qu’un siège invité est vide', () => {
    const html = render([], {
      ...initialNet(), mode: 'host', mySeat: 0, seatNames: { 0: 'Hôte', 1: 'Antoine' }, ownership: {}, slots: [0, 1, 0, 0],
    });
    expect(html).toContain('<select');
    expect(html).toContain('Antoine');
    expect(html).toMatch(/Commencer[^<]*→<\/button>/);
    expect(html).toContain('disabled');
    // EXCEPTION nommée à l'arbitrage user 2026-08-24 (qui vise les CASES) : en coop, l'attente d'un
    // invité est le SEUL signal de l'écran — la raison reste EN CLAIR sous le bouton (`raisonInline`),
    // liée par `aria-describedby`.
    expect(html).toContain('gated-action-reason');
    expect(html).toContain('aria-describedby');
    expect(html).toContain('Des emplacements attribués aux autres joueurs sont encore vides.');
  });

  it('hôte : héros de l’invité dans SON siège (carte), « Retirer » réservé au propriétaire', () => {
    const h = savedHero();
    const html = render([h], {
      ...initialNet(), mode: 'host', mySeat: 0, seatNames: { 0: 'Hôte', 1: 'Antoine' }, ownership: { [h.id]: 1 }, slots: [1, 0, 0, 0],
    });
    expect(html).toContain(h.label); // carte de siège dans la compagnie
    expect(html).not.toMatch(/<button[^>]*>Retirer<\/button>/); // siège non possédé → pas d'action
  });

  it('siège possédé : bouton « Remplacer » rendu quand onReplaceHero est fourni', () => {
    const h = savedHero();
    const html = renderToStaticMarkup(
      <PartyScreenView
        party={[h]}
        net={initialNet()}
        title="Votre groupe d'aventuriers"
        onMenu={noop} onQuitCoop={noop} onCreate={noop}
        onAddHero={noop} onRemoveHero={noop} onReplaceHero={noop}
        onAssignSlot={noop} onStart={noop}
      />,
    );
    expect(html).toContain('Remplacer');
  });
});

describe('PartyScreen — présentation par le PERSONNAGE (plus de bouton « Qui est-ce ? »)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', fakeStorage());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const render = (party: Combatant[], net: NetState) =>
    renderToStaticMarkup(
      <PartyScreenView
        party={party}
        net={net}
        title="Votre groupe d'aventuriers"
        onMenu={noop}
        onQuitCoop={noop}
        onCreate={noop}
        onAddHero={noop}
        onRemoveHero={noop}
        onAssignSlot={noop}
        onStart={noop}
      />,
    );

  it('siège occupé : contrat scellé — portrait + nom + rôle + cartouche « Contrat N » + sceau, personnage cliquable', () => {
    const heroes = makePregens().slice(0, 2);
    const html = render(heroes, initialNet());
    expect(html).toContain('seat-card');
    expect(html).toContain('seat-card-contract');
    expect(html).toContain('Contrat I');
    expect(html).toContain('seat-card-seal'); // sceau de cire (contrat scellé)
    expect(html).toContain(heroes[0].label); // nom COMPLET dans la compagnie
    expect(html).toContain('card-roles'); // rôle (forces) sur la carte de siège
    expect(html).toContain('char-present'); // la figurine+identité EST le contrôle de présentation
    expect(html).toContain(`Voir ${heroes[0].label}`); // aria-label du contrôle
    expect(html).not.toContain('Qui est-ce ?'); // le bouton loupe est SUPPRIMÉ
    expect(html).not.toContain('who-btn');
  });

  it('roving tabindex : UN seul siège tabbable, les trois autres à -1', () => {
    const html = render([], initialNet());
    expect((html.match(/seat-slot[^>]*?tabindex="0"/g) ?? []).length).toBe(1);
    expect((html.match(/seat-slot[^>]*?tabindex="-1"/g) ?? []).length).toBe(3);
  });

  it('slotKeyNav (pur) : Haut/Bas (⇄ tolérées) = focus voisin bouclé, Enter/Espace = action', () => {
    expect(slotKeyNav('ArrowDown', 0, 4)).toEqual({ focus: 1 });
    expect(slotKeyNav('ArrowUp', 1, 4)).toEqual({ focus: 0 });
    expect(slotKeyNav('ArrowUp', 0, 4)).toEqual({ focus: 3 }); // bouclé
    expect(slotKeyNav('ArrowDown', 3, 4)).toEqual({ focus: 0 }); // bouclé
    expect(slotKeyNav('ArrowRight', 0, 4)).toEqual({ focus: 1 }); // ⇄ tolérées
    expect(slotKeyNav('ArrowLeft', 0, 4)).toEqual({ focus: 3 });
    expect(slotKeyNav('Enter', 2, 4)).toBe('primary');
    expect(slotKeyNav(' ', 2, 4)).toBe('primary');
    expect(slotKeyNav('Tab', 2, 4)).toBeNull();
    expect(slotKeyNav('x', 2, 4)).toBeNull();
  });

  it('groupe complet : 4 cartes de siège, aucun siège vide, aucune galerie', () => {
    const heroes = makePregens().slice(0, 4);
    const full = render(heroes, initialNet());
    expect((full.match(/seat-card-contract/g) ?? []).length).toBe(4);
    for (const h of heroes) expect(full).toContain(h.label);
    expect(full).not.toContain('seat-empty'); // groupe complet → aucun siège vide
    expect(full).not.toContain('candidate-card'); // pas de galerie sur l'écran de groupe
  });

  it('sous-titre d’archétype : la CARRIÈRE d’abord, l’espèce ensuite (arbitrage user 2026-07-13)', () => {
    const hero = makePregens()[0];
    const sub = heroSubtitle(hero);
    expect(sub).toContain(' — '); // « Carrière — Espèce »
    // la carrière précède l'espèce (séparateur em-dash entre les deux)
    const [career] = sub.split(' — ');
    expect(career.length).toBeGreaterThan(0);
    expect(render([hero], initialNet())).toContain('candidate-sub');
  });
});

describe('PartyScreen — « Choisir » une campagne : construite par sa fabrique, par la porte (#1343)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    await __resetLibraryForTest();
    useGame.setState({ pendingCampaign: null, scene: null, net: initialNet() });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  /** La modale de choix, trouvée par son NOM accessible (le titre rendu par `Modal`). */
  const modaleDeChoix = () => Array.from(document.querySelectorAll('[role="dialog"]'))
    .find((d) => document.getElementById(d.getAttribute('aria-labelledby') ?? '')?.textContent === String(t('party.campaign.pick.title'))) ?? null;

  /** Ouvre la modale de choix par « Changer », puis clique « Choisir » sur la rangée nommée `nom`. */
  async function choisir(nom: string) {
    await act(async () => root.render(<PartyScreen />));
    const changer = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Changer') as HTMLButtonElement;
    await act(async () => changer.click());
    const rangee = Array.from(modaleDeChoix()!.querySelectorAll('.pregen-row')).find((r) => r.textContent?.includes(nom))!;
    await act(async () => (rangee.querySelector('button') as HTMLButtonElement).click());
  }

  it('un projet PUBLIÉ que la porte refuse : alerte générique DANS la modale, qui reste ouverte, aucune campagne posée', async () => {
    const fautive = {
      id: 'proj-fautif', label: 'Campagne fautive', startSceneId: 'scene-a', savedAt: 1, published: true,
      project: { schema: 999 as typeof CURRENT_PROJECT_SCHEMA, scenes: [], narratif: { affaires: [], indices: [], presetsPnj: [], objets: [] } },
    } as unknown as SavedProject;
    await projectSave(fautive);
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});

    await choisir('Campagne fautive');

    const alertes = document.querySelectorAll('[role="alert"]');
    expect(alertes).toHaveLength(1);
    const alerte = alertes[0];
    expect(modaleDeChoix()?.contains(alerte), 'dans la modale de choix').toBe(true);
    expect(alerte.classList.contains('chip') && alerte.classList.contains('tone-danger')).toBe(true);
    const txt = alerte.textContent ?? '';
    expect(txt).toBe('Cette campagne ne peut pas être jouée en l’état. Demandez-en une nouvelle version à son auteur.');
    expect(txt.toLowerCase()).not.toMatch(/schema|migration/);
    expect(consoleErr).toHaveBeenCalled();
    expect(useGame.getState().pendingCampaign, 'aucune campagne posée').toBeNull();
    consoleErr.mockRestore();
  });

  it('une campagne du JEU se lance par sa fabrique, et la modale se ferme', async () => {
    const c = builtinCampaigns[0];
    await choisir(c.label);

    expect(document.querySelector('[role="alert"]'), 'aucun refus').toBeNull();
    const pc = useGame.getState().pendingCampaign;
    expect(pc?.id).toBe(c.id);
    expect(pc?.label).toBe(c.label);
    const paquet = paquetDuJeu(c);
    expect(pc?.startSceneId).toBe(paquet.scenes[0].id);
    expect(pc?.scenes).toEqual(paquet.scenes);
    expect(pc?.worldMap).toEqual(paquet.worldMap);
    expect(pc?.narratif).toEqual(paquet.narratif);
    expect(modaleDeChoix(), 'modale fermée').toBeNull();
  });

  it('un projet PUBLIÉ aux `activeAxes` déclarés : ses axes deviennent ceux de la compagnie (#409)', async () => {
    const axes = allAxes.filter((a) => !a.core);
    const publie = {
      id: 'proj-axes', label: 'Campagne à axes', startSceneId: 'scene-a', savedAt: 1, published: true,
      project: {
        type: 'projet', schema: CURRENT_PROJECT_SCHEMA, id: 'proj-axes', label: 'Campagne à axes', versionContenu: 1,
        maison: 'fixture de test', scenes: [{ ...emptyScene(4, 4), id: 'scene-a', label: 'Salle A' }],
        narratif: { affaires: [], indices: [], presetsPnj: [], objets: [] }, activeAxes: axes.map((a) => a.id),
      },
    } as unknown as SavedProject;
    await projectSave(publie);

    await choisir('Campagne à axes');

    expect(resolveActiveAxes(useGame.getState().pendingCampaign ?? {})).toEqual(axes.map((a) => a.id));
    const rail = Array.from(document.querySelectorAll('.compo-ax')).map((el) => el.textContent);
    expect(rail, 'le rail de composition montre les axes de la campagne').toEqual(axes.map((a) => a.label));
  });
});

/** « Lancer » (#1692) : la campagne choisie, et sans choix l'Arène, se lancent par le MÊME geste — le
 *  paquet passe la porte à cet instant, un refus s'affiche au joueur et rien n'est posé. */
describe('PartyScreen — « Lancer » sans choix lance l’Arène par la porte des projets', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    useGame.setState({ pendingCampaign: null, scene: null, screen: 'party', party: makePregens().slice(0, 1), net: initialNet() });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function lancer() {
    await act(async () => root.render(<PartyScreen />));
    const bouton = container.querySelector('.party-start button') as HTMLButtonElement;
    await act(async () => bouton.click());
  }

  it('sans choix : l’Arène est lancée par `loadProject` — sa scène d’entrée, sa carte, son paquet au snapshot', async () => {
    await lancer();
    const paquet = paquetDuJeu(areneCampaign);
    const s = useGame.getState();
    expect(s.screen).toBe('campaign');
    expect(s.scene?.id).toBe(paquet.scenes[0].id);
    expect(s.worldMap?.id).toBe(paquet.worldMap?.id);
    expect(s.campaignDoc?.scenes.map((sc) => sc.id)).toEqual(paquet.scenes.map((sc) => sc.id));
  });

  it('un id que l’Arène référence, renommé au Codex : le refus s’affiche, aucune scène n’est posée', async () => {
    const avant = [...datasetArray('props')];
    expect(JSON.stringify(areneCampaign.paquet), 'l’Arène référence le décor `tonneau`').toContain('"ref":"tonneau"');
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    setDataset('props', avant.map((p) => (p.id === 'tonneau' ? { ...p, id: 'tonneau-renomme' } : p)));
    try {
      await lancer();
      expect(document.querySelector('[role="alert"]')?.textContent).toBe(
        'Cette campagne ne peut pas être jouée en l’état. Demandez-en une nouvelle version à son auteur.',
      );
      expect(useGame.getState().scene, 'aucune scène posée').toBeNull();
      expect(useGame.getState().screen).toBe('party');
      const fermer = document.querySelector('[role="dialog"] .cadre-pied button') as HTMLButtonElement | null;
      expect(fermer?.textContent, 'sortie visible de la modale de refus').toBe('Fermer');
      await act(async () => fermer!.click());
      expect(document.querySelector('[role="dialog"]'), 'la modale de refus est fermée').toBeNull();
    } finally {
      setDataset('props', avant);
      consoleErr.mockRestore();
    }
  });
});
