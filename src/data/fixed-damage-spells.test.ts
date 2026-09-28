import { describe, it, expect } from 'vitest';
import { findSpellById } from '../data';
import type { Flow } from '../state/flow';
import type { GameOp } from '../engine/ops';

/** Toutes les ops EffectOp d'un Flow de sort (parcourt seq/do/if/test). */
function flowOps(flow: Flow | undefined): GameOp[] {
  const out: GameOp[] = [];
  const walk = (f?: Flow): void => {
    if (!f) return;
    switch (f.kind) {
      case 'seq': f.steps.forEach(walk); break;
      case 'do': if (f.effect.type === 'ops') out.push(...f.effect.ops); break;
      case 'if': walk(f.then); walk(f.else); break;
      case 'test': walk(f.success); walk(f.fail); break;
      case 'choice': walk(f.yes); walk(f.no); break;
    }
  };
  walk(flow);
  return out;
}
const woundsOf = (id: string) => flowOps(findSpellById(id)?.effects).find((o) => o.op === 'wounds');

// Sorts frenchy « N Points de Dégâts » (≠ Projectile magique qui scale en DR+BFM) : dégâts FIXES via
// `effects` Flow + op `wounds` (réutilise le système d'effets unique). Montant + armure = VERBATIM de la
// desc ; BE = règle universelle LDB 13 (s'applique, ≠ défaut bypass de l'op). frenchy ayant ses propres
// trads, les références (condition « Étourdi ») sont résolues par id STABLE (`sonne`), pas par le libellé.
describe('sorts à dégâts FIXES (frenchy) — VERBATIM desc + BE selon LDB 13 (id-based)', () => {
  it('« Projectile Mineur » est Fléchette (VO *Dart*) : Projectile magique, dégâts NON fixes (LDB 47 l.182)', () => {
    const fl = findSpellById('flechette')!;
    expect(fl.missile).toBe(true);
    expect(woundsOf('flechette')).toBeUndefined();
    expect(findSpellById('projectile-mineur')).toBeUndefined();
  });
  it('Langue Acérée : 11 PD, ignore l’armure (« pas d’armure ») ; BE appliqué', () => {
    expect(woundsOf('langue-aceree')).toMatchObject({ op: 'wounds', amount: 11, ignoreAP: true, ignoreTB: false });
  });
  it('Crépitement Funeste : 6 PD (armure OK) + Test de Résistance → Sonné (frenchy « Étourdi » = id sonne)', () => {
    const sp = findSpellById('crepitement-funeste')!;
    expect(woundsOf('crepitement-funeste')).toMatchObject({ op: 'wounds', amount: 6, ignoreAP: false, ignoreTB: false });
    // Le rider est MÉCANIQUE et référencé par id STABLE (≠ libellé maison « Étourdi »).
    const json = JSON.stringify(sp.effects);
    expect(json).toContain('"skill":{"id":"resistance"}');
    expect(json).toContain('"id":"sonne"');
  });
});
