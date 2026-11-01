/**
 * Effet d'auteur `castSpell` `mode:'forceSuccess'` (#98) : le Flow du Sort se joue par le walker
 * d'acteur (`lancerLeSortGaranti`), à DR = NI, choix, paliers et durée compris.
 */
import { describe, it, expect } from 'vitest';
import { ouvrirLeBanc } from './banc.testkit';
import { draineEtapes } from './cascade.testkit';
import { runFlow, jouerFlowEntier } from './combatEffects';
import { pregenParty, PREGEN } from '../data/pregens';
import { resolveFormula } from '../engine/ops';
import { desDuTest } from '../engine/dice.testkit';
import { ciblePsy } from '../engine/psych/ciblage';
import type { Flow } from '../engine/flowCore';
import type { Combatant } from '../engine/types';

const garanti = (casterId: string, spellId: string, targetId: string) =>
  ({ kind: 'do', effect: { type: 'castSpell', casterId, spellId, targetId, mode: 'forceSuccess' } }) as unknown as Flow;
const bfm = (lanceur: Combatant) => resolveFormula({ bonusOf: 'force-mentale' }, lanceur, desDuTest);

describe('castSpell forceSuccess : le Flow du Sort, à DR = NI', () => {
  it('Colérique (VDM 10 l.324-332) : un seul palier, envers la personne désignée, avec sa durée', () => {
    const [w, s, p] = pregenParty(PREGEN.sorcier, PREGEN.soldat, PREGEN.pretre);
    const banc = ouvrirLeBanc({ graine: 7, etat: { party: [w, s, p] } });
    const maintenant = banc.getState().gameTime;
    jouerFlowEntier(runFlow(banc.getState, banc.setState, garanti(w.id, 'colerique', s.id)));
    const vues = draineEtapes(banc.getState, 20, (e) => (e.kind === 'triggeredTest' ? 100 : undefined),
      (e) => (e.kind === 'personneChoisie' ? p.id : undefined));
    expect(vues.map((v) => v.kind), 'NI 2 : aucun palier à trancher').toEqual(['personneChoisie', 'triggeredTest']);
    const cible = banc.getState().party.find((c) => c.id === s.id)!;
    expect((cible.psychTraits ?? []).filter((t) => t.src?.id === 'colerique')).toEqual([
      { type: 'prejuge', cible: ciblePsy.individu(p.id), src: { kind: 'spell', id: 'colerique' } },
    ]);
    expect(cible.activeEffects?.filter((e) => e.grantedPsychTrait).map((e) => e.duration))
      .toEqual([{ scale: 'clock', until: maintenant + bfm(w) * 60 }]);
  });

  it('un Sort à durée en Rounds : l’effet dure (BFM) Rounds et porte son identité dissipable (LDB 46 l.158)', () => {
    const [w, s] = pregenParty(PREGEN.sorcier, PREGEN.soldat);
    const banc = ouvrirLeBanc({ graine: 7, etat: { party: [w, s] } });
    jouerFlowEntier(runFlow(banc.getState, banc.setState, garanti(w.id, 'ecorce', s.id)));
    const effets = banc.getState().party.find((c) => c.id === s.id)!.activeEffects ?? [];
    expect(effets.map((e) => ({ char: e.char, bonus: e.bonus, duree: e.duration, sort: e.spell?.spellId, id: e.sourceSpellId }))).toEqual(
      ['endurance', 'agilite', 'dexterite'].map((char, i) => ({
        char, bonus: [20, -10, -10][i], duree: { scale: 'rounds', left: bfm(w) }, sort: 'ecorce', id: 'ecorce',
      })),
    );
  });
});
