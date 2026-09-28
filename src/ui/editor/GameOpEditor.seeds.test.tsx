// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { GameOpEditor, OP_LABEL, OP_REF_FIELDS, opRefValue } from './GameOpEditor';
import type { GameOp } from '../../engine/ops';
import { choisirDansMenu, entreeDe, menuDe, ouvrirMenu } from './AddMenu.testkit';
import { monterRacine, demonterRacines } from '../../monterRacine.testkit';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(demonterRacines);

/**
 * PREUVE D'INTERACTION (montage réel, clic réel) : ce que l'auteur obtient EN CLIQUANT dans la palette
 * « + Op mécanique ». Le rendu statique ne suffit pas — le défaut mesuré (`talentId: 'sang-froid'`,
 * `ref: 'Loup'`) naissait précisément du CLIC de création.
 */
function mount() {
  let ops: GameOp[] = [];
  const editeur = () => <GameOpEditor ops={ops} onChange={(next) => { ops = next; montage.rendre(editeur()); }} />;
  const montage = monterRacine(editeur());
  const { container } = montage;
  return {
    container,
    opsOf: () => ops,
    palette: () => ouvrirMenu(menuDe(container, '+ Op mécanique')),
    click: (label: string) => choisirDansMenu(menuDe(container, '+ Op mécanique'), label),
  };
}

describe('GameOpEditor — création au CLIC : aucune valeur pré-semée, raison visible', () => {
  it('créer « Accorder un Talent » n’élit aucun talent et affiche la raison', async () => {
    const h = mount();
    await h.click(OP_LABEL.grantTalent);

    expect(h.opsOf()).toHaveLength(1);
    expect(h.opsOf()[0]).toEqual({ op: 'grantTalent', talent: { id: '' } });
    expect(h.container.textContent).toContain('Talent à choisir');
    // Le sélecteur porte SA sentinelle et ne pointe sur aucune entrée du registre.
    const select = Array.from(h.container.querySelectorAll('select')).find((s) => s.value === '');
    expect(select, 'sélecteur de talent sur la sentinelle vide').toBeTruthy();
    expect(h.container.innerHTML).toContain('(choisir dans talents)');
  });

  it('créer « Invoquer une créature » n’élit aucune créature (fin du mannequin « Loup »)', async () => {
    const h = mount();
    await h.click(OP_LABEL.summon);

    expect((h.opsOf()[0] as Extract<GameOp, { op: 'summon' }>).ref).toBe('');
    expect(h.container.textContent).toContain('Créature à choisir');
  });

  it('« Dôme protecteur » : le formulaire porte TOUT ce que l’op porte — Trait et Indice, et RIEN de plus', async () => {
    // Une op qui entre dans `DEDICATED` perd sa trappe JSON : son formulaire doit alors rendre TOUT ce
    // que l'op porte, sinon un champ devient inéditable sans que rien ne rougisse (vécu : le rayon).
    // La ZONE, elle, n'est PAS de l'op : elle vit dans la ligne « Cible » du sort (ZdE), un seul endroit.
    const h = mount();
    await h.click(OP_LABEL.domeWard);

    const op = h.opsOf()[0] as Extract<GameOp, { op: 'domeWard' }>;
    expect(Object.keys(op).sort(), 'la graine porte exactement ce que l’op déclare').toEqual(['indice', 'op', 'traitId']);
    expect(h.container.textContent ?? '', 'l’Indice de la sauvegarde s’édite').toContain('Indice');
    expect(h.container.innerHTML, 'le Trait s’élit dans le registre').toContain('(choisir dans traits)');
    expect(h.container.querySelectorAll('textarea').length, 'plus de trappe JSON quand le formulaire est complet').toBe(0);
  });

  it('TOUTE op créable depuis la palette naît sans réf élue', async () => {
    let creees = 0;
    for (const [k, fields] of Object.entries(OP_REF_FIELDS) as [GameOp['op'], typeof OP_REF_FIELDS[GameOp['op']]][]) {
      const h = mount();
      const label = OP_LABEL[k];
      const entree = entreeDe(await h.palette(), label);
      if (!entree) { demonterRacines(); continue; }
      await act(async () => { entree.click(); });
      creees += 1;
      const fresh = h.opsOf()[0] as unknown as Record<string, unknown>;
      for (const f of fields ?? []) {
        expect([undefined, ''], `${k}.${f.field} pré-semé au clic`).toContain(opRefValue(fresh, f.field));
      }
      demonterRacines();
    }
    expect(creees, 'témoin : la palette ouverte propose des ops à réf').toBeGreaterThan(0);
  });
});
