// @vitest-environment jsdom
/**
 * L2 #1548 — `reverseFailed.skills` est une LISTE (Pilote → Ramer OU Voile, `LDB 10 l.964`) et le
 * contrôle MONO de l'atelier n'en édite que la TÊTE : reposer la 1ʳᵉ Compétence CONSERVE la QUEUE.
 * Geste RÉEL : sélection dans le `<select>` monté par `CombatField`.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CombatField } from '../editor/codex/StructFields';
import type { CombatFeature } from '../../engine/combatFeatures/types';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root;
let valeur: Partial<CombatFeature> | undefined;

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

function mount(initial: Partial<CombatFeature>) {
  valeur = initial;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const onChange = (v: Partial<CombatFeature> | undefined) => {
    valeur = v;
    act(() => { root.render(<CombatField value={valeur} onChange={onChange} allFeatures={[]} />); });
  };
  act(() => { root.render(<CombatField value={valeur} onChange={onChange} allFeatures={[]} />); });
}

/** Le `<select>` des Compétences de `reverseFailed` (celui qui propose les ids du dataset `skills`). */
function selectDesCompetences(): HTMLSelectElement {
  const s = Array.from(container.querySelectorAll('select')).find(
    (el) => Array.from(el.options).some((o) => o.value === 'ramer'),
  );
  if (!s) throw new Error('select des Compétences absent');
  return s;
}

/** Choix utilisateur dans un `<select>` contrôlé React (setter natif + événement `change`). */
function choisir(select: HTMLSelectElement, v: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(select, v);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('CombatField — reverseFailed.skills (L2 #1548)', () => {
  it('reposer la TÊTE conserve la 2ᵉ Compétence de la liste', () => {
    mount({ reverseFailed: { skills: [{ id: 'ramer' }, { id: 'voile' }] } });
    choisir(selectDesCompetences(), 'athletisme');
    expect(valeur?.reverseFailed?.skills).toEqual([{ id: 'athletisme' }, { id: 'voile' }]);
  });

  it('reposer la spec de la TÊTE conserve aussi la queue', () => {
    mount({ reverseFailed: { skills: [{ id: 'ramer' }, { id: 'voile' }], capDR: 2 } });
    const spec = container.querySelector('input[placeholder="spec"]') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    act(() => {
      setter.call(spec, 'chaloupe');
      spec.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(valeur?.reverseFailed?.skills).toEqual([{ id: 'ramer', spec: 'chaloupe' }, { id: 'voile' }]);
    expect(valeur?.reverseFailed?.capDR).toBe(2);
  });
});
