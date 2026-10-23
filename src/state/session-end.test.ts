/**
 * Écran de fin de séance — câblage store (LDB 05 Ambitions + LDB 17 Détermination) :
 *  - PX d'Ambition accomplie (+50 court / +500 long ; groupe = à chaque héros) via `endSession` ;
 *  - regain de Détermination pour un héros ayant agi selon sa Motivation (plafonné au max) ;
 *  - restauration de la Chance (couture `restoreFortune`).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { pregen, PREGEN } from '../data/pregens';
import { resolveMax } from '../engine/talentEffects';
import { idNeufDeBanc } from '../lib/entityId.testkit';

describe('endSession (LDB 05 / LDB 17)', () => {
  beforeEach(() => { useGame.setState({ party: [], journal: [], flags: {} }); });

  it('octroie +50/+500 PX d’Ambition (perso + groupe à chaque héros)', () => {
    const a = pregen(idNeufDeBanc, PREGEN.soldat); a.xp = 0;
    const b = pregen(idNeufDeBanc, PREGEN.tueur); b.xp = 0;
    useGame.setState({ party: [a, b] });
    useGame.getState().endSession({
      heroes: { [a.id]: { ambitionShort: true, ambitionLong: true } },
      group: { ambitionShort: true },
    });
    const st = useGame.getState();
    expect(st.party.find((h) => h.id === a.id)!.xp).toBe(50 + 500 + 50); // perso court + long + groupe court
    expect(st.party.find((h) => h.id === b.id)!.xp).toBe(50); // groupe court seulement
  });

  it('regagne 1 Point de Détermination pour un héros ayant agi selon sa Motivation (plafonné)', () => {
    const a = pregen(idNeufDeBanc, PREGEN.tueur); a.resolve = 0;
    useGame.setState({ party: [a] });
    useGame.getState().endSession({ heroes: { [a.id]: { motivation: true } } });
    const h = useGame.getState().party.find((x) => x.id === a.id)!;
    expect(h.resolve).toBe(Math.min(resolveMax(h), 1));
  });

  it('restaure la Chance du groupe au niveau du Destin', () => {
    const a = pregen(idNeufDeBanc, PREGEN.soldat);
    if (a.fate != null) a.fortune = 0; // dépensée
    useGame.setState({ party: [a] });
    useGame.getState().endSession({});
    const h = useGame.getState().party.find((x) => x.id === a.id)!;
    if (h.fate != null) expect(h.fortune).toBe(h.fate);
  });
});
