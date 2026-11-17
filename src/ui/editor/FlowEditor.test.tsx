// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FlowEditor, TestFields } from './FlowEditor';
import type { Flow } from '../../data/schemas/defs-scenes/effets';
import { EMPTY_FLOW, type FlowTest } from '../../engine/flowCore';
import { CIBLES_D_EFFET_DE_SCENE } from '../../noyau/combatEffects';
import { emptyNarratif } from '../../noyau/monde/campaignNarratif';
import { monterRacine, demonterRacines } from '../../monterRacine.testkit';
import { entreeDe, menuDe, ouvrirMenu } from './AddMenu.testkit';
import { idsDeLaSousListe } from '../../data/schemas/grammaire/ref';
import { DECLARABLE_PAR_UN_PORTEUR } from '../../data/schemas/grammaire/sousListes';
import { flowTestSchema } from '../../data/schemas/grammaire/mecanique';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(demonterRacines);

const ctx = { encounters: [], dialogues: [], cibles: CIBLES_D_EFFET_DE_SCENE, narratif: emptyNarratif() };
const testFlow = (skill: NonNullable<FlowTest['skill']>['id'], vsGroups?: FlowTest['vsGroups']): Flow => ({
  kind: 'test',
  test: { skill: { id: skill }, ...(vsGroups ? { vsGroups } : {}) },
  reussite: EMPTY_FLOW,
  echec: EMPTY_FLOW,
});

describe('FlowEditor — nœud Test : champ Interlocuteur/groupes (P3)', () => {
  it('un Test de SOCIABILITÉ (Charme) expose le champ des groupes de l’interlocuteur', () => {
    const [groupe] = flowTestSchema.shape.vsGroups.unwrap().parse(idsDeLaSousListe('groupe', DECLARABLE_PAR_UN_PORTEUR));
    const html = renderToStaticMarkup(<FlowEditor flow={testFlow('charme', [groupe])} onChange={() => {}} ctx={ctx} />);
    expect(html).toMatch(/Interlocuteur/i);
    expect(html).toContain(`value="${groupe}" selected=""`); // la valeur courante est choisie
  });

  it('un Test NON-social (Escalade) MASQUE le champ (pas de no-op silencieux)', () => {
    const html = renderToStaticMarkup(<FlowEditor flow={testFlow('escalade')} onChange={() => {}} ctx={ctx} />);
    expect(html).not.toMatch(/Interlocuteur/i);
  });
});

describe('FlowEditor — menu « + Bloc » : effets, condition et test', () => {
  it('propose les nœuds logiques (si / test) ET les feuilles d’effet', async () => {
    const { container } = monterRacine(<FlowEditor flow={EMPTY_FLOW} onChange={() => {}} ctx={ctx} />);
    const menu = await ouvrirMenu(menuDe(container, '+ Bloc'));
    for (const libelle of ['Condition (si…)', 'Test de compétence', 'Choix du joueur', 'Journal']) {
      expect(entreeDe(menu, libelle), libelle).toBeDefined();
    }
  });

  it('rend un nœud `if` (condition + branches ALORS/SINON)', () => {
    const flow: Flow = { kind: 'si', condition: { kind: 'flag', expr: 'porte_ouverte' }, alors: EMPTY_FLOW };
    const html = renderToStaticMarkup(<FlowEditor flow={flow} onChange={() => {}} ctx={ctx} />);
    expect(html).toContain('porte_ouverte'); // la condition de flag est éditée
    expect(html).toContain('ALORS');
  });
});

describe('#1318 E1 — le domaine des crans de facilité atteint le champ (cale de NumberField)', () => {
  it('le champ « cran(s) » porte sa borne basse (au moins un cran)', () => {
    const flow: Flow = { kind: 'test', test: { skill: { id: 'escalade' }, easierIf: { hasSkill: { id: 'escalade' }, steps: 2 } }, reussite: EMPTY_FLOW, echec: EMPTY_FLOW };
    const html = renderToStaticMarkup(<FlowEditor flow={flow} onChange={() => {}} ctx={ctx} />);
    expect(html).toMatch(/min="1"[^>]*value="2"|value="2"[^>]*min="1"/);
  });
});


describe('FlowEditor — nœud Test : condition d’accès (`gate`, MDG 15 l.197)', () => {
  it('une gate authorée s’édite par l’éditeur de Condition', () => {
    const flow: Flow = { kind: 'test', test: { skill: { id: 'priere' }, gate: { kind: 'talent', id: 'beni', spec: 'manann' } }, reussite: EMPTY_FLOW, echec: EMPTY_FLOW };
    const html = renderToStaticMarkup(<FlowEditor flow={flow} onChange={() => {}} ctx={ctx} />);
    expect(html).toMatch(/checked=""[^>]*\/?> Condition d’accès/);
    expect(html).toContain('manann');
  });

  it('cocher la case pose une gate, la décocher la retire', async () => {
    const basculer = (flow: Flow): string => {
      let dernier: Flow | undefined;
      const { container } = monterRacine(<FlowEditor flow={flow} onChange={(f) => { dernier = f; }} ctx={ctx} />);
      [...container.querySelectorAll('label.ed-check')].find((l) => l.textContent?.includes('Condition d’accès'))!.querySelector('input')!.click();
      return JSON.stringify(dernier);
    };
    expect(basculer(testFlow('priere'))).toContain('"gate":{"kind":"always"}');
    expect(basculer({ kind: 'test', test: { skill: { id: 'priere' }, gate: { kind: 'always' } }, reussite: EMPTY_FLOW, echec: EMPTY_FLOW })).not.toContain('"gate"');
  });
});

describe('FlowEditor — nœud Test : Statut de l’interlocuteur (`vsStatus`, LDB 08)', () => {
  function monter(depart: FlowTest) {
    let dernier = depart;
    function Banc() {
      const [test, setTest] = useState(depart);
      return <TestFields test={test} onChange={(t) => { dernier = t; setTest(t); }} />;
    }
    const { container } = monterRacine(<Banc />);
    return { container, lu: () => dernier };
  }
  const echelon = (container: HTMLElement) => container.querySelector<HTMLSelectElement>('select[aria-label="Échelon de l’interlocuteur"]')!;
  const choisirEchelon = (container: HTMLElement, valeur: string) => act(() => {
    echelon(container).value = valeur;
    echelon(container).dispatchEvent(new Event('change', { bubbles: true }));
  });

  it('l’Échelon puis le Standing saisis écrivent le Statut dans le Test', async () => {
    const { container, lu } = monter({ skill: { id: 'charme' } });
    await choisirEchelon(container, 'argent');
    expect(lu().vsStatus).toEqual({ tier: 'argent', standing: 1 });
    const standing = container.querySelector<HTMLInputElement>('input[aria-label="Standing de l’interlocuteur"]')!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(() => {
      setter?.call(standing, '3');
      standing.dispatchEvent(new Event('input', { bubbles: true }));
      standing.dispatchEvent(new Event('focusout', { bubbles: true }));
    });
    expect(lu().vsStatus).toEqual({ tier: 'argent', standing: 3 });
  });

  it('« aucun » Échelon retire le Statut du Test', async () => {
    const { container, lu } = monter({ skill: { id: 'charme' }, vsStatus: { tier: 'or', standing: 2 } });
    expect(echelon(container).value).toBe('or');
    await choisirEchelon(container, '');
    expect(lu().vsStatus).toBeUndefined();
  });
});
