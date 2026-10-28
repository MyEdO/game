// @vitest-environment jsdom
/** #2206 — la `desc` de la fiche d'un PNJ atteint le joueur : onglet « Description » de `InspectPanel`. */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { useGame } from '../state/store';
import { poserScenario } from '../state/scenarioFlow';
import { lancerCampagne, campagneDuJeu, diligenceCampaign } from '../scenes/campaign';
import { makePregens } from '../data/pregens';
import { scenario } from '../scenes/test-scenarios/96-presets-edo';
import { presetPnjById } from '../state/campaignData';
import { mergeCreatureProfile } from '../noyau/monde/resolveursDuNarratif';
import { sceneNpc } from '../noyau/monde/sceneNpc';
import { spawnEnemy } from '../noyau/monde/spawn';
import { applyNetSnapshot } from '../state/netFlow';
import { instantaneDeLaCoop } from '../noyau/coop';
import { emptyNarratif } from '../noyau/monde/campaignNarratif';
import { createHero } from '../engine/character';
import { findCreatureById } from '../data';
import { proseDeFiche, codexLookupById } from './compendium/registry';
import { CodexEntry } from './compendium/CodexEntry';
import { Prose } from './Prose';
import { porteurDuNarratif } from './porteurDeProjet';
import { CHEMINS_ADRESSES, type Porteur } from './liage';
import { InspectPanel } from './InspectPanel';
import { CampaignView } from './CampaignView';
import { Inspector } from './editor/Inspector';
import { addEnemyMember } from '../noyau/sceneEdit';
import { placeEntity } from './editor/editorState';
import { emptyScene } from '../noyau/monde/scene';
import type { NarratifBlock } from '../data/schemas/defs-scenes/narratif';
import { useGameKeyboard } from './clavier/useGameKeyboard';
import { resetStageFrames } from '../gameIso/stage/stageFrames';
import { DELAI_APPUI_LONG } from './useLongPress';
import type { Combatant } from '../engine/types';
import type { Scene } from '../noyau/monde/scene';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let host: HTMLDivElement | null = null;
let root: Root | null = null;

function monter(el: React.ReactElement): HTMLDivElement {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => { root!.render(el); });
  return host;
}

