// @vitest-environment jsdom
/** #2206 — la `desc` de la fiche d'un PNJ atteint le joueur : onglet « Description » de `InspectPanel`. */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { poserScenario } from '../state/scenarioFlow';
import { scenario } from '../scenes/test-scenarios/96-presets-edo';
import { presetPnjById, mergeCreatureProfile } from '../state/campaignData';
import { sceneNpc } from '../state/sceneNpc';
import { spawnEnemy } from '../state/spawn';
import { netSnapshot, applyNetSnapshot } from '../state/netFlow';
import { emptyNarratif } from '../state/campaignNarratif';
import { createHero } from '../engine/character';
import { findCreatureById } from '../data';
import { proseDeFiche } from './compendium/registry';
import { InspectPanel } from './InspectPanel';
import { CampaignView } from './CampaignView';
import { useGameKeyboard } from './useGameKeyboard';
import { resetStageFrames } from '../gameIso/stage/stageFrames';
import type { Combatant } from '../engine/types';
import type { Scene } from '../state/scene';

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

/** Le scénario des presets EDO posé (narratif chargé par `loadProject`), combat `enc-knud` lancé. */
function combatKnud(): Combatant {
  poserScenario(useGame.getState, scenario);
  useGame.getState().startCombat('enc-knud');
  const knud = useGame.getState().battle?.combatants.find((c) => c.label === 'Knud Cratinx');
  expect(knud, 'Knud absent du combat').toBeTruthy();
  return knud!;
}

const onglet = (el: HTMLElement, nom: string): HTMLButtonElement | undefined =>
  [...el.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((b) => b.textContent === nom);

function ouvrirDescription(el: HTMLElement): HTMLElement {
  const tab = onglet(el, 'Description');
  expect(tab, 'onglet « Description » absent').toBeTruthy();
  act(() => { tab!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  return el.querySelector<HTMLElement>('.insp-statblock')!;
}

/** Une scène nue qui porte un PNJ par preset. */
const sceneAuPreset = (presetId: string): Scene =>
  ({ id: 'sc-preset', label: 'Preset', entities: [{ id: 'pnj', kind: 'personnage', pos: { x: 1, y: 1 }, presetId }] } as unknown as Scene);

describe('InspectPanel — le mode Inspection ouvre la Description d’un preset (geste réel)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', (media: string) => ({ matches: false, media, addEventListener() {}, removeEventListener() {} }));
  });

  it('touche I puis clic sur le portrait de Knud dans la frise : onglet « Description », la desc de SON profil, nue', () => {
    const knud = combatKnud();
    useGame.setState({ inspectEnabled: false, inspectId: null });
    function Clavier() { useGameKeyboard(); return null; }
    const el = monter(<><Clavier /><CampaignView /></>);
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyI' })); });
    expect(useGame.getState().inspectEnabled).toBe(true);
    const portrait = [...el.querySelectorAll<HTMLElement>('.initiative-strip [title="Knud Cratinx"]')][0];
    expect(portrait, 'portrait de Knud absent de la frise').toBeTruthy();
    act(() => { portrait.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(useGame.getState().inspectId).toBe(knud.id);
    const dlg = document.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dlg.textContent).toContain('Knud Cratinx');
    expect(onglet(dlg, 'Profil')).toBeTruthy();
    const pane = ouvrirDescription(dlg);
    expect(pane.textContent).toContain(extrait(DESC_KNUD()));
    expect(pane.querySelector('.codex-ref'), 'prose de profil : porteur projet absent, aucun lien').toBeNull();
  });
});

