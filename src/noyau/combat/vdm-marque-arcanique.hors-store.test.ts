import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { applyMiscast } from '../combatFlow';
import { seedBattleRng } from '../battleRng';
import { draineCascade } from '../cascade.testkit';
import { createHero } from '../../engine/character';
import { setRule } from '../../engine/policy';
import { hasTalent, talentTestSLBonus } from '../../engine/magic';
import { effectiveTalents } from '../../engine/talentEffects';
import { testScene } from '../../scenes/test-fixture';
import type { Combatant } from '../../engine/types';
import { blessuresDeBase } from '../../engine/characteristics';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * Marque Arcanique — PREUVE DE CÂBLAGE sur le chemin RÉEL (`applyMiscast` → rangée « Marqué par la
 * Magie » → table de Marques du Vent → op `grantTalent`), pas sur un `talents[]` posé à la main.
 * Ce que le trajet doit produire : une POSSESSION au même titre qu'un Talent acheté — `hasTalent`,
 * fiche (`effectiveTalents`) ET +DR de Talent de la ligne « Tests » (`talentTestSLBonus`).
 * `VDM 02 l.238` · `VDM 13 l.461` · `LDB 10 l.19`
 */
const RULE = 'magic-vdm-incantation';
/** Hysh (Domaine de la Lumière) : sa rangée 10 octroie `empreint-de-hysh`, dont la ligne « Tests »
 *  désigne Recherche. */
const DOMAIN = 'lumiere';
const TALENT = 'empreint-de-hysh';

describe('Marque Arcanique — le Talent marqué est RÉELLEMENT possédé', () => {
  beforeEach(() => {
    setRule(RULE, true);
  });

  function setup(): Combatant {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'Mage', seed: 3 });
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().confirmRoundStart();
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    H.wounds = blessuresDeBase(400);
    banc.setState({ battle: { ...b }, pendingCascade: null, pendingLogQueue: [] });
    return H;
  }

  const live = (id: string): Combatant => banc.getState().battle!.combatants.find((x) => x.id === id)!;

  /** Graine de `battleRng` qui, sur une Imparfaite Mineure d'un lanceur de Hysh, tire « Marqué par la
   *  Magie » PUIS la rangée 10 de la table des Marques (celle qui porte l'op `grantTalent`). */
  function seedYieldingMark(): number {
    for (let s = 0; s < 600; s++) {
      const H = setup();
      seedBattleRng(s);
      applyMiscast(banc.getState, banc.setState, H, 'mineure', { suppressReveal: true, domainId: DOMAIN });
      draineCascade(banc.getState); // le dé du Tableau tombe à SON étape : la Marque n'existe qu'après
      if (effectiveTalents(live(H.id)).some((t) => t.talentId === TALENT)) return s;
    }
    throw new Error('aucune graine ne produit la Marque du Vent');
  }

  it('marqué par le chemin RÉEL : possession (`hasTalent`) ET +DR de Talent (`talentTestSLBonus`)', () => {
    const seed = seedYieldingMark();
    const H = setup();
    // Témoin AVANT : rien n'est possédé, aucun +DR.
    expect(hasTalent(H, 'empreint-de-hysh')).toBe(false);
    expect(talentTestSLBonus(H, { skill: 'recherche' })).toBe(0);

    seedBattleRng(seed);
    applyMiscast(banc.getState, banc.setState, H, 'mineure', { suppressReveal: true, domainId: DOMAIN });
    draineCascade(banc.getState);

    const marque = live(H.id);
    expect(hasTalent(marque, 'empreint-de-hysh')).toBe(true);
    expect(talentTestSLBonus(marque, { skill: 'recherche' })).toBe(1);
    expect(talentTestSLBonus(marque, { skill: 'natation' })).toBe(0);
    // La Marque est DÉFINITIVE : acquisition structurelle, pas un effet actif qui expire.
    expect(marque.talents.some((t) => t.talentId === TALENT)).toBe(true);
    expect((marque.activeEffects ?? []).some((e) => e.grantedTalent?.talentId === TALENT)).toBe(false);
  });

  it('Maxi 1 (LDB 10 l.13-20) : trois marquages identiques n’empilent ni acquisition ni effet actif', () => {
    const seed = seedYieldingMark();
    const H = setup();
    for (let i = 0; i < 3; i++) {
      seedBattleRng(seed);
      applyMiscast(banc.getState, banc.setState, live(H.id), 'mineure', { suppressReveal: true, domainId: DOMAIN });
      draineCascade(banc.getState);
    }
    const marque = live(H.id);
    expect(marque.talents.filter((t) => t.talentId === TALENT)).toHaveLength(1);
    expect(marque.talents.find((t) => t.talentId === TALENT)!.times).toBe(1);
    expect((marque.activeEffects ?? []).filter((e) => e.grantedTalent?.talentId === TALENT)).toHaveLength(0);
    expect(talentTestSLBonus(marque, { skill: 'recherche' })).toBe(1);
  });
});
