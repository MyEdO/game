// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { dismissStackKinds } from '../../state/dismissStack';
import { resetDismissLayers } from '../useDismissLayer';
import { CodexRef } from './CodexRef';

const mount = (node: React.ReactElement) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(node); });
  return { container, root };
};

/**
 * PILE DE CONGÉDIEMENT NEUVE avant chaque cas (`src/state/dismissStack.ts` + la porte clavier de
 * `src/ui/useDismissLayer.ts`) : ce sont des singletons de MODULE, que `src/test-setup.ts` ne remet pas
 * à plat. Sous `test.isolate: false` (vite.config.ts) le worker les partage : sans remise à plat, une
 * couche laissée par un fichier voisin — ou un refcount de porte décalé — décide si Échap atteint le
 * infobulle de ce banc. Même geste que les deux autres bancs de la couture (`ui/echap-pile-lifo.test.tsx:48`,
 * `ui/echap-couches-fantomes.test.tsx:39`).
 */
beforeEach(() => { resetDismissLayers(); });

/**
 * PRÉMISSE d'un appui d'Échap : la couche du DESSUS est bien celle de cette infobulle. Le congédiement va
 * à la couche du DESSUS (`dismissTop`) — sommet étranger = l'appui va à l'autre surface, l'infobulle reste à l'écran,
 * et le banc rougirait sur « l'infobulle n'est pas null » sans jamais nommer la vraie cause. Mesuré : une
 * couche étrangère empilée pendant le cas reproduit à l'identique le rouge CI de #1442, et le TEMPS n'y
 * change rien (la fermeture, elle, est synchrone : zéro tour d'attente nécessaire après l'appui).
 */
const sommetEstLInfobulle = (quoi: string): void => {
  const couches = dismissStackKinds();
  expect(couches[couches.length - 1], `PRÉMISSE : ${quoi} — la couche du dessus est ${JSON.stringify(couches)}`)
    .toBe('infobulle');
};

describe('CodexRef — Rules of Hooks (régression crash "Rendered fewer hooks than expected")', () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });
  let container: HTMLDivElement;
  let root: Root;
  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
  });

  it('entrée ABSENTE du catalogue : rend le repli sans crash', () => {
    ({ container, root } = mount(
      <CodexRef category="creatures" id="id-bidon-absent-xyz" label="Bidon" />,
    ));
    expect(container.textContent).toContain('Bidon');
  });

  it('re-rendu TROUVÉ → ABSENT sur le même arbre : le nombre de Hooks ne varie pas', () => {
    ({ container, root } = mount(
      <CodexRef category="creatures" id="cheval" label="Cheval" />,
    ));
    expect(container.textContent).toContain('Cheval');

    expect(() => {
      act(() => {
        root.render(<CodexRef category="creatures" id="id-bidon-absent-xyz" label="Bidon" />);
      });
    }).not.toThrow();
    expect(container.textContent).toContain('Bidon');
  });
});

/**
 * #1117 (recette 2026-08-05, vécu 3 fois) — une infobulle de chip AFFICHÉE (survol/focus sous `wrap`,
 * fermeture différée par le pont de survol) restait à l'écran par-dessus le CTA de la modale de jet et
 * INTERCEPTAIT le clic sur « Continuer » ; Échap ne le fermait pas. La couverture d'origine (#1078 B3a
 * « Échap en couches ») ne visait que l'infobulle ÉPINGLÉE — cas jamais couvert, pas régression.
 */
