// @vitest-environment jsdom
/**
 * BOUT-EN-BOUT de la chip de pénalité (ref #1117 L4) : du COMBATTANT jusqu'au TEXTE à l'écran et au
 * infobulle. CONTRAT : la pastille porte le NOM de l'État qui octroie la pénalité (jamais l'étiquette
 * de famille « État »), et elle est CLIQUABLE — une pastille muette ne renvoie à aucune règle.
 *
 * Distinct de `RollLine-codex-chips.test.tsx`, qui verrouille le contrat GÉNÉRIQUE de `ModChip` à
 * partir de `ModLine` forgées. Ici le producteur est le RÉEL (`conditionModLines`, source unique des
 * trois producteurs) et aucune ligne n'est écrite à la main — ce que la garde moteur ne voit pas :
 *  1. le TEXTE EXACT rendu (signe typographique compris) ;
 *  2. la chip EST l'affordance Codex, et son infobulle s'OUVRE ;
 *  3. CHAQUE catégorie émise (`etats`, `spells`, `symptoms`, `traits`) résout au registre Codex —
 *     une catégorie mal orthographiée rendrait la pastille muette à l'écran.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { RollShell } from './RollShell';
import { buildRollRow } from './rollRowBuild';
import type { PendingRoll } from './RollLine';
import { codexLookupById } from './compendium/registry';
import { conditionModLines, attackModifiers } from '../engine/combat';
import { addCondition, COND } from '../engine/conditions';
import { castWardLine } from '../state/combatFlow';
import { useGame, type GameState } from '../state/store';
import { MINUTES_PER_DAY } from '../engine/clock';
import type { Disease } from '../engine/disease';
import type { Combatant, Weapon } from '../engine/types';

/** Arme de mêlée minimale — l'attaque n'est ici qu'un PORTEUR de modificateurs. */
const SWORD: Weapon = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };

const mk = (): Combatant => ({
  id: 'x', name: 'X', kind: 'hero', characteristics: {}, skills: [], talents: [], traits: [],
  conditions: [], activeEffects: [], liveTraits: [], weapons: [], armour: [],
  wounds: { current: 10, max: 10, base: 10 }, advantage: 0,
}) as unknown as Combatant;

/** Une maladie ACTIVE portant le symptôme voulu (même fabrique que `engine/disease.test.ts`). */
const activeDisease = (symptomId: string): Disease => ({
  id: `dz-${symptomId}`, phase: 'active', symptoms: [{ symptomId }],
  minutesLeft: 40 * MINUTES_PER_DAY, durationMinutes: 40 * MINUTES_PER_DAY,
}) as unknown as Disease;

const CURSE = {
  label: 'Malédiction de malchance', bonus: 0, duration: { scale: 'rounds', left: 3 },
  testMod: -10, source: { kind: 'spell', id: 'malediction-de-malchance' },
} as unknown as NonNullable<Combatant['activeEffects']>[number];

const mount = (node: React.ReactElement) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(node); });
  return { container, root };
};

/** La coquille RÉELLE, alimentée par des `ModLine` que le MOTEUR produit (jamais écrites à la main). */
function shell(mods: PendingRoll['mods']) {
  const pending: PendingRoll = { label: 'Corps à corps', base: 55, mods };
  return <RollShell title="Attaque" rows={[buildRollRow({ row: { pending } })]} rolled={false} actions={[]} />;
}
const shellFor = (c: Combatant) => shell(conditionModLines(c));

