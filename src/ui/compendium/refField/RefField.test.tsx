// @vitest-environment jsdom
/**
 * #1993 — `RefField` porte le nom accessible, l'invalidité et la description sur le contrôle qu'il
 * rend, dans CHAQUE mode à contrôle unique (`single`, `freeText`, `vocab`). Le mode `liste` et le
 * `single` à `spec` n'en rendent aucun : l'appel qui les leur passerait ne compile pas
 * (`@ts-expect-error` ci-dessous, lu par `tsc`).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { z } from 'zod';
import { RefField, cfgDeLaFeuille, cfgDuNoeudType, type RefFieldCfgUnique } from './RefField';
import { datasetArray, resetData, setDataset, type DatasetKey } from '../../../data/overrides';
import { espaceDe, idDe, lireLEspace, refTypee, TYPES, type TypeEntite } from '../../../data/schemas/grammaire/ref';
import { cleNichee } from '../../../data/schemas/grammaire/cle-d-espace';
import { DATASET_FICHIER_DERIVE, DATASET_SUITE_DERIVE } from '../../../data/schemas/exposition-derivee';
import { CodexEdit } from '../../editor/codex/CodexEdit';
import { catalogStakeSchema } from '../../../data/schemas/grammaire/mecanique';

const MODES: [string, RefFieldCfgUnique, string][] = [
  ['single', { ds: 'books', single: true }, 'select'],
  ['freeText', { ds: 'trappings', freeText: true }, 'input'],
  ['vocab', { vocabFrom: 'species.refChar' }, 'input'],
];

describe('RefField — l’accessibilité passée atteint le contrôle rendu', () => {
  for (const [mode, cfg, balise] of MODES) {
    it(`mode ${mode}`, () => {
      const html = renderToStaticMarkup(
        <RefField cfg={cfg} label="Réf" ariaLabel={`Réf ${mode}`} invalide describedBy="aide" value="" onChange={() => {}} />,
      );
      const controle = new DOMParser().parseFromString(html, 'text/html').querySelector(balise)!;
      expect(controle.getAttribute('aria-label')).toBe(`Réf ${mode}`);
      expect(controle.getAttribute('aria-invalid')).toBe('true');
      expect(controle.getAttribute('aria-describedby')).toBe('aide');
    });
  }

  it('l’indication tait le registre que le libellé du champ nomme déjà (« Livre » / « Livres »)', () => {
    const indication = (cfg: RefFieldCfgUnique, label: string) =>
      new DOMParser().parseFromString(renderToStaticMarkup(<RefField cfg={cfg} label={label} value="" onChange={() => {}} />), 'text/html')
        .querySelector('.ed-hint')?.textContent ?? null;
    expect(indication({ ds: 'books', single: true }, 'Livre')).toBeNull();
    expect(indication({ ds: 'books', single: true }, 'Ouvrage cité')).toBe(' (Livres)');
    expect(indication({ ds: 'books', freeText: true }, 'Livre')).toBe(' (saisie libre)');
    expect(indication({ ds: 'books', freeText: true }, 'Ouvrage cité')).toBe(' (Livres, ou saisie libre)');
  });

  it('mode liste : aucune accessibilité de contrôle unique ne se passe', () => {
    // @ts-expect-error — une `liste` n'a pas de contrôle unique à qui poser `invalide`.
    const html = renderToStaticMarkup(<RefField cfg={{ ds: 'spells' }} invalide value={[]} onChange={() => {}} />);
    expect(html).not.toContain('aria-invalid');
  });

  it('mode single à `spec` : deux contrôles, aucune accessibilité de contrôle unique ne se passe', () => {
    // @ts-expect-error — le `<select>` et l'`<input>` de spécialisation : pas de contrôle unique à nommer.
    const html = renderToStaticMarkup(<RefField cfg={{ ds: 'skills', single: true, spec: true }} ariaLabel="Compétence" value="" onChange={() => {}} />);
    expect(new DOMParser().parseFromString(html, 'text/html').querySelectorAll('select, input')).toHaveLength(2);
  });
});

// #2968
const niches = (Object.keys(TYPES) as TypeEntite[]).flatMap((type) => {
  const espace = espaceDe(type);
  const ds = Object.keys(DATASET_FICHIER_DERIVE).find((d) =>
    DATASET_SUITE_DERIVE[d] && cleNichee(DATASET_FICHIER_DERIVE[d], DATASET_SUITE_DERIVE[d]) === espace);
  return ds ? [{ type, ds: ds as DatasetKey }] : [];
});
const montes: (() => void)[] = [];
afterEach(() => { montes.splice(0).forEach((demonter) => demonter()); resetData(); });

describe('RefField — espaces imbriqués (#2968)', () => {
  it('la météo désigne la collection des conditions', () => {
    expect(cfgDeLaFeuille(idDe('weather'))).toEqual({ ds: 'weatherConditions', single: true });
    expect(niches.some(({ type, ds }) => type === 'weather' && ds === 'weatherConditions')).toBe(true);
  });

  for (const { type, ds } of niches) {
    it(`${type} : les modes simple, liste et polymorphe offrent les ids et libellés de leur collection`, () => {
      const cfg = cfgDeLaFeuille(idDe(type));
      expect(cfg).toEqual({ ds, single: true });
      const noeud = refTypee(z.enum([type]));
      const polymorphe = cfgDuNoeudType(noeud)!;
      expect(polymorphe.polymorphe).toEqual([{ type, label: type, cfg }]);
      const entrees = datasetArray(ds) as readonly { id: string; label?: string }[];
      expect(entrees.length).toBeGreaterThan(0);
      expect(new Set(entrees.map((e) => e.id))).toEqual(lireLEspace(espaceDe(type)));
      const attendu = entrees.map((e) => [e.id, e.label ?? e.id])
        .sort((a, b) => a[1].localeCompare(b[1]));
      const rendus = [
        <RefField cfg={cfg!} value={entrees[0].id} onChange={() => {}} />,
        <RefField cfg={{ ds }} value={[{ id: entrees[0].id }]} onChange={() => {}} />,
        <RefField cfg={polymorphe} label="Référence" value={{ type, id: entrees[0].id }} onChange={() => {}} />,
      ];
      for (const rendu of rendus) {
        const doc = new DOMParser().parseFromString(renderToStaticMarkup(rendu), 'text/html');
        const controles = doc.querySelectorAll('select');
        const fiche = controles[controles.length - 1];
        expect([...fiche.options].map((o) => [o.value, o.textContent])).toEqual(attendu);
      }
    });
  }

  it('changer la fiche ou son type conserve les champs supplémentaires de la référence', () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    montes.push(() => { act(() => { root.unmount(); }); host.remove(); });
    const noeud = catalogStakeSchema.shape.key;
    const autreType = cfgDuNoeudType(noeud)!.polymorphe.find((p) => p.type !== 'weather')!.type;
    const [premiere, seconde] = datasetArray('weatherConditions');
    const valeur = { type: 'weather', id: premiere.id, entryId: 'entree-du-porteur', entryCategory: 'skills' };
    const emises: unknown[] = [];
    act(() => { root.render(<RefField cfg={cfgDuNoeudType(noeud)!} label="Clé" noeud={noeud} value={valeur} onChange={(v) => { emises.push(v); }} />); });
    const changer = (nom: string, valeur: string) => act(() => {
      const champ = host.querySelector<HTMLSelectElement>(`select[aria-label="${nom}"]`)!;
      champ.value = valeur;
      champ.dispatchEvent(new Event('change', { bubbles: true }));
    });
    changer('Clé — fiche', seconde.id);
    expect(emises[emises.length - 1]).toEqual({ ...valeur, id: seconde.id });
    changer('Clé — type', autreType);
    expect(emises[emises.length - 1]).toEqual({ ...valeur, id: '', type: autreType });
  });

  it('CodexEdit monte la clé d’enjeu dans le Test d’annulation du domaine Lumière', () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    montes.push(() => { act(() => { root.unmount(); }); host.remove(); });
    act(() => { root.render(<CodexEdit categoryKey="domains" id="lumiere" onClose={() => {}} />); });
    const types = [...host.querySelectorAll<HTMLSelectElement>('select')]
      .filter((s) => s.getAttribute('aria-label')?.startsWith('clé de enjeu de Test de annulation'));
    expect(types.length).toBeGreaterThan(0);
    const type = types.find((s) => s.getAttribute('aria-label')?.endsWith('— type'))!;
    expect(type).toBeTruthy();
    act(() => { type.value = 'weather'; type.dispatchEvent(new Event('change', { bubbles: true })); });
    const fiche = type.parentElement!.querySelector<HTMLSelectElement>('select[aria-label$="— fiche"]')!;
    expect([...fiche.options].map((o) => o.value).filter(Boolean).sort())
      .toEqual(datasetArray('weatherConditions').map((e) => e.id).sort());
  });

  it('une écriture versionnée dans le dataset imbriqué renouvelle les options du champ monté', () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    montes.push(() => { act(() => { root.unmount(); }); host.remove(); });
    const noeud = refTypee(z.enum(['weather']));
    const cfg = cfgDuNoeudType(noeud)!;
    const [premiere] = datasetArray('weatherConditions');
    act(() => { root.render(<RefField cfg={cfg} label="Météo" noeud={noeud} value={{ type: 'weather', id: premiere.id }} onChange={() => {}} />); });
    const fiche = () => host.querySelector<HTMLSelectElement>('select[aria-label="Météo — fiche"]')!;
    expect(fiche().selectedOptions[0].textContent).toBe(premiere.label);
    act(() => { setDataset('weatherConditions', datasetArray('weatherConditions').map((e) =>
      e.id === premiere.id ? { ...e, label: 'Condition retouchée au catalogue' } : e)); });
    expect(fiche().selectedOptions[0].textContent).toBe('Condition retouchée au catalogue');
    expect(fiche().value).toBe(premiere.id);
  });
});
