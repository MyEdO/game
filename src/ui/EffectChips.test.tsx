import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ActiveEffect, ConditionInstance } from '../engine/types';
import { chipCodex, chipDetail, summarizeEffects, type EffectFlags, type FlagId } from '../gameIso/effectIcons';
import { psychologies, regles } from '../data';
import { EffectChips } from './EffectChips';

const cond = (name: string, value = 1): ConditionInstance => ({ id: name, value } as ConditionInstance);
const buff = (over: Partial<ActiveEffect> = {}): ActiveEffect => ({
  label: 'Bénédiction de courage',
  bonus: 10,
  characteristic: 'capacite-de-combat',
  duration: { scale: 'rounds', left: 3 },
  ...over,
} as ActiveEffect);

describe('chipCodex — routage d’information UNIQUE de la famille des pastilles', () => {
  it('un État route vers le catalogue États par son id STABLE', () => {
    const chip = summarizeEffects([cond('assourdi')], []).visible[0];
    expect(chipCodex(chip)).toMatchObject({ category: 'etats', id: 'assourdi' });
  });

  it('un buff route vers SON sort source (Codex Sorts) quand il est résolvable', () => {
    const chip = summarizeEffects([], [buff({ sourceSpellId: 'benediction-de-courage' })]).visible[0];
    expect(chipCodex(chip)).toMatchObject({ category: 'spells', id: 'benediction-de-courage' });
  });

  it('un buff dont l’effectId nomme une règle route vers CETTE règle (2ᵉ ancrage, hors lancement)', () => {
    const chip = summarizeEffects([], [buff({ effectId: 'faim-et-soif' })]).visible[0];
    expect(chipCodex(chip)).toMatchObject({ category: 'regles', id: 'faim-et-soif' });
  });

  /** « les effets viennent forcément d’un sort, d’un talent, d’un trait de créature, ou autre »
   *  (user 2026-07-18) : l'entité SOURCE ouvre SA fiche, quel que soit son type. */
  it.each([
    ['talent', 'chanceux', 'talents'],
    ['trait', 'peur', 'traits'],
    ['etat', 'assourdi', 'etats'],
    ['psychologie', 'frenesie', 'psychologies'],
  ] as const)('un effet de source %s ouvre la fiche de SON entité (id stable)', (kind, id, category) => {
    const chip = summarizeEffects([], [buff({ source: { kind, id } })]).visible[0];
    expect(chipCodex(chip)).toMatchObject({ category, id });
  });

  it('un buff sans ancrage de règle N’A PAS de cible : la pastille reste nue (aucun repli)', () => {
    expect(chipCodex(summarizeEffects([], [buff()]).visible[0])).toBeNull();
  });

  it('un ancrage qui ne résout à AUCUNE entrée catalogue ne fabrique pas de cible', () => {
    const chip = summarizeEffects([], [buff({ sourceSpellId: 'sort-fantome', effectId: 'effet-fantome' })]).visible[0];
    expect(chipCodex(chip)).toBeNull();
  });

  /** TOUS les états-drapeaux : chacun est adossé à une règle citable, donc chacun ouvre SA fiche —
   *  une pastille sans règle derrière elle remet en cause son existence (arbitrage user 2026-07-18). */
  const FLAG_CASES: [FlagId, EffectFlags, string, string][] = [
    ['frenzied', { frenzied: true }, 'psychologies', 'frenesie'],
    ['fear', { fear: 2 }, 'psychologies', 'peur'],
    ['focusDr', { focusDr: 3 }, 'regles', 'focalisation-etendue'],
    ['defensiveStance', { defensiveStance: true }, 'regles', 'sur-la-defensive'],
    ['hunger', { hunger: { days: 2, failures: 1 } }, 'regles', 'faim-et-soif'],
    ['aiming', { aiming: true }, 'regles', 'viser'],
  ];

  it.each(FLAG_CASES)('le drapeau %s ouvre SA fiche catalogue, routée par id stable', (flagId, flags, category, id) => {
    const chip = summarizeEffects([], [], Infinity, flags).visible[0];
    expect(chip.flagId).toBe(flagId); // identité STABLE, jamais le libellé
    expect(chipCodex(chip)).toMatchObject({ category, id });
  });

  it('chaque cible de drapeau EXISTE au catalogue (le routage ne pointe pas dans le vide)', () => {
    for (const [, flags] of FLAG_CASES) {
      const ref = chipCodex(summarizeEffects([], [], Infinity, flags).visible[0]);
      expect(ref, 'un drapeau résout TOUJOURS sa fiche').not.toBeNull();
      const catalogue = ref!.category === 'psychologies' ? psychologies : regles;
      expect(catalogue.map((e) => e.id)).toContain(ref!.id);
    }
  });

  it('le détail paramétré porte bonus (carac en clair), Rounds restants et empilement', () => {
    const b = summarizeEffects([], [buff()]).visible[0];
    expect(chipDetail(b)).toBe('+10 Capacité de Combat · 3 Rounds restants');
    const c = summarizeEffects([cond('hemorragique', 3)], []).visible[0];
    expect(chipDetail(c)).toBe('×3');
  });

  it('le libellé paramétré coiffe le libellé catalogue (instance du popover)', () => {
    const b = summarizeEffects([], [buff({ sourceSpellId: 'benediction-de-courage' })]).visible[0];
    expect(chipCodex(b)?.instance).toBe('Bénédiction de courage — +10 Capacité de Combat · 3 Rounds restants');
  });
});

describe('EffectChips', () => {
  it('toute pastille ANCRÉE — État, buff, drapeau — expose le mécanisme Codex (jamais une infobulle native)', () => {
    const html = renderToStaticMarkup(
      <EffectChips
        conditions={[cond('assourdi')]}
        effects={[buff({ sourceSpellId: 'benediction-de-courage' })]}
        flags={{ aiming: true }}
      />,
    );
    expect(html).not.toContain('title=');
    expect((html.match(/codex-ref/g) ?? []).length).toBe(3); // 1 État + 1 drapeau + 1 buff
  });

  it('une pastille SANS règle reste affichée mais NUE : son icône, et aucune promesse d’information', () => {
    const html = renderToStaticMarkup(<EffectChips effects={[buff()]} />);
    expect(html).toContain('fx-chip effet'); // l'état mécanique actif reste visible au joueur
    expect(html).not.toContain('codex-ref'); // ni popover, ni clic vers une fiche
    expect(html).not.toContain('title=');
  });

  it('la pastille COMPACTE abrège la durée en « N R » — même unité Round, jamais un « t » de tour', () => {
    const html = renderToStaticMarkup(<EffectChips effects={[buff()]} />);
    expect(html).toContain('<em>3 R</em>');
    expect(html).not.toMatch(/>\s*3\s*t\s*</);
  });

  it('le popover de la pastille garde la forme LONGUE (il a la place)', () => {
    expect(chipDetail(summarizeEffects([], [buff()]).visible[0])).toContain('3 Rounds restants');
  });
});