describe('Chips de pénalité — texte EXACT et infobulle, du Combatant à l’écran (#1117 L4)', () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });
  let container: HTMLDivElement;
  let root: Root;
  afterEach(() => {
    act(() => { root.unmount(); }); // démonte aussi les portals d'infobulle
    container.remove();
  });

  it('Brisé ×3 + Malédiction : DEUX chips nommées, « −30 Brisé » et « −10 Malédiction de malchance »', () => {
    const c = mk();
    addCondition(c, COND.brise); addCondition(c, COND.brise); addCondition(c, COND.brise);
    c.activeEffects = [CURSE];
    ({ container, root } = mount(shellFor(c)));
    const chips = [...container.querySelectorAll('.rm-mod')];
    expect(chips.map((n) => n.textContent)).toEqual(['−30 Brisé', '−10 Malédiction de malchance']);
    // Les DEUX portent leur affordance Codex (aucune pastille muette), et leur infobulle s'ouvre.
    for (const chip of chips) {
      expect(chip.classList.contains('codex-ref'), `chip « ${chip.textContent} » liée au Codex`).toBe(true);
      expect(chip.getAttribute('role')).toBe('button');
      act(() => { chip.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
      const pop = document.querySelector('.infobulle');
      expect(pop, `infobulle ouverte pour « ${chip.textContent} »`).not.toBeNull();
      expect(pop!.textContent).toContain(chip.textContent!); // l'instance lue à l'écran est reprise
      act(() => { chip.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })); });
    }
  });

  it('Sonné + Crampes abdominales : le symptôme n’est pas fondu dans l’État, il a SA chip nommée', () => {
    const c = mk();
    addCondition(c, COND.sonne);
    c.diseases = [activeDisease('crampes-abdominales')];
    ({ container, root } = mount(shellFor(c)));
    const chips = [...container.querySelectorAll('.rm-mod')];
    expect(chips.map((n) => n.textContent)).toEqual(['−10 Sonné', '−20 Crampes abdominales']);
    const symptome = chips[1] as HTMLElement;
    act(() => { symptome.focus(); }); // atteignable au CLAVIER, pas seulement à la souris
    expect(document.querySelector('.infobulle')?.textContent).toContain('Crampes abdominales');
  });

  it('CHAQUE catégorie émise par le moteur résout au Codex (aucune chip ne peut être muette)', () => {
    const c = mk();
    addCondition(c, COND.sonne);
    c.diseases = [activeDisease('crampes-abdominales')];
    c.activeEffects = [CURSE];
    // Aura IDENTIFIÉE, plus forte que l'État → c'est elle qui gagne le pool et donne la catégorie `traits`.
    c.auraMods = [{ op: { op: 'testMod', amount: -20 }, src: { category: 'traits', id: 'perturbant' } }];
    const refs = conditionModLines(c).map((m) => m.ref);
    expect(refs.every((r) => r != null), 'aucune ligne sans renvoi').toBe(true);
    expect(new Set(refs.map((r) => r!.category))).toEqual(new Set(['traits', 'spells', 'symptoms']));
    for (const r of refs) {
      expect(codexLookupById(r!.category, r!.id), `${r!.category}/${r!.id} introuvable au Codex`).toBeTruthy();
    }
    // Et la catégorie `etats` (pool gagné par un État) résout au même registre.
    const e = mk(); addCondition(e, COND.sonne);
    const etatRef = conditionModLines(e)[0].ref!;
    expect(etatRef.category).toBe('etats');
    expect(codexLookupById(etatRef.category, etatRef.id)).toBeTruthy();
  });

  // ── Bonus à l'ATTAQUANT : la chip vit côté ATTAQUANT (`attackModifiers`, mêlée), pas sur la ligne
  //    de la victime — elle disait « Cible vulnérable », un intitulé qui fondait deux règles distinctes.
  it('cible À Terre + Assourdie de dos : DEUX chips nommées côté attaquant, chacune liée à SON État', () => {
    const target = mk();
    addCondition(target, COND.aTerre); addCondition(target, COND.assourdi);
    const mods = attackModifiers(mk(), target, SWORD, { kind: 'melee', flankRear: true });
    ({ container, root } = mount(shell(mods)));
    const chips = [...container.querySelectorAll('.rm-mod')];
    expect(chips.map((n) => n.textContent)).toEqual(['+20 À Terre', '+10 Assourdi']);
    for (const chip of chips) {
      expect(chip.classList.contains('codex-ref')).toBe(true);
      act(() => { chip.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
      expect(document.querySelector('.infobulle'), `infobulle de « ${chip.textContent} »`).not.toBeNull();
      act(() => { chip.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })); });
    }
  });

  // ── Aura anti-Sort : le producteur RÉEL est `castWardLine` ; seul le conteneur `battle` est forgé
  //    (la géométrie exige une bataille). L'effet est celui qu'`applyOps` pose (label + `sourceSpellId`).
  it('aura anti-Sort : la chip porte le NOM du miracle, sa fiche, et son porteur en provenance', () => {
    const priest = mk();
    priest.id = 'P'; priest.label = 'Sœur Gerda'; priest.pos = { x: 10, y: 10 };
    priest.activeEffects = [{ label: 'N’écoutez point la Sorcière', bonus: 0, duration: { scale: 'rounds', left: 5 }, castWard: { radiusMeters: 4 }, sourceSpellId: 'n-ecoutez-point-la-sorciere' } as NonNullable<Combatant['activeEffects']>[number]];
    const victim = mk(); victim.id = 'V'; victim.pos = { x: 11, y: 10 };
    const state = { battle: { combatants: [priest, victim] } } as unknown as GameState;
    const line = castWardLine(state, victim, { label: 'Flèchette' } as never)!;
    expect(line).toEqual({ label: 'N’écoutez point la Sorcière', value: -20, famille: 'jet', ref: { category: 'spells', id: 'n-ecoutez-point-la-sorciere' }, by: [{ id: 'P' }] });
    expect(codexLookupById(line.ref!.category, line.ref!.id)).toBeTruthy();
    useGame.setState({ party: [priest], battle: null });
    ({ container, root } = mount(shell([line])));
    const chip = container.querySelector('.rm-mod') as HTMLElement;
    expect(chip.textContent).toBe('−20 N’écoutez point la Sorcière');
    act(() => { chip.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
    expect(document.querySelector('.infobulle')?.textContent).toContain('Sœur Gerda'); // le PORTEUR est nommé
  });
});
