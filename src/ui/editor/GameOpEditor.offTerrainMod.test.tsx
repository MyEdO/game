// @vitest-environment jsdom
/**
 * `offTerrainMod` à l'atelier (#1789) — le terrain d'ÉLECTION est une RÉF au registre
 * (`terrains.json`) : il s'élit dans une liste dérivée de `terrainsElectifs()`, jamais au clavier en
 * JSON libre. Doctrine « la LOGIQUE est keyée par id, le `label` est de l'AFFICHAGE » (CLAUDE.md) :
 * l'option porte l'id en `value` et le libellé FR en texte, et c'est l'ID qui atterrit au payload.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { GameOpEditor, newOp, opSummary } from './GameOpEditor';
import { terrainsElectifs, terrainAbsent, terrainHorsGrille, tousLesTerrains } from '../../state/terrain';
import type { GameOp } from '../../engine/ops';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root;

function monter(ops: GameOp[], vus: GameOp[][]) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<GameOpEditor objets={[]} sansSource={false} ops={ops} onChange={(next) => vus.push(next)} />); });
}

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

/** Dernier payload remonté par l'éditeur — c'est lui qui porte le verdict. */
const dernierVu = (vus: GameOp[][]): GameOp[] | undefined => vus[vus.length - 1];

const selectDuTerrain = () =>
  container.querySelector<HTMLSelectElement>('select[aria-label="Terrain d’élection"]')!;

describe('GameOpEditor — offTerrainMod a un éditeur DÉDIÉ', () => {
  it('le terrain s’élit dans la liste du registre (aucun repli JSON), défaut = le terrain d’élection dérivé', () => {
    const vus: GameOp[][] = [];
    monter([newOp('offTerrainMod')], vus);
    const select = selectDuTerrain();
    expect(select, 'aucun <select> de terrain : l’op est retombée sur le repli JSON').toBeTruthy();
    expect(select.querySelectorAll('option')).toHaveLength(terrainsElectifs().length);
    expect(select.value).toBe((newOp('offTerrainMod') as { terrain: string }).terrain);
    expect(container.querySelector('textarea'), 'un repli JSON subsiste pour une op DÉDIÉE').toBeNull();
  });

  it('les options portent l’ID en value et le LIBELLÉ en texte, dans l’ordre du registre', () => {
    monter([newOp('offTerrainMod')], []);
    const options = [...selectDuTerrain().querySelectorAll('option')];
    expect(options.map((o) => o.value)).toEqual(terrainsElectifs().map((t) => t.id));
    expect(options.map((o) => o.textContent)).toEqual(terrainsElectifs().map((t) => t.label));
  });

  /**
   * Un porteur de RÔLE n'est pas un terrain d'élection : `vide` est l'ABSENCE de tuile et `mur` ce que
   * la grille rend au-delà de ses bornes — les proposer écrirait un payload absurde (« hors de
   * l'absence de tuile »). La liste se DEMANDE au seam (`terrainsElectifs`), qui les retire par leurs
   * DRAPEAUX : ce test interroge le seam, jamais des ids récités.
   */
  it('les porteurs de rôle (absence, bord du monde) ne sont PAS proposables', () => {
    monter([newOp('offTerrainMod')], []);
    const ids = [...selectDuTerrain().querySelectorAll('option')].map((o) => o.value);
    expect(ids, 'l’absence de tuile est proposée comme terrain d’élection').not.toContain(terrainAbsent());
    expect(ids, 'le bord du monde est proposé comme terrain d’élection').not.toContain(terrainHorsGrille());
    // Non-vacuité : le registre BRUT les porte bien — sans quoi ces deux `not.toContain` passeraient seuls.
    expect(tousLesTerrains().map((t) => t.id), 'sonde vacue : le registre brut ne porte plus ces rôles')
      .toEqual(expect.arrayContaining([terrainAbsent(), terrainHorsGrille()]));
  });

  /** Le défaut vient de la même liste : il est ÉLECTIF, et non franchissable à pied. */
  it('le terrain proposé par défaut est un terrain ÉLECTIF non franchissable', () => {
    const defaut = (newOp('offTerrainMod') as { terrain: string }).terrain;
    const entree = terrainsElectifs().find((t) => t.id === defaut);
    expect(entree, 'le défaut n’est pas dans la liste proposée').toBeTruthy();
    expect(entree!.walkable).toBe(false);
  });

  /** `suffocates` est une clause du payload : le résumé la MONTRE, sans quoi deux ops distinctes
   *  rendent la même ligne à l'atelier. */
  it('le résumé dit la SUFFOCATION, et ne la dit pas quand la clause est absente', () => {
    const base = newOp('offTerrainMod') as Extract<GameOp, { op: 'offTerrainMod' }>;
    expect(opSummary(base, [])).not.toContain('suffoque');
    expect(opSummary({ ...base, suffocates: true }, [])).toContain('suffoque');
  });

  it('élire une autre entrée écrit son ID au payload, et le résumé en montre le LIBELLÉ', () => {
    const vus: GameOp[][] = [];
    monter([newOp('offTerrainMod')], vus);
    const select = selectDuTerrain();
    const autre = tousLesTerrains().find((t) => t.id !== select.value)!;
    act(() => {
      select.value = autre.id;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(dernierVu(vus)?.[0]).toMatchObject({ op: 'offTerrainMod', terrain: autre.id });
    expect(opSummary(dernierVu(vus)![0], [])).toContain(autre.label);
    expect(opSummary(dernierVu(vus)![0], []), 'un id nu s’affiche là où le libellé est dû').not.toContain(`hors ${autre.id}`);
  });

  it('vider « M imposé » ÔTE la clé du payload — jamais une clé à `undefined`', () => {
    const vus: GameOp[][] = [];
    monter([newOp('offTerrainMod')], vus);
    const champ = [...container.querySelectorAll<HTMLInputElement>('input')]
      .find((i) => i.getAttribute('aria-label')?.startsWith('Mouvement imposé'))!;
    expect(champ, 'aucun champ « M imposé »').toBeTruthy();
    // Frappe RÉELLE dans un `<input>` contrôlé (patron `NumberField.test.tsx`) : le setter natif
    // contourne le cache de valeur de React, sans quoi l'événement ne porte pas la nouvelle valeur.
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    act(() => {
      setter.call(champ, '');
      champ.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const dernier = dernierVu(vus)![0] as Record<string, unknown>;
    expect('mSet' in dernier, 'la clé vidée reste au payload').toBe(false);
  });
});
