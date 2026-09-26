// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { GameOpEditor, OP_REF_FIELDS } from './GameOpEditor';
import { CHAMPS_A_CHOIX, cibleDuChampAChoix, metaDuChampDOp } from '../../data/schemas/grammaire/mecanique';
import { TYPES, type TypeEntite } from '../../data/schemas/grammaire/ref';
import { datasetDuType, typeDuDataset } from '../../data/overrides';
import { specLabel } from '../../data';
import { FamilleDuChamp } from './familleDuChamp';
import { noeudDuChamp } from '../../data/schemas/validate';
import { RefField } from '../compendium/RefField';
import type { GameOp } from '../../engine/ops';

/**
 * Champs à choix à l'atelier (#1473, E7) : le rendu d'un champ d'ops pose la famille de son nœud
 * (`FamilleDuChamp`), la branche d'op lit son régime ; une op imbriquée dans une op est fermée, comme au
 * parse (`mecaniqueDe`, E2).
 */

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const AU_CHOIX = 'au choix du joueur';
const COMME_EN_CARRIERE = metaDuChampDOp('grantCareerTalent', 'commeEnCarriere')!.label;

/** Montages vivants, démontés après chaque test même quand une assertion a levé. */
const montes = new Set<() => Promise<void>>();
afterEach(async () => {
  for (const demonter of montes) await demonter();
});

/** Montage réel d'un élément à état contrôlé par le test : `rendre(valeur)` le re-rend à chaque émission. */
function monter<T>(initiale: T, rendu: (v: T, emettre: (v: T) => void) => ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const emis: T[] = [];
  let valeur = initiale;
  const rendre = () => root.render(rendu(valeur, (v) => { emis.push(v); valeur = v; rendre(); }));
  const demonter = async () => {
    if (!montes.delete(demonter)) return;
    await act(async () => { root.unmount(); });
    container.remove();
  };
  montes.add(demonter);
  return {
    container, emis,
    valeur: () => valeur,
    monter: () => act(async () => { rendre(); }),
    agir: (f: () => void) => act(async () => { f(); }),
    demonter,
  };
}
const choisirOption = (select: HTMLSelectElement, value: string) => {
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
};
const saisir = (input: HTMLInputElement, value: string) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};
const grantTalent: GameOp = { op: 'grantTalent', talent: { id: 'maitre-artisan' } };

const sousFamille = (file: string, champ: string, ops: GameOp[]) =>
  renderToStaticMarkup(<FamilleDuChamp noeud={noeudDuChamp(file, champ)}><GameOpEditor ops={ops} onChange={() => {}} /></FamilleDuChamp>);

describe('GameOpEditor — champ à choix au régime de la famille du champ', () => {
  it('une op grantTalent à la racine de stars.ops propose « au choix »', () => {
    expect(sousFamille('stars.json', 'ops', [grantTalent])).toContain(AU_CHOIX);
  });

  it('la même op imbriquée dans une op (rangée de rollTable) ne le propose pas', () => {
    const imbriquee: GameOp = { op: 'rollTable', die: 'd10', rows: [{ min: 1, max: 10, ops: [grantTalent] }] } as GameOp;
    expect(sousFamille('stars.json', 'ops', [imbriquee])).not.toContain(AU_CHOIX);
  });

  it('hors de toute famille à régime, la famille est fermée', () => {
    expect(renderToStaticMarkup(<GameOpEditor ops={[grantTalent]} onChange={() => {}} />)).not.toContain(AU_CHOIX);
    expect(sousFamille('talents.json', 'passive', [grantTalent])).not.toContain(AU_CHOIX);
  });

  it('grantCareerSkill de talents.passive garde son `choix`, sans interrupteur ; grantCareerTalent porte `commeEnCarriere` libellé par sa méta', () => {
    const html = sousFamille('talents.json', 'passive', [{ op: 'grantCareerSkill', skill: { id: 'metier', choix: true } }]);
    expect(html).toMatch(/<option value="__choix" selected="">au choix du joueur<\/option>/);
    expect(html).not.toContain(COMME_EN_CARRIERE);
    const trait = sousFamille('traits.json', 'passive', [{ op: 'grantCareerTalent', talent: { id: 'magie-mineure' }, commeEnCarriere: true }]);
    expect(trait).toContain(`<button type="button" class="chip" aria-pressed="true">${COMME_EN_CARRIERE}</button>`);
  });

  it('l’interrupteur `commeEnCarriere` change le résumé replié de l’op (clic réel)', async () => {
    const h = monter<GameOp[]>([{ op: 'grantCareerTalent', talent: { id: 'magie-mineure' } }], (ops, emettre) => (
      <FamilleDuChamp noeud={noeudDuChamp('traits.json', 'passive')}><GameOpEditor ops={ops} onChange={emettre} /></FamilleDuChamp>
    ));
    await h.monter();
    const resume = () => h.container.querySelector('.eff-summary')!.textContent ?? '';
    const interrupteur = () => Array.from(h.container.querySelectorAll('button.chip')).find((b) => b.textContent === COMME_EN_CARRIERE) as HTMLButtonElement;
    const avant = resume();
    expect(avant).not.toContain(COMME_EN_CARRIERE);
    expect(interrupteur().getAttribute('aria-pressed')).toBe('false');
    await h.agir(() => interrupteur().click());
    expect(h.valeur()).toEqual([{ op: 'grantCareerTalent', talent: { id: 'magie-mineure' }, commeEnCarriere: true }]);
    expect(interrupteur().getAttribute('aria-pressed')).toBe('true');
    expect(resume()).toContain(COMME_EN_CARRIERE);
    await h.agir(() => interrupteur().click());
    expect(h.valeur()).toEqual([{ op: 'grantCareerTalent', talent: { id: 'magie-mineure' } }]);
    expect(resume()).toBe(avant);
    await h.demonter();
  });
});

