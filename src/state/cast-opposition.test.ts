import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';
import { modalOwnerOf, ownsLocally, intentAllowedFor } from './netOwnership';
import { castingBaseValue } from '../engine/magic';
import type { Combatant } from '../engine/types';

/**
 * Incantation OPPOSÉE (`SpellSpec.opposed`) — multijet DANS la modale de cast (jamais auto-caché) :
 * une cible oppose son Test (FM pour Fauche-démon, Int pour Parole de Tzeentch) à l'incantation
 * FIGÉE. Cible IA = rangée TÉMOIN (jet roulé à l'ouverture). `oppositionConfirm` agrège
 * (résisté + marge de DR) puis `applyCast` n'applique qu'aux cibles n'ayant PAS résisté.
 * (LDB 48 « Fauche-démon » : Test d'Incantation opposé par la FM ; LDB 51 « Parole de Tzeentch ».)
 */
describe('Incantation opposée (SpellSpec.opposed — multijet)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null, pendingCast: null, pendingCastOpposition: null }); });
  afterEach(() => {
    vi.clearAllTimers(); vi.useRealTimers();
    useGame.setState({ net: { ...useGame.getState().net, mode: 'local', mySeat: 0, gmSeat: undefined, ownership: {} } });
  });

  function setup() {
    const hero = createHero({
      speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W',
      careerTalent: { id: 'magie-mineure' }, rng: makeRNG(707),
    });
    hero.spells = ['fauche-demon', 'parole-de-tzeentch'];
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
    E.groups = ['demon']; // cible Démoniaque (le gate `onlyGroups` de Fauche-démon)
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 12, y: 10 };
    useGame.setState({ battle: { ...b } });
    return { H, E };
  }

  /** Pose une incantation RÉUSSIE figée (résultat contrôlé) prête à confirmer. La valeur NUE du lanceur
   *  est celle que `evaluateCasting` pose en prod (`castingBaseValue`) : sans elle, le départage à DR
   *  égal de l'opposition retomberait sur les cibles (`LDB 12 l.160`). */
  function frozenCast(H: Combatant, E: Combatant, spellId: string, sl: number) {
    useGame.setState({
      pendingCast: {
        casterId: H.id, targetId: E.id, spellId, missile: false, focused: false,
        result: { cast: true, roll: 30, target: 70, sl, base: castingBaseValue(H, 'langue', 'magick'), isCritical: false, isFumble: false, log: 'x' },
      },
    });
  }

  it('GATE : un Sort `opposed` réussi OUVRE le multijet d’opposition (garde pendingCast, ne s’applique pas encore)', () => {
    const { H, E } = setup();
    E.characteristics['force-mentale'] = 20; // FM faible → DR d'opposition plafonné (max +2)
    frozenCast(H, E, 'fauche-demon', 6);
    useGame.getState().castConfirm();
    const pco = useGame.getState().pendingCastOpposition;
    expect(pco).toBeTruthy();
    expect(pco!.kind).toBe('resist');
    expect(pco!.char).toBe('force-mentale');
    expect(useGame.getState().pendingCast).toBeTruthy(); // l'incantation reste figée le temps de l'opposition
    const part = pco!.participants.find((p) => p.id === E.id)!;
    expect(part.interactive).toBe(false); // cible IA = rangée témoin
    expect(part.result).toBeTruthy(); // jet roulé à l'ouverture (révélé, jamais caché)
  });

  it('le lanceur l’emporte (DR d’incantation > opposition) → la cible Démoniaque est annihilée', () => {
    useGame.getState().seedRng(11);
    const { H, E } = setup();
    E.characteristics['force-mentale'] = 20; // opposition ≤ +2 DR, l'incantation à +6 gagne toujours
    frozenCast(H, E, 'fauche-demon', 6);
    useGame.getState().castConfirm(); // ouvre l'opposition, IA auto-roulée
    const part = useGame.getState().pendingCastOpposition!.participants.find((p) => p.id === E.id)!;
    expect(part.result!.resisted).toBe(false);
    useGame.getState().oppositionConfirm(); // agrège → applyCast
    expect(useGame.getState().pendingCast).toBeNull();
    const after = useGame.getState().battle!.combatants.find((c) => c.id === E.id)!;
    expect(after.dead).toBe(true); // bannie/retirée du jeu (Fauche-démon)
  });

  it('la cible résiste (FM élevée) → le Sort ne l’affecte pas (PB intacts, pas d’annihilation)', () => {
    useGame.getState().seedRng(11);
    const { H, E } = setup();
    E.characteristics['force-mentale'] = 100; // FM ≥ 100 → DR d'opposition toujours ≥ l'incantation à +0
    E.wounds = { current: 12, max: 20 };
    frozenCast(H, E, 'fauche-demon', 0);
    useGame.getState().castConfirm();
    const part = useGame.getState().pendingCastOpposition!.participants.find((p) => p.id === E.id)!;
    expect(part.result!.resisted).toBe(true);
    useGame.getState().oppositionConfirm();
    const after = useGame.getState().battle!.combatants.find((c) => c.id === E.id)!;
    // Résiste à l'incantation entière : ni op (annihilation) ni rider de Domaine (frappe d'Hysh).
    expect(after.wounds.current).toBe(12);
    expect(after.dead ?? false).toBe(false);
  });

  it('paramétrage par Sort : Parole de Tzeentch oppose l’INTELLIGENCE (pas la FM)', () => {
    const { H, E } = setup();
    frozenCast(H, E, 'parole-de-tzeentch', 4);
    useGame.getState().castConfirm();
    const pco = useGame.getState().pendingCastOpposition!;
    expect(pco.char).toBe('intelligence');
  });

  it('IDEMPOTENCE : un second « Appliquer » ne RECONSTRUIT pas la fenêtre — les Tests déjà opposés tiennent', () => {
    useGame.getState().seedRng(11);
    const { H, E } = setup();
    useGame.setState({ net: { ...useGame.getState().net, mode: 'host', mySeat: 2, gmSeat: 2, ownership: {} } }); // rangée ennemie TENUE (jet dû)
    frozenCast(H, E, 'parole-de-tzeentch', 4);
    useGame.getState().castConfirm();
    useGame.getState().oppositionRoll(E.id);
    const avant = useGame.getState().pendingCastOpposition!;
    expect(avant.participants[0].result, 'la rangée a opposé son Test').toBeTruthy();

    useGame.getState().castConfirm(); // re-entrée : 2ᵉ clic, intent réseau, beat d'auto-cadence…

    const apres = useGame.getState().pendingCastOpposition;
    expect(apres, 'la fenêtre due est toujours là').toBeTruthy();
    expect(apres!.participants, 'jets PRÉSERVÉS (la fenêtre n’est pas repartie de zéro)').toEqual(avant.participants);
    expect(useGame.getState().pendingCast, 'l’application reste DIFFÉRÉE').toBeTruthy();
    useGame.getState().oppositionConfirm(); // et la chaîne se dénoue normalement
    expect(useGame.getState().pendingCastOpposition).toBeNull();
    expect(useGame.getState().pendingCast).toBeNull();
  });
});

