// @vitest-environment jsdom
/**
 * #1659 L-1659-3 — contrats de la primitive `PlageField`, mesurés au DOM RENDU. Elle est la SEULE
 * fourchette éditable du dépôt, et elle sert trois populations qui n'ont pas le même domaine :
 *  - le sous-tirage astral (1d10, ADE II 03 l.63) — OPTIONNEL, une entrée peut n'en avoir aucun ;
 *  - la taille de coque (mètres, MDG 12 l.122-129) — dernière bande OUVERTE (« 81+ », l.129) ;
 *  - la disponibilité saisonnière (d100, MDG 15 l.406-418 / MSRC 13 l.73-78) — quatre colonnes.
 *
 * Ce qui se vérifie ici est ce qui distingue une bande de table d'un nombre quelconque : ses bornes
 * ne se CALENT pas en silence (un clamp muet fait un trou dans une table), et une bande sans plafond
 * se LIT comme telle. Le dernier volet quitte la primitive pour ses DEUX sites RÉELS, montés dans le
 * vrai atelier (`CodexEdit`, mode `isNew`) : une fourchette REQUISE doit s'éditer sur une entrée
 * NEUVE, sinon la taille de coque et la cargaison ne s'authorent plus (règle stricte 2).
 */
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PlageField } from './PlageField';
import { DispoSaisonniereField } from './compendium/StructFields';
import { CodexEdit } from './compendium/CodexEdit';

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

const champs = () => [...container.querySelectorAll('input[type="number"]')] as HTMLInputElement[];
const parNom = (nom: string) => champs().find((c) => c.getAttribute('aria-label') === nom)!;

