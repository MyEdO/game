/**
 * `giveTrapping` résout l'objet dans la couche de campagne chargée d'abord (#767).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { emptyNarratif } from './monde/campaignNarratif';
import type { NarratifBlock } from '../data/schemas/defs-scenes/narratif';
import { objetDeCampagne } from '../scenes/fixtures/objetDeCampagne.testkit';
import { testScene } from '../scenes/test-fixture';
import { emptyScene } from './monde/scene';
import { applyEffects } from './combatEffects';
import { parseProject } from './worldMap';
import { gestesDeLObjet } from './gestesDeLObjet';
import { MINUTES_PER_DAY } from '../engine/clock';
import { chargerSurLeBanc, sauverLeBanc } from './persistance/save.testkit';
import { resetSceneRegistry } from './monde/registreDesScenes';
import { etatInitialDuJeu } from './etat';
import { emitCombatEvent } from './combatEvents';
import { applyZoneCrossings } from './combatPlacement';
import { loadoutCreate, loadoutSetSlot, recomputeLoadout } from '../engine/items';
import { desDuTest } from '../engine/dice.testkit';
import type { GameOp } from '../engine/ops';
import type { Combatant } from '../engine/types';
import type { Scene } from './monde/scene';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { ouvrirLeBanc, type Banc } from './banc.testkit';

let banc: Banc;
beforeEach(() => {
  banc = ouvrirLeBanc();
});

/** Objet de campagne (id NON-colluant avec le global) : type `melee` → `kind:'melee'` distingue une
 *  vraie résolution catalogue-campagne d'un repli `customTrapping` (kind `misc`, label = id brut). */
const LAME_CAMPAGNE = 'campagne-lame-maudite';

const narratif: NarratifBlock = {
  ...emptyNarratif(),
  presetsPnj: [{ id: 'pnj-baron-caché' }],
  objets: [objetDeCampagne({ id: LAME_CAMPAGNE, label: 'Lame maudite', categorie: 'melee' })],
};

function hero(): Combatant {
  return (blessuresSurLeProfil({
    id: 'a', label: 'A', kind: 'heros',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(12), advantage: 0, conditions: [], weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: [], skills: [], talents: [], movement: 4,
  })) as unknown as Combatant;
}

/** Scène minimale (heroStart) pour un chargement de campagne par le CHEMIN RÉEL (`chargerLeProjet`). */
function fixtureScene(id = 'camp-scene'): Scene {
  const s = emptyScene('scene-test', 6, 6);
  s.id = id;
  s.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
  return s;
}

/** Charge la campagne fixture par le chemin RÉEL du noyau (pose `campaignNarratif`). */
function loadCampaign(couche = narratif, scene = fixtureScene()): void {
  banc.setState({ party: [hero()] });
  banc.getState().chargerLeProjet({ scenes: [scene], entryId: scene.id, narratif: couche, projet: null });
}

beforeEach(() => {
  banc.setState({ campaignNarratif: null, party: [], scene: null });
});

describe('campaignData — câblage giveTrapping campagne-d’abord par le chemin d’état réel (#767)', () => {
  it('giveTrapping d’un objet de campagne crée l’objet DE CAMPAGNE (kind melee) quand la couche est chargée', () => {
    loadCampaign();
    applyEffects(banc.getState, banc.setState, [{ type: 'giveTrapping', objet: { id: LAME_CAMPAGNE }, heroId: 'a' }]);
    const it = (banc.getState().party[0].items ?? []).find((i) => i.trappingId === LAME_CAMPAGNE);
    expect(it?.label).toBe('Lame maudite');
    expect(it?.kind).toBe('melee'); // objet à stats du narratif, pas un customTrapping
  });

  it('sans couche chargée : le MÊME giveTrapping tombe sur un customTrapping (kind misc) — la clé est au bon site', () => {
    banc.setState({ party: [hero()], campaignNarratif: null });
    banc.getState().lancerLaScene(fixtureScene('nu-scene'));
    applyEffects(banc.getState, banc.setState, [{ type: 'giveTrapping', objet: { id: LAME_CAMPAGNE }, heroId: 'a' }]);
    const it = (banc.getState().party[0].items ?? []).find((i) => i.label === LAME_CAMPAGNE || i.trappingId === LAME_CAMPAGNE);
    expect(it).toBeTruthy();
    expect(it?.trappingId).toBeUndefined(); // customTrapping : aucune réf catalogue
    expect(it?.kind).toBe('misc'); // pas de stats — la campagne n'est PAS chargée
  });
});

