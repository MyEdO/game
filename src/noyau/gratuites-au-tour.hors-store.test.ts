/** LDB 13 l.14 ; LDB 85 l.43 ; LDB 85 l.387 — #1765 ; #4011. */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, beforeEach, expect } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { advanceTurn, drainerLesGratuites, maybeOpenDefense, resumeSuspendedAI } from './combatFlow';
import { imposerLesD100 } from './battleRng.testkit';
import type { SuiteDeCoup } from './pendings';
import { blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const g = () => banc.getState();

/** Une créature Énorme au contact d'un héros Moyen, Avantage 3 : le Piétinement (LDB 85 l.387) lui est
 *  ouvert. `tourDe` pose le combattant actif ; la créature frappe ensuite une gratuite d'Arme (forme de
 *  `applyTalentFreeAttack`) dont la défense se résout par `jetLancer('defense')` puis `jetValider('defense')`.
 *  `fileEpuisee` : la file du tour déjà vidée, état que pose `aiCreatureFreeAttacks` en fin de file. */
function frappeGratuite(tourDe: 'heros' | 'creature', fileEpuisee = false) {
  const A = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
  banc.setState({ party: [A] });
  g().ensemencerLeTirage(5);
  g().lancerLaScene(testScene());
  g().lancerLeCombat('enc-mutants');
  g().fenetreValider('debutDuRound');
  banc.abandonner();
  const b = g().battle!;
  const heros = b.combatants.find((c) => c.kind === 'heros')!;
  const [E] = b.combatants.filter((c) => c.kind === 'ennemi');
  b.combatants.filter((c) => c.kind === 'ennemi' && c.id !== E.id).forEach((e) => (e.dead = true));
  E.size = 'enorme'; E.advantage = 3; E.pendingFreeAttacks = fileEpuisee ? [] : undefined;
  E.pos = { x: 6, y: 10 }; heros.pos = { x: 7, y: 10 };
  heros.wounds = blessuresDeBase(200, 200, heros);
  E.engagedWith = [heros.id]; heros.engagedWith = [E.id];
  banc.setState({ battle: { ...b, turn: b.order.indexOf(tourDe === 'heros' ? heros.id : E.id), acted: false } });
  const suite: SuiteDeCoup = { restitution: { prevActed: false }, manoeuvre: { kind: 'arme' }, enchainement: { mode: 'aucun' } };
  expect(maybeOpenDefense(g, banc.setState, E, heros, E.weapons[0], suite), 'la fenêtre de la gratuite d’Arme s’ouvre').toBe(true);
  g().jetLancer('defense');
  g().jetValider('defense');
  const creature = g().battle!.combatants.find((c) => c.id === E.id)!;
  return { herosId: heros.id, creature };
}

describe('Gratuites de créature : à son tour seulement (LDB 13 l.14, LDB 85 l.43)', () => {
  it('au tour du héros, `jetValider(\'defense\')` ne lance pas le Piétinement : file intacte, Avantage non dépensé', () => {
    const temoin = frappeGratuite('heros', true).creature.advantage;
    const { herosId, creature } = frappeGratuite('heros');
    expect(g().battle!.order[g().battle!.turn], 'le tour reste au héros').toBe(herosId);
    expect(g().pendingDefense, 'aucune fenêtre de Piétinement').toBeNull();
    expect(creature.pendingFreeAttacks, 'la file du tour de la créature n’est pas touchée').toBeUndefined();
    expect(creature.advantage, 'l’Avantage est celui du même coup, file épuisée').toBe(temoin);
  });

  it('au tour de la créature, `jetValider(\'defense\')` lance le Piétinement contre le héros', () => {
    const { herosId, creature } = frappeGratuite('creature');
    const pd = g().pendingDefense;
    expect(pd?.attackerId).toBe(creature.id);
    expect(pd?.defenderId).toBe(herosId);
    expect(pd?.suite.mode === 'machine' ? pd.suite.coup.manoeuvre?.kind : undefined, 'la gratuite est le Piétinement').toBe('pietinement');
    expect(creature.pendingFreeAttacks, 'la file est initialisée et consommée').toEqual([]);
  });
});

describe('Gratuites de créature : une file épuisée ne repart pas dans le même tour (#4011)', () => {
  it('Souffle joué, file épuisée : la reprise de `resumeSuspendedAI` ne le redéclare pas, le tour suivant si', () => {
    const A = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
    banc.setState({ party: [A] });
    g().ensemencerLeTirage(5);
    g().lancerLaScene(testScene());
    g().lancerLeCombat('enc-mutants');
    g().fenetreValider('debutDuRound');
    banc.abandonner();
    const b = g().battle!;
    const heros = b.combatants.find((c) => c.kind === 'heros')!;
    const [E] = b.combatants.filter((c) => c.kind === 'ennemi');
    b.combatants.filter((c) => c.kind === 'ennemi' && c.id !== E.id).forEach((e) => (e.dead = true));
    E.traits = [...(E.traits ?? []), { id: 'souffle', value: 3, arg: 'feu' }] as never;
    E.advantage = 7; E.pendingFreeAttacks = undefined;
    E.pos = { x: 6, y: 10 }; heros.pos = { x: 7, y: 10 }; heros.aiControlled = true;
    heros.wounds = blessuresDeBase(500, 500, heros);
    E.engagedWith = [heros.id]; heros.engagedWith = [E.id];
    banc.setState({ battle: { ...b, turn: b.order.indexOf(E.id), acted: true } });
    imposerLesD100(...Array(30).fill(0).flatMap(() => [5, 90]));
    const souffles = () => (g().battle?.log ?? []).filter((l) => /Souffle/.test(l.text)).length;
    const creature = () => g().battle!.combatants.find((c) => c.id === E.id)!;
    expect(drainerLesGratuites(g, banc.setState, creature()), 'le Souffle ne suspend pas : défenseur non tenu').toBe(false);
    const apresLaFile = { souffles: souffles(), avantage: creature().advantage };
    expect(apresLaFile.souffles, 'le Souffle du tour est déclaré').toBeGreaterThan(0);
    resumeSuspendedAI(g, banc.setState);
    expect({ souffles: souffles(), avantage: creature().advantage }, 'la reprise ne redéclare rien de la file').toEqual(apresLaFile);
    // Au tour suivant de la créature, sa file se repose : le Souffle repart.
    advanceTurn(g, banc.setState);
    banc.setState({ battle: { ...g().battle!, turn: g().battle!.order.indexOf(E.id), acted: true } });
    expect(drainerLesGratuites(g, banc.setState, creature()), 'le Souffle du tour suivant ne suspend pas').toBe(false);
    expect(souffles(), 'le Souffle du tour suivant est déclaré').toBeGreaterThan(apresLaFile.souffles);
  });
});