describe('CodexRef — Échap ferme l’infobulle AFFICHÉE, pas seulement l’épinglée (#1117)', () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });
  let container: HTMLDivElement;
  let root: Root;
  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
  });

  /** Chip de RESSOURCE : `wrap` (l'infobulle porte la seule porte vers la fiche, il est actionnable). */
  const chip = (
    <CodexRef category="talents" id="affable" label="Affable" wrap>
      <button type="button">Affable ×2</button>
    </CodexRef>
  );

  const pop = () => document.querySelector('.infobulle');

  it('l’infobulle affichée au survol se ferme sur Échap', () => {
    ({ container, root } = mount(chip));
    const trigger = container.querySelector('.codex-ref') as HTMLElement;
    act(() => { trigger.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
    expect(pop(), 'le survol affiche l’infobulle').toBeTruthy();
    sommetEstLInfobulle('l’infobulle affichée au survol doit être la couche que l’appui adresse');
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(pop(), 'Échap la ferme — elle ne peut plus recouvrir le CTA').toBeNull();
    expect(dismissStackKinds(), 'fermée, elle n’est plus une couche').toEqual([]);
  });

  it('sans infobulle affichée, Échap ne fait rien ici (la modale garde sa couche)', () => {
    ({ container, root } = mount(chip));
    expect(pop()).toBeNull();
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(pop()).toBeNull();
  });
});

describe('CodexRef — bascule `tooltipOnly` en TOGGLETIP : la bulle est ANNONCÉE par une région `role="status"`', () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });
  let container: HTMLDivElement;
  let root: Root;
  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
  });
  const terme = <CodexRef category="characteristics" id="mouvement" label="Mouvement" tooltipOnly>Mouvement</CodexRef>;
  const region = () => container.querySelector<HTMLElement>('[role="status"]');
  const touche = (el: HTMLElement, key: string) => act(() => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key, code: key === ' ' ? 'Space' : key, bubbles: true, cancelable: true }));
  });

  it('Entrée, Espace et clic : le texte de la bulle entre dans la région ; Entrée, Échap et clic ailleurs la vident', () => {
    ({ container, root } = mount(terme));
    const declencheur = container.querySelector<HTMLElement>('.codex-ref')!;
    expect(region(), 'la région existe AVANT l’activation (sinon rien n’est annoncé)').toBeTruthy();
    expect(region()!.textContent, 'fermée : région vide').toBe('');
    expect(declencheur.hasAttribute('aria-expanded'), 'le déclencheur d’un toggletip n’a pas d’état déplié').toBe(false);
    const ouvertures: [string, () => void][] = [
      ['Entrée', () => touche(declencheur, 'Enter')],
      ['Espace', () => touche(declencheur, ' ')],
      ['clic', () => act(() => { declencheur.click(); })],
    ];
    const fermetures: [string, () => void][] = [
      ['Entrée', () => touche(declencheur, 'Enter')],
      ['Échap', () => act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); })],
      ['clic ailleurs', () => act(() => { document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); })],
    ];
    for (const [i, [geste, ouvrir]] of ouvertures.entries()) {
      ouvrir();
      const bulle = document.querySelector<HTMLElement>('.infobulle');
      expect(bulle, `${geste} ouvre la bulle`).toBeTruthy();
      expect(region()!.textContent, `${geste} : la région annonce la bulle`).toContain('Mouvement');
      expect(region()!.textContent!.length, `${geste} : la région porte le corps de la bulle`).toBeGreaterThan('Mouvement'.length);
      const [fermeture, fermer] = fermetures[i];
      fermer();
      expect(document.querySelector('.infobulle'), `${fermeture} ferme la bulle`).toBeNull();
      expect(region()!.textContent, `${fermeture} : la région est vidée`).toBe('');
    }
  });
});

/**
 * #1117 — les deux CHEMINS distincts de l'infobulle, chacun sa preuve :
 *  - ÉPINGLÉ (le focus est parti DANS l'infobulle) : Échap doit RENDRE le focus au contrôle englobé ;
 *  - NON épinglée : l'infobulle ne doit JAMAIS voler le clic d'un bouton situé sous elle — c'est le
 *    symptôme vécu 3 fois en recette (« Continuer » injoignable).
 */
