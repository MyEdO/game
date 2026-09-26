/**
 * Malepierre (`LDB 46 l.173`) — CÂBLAGE PROD : le doublement de DR (RÈGLE INCONDITIONNELLE du Livre de
 * base, `engine/magic.ts` `malepierreDR`) et le décrément de la réserve FINIE (`VDM 02 l.165`,
 * `consumeMalepierre`) sur le VRAI chemin de résolution (`oocCastSpell`→`castRoll`→`castConfirm`) —
 * pas la fonction pure isolée (`vdm-incantation-deltas.test.ts` couvre déjà `malepierreDR`/
 * `malepierreCharge`/`malepierreReserveOf` en isolation).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { castNearCorruption } from './combatFlow';
import { FLOWS } from './rollFlowSpecs';
import { pregen, PREGEN } from '../data/pregens';
import { itemFromTrappingById } from '../engine/items';
import { setRule, resetRule } from '../engine/policy';
import type { Combatant } from '../engine/types';
import { evaluateTest } from '../engine/tests';
import { castTestDRMods } from '../engine/magic';
import { findSpellById } from '../data/index';

const RULE = 'magic-vdm-incantation';

/** Sorcier quasi certain de réussir son Test d'Incantation (DR élevé) — isole le doublement du bruit
 *  du d100, comme les autres câblages de ce fichier (`sea-magic-state.test.ts`). */
function sorcier(): Combatant {
  const w = pregen(PREGEN.sorcier);
  w.characteristics = { ...w.characteristics, intelligence: 95 };
  const sk = w.skills.find((s) => s.id === 'langue');
  if (sk) sk.advances = Math.max(sk.advances, 40);
  else w.skills.push({ id: 'langue', spec: 'magick', advances: 40 } as never);
  return w;
}

beforeEach(() => {
  useGame.setState({ battle: null, party: [], journal: [], pendingCast: null, pendingFocus: null });
  useGame.getState().seedRng(11);
});
afterEach(() => resetRule(RULE));