/** Frappe RÉELLE dans un `<input>` contrôlé par React (patron `NumberField.test.tsx`). */
function saisir(input: HTMLInputElement, texte: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(input, texte);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const entrer = (input: HTMLInputElement) => {
  act(() => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
};

describe('PlageField — les DEUX bornes d’une bande de table', () => {
  it('rend deux champs NOMMÉS, et dit le domaine que le site lui passe (jamais un dé deviné)', () => {
    mount(<PlageField label="Sous-tirage" domaine={{ nom: '1d10', min: 1, max: 10 }} value={{ min: 4, max: 6 }} onChange={vi.fn()} />);
    expect(container.textContent).toContain('Sous-tirage — 1d10');
    expect(parNom('Sous-tirage — borne basse').value).toBe('4');
    expect(parNom('Sous-tirage — borne haute').value).toBe('6');
  });

  it('hors domaine : la saisie est REFUSÉE (aria-invalid + domaine dit), AUCUN clamp, rien ne remonte', () => {
    const onChange = vi.fn();
    mount(<PlageField label="Sous-tirage" domaine={{ nom: '1d10', min: 1, max: 10 }} value={{ min: 4, max: 6 }} onChange={onChange} />);
    const haute = parNom('Sous-tirage — borne haute');
    saisir(haute, '47'); // le 1d10 s'arrête à 10 (ADE II 03 l.63)
    entrer(haute);
    expect(onChange).not.toHaveBeenCalled(); // ni 47, ni 10 calé en silence
    expect(haute.value).toBe('6');
    expect(haute.getAttribute('aria-invalid')).toBe('true');
    expect((container.querySelector('[role="status"]') as HTMLElement).textContent).toBe('1–10');
  });

  it('dans le domaine : la borne remonte au geste terminal, l’autre est PORTÉE (jamais reconstruite)', () => {
    const onChange = vi.fn();
    mount(<PlageField label="Sous-tirage" domaine={{ nom: '1d10', min: 1, max: 10 }} value={{ min: 4, max: 6 }} onChange={onChange} />);
    const haute = parNom('Sous-tirage — borne haute');
    saisir(haute, '9');
    entrer(haute);
    expect(onChange).toHaveBeenCalledWith({ min: 4, max: 9 });
  });

  it('bande OUVERTE (`max: null`) : « 81 et plus », et AUCUN champ de borne haute à éditer', () => {
    mount(<PlageField label="Longueur" domaine={{ nom: 'mètres', min: 1 }} ouvrable value={{ min: 81, max: null }} onChange={vi.fn()} />);
    expect(parNom('Longueur — borne basse').value).toBe('81');
    expect(champs().length).toBe(1); // la borne haute n'existe pas : le livre imprime « 81+ » (MDG 12 l.129)
    expect(container.textContent).toContain('et plus');
  });

  it('la case « sans plafond » OUVRE la bande (`max: null`), elle ne pose pas un plafond de repli', () => {
    const onChange = vi.fn();
    mount(<PlageField label="Longueur" domaine={{ nom: 'mètres', min: 1 }} ouvrable value={{ min: 81, max: 130 }} onChange={onChange} />);
    const cases = [...container.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[];
    act(() => { cases[0].click(); });
    expect(onChange).toHaveBeenCalledWith({ min: 81, max: null });
  });

  it('`optionnelle` : décocher REND le champ absent (un signe simple n’a pas de sous-tirage)', () => {
    const onChange = vi.fn();
    mount(<PlageField label="Sous-tirage" activation="sous-tirage" optionnelle domaine={{ min: 1, max: 10 }} value={{ min: 1, max: 3 }} onChange={onChange} />);
    const bascule = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(bascule.checked).toBe(true);
    act(() => { bascule.click(); });
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('`optionnelle` non posée : aucun champ de borne — le champ ABSENT ne s’édite pas par accident', () => {
    mount(<PlageField label="Sous-tirage" optionnelle domaine={{ min: 1, max: 10 }} value={undefined} onChange={vi.fn()} />);
    expect(champs().length).toBe(0);
  });

  it('REQUISE et sans valeur (entrée NEUVE) : les deux bornes s’ouvrent sur le début du domaine', () => {
    // Sans `optionnelle`, il n'y a pas d'état « absent » : un champ vide serait un cul-de-sac
    // d'authoring (règle stricte 2) sur une taille de coque ou une cargaison neuve.
    mount(<PlageField label="Longueur" domaine={{ nom: 'mètres', min: 1 }} ouvrable value={undefined} onChange={vi.fn()} />);
    expect(champs().length).toBe(2);
    expect(parNom('Longueur — borne basse').value).toBe('1');
    expect(parNom('Longueur — borne haute').value).toBe('1');
  });
});

describe('DispoSaisonniereField — les quatre colonnes, nommées en FRANÇAIS', () => {
  it('rend une fourchette PAR saison, avec le libellé FR pris à la donnée (`weather.json`)', () => {
    mount(
      <DispoSaisonniereField
        label="Disponibilité par saison"
        value={{ printemps: { min: 1, max: 5 }, ete: { min: 1, max: 9 }, automne: { min: 1, max: 18 }, hiver: { min: 1, max: 9 } }}
        onChange={vi.fn()}
      />,
    );
    // MDG 15 l.408 : « | Céréales | 01-05 | 01-09 | 01-18 | 01-09 | » — quatre colonnes, huit bornes.
    expect(champs().length).toBe(8);
    for (const saison of ['Printemps', 'Été', 'Automne', 'Hiver']) {
      expect(container.textContent).toContain(`${saison} — d100`);
      expect(parNom(`${saison} — borne basse`).value).toBe('1');
    }
    expect(parNom('Automne — borne haute').value).toBe('18');
    // Aucune clé technique à l'écran (règle stricte 4) : la saison se nomme en français.
    expect(container.textContent).not.toContain('printemps');
    expect(container.textContent).not.toContain('ete');
  });

  it('éditer UNE colonne laisse les trois autres intactes', () => {
    const onChange = vi.fn();
    mount(
      <DispoSaisonniereField
        label="Disponibilité par saison"
        value={{ printemps: { min: 1, max: 5 }, ete: { min: 1, max: 9 }, automne: { min: 1, max: 18 }, hiver: { min: 1, max: 9 } }}
        onChange={onChange}
      />,
    );
    const haute = parNom('Hiver — borne haute');
    saisir(haute, '12');
    entrer(haute);
    expect(onChange).toHaveBeenCalledWith({
      printemps: { min: 1, max: 5 }, ete: { min: 1, max: 9 }, automne: { min: 1, max: 18 }, hiver: { min: 1, max: 12 },
    });
  });
});

describe('les DEUX sites de l’atelier — une fourchette REQUISE s’édite sur une entrée NEUVE', () => {
  const monterNeuve = (categoryKey: string) => {
    mount(<CodexEdit categoryKey={categoryKey} isNew onClose={() => {}} />);
  };
  /** Les champs de la fourchette `label`, par leur nom accessible. */
  const bornesDe = (label: string) => champs().filter((c) => (c.getAttribute('aria-label') ?? '').startsWith(`${label} — borne`));

  it('taille de coque neuve : « Longueur » ouvre ses DEUX bornes sur le domaine (MDG 12 l.122-129)', () => {
    monterNeuve('shipHullSizes');
    expect(bornesDe('Longueur').length, 'la fourchette de longueur ne s’édite pas sur une taille de coque neuve').toBe(2);
    expect(bornesDe('Longueur')[0].value, 'la borne basse ne s’ouvre pas sur le début du domaine (1 m)').toBe('1');
  });

  it('cargaison maritime neuve : les QUATRE colonnes de disponibilité s’éditent (8 bornes, d100)', () => {
    monterNeuve('seaCargo');
    // `avail` est EXIGÉ par `defs/sea-cargo.ts` : sans ces champs, une cargaison neuve n'est pas
    // enregistrable — MDG 15 l.406-418 imprime une colonne par saison.
    for (const saison of ['Printemps', 'Été', 'Automne', 'Hiver']) {
      expect(bornesDe(saison).length, `la colonne « ${saison} » ne s’édite pas sur une cargaison neuve`).toBe(2);
      expect(bornesDe(saison)[0].value, `la colonne « ${saison} » n’ouvre pas sur le début du d100`).toBe('1');
    }
  });
});
