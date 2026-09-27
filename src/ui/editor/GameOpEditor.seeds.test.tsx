// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { GameOpEditor, OP_LABEL, OP_REF_FIELDS, opRefValue } from './GameOpEditor';
import type { GameOp } from '../../engine/ops';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

/**
 * PREUVE D'INTERACTION (montage réel, clic réel) : ce que l'auteur obtient EN CLIQUANT dans la palette
 * « + Op mécanique ». Le rendu statique ne suffit pas — le défaut mesuré (`talentId: 'sang-froid'`,
 * `ref: 'Loup'`) naissait précisément du CLIC de création.
 */
function mount() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  let ops: GameOp[] = [];
  const render = () => root.render(<GameOpEditor ops={ops} onChange={(next) => { ops = next; render(); }} />);
  return {
    container, root,
    opsOf: () => ops,
    mount: () => act(async () => { render(); }),
    click: (label: string) => {
      const btn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === label);
      if (!btn) throw new Error(`bouton « ${label} » absent de la palette`);
      return act(async () => { (btn as HTMLButtonElement).click(); });
    },
    teardown: async () => { await act(async () => { root.unmount(); }); container.remove(); },
  };
}

describe('GameOpEditor — création au CLIC : aucune valeur pré-semée, raison visible', () => {
  it('créer « Accorder un Talent » n’élit aucun talent et affiche la raison', async () => {
    const h = mount();
    await h.mount();
    await h.click(OP_LABEL.grantTalent);

    expect(h.opsOf()).toHaveLength(1);
    expect(h.opsOf()[0]).toEqual({ op: 'grantTalent', talent: { id: '' } });
    expect(h.container.textContent).toContain('Talent à choisir');
    // Le sélecteur porte SA sentinelle et ne pointe sur aucune entrée du registre.
    const select = Array.from(h.container.querySelectorAll('select')).find((s) => s.value === '');
    expect(select, 'sélecteur de talent sur la sentinelle vide').toBeTruthy();
    expect(h.container.innerHTML).toContain('(choisir dans talents)');
    await h.teardown();
  });

  it('créer « Invoquer une créature » n’élit aucune créature (fin du mannequin « Loup »)', async () => {
    const h = mount();
    await h.mount();
    await h.click(OP_LABEL.summon);

    expect((h.opsOf()[0] as Extract<GameOp, { op: 'summon' }>).ref).toBe('');
    expect(h.container.textContent).toContain('Créature à choisir');
    await h.teardown();
  });

  it('« Dôme protecteur » : le formulaire porte TOUT ce que l’op porte — Trait et Indice, et RIEN de plus', async () => {
    // Une op qui entre dans `DEDICATED` perd sa trappe JSON : son formulaire doit alors rendre TOUT ce
    // que l'op porte, sinon un champ devient inéditable sans que rien ne rougisse (vécu : le rayon).
    // La ZONE, elle, n'est PAS de l'op : elle vit dans la ligne « Cible » du sort (ZdE), un seul endroit.
    const h = mount();
    await h.mount();
    await h.click(OP_LABEL.domeWard);

    const op = h.opsOf()[0] as Extract<GameOp, { op: 'domeWard' }>;
    expect(Object.keys(op).sort(), 'la graine porte exactement ce que l’op déclare').toEqual(['indice', 'op', 'traitId']);
    expect(h.container.textContent ?? '', 'l’Indice de la sauvegarde s’édite').toContain('Indice');
    expect(h.container.innerHTML, 'le Trait s’élit dans le registre').toContain('(choisir dans traits)');
    expect(h.container.querySelectorAll('textarea').length, 'plus de trappe JSON quand le formulaire est complet').toBe(0);
    await h.teardown();
  });

  it('TOUTE op créable depuis la palette naît sans réf élue', async () => {
    for (const [k, fields] of Object.entries(OP_REF_FIELDS) as [GameOp['op'], typeof OP_REF_FIELDS[GameOp['op']]][]) {
      const h = mount();
      await h.mount();
      const label = OP_LABEL[k];
      const creatable = Array.from(h.container.querySelectorAll('button')).some((b) => b.textContent?.trim() === label);
      if (!creatable) { await h.teardown(); continue; }
      await h.click(label);
      const fresh = h.opsOf()[0] as unknown as Record<string, unknown>;
      for (const f of fields ?? []) {
        expect([undefined, ''], `${k}.${f.field} pré-semé au clic`).toContain(opRefValue(fresh, f.field));
      }
      await h.teardown();
    }
  });
});