afterEach(() => {
  if (root) act(() => { root!.unmount(); });
  host?.remove();
  host = null; root = null;
  resetStageFrames();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** Le texte lisible d'une prose markdown : ses premiers mots, sans balisage. */
const extrait = (md: string): string => md.replace(/[*_#>[\]]/g, '').trim().slice(0, 40);

const DESC_KNUD = (): string => presetPnjById('edo-knud-cratinx')!.profil!.desc!;

/** Id du document de projet sous lequel le contenu du scénario est chargé EN CAMPAGNE. */
const PROJET = 'projet-des-presets';

/** Le porteur de projet tel que l'état courant le résout : l'injection d'`InspectPanel`. */
const duNarratif = (cle: 'presetsPnj', id: string, suite: string): Porteur | undefined => porteurDuNarratif(useGame.getState(), cle, id, suite);

/** Ajoutée à la desc de chaque profil décrit : un terme du Codex, qui ne se lie que sous un porteur
 *  (les desc de Knud et de Phillipe n'en citent aucun). */
const CITATION = ' La Peur le précède.';

/** Le contenu du scénario des presets EDO, les desc de profil augmentées de `CITATION`, chargé par
 *  `loadProject` comme `poserScenario` le charge : EN CAMPAGNE sous le document `PROJET`, ou en
 *  SCÉNARIO (`projet: null`). */
function poser(enCampagne: boolean): void {
  const c = scenario.construire();
  const narratif = c.narratif!;
  const presetsPnj = narratif.presetsPnj.map((p) => (p.profil?.desc ? { ...p, profil: { ...p.profil, desc: p.profil.desc + CITATION } } : p));
  useGame.getState().setParty(c.party);
  useGame.getState().loadProject({
    scenes: [c.scene, ...(c.extraScenes ?? [])],
    entryId: c.scene.id,
    worldMap: c.worldMap ?? null,
    narratif: { ...narratif, presetsPnj },
    projet: enCampagne ? { id: PROJET } : null,
  });
}

/** Le contenu posé (`poser`), combat `enc-knud` lancé. */
function combatKnud(enCampagne = false): Combatant {
  poser(enCampagne);
  useGame.getState().startCombat('enc-knud');
  const knud = useGame.getState().battle?.combatants.find((c) => c.label === 'Knud Cratinx');
  expect(knud, 'Knud absent du combat').toBeTruthy();
  return knud!;
}

const onglet = (el: HTMLElement, nom: string): HTMLButtonElement | undefined =>
  [...el.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((b) => b.textContent === nom);

/** Les deux panneaux de la fiche, empilés : [Profil, Description]. */
const panneaux = (el: HTMLElement): HTMLElement[] => [...el.querySelectorAll<HTMLElement>('.insp-onglets > *')];

function cliquer(el: HTMLElement, nom: string): void {
  const tab = onglet(el, nom);
  expect(tab, `onglet « ${nom} » absent`).toBeTruthy();
  act(() => { tab!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
}

/** Ouvre l'onglet « Description » et rend son panneau, le seul lisible. */
function ouvrirDescription(el: HTMLElement): HTMLElement {
  cliquer(el, 'Description');
  const actifs = panneaux(el).filter((p) => !p.hasAttribute('inert'));
  expect(actifs).toHaveLength(1);
  return actifs[0];
}

/** Les mentions liées (`CodexRef`) d'un rendu, par leur texte. */
const liens = (el: Element): string[] => [...el.querySelectorAll('.codex-ref')].map((a) => a.textContent ?? '');

/** Les mentions que lie `md` sous `porteur`, rendu hors de tout écran. */
const liensSous = (md: string, porteur: Porteur): string[] => {
  const html = renderToStaticMarkup(<Prose md={md} porteur={porteur} />);
  return [...html.matchAll(/class="[^"]*codex-ref[^"]*"[^>]*>([^<]*)/g)].map((m) => m[1]);
};

/** Le porteur du profil de Knud dans le document `PROJET` : 2e preset du narratif du scénario. */
const PORTEUR_KNUD: Porteur = { type: 'projet', id: PROJET, chemin: 'narratif.presetsPnj[1].profil.desc' };

/** Une scène nue qui porte un PNJ par preset. */
const sceneAuPreset = (presetId: string): Scene =>
  ({ id: 'sc-preset', label: 'Preset', entities: [{ id: 'pnj', kind: 'personnage', pos: { x: 1, y: 1 }, presetId }] } as unknown as Scene);

describe('InspectPanel — le geste d’inspection ouvre la fiche (geste réel, #1822)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', (media: string) => ({ matches: false, media, addEventListener() {}, removeEventListener() {} }));
  });

  const dialogue = (): HTMLElement => document.querySelector<HTMLElement>('[role="dialog"]')!;
  const clicDroit = (el: HTMLElement) => act(() => { el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); });

  it('EN CAMPAGNE, clic droit sur le portrait de Knud dans la frise : onglet « Description », la desc de SON profil, portée par le projet, liens armés', () => {
    const knud = combatKnud(true);
    useGame.setState({ inspectId: null });
    const el = monter(<CampaignView />);
    const portrait = [...el.querySelectorAll<HTMLElement>('.initiative-strip [title="Knud Cratinx"]')][0];
    expect(portrait, 'portrait de Knud absent de la frise').toBeTruthy();
    clicDroit(portrait);
    expect(useGame.getState().inspectId).toBe(knud.id);
    const dlg = dialogue();
    expect(dlg.textContent).toContain('Knud Cratinx');
    expect(onglet(dlg, 'Profil')).toBeTruthy();
    const pane = ouvrirDescription(dlg);
    expect(pane.textContent).toContain(extrait(DESC_KNUD()));
    const attendus = liensSous(DESC_KNUD(), PORTEUR_KNUD);
    expect(attendus.length, 'la desc du profil de Knud cite des entrées du Codex').toBeGreaterThan(0);
    expect(liens(pane)).toEqual(attendus);
  });

  it('un personnage POSÉ à l’éditeur puis passé au preset se nomme du preset — titre de l’inspection et frise ; un nom d’auteur l’emporte (#1463 S3)', () => {
    const narratif: NarratifBlock = { ...emptyNarratif(), presetsPnj: [{ id: 'pnj-tavernier', base: 'humain', profil: { label: 'Le Tavernier' } }] };
    const vide = emptyScene('scene-test', 8, 8);
    vide.id = 'sc-pose';
    vide.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 1, y: 1 } });
    const posee = placeEntity(vide, { mode: 'entity', kind: 'personnage', ref: 'humain' }, { x: 5, y: 4 });
    const pose = addEnemyMember(posee.scene, '', 'humain', { x: 5, y: 4 });
    expect(pose.entityId, 'l’outil de combat enrôle le personnage posé').toBe(posee.id);
    let scene = pose.scene;
    const editer = (geste: (racine: HTMLElement) => void): void => {
      const rendre = (sc: Scene) => root!.render(
        <Inspector
          scene={sc} otherScenes={[]} worldMap={null}
          setScene={(next) => { scene = next; act(() => rendre(next)); }}
          sel={{ type: 'entity', id: pose.entityId }} setSel={() => undefined}
          enemyCreatures={[{ id: 'humain', label: 'Humain' }]} openLogic={() => undefined} resizeScene={() => undefined}
          narratif={narratif} tool={{ mode: 'select' }} armZoneTiles={() => undefined} zoneFocusKey={null}
        />,
      );
      const racine = monter(<></>);
      act(() => rendre(scene));
      geste(racine);
      act(() => { root!.unmount(); });
      host?.remove();
      host = null; root = null;
    };
    const saisir = (el: HTMLInputElement | HTMLSelectElement, v: string) => act(() => {
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')!.set!.call(el, v);
      el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
    });
    const titreDeFrise = (nom: string): HTMLElement | null => {
      useGame.getState().setParty(makePregens().slice(0, 1));
      useGame.getState().loadProject({ scenes: [scene], entryId: scene.id, narratif, projet: null });
      useGame.getState().startCombat(pose.encId, undefined, { noSurprise: true });
      useGame.setState({ inspectId: null });
      const el = monter(<CampaignView />);
      return el.querySelector<HTMLElement>(`.initiative-strip [title="${nom}"]`);
    };

    expect(scene.entities.find((e) => e.id === pose.entityId)).not.toHaveProperty('label');
    editer((racine) => {
      const preset = [...racine.querySelectorAll('select')].find((el) => el.closest('label')?.textContent?.includes('Preset PNJ'))!;
      saisir(preset, 'pnj-tavernier');
      expect(racine.querySelector('.insp-title')?.textContent, 'titre de l’inspecteur de l’éditeur').toContain('Le Tavernier');
    });
    const portrait = titreDeFrise('Le Tavernier');
    expect(portrait, 'frise : le nom du preset').toBeTruthy();
    clicDroit(portrait!);
    expect(dialogue().querySelector('h3')?.textContent).toBe('Le Tavernier');
    act(() => { root!.unmount(); });
    host?.remove();
    host = null; root = null;

    editer((racine) => {
      const libelle = [...racine.querySelectorAll('input')].find((el) => el.closest('label')?.textContent?.startsWith('Libellé'))!;
      expect(libelle.placeholder).toBe('Le Tavernier');
      saisir(libelle, 'Hans');
    });
    clicDroit(titreDeFrise('Hans')!);
    expect(dialogue().querySelector('h3')?.textContent).toBe('Hans');
  });

  it('EN SCÉNARIO, la même Description reste NUE : aucun document de projet, aucun lien', () => {
    combatKnud();
    useGame.setState({ inspectId: null });
    const el = monter(<CampaignView />);
    clicDroit(el.querySelector<HTMLElement>('.initiative-strip [title="Knud Cratinx"]')!);
    const pane = ouvrirDescription(dialogue());
    expect(pane.textContent).toContain(extrait(DESC_KNUD()));
    expect(liensSous(DESC_KNUD(), PORTEUR_KNUD).length, 'la desc se lierait sous un porteur').toBeGreaterThan(0);
    expect(pane.querySelector('.codex-ref'), 'prose de profil sans projet : aucun lien').toBeNull();
  });

  it('la fiche ouverte : le pied du cadre est FRÈRE du corps, jamais dedans, et rien n’a défilé', () => {
    combatKnud();
    const el = monter(<CampaignView />);
    clicDroit(el.querySelector<HTMLElement>('.initiative-strip [title="Knud Cratinx"]')!);
    const modal = dialogue();
    const corps = modal.querySelector<HTMLElement>(':scope > .modal-body')!;
    const pied = modal.querySelector<HTMLElement>('.cadre-pied')!;
    expect(corps, 'corps du cadre').toBeTruthy();
    expect(pied, 'pied du cadre').toBeTruthy();
    expect(pied.parentElement, 'le pied est un enfant direct de la boîte').toBe(modal);
    expect(corps.contains(pied), 'le pied ne vit jamais dans le corps qui défile').toBe(false);
    expect(modal.scrollTop).toBe(0);
    expect(corps.scrollTop).toBe(0);
  });

  it('Maj+F10 sur le portrait de Knud FOCALISÉ : la même fiche', () => {
    const knud = combatKnud();
    const el = monter(<CampaignView />);
    const portrait = el.querySelector<HTMLElement>('.initiative-strip [title="Knud Cratinx"]')!;
    act(() => { portrait.focus(); portrait.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, cancelable: true })); });
    expect(useGame.getState().inspectId).toBe(knud.id);
    expect(dialogue().textContent).toContain('Knud Cratinx');
  });

  it('appui long sur le portrait de Knud : la même fiche', () => {
    const knud = combatKnud();
    const el = monter(<CampaignView />);
    const portrait = el.querySelector<HTMLElement>('.initiative-strip [title="Knud Cratinx"]')!;
    act(() => { portrait.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 5, clientY: 5, pointerId: 1, pointerType: 'touch' })); });
    act(() => { vi.advanceTimersByTime(DELAI_APPUI_LONG); });
    expect(useGame.getState().inspectId).toBe(knud.id);
  });

  it('clic droit sur un portrait du BANDEAU de groupe : la fiche de ce héros — son clic gauche, lui, ouvre la fiche de personnage', () => {
    combatKnud();
    const heros = useGame.getState().party[0];
    const el = monter(<CampaignView />);
    const tuile = el.querySelector<HTMLElement>(`.party-dock [title="${heros.label} — fiche du personnage"]`)!;
    expect(tuile, 'tuile du bandeau absente').toBeTruthy();
    clicDroit(tuile);
    expect(useGame.getState().inspectId).toBe(heros.id);
    expect(dialogue().textContent).toContain(heros.label);
    expect(useGame.getState().sheetId, 'le clic droit n’ouvre pas la fiche de personnage').toBeNull();
  });

  it('hors combat, touche I sur le PNJ survolé (`npc-phillipe`) : sa fiche, résolue sur la scène', () => {
    poserScenario(useGame.getState, scenario);
    useGame.setState({ inspectId: null, screen: 'campaign' });
    function Clavier() { useGameKeyboard(); return null; }
    monter(<><Clavier /><CampaignView /></>);
    // Le rideau d'ouverture de la scène se lève d'abord, comme le joueur le lève.
    const terminer = [...dialogue().querySelectorAll('button')].find((b) => b.textContent === 'Terminer')!;
    act(() => { terminer.click(); });
    expect(document.querySelector('[role="dialog"]'), 'rideau levé').toBeNull();
    act(() => { useGame.setState({ hovered: 'npc-phillipe' }); });
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyI' })); });
    expect(useGame.getState().inspectId).toBe('npc-phillipe');
    const dlg = dialogue();
    expect(dlg.textContent).toContain('Phillipe Descartes');
    const prose = proseDeFiche(sceneNpc(useGame.getState().scene, 'npc-phillipe', presetPnjById)!, presetPnjById, duNarratif);
    expect(prose, 'Phillipe est un preset DÉCRIT').toBeTruthy();
    expect(ouvrirDescription(dlg).textContent).toContain(extrait((prose!.section.rows[0] as { text: string }).text));
  });

  it('hors combat EN CAMPAGNE, touche I sur `npc-phillipe` : la desc de son profil, portée par le projet, liens armés', () => {
    poser(true);
    useGame.setState({ inspectId: null, screen: 'campaign' });
    function Clavier() { useGameKeyboard(); return null; }
    monter(<><Clavier /><CampaignView /></>);
    const terminer = [...dialogue().querySelectorAll('button')].find((b) => b.textContent === 'Terminer')!;
    act(() => { terminer.click(); });
    act(() => { useGame.setState({ hovered: 'npc-phillipe' }); });
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyI' })); });
    expect(useGame.getState().inspectId).toBe('npc-phillipe');
    const desc = presetPnjById('edo-phillipe-descartes')!.profil!.desc!;
    const attendus = liensSous(desc, { type: 'projet', id: PROJET, chemin: 'narratif.presetsPnj[2].profil.desc' });
    expect(attendus.length, 'la desc du profil de Phillipe cite des entrées du Codex').toBeGreaterThan(0);
    expect(liens(ouvrirDescription(dialogue()))).toEqual(attendus);
  });
});

