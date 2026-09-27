import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { draineCascade } from './cascadeTestKit';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { fleeReachable } from './path';
import { emptyScene } from './scene';
import { stacks, hasCondition, COND } from '../engine/conditions';
import { fleeBackstab, fleeCalme, fleeNeedCalme } from './pendings';
import { intentAllowedFor, modalOwnerOf } from './netOwnership';

describe('fleeReachable — Fuite dans la direction OPPOSÉE à l’adversaire (LDB 15 l.68)', () => {
  const scene = emptyScene(14, 14);
  const has = (m: Map<string, number>, x: number, y: number) => m.has(`${x},${y}`);
  it('exclut les cases qui RAPPROCHENT de l’adversaire, garde celles qui s’en éloignent', () => {
    const m = fleeReachable(scene, { x: 6, y: 6 }, { x: 6, y: 4 }, 4, { blocked: new Set() }); // adversaire au NORD (Tchebychev 2)
    expect(has(m, 6, 9)).toBe(true); // plein SUD : s'éloigne → permise
    expect(has(m, 6, 5)).toBe(false); // vers le NORD : rapproche → exclue
    expect(has(m, 6, 4)).toBe(false); // la case du foe : exclue
    expect(has(m, 8, 6)).toBe(true); // latérale à distance égale (Tchebychev 2) : ne rapproche pas → permise
  });
  it('bornée au range de Course passé', () => {
    const m = fleeReachable(scene, { x: 6, y: 6 }, { x: 6, y: 4 }, 4, { blocked: new Set() });
    expect(has(m, 6, 6)).toBe(true); // origine
    expect(has(m, 6, 12)).toBe(false); // 6 cases au sud > range 4 → hors de portée
  });
});