describe('RefField (mode spec) — les specs du catalogue, la saisie libre sur une entrée ouverte seulement', () => {
  const rendu = (id: string) => renderToStaticMarkup(<RefField cfg={{ ds: 'talents', single: true, spec: true }} fieldKey="Talent" value={{ id }} onChange={() => {}} />);

  it('Destinée (entrée ouverte, LDB 10 l.315) : ses exemples (l.321-330) et « autre (texte libre) »', () => {
    const html = rendu('destinee');
    expect(html).toContain('Des ténèbres viendra le corbeau.');
    expect(html).toContain('autre (texte libre)');
  });

  it('Sens aiguisé (entrée fermée) : ses specs, sans saisie libre', () => {
    const html = rendu('sens-aiguise');
    expect(html).toContain('Vue');
    expect(html).not.toContain('autre (texte libre)');
  });
});

describe('RefField (mode spec) — l’éditeur n’émet ni borne vide ni texte libre vide', () => {
  const monterRef = (initiale: { id: string; spec?: string; choix?: true | string[] }) => monter(initiale, (v, emettre) => (
    <RefField cfg={{ ds: 'talents', single: true, spec: true }} fieldKey="Talent" regime="specOuChoixFacultatifs" value={v} onChange={(x) => emettre(x as typeof v)} />
  ));
  const selectSpec = (c: HTMLElement) => c.querySelector('select[aria-label="Spécialisation"]') as HTMLSelectElement;

  it('« au choix parmi… » n’émet rien de vide ; la borne naît au premier chip, meurt au dernier', async () => {
    const h = monterRef({ id: 'beni' });
    await h.monter();
    await h.agir(() => choisirOption(selectSpec(h.container), '__borne'));
    expect(h.emis.every((v) => !Array.isArray(v.choix) || v.choix.length > 0), JSON.stringify(h.emis)).toBe(true);
    const chips = () => Array.from(h.container.querySelectorAll('button.chip')) as HTMLButtonElement[];
    expect(chips().length).toBeGreaterThan(1);
    await h.agir(() => chips()[0].click());
    expect(h.valeur().choix).toHaveLength(1);
    expect(chips()[0].getAttribute('aria-pressed')).toBe('true');
    await h.agir(() => chips()[0].click());
    expect(h.valeur()).toEqual({ id: 'beni' });
    expect(chips().length, 'le mode borne reste ouvert après le dernier chip').toBeGreaterThan(1);
    await h.demonter();
  });

  it('« autre (texte libre) » n’émet jamais `spec: \'\'`', async () => {
    const h = monterRef({ id: 'destinee' });
    await h.monter();
    await h.agir(() => choisirOption(selectSpec(h.container), '__libre'));
    const input = () => h.container.querySelector('input[aria-label="Spécialisation (texte libre)"]') as HTMLInputElement;
    expect(input()).toBeTruthy();
    await h.agir(() => saisir(input(), 'Un présage'));
    expect(h.valeur()).toEqual({ id: 'destinee', spec: 'Un présage' });
    await h.agir(() => saisir(input(), ''));
    expect(h.valeur()).toEqual({ id: 'destinee' });
    expect(h.emis.some((v) => v.spec === ''), JSON.stringify(h.emis)).toBe(false);
    await h.demonter();
  });

  it('une spec valide hors du pool s’affiche par son libellé, jamais « (inconnu) »', () => {
    const html = renderToStaticMarkup(<RefField cfg={{ ds: 'talents', single: true, spec: true }} fieldKey="Talent" value={{ id: 'magie-des-arcanes', spec: 'dhar' }} onChange={() => {}} />);
    expect(html).toContain(`<option value="dhar" selected="">${specLabel('talents', 'magie-des-arcanes', 'dhar')}</option>`);
    expect(html).not.toContain('(inconnu)');
  });
});

describe('pont type d’entité ↔ dataset — une fonction par sens, lue par l’éditeur', () => {
  it('`typeDuDataset` inverse `datasetDuType` sur tout type porté par un dataset-liste', () => {
    const types = Object.keys(TYPES) as TypeEntite[];
    const portes = types.filter((t) => datasetDuType(t) !== undefined);
    expect(portes.length).toBeGreaterThan(20);
    for (const t of portes) expect(typeDuDataset(datasetDuType(t)!), t).toBe(t);
  });

  it('les réfs des champs à choix se lisent au schéma : dataset par la cible, libellé par la méta', () => {
    for (const c of CHAMPS_A_CHOIX) {
      const [op, nom] = c.split('.');
      expect(OP_REF_FIELDS[op as GameOp['op']], c).toContainEqual({
        field: `${nom}.id`, ds: datasetDuType(cibleDuChampAChoix(c)), label: metaDuChampDOp(op, nom)!.label, required: true,
      });
    }
  });
});
