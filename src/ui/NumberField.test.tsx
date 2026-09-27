// @vitest-environment jsdom
/**
 * #1318 E1 — contrats de la primitive `NumberField`, mesurés au DOM RENDU (pas à la lecture de la
 * source). Trois axes indépendants, croisés ici parce qu'ils se contredisent facilement :
 *  - la VARIANTE (`complet`/`champ`/`nu`) décide de ce qui entoure le champ ;
 *  - la BORNE, tenue à UN endroit (`cale`), ne cale QUE ce qui est borné — un entier de donnée sans
 *    domaine (page de source, modificateur signé) ne doit jamais être ramené vers un plancher fictif ;
 *  - le COMMIT (`frappe`/`geste`) décide du moment ET de la politique hors-domaine (caler / REFUSER).
 */
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NumberField } from './NumberField';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root;

function mount(node: React.ReactElement) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(node); });
}

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

const champ = () => container.querySelector('input[type="number"]') as HTMLInputElement;

/** Frappe RÉELLE dans un `<input>` contrôlé par React : le setter natif contourne le cache de
 *  valeur de React, sans quoi l'événement `change` ne porte pas la nouvelle valeur. */
function saisir(texte: string) {
  const input = champ();
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(input, texte);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('NumberField — variantes', () => {
  it('`complet` : champ + compteur + plage dite, le libellé lié par htmlFor (jamais autour des boutons)', () => {
    mount(<NumberField id="nf" label="Joueurs" min={2} max={8} value={3} unit="joueurs" onChange={vi.fn()} />);
    const label = container.querySelector('label.field') as HTMLLabelElement;
    expect(label.htmlFor).toBe('nf');
    expect(label.querySelector('button')).toBeNull();
    expect(container.querySelectorAll('button').length).toBe(2); // le compteur, HORS du label
    expect((container.querySelector('p.hint') as HTMLElement).textContent).toBe('De 2 à 8 joueurs.');
  });

  it('`champ` : libellé + saisie, NI compteur NI plage dite', () => {
    mount(<NumberField variant="champ" label="Dé choisi" min={1} max={100} value={7} onChange={vi.fn()} />);
    expect(container.querySelector('label.field')).not.toBeNull();
    expect(container.querySelectorAll('button').length).toBe(0);
    expect(container.querySelector('p.hint')).toBeNull();
  });

  it('`nu` : la saisie SEULE, et le libellé devient le nom accessible (jamais un champ anonyme)', () => {
    mount(<NumberField variant="nu" label="Enc à acheter" min={1} max={9} value={4} onChange={vi.fn()} />);
    expect(container.querySelector('label')).toBeNull();
    expect(container.querySelectorAll('button').length).toBe(0);
    expect(champ().getAttribute('aria-label')).toBe('Enc à acheter');
  });

  it('`ariaLabel` précise le nom accessible sans changer le libellé AFFICHÉ (N champs homonymes)', () => {
    mount(<NumberField variant="champ" label="Fixer le dé" ariaLabel="Fixer le dé — Voile" min={1} max={100} value={5} onChange={vi.fn()} />);
    expect((container.querySelector('label.field > span') as HTMLElement).textContent).toBe('Fixer le dé');
    expect(champ().getAttribute('aria-label')).toBe('Fixer le dé — Voile');
  });
});

describe('NumberField — la borne ne cale QUE ce qui est borné (commit `frappe`)', () => {
  it('borné : au-dessus du max → calé au max ; en dessous du min → calé au min', () => {
    const onChange = vi.fn();
    mount(<NumberField variant="nu" label="Enc" min={1} max={9} value={4} onChange={onChange} />);
    saisir('42');
    expect(onChange).toHaveBeenLastCalledWith(9);
    saisir('-3');
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it('SANS bornes : `cale` est un no-op — le négatif et le très grand passent tels quels', () => {
    const onChange = vi.fn();
    mount(<NumberField variant="nu" label="Modificateur" value={0} onChange={onChange} />);
    saisir('-30');
    expect(onChange).toHaveBeenLastCalledWith(-30);
    saisir('9999');
    expect(onChange).toHaveBeenLastCalledWith(9999);
  });

  it('borne d’un SEUL côté : le côté absent ne cale rien', () => {
    const onChange = vi.fn();
    mount(<NumberField variant="nu" label="Montant" min={0} value={5} onChange={onChange} />);
    saisir('-4');
    expect(onChange).toHaveBeenLastCalledWith(0);
    saisir('100000');
    expect(onChange).toHaveBeenLastCalledWith(100000);
  });

  it('zéro n’est pas « vide » : `0` dans un champ à min 0 remonte 0, pas le plancher par défaut', () => {
    const onChange = vi.fn();
    mount(<NumberField variant="nu" label="Mise" min={0} max={50} value={5} onChange={onChange} />);
    saisir('0');
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it('non-entier : `cale` ne tronque pas, la borne seule décide (le pas reste au DOM)', () => {
    const onChange = vi.fn();
    mount(<NumberField variant="nu" label="Longueur" min={1} value={2} onChange={onChange} />);
    saisir('2.5');
    expect(onChange).toHaveBeenLastCalledWith(2.5);
  });

  it('le pas et les bornes sont ÉCRITS au DOM (le navigateur applique la même plage que `cale`)', () => {
    mount(<NumberField variant="nu" label="Réglage" min={2} max={20} step={5} value={7} onChange={vi.fn()} />);
    expect(champ().getAttribute('min')).toBe('2');
    expect(champ().getAttribute('max')).toBe('20');
    expect(champ().getAttribute('step')).toBe('5');
  });
});

describe('NumberField — le VIDE (`vide`)', () => {
  it('`vide` : champ vidé → `null` remonte, et le champ RESTE vide (jamais un 0 fabriqué)', () => {
    const onChange = vi.fn();
    mount(<NumberField variant="nu" label="Indice" vide value={7} onChange={onChange} />);
    saisir('');
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('`vide` : une valeur absente rend un champ VIDE, pas un « 0 »', () => {
    mount(<NumberField variant="nu" label="page" vide value={undefined} onChange={vi.fn()} />);
    expect(champ().value).toBe('');
  });

  it('NON `vide` : champ vidé → `cale(min ?? 0)`, borné comme non borné', () => {
    const borne = vi.fn();
    mount(<NumberField variant="nu" label="Quantité" min={3} max={9} value={5} onChange={borne} />);
    saisir('');
    expect(borne).toHaveBeenLastCalledWith(3);
    act(() => { root.unmount(); });
    container.remove();

    const libre = vi.fn();
    mount(<NumberField variant="nu" label="Modificateur" value={5} onChange={libre} />);
    saisir('');
    expect(libre).toHaveBeenLastCalledWith(0);
  });
});

describe('NumberField — commit `geste` : refus honnête, jamais un clamp silencieux', () => {
  it('la frappe reste LOCALE : rien ne remonte tant que le geste terminal n’a pas eu lieu', () => {
    const onChange = vi.fn();
    mount(<NumberField variant="champ" label="Fixer le dé" min={1} max={100} commit="geste" vide value={null} onChange={onChange} />);
    saisir('5');
    saisir('50');
    expect(onChange).not.toHaveBeenCalled();
    expect(champ().value).toBe('50');
  });

  it('Entrée pose la valeur, et la CONSOMME (la boîte hôte ne reçoit pas la touche)', () => {
    const onChange = vi.fn();
    const surTouche = vi.fn();
    mount(
      <div onKeyDown={surTouche}>
        <NumberField variant="champ" label="Fixer le dé" min={1} max={100} commit="geste" vide value={null} onChange={onChange} />
      </div>,
    );
    saisir('47');
    act(() => { champ().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
    expect(onChange).toHaveBeenCalledWith(47);
    expect(surTouche).not.toHaveBeenCalled();
  });

  it('hors domaine : REFUS annoncé (`aria-invalid` + domaine dit), retour à la dernière valeur commise — AUCUN clamp', () => {
    const onChange = vi.fn();
    mount(<NumberField variant="champ" label="Fixer le dé" min={1} max={10} commit="geste" vide value={3} onChange={onChange} />);
    saisir('47');
    act(() => { champ().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
    expect(onChange).not.toHaveBeenCalled(); // ni 47, ni 10 : la saisie est REFUSÉE
    expect(champ().value).toBe('3');
    expect(champ().getAttribute('aria-invalid')).toBe('true');
    const domaine = container.querySelector('[role="status"]') as HTMLElement;
    expect(domaine.textContent).toBe('1–10');
    expect(champ().getAttribute('aria-describedby')).toBe(domaine.id);
  });

  it('une valeur EXTERNE nouvelle resynchronise le brouillon, même sous StrictMode (l’atelier passe d’une fiche à une entrée neuve sans remonter le champ)', () => {
    mount(<StrictMode><NumberField variant="nu" label="Longueur — borne basse" min={1} commit="geste" value={81} onChange={vi.fn()} /></StrictMode>);
    expect(champ().value).toBe('81');
    act(() => { root.render(<StrictMode><NumberField variant="nu" label="Longueur — borne basse" min={1} commit="geste" value={1} onChange={vi.fn()} /></StrictMode>); });
    expect(champ().value).toBe('1');
  });

  it('champ VIDÉ puis Entrée : aucune saisie à refuser — pas d’état invalide', () => {
    mount(<NumberField variant="champ" label="Fixer le dé" min={1} max={10} commit="geste" vide value={3} onChange={vi.fn()} />);
    saisir('');
    act(() => { champ().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
    expect(champ().getAttribute('aria-invalid')).toBeNull();
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it('`commitOnBlur` : la perte de focus pose (défaut) ou ne pose RIEN là où poser est irréversible', () => {
    const pose = vi.fn();
    mount(<NumberField variant="champ" label="Dé" min={1} max={100} commit="geste" vide value={null} onChange={pose} />);
    saisir('12');
    act(() => { champ().dispatchEvent(new FocusEvent('focusout', { bubbles: true })); });
    expect(pose).toHaveBeenCalledWith(12);
    act(() => { root.unmount(); });
    container.remove();

    const jamais = vi.fn();
    mount(<NumberField variant="champ" label="Dé" min={1} max={100} commit="geste" commitOnBlur={false} vide value={null} onChange={jamais} />);
    saisir('12');
    act(() => { champ().dispatchEvent(new FocusEvent('focusout', { bubbles: true })); });
    expect(jamais).not.toHaveBeenCalled();
    expect(champ().value, 'le brouillon SURVIT au blur — c’est le CTA de l’hôte qui le consomme').toBe('12');
  });

  it('`commitRef` : l’hôte pose le brouillon depuis son propre bouton, et sait si une valeur est partie', () => {
    const onChange = vi.fn();
    const poignee: { current: null | (() => boolean) } = { current: null };
    mount(<NumberField variant="champ" label="Dé" min={1} max={100} commit="geste" commitOnBlur={false} commitRef={poignee} vide value={null} onChange={onChange} />);
    expect(poignee.current, 'la poignée est tenue tant que le champ est monté').not.toBeNull();
    let pose = false;
    act(() => { pose = poignee.current!(); });
    expect(pose, 'champ vide : rien n’est posé').toBe(false);
    saisir('33');
    act(() => { pose = poignee.current!(); });
    expect(pose).toBe(true);
    expect(onChange).toHaveBeenCalledWith(33);
  });

  it('`commitRef` : la poignée SURVIT au double montage de StrictMode (le montage RÉEL de l’app)', () => {
    const poignee: { current: null | (() => boolean) } = { current: null };
    mount(
      <StrictMode>
        <NumberField variant="champ" label="Dé" min={1} max={100} commit="geste" commitOnBlur={false} commitRef={poignee} vide value={null} onChange={vi.fn()} />
      </StrictMode>,
    );
    expect(poignee.current, 'le nettoyage JETÉ de StrictMode ne doit pas laisser l’hôte sans poignée').not.toBeNull();
    saisir('44');
    let pose = false;
    act(() => { pose = poignee.current!(); });
    expect(pose, 'et la poignée POSE encore').toBe(true);
  });

  it('le MODÈLE reprend la main : un dé changé ailleurs (bouton « 01 ») se reflète dans le champ', () => {
    mount(<NumberField variant="champ" label="Dé" min={1} max={100} commit="geste" vide value={null} onChange={vi.fn()} />);
    saisir('88');
    expect(champ().value).toBe('88');
    act(() => {
      root.render(<NumberField variant="champ" label="Dé" min={1} max={100} commit="geste" vide value={1} onChange={vi.fn()} />);
    });
    expect(champ().value).toBe('1');
  });
});