describe('Malepierre — câblage PROD (Incantation, `oocCastSpell`/`castRoll`/`castConfirm`)', () => {
  const spellId = 'armure-aethyrique';

  function rollWithMalepierre(w: Combatant) {
    useGame.setState({ party: [w] });
    useGame.getState().oocCastSpell(w.id, spellId, w.id);
    useGame.getState().castRoll();
    return useGame.getState().pendingCast!.result!;
  }

  it('OFF (Livre de base) : le doublement reste ACTIF — règle INCONDITIONNELLE (`LDB 46 l.173`) — mais la réserve ne bouge JAMAIS (la finitude est un apport VDM seul)', () => {
    const w = sorcier();
    const carried = itemFromTrappingById('malepierre-brute')!;
    w.items = [carried];
    const res = rollWithMalepierre(w);
    expect(res.malepierreConsumed).toBeGreaterThan(0);
    useGame.getState().castConfirm();
    const after = useGame.getState().party.find((h) => h.id === w.id)!;
    const item = after.items!.find((i) => i.uid === carried.uid)!;
    expect(item.niReserve).toBeUndefined(); // jamais entamée sous le Livre de base seul
  });

  it('ON : le DR est doublé (bonus > 0) ET la réserve DÉCRÉMENTÉE au vrai confirm (`castConfirm`)', () => {
    setRule(RULE, true);
    const w = sorcier();
    const carried = itemFromTrappingById('malepierre-brute')!;
    w.items = [carried];
    useGame.setState({ party: [w] });
    useGame.getState().oocCastSpell(w.id, spellId, w.id);
    useGame.getState().castRoll();
    const pc = useGame.getState().pendingCast!;
    const consumed = pc.result!.malepierreConsumed;
    expect(consumed).toBeGreaterThan(0);
    // Réserve INTACTE avant confirm — l'écriture est déférée au site de résolution (`consumeMalepierre`).
    expect(w.items!.find((i) => i.uid === carried.uid)!.niReserve).toBeUndefined();
    useGame.getState().castConfirm();
    const after = useGame.getState().party.find((h) => h.id === w.id)!;
    const item = after.items!.find((i) => i.uid === carried.uid)!;
    expect(item.niReserve).toBe(20 - consumed!);
  });

  it('EXPLOIT corrigé : une relance de Chance « +1 DR » ne doit PAS effacer la consommation déjà figée — la réserve décroît APRÈS le relancer', () => {
    setRule(RULE, true);
    const w = sorcier();
    w.fortune = 1; // requis par `opBonusSL` pour dépenser la Chance
    const carried = itemFromTrappingById('malepierre-brute')!;
    w.items = [carried];
    useGame.setState({ party: [w] });
    useGame.getState().oocCastSpell(w.id, spellId, w.id);
    useGame.getState().castRoll();
    const consumedBefore = useGame.getState().pendingCast!.result!.malepierreConsumed;
    expect(consumedBefore).toBeGreaterThan(0);
    FLOWS.cast.bonusSL(useGame.getState, useGame.setState); // Chance « +1 DR » (LDB 17 l.24)
    const consumedAfterBonus = useGame.getState().pendingCast!.result!.malepierreConsumed;
    expect(consumedAfterBonus).toBe(consumedBefore); // REPORTÉ (`rederiveCastSL`), jamais perdu ni redoublé
    useGame.getState().castConfirm();
    const after = useGame.getState().party.find((h) => h.id === w.id)!;
    const item = after.items!.find((i) => i.uid === carried.uid)!;
    expect(item.niReserve).toBe(20 - consumedBefore!); // décrémenté UNE seule fois, du montant D'ORIGINE
  });

  it('une SECONDE malepierre reste ATTEIGNABLE une fois la première épuisée (jamais masquée pour toujours)', () => {
    setRule(RULE, true);
    const w = sorcier();
    const epuisee = itemFromTrappingById('malepierre-brute')!;
    epuisee.niReserve = 0;
    const intacte = itemFromTrappingById('malepierre-brute')!;
    w.items = [epuisee, intacte];
    const res = rollWithMalepierre(w);
    expect(res.malepierreConsumed).toBeGreaterThan(0); // la SECONDE pierre est trouvée, pas ignorée en bloc
    useGame.getState().castConfirm();
    const after = useGame.getState().party.find((h) => h.id === w.id)!;
    expect(after.items!.find((i) => i.uid === epuisee.uid)!.niReserve).toBe(0); // inchangée
    expect(after.items!.find((i) => i.uid === intacte.uid)!.niReserve).toBeLessThan(20); // la SECONDE a été entamée
  });

  it('ÉPUISEMENT : réserve à 0 → plus de doublement, même option ON', () => {
    setRule(RULE, true);
    const w = sorcier();
    const carried = itemFromTrappingById('malepierre-brute')!;
    carried.niReserve = 0;
    w.items = [carried];
    const res = rollWithMalepierre(w);
    expect(res.malepierreConsumed ?? 0).toBe(0);
  });

  it('« Se trouver à proximité d\'une malepierre » (LDB 19 l.40) : porter l\'objet expose le porteur aux Influences malveillantes, MÊME option OFF', () => {
    const w = sorcier();
    w.items = [itemFromTrappingById('malepierre-brute')!];
    useGame.setState({ party: [w] });
    expect(castNearCorruption(useGame.getState)).toBe(true);
  });

  it('LDB 46 l.173 « … entraîne une influence corruptrice » : câblée via le `corruptionExposure` DÉJÀ porté par l’entrée (réutilisé, pas un second chemin)', () => {
    setRule(RULE, true);
    const w = sorcier();
    w.items = [itemFromTrappingById('malepierre-brute')!];
    useGame.setState({ party: [w], journal: [] });
    useGame.getState().oocCastSpell(w.id, spellId, w.id);
    useGame.getState().castRoll();
    useGame.getState().castConfirm();
    expect(useGame.getState().journal.some((l) => l.includes('Exposition moderee'))).toBe(true); // « être en contact » (LDB 19 l.51) — pas « à proximité » (l.40, mineure)
  });

  it('dé CHOISI (Résilience `castSetForcedRoll`) : le doublement porte sur le NOUVEAU DR, une seule consommation (pas le montant du jet d’origine, périmé)', () => {
    setRule(RULE, true);
    const w = sorcier();
    w.resilience = 1; // requis pour ouvrir la Résilience (LDB 17 l.68)
    const carried = itemFromTrappingById('malepierre-brute')!;
    w.items = [carried];
    useGame.setState({ party: [w] });
    useGame.getState().oocCastSpell(w.id, spellId, w.id);
    useGame.getState().castRoll();
    const before = useGame.getState().pendingCast!.result!;
    expect(before.malepierreConsumed).toBeGreaterThan(0);
    useGame.getState().castForceSuccess(); // ouvre `forced` (LDB 17 l.68) — requis avant `castSetForcedRoll`
    useGame.getState().castSetForcedRoll(1);
    const after = useGame.getState().pendingCast!.result!;
    const tr0 = evaluateTest(1, before.target);
    // Attendu calculé par la SOURCE UNIQUE des modificateurs (`castTestDRMods`), jamais par une copie
    // de sa formule : une pile qui divergerait ici ne serait pas vue.
    const sl0 = tr0.sl + castTestDRMods(w, 'incantation', { success: tr0.success, spell: findSpellById(spellId)! });
    expect(after.malepierreConsumed).toBe(sl0); // doublement PLEIN du dé CHOISI, pas le `before.malepierreConsumed` reporté
    expect(after.sl).toBe(sl0 * 2); // le DR final reflète le doublement du NOUVEAU jet
    useGame.getState().castConfirm();
    const heroAfter = useGame.getState().party.find((h) => h.id === w.id)!;
    const item = heroAfter.items!.find((i) => i.uid === carried.uid)!;
    expect(item.niReserve).toBe(20 - after.malepierreConsumed!); // UNE seule consommation, du bon montant
  });
});
