/**
 * Écran de fin de séance — câblage du noyau (LDB 05 Ambitions + LDB 17 Détermination) :
 *  - PX d'Ambition accomplie (+50 court / +500 long ; groupe = à chaque héros) via `endSession` ;
 *  - regain de Détermination pour un héros ayant agi selon sa Motivation (plafonné au max) ;
 *  - restauration de la Chance (couture `restoreFortune`).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { pregen, PREGEN } from '../data/pregens';
import { resolveMax } from '../engine/talentEffects';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

describe('endSession (LDB 05 / LDB 17)', () => {
  beforeEach(() => { banc.setState({ party: [], journal: [], flags: {} }); });

  it('octroie +50/+500 PX d’Ambition (perso + groupe à chaque héros)', () => {
    const a = pregen(PREGEN.soldat); a.xp = 0;
    const b = pregen(PREGEN.tueur); b.xp = 0;
    banc.setState({ party: [a, b] });
    banc.getState().endSession({
      heroes: { [a.id]: { ambitionShort: true, ambitionLong: true } },
      group: { ambitionShort: true },
    });
    const st = banc.getState();
    expect(st.party.find((h) => h.id === a.id)!.xp).toBe(50 + 500 + 50); // perso court + long + groupe court
    expect(st.party.find((h) => h.id === b.id)!.xp).toBe(50); // groupe court seulement
  });

  it('regagne 1 Point de Détermination pour un héros ayant agi selon sa Motivation (plafonné)', () => {
    const a = pregen(PREGEN.tueur); a.resolve = 0;
    banc.setState({ party: [a] });
    banc.getState().endSession({ heroes: { [a.id]: { motivation: true } } });
    const h = banc.getState().party.find((x) => x.id === a.id)!;
    expect(h.resolve).toBe(Math.min(resolveMax(h), 1));
  });

  it('restaure la Chance du groupe au niveau du Destin', () => {
    const a = pregen(PREGEN.soldat);
    if (a.fate != null) a.fortune = 0; // dépensée
    banc.setState({ party: [a] });
    banc.getState().endSession({});
    const h = banc.getState().party.find((x) => x.id === a.id)!;
    if (h.fate != null) expect(h.fortune).toBe(h.fate);
  });
});
