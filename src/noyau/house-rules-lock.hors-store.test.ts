/**
 * VERROU des règles optionnelles pendant un combat (#564, #1049) — garde d'INGÉNIERIE : elle ne dit
 * rien des règles du jeu, elle empêche des états applicatifs incohérents.
 *
 * Le moteur lit `rule(id)` EN DIRECT : muter une entrée alors qu'une bataille est en cours rétroagit
 * sur un état déjà construit à l'ouverture. Cas mesuré (#564) : activer « Avantage de groupe » en plein
 * combat faisait naître la réserve de camp À ZÉRO au premier `poolsOf`, et `mirrorPools` écrasait
 * l'Avantage individuel de TOUS les combattants. La porte vit au point d'ÉCRITURE joueur
 * (`noyau/reglesMaison`, lu par `hote/reglesMaison`), pas dans l'UI, et vaut pour la CLASSE entière (aucun id nommé).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { reglesMaisonMutables, surchargerUneRegleMaison } from './reglesMaison';
import { resetRule, setRule, OPTIONAL_RULES } from '../engine/policy';
import { resolveRoundBoundary } from './combatFlow';
import { createHero } from '../engine/character';
import { seedBattleRng } from './battleRng';
import { testScene } from '../scenes/test-fixture';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { t } from '../i18n';

let banc: Banc;
beforeEach(() => {
  banc = ouvrirLeBanc();
});

const verrou = () => reglesMaisonMutables(banc.getState());

function startFixtureCombat() {
  const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  banc.setState({ party: [hero] });
  banc.getState().lancerLaScene(testScene());
  seedBattleRng(777);
  banc.getState().lancerLeCombat('enc-mutants', undefined, { noSurprise: true });
  return banc.getState().battle!;
}

describe('Règles optionnelles — verrouillées tant qu’un combat est en cours', () => {
  beforeEach(() => {
    banc.abandonner();
    banc.setState({ battle: null, pendingCascade: null, pendingRoundStart: null });
    for (const r of OPTIONAL_RULES) resetRule(r.id);
  });
  afterEach(() => {
    banc.abandonner();
    banc.setState({ battle: null });
    for (const r of OPTIONAL_RULES) resetRule(r.id);
  });

  it('le verrou vaut pour TOUTE la classe, SANS exception : aucune entrée du registre n’est mutable en combat', () => {
    startFixtureCombat();
    const mutables = OPTIONAL_RULES.filter(() => verrou().mutable).map((r) => r.id);
    expect(mutables).toEqual([]);
  });

  it('en combat, le verrou DIT sa raison', () => {
    startFixtureCombat();
    expect(verrou()).toEqual({ mutable: false, reason: t('houseRules.lockedInBattle') });
  });

  it('combat ouvert le combat fini : la porte se rouvre', () => {
    const battle = startFixtureCombat();
    banc.setState({ battle: { ...battle, over: 'victoire' } });
    expect(verrou().mutable).toBe(true);
  });

  it('#564 — activer « Avantage de groupe » en plein combat ne détruit plus l’Avantage accumulé', () => {
    const battle = startFixtureCombat();
    expect(battle.advantagePools).toBeUndefined(); // combat ouvert sous le modèle du Livre de base
    const hero = battle.combatants.find((c) => c.kind === 'heros')!;
    const foe = battle.combatants.find((c) => c.kind === 'ennemi')!;
    hero.advantage = 4;
    foe.advantage = 2;
    surchargerUneRegleMaison(banc.getState(), 'combat-aa-avantage-groupe', true); // le joueur bascule au menu système, en plein combat
    resolveRoundBoundary(banc.getState, banc.setState);
    const after = banc.getState().battle!;
    expect(after.advantagePools).toBeUndefined(); // aucune réserve née à zéro
    expect(after.combatants.find((c) => c.id === hero.id)!.advantage).toBe(3); // décroissance LDB 14 l.219, pas un écrasement
    expect(after.combatants.find((c) => c.id === foe.id)!.advantage).toBe(1);
  });
});

/** Contre-preuve : la MÊME bascule, forcée sous le registre du moteur (chemin que la porte ferme au
 *  joueur), détruit bien l'Avantage — c'est le bug que le verrou rend inatteignable. */
describe('#564 — le bug, sans la porte (écriture directe du registre moteur)', () => {
  beforeEach(() => {
    banc.setState({ battle: null, pendingCascade: null, pendingRoundStart: null });
    for (const r of OPTIONAL_RULES) resetRule(r.id);
  });
  afterEach(() => {
    banc.abandonner();
    banc.setState({ battle: null });
    for (const r of OPTIONAL_RULES) resetRule(r.id);
  });

  it('réserve née à zéro → l’Avantage de tous les combattants est écrasé', () => {
    const battle = startFixtureCombat();
    const hero = battle.combatants.find((c) => c.kind === 'heros')!;
    hero.advantage = 4;
    setRule('combat-aa-avantage-groupe', true); // primitive PURE du moteur : ne connaît pas la partie
    resolveRoundBoundary(banc.getState, banc.setState);
    expect(banc.getState().battle!.combatants.find((c) => c.id === hero.id)!.advantage).toBe(0);
  });
});
