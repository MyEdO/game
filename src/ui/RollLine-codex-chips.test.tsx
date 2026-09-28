// @vitest-environment jsdom
/**
 * Chips de modificateur CODEX-LIÉES (#1078 LOT B3a). Trois contrats :
 *  1. une ligne qui porte sa RÈGLE (`ModLine.ref`) rend un `CodexRef` CLIQUABLE (la chip EST
 *     l'affordance — il n'y a plus d'ⓘ voisin) ;
 *  2. son infobulle s'ouvre DANS le corps DÉFILABLE d'une `RollShell` (`.modal-body` de `Modal`) sans être
 *     coupé : `CodexRef` le rend en PORTAL sur `document.body`, hors du scrollport ;
 *  3. la PROVENANCE se NOMME au rendu : aucun producteur ne passe de résolveur (recette B3a —
 *     un site qui l'oubliait affichait « pregen-101 » à l'écran).
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { RollShell } from './RollShell';
import { buildRollRow } from './rollRowBuild';
import { RULE_REF } from '../engine/ruleRefs';
import type { PendingRoll } from './RollLine';
import { soutienMod, partyAssisted, supportSplit } from '../engine/skills';
import { useGame } from '../state/store';
import type { Combatant } from '../engine/types';

const mount = (node: React.ReactElement) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(node); });
  return { container, root };
};

const pending = (mods: PendingRoll['mods']): PendingRoll => ({ label: 'Projectiles', base: 55, mods });

function shell(mods: PendingRoll['mods']) {
  return (
    <RollShell
      title="Tir"
      rows={[buildRollRow({ row: { pending: pending(mods) } })]}
      rolled={false}
      actions={[]}
    />
  );
}

describe('ModChips — la chip PORTE sa règle (#1078)', () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });
  let container: HTMLDivElement;
  let root: Root;
  afterEach(() => {
    act(() => { root.unmount(); }); // démonte aussi les portals d'infobulle (React les possède)
    container.remove();
  });

  it('ligne AVEC ref → chip CodexRef cliquable ; ligne SANS ref → span muet', () => {
    ({ container, root } = mount(shell([
      { label: 'Viser', value: 20, famille: 'circonstance', ref: RULE_REF.viser },
      { label: 'Avantage', value: 10, famille: 'jet' },
    ])));
    const chips = [...container.querySelectorAll('.rm-mod')];
    expect(chips).toHaveLength(2);
    const [viser, avantage] = chips;
    expect(viser.textContent).toBe('+20 Viser');
    expect(viser.classList.contains('codex-ref')).toBe(true);
    expect(viser.getAttribute('role')).toBe('button'); // cliquable → ouvre la fiche Codex
    expect(viser.getAttribute('tabindex')).toBe('0');
    // La ligne sans règle ne prétend rien : ni infobulle, ni clic.
    expect(avantage.classList.contains('codex-ref')).toBe(false);
    expect(avantage.getAttribute('role')).toBeNull();
  });

  it('INFOBULLE dans le corps DÉFILÉ (.modal-body) : porté sur document.body, hors du scrollport', () => {
    ({ container, root } = mount(shell([{ label: 'Viser', value: 20, famille: 'circonstance', ref: RULE_REF.viser }])));
    const scroll = container.querySelector('.modal-body');
    expect(scroll, 'la coquille rend bien son corps défilable').not.toBeNull();
    const chip = container.querySelector('.rm-mod.codex-ref') as HTMLElement;
    expect(scroll!.contains(chip), 'la chip vit DANS le scrollport').toBe(true);

    act(() => { chip.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
    const pop = document.querySelector('.infobulle');
    expect(pop, 'l’infobulle est rendue').not.toBeNull();
    // Le PORTAL : l'infobulle n'est PAS un descendant du scrollport (aucun clipping `overflow`
    // possible), il est monté directement sous <body>.
    expect(scroll!.contains(pop!)).toBe(false);
    expect(pop!.parentElement).toBe(document.body);
    // Et il porte bien le texte de la RÈGLE (la prose de sa fiche `regles`), pas un rappel maison.
    expect(pop!.textContent).toContain('viser');
  });

  // ── PROVENANCE : arbitrage user 2026-08-05, verbatim « Normalement les informations de ce genre
  //    sont dans le hover codex non ? » — les noms ne flottent plus à côté de la chip (illisibles,
  //    rattachés à rien) : ils vivent DANS l'infobulle de la chip, qui porte déjà sa règle.
  it('provenance `by` : AUCUN badge inline — les noms partent à l’infobulle de la chip', () => {
    ({ container, root } = mount(shell([
      { label: 'Soutien', value: 20, famille: 'jet', ref: RULE_REF.soutien, by: [{ label: 'Perdita' }, { label: 'Valentyn' }] },
    ])));
    expect(container.querySelectorAll('.rm-roll-mods .entity-badge'), 'plus de badge flottant').toHaveLength(0);
    // La chip reste sobre et porte toujours sa règle (affordance CodexRef).
    const chip = container.querySelector('.rm-mod')!;
    expect(chip.textContent).toBe('+20 Soutien');
    expect(chip.className).toContain('codex-ref');
  });

  // ── Recette B3a, capture 07 : « pregen-101 » s'affichait parce que `medicFlow` n'avait pas passé
  //    de résolveur id→nom. La résolution est REMONTÉE au rendu : aucun producteur n'en fournit.
  it('les NOMS viennent du store, et aucun id brut ne fuit à l’écran', () => {
    const party = [
      { id: 'pregen-101', label: 'Perdita' },
      { id: 'pregen-102', label: 'Valentyn' },
    ] as Combatant[];
    useGame.setState({ party, battle: null });
    // `soutienMod` est le producteur RÉEL, appelé comme tout site l'appelle : un seul argument.
    const mod = soutienMod({ count: 2, bonus: 20, ids: ['pregen-101', 'pregen-102'] })!;
    expect(mod.by, 'le moteur reste PUR : il ne connaît que des ids').toEqual([{ id: 'pregen-101' }, { id: 'pregen-102' }]);
    ({ container, root } = mount(shell([mod])));
    expect(container.textContent).not.toContain('pregen-101');
    expect(container.textContent).not.toContain('Perdita'); // à l'infobulle, pas sur la ligne
  });

  // ── #1117 (recette) : « les soutiens sont invisibles ». Le contrat NÉGATIF ci-dessus (aucun badge
  //    sur la ligne) est vrai sans que l'information soit LISIBLE nulle part — il faut donc prouver
  //    l'autre bout : l'infobulle de la chip, atteignable au survol ET au focus clavier, les NOMME.
  it('l’infobulle de la chip Soutien NOMME les soutiens (survol)', () => {
    useGame.setState({ party: [{ id: 'pregen-101', label: 'Perdita' }, { id: 'pregen-102', label: 'Valentyn' }] as Combatant[], battle: null });
    const mod = soutienMod({ count: 2, bonus: 20, ids: ['pregen-101', 'pregen-102'] })!;
    ({ container, root } = mount(shell([mod])));
    const chip = container.querySelector('.rm-mod.codex-ref') as HTMLElement;
    act(() => { chip.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
    const pop = document.querySelector('.infobulle')!;
    expect(pop.textContent).toContain('Perdita');
    expect(pop.textContent).toContain('Valentyn');
  });

  it('la même information s’atteint au CLAVIER (focus), pas seulement à la souris', () => {
    useGame.setState({ party: [{ id: 'pregen-101', label: 'Perdita' }] as Combatant[], battle: null });
    const mod = soutienMod({ count: 1, bonus: 10, ids: ['pregen-101'] })!;
    ({ container, root } = mount(shell([mod])));
    const chip = container.querySelector('.rm-mod.codex-ref') as HTMLElement;
    act(() => { chip.focus(); });
    expect(document.querySelector('.infobulle')?.textContent).toContain('Perdita');
  });

  // ── Le bout AMONT : le producteur réel du voyage (`partyAssisted` → `supportSplit`) doit livrer
  //    une ligne dont la provenance est PEUPLÉE — une étape qui perdrait `support.ids` afficherait
  //    « +20 Soutien » sans jamais pouvoir dire qui.
  it('chaîne RÉELLE partyAssisted → supportSplit → chip : la provenance arrive peuplée', () => {
    const party = [
      { id: 'pregen-101', label: 'Perdita', characteristics: { force: 40 }, skills: {}, wounds: 10 },
      { id: 'pregen-102', label: 'Valentyn', characteristics: { force: 30 }, skills: {}, wounds: 10 },
    ] as unknown as Combatant[];
    useGame.setState({ party, battle: null });
    const assisted = partyAssisted(party, undefined, 'force')!;
    const { base, mods } = supportSplit(assisted.value, assisted.support);
    expect(base, 'la base affichée redevient celle du meneur seul').toBe(40);
    expect(mods[0].value, 'le Soutien est une ligne NOMMÉE').toBeGreaterThan(0);
    expect(mods[0].by, 'la provenance n’est pas vide').toHaveLength(1);
    ({ container, root } = mount(shell(mods)));
    const chip = container.querySelector('.rm-mod.codex-ref') as HTMLElement;
    act(() => { chip.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
    expect(document.querySelector('.infobulle')?.textContent).toContain('Valentyn');
  });
});
