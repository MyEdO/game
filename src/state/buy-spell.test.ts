/**
 * Lot 7 — achat/apprentissage de sorts côté store : buySpell (PX, Chaos → +1
 * Corruption), Effet d'éditeur learnSpell (sans PX), lecture au grimoire (NI ×2
 * dans le flux pendingCast).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { applyEffects, effectiveSpellOf } from './combatFlow';
import { pregen, pregenParty, PREGEN } from '../data/pregens';
import { createHero } from '../engine/character';
import type { Combatant } from '../engine/types';
import { t } from '../i18n';
import { findSpellById } from '../data';

beforeEach(() => {
  useGame.setState({ battle: null, party: [], journal: [], pendingCast: null });
  useGame.getState().seedRng(41);
});

describe('buySpell', () => {
  it('mémorise contre PX (Magie mineure) ; refuse sans PX suffisants', () => {
    // Sans Talent aléatoire (`talentsRolled: false`) : aucun tirage ne touche la FM.
    const w = createHero({ speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W', seed: PREGEN.sorcier, careerTalent: { id: 'magie-mineure' }, talentsRolled: false });
    // Prémisse CONTRÔLÉE (indépendante du BFM réel du pré-tiré, #421 — les pré-tirés suivent
    // désormais les règles de création, leur quota de sorts mineurs varie avec leur seed) : BFM 2,
    // et 2 sorts mineurs déjà connus (Fléchette, Choc) = ses BFM inclus au Talent. Le suivant est
    // PAYANT : « Jusqu'à BFM ×1 » (bande inclusive) = 50 PX (LDB 10 l.718).
    w.spells = ['flechette', 'choc'];
    w.characteristics['force-mentale'] = 25;
    w.xp = 60;
    useGame.setState({ party: [w] as Combatant[] });
    useGame.getState().buySpell(w.id, 'drain');
    const after = useGame.getState().party[0];
    expect(after.spells).toContain('drain'); // runtime = id de sort
    expect(after.xp).toBe(10);
    useGame.getState().buySpell(w.id, 'eblouissant'); // 3 connus → bande ×2 : 100 PX > 10 restants
    expect(useGame.getState().party[0].spells).not.toContain('eblouissant');
    expect(useGame.getState().journal.join('\n')).toMatch(/PX requis/);
  });

  it('Bénédictions du culte : 0 PX (incluses au Talent Béni)', () => {
    const p = pregen(PREGEN.pretre);
    p.talents.push({ talentId: 'beni', spec: 'sigmar', times: 1 });
    p.xp = 0;
    useGame.setState({ party: [p] as Combatant[] });
    useGame.getState().buySpell(p.id, 'benediction-de-puissance'); // Sigmar (LDB 41)
    expect(useGame.getState().party[0].spells).toContain('benediction-de-puissance'); // id de sort
    expect(useGame.getState().party[0].xp).toBe(0);
  });

  it('sort de Magie du Chaos : 100 PX ET +1 Point de Corruption', () => {
    const w = pregen(PREGEN.sorcier);
    w.talents.push({ talentId: 'magie-du-chaos', spec: 'nurgle', times: 1 });
    w.xp = 200;
    useGame.setState({ party: [w] as Combatant[] });
    useGame.getState().buySpell(w.id, 'flot-de-corruption');
    const after = useGame.getState().party[0];
    expect(after.spells).toContain('flot-de-corruption'); // sort du Chaos appris (id stable)
    expect(after.corruption ?? 0).toBeGreaterThanOrEqual(1); // +1 Point de Corruption (LDB 19)
    expect(after.xp).toBe(100); // 200 − 100 PX
  });
});

describe('Effet learnSpell (trouvaille de campagne)', () => {
  it('apprend SANS PX au héros au Talent éligible', () => {
    const [w, other] = pregenParty(PREGEN.sorcier, PREGEN.soldat);
    w.talents.push({ talentId: 'magie-des-arcanes', spec: 'feu', times: 1 }); // spec = id de Domaine (domains.json:3) ; rend le sort d'Arcane apprenable
    w.xp = 0;
    useGame.setState({ party: [other, w] as Combatant[] });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'learnSpell', spell: 'arme-aethyrique' }]);
    const after = useGame.getState().party.find((h) => h.id === w.id)!;
    expect(after.spells).toContain('arme-aethyrique'); // id de sort (runtime) ; pas le guerrier : le Talent guide la cible
    expect(after.xp).toBe(0);
  });

  // LDB 46 l.14 : « Les Sorts de Domaine sont ceux que vous pouvez apprendre seulement si vous
  // connaissez ce Domaine ; par exemple, pour apprendre les Sorts du Domaine du Feu, vous avez
  // besoin du Talent Magie des Arcanes (Feu). » — #1702 : la garde vaut aussi pour un héros NOMMÉ.
  // `cauteriser` : Sort de Domaine du Feu (spells.json:4347 id / 4451 `domainId: "feu"`).
  const CAUTERISER = findSpellById('cauteriser')!;
  const refus = (h: Combatant) => t('pf.spellCannotLearn', { name: h.label, spell: CAUTERISER.label });
  /** Un soldat NOMMÉ, grimoire vide, plus le Talent de lanceur qu'on veut lui donner (aucun par défaut). */
  const soldatNomme = (talent?: { talentId: string; spec?: string; times: number }) => {
    const s = pregen(PREGEN.soldat);
    s.spells = [];
    if (talent) s.talents.push(talent);
    useGame.setState({ party: [s] as Combatant[] });
    return s;
  };

  it('héros NOMMÉ sans Talent de lanceur : rien d’appris, refus NOMMÉ au journal', () => {
    const s = soldatNomme();
    applyEffects(useGame.getState, useGame.setState, [{ type: 'learnSpell', spell: 'cauteriser', heroId: s.id }]);
    expect(useGame.getState().party[0].spells).toEqual([]);
    expect(useGame.getState().journal).toContain(refus(s));
  });

  it('héros NOMMÉ au Talent du Domaine : appris', () => {
    const s = soldatNomme({ talentId: 'magie-des-arcanes', spec: 'feu', times: 1 }); // spec = id de Domaine (domains.json:3)
    applyEffects(useGame.getState, useGame.setState, [{ type: 'learnSpell', spell: 'cauteriser', heroId: s.id }]);
    expect(useGame.getState().party[0].spells).toContain('cauteriser');
    expect(useGame.getState().journal).toContain(t('eff.learnSpell', { name: s.label, spell: CAUTERISER.label }));
  });

  it('Sort de Domaine + Talent d’un AUTRE Domaine : refus nommé', () => {
    const s = soldatNomme({ talentId: 'magie-des-arcanes', spec: 'bete', times: 1 }); // domains.json:815
    applyEffects(useGame.getState, useGame.setState, [{ type: 'learnSpell', spell: 'cauteriser', heroId: s.id }]);
    expect(useGame.getState().party[0].spells).toEqual([]);
    expect(useGame.getState().journal).toContain(refus(s));
  });

  it('héros NOMMÉ qui connaît DÉJÀ le sort : aucun doublon, et le journal dit le refus (jamais « apprend »)', () => {
    const s = soldatNomme({ talentId: 'magie-des-arcanes', spec: 'feu', times: 1 });
    s.spells = ['cauteriser'];
    useGame.setState({ party: [s] as Combatant[] });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'learnSpell', spell: 'cauteriser', heroId: s.id }]);
    expect(useGame.getState().party[0].spells).toEqual(['cauteriser']);
    expect(useGame.getState().journal).toContain(refus(s)); // même message que buySpell (spellCost → null)
    expect(useGame.getState().journal).not.toContain(t('eff.learnSpell', { name: s.label, spell: CAUTERISER.label }));
  });

  it('`heroId` authoré absent du groupe : le journal dit l’ID introuvable, pas le refus de GROUPE', () => {
    soldatNomme({ talentId: 'magie-des-arcanes', spec: 'feu', times: 1 });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'learnSpell', spell: 'cauteriser', heroId: 'heros-qui-nexiste-pas' }]);
    expect(useGame.getState().party[0].spells).toEqual([]);
    expect(useGame.getState().journal).toContain(t('eff.heroUnknown', { id: 'heros-qui-nexiste-pas' }));
    expect(useGame.getState().journal).not.toContain(t('eff.learnSpellNoOne', { spell: CAUTERISER.label }));
  });

  it('sans héros désigné et personne d’éligible : rien d’appris, refus de GROUPE au journal', () => {
    soldatNomme();
    applyEffects(useGame.getState, useGame.setState, [{ type: 'learnSpell', spell: 'cauteriser' }]);
    expect(useGame.getState().party[0].spells).toEqual([]);
    expect(useGame.getState().journal).toContain(t('eff.learnSpellNoOne', { spell: CAUTERISER.label }));
  });
});