describe('proseDeFiche — provenance de la Description (#2206)', () => {
  it('preset au profil DÉCRIT sur base décrite (Knud, base `mutant`) : la desc du PROFIL, sans entrée', () => {
    const knud = combatKnud();
    expect(knud.porteurDeFiche?.presetId).toBe('edo-knud-cratinx');
    const p = proseDeFiche(knud, presetPnjById)!;
    expect(findCreatureById('mutant')?.desc).toBeTruthy();
    expect(p.section.rows).toEqual([{ t: 'text', text: DESC_KNUD(), porteur: { chemin: 'desc' } }]);
    expect(p.entree).toBeUndefined();
  });

  it('preset au profil MUET sur base décrite : la desc de la BASE, portée par la base — liens Codex actifs', () => {
    // Base `squelette` : sa desc cite des entrées du Codex (celle de `mutant` n'en cite aucune).
    useGame.setState({ campaignNarratif: { ...emptyNarratif(), presetsPnj: [{ id: 'pnj-muet', base: 'squelette', profil: { label: 'Squelette muet' } }] } });
    const c = sceneNpc(sceneAuPreset('pnj-muet'), 'pnj')!;
    const p = proseDeFiche(c, presetPnjById)!;
    expect(p.section.rows).toEqual([{ t: 'text', text: findCreatureById('squelette')!.desc, porteur: { chemin: 'desc' } }]);
    expect(p.entree).toEqual({ type: 'creatures', id: 'squelette' });
    const pane = ouvrirDescription(monter(<InspectPanel combatant={c} onClose={() => {}} />).ownerDocument.body);
    expect(pane.textContent).toContain(extrait(findCreatureById('squelette')!.desc!));
    expect(pane.querySelector('.codex-ref'), 'prose portée : liens du catalogue').toBeTruthy();
    expect(pane.querySelector('h3'), 'l’onglet nomme déjà la Description : aucun titre de section').toBeNull();
  });

  it('fiche FIGÉE dont le texte n’est pas la desc de sa base décrite, preset résolu : prose NUE', () => {
    const figee = mergeCreatureProfile(findCreatureById('squelette')!, { desc: 'Un texte écrit ailleurs.' });
    const c = spawnEnemy({ presetCreature: figee, presetId: 'pnj-fige' }, 'f', { x: 0, y: 0 });
    const p = proseDeFiche(c, (id) => (id === 'pnj-fige' ? { id, base: 'squelette' } : undefined))!;
    expect(findCreatureById('squelette')?.desc).toBeTruthy();
    expect(p.section.rows).toEqual([{ t: 'text', text: 'Un texte écrit ailleurs.', porteur: { chemin: 'desc' } }]);
    expect(p.entree).toBeUndefined();
  });

  it('preset que `presetDe` ne résout pas : prose NUE', () => {
    const c = spawnEnemy({ presetCreature: findCreatureById('squelette')!, presetId: 'pnj-inconnu' }, 'i', { x: 0, y: 0 });
    const p = proseDeFiche(c, () => undefined)!;
    expect(p.section.rows).toEqual([{ t: 'text', text: findCreatureById('squelette')!.desc, porteur: { chemin: 'desc' } }]);
    expect(p.entree).toBeUndefined();
  });

  it('créature du catalogue par réf : sa desc, portée par sa fiche Codex', () => {
    const c = spawnEnemy({ ref: 'mutant' }, 'm', { x: 0, y: 0 });
    expect(proseDeFiche(c, presetPnjById)).toEqual({
      section: { title: '', layout: 'list', rows: [{ t: 'text', text: findCreatureById('mutant')!.desc, porteur: { chemin: 'desc' } }] },
      entree: { type: 'creatures', id: 'mutant' },
    });
  });
});

describe('InspectPanel — sans prose, ni onglet ni bloc vide', () => {
  const sansOnglets = (c: Combatant) => {
    expect(proseDeFiche(c, presetPnjById)).toBeNull();
    const el = monter(<InspectPanel combatant={c} onClose={() => {}} />).ownerDocument.body;
    expect(el.querySelector('[role="tablist"]')).toBeNull();
    expect(el.textContent).not.toContain('Description');
    expect(el.textContent).toContain('Caractéristiques');
  };

  it('Josef (`npc-josef`, profil sans prose, base `batelier` sans desc)', () => {
    poserScenario(useGame.getState, scenario);
    expect(findCreatureById('batelier')?.desc).toBeFalsy();
    const josef = sceneNpc(useGame.getState().scene, 'npc-josef')!;
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

  it('snapshot coop (couture de `snapshotSave`) : Knud garde son preset et sa Description', () => {
    const knud = combatKnud();
    const data = JSON.parse(JSON.stringify(netSnapshot(useGame.getState))) as Record<string, unknown>;
    useGame.setState({ battle: null, campaignNarratif: null });
    expect(presetPnjById('edo-knud-cratinx')).toBeUndefined();
    applyNetSnapshot(useGame.setState, data);
    const revenu = useGame.getState().battle!.combatants.find((c) => c.id === knud.id)!;
    expect(revenu.porteurDeFiche?.presetId).toBe('edo-knud-cratinx');
    expect(presetPnjById('edo-knud-cratinx')).toBeTruthy();
    expect(proseDeFiche(revenu, presetPnjById)?.section.rows[0]).toEqual({ t: 'text', text: DESC_KNUD(), porteur: { chemin: 'desc' } });
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