describe('#4257 — références d’objet de campagne jouées par les GameOps', () => {
  const don: GameOp = { op: 'giveTrapping', objet: { id: LAME_CAMPAGNE } };
  const invocation: GameOp = { op: 'grantWeapon', label: 'Lame invoquée', damage: 3, form: { id: LAME_CAMPAGNE } };
  const jouer = (ops: GameOp[]) => applyEffects(banc.getState, banc.setState, [{ type: 'ops', on: 'heros', heroId: 'a', ops }]);
  const objetRecu = () => banc.getState().party[0].items?.find((it) => it.trappingId === LAME_CAMPAGNE);
  const attendreLame = () => expect(objetRecu()).toMatchObject({ label: 'Lame maudite', kind: 'melee' });

  it('la forme locale de grantWeapon devient la silhouette de l’arme active', () => {
    loadCampaign();
    jouer([invocation]);
    const porteur = banc.getState().party[0];
    expect(porteur.items?.find((it) => it.conjured)).toMatchObject({ label: 'Lame invoquée', shape: { id: 'epee' } });
    expect(porteur.weapons[0]).toMatchObject({ label: 'Lame invoquée', shape: { id: 'epee' } });
  });

  it('l’effet à la touche d’une seconde arme de campagne donne la véritable lame au porteur', () => {
    const arme = {
      ...objetDeCampagne({ id: 'arme-porteuse-du-don', label: 'Arme porteuse du don' }),
      onHitEffects: [{ trigger: 'onHit', on: 'soi', flow: { kind: 'effet', effet: { type: 'ops', ops: [don] } } }],
    } satisfies NarratifBlock['objets'][number];
    loadCampaign({ ...narratif, objets: [...narratif.objets, arme] });
    applyEffects(banc.getState, banc.setState, [{ type: 'giveTrapping', objet: { id: arme.id }, heroId: 'a' }]);
    const porteur = banc.getState().party[0];
    const item = porteur.items!.find((it) => it.trappingId === arme.id)!;
    const set = loadoutCreate(porteur);
    loadoutSetSlot(porteur, set, 'main', item.uid);
    recomputeLoadout(porteur);

    const journal: string[] = [];
    expect(emitCombatEvent('onHit', {
      get: banc.getState, set: banc.setState, battle: banc.getState().battle,
      self: porteur, sink: (line) => journal.push(line), triggerCtx: { weapon: porteur.weapons[0], rng: desDuTest },
    })).toBe(1);
    attendreLame();
    expect(journal.join(' ')).toContain('Lame maudite');
  });

  it('reconstruit le résolveur de la feuille après un dé ouvert à la porte', () => {
    loadCampaign();
    jouer([
      { op: 'zone', shape: 'disc', radiusMeters: 1, durationRounds: { dice: { n: 1, sides: 10 } } },
      don,
    ]);
    expect(objetRecu()).toBeUndefined();
    const etape = banc.getState().pendingCascade!.participants[0];
    expect(etape.kind).toBe('operationsDe');
    banc.getState().jetImposerLeResultat('cascadeTirage', 4, etape.id);
    banc.getState().jetValider('cascade');
    attendreLame();
  });

  it('un souffle de scène résout le don sur le porteur réel', () => {
    loadCampaign();
    applyEffects(banc.getState, banc.setState, [{
      type: 'zoneBlast', center: banc.getState().partyPos, radius: 1, ops: [don],
    }]);
    attendreLame();
  });

  it('une zone d’auteur résout les dons à la traversée et au franchissement du Round', () => {
    const scene: Scene = {
      ...testScene(),
      effectZones: [{ id: 'zone-de-don', label: 'Zone de don', area: { kind: 'rect', x: 0, y: 0, w: 40, h: 40 }, onCross: [don], perRound: [don] }],
    };
    loadCampaign(narratif, scene);
    banc.getState().lancerLeCombat('enc-mutants', undefined, { noSurprise: true });
    const battle = banc.getState().battle!;
    const porteur = battle.combatants.find((c) => c.id === 'a')!;
    const objetsDeZone = () => porteur.items?.filter((it) => it.trappingId === LAME_CAMPAGNE);
    expect(porteur.pos).toBeDefined();

    applyZoneCrossings(banc.getState, banc.setState, porteur, [porteur.pos!]);
    expect(objetsDeZone()).toHaveLength(1);
    emitCombatEvent('onRoundEnd', {
      get: banc.getState, set: banc.setState, battle, sink: () => undefined,
      triggerCtx: { rng: desDuTest },
    });
    expect(objetsDeZone()).toHaveLength(2);
  });

  it.each([
    ['retardée', { op: 'delayed', afterMinutes: 1, ops: [don] }],
    ['récurrente', { op: 'perRound', ops: [don] }],
  ] as const)('l’horloge exécute la référence d’une opération %s', (_regime, op) => {
    loadCampaign();
    jouer([{ ...op, ops: [...op.ops] }]);
    expect(objetRecu()).toBeUndefined();
    banc.getState().avancerLeTemps(1);
    attendreLame();
  });
});