describe('proseDeFiche — provenance de la Description (#2206)', () => {
  it('EN CAMPAGNE, preset au profil DÉCRIT sur base décrite (Knud, base `mutant`) : la desc du PROFIL, portée par son champ du projet', () => {
    const knud = combatKnud(true);
    expect(knud.porteurDeFiche?.presetId).toBe('edo-knud-cratinx');
    const p = proseDeFiche(knud, presetPnjById, duNarratif)!;
    expect(findCreatureById('mutant')?.desc).toBeTruthy();
    expect(p.section.rows).toEqual([{ t: 'text', text: DESC_KNUD(), porteur: PORTEUR_KNUD }]);
    expect(p.entree).toBeUndefined();
  });

  it('EN SCÉNARIO, la desc du même profil est NUE', () => {
    const knud = combatKnud();
    const p = proseDeFiche(knud, presetPnjById, duNarratif)!;
    expect(p.section.rows).toEqual([{ t: 'text', text: DESC_KNUD(), porteur: undefined }]);
    expect(p.entree).toBeUndefined();
  });

  it('le chemin ÉMIS pour un profil appartient à `CHEMINS_ADRESSES` (forme générique)', () => {
    const p = proseDeFiche(combatKnud(true), presetPnjById, duNarratif)!;
    const row = p.section.rows[0] as { porteur?: { type?: string; chemin: string } };
    const forme = row.porteur!.chemin.replace(/\[\d+\]/g, '[]');
    expect(row.porteur!.type).toBe('projet');
    expect(CHEMINS_ADRESSES.some((c) => c.type === 'projet' && c.chemin === forme), `« ${forme} » hors de la liste fermée`).toBe(true);
  });

  it('preset au profil MUET sur base décrite : la desc de la BASE, portée par la base — liens Codex actifs', () => {
    // Base `squelette` : sa desc cite des entrées du Codex (celle de `mutant` n'en cite aucune).
    useGame.setState({ campaignNarratif: { ...emptyNarratif(), presetsPnj: [{ id: 'pnj-muet', base: 'squelette', profil: { label: 'Squelette muet' } }] } });
    const c = sceneNpc(sceneAuPreset('pnj-muet'), 'pnj', presetPnjById)!;
    const p = proseDeFiche(c, presetPnjById, duNarratif)!;
    expect(p.section.rows).toEqual([{ t: 'text', text: findCreatureById('squelette')!.desc, porteur: { chemin: 'desc' } }]);
    expect(p.entree).toEqual({ type: 'creatures', id: 'squelette' });
    const pane = ouvrirDescription(monter(<InspectPanel combatant={c} onClose={() => {}} />).ownerDocument.body);
    expect(pane.textContent).toContain(extrait(findCreatureById('squelette')!.desc!));
    expect(pane.querySelector('.codex-ref'), 'prose portée : liens du catalogue').toBeTruthy();
    expect(pane.querySelector('h3'), 'l’onglet nomme déjà la Description : aucun titre de section').toBeNull();
  });

  it('fiche FIGÉE dont le texte n’est ni la desc du profil de son preset ni celle de sa base, en campagne : prose NUE', () => {
    const figee = mergeCreatureProfile(findCreatureById('squelette')!, { desc: 'Un texte écrit ailleurs.' });
    const c = spawnEnemy({ presetCreature: figee, presetId: 'pnj-fige' }, 'f', { x: 0, y: 0 });
    const enCampagne = (): Porteur => ({ type: 'projet', id: PROJET, chemin: 'narratif.presetsPnj[0].profil.desc' });
    const presetDe = (id: string) => (id === 'pnj-fige' ? { id, base: 'squelette', profil: { desc: 'Le texte du profil, depuis réécrit.' } } : undefined);
    const p = proseDeFiche(c, presetDe, enCampagne)!;
    expect(findCreatureById('squelette')?.desc).toBeTruthy();
    expect(p.section.rows).toEqual([{ t: 'text', text: 'Un texte écrit ailleurs.', porteur: undefined }]);
    expect(p.entree).toBeUndefined();
  });

  it('preset que `presetDe` ne résout pas : prose NUE', () => {
    const c = spawnEnemy({ presetCreature: findCreatureById('squelette')!, presetId: 'pnj-inconnu' }, 'i', { x: 0, y: 0 });
    const p = proseDeFiche(c, () => undefined, duNarratif)!;
    expect(p.section.rows).toEqual([{ t: 'text', text: findCreatureById('squelette')!.desc, porteur: undefined }]);
    expect(p.entree).toBeUndefined();
  });

  it('créature du catalogue par réf : sa desc, portée par sa fiche Codex', () => {
    const c = spawnEnemy({ ref: 'mutant' }, 'm', { x: 0, y: 0 });
    expect(proseDeFiche(c, presetPnjById, duNarratif)).toEqual({
      section: { title: '', layout: 'list', rows: [{ t: 'text', text: findCreatureById('mutant')!.desc, porteur: { chemin: 'desc' } }] },
      entree: { type: 'creatures', id: 'mutant' },
    });
  });
});

