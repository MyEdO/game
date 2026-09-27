/**
 * Battement & Distraire JOUÉS PAR LE HÉROS (flux par modale, ≠ IA). Prouve que le câblage store →
 * FLOWS.battement/FLOWS.distraire → resolveBattement/resolveDistraire produit bien l'effet RAW :
 *  - Battement (LDB 10 l.103) : Action, Test de CC non opposé → retire de l'Avantage adverse ;
 *  - Distraire (LDB 10 l.364) : Mouvement, Test opposé Athlétisme vs Calme → pose `distractedRounds`.
 * On pilote le VRAI flux (battleX → xRoll → xConfirm), avec des Caractéristiques rendant l'issue
 * déterministe, et on vérifie l'effet + le coût (Action pour Battement, Mouvement pour Distraire).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { actionGate } from './actionRegistry';
import { t } from '../i18n';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { engage } from '../engine/engagement';
import type { Combatant } from '../engine/types';

describe('Battement & Distraire — flux HÉROS (par modale, pas l’IA)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ battle: null, pendingBattement: null, pendingDistraire: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  /** Un héros (avec les deux Talents) face à UN ennemi armé et pourvu d'Avantage, adjacent. */
  function setup() {
    useGame.getState().seedRng(1);
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    hero.talents = [{ talentId: 'battement', times: 1 }, { talentId: 'distraire', times: 1 }] as Combatant['talents'];
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    enemies.slice(1).forEach((e) => (e.dead = true));
    const E = enemies[0];
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 11, y: 10 }; // adjacent : Engagé pour le Battement
    // Ennemi ARMÉ (prérequis Battement l.103) + pourvu d'Avantage à retirer/nier.
    E.weapons = [{ label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0 }, qualities: [], uid: 'sw' }] as Combatant['weapons'];
    E.advantage = 3;
    const turn = b.order.indexOf(H.id);
    useGame.setState({ battle: { ...b, turn, movementUsed: 0, acted: false } });
    return { H, E };
  }

  it('Battement : Action, jet de CC réussi → l’Avantage adverse chute ; l’Action est consommée', () => {
    const { H, E } = setup();
    H.characteristics['capacite-de-combat'] = 60;
    H.resilience = 1; // Résilience : réussite garantie (LDB 17 l.68) → issue déterministe (jet du flux forcé)
    engage(H, E); // Engagé (prérequis l.103)
    expect(useGame.getState().battle!.combatants.find((c) => c.id === E.id)!.advantage).toBe(3);

    useGame.getState().battleBattement(); // OUVRE la modale (défaut = 1er foe éligible), sans tirer
    const pb = useGame.getState().pendingBattement;
    expect(pb).toBeTruthy();
    expect(pb!.foeId).toBe(E.id);
    expect(pb!.result).toBeNull(); // rien n’est tiré avant Lancer

    useGame.getState().battementRoll(); // le flux tire le jet de CC (figé)
    useGame.getState().battementForceSuccess(); // Résilience → le jet du flux est forcé en réussite (LDB 17 l.68)
    expect(useGame.getState().pendingBattement!.result!.success).toBe(true);
    useGame.getState().battementConfirm(); // Appliquer → resolveBattement

    const st = useGame.getState();
    expect(st.pendingBattement).toBeNull();
    const e2 = st.battle!.combatants.find((c) => c.id === E.id)!;
    expect(e2.advantage).toBeLessThan(3); // l’Avantage adverse a bien été retiré (LDB 10 l.103)
    expect(st.battle!.acted).toBe(true); // Battement = Action → consommée
  });

  it('Distraire : Mouvement, Test opposé gagné → distractedRounds=2 ; le Mouvement est consommé, PAS l’Action', () => {
    const { H, E } = setup();
    H.characteristics.agilite = 95; // Athlétisme très haut → gagne le Test opposé
    E.characteristics['force-mentale'] = 5; // Calme (figé à l’ouverture) très bas → perd
    expect(E.distractedRounds ?? 0).toBe(0);

    useGame.getState().battleDistraire(); // OUVRE (fige le Calme du foe), sans tirer l’Athlétisme
    const pd = useGame.getState().pendingDistraire;
    expect(pd).toBeTruthy();
    expect(pd!.foeId).toBe(E.id);
    expect(pd!.atk).toBeNull(); // Athlétisme du mover pas encore lancé
    expect(pd!.defRoll).toBeTruthy(); // Calme du foe déjà figé

    useGame.getState().distraireRoll(); // le flux tire l’Athlétisme, opposé au Calme figé
    expect(useGame.getState().pendingDistraire!.result).toBe('success');
    useGame.getState().distraireConfirm(); // Appliquer → resolveDistraire

    const st = useGame.getState();
    expect(st.pendingDistraire).toBeNull();
    const e2 = st.battle!.combatants.find((c) => c.id === E.id)!;
    expect(e2.distractedRounds).toBe(2); // le foe est distrait (LDB 10 l.364)
    expect(st.battle!.acted).toBe(false); // Distraire = Mouvement → l’Action reste disponible
    expect(st.battle!.movementUsed).toBeGreaterThan(0); // le Mouvement est consommé
  });

  it('Battement échoué (CC très bas) : l’Avantage adverse est PRÉSERVÉ ; l’Action reste consommée', () => {
    const { H, E } = setup();
    H.characteristics['capacite-de-combat'] = 1; // échec quasi certain
    engage(H, E);
    useGame.getState().battleBattement();
    useGame.getState().battementRoll();
    expect(useGame.getState().pendingBattement!.result!.success).toBe(false);
    useGame.getState().battementConfirm();
    const e2 = useGame.getState().battle!.combatants.find((c) => c.id === E.id)!;
    expect(e2.advantage).toBe(3); // rien retiré sur un échec (manv.battementFail)
  });
});