describe('lecture au grimoire — NI doublé dans le flux', () => {
  it('effectiveSpellOf double le NI quand pendingCast.grimoire', () => {
    const base = effectiveSpellOf({ spellId: 'arme-aethyrique' });
    const doubled = effectiveSpellOf({ spellId: 'arme-aethyrique', grimoire: true });
    expect(doubled!.cn).toBe((base!.cn ?? 0) * 2);
  });

  it('oocCastSpell(fromGrimoire) refuse sans grimoire porté', () => {
    const w = pregen(PREGEN.sorcier);
    useGame.setState({ party: [w] as Combatant[] });
    useGame.getState().oocCastSpell(w.id, 'arme-aethyrique', w.id, true);
    expect(useGame.getState().pendingCast).toBeNull();
    expect(useGame.getState().journal.join('\n')).toMatch(/grimoire/);
  });

  it('avec grimoire porté + Domaine : pendingCast.grimoire posé', () => {
    const w = pregen(PREGEN.sorcier);
    w.talents.push({ talentId: 'magie-des-arcanes', spec: 'feu', times: 1 }); // id de Domaine, jamais le libellé
    w.spells = (w.spells ?? []).filter((s) => s !== 'arme-aethyrique'); // id de sort (runtime)
    w.items = [...(w.items ?? []), { uid: 'g1', name: 'Grimoire', trappingId: 'grimoire', kind: 'misc', enc: 1, qualities: [] } as never];
    useGame.setState({ party: [w] as Combatant[] });
    useGame.getState().oocCastSpell(w.id, 'arme-aethyrique', w.id, true);
    expect(useGame.getState().pendingCast?.grimoire).toBe(true);
  });
});
