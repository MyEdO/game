// @vitest-environment jsdom
/**
 * #535 DoD (verbatim, `gh issue view 535`) : « à la fin du tirage des 10 caractéristiques, la
 * première rangée d'allocation non soldée est visible sans scroll manuel ». Comportemental RÉEL
 * (clic + cérémonie séquentielle réelle, minuteurs `vi.useFakeTimers`) — pas seulement le mécanisme
 * générique de `PlaqueRow.test.tsx`, mais le DÉCLENCHEUR posé par `CharScreen` (front descendant de
 * `seq`, `CharacterCreator.tsx`).
 */
import { describe, it, expect, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CharScreen } from './CharacterCreator';
import { newDraft, withSpecies, withCareer, type CreatorDraft } from '../../noyau/creation/brouillon';
import { species as allSpecies, careersForSpecies } from '../../data';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const SP = allSpecies.find((s) => s.source.book === 'livre-de-base')!;
const CAREER = careersForSpecies(SP.refCareer)[0]!;

describe('CharScreen — auto-scroll de la 1ʳᵉ rangée d’allocation NON SOLDÉE à la fin du tirage (#535 DoD)', () => {
  let container: HTMLDivElement;
  let root: Root;
  let draft: CreatorDraft;
  const scrollSpy = vi.fn();
  const originalScrollIntoView = Element.prototype.scrollIntoView;

  beforeEach(() => {
    vi.useFakeTimers();
    Element.prototype.scrollIntoView = scrollSpy;
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    Element.prototype.scrollIntoView = originalScrollIntoView;
    scrollSpy.mockClear();
    vi.useRealTimers();
  });

  function mount(preset?: (d: CreatorDraft) => CreatorDraft) {
    draft = withCareer(withSpecies(newDraft(7), SP.id), CAREER.id);
    if (preset) draft = preset(draft);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const setD = (next: CreatorDraft) => {
      draft = next;
      act(() => { root.render(<CharScreen d={draft} setD={setD} />); });
    };
    act(() => { root.render(<CharScreen d={draft} setD={setD} />); });
  }

  /** Clic sur « Tirer les dix jets » puis déroule la cérémonie séquentielle (10 × `CHAR_SEQ_MS`) en
   *  temps virtuel — le geste réel du joueur, pas un raccourci `rollDraftChars` direct. Un tick
   *  PAR PALIER (chacun dans son propre `act`) : `vi.advanceTimersByTime` en UNE seule salve ne
   *  laisse pas React reposer l'effet `setTimeout` suivant entre deux paliers de la cérémonie
   *  (constaté : la séquence reste bloquée à `seq=1` sans ce séquençage). */
  function rollThenFinishCeremony() {
    const btn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Tirer les dix jets'))!;
    act(() => { btn.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    for (let i = 0; i < 11; i++) act(() => { vi.advanceTimersByTime(400); }); // 10 rangées + marge finale
  }

  it("aucun scroll « attention » avant/pendant le tirage — seul le mécanisme `rolling` (par rangée) agit pendant la cérémonie", () => {
    mount();
    expect(scrollSpy).not.toHaveBeenCalled(); // page fraîche : rien ne roule, rien à ramener en vue
  });

  it('à la FIN du tirage, la 1ʳᵉ rangée d’« Augmentations gratuites » (non soldée, allocTotal=0) est ramenée en vue', () => {
    mount();
    rollThenFinishCeremony();
    expect(container.textContent).toContain('10/10 tirées'); // preuve que la cérémonie a RÉELLEMENT fini (pas restée bloquée)
    expect(scrollSpy).toHaveBeenCalled();
    const lastCallEl = scrollSpy.mock.instances[scrollSpy.mock.instances.length - 1] as Element;
    // La rangée « Le tirage » (ceremony) ET la rangée « Augmentations gratuites » portent TOUTES
    // DEUX le libellé « Capacité de Tir » (même carac CT) : on désambiguïse par la présence du
    // `AllocStepper` (`.cart-step`, allocation) — jamais posé sur une rangée de la cérémonie.
    expect(lastCallEl.querySelector('.cart-step')).toBeTruthy();
    expect(lastCallEl.textContent).toContain('Capacité de Tir'); // 1ʳᵉ carac de carrière de l'Agitateur (CT)
  });

  it('revisiter l’étape SANS re-tirer (pas de nouveau front descendant de `seq`) ne redéclenche AUCUN scroll', () => {
    mount();
    rollThenFinishCeremony();
    scrollSpy.mockClear();
    // Remonte le MÊME écran avec le brouillon déjà tiré (aucun nouveau clic « Tirer aux dés ») :
    // un remount frais du composant n'a jamais vu de front `number → null` (seq part directement de `null`).
    act(() => { root.render(<CharScreen d={draft} setD={() => {}} />); });
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it("une fois l'allocation « Augmentations gratuites » soldée AVANT le tirage, la cible bascule sur « Destin & Résilience »", () => {
    // Solde manuellement les 5 Augmentations sur la 1ʳᵉ carac de carrière AVANT de tirer — scénario
    // réel (joueur qui alloue puis tire, ou navigue puis revient) : la cible doit suivre l'état RÉEL,
    // jamais rester figée sur une bande déjà pleine.
    mount((d) => ({ ...d, charAdvancesAlloc: { 'capacite-de-tir': 5 } }));
    rollThenFinishCeremony();
    expect(container.textContent).toContain('10/10 tirées');
    expect(scrollSpy).toHaveBeenCalled();
    const lastCallEl = scrollSpy.mock.instances[scrollSpy.mock.instances.length - 1] as Element;
    expect(lastCallEl.textContent).toContain('Points de Destin');
  });
});