// Fuite (LDB 15 l.63-66) : le coup dans le dos du frappeur et le Test de Calme du fuyard sont DEUX
// jets du flux `flee` ; la complétion de la fuite est DIFFÉRÉE jusqu'au « Appliquer ».
describe('Fuite intégrée à la modale (store)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ pendingDisengage: null, pendingCascade: null, battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('Fuir : coup dans le dos (témoin IA) + Test de Calme DIFFÉRÉ (flux flee) ; fuite complétée au confirm, sans révélation', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().seedRng(2);
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    E.characteristics['capacite-de-combat'] = 90; // le coup dans le dos (+20) touche à coup sûr
    H.wounds = { current: 40, max: 40, base: 40 } as never;
    H.engagedWith = [E.id];
    E.engagedWith = [H.id];
    useGame.setState({
      battle: { ...b },
      pendingDisengage: { moverId: H.id, foeId: E.id, canSacrifice: false, phase: 'choice', atk: null, def: null, result: null },
    });

    useGame.getState().disengageFlee();

    const pdf = useGame.getState().pendingDisengage!;
    expect(pdf).toBeTruthy();
    expect(pdf.phase).toBe('fuir');
    const bs = fleeBackstab(pdf)!;
    expect(bs.interactive).toBe(false); // frappeur IA → rangée témoin, auto-roulée
    expect(bs.result!.hit).toBe(true); // CC 90 +20 → touche
    expect(bs.result!.woundsLost).toBeGreaterThan(0);
    expect(fleeCalme(pdf)!.calme).toBeNull(); // touché → Test de Calme DIFFÉRÉ (jet influençable en attente)
    // Blessures NON encore appliquées, fuite NON complétée : tout attend le « Appliquer ».
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.wounds.current).toBe(40);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.engagedWith).toEqual([E.id]);

    // Le Test de Calme passe par le flux `flee` (jet INFLUENÇABLE) : Lancer puis Appliquer.
    useGame.getState().fleeRoll(H.id);
    expect(fleeCalme(useGame.getState().pendingDisengage!)!.calme).toBeTruthy(); // Calme résolu
    useGame.getState().fleeConfirm();

    // « Appliquer » applique le coup dans le dos puis complète la fuite (libération + Course).
    const after = useGame.getState();
    expect(after.pendingDisengage).toBeNull();
    expect(after.battle!.combatants.find((c) => c.id === H.id)!.wounds.current).toBeLessThan(40);
    expect(after.battle!.combatants.find((c) => c.id === H.id)!.engagedWith).toEqual([]); // libéré de tous les Engagements
    expect(after.battle!.reachable.size).toBeGreaterThan(0); // budget de Course posé
  });

  it("Fuir — Chance « +1 DR » réduit le nombre d'États Brisés sans réécrire `success` (LDB 17 l.24 ; LDB 12 l.11)", () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().seedRng(2);
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    H.fortune = 2;
    H.wounds = { current: 40, max: 40, base: 40 } as never;
    H.engagedWith = [E.id];
    E.engagedWith = [H.id];
    // Phase 'fuir' avec un coup dans le dos FIGÉ (4 PB) et un Test de Calme RATÉ figé (DR -2 → 3 États Brisés).
    useGame.setState({
      battle: { ...b },
      pendingDisengage: {
        moverId: H.id, foeId: E.id, canSacrifice: false, phase: 'fuir', atk: null, def: null, result: null,
        fuir: {
          participants: [
            { id: E.id, kind: 'backstab', interactive: false, result: { hit: true, attackerRoll: 30, netSL: 1, location: 'corps', damage: 4, woundsLost: 4, critical: false, advantageTo: 'attacker', defenderDefeated: false, log: 'dans le dos' } },
            { id: H.id, kind: 'calme', interactive: true, calme: { success: false, roll: 70, target: 50, sl: -2 } },
          ],
        },
      },
    });

    // Chance « +1 DR » : DR -2 → -1 ; l'échec NE bascule PAS en réussite (1 Point de Chance dépensé).
    useGame.getState().fleeBonusSL(H.id);
    let st = useGame.getState();
    expect(fleeCalme(st.pendingDisengage!)!.calme!.sl).toBe(-1);
    expect(fleeCalme(st.pendingDisengage!)!.calme!.success).toBe(false);
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.fortune).toBe(1);

    // « Appliquer » : broken = 1 + max(0, 1) = 2 États Brisés (au lieu de 3 sans le +1 DR).
    useGame.getState().fleeConfirm();
    st = useGame.getState();
    expect(stacks(st.battle!.combatants.find((c) => c.id === H.id)!, COND.brise)).toBe(2);
    expect(st.pendingDisengage).toBeNull();
  });
});

