/**
 * Catalogue d'Activités d'interlude data-driven (`activities.json`) — Activités d'Altdorf
 * (ACE 12 l.9-67) branchées dans le flux d'interlude :
 *  - gate géographique `where` résolu contre le lieu courant (carte du monde ↔ scène) ;
 *  - Pénitence : ±Péché (op sinMod), Exténué DIFFÉRÉ à la clôture, Maladresse → Colère des dieux ;
 *  - Tester des objets magiques : identification (voie ACE, coexiste avec l'ADE II) + Exposition ;
 *  - Entraînement d'arme inhabituelle : `masteredWeapons` ;
 *  - Mécénat : dépôt ≥ 5 CO, retrait par Test d'Évaluation (bandes payoutPct) ;
 *  - Recherche universitaire : mémorisation avec remise (achat immédiat).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { draineCascade } from './cascadeTestKit';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { toBrass, fromBrass, PA_PER_CO } from '../engine/money';
import { partyMoneyTotal, creditBourse } from './bourseFlow';
import { hasCondition } from '../engine/conditions';
import { spells } from '../data';
import { testScene } from '../scenes/test-fixture';
import type { WorldMap } from './worldMap';

const ALTDORF_MAP: WorldMap = {
  id: 'w', label: 'Monde de test',
  places: [{ id: 'altdorf', label: 'Altdorf', pos: { x: 50, y: 50 }, scene: testScene.id }],
  routes: [],
};

describe('Catalogue d’Activités d’interlude (ACE Annexe I, data-driven)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    const a = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', rng: makeRNG(1) });
    useGame.setState({ party: [a], battle: null, interlude: null, bank: [], pendingOrders: [], pendingActivity: null, pendingCorruption: null, journal: [] });
    useGame.getState().startScene(testScene);
    vi.clearAllTimers();
    useGame.setState({ worldMap: ALTDORF_MAP });
    creditBourse(useGame.getState, useGame.setState, useGame.getState().party[0].id, fromBrass(5000));
    useGame.getState().seedRng(13);
    useGame.getState().startInterlude(3);
    draineCascade(useGame.getState); // les dés d'Événement sont des étapes de séquence : elle se joue avant les Activités
    // Neutralise l'événement d100 tiré (on teste le catalogue, pas l'événement).
    const itl = useGame.getState().interlude!;
    itl.perHero[hero().id] = { ...st(), fx: undefined, left: 3 };
    useGame.setState({ interlude: { ...itl } });
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function hero() { return useGame.getState().party[0]; }
  function st() { return useGame.getState().interlude!.perHero[hero().id]; }
  const forceRoll = (roll: number, success: boolean, sl: number) => {
    useGame.getState().activityRoll();
    useGame.setState({ pendingActivity: { ...useGame.getState().pendingActivity!, roll, success, sl } });
    useGame.getState().activityConfirm();
  };

  it('gate `where` : hors d’Altdorf (pas de place liée à la scène), la Pénitence est indisponible', () => {
    useGame.setState({ worldMap: null });
    useGame.getState().interludeActivity(hero().id, 'penitence');
    expect(useGame.getState().pendingActivity).toBeNull();
    expect(useGame.getState().journal.join('\n')).toMatch(/praticable/);
  });

  it('Pénitence — succès : −1 Péché (−2 dès +4 DR), Activité consommée, note VERBATIM à l’écran', () => {
    hero().sinPoints = 3;
    useGame.getState().interludeActivity(hero().id, 'penitence');
    const pa = useGame.getState().pendingActivity;
    expect(pa?.kind).toBe('catalog');
    expect(pa?.activityId).toBe('penitence');
    expect(pa?.difficulty).toBe('accessible'); // « Test de Prière Accessible (+20) »
    forceRoll(5, true, 4);
    expect(hero().sinPoints).toBe(1); // « ou 2 sur un Succès Impressionnant (+4 DR) ou mieux »
    expect(st().left).toBe(2);
    expect(useGame.getState().journal.join('\n')).toMatch(/Point\(s\) de Péché/);
  });

  it('Pénitence — échec : Exténué DIFFÉRÉ à la clôture (posé APRÈS le repos, « premier jour de la prochaine aventure »)', () => {
    hero().sinPoints = 1;
    useGame.getState().interludeActivity(hero().id, 'penitence');
    forceRoll(97, false, -2);
    expect(hero().sinPoints).toBe(1); // l'échec n'expie rien
    expect(hasCondition(hero(), 'extenue')).toBe(false); // rien MAINTENANT (serait dissipé au repos)
    expect(st().closeOps).toEqual([{ op: 'condition', id: 'extenue' }]);
    useGame.getState().interludeEnd();
    expect(hasCondition(hero(), 'extenue')).toBe(true); // posé après les nuits de clôture
  });

  it('Pénitence — Maladresse : Colère des dieux « à la place » (table LDB 40, −1 Péché expié), pas d’Exténué', () => {
    hero().sinPoints = 2;
    useGame.getState().interludeActivity(hero().id, 'penitence');
    const parquees = useGame.getState().suspendedCascades.length;
    forceRoll(44, false, -1); // 44 = double raté → Maladresse
    // Le tirage sur la table de la Colère est une étape de la séquence (#1426) : c'est en la jouant
    // que le contrecoup se dénoue — et donc que le Péché s'expie. HORS COMBAT, cette étape ne PARQUE
    // aucune séquence d'accueil : le contrecoup rejoint ce qui est en vol, il ne l'évince pas.
    expect(useGame.getState().suspendedCascades.length, 'le contrecoup a parqué une séquence hors combat').toBe(parquees);
    draineCascade(useGame.getState);
    expect(useGame.getState().suspendedCascades.length).toBe(parquees);
    const journal = useGame.getState().journal.join('\n');
    expect(journal).toMatch(/Colère/);
    expect(st().closeOps).toBeUndefined(); // « à la place » : l'issue d'échec ne tombe pas
    expect(hero().sinPoints).toBe(1); // « réduisez vos Points de Péché de 1 » (LDB 40 l.46)
  });

  // ── Tester des objets magiques (voie ACE — coexiste avec l'identification ADE II) ────────────────
  function armArtefact() {
    const h = hero();
    h.items = [...(h.items ?? []), { uid: 'art1', name: 'Amulette étrange', kind: 'trapping', qualities: [], enc: 0, equipped: false, identified: false } as never];
    useGame.setState({ party: [...useGame.getState().party] });
  }
  const artefact = () => hero().items!.find((i) => i.uid === 'art1')!;

  it('Tester des objets : ≥ +4 DR → étude en profondeur (identifié, Particularités révélées)', () => {
    armArtefact();
    useGame.getState().interludeActivity(hero().id, 'tester-objets-magiques', { itemUid: 'art1' });
    expect(useGame.getState().pendingActivity?.kind).toBe('catalog');
    forceRoll(3, true, 5);
    expect(artefact().identified).toBe(true);
    expect(artefact().magicKnown).toBe(true);
    expect(st().left).toBe(2);
  });

  it('Tester des objets : succès ≤ +3 → fonction principale (magicKnown), pas les règles complètes', () => {
    armArtefact();
    useGame.getState().interludeActivity(hero().id, 'tester-objets-magiques', { itemUid: 'art1' });
    forceRoll(20, true, 2);
    expect(artefact().identified).toBe(false);
    expect(artefact().magicKnown).toBe(true);
  });

  it('Tester des objets : ≤ −4 DR → contamination : Test d’Exposition mineure à la Corruption (modale)', () => {
    armArtefact();
    useGame.getState().interludeActivity(hero().id, 'tester-objets-magiques', { itemUid: 'art1' });
    forceRoll(98, false, -5);
    const pc = useGame.getState().pendingCorruption;
    expect(pc?.level).toBe('mineure');
    expect(pc?.skill).toBe('resistance');
    expect(artefact().identified).toBe(false);
  });

  // ── Entraînement avec une arme inhabituelle ────────────────────────────────────────────────────
  function armUnusualWeapon() {
    const h = hero();
    h.items = [...(h.items ?? []), {
      uid: 'wm1', trappingId: 'couteau-de-harald', name: 'Couteau de Harald', kind: 'melee',
      qualities: [], enc: 0, equipped: false, requiresMastery: true,
    } as never];
    useGame.setState({ party: [...useGame.getState().party] });
  }

  it('Entraînement : la compétence est IMPOSÉE par l’arme ; le succès inscrit la maîtrise (masteredWeapons)', () => {
    armUnusualWeapon();
    useGame.getState().interludeActivity(hero().id, 'entrainement-arme-inhabituelle', { itemUid: 'wm1' });
    const pa = useGame.getState().pendingActivity;
    expect(pa?.kind).toBe('catalog');
    expect(pa?.skillLabel).toMatch(/Corps à corps/); // arme de mêlée → CC imposé (« selon la spécialisation de l'arme »)
    expect(pa?.difficulty).toBe('complexe'); // « Complexe (−10) »
    forceRoll(4, true, 2);
    expect(hero().masteredWeapons).toEqual(['couteau-de-harald']);
    expect(st().left).toBe(2);
  });

  it('Entraînement : l’échec ne maîtrise rien (« attendre le prochain moment de pause ») ; arme ordinaire refusée', () => {
    armUnusualWeapon();
    useGame.getState().interludeActivity(hero().id, 'entrainement-arme-inhabituelle', { itemUid: 'wm1' });
    forceRoll(96, false, -3);
    expect(hero().masteredWeapons ?? []).toEqual([]);
    // Une arme SANS requiresMastery n'est pas une cible d'entraînement.
    const ordinary = hero().items!.find((i) => i.uid !== 'wm1' && (i.kind === 'melee' || i.kind === 'ranged'));
    if (ordinary) {
      useGame.getState().interludeActivity(hero().id, 'entrainement-arme-inhabituelle', { itemUid: ordinary.uid });
      expect(useGame.getState().pendingActivity).toBeNull();
    }
  });

  // ── Mécénat (variante d'Opération bancaire) ────────────────────────────────────────────────────
  it('Mécénat : mise minimale 5 CO ; dépôt puis retrait par Test d’Évaluation — +6 DR = 120 %', () => {
    const h = hero();
    useGame.getState().interludeBank(h.id, 'mecenat', 100); // < 5 CO → refus
    expect(useGame.getState().bank).toHaveLength(0);
    expect(useGame.getState().journal.join('\n')).toMatch(/mise minimale/);
    const stake = 5 * PA_PER_CO;
    useGame.getState().interludeBank(h.id, 'mecenat', stake);
    expect(useGame.getState().bank).toEqual([{ heroId: h.id, kind: 'mecenat', brass: stake, rate: 0 }]);
    expect(st().left).toBe(2);
    const before = toBrass(partyMoneyTotal(useGame.getState));
    useGame.getState().interludeWithdraw(0);
    const pa = useGame.getState().pendingActivity;
    expect(pa?.kind).toBe('catalog');
    expect(pa?.depositIndex).toBe(0);
    expect(pa?.skillLabel).toMatch(/valuation/); // Test d'Évaluation
    forceRoll(2, true, 6);
    expect(useGame.getState().bank).toHaveLength(0);
    expect(toBrass(partyMoneyTotal(useGame.getState))).toBe(before + Math.floor(stake * 1.2)); // « profit de 20 % »
    expect(st().left).toBe(1); // le retrait a coûté une Activité
  });

  it('Mécénat : échec du Test d’Évaluation = investissement perdu (payout 0)', () => {
    const h = hero();
    const stake = 5 * PA_PER_CO;
    useGame.getState().interludeBank(h.id, 'mecenat', stake);
    const before = toBrass(partyMoneyTotal(useGame.getState));
    useGame.getState().interludeWithdraw(0);
    forceRoll(97, false, -1);
    expect(useGame.getState().bank).toHaveLength(0);
    expect(toBrass(partyMoneyTotal(useGame.getState))).toBe(before); // rien ne revient
    expect(useGame.getState().journal.join('\n')).toMatch(/perd son investissement/);
  });

  // ── Recherche universitaire ────────────────────────────────────────────────────────────────────
  it('Recherche universitaire : chaque +DR = −100 PX sur la mémorisation d’UN sort (plancher 100), achat immédiat', () => {
    const h = hero();
    h.talents.push({ talentId: 'magie-des-arcanes', spec: 'feu', times: 1 } as never);
    const feu = spells.filter((s) => s.family === 'arcane' && s.subType === 'Feu').map((s) => s.id);
    // BInt de A (Int ~30) = 3 → avec 4 sorts d'Arcane connus, le prochain coûte 100 × ⌈4/3⌉ = 200 PX.
    h.spells = feu.slice(0, 4);
    h.xp = 500;
    useGame.setState({ party: [...useGame.getState().party] });
    useGame.getState().interludeActivity(h.id, 'recherche-universitaire', { spellId: feu[4] });
    const pa = useGame.getState().pendingActivity;
    expect(pa?.kind).toBe('catalog');
    expect(pa?.spellId).toBe(feu[4]);
    forceRoll(10, true, 1); // +1 DR → remise 100 : 200 − 100 = 100 PX
    expect(hero().spells).toContain(feu[4]);
    expect(hero().xp).toBe(400);
    expect(useGame.getState().journal.join('\n')).toMatch(/remise de 100 PX/);
    expect(st().left).toBe(2);
  });

  it('Recherche universitaire : sans sort payant à mémoriser, l’Activité ne s’ouvre pas', () => {
    useGame.getState().interludeActivity(hero().id, 'recherche-universitaire', { spellId: 'drain' });
    expect(useGame.getState().pendingActivity).toBeNull(); // soldat sans Talent de lanceur
  });

  it('les DEUX voies d’identification coexistent : ADE II (Savoir Magie) ET ACE (Recherche, à Altdorf)', () => {
    armArtefact();
    const h = hero();
    h.skills.push({ id: 'savoir', spec: 'magie', characteristic: 'intelligence', advances: 10 } as never);
    useGame.getState().interludeActivity(h.id, 'identify', { itemUid: 'art1' }); // voie ADE II (Savoir Magie)
    expect(useGame.getState().pendingActivity?.activityId).toBe('identify');
    useGame.getState().activityCancel();
    useGame.getState().interludeActivity(h.id, 'tester-objets-magiques', { itemUid: 'art1' }); // voie ACE
    expect(useGame.getState().pendingActivity?.kind).toBe('catalog');
  });
});
