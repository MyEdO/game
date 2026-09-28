// @vitest-environment jsdom
/**
 * `Planche` : squelette unique de la fiche et de la feuille de navire (aside, onglets, corps
 * d'onglet). Défileurs (`styles/planche.css`) : au-delà de 700px, un par colonne côte à côte (l'aside
 * et le corps d'onglet) ; à 700px et moins, colonnes empilées, la planche entière et elle seule.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, onTestFinished } from 'vitest';
import { readFileSync } from 'node:fs';
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Planche } from './Planche';
import { reglesCss } from '../../scripts/guards/lib/cssCouches.mjs';

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
});

describe('Planche — structure', () => {
  it('boîte `planche` sous voile de référence, croix seule en tête ; aside ouverte par le nom, puis onglets au-dessus du corps d’onglet', () => {
    act(() => root.render(
      <Planche nom="Test" kind="fiche-test" onClose={() => {}} aside={<p>Présence</p>} tabs={<nav className="onglets">Onglets</nav>}>
        <p>Corps</p>
      </Planche>,
    ));
    const voile = host.querySelector('.modal-overlay')!;
    expect(voile.getAttribute('data-taille')).toBe('planche');
    expect(voile.getAttribute('data-voile')).toBe('reference');
    const tete = host.querySelector('.modal-tete')!;
    expect([...tete.children].map((e) => (e.matches('.cadre-fermer') ? 'croix' : e.className))).toEqual(['croix']);
    expect(host.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Test');
    const layout = host.querySelector('.modal-body > .sheet-layout')!;
    expect([...layout.children].map((e) => e.className)).toEqual(['sheet-aside', 'sheet-main']);
    expect([...layout.querySelector('.sheet-aside')!.children].map((e) => e.textContent)).toEqual(['Test', 'Présence']);
    const main = layout.querySelector('.sheet-main')!;
    expect([...main.children].map((e) => e.className)).toEqual(['onglets', 'sheet-tabbody']);
    expect(main.querySelector('.sheet-tabbody')?.textContent).toBe('Corps');
  });

  it('sans onglets, le corps d’onglet est seul dans la colonne principale', () => {
    act(() => root.render(<Planche nom="Feuille" kind="k" onClose={() => {}} aside={null}><p>Corps</p></Planche>));
    expect([...host.querySelector('.sheet-main')!.children].map((e) => e.className)).toEqual(['sheet-tabbody']);
  });
});

/** Les éléments de la planche qui DÉFILENT, lus sur sa feuille : règles hors média, puis celles de
 *  la requête ≤700px quand `etroit`. */
function defileurs(etroit: boolean): string[] {
  const css = readFileSync('src/ui/styles/planche.css', 'utf8');
  const overflow = new Map<string, string>();
  for (const r of reglesCss(css).sort((x, y) => Number(!!x.media) - Number(!!y.media))) {
    if (r.media && !etroit) continue;
    const valeur = /overflow-y:\s*([\w-]+)/.exec(r.corps)?.[1];
    if (valeur) for (const sel of r.selecteurs) overflow.set(sel, valeur);
  }
  return [...overflow].filter(([, v]) => v === 'auto' || v === 'scroll').map(([sel]) => sel).sort();
}

describe('Planche — défileurs', () => {
  it('au-delà de 700px, colonnes côte à côte : un défileur par colonne', () => {
    expect(defileurs(false)).toEqual(['.sheet-aside', '.sheet-tabbody']);
  });
  it('à 700px et moins, colonnes empilées : la planche entière est le SEUL défileur', () => {
    expect(defileurs(true)).toEqual(['.sheet-layout']);
  });
});

describe('Planche — mémoire par onglet : une grandeur, le décalage dans le corps d’onglet', () => {
  const memo: Record<string, number> = {};
  const Hote = ({ cle }: { cle: string }) => (
    <Planche nom="Fiche" kind="k" onClose={() => {}} aside={<p>Présence</p>} tabs={<nav>Onglets</nav>}
      memoire={{ cle, lire: () => memo[cle] ?? 0, retenir: (top) => { memo[cle] = top; } }}>
      <p>Corps</p>
    </Planche>
  );
  const el = (sel: string) => host.querySelector(sel) as HTMLElement;
  const defiler = (sel: string, top: number) => act(() => {
    el(sel).scrollTop = top;
    el(sel).dispatchEvent(new Event('scroll'));
  });
  beforeEach(() => { for (const k of Object.keys(memo)) delete memo[k]; });

  it('au-delà de 700px, le corps d’onglet défile : il retient et rend le décalage de chaque onglet', () => {
    act(() => root.render(<Hote cle="a" />));
    defiler('.sheet-tabbody', 191);
    expect(memo).toEqual({ a: 191 });
    act(() => root.render(<Hote cle="b" />));
    expect(el('.sheet-tabbody').scrollTop, 'l’onglet b s’ouvre en haut').toBe(0);
    act(() => root.render(<Hote cle="a" />));
    expect(el('.sheet-tabbody').scrollTop, 'l’onglet a reprend où on l’a laissé').toBe(191);
  });

  it('à 700px et moins, la planche défile : un clic d’onglet laisse la barre d’onglets en tête de fenêtre, jamais la présence', () => {
    const BARRE = 400;
    // Mise en page empilée : la colonne principale commence 400px sous le haut de la planche.
    const reel = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      const planche = this.closest<HTMLElement>('.sheet-layout');
      return { top: this.classList.contains('sheet-main') && planche ? BARRE - planche.scrollTop : 0 } as DOMRect;
    };
    onTestFinished(() => { HTMLElement.prototype.getBoundingClientRect = reel; });
    // `StrictMode` : l'effet de montage joue deux fois en développement, sans changer d'onglet.
    const monter = (cle: string) => act(() => root.render(<StrictMode><Hote cle={cle} /></StrictMode>));
    monter('a');
    const layout = el('.sheet-layout');
    const barreDansLaFenetre = () => el('.sheet-main').getBoundingClientRect().top - layout.getBoundingClientRect().top;
    expect(layout.scrollTop, 'à l’ouverture, la présence est en vue').toBe(0);

    defiler('.sheet-layout', BARRE + 191);
    expect(memo, 'même grandeur qu’au-delà de 700px : le décalage dans le corps').toEqual({ a: 191 });

    monter('b');
    expect(barreDansLaFenetre(), 'onglet neuf : la barre d’onglets en tête, le haut du corps juste dessous').toBe(0);

    monter('a');
    expect(barreDansLaFenetre(), 'onglet a : la barre, plus son décalage').toBe(-191);

    defiler('.sheet-layout', 100);
    expect(memo.a, 'remonté dans la présence : le corps d’onglet est à son haut').toBe(0);
  });
});