// ── Fuir — le coup dans le dos passe par le FLUX canonique (#918 lot A) ──────────────────────────
// Le coup dans le dos est une attaque de Corps à corps complète : ses conséquences RAW passent par
// l'applicateur canonique d'attaque. LDB 13 l.183 (Critique sur double réussi) et LDB 13 l.161
// (Points de Blessure perdus > total de l'adversaire → Blessure critique + À Terre).
describe('Fuir — coup dans le dos : flux canonique à 2 slots (LDB 15 l.63-66)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ pendingDisengage: null, pendingCascade: null, pendingFateSave: null, battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  /** Deux héros ENGAGÉS l'un contre l'autre (allié sous Frénésie/charme) : le frappeur est alors
   *  piloté-humain, ce qui rend son coup dans le dos INFLUENÇABLE (slot interactif). */
  function duelHeros(seed = 3) {
    const A = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
    const B = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'B', seed: 2 });
    useGame.setState({ party: [A, B] });
    useGame.getState().seedRng(seed);
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const heroes = b.combatants.filter((c) => c.kind === 'hero');
    const frappeur = heroes.find((c) => c.label === 'A')!;
    const fuyard = heroes.find((c) => c.label === 'B')!;
    frappeur.pos = { x: 6, y: 10 };
    fuyard.pos = { x: 7, y: 10 };
    frappeur.engagedWith = [fuyard.id];
    fuyard.engagedWith = [frappeur.id];
    fuyard.armour = { tete: 0, corps: 0, brasG: 0, brasD: 0, jambeG: 0, jambeD: 0 } as never;
    useGame.setState({
      battle: { ...b },
      pendingDisengage: { moverId: fuyard.id, foeId: frappeur.id, canSacrifice: false, phase: 'choice', atk: null, def: null, result: null },
    });
    return { frappeur, fuyard };
  }

  const live = (id: string) => useGame.getState().battle!.combatants.find((c) => c.id === id)!;

  it('DOUBLE réussi au coup dans le dos → Coup Critique appliqué au fuyard (LDB 13 l.183)', () => {
    const { frappeur, fuyard } = duelHeros(3);
    frappeur.characteristics['capacite-de-combat'] = 60;
    frappeur.resilience = 2;
    fuyard.wounds = { current: 60, max: 60, base: 60 } as never; // survit au Critique
    useGame.setState({ battle: { ...useGame.getState().battle! } });

    useGame.getState().disengageFlee();
    const pd = useGame.getState().pendingDisengage!;
    expect(pd.phase).toBe('fuir');
    const bs = fleeBackstab(pd)!;
    expect(bs.interactive).toBe(true); // le frappeur est piloté-humain → SON jet lui revient

    // Dé 11 CHOISI (Résilience, LDB 17 l.68) = double → Coup Critique, exactement comme le Piétinement.
    useGame.getState().fleeRoll(bs.id);
    useGame.getState().fleeForceSuccess(bs.id);
    useGame.getState().fleeSetForcedRoll(bs.id, 11);
    expect(fleeBackstab(useGame.getState().pendingDisengage!)!.result!.critical).toBe(true);

    const critBefore = live(fuyard.id).criticalWounds ?? 0;
    const pdAfter = useGame.getState().pendingDisengage!;
    if (fleeNeedCalme(pdAfter)) useGame.getState().fleeRoll(fleeCalme(pdAfter)!.id);
    useGame.getState().fleeConfirm();
    draineCascade(useGame.getState); // la sévérité du Critique se tire DANS la fenêtre (#1426)

    expect(live(fuyard.id).criticalWounds ?? 0).toBeGreaterThan(critBefore); // Blessure critique RAW appliquée
    expect(useGame.getState().pendingDisengage).toBeNull();
  });

  it('DÉPASSEMENT (PB perdus > PB restants) → Blessure critique ET À Terre (LDB 13 l.161)', () => {
    const { frappeur, fuyard } = duelHeros(4);
    fuyard.wounds = { current: 3, max: 30, base: 30 } as never;
    const pd = useGame.getState().pendingDisengage!;
    // Coup dans le dos NON critique (pas de double) mais qui dépasse les PB courants : 5 > 3.
    useGame.setState({
      battle: { ...useGame.getState().battle! },
      pendingDisengage: {
        ...pd,
        phase: 'fuir',
        fuir: {
          participants: [
            { id: frappeur.id, kind: 'backstab', interactive: false, result: { hit: true, attackerRoll: 40, netSL: 2, location: 'corps', damage: 5, woundsLost: 5, critical: false, advantageTo: 'attacker', defenderDefeated: false, log: 'dans le dos' } },
            { id: fuyard.id, kind: 'calme', interactive: true, calme: { success: true, roll: 10, target: 50, sl: 2 } },
          ],
        },
      },
    });

    const critBefore = live(fuyard.id).criticalWounds ?? 0;
    useGame.getState().fleeConfirm();
    draineCascade(useGame.getState); // la sévérité du dépassement se tire DANS la fenêtre (#1426)

    const f = live(fuyard.id);
    expect(f.wounds.current).toBeLessThanOrEqual(0);
    expect(f.criticalWounds ?? 0).toBeGreaterThan(critBefore); // dépassement → Blessure critique
    expect(hasCondition(f, COND.aTerre)).toBe(true); // …ET l'État À Terre
  });

  it('symétrie du surfaçage : le slot du coup dans le dos suit SON frappeur (humain → interactif, IA → témoin)', () => {
    // (a) frappeur HÉROS (piloté-humain) : son jet est interactif et N'EST PAS auto-roulé.
    const { fuyard } = duelHeros(5);
    useGame.getState().disengageFlee();
    const bsA = fleeBackstab(useGame.getState().pendingDisengage!)!;
    expect(bsA.interactive).toBe(true);
    expect(bsA.result).toBeNull(); // en attente du frappeur — plus de jet roulé en silence
    expect(fleeCalme(useGame.getState().pendingDisengage!)!.interactive).toBe(true); // le fuyard est humain aussi

    // (b) frappeur ENNEMI (IA) : rangée TÉMOIN, jet auto-roulé à l'ouverture (le fuyard garde le sien).
    const b = useGame.getState().battle!;
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    const H = live(fuyard.id);
    H.engagedWith = [E.id];
    E.engagedWith = [H.id];
    E.pos = { x: 8, y: 10 };
    E.characteristics['capacite-de-combat'] = 90; // touche à coup sûr → le slot de Calme reste dû
    useGame.setState({
      battle: { ...b },
      pendingDisengage: { moverId: H.id, foeId: E.id, canSacrifice: false, phase: 'choice', atk: null, def: null, result: null },
    });
    useGame.getState().disengageFlee();
    const pdB = useGame.getState().pendingDisengage!;
    expect(fleeBackstab(pdB)!.interactive).toBe(false);
    expect(fleeBackstab(pdB)!.result).toBeTruthy(); // témoin auto-roulé
    expect(fleeCalme(pdB)!.interactive).toBe(true);
  });

  it('100 % IA (ennemi qui fuit un ennemi) : résolution HEADLESS par le même flux, aucun pending qui traîne', () => {
    const A = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
    useGame.setState({ party: [A] });
    useGame.getState().seedRng(6);
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const [E1, E2] = b.combatants.filter((c) => c.kind === 'enemy');
    E1.pos = { x: 16, y: 11 };
    E2.pos = { x: 17, y: 11 };
    E1.engagedWith = [E2.id];
    E2.engagedWith = [E1.id];
    E2.characteristics['capacite-de-combat'] = 90; // le coup dans le dos (+20) touche à coup sûr
    useGame.setState({
      battle: { ...b },
      pendingDisengage: { moverId: E1.id, foeId: E2.id, canSacrifice: false, phase: 'choice', atk: null, def: null, result: null },
    });
    const before = live(E1.id).wounds.current;

    useGame.getState().disengageFlee();

    expect(useGame.getState().pendingDisengage).toBeNull(); // rien qui traîne
    expect(live(E1.id).wounds.current).toBeLessThan(before); // le coup dans le dos a bien été appliqué
    // …par l'applicateur CANONIQUE d'attaque (événement de journal 'attack'), pas par un chemin parallèle.
    expect(useGame.getState().battle!.log.some((e) => e.kind === 'attack' && e.actorId === E2.id)).toBe(true);
    expect(live(E1.id).engagedWith).toEqual([]); // fuite complétée
  });

  // Fuyard ARMURÉ : le Coup Critique du coup dans le dos lui OFFRE la Déviation (LDB 63 l.30) →
  // `applyAttackResult` SUSPEND. La fuite (Brisé + Course) ne se complète qu'APRÈS la résolution du
  // coup gratuit — LDB 15 l.68 verbatim : « Une fois que ce coup gratuit est résolu, vous pouvez vous
  // déplacer jusqu'à la limite de votre Mouvement de Course ».
  it('fuyard ARMURÉ : la Déviation Critique SUSPEND — la fuite (Brisé + Course) attend la résolution du coup', () => {
    const { frappeur, fuyard } = duelHeros(7);
    fuyard.armour = { tete: 2, corps: 2, brasG: 2, brasD: 2, jambeG: 2, jambeD: 2 } as never; // PA → Déviation offerte
    fuyard.wounds = { current: 40, max: 40, base: 40 } as never;
    const pd = useGame.getState().pendingDisengage!;
    useGame.setState({
      battle: { ...useGame.getState().battle! },
      pendingCascade: null,
      pendingDisengage: {
        ...pd,
        phase: 'fuir',
        fuir: {
          participants: [
            { id: frappeur.id, kind: 'backstab', interactive: false, result: { hit: true, attackerRoll: 33, netSL: 2, location: 'corps', critLocation: 'corps', damage: 6, woundsLost: 6, critical: true, advantageTo: 'attacker', defenderDefeated: false, log: 'dans le dos' } },
            { id: fuyard.id, kind: 'calme', interactive: true, calme: { success: false, roll: 70, target: 50, sl: -1 } },
          ],
        },
      },
    });

    useGame.getState().fleeConfirm();

    // (1) SUSPENDU : le choix Dévier/Subir est posé, la fuite N'EST PAS complétée.
    const casc = useGame.getState().pendingCascade!;
    expect(casc.participants.some((s) => s.kind === 'deviation')).toBe(true);
    expect(casc.participants.some((s) => s.kind === 'fleeMove')).toBe(true); // étape de REPRISE de la fuite
    expect(live(fuyard.id).engagedWith).toEqual([frappeur.id]); // toujours Engagé
    expect(stacks(live(fuyard.id), COND.brise)).toBe(0); // aucun État Brisé tant que le coup n'est pas résolu
    expect(useGame.getState().battle!.reachable.size).toBe(0); // aucun budget de Course posé

    // (2) « Subir » : le Critique s'applique, PUIS la fuite se complète (Brisé + libération + Course).
    const devId = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'deviation')!.id;
    useGame.getState().cascadeTableRoll(devId); // le d100 de sévérité tombe DANS la MÊME fenêtre (#1426)
    useGame.getState().cascadeChoose(devId, 'subir');
    for (let i = 0; i < 4 && useGame.getState().pendingCascade; i++) useGame.getState().cascadeNext();
    const f = live(fuyard.id);
    expect(f.criticalWounds ?? 0).toBeGreaterThan(0); // Blessure critique subie
    expect(stacks(f, COND.brise)).toBe(2); // Calme raté DR -1 → 1 + 1 États Brisés (LDB 15 l.66)
    expect(f.engagedWith).toEqual([]); // fuite complétée APRÈS le coup
    expect(useGame.getState().battle!.reachable.size).toBeGreaterThan(0); // budget de Course posé
  });

  // LDB 15 l.63 : le coup dans le dos est un « Test de Corps à corps non opposé ». Un frappeur qui a
  // un ARC en main ne tire donc pas dans le dos : il frappe (arme de mêlée, mains nues à défaut).
  it('frappeur avec un ARC en main : le coup dans le dos reste un Test de CORPS À CORPS', () => {
    const { frappeur, fuyard } = duelHeros(10);
    frappeur.weapons = [{ name: 'Arc', label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 4 }, qualities: [], range: 60 }] as never;
    fuyard.wounds = { current: 40, max: 40, base: 40 } as never;
    useGame.setState({ battle: { ...useGame.getState().battle! } });

    useGame.getState().disengageFlee();
    const bs = fleeBackstab(useGame.getState().pendingDisengage!)!;
    useGame.getState().fleeRoll(bs.id);
    const res = fleeBackstab(useGame.getState().pendingDisengage!)!.result!;
    expect(res.attackerDetail!.label).not.toMatch(/Projectiles/); // jet de CC, pas de CT
    const pdNow = useGame.getState().pendingDisengage!;
    if (fleeNeedCalme(pdNow)) useGame.getState().fleeRoll(fleeCalme(pdNow)!.id);
    useGame.getState().fleeConfirm();
    const log = useGame.getState().battle!.log;
    expect(log.some((e) => e.kind === 'attack' && e.actorId === frappeur.id)).toBe(true);
    expect(log.some((e) => e.kind === 'shoot')).toBe(false); // jamais la branche TIR (munitions/dispersion)
  });

  // Coop : les DEUX slots sont joués par des SIÈGES différents (héros frénétique qui frappe le héros
  // d'un autre joueur). `interactive` suit l'acteur JOUÉ (jamais `pilotedByHuman`, évalué chez l'hôte) et
  // l'étape porte `groupOwner` → chacun voit la fenêtre et n'influence QUE son slot.
  it('coop : slots joués par deux sièges → étape de GROUPE, chaque siège ne pilote QUE son slot', () => {
    const { frappeur, fuyard } = duelHeros(8);
    useGame.setState({
      net: { ...useGame.getState().net, mode: 'host', mySeat: 0, ownership: { [frappeur.id]: 1 } },
      pendingCascade: { title: 'Se désengager', icon: '↩', purpose: 'combat', cursor: 0, log: [], participants: [{ id: 'disengage', kind: 'disengageStep', jet: 'disengage', actorId: fuyard.id }] } as never,
    });
    useGame.getState().disengageFlee();
    const st = useGame.getState();

    // Les deux rangées sont INTERACTIVES (acteurs joués), le coup dans le dos n'est PAS auto-roulé.
    expect(fleeBackstab(st.pendingDisengage!)!.interactive).toBe(true);
    expect(fleeBackstab(st.pendingDisengage!)!.result).toBeNull();
    expect(fleeCalme(st.pendingDisengage!)!.interactive).toBe(true);
    // La fenêtre est un moment PARTAGÉ ('*') : sinon le siège du frappeur ne la verrait jamais.
    expect(modalOwnerOf(st)).toBe('*');
    // Chaque siège ne lance QUE le jet de SON héros (routage par possession du 1ᵉʳ argument).
    expect(intentAllowedFor(st, 1, 'fleeRoll', [frappeur.id])).toBe(true);
    expect(intentAllowedFor(st, 0, 'fleeRoll', [frappeur.id])).toBe(false);
    expect(intentAllowedFor(st, 0, 'fleeRoll', [fuyard.id])).toBe(true);
    expect(intentAllowedFor(st, 1, 'fleeRoll', [fuyard.id])).toBe(false);
  });

  // Bac-à-sable MJ (`gmSeat`) : l'ennemi frappeur est piloté par un humain (le MJ) mais n'est PAS un
  // acteur JOUÉ → sa rangée reste TÉMOIN (auto-roulée). Sans cela : impasse — la fenêtre est chez le
  // fuyard (qui n'a pas le droit de lancer le jet de l'ennemi) et le MJ n'a pas la fenêtre.
  it('MJ (gmSeat) : le coup dans le dos d’un ENNEMI reste témoin auto-roulé — aucune impasse', () => {
    const { fuyard } = duelHeros(9);
    const b = useGame.getState().battle!;
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    const H = live(fuyard.id);
    H.engagedWith = [E.id];
    E.engagedWith = [H.id];
    E.pos = { x: 8, y: 10 };
    E.characteristics['capacite-de-combat'] = 90;
    useGame.setState({
      net: { ...useGame.getState().net, mode: 'host', mySeat: 0, gmSeat: 0 },
      battle: { ...b },
      pendingDisengage: { moverId: H.id, foeId: E.id, canSacrifice: false, phase: 'choice', atk: null, def: null, result: null },
    });

    useGame.getState().disengageFlee();

    const pdB = useGame.getState().pendingDisengage!;
    expect(fleeBackstab(pdB)!.interactive).toBe(false);
    expect(fleeBackstab(pdB)!.result).toBeTruthy(); // résolu à l'ouverture : le fuyard n'attend personne
    expect(fleeCalme(pdB)!.interactive).toBe(true);
    // Le fuyard peut mener la fenêtre à son terme tout seul.
    useGame.getState().fleeRoll(H.id);
    useGame.getState().fleeConfirm();
    expect(useGame.getState().pendingDisengage).toBeNull();
  });
});
