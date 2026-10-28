// @vitest-environment jsdom
import { StrictMode, act, type JSX } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HouseRulesPanel } from './HouseRulesModal';
import { RetraitsDeChargement } from './RetraitsDeChargement';
import { chargerLesReglesMaisonWeb } from '../state/reglesMaison';
import { useGame } from '../state/store';
import { FORMAT_SAVE } from '../noyau/persistance/formats.generated';
import { OPTIONAL_RULES, rule } from '../engine/policy';
import { conditionIds } from '../data';
import { t } from '../i18n';

/**
 * Un document persisté que le registre courant ne reconnaît plus en PARTIE (#1463 LD.1) se charge élagué, et
 * l'écran NOMME au joueur ce qui a été retiré, par `ChipDeRefus` (`role="alert"`), sous StrictMode.
 */
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  } as Storage;
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function monter(noeud: JSX.Element): void {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(<StrictMode>{noeud}</StrictMode>));
}

const refusAffiches = (): string[] =>
  [...(container?.querySelectorAll('[role="alert"] p.chip.tone-danger.chip-phrase') ?? [])].map((p) => p.textContent ?? '');

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeStorage());
});

afterEach(() => {
  if (root) { act(() => root!.unmount()); root = null; }
  if (container) { container.remove(); container = null; }
  vi.unstubAllGlobals();
});

const drapeau = OPTIONAL_RULES.find((r) => r.kind === 'flag')!;

describe('règles maison persistées en partie refusées', () => {
  it('le panneau nomme les clés retirées, une fois ; les autres restent appliquées', () => {
    localStorage.setItem('wfrp4.house-rules', JSON.stringify({ [drapeau.id]: !drapeau.default, 'regle-hors-registre': true }));
    chargerLesReglesMaisonWeb();
    monter(<HouseRulesPanel />);
    expect(refusAffiches()).toEqual([t('houseRules.retirees', { liste: t('elagage.regles', { ids: 'regle-hors-registre' }) })]);
    expect(rule(drapeau.id)).toBe(!drapeau.default);
  });
});

describe('sauvegarde chargée élaguée', () => {
  it('la partie se charge et la fenêtre nomme la règle et l’État retirés ; « Fermer » la referme', () => {
    const connu = conditionIds()[0];
    const save = {
      version: FORMAT_SAVE, savedAt: '2026-10-26', sceneLabel: 'S', gameTime: 0,
      rules: { [drapeau.id]: !drapeau.default, 'regle-hors-registre': true },
      data: { party: [{ id: 'h', label: 'H', kind: 'hero', conditions: [{ id: connu, value: 1 }, { id: 'etat-hors-registre', value: 1 }] }] },
    };
    localStorage.setItem('wfrp4.save.1', JSON.stringify(save));
    expect(useGame.getState().loadGame(1)).toBe(true);
    expect(useGame.getState().party[0].conditions.map((c) => c.id)).toEqual([connu]);
    expect(rule(drapeau.id)).toBe(!drapeau.default);
    monter(<RetraitsDeChargement />);
    const liste = `${t('elagage.regles', { ids: 'regle-hors-registre' })} ; ${t('elagage.etats', { ids: 'etat-hors-registre' })}`;
    expect(refusAffiches()).toEqual([t('saveload.elague', { liste })]);
    const fermer = [...container!.querySelectorAll('button')].find((b) => b.textContent === t('saveload.btn.close'))!;
    act(() => fermer.click());
    expect(refusAffiches()).toEqual([]);
    expect(useGame.getState().retraitsDeChargement).toBeNull();
  });
});
