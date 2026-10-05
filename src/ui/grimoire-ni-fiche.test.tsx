// @vitest-environment jsdom
/**
 * CÂBLAGE du NI de LECTURE AU GRIMOIRE affiché par la fiche (onglet Magie & Foi).
 *
 * La liste de grimoire de `SpellbookSection` (`src/ui/CharacterSheet.tsx`) doit passer par les DEUX
 * seams de résolution — `findSpellById` (forme effective sous les règles optionnelles) puis
 * `effectiveSpellOf` (NI de lecture, `GRIMOIRE_NI_MODS`) — et jamais énumérer le tableau brut
 * `spells` ni recopier un facteur.
 *
 * Preuve par DÉBRANCHEMENT : *Caresse de Laniph* vaut NI 7 au Livre de base et NI 4 sous
 * `magic-vdm-incantation` (`VDM 12` folio 122). Un écran resté sur le tableau brut afficherait
 * « 7→14 » dans les deux états ; un facteur `× 2` en dur afficherait « 4→8 » mais mentirait dès
 * qu'un Rituel entre dans la liste (`VDM 12 l.647`) — d'où l'assertion sur le NI de lecture RENDU,
 * comparé à celui que la résolution appliquera vraiment.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CharacterSheet } from './CharacterSheet';
import { useGame } from '../state/store';
import { setRule, resetRule } from '../engine/policy';
import { effectiveSpellOf } from '../state/combatFlow';
import { findSpellById, spells } from '../data';
import type { Combatant } from '../engine/types';
import { objetDeTest } from '../engine/objetDeTest.testkit';

const RULE = 'magic-vdm-incantation';
const SPELL = 'caresse-de-laniph';

/** Sorcier de Shyish, Grimoire au paquetage, AUCUN sort mémorisé — toute sa magie passe par le livre. */
const sorcier = (): Combatant =>
  ({
    id: 'w',
    label: 'Wilhelm',
    kind: 'hero',
    species: 'humains-reiklander',
    career: 'apprenti-sorcier',
    careerLevel: 1,
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 40, sociabilite: 30 },
    wounds: { current: 12, max: 12 },
    advantage: 0,
    conditions: [],
    weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [
      { id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 30 },
      { id: 'focalisation', spec: 'mort', characteristic: 'force-mentale', advances: 30 },
    ],
    talents: [{ talentId: 'magie-des-arcanes', spec: 'mort', times: 1 }],
    spells: [],
    items: [objetDeTest({ uid: 'g', trappingId: 'grimoire', kind: 'misc', qualities: [], enc: 1, equipped: false })],
    movement: 4,
    xp: 0,
    charAdvances: {},
  }) as unknown as Combatant;

describe('fiche — NI de lecture au grimoire (LDB 47 l.21, `VDM 12 l.646-647`)', () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });
  let container: HTMLDivElement | undefined;
  let root: Root | undefined;
  function mount(): string {
    const h = sorcier();
    useGame.setState({ party: [h], battle: null, sheetId: h.id, sheetTab: 'magie' });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root!.render(<CharacterSheet heroId={h.id} onClose={() => {}} />); });
    return container!.innerHTML;
  }
  afterEach(() => {
    if (root) act(() => { root!.unmount(); });
    container?.remove();
    root = undefined;
    container = undefined;
    resetRule(RULE);
  });

  /** Rangée de grimoire du sort témoin, telle que l'écran la rend. */
  const rowText = (): string => {
    const rows = [...container!.querySelectorAll('.spell-row')];
    const row = rows.find((r) => r.textContent?.includes('Caresse de Laniph'));
    expect(row, 'la rangée de grimoire de Caresse de Laniph doit être rendue').toBeTruthy();
    return row!.textContent ?? '';
  };

  it('ancrage de la donnée : le tableau brut reste à 7, la variante réglée porte 4', () => {
    expect(spells.find((s) => s.id === SPELL)!.cn).toBe(7);
    expect(findSpellById(SPELL)!.cn).toBe(7);
    setRule(RULE, true);
    expect(spells.find((s) => s.id === SPELL)!.cn).toBe(7);
    expect(findSpellById(SPELL)!.cn).toBe(4);
  });

  it('règle ÉTEINTE : l’écran rend le NI de base et le NI de lecture de `effectiveSpellOf`', () => {
    mount();
    const lu = effectiveSpellOf({ spellId: SPELL, grimoire: true })!.cn;
    expect(lu).toBe(14);
    expect(rowText()).toContain(`NI 7→${lu}`);
  });

  it('règle ALLUMÉE : le NI affiché suit la VARIANTE (4→8), jamais l’entrée brute (7→14)', () => {
    setRule(RULE, true);
    mount();
    const lu = effectiveSpellOf({ spellId: SPELL, grimoire: true })!.cn;
    expect(lu).toBe(8);
    const txt = rowText();
    expect(txt).toContain(`NI 4→${lu}`);
    // Débranchement : un écran resté sur `spells` (tableau brut) rendrait 7 ici, un facteur en dur 14.
    expect(txt).not.toContain('NI 7');
    expect(txt).not.toContain('→14');
  });
});