describe('#2967 — flux des objets portés de campagne', () => {
  const remettre = (id: string) => {
    applyEffects(banc.getState, banc.setState, [{ type: 'giveTrapping', objet: { id: id }, heroId: 'a' }]);
    return trouver(id)!;
  };
  const trouver = (id: string) => banc.getState().party[0].items?.find((i) => i.trappingId === id);
  const don: NonNullable<NarratifBlock['objets'][number]['consumable']> = {
    kind: 'effet', effet: { type: 'ops', ops: [{ op: 'giveTrapping', objet: { id: 'corde' } }] },
  };
  function ouvrir(...objets: NarratifBlock['objets']): void {
    const scene = fixtureScene();
    const projet = parseProject({
      type: 'projet', id: 'test-objets-portes', label: 'Objets portés', versionContenu: 1, maison: 'Test des objets portés',
      scenes: [scene], narratif: { ...emptyNarratif(), objets },
    });
    banc.setState({ party: [hero()] });
    banc.getState().chargerLeProjet({ scenes: projet.scenes, entryId: scene.id, narratif: projet.narratif, projet });
  }

  it('propose et exécute la consommation de l’objet de campagne à partir de la fiche', () => {
    const dose = objetDeCampagne({ id: 'dose-du-projet', categorie: 'trapping', subType: null, consumable: don });
    ouvrir(dose, ...narratif.objets);
    const usage = remettre(dose.id);
    const autre = remettre(LAME_CAMPAGNE);
    expect(gestesDeLObjet(banc.getState(), 'a', autre.uid)?.utiliser).toBeNull();
    expect(gestesDeLObjet(banc.getState(), 'a', usage.uid)?.utiliser).toEqual({
      refus: null, geste: { verbe: 'utiliserLObjet', args: [usage.uid] },
    });
    banc.getState().utiliserLObjet(usage.uid);
    expect(trouver(dose.id)).toBeUndefined();
    expect(trouver('corde')?.label).toBe('Corde');
  });

  it.each([true, false])('l’horloge joue le flux de l’objet de campagne selon son port (%s)', (porte) => {
    const manteau = objetDeCampagne({
      id: 'manteau-du-projet', categorie: 'trapping', subType: { id: 'vetements-et-accessoires' },
      effects: [{ trigger: 'onDayStart', on: 'soi', flow: don }],
    });
    ouvrir(manteau);
    const manteauPorte = remettre(manteau.id);
    if (porte) banc.getState().equiperLObjet(manteauPorte.uid);
    expect(trouver(manteau.id)?.equipped).toBe(porte);
    banc.getState().avancerLeTemps(MINUTES_PER_DAY);
    expect(trouver('corde')?.label).toBe(porte ? 'Corde' : undefined);
  });

  it('une dose chargée depuis la sauvegarde conserve son uid et donne un objet local après le Test du buveur', () => {
    const dose = {
      ...objetDeCampagne({ id: 'dose-differee', categorie: 'trapping', subType: null }),
      consumable: {
        kind: 'test', test: { characteristic: 'endurance', stake: { authored: 'Obtenir la Lame maudite après avoir bu la dose.' } },
        reussite: { kind: 'effet', effet: { type: 'ops', ops: [{ op: 'giveTrapping', objet: { id: LAME_CAMPAGNE } }] } },
        echec: { kind: 'sequence', etapes: [] },
      },
    } satisfies NarratifBlock['objets'][number];
    ouvrir(dose, ...narratif.objets);
    const usage = remettre(dose.id);
    const save = sauverLeBanc(banc);
    resetSceneRegistry();
    banc.setState(etatInitialDuJeu());
    expect(banc.getState().campaignNarratif).toBeNull();
    chargerSurLeBanc(banc, save);
    expect(trouver(dose.id)?.uid).toBe(usage.uid);

    const fluxSauve = banc.getState().campaignNarratif?.objets.find((o) => o.id === dose.id)?.consumable;
    expect(fluxSauve?.kind).toBe('test');
    const enjeuSauve = fluxSauve?.kind === 'test' ? fluxSauve.test.stake : undefined;
    banc.getState().utiliserLObjet(usage.uid);
    expect(banc.getState().pendingTest?.actorId).toBe('a');
    const cascade = banc.getState().pendingCascade;
    const enjeuDuJet = cascade?.participants[cascade.cursor]?.stake;
    expect(enjeuDuJet).toEqual({ authored: 'Obtenir la Lame maudite après avoir bu la dose.' });
    expect(enjeuDuJet).not.toBe(enjeuSauve);
    expect(trouver(dose.id)).toBeUndefined();
    expect(trouver(LAME_CAMPAGNE)).toBeUndefined();
    banc.getState().jetLancer('test');
    banc.getState().jetImposerLeResultat('test', 11);
    expect(banc.getState().pendingTest).toMatchObject({ roll: 11, success: true });
    banc.getState().jetValider('test');
    expect(trouver(LAME_CAMPAGNE)).toMatchObject({ label: 'Lame maudite', kind: 'melee' });
  });

  it('l’horloge de l’objet porté donne l’objet local par le même résolveur', () => {
    const manteau = {
      ...objetDeCampagne({ id: 'manteau-horloge', categorie: 'trapping', subType: { id: 'vetements-et-accessoires' } }),
      effects: [{
        trigger: 'onDayStart', on: 'soi',
        flow: { kind: 'effet', effet: { type: 'ops', ops: [{ op: 'giveTrapping', objet: { id: LAME_CAMPAGNE } }] } },
      }],
    } satisfies NarratifBlock['objets'][number];
    ouvrir(manteau, ...narratif.objets);
    banc.getState().equiperLObjet(remettre(manteau.id).uid);
    expect(trouver(LAME_CAMPAGNE)).toBeUndefined();
    banc.getState().avancerLeTemps(MINUTES_PER_DAY);
    expect(trouver(LAME_CAMPAGNE)).toMatchObject({ label: 'Lame maudite', kind: 'melee' });
  });


  it('à la touche, l’effet porté appartient à la main active de l’objet de campagne', () => {
    const source = {
      ...objetDeCampagne({ id: 'arme-effet-porte', label: 'Arme au don' }),
      effects: [{
        trigger: 'onHit', on: 'soi',
        flow: { kind: 'effet', effet: { type: 'ops', ops: [{ op: 'giveTrapping', objet: { id: LAME_CAMPAGNE } }] } },
      }],
    } satisfies NarratifBlock['objets'][number];
    ouvrir(source, ...narratif.objets);
    const set = loadoutCreate(banc.getState().party[0]);
    const arme = remettre(source.id);
    const jouerLaTouche = () => {
      const porteur = banc.getState().party[0];
      return emitCombatEvent('onHit', {
        get: banc.getState, set: banc.setState, battle: banc.getState().battle,
        self: porteur, sink: () => {}, triggerCtx: { weapon: porteur.weapons[0], rng: desDuTest },
      });
    };
    expect(banc.getState().party[0].weapons.some((w) => w.uid === arme.uid)).toBe(false);
    expect(jouerLaTouche()).toBe(0);
    expect(trouver(LAME_CAMPAGNE)).toBeUndefined();
    banc.getState().garnirLaPanoplie('a', set, 'main', arme.uid);
    expect(banc.getState().party[0].weapons[0]?.uid).toBe(arme.uid);
    expect(jouerLaTouche()).toBe(1);
    expect(trouver(LAME_CAMPAGNE)).toMatchObject({ label: 'Lame maudite', kind: 'melee' });
  });

});
