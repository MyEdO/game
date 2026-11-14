import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import type { Jeu } from './etat';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';
import { blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * Refus d'une rangée de Contre-sort (`multi.refusDuSlot` du flux `contreSort`) : tout verbe du slot le dit, et ne
 * dépense rien. LDB 46 l.156 ; LDB 12 l.189 ; #1042/#1059.
 */
describe('Contre-sort — le refus de la rangée vaut pour tous ses verbes', () => {
  function setup() {
    const mk = (name: string, seed: number) => {
      const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'sorcier', label: name, careerTalent: { id: 'magie-mineure' }, seed });
      h.resilience = 2; h.fortune = 2; h.corruption = 0;
      return h;
    };
    banc.setState({ party: [mk('Anna', 707), mk('Bert', 101)] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    const b = banc.getState().battle!;
    const [A, B] = b.combatants.filter((c) => c.kind === 'heros') as Combatant[];
    const enemies = b.combatants.filter((c) => c.kind === 'ennemi');
    enemies.slice(1).forEach((e) => (e.dead = true));
    const E = enemies[0];
    [A, B].forEach((h, i) => { h.pos = { x: 10, y: 10 + i }; h.wounds = blessuresDeBase(99, 99, h); h.fortune = 2; h.resilience = 2; });
    E.pos = { x: 12, y: 10 };
    banc.setState({
      battle: { ...b },
      pendingCast: {
        casterId: E.id, targetId: A.id, spellId: 'carreau', missile: true, focused: false, counterspellRouted: true,
        result: { cast: true, roll: 20, target: 50, sl: 3, isCritical: false, isFumble: false, log: '' },
      },
    } as unknown as Partial<Jeu>);
    return { A, B };
  }
  const DISSIPE = { dispelled: true, counter: { roll: 5, target: 60, sl: 4, success: true, isDouble: false }, casterNetSL: -1, log: 'dissipé' };
  /** Réussite à DR égal à l'incantation : non dissipé, +1 DR le ferait basculer. */
  const PRESQUE = { dispelled: false, counter: { roll: 30, target: 60, sl: 3, success: true, isDouble: false }, casterNetSL: 0, log: 'presque' };
  const RATE = { dispelled: false, counter: { roll: 95, target: 60, sl: -4, success: false, isDouble: false }, casterNetSL: 7, log: 'raté' };
  const poser = (parts: unknown[]) => banc.setState({ pendingCounterspell: { participants: parts } } as unknown as Partial<Jeu>);
  const cur = (id: string) => banc.getState().battle!.combatants.find((c) => c.id === id)!;
  const part = (id: string) => banc.getState().pendingCounterspell!.participants.find((p) => p.id === id)!;
  const ressources = (id: string) => ({ chance: cur(id).fortune, resilience: cur(id).resilience, corruption: cur(id).corruption ?? 0 });

  it('+1 DR de Chance après la dissipation par un AUTRE : refusé et dit, Chance inchangée', () => {
    const { A, B } = setup();
    poser([{ id: A.id, interactive: true, declared: 'solo', result: PRESQUE }, { id: B.id, interactive: true, declared: 'solo', result: DISSIPE }]);
    banc.getState().jetAjouterUnDR('contreSort', A.id);
    expect(ressources(A.id)).toEqual({ chance: 2, resilience: 2, corruption: 0 });
    expect(part(A.id).result).toEqual(PRESQUE);
    expect(banc.getState().refus?.texte).toBe('Déjà dissipé par Bert');
  });

  for (const verbe of ['jetLancer', 'jetRelancer', 'jetPactiser', 'jetForcerLaReussite'] as const) {
    it(`${verbe} sur le Contre-sort après la dissipation par un AUTRE : même refus, rien ne se dépense`, () => {
      const { A, B } = setup();
      poser([{ id: A.id, interactive: true, declared: 'solo', result: verbe === 'jetLancer' ? null : RATE }, { id: B.id, interactive: true, declared: 'solo', result: DISSIPE }]);
      banc.getState()[verbe]('contreSort', A.id);
      expect(ressources(A.id)).toEqual({ chance: 2, resilience: 2, corruption: 0 });
      expect(banc.getState().refus?.texte).toBe('Déjà dissipé par Bert');
    });
  }

  it('dé fixé après la dissipation par un AUTRE : même refus, le jet ne bouge pas', () => {
    const { A, B } = setup();
    poser([{ id: A.id, interactive: true, declared: 'solo', result: RATE }, { id: B.id, interactive: true, declared: 'solo', result: DISSIPE }]);
    banc.getState().jetImposerLeResultat('contreSort', 1, A.id);
    expect(part(A.id).result).toEqual(RATE);
    expect(banc.getState().refus?.texte).toBe('Déjà dissipé par Bert');
  });

  it('la rangée qui a dissipé garde son propre cycle : son +1 DR passe', () => {
    const { A, B } = setup();
    poser([{ id: A.id, interactive: true, declared: 'solo', result: RATE }, { id: B.id, interactive: true, declared: 'solo', result: DISSIPE }]);
    banc.getState().jetAjouterUnDR('contreSort', B.id);
    expect(cur(B.id).fortune).toBe(1);
    expect(part(B.id).result!.counter.sl).toBe(5);
  });

  it('phase de déclaration ouverte : la Résilience d’une rangée déclarée est refusée et dite', () => {
    const { A, B } = setup();
    poser([{ id: A.id, interactive: true, declared: 'solo', result: null }, { id: B.id, interactive: true, result: null }]);
    banc.getState().jetForcerLaReussite('contreSort', A.id);
    expect(ressources(A.id)).toEqual({ chance: 2, resilience: 2, corruption: 0 });
    expect(part(A.id).result).toBeNull();
    expect(banc.getState().refus?.texte).toBe('En attente des déclarations de la fenêtre');
  });

  it('rangée qui passe : son jet est refusé et dit, sans consommer son essai du Round', () => {
    const { A, B } = setup();
    poser([{ id: A.id, interactive: true, declared: 'solo', result: null }, { id: B.id, interactive: true, declared: 'passer', result: null }]);
    banc.getState().jetLancer('contreSort', B.id);
    expect(part(B.id).result).toBeNull();
    expect(cur(B.id).dispelledThisRound ?? false).toBe(false);
    expect(banc.getState().refus?.texte).toBe('Jet refusé : Bert ne lance pas le Contre-sort.');
  });
});
