// @vitest-environment jsdom
/**
 * Beat d'ouverture du combat — il dit la surprise RÉELLEMENT résolue (LDB 13 l.52-81). Son animation
 * ne se joue qu'au montage : monté pendant la cascade de Surprise, il jouerait « COMBAT ! » sous la
 * fenêtre et l'embuscade ne serait jamais dite. Mesuré sur le chemin RÉEL (`startCombat` d'une
 * rencontre `surprise: 'party'`, aucun pending forgé).
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { seedBattleRng } from '../state/battleRng';
import { testScene } from '../scenes/test-fixture';
import { createHero } from '../engine/character';
import { COND, hasCondition } from '../engine/conditions';
import { CombatStartSplash } from './CombatStartSplash';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let host: HTMLDivElement;
let root: Root;
const render = () => act(() => { root.render(<CombatStartSplash />); });
const beat = () => host.querySelector('.combat-splash');
/** Le MOT porte la matière partagée du grand titre, son échelle et son ton : `data-ton` vit là, pas
 *  sur la pose plein-champ (#1806). */
const mot = () => host.querySelector('.combat-splash .display-title');

/** Ouvre le combat de la fixture ; `surprise` rend la rencontre EMBUSQUÉE (le groupe est surpris). */
function ouvrir(surprise?: 'party') {
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  // Guetteur aveugle : l'opposition de Surprise est perdue quel que soit le dé.
  const guetteur = { ...hero, skills: [], characteristics: { ...hero.characteristics, initiative: 1 } };
  useGame.setState({ party: [guetteur] });
  useGame.getState().startScene({ ...testScene, encounters: testScene.encounters.map((e) => ({ ...e, surprise })) });
  act(() => { useGame.getState().startCombat('enc-mutants'); });
}

beforeEach(() => {
  seedBattleRng(7);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useGame.setState({ pendingCascade: null, pendingRoundStart: null, battle: null, party: [], mode: 'exploration' });
});

describe('CombatStartSplash — le beat attend la cascade d’ouverture', () => {
  it('sans surprise : le beat se monte à l’entrée, sans ton', () => {
    ouvrir();
    render();
    expect(useGame.getState().pendingCascade, 'aucune cascade d’ouverture').toBeNull();
    expect(beat(), 'le beat est monté').not.toBeNull();
    expect(mot(), 'le mot pose la matière partagée du grand titre').not.toBeNull();
    expect(mot()!.classList.contains('halo-champ'), 'le mot flotte sur le monde nu : il pose le halo').toBe(true);
    expect(mot()!.getAttribute('data-echelle')).toBe('champ');
    expect(mot()!.getAttribute('data-ton'), 'sans surprise, aucun ton').toBeNull();
    expect(mot()!.textContent).toContain('COMBAT');
  });

  it('embuscade : absent TANT QUE la cascade de Surprise est ouverte, puis monté au ton de l’embuscade', () => {
    ouvrir('party');
    render();
    const cascade = useGame.getState().pendingCascade;
    expect(cascade, 'la Surprise ouvre sa cascade avant tout tour').not.toBeNull();
    expect(beat(), 'rien ne se joue sous la fenêtre de Surprise').toBeNull();

    for (const p of cascade!.participants[0].participants ?? []) act(() => { useGame.getState().cascadeBatchRoll(p.id); });
    act(() => { useGame.getState().cascadeNext(); });
    render();

    const s = useGame.getState();
    expect(s.pendingCascade, 'la cascade est close').toBeNull();
    expect(s.battle!.combatants.some((c) => c.kind === 'hero' && hasCondition(c, COND.surpris)), 'le guetteur aveugle est Surpris').toBe(true);
    expect(beat(), 'le beat se monte à la clôture : son animation part du bon mot').not.toBeNull();
    expect(mot()!.getAttribute('data-ton'), 'le MOT porte le ton de menace').toBe('menace');
    expect(mot()!.textContent).toContain('EMBUSCADE');
    expect(beat()!.getAttribute('data-ton'), 'la pose plein-champ ne porte plus le ton').toBeNull();
  });
});
