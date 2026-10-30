import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { advanceTurn } from './combatFlow';
import { createHero } from '../engine/character';
import { seedBattleRng } from './battleRng';
import { setRule } from '../engine/policy';
import { testScene } from '../scenes/test-fixture';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * Règle optionnelle « Relancer l'Initiative chaque Round » — LDB 13 l.43 :
 * « Vous pouvez alors utiliser cet ordre pour chaque Round (option la plus rapide), ou effectuer un
 *   lancer pour chaque Round (ce qui apporte plus de diversité ; les Personnages les plus lents ont alors
 *   la possibilité de ne pas être toujours les derniers). »
 * OFF (défaut) : l'ordre d'ouverture (baseOrder) est conservé d'un Round à l'autre.
 * ON : au franchissement de Round, l'Initiative est re-tirée et l'ordre recalculé.
 */
describe('combat-init-reroll — relance de l’Initiative par Round (LDB 13 l.43)', () => {
  function openCombat() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    seedBattleRng(777);
    banc.getState().startCombat('enc-mutants');
    banc.getState().confirmRoundStart();
    banc.abandonner();
  }

  const initMap = () =>
    Object.fromEntries(banc.getState().battle!.combatants.map((c) => [c.id, c.initiative]));

  function crossRound() {
    const b = banc.getState().battle!;
    banc.setState({ battle: { ...b, turn: b.order.length - 1 } });
    advanceTurn(banc.getState, banc.setState);
  }

  it('OFF (défaut) : l’ordre et les valeurs d’Initiative sont conservés au Round suivant', () => {
    openCombat();
    const round1Order = [...banc.getState().battle!.order];
    const round1Init = initMap();
    seedBattleRng(424242);
    crossRound();
    const after = banc.getState().battle!;
    expect(after.round).toBe(2);
    expect(after.order).toEqual(round1Order); // baseOrder conservé
    expect(initMap()).toEqual(round1Init);    // aucune valeur re-tirée
  });

  it('ON : l’Initiative est re-tirée et l’ordre recalculé au Round suivant (seedé, déterministe)', () => {
    setRule('combat-init-reroll', true);
    setRule('combat-init-method', 'roll-i'); // la relance ne varie qu'avec une méthode ALÉATOIRE (fixed-i = no-op)
    openCombat();
    const round1Init = initMap();
    seedBattleRng(424242);
    crossRound();
    const after = banc.getState().battle!;
    expect(after.round).toBe(2);
    // (a) la VALEUR d'Initiative d'au moins un combattant a été re-tirée
    expect(initMap()).not.toEqual(round1Init);
    // (b) l'ordre est RE-DÉRIVÉ des nouvelles valeurs : non croissant par Initiative le long de l'ordre
    const initOf = (id: string) => after.combatants.find((c) => c.id === id)!.initiative!;
    const seq = after.order.map(initOf);
    for (let i = 1; i < seq.length; i++) expect(seq[i]).toBeLessThanOrEqual(seq[i - 1]);
    // (c) baseOrder devient l'ordre re-tiré de CE Round (la base canonique suit la relance)
    expect(after.baseOrder).toEqual(after.order);
  });

  it('ON : deux ouvertures identiques (même graine) re-tirent le MÊME ordre de Round 2 (reproductible)', () => {
    // Le compteur d'id de héros est GLOBAL (hero-1, hero-2…) → on le normalise ; seule la structure de
    // l'ordre re-tiré importe pour la reproductibilité de la relance.
    const norm = (order: string[]) => order.map((id) => (id.startsWith('hero-') ? 'HERO' : id));
    const run = () => {
      setRule('combat-init-reroll', true);
      setRule('combat-init-method', 'roll-i');
      openCombat();
      seedBattleRng(20260627);
      crossRound();
      return norm([...banc.getState().battle!.order]);
    };
    const a = run();
    banc.setState({ battle: null });
    const b = run();
    expect(a).toEqual(b);
  });
});
