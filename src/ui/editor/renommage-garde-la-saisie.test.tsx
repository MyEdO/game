import type { JSX } from 'react';
// @vitest-environment jsdom
/**
 * #1993 — un porteur RENOMMÉ reste le même porteur : l'état de ses champs (texte d'un `JsonField` en
 * cours de saisie, encore invalide) survit au renommage de son id. Et un AUTRE porteur, sélectionné à
 * sa place, ne reçoit jamais cet état : le panneau se remonte sur lui.
 *
 * Porteurs mesurés : zone d'effet et action authorée de l'inspecteur, dialogue, trigger et nœud de
 * dialogue du panneau Logique — chacun keyed sur son identité STABLE (`useClesDeRangees`), jamais sur
 * l'id qu'il renomme.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Inspector } from './Inspector';
import { LogicDock, type LogicTab } from './LogicDock';
import type { Sel } from './editorState';
import { emptyScene, type Scene, type SceneEntity, type Effect } from '../../state/scene';
import type { Flow } from '../../state/flow';
import type { GameOp } from '../../engine/ops';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root;

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

function monter(el: JSX.Element) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(el); });
}

/** Une op SANS éditeur dédié : ses paramètres s'éditent au `JsonField` (repli de `GameOpEditor`). */
const opJson = (amount: number): GameOp => ({ op: 'statusMod', amount } as GameOp);
const fluxJson = (amount: number): Flow => ({ kind: 'seq', steps: [{ kind: 'do', effect: { type: 'ops', ops: [opJson(amount)] } as unknown as Effect }] } as Flow);
const BROUILLON = '{ "op": "statusMod", "amount": ';

/** Les `JsonField` des paramètres d'op montés. */
const jsons = (): HTMLTextAreaElement[] =>
  [...container.querySelectorAll<HTMLTextAreaElement>('textarea')].filter((t) => t.closest('label')?.textContent?.includes('paramètres de l’op'));

/** Le premier `JsonField` affiche les paramètres PROPRES du porteur courant, jamais le brouillon d'un autre. */
function afficheSesParametres(amount: number, message: string) {
  expect(jsons()[0].value, message).not.toBe(BROUILLON);
  expect(JSON.parse(jsons()[0].value), message).toEqual(opJson(amount));
}

