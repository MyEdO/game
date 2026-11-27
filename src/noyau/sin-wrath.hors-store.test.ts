/**
 * Points de Péché & Colère des dieux — câblage du noyau. LDB 40 l.36, l.46 ; LDB 41 l.17 ; #5056
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { applyEffects } from './combatEffects';
import { avanceEtapeCascade, draineEtLit } from './cascade.testkit';
import { groupeDeScenario } from '../scenes/test-scenarios/_heros';
import type { Combatant } from '../engine/types';
import type { CastResult } from '../engine/magic';
import { resetRule, setRule } from '../engine/policy';
import { entreeEnRencontre } from '../engine/persistence';
import { liveTableDecl } from './cascade';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

function priestParty(sin: number) {
  const [priest, ally] = groupeDeScenario(idsDeTest, 'pretre', 'soldat');
  const priere = priest.skills.find((s) => s.id === 'priere');
  if (priere) priere.advances = Math.max(priere.advances, 5);
  else priest.skills.push({ id: 'priere', characteristic: 'sociabilite', advances: 5 });
  priest.sinPoints = sin;
  return { priest, ally, party: [priest, ally] as Combatant[] };
}

/** Pose un pendingCast au résultat FIGÉ (jet contrôlé) puis « Appliquer ». */
function confirmPrayerWithRoll(casterId: string, targetId: string, roll: number, ok = true) {
  const result: CastResult = {
    cast: ok, roll, target: 60, sl: ok ? 1 : -1, isCritical: false, isFumble: false,
    log: ok ? 'Prière exaucée.' : 'Prière échouée.',
  };
  banc.setState({
    pendingCast: { casterId, targetId, spellId: 'benediction-de-guerison', missile: false, result },
  });
  banc.getState().jetValider('incantation');
}

