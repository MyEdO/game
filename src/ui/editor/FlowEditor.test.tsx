// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { FlowEditor } from './FlowEditor';
import { EMPTY_FLOW, type Flow } from '../../state/flow';
import { CIBLES_D_EFFET_DE_SCENE } from '../../state/combatEffects';
import { monterRacine, demonterRacines } from '../../monterRacine.testkit';
import { entreeDe, menuDe, ouvrirMenu } from './AddMenu.testkit';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(demonterRacines);

const ctx = { encounters: [], dialogues: [], cibles: CIBLES_D_EFFET_DE_SCENE };
const testFlow = (skill: string, vsGroups?: string[]): Flow => ({
  kind: 'test',
  test: { skill: { id: skill }, ...(vsGroups ? { vsGroups } : {}) },
  success: EMPTY_FLOW,
  fail: EMPTY_FLOW,
});

describe('FlowEditor — nœud Test : champ Interlocuteur/groupes (P3)', () => {
  it('un Test de SOCIABILITÉ (Charme) expose le champ des groupes de l’interlocuteur', () => {
    const html = renderToStaticMarkup(<FlowEditor flow={testFlow('charme', ['Elfe'])} onChange={() => {}} ctx={ctx} />);
    expect(html).toMatch(/Interlocuteur/i);
    expect(html).toContain('Elfe'); // la valeur courante est affichée
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
    const flow: Flow = { kind: 'if', cond: { kind: 'flag', expr: 'porte_ouverte' }, then: EMPTY_FLOW };
    const html = renderToStaticMarkup(<FlowEditor flow={flow} onChange={() => {}} ctx={ctx} />);
    expect(html).toContain('porte_ouverte'); // la condition de flag est éditée
    expect(html).toContain('ALORS');
  });
});

describe('#1318 E1 — le domaine des crans de facilité atteint le champ (cale de NumberField)', () => {
  it('le champ « cran(s) » porte sa borne basse (au moins un cran)', () => {
    const flow: Flow = { kind: 'test', test: { skill: { id: 'escalade' }, easierIf: { hasSkill: { id: 'escalade' }, steps: 2 } }, success: EMPTY_FLOW, fail: EMPTY_FLOW };
    const html = renderToStaticMarkup(<FlowEditor flow={flow} onChange={() => {}} ctx={ctx} />);
    expect(html).toMatch(/min="1"[^>]*value="2"|value="2"[^>]*min="1"/);
  });
});

