/**
 * Le réticule d'une gratuite payée en Avantage annonce la valeur cible que le jet tire : l'aperçu lit
 * l'Avantage RESTANT après le débit (`avantageApresDepense`, le solde que `campSpend` pose au commit).
 * LDB 85 l.387
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { hoverTargeting } from './targeting';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';
import { blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { reluDans } from './combatDeTest.testkit';
import { cliquerSurLeCombattant } from './combatOrParty';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const g = () => banc.getState();

function engage(): { H: Combatant; E: Combatant } {
  const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  banc.setState({ party: [hero] });
  g().lancerLaScene(testScene());
  g().lancerLeCombat('enc-mutants');
  g().fenetreValider('debutDuRound');
  banc.abandonner();
  const b = g().battle!;
  const H = b.combatants.find((c) => c.kind === 'heros')!;
  const enemies = b.combatants.filter((c) => c.kind === 'ennemi');
  enemies.slice(1).forEach((e) => (e.dead = true));
  const E = enemies[0];
  H.pos = { x: 10, y: 10 };
  E.pos = { x: 11, y: 10 };
  E.wounds = blessuresDeBase(300, 300, E);
  H.size = 'enorme';
  H.advantage = 3;
  banc.setState({ battle: { ...b, turn: b.order.indexOf(H.id), action: null, movementUsed: 0, acted: false } });
  return { H: reluDans(banc.getState, H), E: reluDans(banc.getState, E) };
}

/** Cible annoncée par le réticule de l'attaque armée, puis cible du jet que le clic ouvre. */
function reticuleEtJet(attaque: string, H: Combatant, E: Combatant): { reticule: number; jet: number; avantage: number } {
  g().armerLAttaque(attaque);
  const ht = hoverTargeting(g, H, E);
  if (ht.kind !== 'ok' || ht.base == null || ht.mod == null) throw new Error(`réticule ${ht.kind}`);
  cliquerSurLeCombattant(g, E.id, { confirm: true });
  g().jetLancer('attaque');
  const d = g().pendingAttack!.result!.attackerDetail!;
  return { reticule: ht.base + ht.mod, jet: d.target, avantage: H.advantage };
}

describe('Gratuite payée en Avantage : le réticule annonce la cible du jet', () => {
  beforeEach(() => {
    g().ensemencerLeTirage(2);
  });

  it('Piétinement (1 Avantage) : réticule.target === jet.target, sur l’Avantage restant', () => {
    const { H, E } = engage();
    const { reticule, jet, avantage } = reticuleEtJet('pietinement', H, E);
    expect(avantage, 'précondition : le clic a débité 1 Avantage').toBe(2);
    expect(reticule).toBe(jet);
  });

  it('opposé — attaque de l’Action (sans coût) : aucun débit, réticule et jet sur l’Avantage entier', () => {
    const { H, E } = engage();
    const { reticule, jet, avantage } = reticuleEtJet('arme', H, E);
    expect(avantage).toBe(3);
    expect(reticule).toBe(jet);
  });
});