function saisir(champ: HTMLInputElement | HTMLTextAreaElement, valeur: string) {
  const proto = champ instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(champ, valeur);
    champ.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

/** Renomme par un `EntryRename` : frappe, puis commit au blur. */
function renommerAuBlur(champ: HTMLInputElement, valeur: string) {
  act(() => { champ.focus(); });
  saisir(champ, valeur);
  act(() => { champ.blur(); });
}

const champSousLibelle = (libelle: string): HTMLInputElement => {
  const l = [...container.querySelectorAll('label')].find((x) => x.textContent?.includes(libelle));
  expect(l, `aucun champ « ${libelle} »`).toBeTruthy();
  return l!.querySelector('input')!;
};

// ─── Inspecteur ────────────────────────────────────────────────────────────────────────────────

let choisir: (s: Sel) => void = () => undefined;
let sceneVue: Scene;

function Inspecteur({ initiale, sel0 }: { initiale: Scene; sel0: Sel }) {
  const [scene, setScene] = useState(initiale);
  const [sel, setSel] = useState<Sel>(sel0);
  choisir = setSel;
  sceneVue = scene;
  return (
    <Inspector
      scene={scene}
      otherScenes={[]}
      worldMap={null}
      setScene={setScene}
      sel={sel}
      setSel={setSel}
      enemyCreatures={[]}
      openLogic={() => undefined}
      resizeScene={() => undefined}
      narratif={{ affaires: [], indices: [], presetsPnj: [], objets: [] }}
      tool={{ mode: 'select' }}
      armZoneTiles={() => undefined}
      zoneFocusKey={null}
    />
  );
}

describe('inspecteur — un porteur renommé garde la saisie de ses champs (#1993)', () => {
  const zones: Scene = {
    ...emptyScene(8, 8),
    effectZones: [
      { id: 'piege-a', label: 'Piège A', area: { kind: 'rect', x: 0, y: 0, w: 2, h: 2 }, onCross: [opJson(1)] },
      { id: 'piege-b', label: 'Piège B', area: { kind: 'rect', x: 4, y: 4, w: 2, h: 2 }, onCross: [opJson(2)] },
    ],
  };

  it('zone d’effet : renommer l’id garde le JSON en cours de saisie ; une autre zone ne le reçoit pas', () => {
    monter(<Inspecteur initiale={zones} sel0={{ type: 'effectZone', idx: 0 }} />);
    saisir(jsons()[0], BROUILLON);
    renommerAuBlur(champSousLibelle('Identifiant'), 'piege-a-renomme');
    expect(sceneVue.effectZones?.[0].id, 'le renommage n’a pas été appliqué').toBe('piege-a-renomme');
    expect(jsons()[0].value, 'le renommage a effacé le JSON en saisie').toBe(BROUILLON);

    act(() => { choisir({ type: 'effectZone', idx: 1 }); });
    afficheSesParametres(2, 'la zone B affiche le brouillon de la zone A');
  });

  const decor = (id: string, amount: number): SceneEntity => ({
    id, kind: 'prop', pos: { x: 0, y: 0 }, ref: 'tonneau',
    usable: { actions: [{ id: 'fouiller', flow: fluxJson(amount), unique: true }] },
  } as SceneEntity);

  it('action authorée : renommer l’id garde le JSON en cours de saisie ; un autre décor ne le reçoit pas', () => {
    monter(<Inspecteur initiale={{ ...emptyScene(8, 8), entities: [decor('d1', 1), decor('d2', 2)] }} sel0={{ type: 'entity', id: 'd1' }} />);
    saisir(jsons()[0], BROUILLON);
    renommerAuBlur(champSousLibelle('Identifiant (logique'), 'fouiller-renomme');
    expect(sceneVue.entities[0].usable?.actions?.[0].id, 'le renommage n’a pas été appliqué').toBe('fouiller-renomme');
    expect(jsons()[0].value, 'le renommage a effacé le JSON en saisie').toBe(BROUILLON);

    act(() => { choisir({ type: 'entity', id: 'd2' }); });
    afficheSesParametres(2, 'le décor d2 affiche le brouillon du décor d1');
  });
});

// ─── Panneau Logique ───────────────────────────────────────────────────────────────────────────

let choisirTrigger: (id: string | null) => void = () => undefined;
let choisirDialogue: (id: string | null) => void = () => undefined;

function Dock({ initiale, onglet, trig0 = null, dlg0 = null }: { initiale: Scene; onglet: LogicTab; trig0?: string | null; dlg0?: string | null }) {
  const [scene, setScene] = useState(initiale);
  const [trigSel, setTrigSel] = useState<string | null>(trig0);
  const [dlgSel, setDlgSel] = useState<string | null>(dlg0);
  const [encSel, setEncSel] = useState<string | null>(null);
  choisirTrigger = setTrigSel;
  choisirDialogue = setDlgSel;
  sceneVue = scene;
  return (
    <LogicDock
      scene={scene} otherScenes={[]} worldMap={null} objets={[]} setScene={setScene}
      warnings={[]} onSelectWarning={() => undefined}
      tab={onglet} setTab={() => undefined} height={400} setHeight={() => undefined}
      trigSel={trigSel} setTrigSel={setTrigSel} dlgSel={dlgSel} setDlgSel={setDlgSel} encSel={encSel} setEncSel={setEncSel}
      onSelectEntity={() => undefined} currentLayer={0}
    />
  );
}

describe('panneau Logique — un porteur renommé garde la saisie de ses champs (#1993)', () => {
  const trigger = (id: string, amount: number) => ({ id, rect: { x: 0, y: 0, w: 1, h: 1 }, once: true, flow: fluxJson(amount) });

  it('trigger : renommer l’id garde le JSON en saisie ; un autre trigger ne le reçoit pas', () => {
    monter(<Dock initiale={{ ...emptyScene(8, 8), triggers: [trigger('t1', 1), trigger('t2', 2)] }} onglet="triggers" trig0="t1" />);
    saisir(jsons()[0], BROUILLON);
    saisir(champSousLibelle('Id'), 't1-renomme');
    expect(sceneVue.triggers[0].id).toBe('t1-renomme');
    expect(jsons()[0].value, 'le renommage a effacé le JSON en saisie').toBe(BROUILLON);

    act(() => { choisirTrigger('t2'); });
    afficheSesParametres(2, 'le trigger t2 affiche le brouillon du trigger t1');
  });

  const dialogue = (id: string, amount: number) => ({
    id, start: 'n1',
    nodes: [
      { id: 'n1', desc: 'un', choices: [{ label: 'c1', flow: fluxJson(amount) }] },
      { id: 'n2', desc: 'deux', choices: [{ label: 'c2', flow: fluxJson(amount + 10) }] },
    ],
  });

  it('dialogue : renommer l’id du dialogue, puis du nœud, garde le JSON en saisie', () => {
    monter(<Dock initiale={{ ...emptyScene(8, 8), dialogues: [dialogue('d1', 1), dialogue('d2', 2)] }} onglet="dialogues" dlg0="d1" />);
    saisir(jsons()[0], BROUILLON);
    saisir(champSousLibelle('Id du dialogue'), 'd1-renomme');
    expect(sceneVue.dialogues[0].id).toBe('d1-renomme');
    expect(jsons()[0].value, 'renommer le dialogue a effacé le JSON en saisie').toBe(BROUILLON);

    saisir(container.querySelector<HTMLInputElement>('input.node-id')!, 'n1-renomme');
    expect(sceneVue.dialogues[0].nodes[0].id).toBe('n1-renomme');
    expect(jsons()[0].value, 'renommer le nœud a effacé le JSON en saisie').toBe(BROUILLON);

    act(() => { choisirDialogue('d2'); });
    afficheSesParametres(2, 'le dialogue d2 affiche le brouillon du dialogue d1');
  });

  it('nœud de dialogue : un autre nœud ne reçoit pas le JSON en saisie du précédent', () => {
    monter(<Dock initiale={{ ...emptyScene(8, 8), dialogues: [dialogue('d1', 1)] }} onglet="dialogues" dlg0="d1" />);
    saisir(jsons()[0], BROUILLON);
    const n2 = [...container.querySelectorAll<HTMLElement>('.dlg-nodes .listrow, .dlg-nodes [role="button"], .dlg-nodes button')]
      .find((x) => x.textContent?.includes('n2') && x.textContent?.includes('deux'));
    expect(n2, 'aucune rangée pour le nœud n2').toBeTruthy();
    act(() => { n2!.click(); });
    afficheSesParametres(11, 'le nœud n2 affiche le brouillon du nœud n1');
  });
});