describe('Péché et Colère Divine (LDB 40)', () => {
  beforeEach(() => {
    banc.setState({ battle: null, pendingCast: null, pendingCascade: null, party: [], journal: [] });
    banc.getState().ensemencerLeTirage(11);
  });

  it('unités ≤ Péchés sur Prière RÉUSSIE → l\'effet s\'applique ET la Colère frappe, Péché −1 (l.36, l.46)', () => {
    const { priest, ally, party } = priestParty(3);
    ally.wounds.current = ally.wounds.max - 3;
    banc.setState({ party });
    const before = ally.wounds.current;
    confirmPrayerWithRoll(priest.id, ally.id, 42); // unités 2 ≤ 3 Péchés
    // Le dé de la Colère est une ÉTAPE : elle se joue, et ce qu'elle rend au joueur vit sur elle
    // (révélation) autant que dans le journal.
    const rendu = draineEtLit(banc.getState).join('\n');
    const after = banc.getState().party.find((h) => h.id === ally.id)!;
    expect(after.wounds.current).toBe(before + 1); // la Bénédiction se manifeste quand même
    expect(rendu).toMatch(/Colère des dieux/);
    expect(rendu).toMatch(/Péché expié/);
    expect(banc.getState().party.find((h) => h.id === priest.id)!.sinPoints).toBe(2);
  });

  it('unités > Péchés → aucune Colère, Péchés intacts', () => {
    const { priest, ally, party } = priestParty(3);
    banc.setState({ party });
    confirmPrayerWithRoll(priest.id, ally.id, 45); // unités 5 > 3
    expect(banc.getState().journal.map((e) => e.texte).join('\n')).not.toMatch(/Colère des dieux/);
    expect(banc.getState().party.find((h) => h.id === priest.id)!.sinPoints).toBe(3);
  });

  it('à 0 Péché, un jet en -0 ne déclenche rien', () => {
    const { priest, ally, party } = priestParty(0);
    banc.setState({ party });
    confirmPrayerWithRoll(priest.id, ally.id, 30); // unités 0, 0 Péché
    expect(banc.getState().journal.map((e) => e.texte).join('\n')).not.toMatch(/Colère des dieux/);
  });

  it('Maladresse de Prière : UNE seule Colère (pas de double déclenchement unités+Maladresse), Péché −1', () => {
    const { priest, ally, party } = priestParty(2);
    banc.setState({ party });
    const result: CastResult = { cast: false, roll: 22, target: 20, sl: -1, isCritical: false, isFumble: true, log: 'Maladresse !' };
    banc.setState({
      pendingCast: { casterId: priest.id, targetId: ally.id, spellId: 'benediction-de-guerison', missile: false, result },
    });
    banc.getState().jetValider('incantation');
    draineEtLit(banc.getState);
    // Le journal dit chaque jet de table une fois, que la révélation le montre ou non (#4787).
    expect(banc.getState().journal.map((e) => e.texte).join('\n').match(/Colère des dieux \(/g)?.length).toBe(1); // un seul JET de table
    expect(banc.getState().party.find((h) => h.id === priest.id)!.sinPoints).toBe(1);
  });

  it('le jet de Colère est décalé de +10 par Péché (l.46) — observable via le dé de l\'étape', () => {
    const { priest, ally, party } = priestParty(5);
    banc.setState({ party });
    confirmPrayerWithRoll(priest.id, ally.id, 41); // unités 1 ≤ 5
    // Le dé de la Colère tombe au rang de SON étape ; la révélation (charge riche `reveal`) suit dans
    // la MÊME séquence — on joue jusqu'à elle.
    for (let i = 0; i < 6 && !banc.getState().pendingCascade?.participants.some((s) => s.kind === 'incantationImparfaite'); i++) {
      avanceEtapeCascade(banc.getState);
    }
    const step = banc.getState().pendingCascade?.participants.find((s) => s.kind === 'incantationImparfaite');
    expect(step?.reveal?.kind).toBe('incantationImparfaite');
    // d100 ∈ [1;100] + 5×10 → le jet effectif est forcément > 50.
    expect(step!.reveal!.dice).toBeGreaterThan(50);
  });

  it('Effet d\'éditeur giveSin : cible le héros désigné, sinon le premier sachant Prier', () => {
    const { priest, ally } = priestParty(0);
    banc.setState({ party: [ally, priest].map((h) => ({ ...h })) as Combatant[] }); // l'allié d'abord
    applyEffects(banc.getState, banc.setState, [{ type: 'giveSin', amount: 2 }]);
    expect(banc.getState().party.find((h) => h.id === priest.id)!.sinPoints).toBe(2); // pas l'allié
    applyEffects(banc.getState, banc.setState, [{ type: 'giveSin', amount: 1, heroId: ally.id }]);
    expect(banc.getState().party.find((h) => h.id === ally.id)!.sinPoints).toBe(1);
  });
});

describe('Petits soucis : la même Prière réussie sur la même cible dans la rencontre (LDB 41 l.17 ; #5056)', () => {
  beforeEach(() => {
    banc.setState({ battle: null, pendingCast: null, pendingCascade: null, party: [], journal: [] });
    banc.getState().ensemencerLeTirage(11);
  });
  const peche = (id: string) => banc.getState().party.find((h) => h.id === id)!.sinPoints ?? 0;

  it('la 2e sur la même cible donne le Péché de la règle, avec sa ligne de récit', () => {
    const { priest, ally, party } = priestParty(0);
    banc.setState({ party });
    confirmPrayerWithRoll(priest.id, ally.id, 45);
    expect(peche(priest.id)).toBe(0);
    confirmPrayerWithRoll(priest.id, ally.id, 45);
    expect(peche(priest.id)).toBe(1);
    expect(banc.getState().journal.map((e) => e.texte).join('\n')).toMatch(/a péché contre son dieu : \+1 Point\(s\) de Péché/);
  });

  it('le décompte se fait par cible', () => {
    const { priest, ally, party } = priestParty(0);
    banc.setState({ party });
    confirmPrayerWithRoll(priest.id, ally.id, 45);
    confirmPrayerWithRoll(priest.id, priest.id, 45);
    expect(peche(priest.id)).toBe(0);
  });

  it('un Test raté ne compte pas et ne consigne pas', () => {
    const { priest, ally, party } = priestParty(0);
    banc.setState({ party });
    confirmPrayerWithRoll(priest.id, ally.id, 85, false);
    confirmPrayerWithRoll(priest.id, ally.id, 45);
    expect(peche(priest.id)).toBe(0);
    confirmPrayerWithRoll(priest.id, ally.id, 85, false);
    expect(peche(priest.id)).toBe(0);
  });

  it('la Colère de ce Test lit le Péché d\'avant (LDB 40 l.36)', () => {
    const { priest, ally, party } = priestParty(1);
    banc.setState({ party });
    confirmPrayerWithRoll(priest.id, ally.id, 45);
    confirmPrayerWithRoll(priest.id, ally.id, 42); // unités 2 > 1 Péché d'avant, ≤ 2 d'après
    expect(banc.getState().journal.map((e) => e.texte).join('\n')).not.toMatch(/Colère des dieux/);
    expect(peche(priest.id)).toBe(2);
  });

  it('la Colère de ce Test compte le Péché ajouté dans son +10 (LDB 40 l.46)', () => {
    const { priest, ally, party } = priestParty(1);
    banc.setState({ party });
    confirmPrayerWithRoll(priest.id, ally.id, 45);
    confirmPrayerWithRoll(priest.id, ally.id, 41); // unités 1 ≤ 1 Péché d'avant
    const s = banc.getState();
    const step = s.pendingCascade?.participants.find((p) => p.kind === 'tableDIncantationImparfaite');
    expect(step).toBeDefined();
    expect(liveTableDecl(s, step!).mod).toBe(20);
  });

  it('une Colère due à un Test suivant compte le Péché ajouté dans son seuil (LDB 40 l.36)', () => {
    const { priest, ally, party } = priestParty(0);
    banc.setState({ party });
    confirmPrayerWithRoll(priest.id, ally.id, 45);
    confirmPrayerWithRoll(priest.id, ally.id, 45);
    confirmPrayerWithRoll(priest.id, priest.id, 41); // unités 1 ≤ 1 Péché
    expect(banc.getState().journal.map((e) => e.texte).join('\n')).toMatch(/Colère des dieux/);
  });

  it('à la rencontre suivante, le compteur repart de zéro', () => {
    const { priest, ally, party } = priestParty(0);
    banc.setState({ party });
    confirmPrayerWithRoll(priest.id, ally.id, 45);
    const pretre = banc.getState().party.find((h) => h.id === priest.id)!;
    banc.setState({ party: [entreeEnRencontre(pretre, { lignes: [], faits: [] }), ally] });
    confirmPrayerWithRoll(priest.id, ally.id, 45);
    expect(peche(priest.id)).toBe(0);
  });

  it('règle à 0 : aucun Péché', () => {
    setRule('priere-repetee-peche', 0);
    try {
      const { priest, ally, party } = priestParty(0);
      banc.setState({ party });
      confirmPrayerWithRoll(priest.id, ally.id, 45);
      confirmPrayerWithRoll(priest.id, ally.id, 45);
      expect(peche(priest.id)).toBe(0);
    } finally {
      resetRule('priere-repetee-peche');
    }
  });
});