/**
 * COOP — la CIBLE d'un sort opposé lancé par un HÉROS doit pouvoir opposer son Test (#949, sonde du
 * juge de #942) : la fenêtre d'incantation est ouverte par le lanceur, donc l'owner de l'étape `cast`
 * est le lanceur ; sans partage d'étape, AUCUN siège ne réunit « voir la fenêtre » ET « piloter la
 * rangée de la cible » → la cible subit sans opposer. Prédicats RÉELS : `modalOwnerOf` (visibilité,
 * `ActiveModal`), `ownsLocally` (gate de rangée, `CastModal`), `intentAllowedFor` (autorité hôte).
 */
describe('Incantation opposée en COOP — la cible d’un autre siège tient sa rangée', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null, pendingCast: null, pendingCastOpposition: null, pendingCascade: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); useGame.setState({ net: { ...useGame.getState().net, mode: 'local', mySeat: 0, ownership: {} } }); });

  /** Lanceur (siège 0) + cible héros (siège 1), fenêtre d'incantation OUVERTE par les vraies coutures. */
  async function setupCoop() {
    const caster = createHero({ speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W', careerTalent: { id: 'magie-mineure' }, rng: makeRNG(707) });
    caster.spells = ['fauche-demon'];
    const cible = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'T', rng: makeRNG(31) });
    useGame.setState({ party: [caster, cible] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.id === caster.id)!;
    const T = b.combatants.find((c) => c.id === cible.id)!;
    useGame.setState({
      net: { ...useGame.getState().net, mode: 'host', mySeat: 0, seatNames: { 0: 'Hôte', 1: 'Antoine', 2: 'Béa' }, ownership: { [T.id]: 1 } },
      pendingCast: {
        casterId: H.id, targetId: T.id, spellId: 'fauche-demon', missile: false, focused: false,
        result: { cast: true, roll: 30, target: 70, sl: 6, base: castingBaseValue(H, 'langue', 'magick'), isCritical: false, isFumble: false, log: 'x' },
      },
    });
    const { openCastCascade, openCastOpposition } = await import('./combatFlow');
    openCastCascade(useGame.getState, useGame.setState, H); // fenêtre = étape `jet:'cast'` du lanceur
    const ouvert = openCastOpposition(useGame.getState, useGame.setState, useGame.getState().pendingCast!, [T]);
    expect(ouvert).toBe(true);
    return { H, T };
  }

  /** Le siège `seat` VOIT-il la fenêtre ? (calque exact du gate de `ActiveModal`.) */
  const voitFenetre = (seat: number): boolean => {
    useGame.setState({ net: { ...useGame.getState().net, mySeat: seat } });
    const s = useGame.getState();
    const owner = modalOwnerOf(s);
    return owner === '*' || owner === null || ownsLocally(s, owner);
  };
  /** Le siège `seat` PILOTE-t-il la rangée de `id` ? (gate de rangée `CastModal` + autorité hôte.) */
  const tientRangee = (seat: number, id: string): boolean => {
    useGame.setState({ net: { ...useGame.getState().net, mySeat: seat } });
    const s = useGame.getState();
    return ownsLocally(s, id) && intentAllowedFor(s, seat, 'oppositionRoll', [id]);
  };

  it('au moins un siège VOIT la fenêtre ET tient la rangée de la cible (sinon le Test disparaît)', async () => {
    const { T } = await setupCoop();
    const part = useGame.getState().pendingCastOpposition!.participants.find((p) => p.id === T.id)!;
    expect(part.interactive).toBe(true); // cible héros = rangée à jouer, pas un témoin auto-roulé
    const jouable = [0, 1, 2].filter((seat) => voitFenetre(seat) && tientRangee(seat, T.id));
    expect(jouable, 'aucun siège ne réunit visibilité de la fenêtre et pilotage de la rangée').toEqual([1]);
  });

  it('FILET : confirmer avec une rangée interactive NON lancée est refusé (la cible subirait sans opposer)', async () => {
    const { T } = await setupCoop();
    useGame.getState().oppositionConfirm();
    expect(useGame.getState().pendingCastOpposition, 'l’opposition reste ouverte tant qu’un jet est dû').toBeTruthy();
    expect(useGame.getState().pendingCast, 'le Sort ne s’applique pas').toBeTruthy();
    useGame.getState().oppositionRoll(T.id); // la cible oppose enfin son Test
    useGame.getState().oppositionConfirm();
    expect(useGame.getState().pendingCast).toBeNull(); // agrégé puis appliqué
  });
});

