/**
 * LE NŒUD `choix` HORS COMBAT (#1463 β2) : le lanceur du groupe tranche chaque choix d'un Sort, une fois
 * par lancer ; un choix qui coûte des Avantages n'est pas offert hors combat. LDB 14 l.219.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { ouvrirLeBanc } from './banc.testkit';
import { draineEtapes } from './cascade.testkit';
import { groupeDeScenario } from '../scenes/test-scenarios/_heros';
import { spells } from '../data';
import { walkFlow } from '../engine/flowCore';
import { runCombatFlow } from './combat/triggeredTest';
import type { Flow } from '../data/schemas/defs-scenes/effets';

/** Les Sorts dont un nœud `choix` se rencontre sans passer par la branche d'un Test. */
const sortsAChoixDirect = spells.filter((s) => {
  let direct = false;
  if (s.effects) walkFlow(s.effects, (f, chemin) => { if (f.kind === 'choix' && !chemin.includes('reussite') && !chemin.includes('echec')) direct = true; });
  return direct;
});

describe('choix d’un Sort lancé hors combat', () => {
  it('témoin : le corpus porte des Sorts à choix direct', () => {
    expect(sortsAChoixDirect.length, sortsAChoixDirect.map((s) => s.id).join(', ')).toBeGreaterThan(0);
  });

  for (const sort of sortsAChoixDirect) {
    it(`${sort.id} : le lanceur tranche, chaque étape une seule fois`, () => {
      const [w, s] = groupeDeScenario(idsDeTest, 'sorcier', 'soldat');
      const banc = ouvrirLeBanc({ graine: 7, etat: { party: [w, s] } });
      banc.getState().incanterLeSort(w.id, sort.id, s.id);
      banc.getState().jetLancer('incantation');
      const pc = banc.getState().pendingCast!;
      banc.setState({ pendingCast: { ...pc, result: { ...pc.result!, cast: true, sl: 10, isCritical: false, isFumble: false } } });
      banc.getState().jetValider('incantation');
      const vues = draineEtapes(banc.getState, 30);
      expect(banc.getState().pendingCascade, 'la cascade se clôt').toBeNull();
      const choix = vues.filter((v) => v.kind === 'choixDeclenche');
      expect(choix.length, 'le choix est offert').toBeGreaterThan(0);
      expect(choix.every((v) => v.actorId === w.id), 'au lanceur').toBe(true);
      expect(new Set(vues.map((v) => v.id)).size, 'aucune étape jouée deux fois').toBe(vues.length);
    });
  }
});

describe('choix à coût d’Avantage hors combat (LDB 14 l.219)', () => {
  const poser = (id: string): Flow => ({ kind: 'effet', effet: { type: 'ops', on: 'target', ops: [{ op: 'condition', id: { id }, value: 1 }] } });
  const flux: Flow = { kind: 'sequence', etapes: [
    { kind: 'choix', invite: 'Dépenser un Avantage', coutEnAvantage: 1, oui: poser('a-terre'), non: poser('sonne') },
    poser('aveugle'),
  ] };

  it('n’est pas offert : la branche « non » puis la suite se jouent', () => {
    const banc = ouvrirLeBanc({ graine: 7, etat: { party: groupeDeScenario(idsDeTest, 'soldat') } });
    const H = banc.getState().party[0];
    const avantages = H.advantage;
    runCombatFlow({ get: banc.getState, set: banc.setState, target: H, caster: H, label: 'Fixture' }, flux);
    expect(banc.getState().pendingCascade).toBeNull();
    const heros = banc.getState().party[0];
    expect(heros.conditions.map((c) => c.id).sort()).toEqual(['aveugle', 'sonne']);
    expect(heros.advantage).toBe(avantages);
  });
});