describe('DoD #2206 — la Description d’un preset de `la-diligence`, portée par le projet', () => {
  it('campagne lancée par `lancerCampagne` : la desc de SON profil, rendue par `Prose` sous `narratif.presetsPnj[1].profil.desc`', () => {
    useGame.setState(useGame.getInitialState());
    useGame.getState().setParty(makePregens().slice(0, 1));
    expect(lancerCampagne(useGame.getState, campagneDuJeu(diligenceCampaign))).toBeNull();
    const gustav = sceneNpc(sceneAuPreset('edo-gustav-fondleburger'), 'pnj', presetPnjById)!;
    const desc = presetPnjById('edo-gustav-fondleburger')!.profil!.desc!;
    const porteur: Porteur = { type: 'projet', id: 'la-diligence', chemin: 'narratif.presetsPnj[1].profil.desc' };
    expect(proseDeFiche(gustav, presetPnjById, duNarratif)!.section.rows).toEqual([{ t: 'text', text: desc, porteur }]);
    const pane = ouvrirDescription(monter(<InspectPanel combatant={gustav} onClose={() => {}} />).ownerDocument.body);
    expect(pane.textContent).toContain(extrait(desc));
    expect(liens(pane)).toEqual(liensSous(desc, porteur));
  });

  it('même chemin pour `edo-mutant-terenz` (rang 14), dont la desc cite le Codex : liens armés', () => {
    useGame.setState(useGame.getInitialState());
    useGame.getState().setParty(makePregens().slice(0, 1));
    expect(lancerCampagne(useGame.getState, campagneDuJeu(diligenceCampaign))).toBeNull();
    const terenz = sceneNpc(sceneAuPreset('edo-mutant-terenz'), 'pnj', presetPnjById)!;
    const desc = presetPnjById('edo-mutant-terenz')!.profil!.desc!;
    const porteur: Porteur = { type: 'projet', id: 'la-diligence', chemin: 'narratif.presetsPnj[14].profil.desc' };
    expect(proseDeFiche(terenz, presetPnjById, duNarratif)!.section.rows).toEqual([{ t: 'text', text: desc, porteur }]);
    expect(liensSous(desc, porteur).length, 'la desc de Terenz cite une entrée du Codex').toBeGreaterThan(0);
    const pane = ouvrirDescription(monter(<InspectPanel combatant={terenz} onClose={() => {}} />).ownerDocument.body);
    expect(liens(pane)).toEqual(liensSous(desc, porteur));
  });
});