/**
 * #1028 — la rangée d'OPPOSITION suit la POSSESSION (`jetSurfaced`), pas le `kind` : le PRODUCTEUR
 * (`openCastOpposition`) et le CONSOMMATEUR (gate de rangée `influencesLocally`, `CastModal`) lisent la
 * MÊME table de vérité. Une rangée marquée interactive que personne ne peut jouer n'est ni cliquable ni
 * auto-roulée, et `oppositionConfirm` refuse d'agréger → le flux se BLOQUE (mesuré en solo sur une
 * cible héros `aiControlled`).
 */
describe('#1028 — rangée d’opposition : possession, jamais le kind', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null, pendingCast: null, pendingCastOpposition: null, pendingCascade: null }); });
  afterEach(() => {
    vi.clearAllTimers(); vi.useRealTimers();
    useGame.setState({ net: { ...useGame.getState().net, mode: 'local', mySeat: 0, gmSeat: undefined, ownership: {} } });
  });

  /** Sorcier + un allié PNJ conduit par l'IA (`aiControlled`) + une cible ennemie. */
  function setupPnj() {
    const caster = createHero({ speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W', careerTalent: { id: 'magie-mineure' }, rng: makeRNG(707) });
    caster.spells = ['parole-de-tzeentch'];
    const allie = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'PNJ', rng: makeRNG(31) });
    useGame.setState({ party: [caster, allie] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.id === caster.id)!;
    const P = b.combatants.find((c) => c.id === allie.id)!;
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    P.aiControlled = true; // PNJ allié piloté par l'IA : AUCUN siège ne tient son jet
    useGame.setState({ battle: { ...b }, net: { ...useGame.getState().net, mode: 'local', mySeat: 0, gmSeat: undefined, ownership: {} } });
    return { H, P, E };
  }
  /** Incantation figée — nue du lanceur POSÉE comme le fait `evaluateCasting` en prod (`LDB 12 l.160`). */
  const frozen = (casterId: string, targetId: string) => {
    const caster = useGame.getState().battle!.combatants.find((c) => c.id === casterId)!;
    useGame.setState({
      pendingCast: {
        casterId, targetId, spellId: 'parole-de-tzeentch', missile: false, focused: false,
        result: { cast: true, roll: 30, target: 70, sl: 4, base: castingBaseValue(caster, 'langue', 'magick'), isCritical: false, isFumble: false, log: 'x' },
      },
    });
  };

  it('SOLO — cible héros `aiControlled` : rangée TÉMOIN auto-roulée, le flux AVANCE (plus de blocage)', () => {
    useGame.getState().seedRng(11);
    const { H, P } = setupPnj();
    frozen(H.id, P.id);
    useGame.getState().castConfirm();
    const part = useGame.getState().pendingCastOpposition!.participants.find((p) => p.id === P.id)!;
    expect(part.interactive, 'aucun siège ne tient ce jet → rangée témoin').toBe(false);
    expect(part.result, 'un jet non joué par un humain est roulé à l’ouverture, jamais laissé en suspens').toBeTruthy();
    useGame.getState().oppositionConfirm();
    expect(useGame.getState().pendingCastOpposition, 'la fenêtre se ferme : rien ne reste dû').toBeNull();
    expect(useGame.getState().pendingCast, 'le Sort s’applique — le flux n’est pas bloqué').toBeNull();
  });

  it('gmSeat — cible ENNEMIE : rangée INTERACTIVE tenue par le MJ (jet non volé)', () => {
    useGame.getState().seedRng(11);
    const { H, E } = setupPnj();
    useGame.setState({ net: { ...useGame.getState().net, mode: 'host', mySeat: 2, gmSeat: 2, ownership: {}, seatNames: { 0: 'Hôte', 1: 'Antoine', 2: 'MJ' } } });
    frozen(H.id, E.id);
    useGame.getState().castConfirm();
    const part = useGame.getState().pendingCastOpposition!.participants.find((p) => p.id === E.id)!;
    expect(part.interactive, 'l’ennemi est conduit par le siège MJ → sa rangée se joue').toBe(true);
    expect(part.result, 'rien n’est roulé avant que le MJ ne le décide').toBeNull();
    const s = useGame.getState();
    expect(intentAllowedFor(s, 2, 'oppositionRoll', [E.id]), 'siège MJ').toBe(true);
    expect(intentAllowedFor(s, 0, 'oppositionRoll', [E.id]), 'hôte non MJ').toBe(false);
    expect(intentAllowedFor(s, 1, 'oppositionRoll', [E.id]), 'joueur').toBe(false);
  });
});
