// @vitest-environment jsdom
/**
 * PIÈGE À FOCUS d'une modale de jet, monté pour de VRAI (`RollShell` → `Modal` → `RollRow`) : un
 * contrôle focalisé que la transition d'état DÉMONTE (« Résilience ×N » cède la place au sélecteur de
 * dé, « Lancer » cède la place au résultat) laissait le focus sur `<body>` — la tabulation suivante
 * s'échappait de la boîte vers l'arrière-plan (bug de recette navigateur). Le focus doit rester DANS
 * la boîte, sur le groupe révélé.
 * Patron réel du repo pour les tests interactifs : `createRoot`/`act` (pas de `@testing-library`).
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { poserLayoutJsdom } from './layoutJsdom.testkit';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { RollShell } from './RollShell';
import { buildRollRow } from './rollRowBuild';
import { testPending } from './breakdown';
import { tacheSuivante } from './focus.testkit';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

// Le focus circule ici pour de vrai : sans layout, le filtre de `Modal` ne verrait aucun focusable.
let retirerLayout: () => void;
beforeAll(() => { retirerLayout = poserLayoutJsdom(); });
afterAll(() => retirerLayout());

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
});

/** Le PORTRAIT d'arrière-plan (HUD) : la cible qu'attrapait la tabulation évadée. */
function backgroundButton(): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = 'Portrait HUD';
  document.body.appendChild(b);
  return b;
}

/**
 * Modale de jet MINIMALE mais réelle : la rangée pré-jet porte « Résilience ×2 » et « Lancer »
 * (hissé par la coquille), et la transition (`forced`) révèle le sélecteur de dé + la barre post-jet
 * — exactement le basculement du store en jeu.
 */
function Harness({ picker, de = 5 }: { picker: boolean; de?: number }) {
  const [rolled, setRolled] = useState(false);
  return (
    <RollShell
      title="Jet"
      rolled={rolled}
      rows={[{
        // Montée par la porte, puis RETOUCHÉE par spread : le harnais bascule de phase sans jamais
        // poser de `d` (fixture minimale), là où la porte dérive `rolled` de la donnée du jet.
        ...buildRollRow(
          {
            row: { pending: testPending('Corps à corps', 45) },
            onRoll: () => setRolled(true),
            onForce: () => setRolled(true),
          },
          {
            interactive: true,
            resilience: 2,
            rollFrisson: false,
            forcedRoll: picker && rolled ? { roll: de, target: 45, onSet: () => {} } : undefined,
          },
        ),
        rolled,
      }]}
      actions={[
        { key: 'cancel', label: 'Annuler', onClick: () => {} },
        { key: 'apply', label: 'Appliquer', onClick: () => {} },
      ]}
    />
  );
}

const box = () => host.querySelector('[role="dialog"]') as HTMLElement;
const byText = (txt: string) =>
  [...host.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes(txt))!;

async function render(picker: boolean, de?: number) {
  await act(async () => { root.render(<Harness picker={picker} de={de} />); });
}

describe('modale de jet — le focus ne tombe jamais sur <body> quand un contrôle est démonté', () => {
  it('« Résilience ×N » activé : le focus passe DANS le groupe de choix révélé (sélecteur de dé)', async () => {
    const bg = backgroundButton();
    await render(true);
    const resil = byText('Résilience ×2');
    act(() => { resil.focus(); });
    expect(document.activeElement).toBe(resil);

    await act(async () => { resil.click(); });
    await tacheSuivante();

    const group = host.querySelector('.rm-die-pick') as HTMLElement;
    expect(group, 'le groupe de choix du dé doit être révélé').not.toBeNull();
    expect(document.activeElement, 'focus tombé sur <body> : le piège Tab est rompu').not.toBe(document.body);
    expect(group.contains(document.activeElement)).toBe(true);
    expect(bg.contains(document.activeElement)).toBe(false);
    bg.remove();
  });

  it('« Résilience ×N » activé, un dé déjà RETENU dans le groupe révélé (« 01 · DR max ») : le focus va sur ce dé, pas sur « Appliquer »', async () => {
    await render(true, 1);
    const resil = byText('Résilience ×2');
    act(() => { resil.focus(); });
    await act(async () => { resil.click(); });
    await tacheSuivante();

    const group = host.querySelector('.rm-die-pick') as HTMLElement;
    expect(group, 'le groupe de choix du dé doit être révélé').not.toBeNull();
    expect((document.activeElement as HTMLElement).textContent, 'le dé retenu, pas le geste du pied').toContain('01');
    expect(group.contains(document.activeElement)).toBe(true);
  });

  it('« Lancer » activé (sans Résilience) : le focus reste dans la boîte, sur l’action primaire révélée', async () => {
    await render(false);
    const lancer = byText('Lancer');
    act(() => { lancer.focus(); });
    expect(document.activeElement).toBe(lancer);

    await act(async () => { lancer.click(); });
    // Le sauvetage de la boîte est lu à la tâche suivante (`useModalA11y`).
    await tacheSuivante();

    expect(document.activeElement).not.toBe(document.body);
    expect(box().contains(document.activeElement)).toBe(true);
    expect((document.activeElement as HTMLElement).textContent).toContain('Appliquer');
  });
});