describe('InspectPanel — sans prose, ni onglet ni bloc vide', () => {
  const sansOnglets = (c: Combatant) => {
    expect(proseDeFiche(c, presetPnjById, duNarratif)).toBeNull();
    const el = monter(<InspectPanel combatant={c} onClose={() => {}} />).ownerDocument.body;
    expect(el.querySelector('[role="tab"]')).toBeNull();
    expect(el.textContent).not.toContain('Description');
    expect(el.textContent).toContain('Caractéristiques');
  };

  it('Josef (`npc-josef`, profil sans prose, base `humain` sans desc)', () => {
    poserScenario(useGame.getState, scenario);
    expect(findCreatureById('humain')?.desc).toBeFalsy();
    const josef = sceneNpc(useGame.getState().scene, 'npc-josef', presetPnjById)!;
    expect(josef.porteurDeFiche?.presetId).toBe('edo-josef-quartjin');
    sansOnglets(josef);
  });

  it('un combattant à statbloc', () => {
    sansOnglets(spawnEnemy({ statblock: { type: 'statblock', label: 'Brute', char: { 'capacite-de-combat': 40, B: 10 } } }, 'sb', { x: 0, y: 0 }));
  });

  it('un héros', () => {
    sansOnglets(createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Gunnar', seed: 3 }));
  });
});

describe('Aller-retour de l’état : `presetId` survit, `presetPnjById` répond', () => {
  beforeEach(() => { vi.useFakeTimers(); });

  it('snapshot coop (couture de `snapshotSave`) : Knud garde son preset et sa Description, portée par le projet', () => {
    const knud = combatKnud(true);
    const data = JSON.parse(JSON.stringify(instantaneDeLaCoop(useGame.getState()))) as Record<string, unknown>;
    useGame.setState({ battle: null, campaignNarratif: null, campaignDoc: null });
    expect(presetPnjById('edo-knud-cratinx')).toBeUndefined();
    applyNetSnapshot(useGame.setState, data);
    const revenu = useGame.getState().battle!.combatants.find((c) => c.id === knud.id)!;
    expect(revenu.porteurDeFiche?.presetId).toBe('edo-knud-cratinx');
    expect(presetPnjById('edo-knud-cratinx')).toBeTruthy();
    expect(proseDeFiche(revenu, presetPnjById, duNarratif)?.section.rows[0]).toEqual({ t: 'text', text: DESC_KNUD(), porteur: PORTEUR_KNUD });
  });

  it('sauvegarde locale (hors combat) : le porteur d’une reconstitution programmée garde son `presetId`', () => {
    const knud = combatKnud();
    const porteur = knud.porteurDeFiche!;
    useGame.setState({ battle: null, mode: 'exploration', scheduledEffects: [{ executeAt: 1, respawn: { caster: { id: knud.id, label: knud.label, kind: knud.kind, pos: { x: 0, y: 0 } }, summon: { porteur, count: 1 } } }] as never });
    expect(useGame.getState().saveGame(1)).toBe(true);
    useGame.setState({ scheduledEffects: [], campaignNarratif: null });
    expect(useGame.getState().loadGame(1)).toBe(true);
    const relu = (useGame.getState().scheduledEffects[0] as { respawn: { summon: { porteur: typeof porteur } } }).respawn.summon.porteur;
    expect(relu.presetId).toBe('edo-knud-cratinx');
    expect(presetPnjById(relu.presetId!)).toBeTruthy();
  });
});

describe('InspectPanel — hauteur stable entre onglets', () => {
  it('les deux panneaux restent montés dans la même cellule ; seul l’actif est lisible', () => {
    useGame.setState({ campaignNarratif: { ...emptyNarratif(), presetsPnj: [{ id: 'pnj-muet', base: 'squelette', profil: { label: 'Squelette muet' } }] } });
    const el = monter(<InspectPanel combatant={sceneNpc(sceneAuPreset('pnj-muet'), 'pnj', presetPnjById)!} onClose={() => {}} />).ownerDocument.body;
    const lisibles = () => panneaux(el).map((p) => !p.hasAttribute('inert') && p.getAttribute('aria-hidden') !== 'true');
    expect(el.querySelector('.insp-onglets')).toBeTruthy();
    expect(lisibles()).toEqual([true, false]);
    cliquer(el, 'Description');
    expect(lisibles()).toEqual([false, true]);
    cliquer(el, 'Profil');
    expect(lisibles()).toEqual([true, false]);
  });
});

describe('Parité des liens : Description d’InspectPanel (réf) = onglet Description de la fiche Codex', () => {
  it.each(['squelette', 'troll', 'mutant'])('%s', (id) => {
    const item = codexLookupById('creatures', id)!;
    const codex = monter(<CodexEntry item={item} category="creatures" />);
    const attendus = liens(codex.querySelector('.codex-tabpane.codex-body')!);
    act(() => { root!.unmount(); });
    host!.remove();
    root = null; host = null;
    const insp = ouvrirDescription(monter(<InspectPanel combatant={spawnEnemy({ ref: id }, 'r', { x: 0, y: 0 })} onClose={() => {}} />).ownerDocument.body);
    expect(liens(insp)).toEqual(attendus);
    if (id === 'squelette') expect(attendus.length, 'la desc de `squelette` cite des entrées du Codex').toBeGreaterThan(0);
  });
});
