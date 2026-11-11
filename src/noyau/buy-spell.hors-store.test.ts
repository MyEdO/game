/**
 * Lot 7 — achat/apprentissage de sorts côté noyau : acheterLeSort (PX, Chaos → +1
 * Corruption), Effet d'éditeur learnSpell (sans PX), lecture au grimoire (NI ×2
 * dans le flux pendingCast).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { effectiveSpellOf } from './combatFlow';
import { applyEffects } from './combatEffects';
import { herosDeScenario, groupeDeScenario } from '../scenes/test-scenarios/_heros';
import { createHero } from '../engine/character';
import type { Combatant } from '../engine/types';
import { t } from '../i18n';
import { chaosSpellsOf, findSpellById } from '../data';
import { talentMaxById } from '../engine/careerSlots';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

beforeEach(() => {
  banc.setState({ battle: null, party: [], journal: [], pendingCast: null });
  banc.getState().ensemencerLeTirage(41);
});

describe('acheterLeSort', () => {
  it('mémorise contre PX (Magie mineure) ; refuse sans PX suffisants', () => {
    // Sans Talent aléatoire (`talentsRolled: false`) : aucun tirage ne touche la FM.
    const w = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W', seed: 707, careerTalent: { id: 'magie-mineure' }, talentsRolled: false });
    // Prémisse CONTRÔLÉE (indépendante du BFM réel du pré-tiré, #421 — les pré-tirés suivent
    // désormais les règles de création, leur quota de sorts mineurs varie avec leur seed) : BFM 2,
    // et 2 sorts mineurs déjà connus (Fléchette, Choc) = ses BFM inclus au Talent. Le suivant est
    // PAYANT : « Jusqu'à BFM ×1 » (bande inclusive) = 50 PX (LDB 10 l.718).
    w.spells = ['flechette', 'choc'];
    w.characteristics['force-mentale'] = 25;
    w.xp = 60;
    banc.setState({ party: [w] as Combatant[] });
    banc.getState().acheterLeSort(w.id, 'drain');
    const after = banc.getState().party[0];
    expect(after.spells).toContain('drain'); // runtime = id de sort
    expect(after.xp).toBe(10);
    banc.getState().acheterLeSort(w.id, 'eblouissant'); // 3 connus → bande ×2 : 100 PX > 10 restants
    expect(banc.getState().party[0].spells).not.toContain('eblouissant');
    expect(banc.getState().journal).toContain(t('pf.notEnoughXp', { name: w.label, cost: 100 }));
  });

  it('Bénédictions du culte : 0 PX (incluses au Talent Béni)', () => {
    const p = herosDeScenario(idsDeTest, 'pretre');
    p.talents.push({ talentId: 'beni', spec: 'sigmar', times: 1 });
    p.xp = 0;
    banc.setState({ party: [p] as Combatant[] });
    banc.getState().acheterLeSort(p.id, 'benediction-de-puissance'); // Sigmar (LDB 41)
    expect(banc.getState().party[0].spells).toContain('benediction-de-puissance'); // id de sort
    expect(banc.getState().party[0].xp).toBe(0);
  });

  it('Magie du Chaos : le Sort de la prise est inclus, le suivant coûte 100 PX et une prise de plus, +1 Corruption chacun (LDB 10 l.704-708)', () => {
    const w = herosDeScenario(idsDeTest, 'sorcier');
    w.talents.push({ talentId: 'magie-du-chaos', spec: 'tzeentch', times: 1 });
    w.xp = 200;
    w.corruption = 0;
    banc.setState({ party: [w] as Combatant[] });
    const prises = () => banc.getState().party[0].talents.find((x) => x.talentId === 'magie-du-chaos')!.times;
    banc.getState().acheterLeSort(w.id, 'trahison-de-tzeentch');
    expect([banc.getState().party[0].xp, prises(), banc.getState().party[0].corruption]).toEqual([200, 1, 1]);
    banc.getState().acheterLeSort(w.id, 'aura-doree-de-tzeentch');
    const after = banc.getState().party[0];
    expect(after.spells).toEqual(expect.arrayContaining(['trahison-de-tzeentch', 'aura-doree-de-tzeentch']));
    expect([after.xp, prises(), after.corruption]).toEqual([100, 2, 2]);
  });

  it('Magie du Chaos : Maxi = les Sorts du Domaine choisi (LDB 10 l.704)', () => {
    const w = herosDeScenario(idsDeTest, 'sorcier');
    expect(talentMaxById(w, 'magie-du-chaos', 'tzeentch')).toBe(chaosSpellsOf('tzeentch').length);
    expect(talentMaxById(w, 'magie-du-chaos'), 'Domaine pas encore choisi').toBeNull();
  });
});

describe('Effet learnSpell (trouvaille de campagne)', () => {
  it('apprend SANS PX au héros au Talent éligible', () => {
    const [w, other] = groupeDeScenario(idsDeTest, 'sorcier', 'soldat');
    w.talents.push({ talentId: 'magie-des-arcanes', spec: 'feu', times: 1 }); // spec = id de Domaine (domains.json:3) ; rend le sort d'Arcane apprenable
    w.xp = 0;
    banc.setState({ party: [other, w] as Combatant[] });
    applyEffects(banc.getState, banc.setState, [{ type: 'learnSpell', spell: 'arme-aethyrique' }]);
    const after = banc.getState().party.find((h) => h.id === w.id)!;
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
    const s = herosDeScenario(idsDeTest, 'soldat');
    s.spells = [];
    if (talent) s.talents.push(talent);
    banc.setState({ party: [s] as Combatant[] });
    return s;
  };

  it('héros NOMMÉ sans Talent de lanceur : rien d’appris, refus NOMMÉ au journal', () => {
    const s = soldatNomme();
    applyEffects(banc.getState, banc.setState, [{ type: 'learnSpell', spell: 'cauteriser', heroId: s.id }]);
    expect(banc.getState().party[0].spells).toEqual([]);
    expect(banc.getState().journal).toContain(refus(s));
  });

  it('héros NOMMÉ au Talent du Domaine : appris', () => {
    const s = soldatNomme({ talentId: 'magie-des-arcanes', spec: 'feu', times: 1 }); // spec = id de Domaine (domains.json:3)
    applyEffects(banc.getState, banc.setState, [{ type: 'learnSpell', spell: 'cauteriser', heroId: s.id }]);
    expect(banc.getState().party[0].spells).toContain('cauteriser');
    expect(banc.getState().journal).toContain(t('eff.sortAppris', { name: s.label, spell: CAUTERISER.label }));
  });

  it('Sort de Domaine + Talent d’un AUTRE Domaine : refus nommé', () => {
    const s = soldatNomme({ talentId: 'magie-des-arcanes', spec: 'bete', times: 1 }); // domains.json:815
    applyEffects(banc.getState, banc.setState, [{ type: 'learnSpell', spell: 'cauteriser', heroId: s.id }]);
    expect(banc.getState().party[0].spells).toEqual([]);
    expect(banc.getState().journal).toContain(refus(s));
  });

  it('héros NOMMÉ qui connaît DÉJÀ le sort : aucun doublon, le journal dit « déjà connu », jamais « sans Talent » (#2312)', () => {
    const s = soldatNomme({ talentId: 'magie-des-arcanes', spec: 'feu', times: 1 });
    s.spells = ['cauteriser'];
    banc.setState({ party: [s] as Combatant[] });
    applyEffects(banc.getState, banc.setState, [{ type: 'learnSpell', spell: 'cauteriser', heroId: s.id }]);
    expect(banc.getState().party[0].spells).toEqual(['cauteriser']);
    expect(banc.getState().journal).toContain(t('pf.spellAlreadyKnown', { name: s.label, spell: CAUTERISER.label }));
    expect(banc.getState().journal).not.toContain(refus(s));
    expect(banc.getState().journal).not.toContain(t('eff.sortAppris', { name: s.label, spell: CAUTERISER.label }));
  });

  it('`heroId` authoré absent du groupe : le journal dit l’ID introuvable, pas le refus de GROUPE', () => {
    soldatNomme({ talentId: 'magie-des-arcanes', spec: 'feu', times: 1 });
    applyEffects(banc.getState, banc.setState, [{ type: 'learnSpell', spell: 'cauteriser', heroId: 'heros-qui-nexiste-pas' }]);
    expect(banc.getState().party[0].spells).toEqual([]);
    expect(banc.getState().journal).toContain(t('eff.herosInconnu', { id: 'heros-qui-nexiste-pas' }));
    expect(banc.getState().journal).not.toContain(t('eff.sortSansApprenti', { spell: CAUTERISER.label }));
  });

  it('sans héros désigné et personne d’éligible : rien d’appris, refus de GROUPE au journal', () => {
    soldatNomme();
    applyEffects(banc.getState, banc.setState, [{ type: 'learnSpell', spell: 'cauteriser' }]);
    expect(banc.getState().party[0].spells).toEqual([]);
    expect(banc.getState().journal).toContain(t('eff.sortSansApprenti', { spell: CAUTERISER.label }));
  });
});

describe('lecture au grimoire — NI doublé dans le flux', () => {
  it('effectiveSpellOf double le NI quand pendingCast.grimoire', () => {
    const base = effectiveSpellOf({ spellId: 'arme-aethyrique' });
    const doubled = effectiveSpellOf({ spellId: 'arme-aethyrique', grimoire: true });
    expect(doubled!.cn).toBe((base!.cn ?? 0) * 2);
  });

  it('incanterLeSort(fromGrimoire) refuse sans grimoire porté', () => {
    const w = herosDeScenario(idsDeTest, 'sorcier');
    banc.setState({ party: [w] as Combatant[] });
    banc.getState().incanterLeSort(w.id, 'arme-aethyrique', w.id, true);
    expect(banc.getState().pendingCast).toBeNull();
    expect(banc.getState().journal.join('\n')).toMatch(/grimoire/);
  });

  it('avec grimoire porté + Domaine : pendingCast.grimoire posé', () => {
    const w = herosDeScenario(idsDeTest, 'sorcier');
    w.talents.push({ talentId: 'magie-des-arcanes', spec: 'feu', times: 1 }); // id de Domaine, jamais le libellé
    w.spells = (w.spells ?? []).filter((s) => s !== 'arme-aethyrique'); // id de sort (runtime)
    w.items = [...(w.items ?? []), { uid: 'g1', name: 'Grimoire', trappingId: 'grimoire', kind: 'misc', enc: 1, qualities: [] } as never];
    banc.setState({ party: [w] as Combatant[] });
    banc.getState().incanterLeSort(w.id, 'arme-aethyrique', w.id, true);
    expect(banc.getState().pendingCast?.grimoire).toBe(true);
  });
});
