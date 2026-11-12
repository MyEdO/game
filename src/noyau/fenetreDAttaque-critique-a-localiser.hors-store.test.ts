/**
 * La fenêtre d'attaque offre de LOCALISER le Coup Critique après « Je ne faillirai pas ! » (`LDB 17 l.68`) :
 * `fenetreDAttaque(...).critiqueALocaliser`, lu par la seule surface du noyau.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { fenetreDAttaque } from './fenetreDAttaque';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { seedBattleRng } from './battleRng';
import { LOCALISATIONS_DE_COUP } from '../engine/localisations';
import { createHero } from '../engine/character';
import { setRule } from '../engine/policy';
import { testScene } from '../scenes/test-fixture';
import { blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { cliquerSurLeCombattant } from './combatOrParty';

let banc: Banc;
beforeEach(() => {
  banc = ouvrirLeBanc();
  setRule('combat-aa-blessures', 'aa');
});

/** Le héros attaque une cible à `current` Blessures ; la graine fait rater, puis le résultat est choisi (21, sans double). */
function attaqueForcee(current: number) {
  const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  banc.setState({ party: [hero] });
  banc.getState().lancerLaScene(testScene());
  banc.getState().lancerLeCombat('enc-mutants');
  banc.getState().fenetreValider('debutDuRound');
  banc.abandonner();
  const b = banc.getState().battle!;
  const H = b.combatants.find((c) => c.kind === 'heros')!;
  const E = b.combatants.find((c) => c.kind === 'ennemi')!;
  H.pos = { x: 10, y: 10 };
  H.resilience = 1;
  E.pos = { x: 11, y: 10 };
  E.wounds = blessuresDeBase(30, current, E);
  E.talents = [{ talentId: 'chanceux', times: 1 }] as never; // AA 07 l.67 : hors Mort subite
  banc.setState({ battle: { ...b, turn: b.order.indexOf(H.id), movementUsed: 0, movedPreAction: false, acted: false } });
  cliquerSurLeCombattant(banc.getState, E.id, { confirm: true });
  seedBattleRng(3);
  banc.getState().jetLancer('attaque');
  expect(banc.getState().pendingAttack!.result!.hit, 'la graine fait rater le jet').toBe(false);
  banc.getState().jetForcerLaReussite('attaque');
  banc.getState().jetImposerLeResultat('attaque', 21);
  expect(banc.getState().pendingAttack!.result!.hit).toBe(true);
}

describe('fenetreDAttaque.critiqueALocaliser — LDB 17 l.68', () => {
  it('coup forcé qui inflige un Critique (cible déjà à 0) : la Localisation se choisit, parmi les six Localisations', () => {
    attaqueForcee(0);
    const f = fenetreDAttaque(banc.getState())!;
    expect(f.critiqueALocaliser).not.toBeNull();
    expect(f.critiqueALocaliser!.geste).toMatchObject({ verbe: 'jetRegler', flux: 'attaque', reglage: 'localisationDuCritique' });
    expect([...f.critiqueALocaliser!.options.map((o) => o.valeur)].sort()).toEqual([...LOCALISATIONS_DE_COUP].sort());
    banc.getState().jetRegler('attaque', 'localisationDuCritique', 'jambeG');
    expect(fenetreDAttaque(banc.getState())!.critiqueALocaliser!.choisie).toBe('jambeG');
  });

  it('coup forcé sans Critique : rien à localiser', () => {
    attaqueForcee(30);
    expect(fenetreDAttaque(banc.getState())!.critiqueALocaliser).toBeNull();
  });
});
