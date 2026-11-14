// @vitest-environment jsdom
/**
 * Fenêtres de Test ÉTENDU : la barre de DR annonce le cumul que le geste applique (`progresEtendu.ts`,
 * `issueDuRound`), règle optionnelle « DR 0 = ±1 » comprise. LDB 12 l.170-185
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { createHero } from '../engine/character';
import { setRule, resetRule } from '../engine/policy';
import { FocusModal } from './FocusModal';
import { DispelModal } from './DispelModal';
import { ActivityModal } from './ActivityModal';
import { CascadeBody } from './CascadeModal';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  resetRule('test-etendu-dr-minimum');
  resetRule('magie-vdm-incantation');
  useGame.setState({ pendingFocus: null, pendingDispel: null, pendingActivity: null, pendingExtendedTest: null, pendingCascade: null, battle: null, party: [], suspendedCascades: [] });
});

const barres = () => [...host.querySelectorAll('.dr-bar-val')].map((n) => n.textContent?.replace(/\s+/g, ' ').trim());
const heros = () => createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W', seed: 1, careerTalent: { id: 'magie-mineure' }, talentsRolled: false });

describe('barre de DR des fenêtres de Test étendu', () => {
  it('Focalisation (LDB 46 l.130) : réserve 3, échec DR −2 sur NI 8 → 1 / 8 DR', () => {
    const w = heros();
    w.focus = { spell: 'manifestation-de-demon-mineur', dr: 3 };
    useGame.setState({ party: [w], battle: null,
      pendingFocus: { casterId: w.id, spellId: 'manifestation-de-demon-mineur', result: { dr: 0, success: false, sl: -2, isCritical: false, isFumble: false, roll: 87, target: 65, log: 'échec' } } });
    act(() => { root.render(<FocusModal />); });
    expect(barres()).toEqual(['1 / 8 DR']);
  });

  it('Dissipation de son PROPRE Sort (VDM 02 l.186) : cumul 1, réussite DR 0 → 2 / 5 DR', () => {
    setRule('magie-vdm-incantation', true);
    const w = heros();
    w.dispel = { spellId: 'armure-aethyrique', spellCasterId: w.id, total: 1 };
    useGame.setState({ party: [w], battle: null,
      pendingDispel: { casterId: w.id, spellId: 'armure-aethyrique', spellCasterId: w.id, label: 'Armure aethyrique', ni: 5, value: 40, ligne: { base: 40, mods: [], target: 40, difficulty: 'intermediaire' }, result: { roll: 40, target: 40, sl: 0, success: true } } as never });
    act(() => { root.render(<DispelModal />); });
    expect(barres()).toEqual(['2 / 5 DR']);
  });

  it('Artisanat sous « DR 0 = ±1 » (LDB 12 l.185) : 2 DR, réussite DR 0 → 3 / 6 DR', () => {
    setRule('test-etendu-dr-minimum', true);
    const w = heros();
    useGame.setState({ party: [w], battle: null,
      pendingActivity: { heroId: w.id, kind: 'catalog', activityId: 'craft', label: 'Artisanat', skillLabel: 'Métier', skillValue: 40, difficulty: 'intermediaire', ligne: { base: 40, mods: [], target: 40, difficulty: 'intermediaire' },
        roll: 40, target: 40, sl: 0, success: true, drBefore: 2, drTarget: 6 } as never });
    act(() => { root.render(<ActivityModal />); });
    expect(barres()).toEqual(['3 / 6 DR']);
  });

  it('Test étendu de scène sous « DR 0 = ±1 » (LDB 12 l.185) : total 2, Round réussi à DR 0 → 3 / 5 DR', () => {
    setRule('test-etendu-dr-minimum', true);
    const w = heros();
    useGame.setState({ party: [w], battle: null });
    useGame.getState().ouvrirLeTestEtendu({ actorId: w.id, label: 'Serrure', skillLabel: 'Crochetage', target: 40, drCible: 5 });
    const p = useGame.getState().pendingExtendedTest!;
    useGame.setState({ pendingExtendedTest: { ...p, total: 2, rounds: [{ ...p.rounds[0], result: { roll: 40, sl: 0, success: true } }] } as never });
    act(() => { root.render(<CascadeBody />); });
    expect(barres()).toEqual(['3 / 5 DR']);
  });
});
