import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { ownsLocal, intentAllowedFor } from './netOwnership';
import { modalOwnerOf } from './modalArbiter';
import { castingBaseValue, incantationArcane } from '../engine/magic';
import { addCondition, COND } from '../engine/conditions';
import { libelleDOppositionDeSort } from './jetsEnVue';
import type { Combatant } from '../engine/types';
import { blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * Incantation OPPOSÉE (`SpellSpec.opposed`) — multijet DANS la modale de cast (jamais auto-caché) :
 * une cible oppose son Test (FM pour Fauche-démon, Int pour Parole de Tzeentch) à l'incantation
 * FIGÉE. Cible IA = rangée TÉMOIN (jet roulé à l'ouverture). `jetValider('opposition')` agrège
 * (résisté + marge de DR) puis `applyCast` n'applique qu'aux cibles n'ayant PAS résisté.
 * (LDB 48 « Fauche-démon » : Test d'Incantation opposé par la FM ; LDB 51 « Parole de Tzeentch ».)
 */
describe('Incantation opposée (SpellSpec.opposed — multijet)', () => {
  function setup() {
    const hero = createHero({ idNeuf: idsDeTest,
      speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W',
      careerTalent: { id: 'magie-mineure' }, seed: 707,
    });
    hero.spells = ['fauche-demon', 'parole-de-tzeentch'];
    banc.setState({ party: [hero] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'heros')!;
    const enemies = b.combatants.filter((c) => c.kind === 'ennemi');
    enemies.slice(1).forEach((e) => (e.dead = true));
    const E = enemies[0];
    E.groups = ['demon']; // cible Démoniaque (le gate `onlyGroups` de Fauche-démon)
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 12, y: 10 };
    banc.setState({ battle: { ...b } });
    return { H, E };
  }

  /** Pose une incantation RÉUSSIE figée (résultat contrôlé) prête à confirmer. La valeur NUE du lanceur
   *  est celle que `evaluateCasting` pose en prod (`castingBaseValue`) : sans elle, le départage à DR
   *  égal de l'opposition retomberait sur les cibles (`LDB 12 l.160`). */
  function frozenCast(H: Combatant, E: Combatant, spellId: string, sl: number) {
    banc.setState({
      pendingCast: {
        casterId: H.id, targetId: E.id, spellId, missile: false, focused: false,
        result: { cast: true, roll: 30, target: 70, sl, base: castingBaseValue(H, incantationArcane()), isCritical: false, isFumble: false, log: 'x' },
      },
    });
  }

  it('GATE : un Sort `opposed` réussi OUVRE le multijet d’opposition (garde pendingCast, ne s’applique pas encore)', () => {
    const { H, E } = setup();
    E.characteristics['force-mentale'] = 20; // FM faible → DR d'opposition plafonné (max +2)
    frozenCast(H, E, 'fauche-demon', 6);
    banc.getState().jetValider('incantation');
    const pco = banc.getState().pendingCastOpposition;
    expect(pco).toBeTruthy();
    expect(pco!.test).toEqual({ characteristic: 'force-mentale' });
    expect(banc.getState().pendingCast).toBeTruthy(); // l'incantation reste figée le temps de l'opposition
    const part = pco!.participants.find((p) => p.id === E.id)!;
    expect(part.interactive).toBe(false); // cible IA = rangée témoin
    expect(part.result).toBeTruthy(); // jet roulé à l'ouverture (révélé, jamais caché)
  });

  it('le lanceur l’emporte (DR d’incantation > opposition) → la cible Démoniaque est annihilée', () => {
    banc.getState().ensemencerLeTirage(11);
    const { H, E } = setup();
    E.characteristics['force-mentale'] = 20; // opposition ≤ +2 DR, l'incantation à +6 gagne toujours
    frozenCast(H, E, 'fauche-demon', 6);
    banc.getState().jetValider('incantation'); // ouvre l'opposition, IA auto-roulée
    const part = banc.getState().pendingCastOpposition!.participants.find((p) => p.id === E.id)!;
    expect(part.result!.resisted).toBe(false);
    banc.getState().jetValider('opposition'); // agrège → applyCast
    expect(banc.getState().pendingCast).toBeNull();
    const after = banc.getState().battle!.combatants.find((c) => c.id === E.id)!;
    expect(after.dead).toBe(true); // bannie/retirée du jeu (Fauche-démon)
  });

  it('la cible résiste (FM élevée) → le Sort ne l’affecte pas (PB intacts, pas d’annihilation)', () => {
    banc.getState().ensemencerLeTirage(11);
    const { H, E } = setup();
    E.characteristics['force-mentale'] = 100; // FM ≥ 100 → DR d'opposition toujours ≥ l'incantation à +0
    E.wounds = blessuresDeBase(20, 12, E);
    frozenCast(H, E, 'fauche-demon', 0);
    banc.getState().jetValider('incantation');
    const part = banc.getState().pendingCastOpposition!.participants.find((p) => p.id === E.id)!;
    expect(part.result!.resisted).toBe(true);
    banc.getState().jetValider('opposition');
    const after = banc.getState().battle!.combatants.find((c) => c.id === E.id)!;
    // Résiste à l'incantation entière : ni op (annihilation) ni rider de Domaine (frappe d'Hysh).
    expect(after.wounds.current).toBe(12);
    expect(after.dead ?? false).toBe(false);
  });

  it('LIGNE de la cible posée à l’ouverture : Force Mentale nue, Exténué nommé, cible = valeur roulée (LDB 12 l.166)', () => {
    const { H, E } = setup();
    E.characteristics['force-mentale'] = 40;
    E.skills = [];
    addCondition(E, COND.extenue);
    frozenCast(H, E, 'fauche-demon', 6);
    banc.getState().jetValider('incantation');
    const pco = banc.getState().pendingCastOpposition!;
    const part = pco.participants.find((p) => p.id === E.id)!;
    expect(libelleDOppositionDeSort(pco)).toBe('Force Mentale');
    expect({ base: part.ligne.base, mods: part.ligne.mods.map((m) => [m.label, m.value]), cible: part.ligne.target })
      .toEqual({ base: 40, mods: [['Exténué', -10]], cible: 30 });
    expect(part.result!.oppose.target).toBe(30);
  });

  it('paramétrage par Sort : Parole de Tzeentch oppose l’INTELLIGENCE (pas la FM)', () => {
    const { H, E } = setup();
    frozenCast(H, E, 'parole-de-tzeentch', 4);
    banc.getState().jetValider('incantation');
    const pco = banc.getState().pendingCastOpposition!;
    expect(pco.test).toEqual({ characteristic: 'intelligence' });
  });

  it('IDEMPOTENCE : un second « Appliquer » ne RECONSTRUIT pas la fenêtre — les Tests déjà opposés tiennent', () => {
    banc.getState().ensemencerLeTirage(11);
    const { H, E } = setup();
    banc.setState({ net: { ...banc.getState().net, mode: 'hote', mySeat: 2, gmSeat: 2, ownership: {} } }); // rangée ennemie TENUE (jet dû)
    frozenCast(H, E, 'parole-de-tzeentch', 4);
    banc.getState().jetValider('incantation');
    banc.getState().jetLancer('opposition', E.id);
    const avant = banc.getState().pendingCastOpposition!;
    expect(avant.participants[0].result, 'la rangée a opposé son Test').toBeTruthy();

    banc.getState().jetValider('incantation'); // re-entrée : 2ᵉ clic, intent réseau, beat d'auto-cadence…

    const apres = banc.getState().pendingCastOpposition;
    expect(apres, 'la fenêtre due est toujours là').toBeTruthy();
    expect(apres!.participants, 'jets PRÉSERVÉS (la fenêtre n’est pas repartie de zéro)').toEqual(avant.participants);
    expect(banc.getState().pendingCast, 'l’application reste DIFFÉRÉE').toBeTruthy();
    banc.getState().jetValider('opposition'); // et la chaîne se dénoue normalement
    expect(banc.getState().pendingCastOpposition).toBeNull();
    expect(banc.getState().pendingCast).toBeNull();
  });
});

/**
 * COOP — la CIBLE d'un sort opposé lancé par un HÉROS doit pouvoir opposer son Test (#949, sonde du
 * juge de #942) : la fenêtre d'incantation est ouverte par le lanceur, donc l'owner de l'étape `cast`
 * est le lanceur ; sans partage d'étape, AUCUN siège ne réunit « voir la fenêtre » ET « piloter la
 * rangée de la cible » → la cible subit sans opposer. Prédicats RÉELS : `modalOwnerOf` (visibilité,
 * `ActiveModal`), `ownsLocal` (gate de rangée, `CastModal`), `intentAllowedFor` (autorité hôte).
 */
describe('Incantation opposée en COOP — la cible d’un autre siège tient sa rangée', () => {
  /** Lanceur (siège 0) + cible héros (siège 1), fenêtre d'incantation OUVERTE par les vraies coutures. */
  async function setupCoop() {
    const caster = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W', careerTalent: { id: 'magie-mineure' }, seed: 707 });
    caster.spells = ['fauche-demon'];
    const cible = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'T', seed: 31 });
    banc.setState({ party: [caster, cible] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.id === caster.id)!;
    const T = b.combatants.find((c) => c.id === cible.id)!;
    banc.setState({
      net: { ...banc.getState().net, mode: 'hote', mySeat: 0, seatNames: { 0: 'Hôte', 1: 'Antoine', 2: 'Béa' }, ownership: { [T.id]: 1 } },
      pendingCast: {
        casterId: H.id, targetId: T.id, spellId: 'fauche-demon', missile: false, focused: false,
        result: { cast: true, roll: 30, target: 70, sl: 6, base: castingBaseValue(H, incantationArcane()), isCritical: false, isFumble: false, log: 'x' },
      },
    });
    const { openCastCascade, openCastOpposition } = await import('./combatFlow');
    openCastCascade(banc.getState, banc.setState, H); // fenêtre = étape `jet:'incantation'` du lanceur
    const ouvert = openCastOpposition(banc.getState, banc.setState, banc.getState().pendingCast!, [T]);
    expect(ouvert).toBe(true);
    return { H, T };
  }

  /** Le siège `seat` VOIT-il la fenêtre ? (calque exact du gate de `ActiveModal`.) */
  const voitFenetre = (seat: number): boolean => {
    banc.setState({ net: { ...banc.getState().net, mySeat: seat } });
    const s = banc.getState();
    const owner = modalOwnerOf(s);
    return owner === '*' || owner === null || ownsLocal(s, owner);
  };
  /** Le siège `seat` PILOTE-t-il la rangée de `id` ? (gate de rangée `CastModal` + autorité hôte.) */
  const tientRangee = (seat: number, id: string): boolean => {
    banc.setState({ net: { ...banc.getState().net, mySeat: seat } });
    const s = banc.getState();
    return ownsLocal(s, id) && intentAllowedFor(s, seat, 'jetLancer', ['opposition', id]);
  };

  it('au moins un siège VOIT la fenêtre ET tient la rangée de la cible (sinon le Test disparaît)', async () => {
    const { T } = await setupCoop();
    const part = banc.getState().pendingCastOpposition!.participants.find((p) => p.id === T.id)!;
    expect(part.interactive).toBe(true); // cible héros = rangée à jouer, pas un témoin auto-roulé
    const jouable = [0, 1, 2].filter((seat) => voitFenetre(seat) && tientRangee(seat, T.id));
    expect(jouable, 'aucun siège ne réunit visibilité de la fenêtre et pilotage de la rangée').toEqual([1]);
  });

  it('FILET : confirmer avec une rangée interactive NON lancée est refusé (la cible subirait sans opposer)', async () => {
    const { T } = await setupCoop();
    banc.getState().jetValider('opposition');
    expect(banc.getState().pendingCastOpposition, 'l’opposition reste ouverte tant qu’un jet est dû').toBeTruthy();
    expect(banc.getState().pendingCast, 'le Sort ne s’applique pas').toBeTruthy();
    banc.getState().jetLancer('opposition', T.id); // la cible oppose enfin son Test
    banc.getState().jetValider('opposition');
    expect(banc.getState().pendingCast).toBeNull(); // agrégé puis appliqué
  });
});

/**
 * #1028 — la rangée d'OPPOSITION suit la POSSESSION (`jetSurfaced`), pas le `kind` : le PRODUCTEUR
 * (`openCastOpposition`) et le CONSOMMATEUR (gate de rangée `influencesLocally`, `CastModal`) lisent la
 * MÊME table de vérité. Une rangée marquée interactive que personne ne peut jouer n'est ni cliquable ni
 * auto-roulée, et `jetValider('opposition')` refuse d'agréger → le flux se BLOQUE (mesuré en solo sur une
 * cible héros `aiControlled`).
 */
describe('#1028 — rangée d’opposition : possession, jamais le kind', () => {
  /** Sorcier + un allié PNJ conduit par l'IA (`aiControlled`) + une cible ennemie. */
  function setupPnj() {
    const caster = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W', careerTalent: { id: 'magie-mineure' }, seed: 707 });
    caster.spells = ['parole-de-tzeentch'];
    const allie = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'PNJ', seed: 31 });
    banc.setState({ party: [caster, allie] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.id === caster.id)!;
    const P = b.combatants.find((c) => c.id === allie.id)!;
    const E = b.combatants.find((c) => c.kind === 'ennemi')!;
    P.aiControlled = true; // PNJ allié piloté par l'IA : AUCUN siège ne tient son jet
    banc.setState({ battle: { ...b }, net: { ...banc.getState().net, mode: 'local', mySeat: 0, gmSeat: undefined, ownership: {} } });
    return { H, P, E };
  }
  /** Incantation figée — nue du lanceur POSÉE comme le fait `evaluateCasting` en prod (`LDB 12 l.160`). */
  const frozen = (casterId: string, targetId: string) => {
    const caster = banc.getState().battle!.combatants.find((c) => c.id === casterId)!;
    banc.setState({
      pendingCast: {
        casterId, targetId, spellId: 'parole-de-tzeentch', missile: false, focused: false,
        result: { cast: true, roll: 30, target: 70, sl: 4, base: castingBaseValue(caster, incantationArcane()), isCritical: false, isFumble: false, log: 'x' },
      },
    });
  };

  it('SOLO — cible héros `aiControlled` : rangée TÉMOIN auto-roulée, le flux AVANCE (plus de blocage)', () => {
    banc.getState().ensemencerLeTirage(11);
    const { H, P } = setupPnj();
    frozen(H.id, P.id);
    banc.getState().jetValider('incantation');
    const part = banc.getState().pendingCastOpposition!.participants.find((p) => p.id === P.id)!;
    expect(part.interactive, 'aucun siège ne tient ce jet → rangée témoin').toBe(false);
    expect(part.result, 'un jet non joué par un humain est roulé à l’ouverture, jamais laissé en suspens').toBeTruthy();
    banc.getState().jetValider('opposition');
    expect(banc.getState().pendingCastOpposition, 'la fenêtre se ferme : rien ne reste dû').toBeNull();
    expect(banc.getState().pendingCast, 'le Sort s’applique — le flux n’est pas bloqué').toBeNull();
  });

  it('gmSeat — cible ENNEMIE : rangée INTERACTIVE tenue par le MJ (jet non volé)', () => {
    banc.getState().ensemencerLeTirage(11);
    const { H, E } = setupPnj();
    banc.setState({ net: { ...banc.getState().net, mode: 'hote', mySeat: 2, gmSeat: 2, ownership: {}, seatNames: { 0: 'Hôte', 1: 'Antoine', 2: 'MJ' } } });
    frozen(H.id, E.id);
    banc.getState().jetValider('incantation');
    const part = banc.getState().pendingCastOpposition!.participants.find((p) => p.id === E.id)!;
    expect(part.interactive, 'l’ennemi est conduit par le siège MJ → sa rangée se joue').toBe(true);
    expect(part.result, 'rien n’est roulé avant que le MJ ne le décide').toBeNull();
    const s = banc.getState();
    expect(intentAllowedFor(s, 2, 'jetLancer', ['opposition', E.id]), 'siège MJ').toBe(true);
    expect(intentAllowedFor(s, 0, 'jetLancer', ['opposition', E.id]), 'hôte non MJ').toBe(false);
    expect(intentAllowedFor(s, 1, 'jetLancer', ['opposition', E.id]), 'joueur').toBe(false);
  });
});
