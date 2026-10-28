// @vitest-environment jsdom
/**
 * #1993 — `RefField` porte le nom accessible, l'invalidité et la description sur le contrôle qu'il
 * rend, dans CHAQUE mode à contrôle unique (`single`, `freeText`, `vocab`). Le mode `liste` et le
 * `single` à `spec` n'en rendent aucun : l'appel qui les leur passerait ne compile pas
 * (`@ts-expect-error` ci-dessous, lu par `tsc`). Le mode `spec` choisit la spécialisation dans le catalogue
 * de l'entrée, et changer d'entrée la retire.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChoixDeSpecs, RefField, cfgDuNoeudASpec, type RefFieldCfgUnique } from './RefField';
import { catalogueSpecs, entreeOuverte, estSpecialisable, idDe, idsDe, ref, refOuSpec, specRef } from '../../../data/schemas/grammaire/ref';
import { competenceChiffreeSchema } from '../../../data/schemas/defs-scenes/communs';
import { monterRacine, demonterRacines } from '../../../monterRacine.testkit';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(demonterRacines);

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

  it('mode single à `spec` : deux contrôles pour une entrée spécialisable, un sinon ; aucune accessibilité de contrôle unique ne se passe', () => {
    const competences = [...idsDe('skill')];
    const specialisable = competences.find((id) => estSpecialisable('skill', id))!;
    const nue = competences.find((id) => !estSpecialisable('skill', id))!;
    const controles = (id: string) => {
      // @ts-expect-error — le `<select>` et le contrôle de spécialisation : pas de contrôle unique à nommer.
      const html = renderToStaticMarkup(<RefField cfg={{ ds: 'skills', single: true, spec: true }} ariaLabel="Compétence" value={{ id }} onChange={() => {}} />);
      return new DOMParser().parseFromString(html, 'text/html').querySelectorAll('select, input').length;
    };
    expect(controles(specialisable)).toBe(2);
    expect(controles(nue)).toBe(1);
  });

  it('mode single à `spec` : changer d’id retire la spécialisation de l’entrée quittée', async () => {
    const competences = [...idsDe('skill')];
    const quittee = competences.find((id) => !entreeOuverte('skill', id) && catalogueSpecs('skill', id).length > 0)!;
    const [spec] = catalogueSpecs('skill', quittee);
    const visee = competences.find((id) => id !== quittee)!;
    let dernier: unknown;
    const { container } = monterRacine(<RefField cfg={{ ds: 'skills', single: true, spec: true }} label="Compétence" value={{ id: quittee, spec }} onChange={(v) => { dernier = v; }} />);
    const select = [...container.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === visee))!;
    await act(async () => {
      select.value = visee;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(dernier).toEqual({ id: visee });
  });

  it('`ChoixDeSpecs` : coche dans le catalogue de l’entrée ; aucune cochée = toutes', async () => {
    const talent = [...idsDe('talent')].find((id) => catalogueSpecs('talent', id).length > 1)!;
    const [premiere, seconde] = catalogueSpecs('talent', talent);
    let dernier: string[] | undefined = ['inchangé'];
    const { container, rendre } = monterRacine(<ChoixDeSpecs type="talent" id={talent} value={[premiere]} label="Restreintes" onChange={(v) => { dernier = v; }} />);
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(catalogueSpecs('talent', talent).length);
    const cases = [...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    await act(async () => cases[1].click());
    expect(dernier).toEqual([premiere, seconde]);
    rendre(<ChoixDeSpecs type="talent" id={talent} value={[premiere]} label="Restreintes" onChange={(v) => { dernier = v; }} />);
    await act(async () => cases[0].click());
    expect(dernier).toBeUndefined();
  });

  it('`cfgDuNoeudASpec` : toute référence à spécialisation, enveloppée ou non, et elle seule', () => {
    const attendu = { ds: 'skills', single: true, spec: true };
    expect(cfgDuNoeudASpec(refOuSpec('skill'))).toEqual(attendu);
    expect(cfgDuNoeudASpec(refOuSpec('skill').optional())).toEqual(attendu);
    expect(cfgDuNoeudASpec(competenceChiffreeSchema)).toEqual(attendu);
    expect(cfgDuNoeudASpec(specRef('talent'))).toEqual({ ds: 'talents', single: true, spec: true });
    expect(cfgDuNoeudASpec(ref('skill'))).toBeUndefined();
    expect(cfgDuNoeudASpec(idDe('skill'))).toBeUndefined();
    expect(cfgDuNoeudASpec(undefined)).toBeUndefined();
  });

  it('mode `liste` à `spec` : chaque rangée offre sa spécialisation, la garde aux autres gestes, la perd au changement d’id', async () => {
    const competences = [...idsDe('skill')];
    const x = competences.find((id) => !entreeOuverte('skill', id) && catalogueSpecs('skill', id).length > 0)!;
    const [spec] = catalogueSpecs('skill', x);
    const [y, z] = competences.filter((id) => id !== x);
    let dernier: unknown;
    const { container } = monterRacine(<RefField cfg={{ ds: 'skills', value: true, spec: true }} label="C" value={[{ id: x, spec, value: 4 }, { id: y }]} onChange={(v) => { dernier = v; }} />);
    expect(container.querySelector<HTMLSelectElement>('select[aria-label="Spécialisation — C — valeur 1"]')!.value).toBe(spec);
    const choisir = async (nom: string, v: string) => act(async () => {
      const s = container.querySelector<HTMLSelectElement>(`select[aria-label="${nom}"]`)!;
      s.value = v;
      s.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await choisir('C — valeur 2', z);
    expect(dernier).toEqual([{ id: x, spec, value: 4 }, { id: z }]);
    await choisir('C — valeur 1', z);
    expect(dernier).toEqual([{ id: z, value: 4 }, { id: y }]);
  });

  it('`ChoixDeSpecs` : cocher ajoute en fin de valeur, décocher retire, sans réordonner', async () => {
    const talent = [...idsDe('talent')].find((id) => catalogueSpecs('talent', id).length > 2)!;
    const [premiere, seconde, troisieme] = catalogueSpecs('talent', talent);
    let dernier: string[] | undefined;
    const { container } = monterRacine(<ChoixDeSpecs type="talent" id={talent} value={[seconde, premiere]} label="Restreintes" onChange={(v) => { dernier = v; }} />);
    const cases = [...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    await act(async () => cases[2].click());
    expect(dernier).toEqual([seconde, premiere, troisieme]);
    await act(async () => cases[1].click());
    expect(dernier).toEqual([premiere]);
  });

  it('`ChoixDeSpecs` d’une entrée ouverte : les spécialisations hors catalogue restent cochées, une saisie libre s’ajoute', async () => {
    const ouverte = (['skill', 'talent', 'trait'] as const)
      .flatMap((type) => [...idsDe(type)].filter((id) => entreeOuverte(type, id)).map((id) => ({ type, id })))[0];
    expect(ouverte).toBeDefined();
    const horsCatalogue = 'hors catalogue';
    let dernier: string[] | undefined;
    const { container } = monterRacine(<ChoixDeSpecs type={ouverte!.type} id={ouverte!.id} value={[horsCatalogue]} label="Restreintes" onChange={(v) => { dernier = v; }} />);
    const cochees = [...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].filter((c) => c.checked);
    expect(cochees.map((c) => c.parentElement!.textContent!.trim())).toEqual([horsCatalogue]);
    const saisie = container.querySelector<HTMLInputElement>('input[aria-label="Restreintes — autre spécialisation"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(saisie, ' libre ');
      saisie.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Ajouter à Restreintes"]')!.click());
    expect(dernier).toEqual([horsCatalogue, 'libre']);
  });
});
