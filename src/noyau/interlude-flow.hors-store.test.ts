/**
 * Interlude « Entre deux aventures » (LDB 22-23) : ouverture (événements d100, Activités =
 * min(3, semaines)), clôture (« Avec le pouvoir », Argent à gaspiller, Revenus, le temps passe),
 * Effet d'éditeur `interlude`.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { draineCascade } from './cascade.testkit';
import { applyEffects } from './combatEffects';
import { interludeEventFor } from '../data/interludeEvents';
import { toBrass, fromBrass } from '../engine/money';
import { partyMoneyTotal, creditBourse } from './bourseFlow';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { setRule, resetRule } from '../engine/policy';
import { species } from '../data';
import { setDataset, resetData } from '../data/overrides';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** Événement d'un héros, dé EXIGÉ : sans l'option « Dés fixés », le dé tombe à l'ouverture (#942 L7)
 *  — un `eventRoll` absent ici signifierait un tirage resté en attente, jamais un défaut de type. */
function eventOf(st: { eventRoll?: number }) {
  expect(st.eventRoll, 'dé d’Événement non tiré à l’ouverture').toBeDefined();
  return interludeEventFor(st.eventRoll!);
}
describe('Interlude — flux start/end', () => {
  beforeEach(() => {
    const a = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
    const b = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'B', seed: 2 });
    banc.setState({ party: [a, b] });
    banc.getState().lancerLaScene(testScene());
    creditBourse(banc.getState, banc.setState, banc.getState().party[0].id, fromBrass(1000)); // bourse perso de départ (#531)
    banc.getState().ensemencerLeTirage(11);
  });

  it('ouvrirLInterlude : événements tirés par héros, Activités = min(3, semaines), écran dédié', () => {
    banc.getState().ouvrirLInterlude(2);
    draineCascade(banc.getState); // les dés d'Événement sont des étapes de séquence : elle se joue avant les Activités
    const itl = banc.getState().interlude!;
    expect(itl).toBeTruthy();
    expect(banc.getState().screen).toBe('interlude');
    const states = Object.values(itl.perHero);
    expect(states).toHaveLength(2);
    for (const st of states) {
      expect(st.eventRoll).toBeGreaterThanOrEqual(1);
      expect(st.eventRoll).toBeLessThanOrEqual(100);
      const ev = eventOf(st);
      // Activités : 2 semaines → 2, moins l'éventuelle perte d'événement (cohérence roll↔fx).
      expect(st.left).toBe(Math.max(0, 2 - (ev.fx?.loseActivity ? 1 : 0)));
      // Le journal porte l'événement (verbatim).
      expect(banc.getState().journal.join('\n')).toContain(ev.label);
    }
  });

  it('ouvrirLInterlude : 5 semaines → max 3 Activités (« maximum de trois », LDB 23 l.5)', () => {
    banc.getState().ouvrirLInterlude(5);
    draineCascade(banc.getState); // les dés d'Événement sont des étapes de séquence : elle se joue avant les Activités
    for (const st of Object.values(banc.getState().interlude!.perHero)) {
      const ev = eventOf(st);
      expect(st.left).toBe(Math.max(0, 3 - (ev.fx?.loseActivity ? 1 : 0)));
    }
  });

  it('la validation de l’interlude : Argent à gaspiller (bourse → Revenus seuls), retour campagne, le temps passe', () => {
    banc.getState().ouvrirLInterlude(1);
    draineCascade(banc.getState); // les dés d'Événement sont des étapes de séquence : elle se joue avant les Activités
    const itl = banc.getState().interlude!;
    const heroId = Object.keys(itl.perHero)[0];
    itl.perHero[heroId].revenueBrass = 120; // Revenus simulés (l'Activité arrive en P2)
    const t0 = banc.getState().gameTime;
    banc.getState().fenetreValider('interlude');
    expect(banc.getState().interlude).toBeNull();
    expect(banc.getState().screen).toBe('campaign');
    expect(toBrass(partyMoneyTotal(banc.getState))).toBe(120); // tout le reste a été gaspillé, seuls les Revenus perso subsistent
    expect(banc.getState().gameTime).toBeGreaterThan(t0); // 7 jours de repos écoulés
  });

  // #897 : `ouvrirLInterlude` reconstruit `perHero` À NEUF (`InterludeState.perHero`, doc ci-dessus) —
  // un Artisanat/Rituel en cours doit donc vivre AILLEURS pour survivre à la clôture. Sonde chiffrée :
  // entamer (mutation directe, comme `craftStart`/`openRitualFocus`), clôturer, rouvrir, constater la
  // reprise au MÊME point (`Combatant.craft`/`Combatant.ritual`, `engine/types.ts`).
  it('#897 : un Artisanat/Rituel en cours SURVIT à la clôture ET à la réouverture d’un interlude', () => {
    banc.getState().ouvrirLInterlude(1);
    draineCascade(banc.getState); // les dés d'Événement sont des étapes de séquence : elle se joue avant les Activités
    const h = banc.getState().party[0];
    h.craft = { trappingId: 'dague', tier: 'bronze', avail: 'commune', atouts: [], defauts: [], drDone: 3, drTarget: 5, difficulty: 'accessible' };
    h.ritual = { spellId: 'graver-une-pierre-d-ogham', drDone: 7, drTarget: 25 };
    banc.getState().fenetreValider('interlude');
    expect(banc.getState().interlude).toBeNull(); // clôture EFFECTIVE (`interlude` reconstruit à neuf au prochain `ouvrirLInterlude`)
    expect(banc.getState().party[0].craft).toEqual({ trappingId: 'dague', tier: 'bronze', avail: 'commune', atouts: [], defauts: [], drDone: 3, drTarget: 5, difficulty: 'accessible' });
    expect(banc.getState().party[0].ritual).toEqual({ spellId: 'graver-une-pierre-d-ogham', drDone: 7, drTarget: 25 });
    banc.getState().ouvrirLInterlude(1); // réouverture : `perHero` neuf, `craft`/`ritual` restent au héros
    draineCascade(banc.getState); // les dés d'Événement sont des étapes de séquence : elle se joue avant les Activités
    expect(banc.getState().party[0].craft?.drDone).toBe(3);
    expect(banc.getState().party[0].ritual?.drDone).toBe(7);
  });

  it('la clôture NOURRIT le groupe (vie en ville payée par le gaspillage) — pas de famine sur 3 semaines', () => {
    banc.getState().ouvrirLInterlude(3);
    draineCascade(banc.getState); // les dés d'Événement sont des étapes de séquence : elle se joue avant les Activités
    const before = banc.getState().party.map((h) => h.wounds.current);
    banc.getState().fenetreValider('interlude'); // 21 jours — sans le couvert, la Faim RAW tuerait le groupe
    const party = banc.getState().party;
    party.forEach((h, i) => expect(h.wounds.current, h.label).toBeGreaterThanOrEqual(before[i]));
    expect(banc.getState().journal.join('\n')).not.toMatch(/dépérit|Faim :/);
  });

  it('« Avec le pouvoir » : Niveau 3 sans Revenus → retombe au Niveau 2 (LDB 23 l.33)', () => {
    banc.getState().ouvrirLInterlude(1);
    draineCascade(banc.getState); // les dés d'Événement sont des étapes de séquence : elle se joue avant les Activités
    const hero = banc.getState().party[0];
    hero.careerLevel = 3;
    banc.getState().fenetreValider('interlude');
    expect(banc.getState().party[0].careerLevel).toBe(2);
    expect(banc.getState().journal.join('\n')).toMatch(/néglig/);
  });

  it('Effet d’éditeur interlude : applyEffects ouvre l’interlude', () => {
    applyEffects(banc.getState, banc.setState, [{ type: 'interlude', weeks: 2 }]);
    expect(banc.getState().interlude?.weeks).toBe(2);
    expect(banc.getState().screen).toBe('interlude');
  });

  it('en combat : refusé', () => {
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.getState().ouvrirLInterlude(1);
    draineCascade(banc.getState); // les dés d'Événement sont des étapes de séquence : elle se joue avant les Activités
    expect(banc.getState().interlude).toBeNull();
  });

  it('règle interlude-actif OFF : l’effet interlude est ignoré silencieusement', () => {
    setRule('interlude-actif', false);
    applyEffects(banc.getState, banc.setState, [{ type: 'interlude', weeks: 2 }]);
    expect(banc.getState().interlude).toBeNull();
    resetRule('interlude-actif');
  });

  it('interlude-devoir-elfique (défaut) : un elfe ≥3 semaines perd 1 Activité (devoir)', () => {
    const elf = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'E', seed: 3 });
    elf.species = 'hauts-elfes';
    banc.setState({ party: [elf], interlude: null });
    banc.getState().ouvrirLInterlude(3);
    draineCascade(banc.getState); // les dés d'Événement sont des étapes de séquence : elle se joue avant les Activités
    const st = banc.getState().interlude!.perHero[elf.id];
    const ev = eventOf(st);
    expect(st.left).toBe(Math.max(0, 3 - (ev.fx?.loseActivity ? 1 : 0) - 1)); // −1 devoir elfique
  });

  it('interlude-devoir-elfique OFF : l’elfe garde son Activité', () => {
    setRule('interlude-devoir-elfique', false);
    const elf = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'E', seed: 3 });
    elf.species = 'hauts-elfes';
    banc.setState({ party: [elf], interlude: null });
    banc.getState().ouvrirLInterlude(3);
    draineCascade(banc.getState); // les dés d'Événement sont des étapes de séquence : elle se joue avant les Activités
    const st = banc.getState().interlude!.perHero[elf.id];
    const ev = eventOf(st);
    expect(st.left).toBe(Math.max(0, 3 - (ev.fx?.loseActivity ? 1 : 0))); // pas de devoir
    resetRule('interlude-devoir-elfique');
  });

  it('le devoir suit le groupe `elfe` de l’espèce (`grantGroups`), pas son id : groupe retiré → pas de devoir', () => {
    setDataset('species', species.map((s) => (s.id === 'hauts-elfes' ? { ...s, grantGroups: s.grantGroups.filter((g) => g !== 'elfe') } : s)));
    const elf = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'E', seed: 3 });
    elf.species = 'hauts-elfes';
    banc.setState({ party: [elf], interlude: null });
    banc.getState().ouvrirLInterlude(3);
    draineCascade(banc.getState);
    const st = banc.getState().interlude!.perHero[elf.id];
    const ev = eventOf(st);
    resetData();
    expect(st.left).toBe(Math.max(0, 3 - (ev.fx?.loseActivity ? 1 : 0)));
  });
});
