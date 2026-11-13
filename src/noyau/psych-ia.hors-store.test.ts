import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { openRoundStartPsych } from './combatFlow';
import { fearSourceFor, sourceCombattant } from '../engine/psychology';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';
import { blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { setRule, resetRule } from '../engine/policy';
import { ciblePsy } from '../engine/psych/ciblage';
import { groupesPercus } from '../engine/groups';
import { groupLabel } from '../data';
import { t } from '../i18n';
import { nomDe } from '../engine/nom';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

describe('Psychologie IA (Terreur au début du Round, LDB 21 l.9, l.54-56)', () => {
  beforeEach(() => {
    banc.setState({ battle: null });
  });

  it('fearSourceFor : Énorme AGRESSIVE vs Moyenne → Terreur 2 ; statbloc Peur 4 ; rien si pas de source', () => {
    const big = { id: 'b', kind: 'ennemi', size: 'enorme' } as Combatant; // adversaire → agressive (LDB 85 l.381-383)
    const med = { id: 'm', kind: 'heros', size: 'moyenne' } as Combatant;
    expect(fearSourceFor(med, sourceCombattant(big))).toEqual({ kind: 'terreur', indice: 2 });
    expect(fearSourceFor(med, sourceCombattant({ id: 'p', kind: 'ennemi', size: 'moyenne', causesPeur: 4 } as Combatant))).toEqual({ kind: 'peur', indice: 4 });
    expect(fearSourceFor(med, sourceCombattant(med))).toBeNull();
  });

  function setup() {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'heros')!;
    const E = b.combatants.find((c) => c.kind === 'ennemi')!;
    b.combatants.filter((c) => c.kind === 'ennemi' && c.id !== E.id).forEach((e) => (e.dead = true));
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 11, y: 10 }; // adjacent → Ligne de Vue dégagée
    banc.setState({ battle: { ...b } });
    return { H, E };
  }

  it('un ennemi face à un héros Énorme (Terreur) gagne Brisé + une Peur en psychState', () => {
    banc.getState().ensemencerLeTirage(2);
    const { H, E } = setup();
    H.size = 'enorme'; // gap 2 → Terreur 2
    E.characteristics['force-mentale'] = 10; // Test de Calme raté → Brisé
    openRoundStartPsych(banc.getState, banc.setState);
    const e = banc.getState().battle!.combatants.find((c) => c.id === E.id)!;
    expect(e.conditions.some((c) => c.id === 'brise')).toBe(true);
    expect((e.psychState ?? []).some((p) => p.type === 'peur' && p.sourceId === H.id)).toBe(true);
  });

  /** L'ennemi (FM 10) face au héros Énorme (Terreur 2), règle allumée : rate son Calme et devient Brisé. */
  const ennemiTerrifie = (regles: boolean | undefined) => {
    banc.getState().ensemencerLeTirage(2);
    const { H, E } = setup();
    H.size = 'enorme';
    E.characteristics['force-mentale'] = 10;
    E.followsCharacterRules = regles;
    setRule('psycho-acquisition-optionnelle', true);
    try {
      openRoundStartPsych(banc.getState, banc.setState);
    } finally {
      resetRule('psycho-acquisition-optionnelle');
    }
    const e = banc.getState().battle!.combatants.find((c) => c.id === E.id)!;
    expect(e.conditions.find((c) => c.id === 'brise')!.value, 'au-delà du Bonus de FM 1').toBeGreaterThan(1);
    return { e, H };
  };

  it('un ennemi qui ne suit pas les règles de Personnage ne mémorise pas sa Terreur (ADE II 09 l.9)', () => {
    const { e } = ennemiTerrifie(undefined);
    expect(e.terreursSubies).toBeUndefined();
    expect((e.psychTraits ?? []).filter((p) => p.type === 'phobie')).toEqual([]);
  });

  it('un ennemi qui suit les règles de Personnage (`followsCharacterRules`) la mémorise (ADE II 09 l.9)', () => {
    const { e, H } = ennemiTerrifie(true);
    const phobies = (e.psychTraits ?? []).filter((p) => p.type === 'phobie');
    expect(phobies).toHaveLength(1);
    expect(groupesPercus(H).map((g) => ciblePsy.groupe(g))).toContain(phobies[0].cible);
    expect(e.terreursSubies).toEqual([]);
  });

  it('un héros sous contrôle de l’IA est un Personnage : sa Terreur subie se mémorise (ADE II 09 l.9)', () => {
    banc.getState().ensemencerLeTirage(2);
    const { H, E } = setup();
    E.size = 'enorme';
    H.aiControlled = true;
    H.characteristics['force-mentale'] = 10;
    H.terreursSubies = [];
    setRule('psycho-acquisition-optionnelle', true);
    try {
      openRoundStartPsych(banc.getState, banc.setState);
    } finally {
      resetRule('psycho-acquisition-optionnelle');
    }
    const h = banc.getState().battle!.combatants.find((c) => c.id === H.id)!;
    const brise = h.conditions.find((c) => c.id === 'brise')?.value ?? 0;
    expect(brise).toBeGreaterThan(0);
    expect(E.groups).toEqual(['cultiste']);
    expect(h.psychTraits, 'au-delà du Bonus de FM 1 : la Phobie de sa cause').toEqual([{ type: 'phobie', cible: ciblePsy.groupe('cultiste') }]);
    expect(h.terreursSubies).toEqual([]);
    expect(banc.getState().battle!.log.map((l) => l.text)).toContain(t('cf.phobieAcquise', { name: nomDe(h), groupe: groupLabel('cultiste') }));
  });

  it('un ennemi Immunité (Psychologie) n’est pas affecté', () => {
    const { H, E } = setup();
    H.size = 'monstrueuse';
    E.psychImmune = true;
    openRoundStartPsych(banc.getState, banc.setState);
    const e = banc.getState().battle!.combatants.find((c) => c.id === E.id)!;
    expect(e.conditions.some((c) => c.id === 'brise')).toBe(false);
    expect(e.psychState ?? []).toEqual([]);
  });

  /**
   * #1231 — Belliqueux (LDB 85 l.51) : « Tant qu'elle a plus d'Avantages que son adversaire ». Son
   * adversaire se lit à l'Engagement (LDB 13 l.169-171, symétrique), pas au camp : une créature engagée
   * contre un membre de SON camp, avec plus d'Avantages que lui, gagne bien l'Immunité Psychologique.
   */
  it('Belliqueux : l’adversaire ENGAGÉ du même camp compte — plus d’Avantages que lui ⇒ immunité psy', () => {
    banc.getState().ensemencerLeTirage(2);
    const { H, E } = setup();
    H.size = 'enorme'; // Terreur 2 pour E s'il n'est pas immunisé
    E.characteristics['force-mentale'] = 10; // Calme raté à coup sûr
    E.traits = [...(E.traits ?? []), { id: 'belliqueux' }];
    E.advantage = 2;
    const rival = banc.getState().battle!.combatants.find((c) => c.kind === 'ennemi' && c.id !== E.id)!;
    rival.dead = false; rival.wounds = blessuresDeBase(10, 10, rival); rival.advantage = 0; rival.pos = { x: 12, y: 10 };
    E.engagedWith = [rival.id]; rival.engagedWith = [E.id]; // camarades qui en viennent aux mains
    banc.setState({ battle: { ...banc.getState().battle! } });
    openRoundStartPsych(banc.getState, banc.setState);
    const e = banc.getState().battle!.combatants.find((c) => c.id === E.id)!;
    expect(e.conditions.some((c) => c.id === 'brise')).toBe(false);
    expect(e.psychState ?? []).toEqual([]);
  });
});