/**
 * GATES DE CIBLE du registre (#1411 P1, `actions.json` : `gate` COMPOSÉ). Le verdict d'offre porte la
 * CONDITION DE CIBLE, mesurée par les MÊMES prédicats que le dispatcher (`battementFoes` /
 * `distraireFoes`) : la case est offerte si et seulement si le dispatcher a un adversaire à traiter,
 * sinon refusée AVEC sa raison. La composition rend la PREMIÈRE raison refusée — l'économie du tour
 * se dit avant la cible.
 */
describe('Battement & Distraire — le verdict d’offre porte la condition de CIBLE', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ battle: null, pendingBattement: null, pendingDistraire: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  /** Un héros portant les deux Talents, face à UN ennemi armé, et la scène réelle du combat. */
  function terrain() {
    useGame.getState().seedRng(1);
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    h.talents = [{ talentId: 'battement', times: 1 }, { talentId: 'distraire', times: 1 }] as Combatant['talents'];
    useGame.setState({ party: [h] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    enemies.slice(1).forEach((e) => (e.dead = true));
    const E = enemies[0];
    H.pos = { x: 5, y: 10 };
    E.pos = { x: 11, y: 10 };
    E.weapons = [{ label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0 }, qualities: [], uid: 'sw' }] as Combatant['weapons'];
    useGame.setState({ battle: { ...b, turn: b.order.indexOf(H.id), movementUsed: 0, acted: false } });
    return { H, E };
  }
  const ctx = (H: Combatant) => ({ active: H, battle: useGame.getState().battle! });

  it('BATTEMENT : sans adversaire ENGAGÉ, la case est refusée AVEC sa raison ; l’Engagement l’ouvre', () => {
    const { H, E } = terrain();
    const refus = actionGate('battement', ctx(H));
    expect(refus.ok, 'aucun Engagement : le dispatcher n’ouvrirait rien').toBe(false);
    expect(refus.reason).toBe(t('agate.noBattementTarget'));
    engage(H, E);
    expect(actionGate('battement', ctx(H)).ok, 'un adversaire armé et Engagé ouvre le geste').toBe(true);
  });

  it('DISTRAIRE : un adversaire ACTIF ouvre la case, même masqué par une fumée ; plus aucun, elle est refusée AVEC sa raison', () => {
    const { H, E } = terrain();
    expect(actionGate('distraire', ctx(H)).ok, 'un adversaire actif ouvre le geste').toBe(true);
    // Aucune Ligne de vue au prédicat (`distraireFoes`) — sources : `LDB 10 l.364` · `AA 13 l.51`.
    const b = useGame.getState().battle!;
    useGame.setState({
      battle: { ...b, zones: [{ id: 'fumee', label: 'Fumée', tiles: [{ x: 8, y: 10 }], rounds: 1, permanent: true, blocksLoS: true }] } as typeof b,
    });
    expect(actionGate('distraire', ctx(H)).ok, 'une fumée entre les deux ne ferme pas le geste').toBe(true);
    useGame.getState().battleDistraire();
    expect(useGame.getState().pendingDistraire?.foeId, 'le dispatcher ouvre bien sur cet adversaire').toBe(E.id);
    useGame.getState().distraireCancel();
    const b2 = useGame.getState().battle!;
    b2.combatants.filter((c) => c.kind === 'enemy').forEach((c) => (c.dead = true));
    useGame.setState({ battle: { ...b2 } });
    const refus = actionGate('distraire', ctx(H));
    expect(refus.ok, 'plus aucun adversaire actif : le dispatcher n’aurait rien à traiter').toBe(false);
    expect(refus.reason).toBe(t('agate.noDistraireTarget'));
  });

  it('COMPOSITION : toutes les conditions passent, sinon la PREMIÈRE raison refusée est rendue', () => {
    const { H, E } = terrain();
    engage(H, E); // la cible est éligible : seule l'économie du tour peut refuser
    expect(actionGate('battement', ctx(H)).ok).toBe(true);
    const b = useGame.getState().battle!;
    useGame.setState({ battle: { ...b, acted: true } });
    expect(actionGate('battement', ctx(H)).reason, 'l’Action dépensée se dit AVANT la cible').toBe(t('agate.actionSpent'));
    // … et la 2ᵉ condition reste mesurée quand la 1re passe : le Mouvement se dit avant la cible.
    const b2 = useGame.getState().battle!;
    useGame.setState({ battle: { ...b2, movementUsed: 1 } });
    expect(actionGate('distraire', ctx(H)).reason, 'le Mouvement entamé se dit AVANT la cible').toBe(t('agate.movementStarted'));
  });
});