describe('CodexRef — chemin ÉPINGLÉ et interception de clic (#1117)', () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });
  let container: HTMLDivElement;
  let root: Root;
  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
  });

  const chip = (
    <CodexRef category="talents" id="affable" label="Affable" wrap>
      <button type="button">Affable ×2</button>
    </CodexRef>
  );

  it('ÉPINGLÉ (↓ depuis le contrôle focalisé) puis désépinglé (Échap) : le focus revient au contrôle englobé, et ce retour n’ouvre pas la bulle', () => {
    ({ container, root } = mount(chip));
    const inner = container.querySelector('.codex-ref button') as HTMLButtonElement;
    act(() => { inner.focus(); });
    expect(document.querySelector('.infobulle'), 'le focus du joueur ouvre la bulle').toBeTruthy();
    act(() => { inner.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); });
    expect(document.querySelector('.infobulle'), 'l’infobulle est épinglée').toBeTruthy();
    expect(document.activeElement, 'le focus est ENTRÉ dans l’infobulle, sur sa porte')
      .toBe(document.querySelector('.infobulle button'));
    sommetEstLInfobulle('l’infobulle épinglée doit être la couche que l’appui adresse');
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(document.activeElement, 'le focus REVIENT au contrôle, jamais dans le vide').toBe(inner);
    expect(document.querySelector('.infobulle'), 'le retour du focus ne rouvre pas la bulle').toBeNull();
    expect(dismissStackKinds(), 'refermé, il n’est plus une couche').toEqual([]);
  });

  it('Échap puis ↓ sur l’ancrage dont la boîte est fermée : elle s’épingle ET le focus y entre', () => {
    ({ container, root } = mount(chip));
    const inner = container.querySelector('.codex-ref button') as HTMLButtonElement;
    act(() => { inner.focus(); });
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(document.querySelector('.infobulle'), 'Échap ferme la boîte').toBeNull();
    expect(document.activeElement, 'le focus reste sur le contrôle').toBe(inner);
    act(() => { inner.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); });
    expect(document.querySelector('.infobulle'), '↓ rouvre et épingle la boîte').toBeTruthy();
    expect(document.activeElement, '↓ : le focus ENTRE dans la boîte, sur sa porte')
      .toBe(document.querySelector('.infobulle button'));
  });

  it('ÉPINGLÉ puis désépinglé par un clic sur un AUTRE contrôle : le focus reste sur ce contrôle, l’invocateur ne le vole pas', () => {
    ({ container, root } = mount(
      <>
        {chip}
        <button type="button" id="autre">Autre</button>
      </>,
    ));
    const inner = container.querySelector('.codex-ref button') as HTMLButtonElement;
    const autre = container.querySelector('#autre') as HTMLButtonElement;
    act(() => { inner.focus(); });
    act(() => { inner.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); });
    expect(document.activeElement, 'épinglé : le focus est sur la porte').toBe(document.querySelector('.infobulle button'));
    // Un clic réel : `mousedown` (qui désépingle) puis, action par défaut, le focus du contrôle cliqué.
    act(() => {
      autre.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      autre.focus();
    });
    expect(document.querySelector('.infobulle'), 'le clic dehors désépingle').toBeNull();
    expect(document.activeElement, 'le focus reste sur le contrôle cliqué').toBe(autre);
  });

  it('NON épinglé : un bouton SOUS l’infobulle reçoit bien le clic (plus d’interception)', () => {
    ({ container, root } = mount(
      <>
        {chip}
        <button type="button" id="continuer">Continuer</button>
      </>,
    ));
    const trigger = container.querySelector('.codex-ref') as HTMLElement;
    act(() => { trigger.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
    const pop = document.querySelector('.infobulle') as HTMLElement;
    expect(pop, 'l’infobulle est affichée (survol)').toBeTruthy();
    // Le clic part sur le CTA : il ne doit pas être capté par la surface de l'infobulle restée ouverte.
    let clicked = 0;
    const cta = container.querySelector('#continuer') as HTMLButtonElement;
    cta.addEventListener('click', () => { clicked++; });
    act(() => { cta.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
    act(() => { cta.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(clicked, 'le CTA a reçu son clic').toBe(1);
    // Et le `mousedown` hors infobulle l'a refermée : la surface ne reste pas au-dessus du CTA.
    expect(document.querySelector('.infobulle')).toBeNull();
  });
});

/**
 * RAISON D'UN REFUS (arbitrage user 2026-08-24) — l'infobulle partagée la porte, donc elle doit être
 * ATTEIGNABLE par les trois entrées : souris (survol), clavier/manette (focus RÉEL du contrôle, pas un
 * événement forgé), et DOIGT (un tap MONTRE la raison — le contrôle refusé n'agit pas). Et la boîte de
 * SECOURS (`fallback` sans entrée au catalogue) reste, elle, atteignable au pointeur : sans quoi son
 * contenu serait affiché mais inaccessible.
 */
describe('CodexRef — la raison d’un refus s’atteint au survol, au FOCUS et au TAP', () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });
  let container: HTMLDivElement;
  let root: Root;
  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
  });

  /** Un contrôle REFUSÉ tel que `GatedAction` le rend : `aria-disabled` (pas `disabled`), donc
   *  focalisable — enveloppé de l'infobulle qui porte sa raison. */
  const refuse = (
    <CodexRef label="Charger" refus="Vous êtes Engagé." wrap>
      <button type="button" aria-disabled="true">Charger</button>
    </CodexRef>
  );
  const raison = () => document.querySelector('.infobulle [data-refus]')?.textContent ?? null;

  it('FOCUS RÉEL du contrôle (clavier, manette) : la raison s’ouvre, le blur la referme', () => {
    ({ container, root } = mount(refuse));
    const btn = container.querySelector('button') as HTMLButtonElement;
    expect(btn.disabled, 'un contrôle `disabled` ne prendrait JAMAIS le focus').toBe(false);
    act(() => { btn.focus(); });
    expect(document.activeElement, 'le contrôle refusé doit prendre le focus').toBe(btn);
    expect(raison(), 'le focus n’ouvre pas la raison').toBe('Vous êtes Engagé.');
    act(() => { btn.blur(); });
    expect(document.querySelector('.infobulle'), 'le blur doit refermer').toBeNull();
  });

  it('TAP (aucun survol, aucun focus préalable) : le clic MONTRE la raison au lieu d’agir', () => {
    let agi = 0;
    ({ container, root } = mount(
      <CodexRef label="Charger" refus="Vous êtes Engagé." wrap>
        <button type="button" aria-disabled="true" onClick={() => { agi += 1; }}>Charger</button>
      </CodexRef>,
    ));
    const btn = container.querySelector('button') as HTMLButtonElement;
    act(() => { btn.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(raison(), 'au doigt, rien n’ouvrait la raison').toBe('Vous êtes Engagé.');
    // Le tap reste ÉPINGLÉ (il n'y a pas de survol au doigt pour la maintenir), et un 2ᵉ tap referme.
    act(() => { btn.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(document.querySelector('.infobulle')).toBeNull();
    expect(agi, 'le contrôle refusé n’a agi (son propre `onClick` est le no-op de l’appelant)').toBe(2);
  });

  it('boîte de SECOURS (`fallback` sous `wrap`) : elle reste atteignable au pointeur', () => {
    ({ container, root } = mount(
      <CodexRef category="trappings" id="arme-invoquee-xyz" label="Lame invoquée" wrap
        fallback={{ sub: 'invoquée', body: 'Profil temporaire.' }}>
        <button type="button">Lame invoquée</button>
      </CodexRef>,
    ));
    const trigger = container.querySelector('.codex-ref') as HTMLElement;
    act(() => { trigger.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
    const pop = document.querySelector('.infobulle') as HTMLElement;
    expect(pop, 'le repli doit s’afficher').toBeTruthy();
    expect(pop.hasAttribute('data-atteignable'), 'une boîte affichée mais inatteignable au pointeur').toBe(true);
    // … et le pont de survol la maintient le temps que le pointeur y arrive.
    act(() => { trigger.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })); });
    expect(document.querySelector('.infobulle'), 'le pont de survol ne tient pas').toBeTruthy();
  });
});
