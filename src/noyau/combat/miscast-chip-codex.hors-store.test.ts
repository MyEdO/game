import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { jouerPurifierLaChair } from './purifierLaChair.testkit';
import { createHero } from '../../engine/character';
import { testScene } from '../../scenes/test-fixture';
import { blessuresDeBase } from '../../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * ANCRAGE DE RÈGLE d'un contrecoup — chemin RÉEL (`applyMiscast` → `finishMiscast` → `runCombatFlow`,
 * qui partagent UN `OpsCtx`). L'effet durable posé par « Purifier la chair » (`LDB 40 l.75`) est une
 * pastille du joueur : sans entité SOURCE, elle s'affiche nue (ni fiche, ni popover — arbitrage user
 * 2026-07-18). La source est la RANGÉE tirée, dans la catégorie que sa table déclare en donnée.
 */
describe('Contrecoup — la pastille de l’effet porte SA rangée (LDB 40 l.75)', () => {
  function setup() {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'Mage', seed: 3 });
    banc.setState({ party: [hero] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'heros')!;
    H.wounds = blessuresDeBase(200, 200, H);
    banc.setState({ battle: { ...b }, pendingCascade: null, pendingLogQueue: [] });
    return { H };
  }

  it('la pastille de l’effet nomme la rangée et ouvre SA fiche Codex', () => {
    const h = jouerPurifierLaChair(banc, () => setup().H);
    const porteur = (h.activeEffects ?? []).find((e) => e.passive?.some((o) => o.op === 'condition' && o.id.id === 'inconscient'));
    expect(porteur, 'l’effet porteur de l’Inconscient est posé').toBeTruthy();
    expect(porteur!.source, 'l’ancrage est la RANGÉE, dans la catégorie que sa table déclare')
      .toEqual({ kind: 'colereDesDieux', id: 'colere-purifier-la-chair' });
  });
});
