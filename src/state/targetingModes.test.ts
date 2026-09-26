/**
 * Registre de modes de ciblage — l'aiguilleur `currentTargetingMode` rend le bon mode selon l'état, et
 * les modes à liste exposent les bonnes `candidates` (soin = alliés soignables ; Surincantation =
 * overcastTargetCandidates ; attaque = ennemis via l'affordance par défaut).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { currentTargetingMode, spellAffinity, TILE_MODES, TARGETING_MODES } from './targetingModes';
import { combatantClickActs } from './combatOrParty';
import { cursorCommitIntent } from './combatCursor';
import { t } from '../i18n';
import { tilePreviewAt } from './targeting';
import { runAction } from './actionRegistry';
import { flyReachable } from './path';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { spawnEnemy } from './spawn';
import { findSpellById } from '../data';
import type { ActiveEffect, Combatant } from '../engine/types';

const arena = () => {
  const w = 16, h = 12;
  return { id: 's', dimensions: { w, h }, layers: [{ z: 0, tiles: new Array(w * h).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [] } as never;
};

/** Combat 2 héros + 2 ennemis, héros actif au centre. `over` patche le `battle`. */
function combat(over: Record<string, unknown> = {}) {
  const hero = makePregens()[0]; hero.id = 'h1'; hero.pos = { x: 6, y: 6 };
  const ally = makePregens()[1]; ally.id = 'h2'; ally.pos = { x: 5, y: 6 };
  const e1 = spawnEnemy({ ref: 'brigand' }, 'e1', { x: 7, y: 6 }); // adjacent
  const e2 = spawnEnemy({ ref: 'brigand' }, 'e2', { x: 8, y: 6 });
  const battle = {
    combatants: [hero, ally, e1, e2], order: ['h1', 'h2', 'e1', 'e2'], baseOrder: ['h1', 'h2', 'e1', 'e2'],
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null, ...over,
  } as never;
  useGame.setState({ battle, scene: arena(), party: [hero, ally], pendingCleave: null, pendingDualStrike: null, pendingCast: null, pendingAttack: null, pendingSiegeAim: null, refus: null });
  return { hero, ally, e1, e2 };
}

/** Le clic d'une SURFACE réelle (curseur clavier/manette) : même porte partagée que la carte et la
 *  frise (`cursorCommitIntent` → `combatantClickActs` → `battleClickEntity`). Jamais `battleClickEntity`
 *  en direct — il court-circuiterait justement la porte qu'on mesure. */
function cliqueParLeCurseur(c: Combatant) {
  useGame.setState({ combatCursor: { tile: { ...c.pos! }, snappedId: c.id } });
  useGame.getState().commitCursor();
  useGame.setState({ combatCursor: null });
}

describe('currentTargetingMode — aiguilleur unique', () => {
  beforeEach(() => { useGame.setState({ battle: null, party: [], pendingCleave: null, pendingDualStrike: null, pendingCast: null, pendingAttack: null, pendingSiegeAim: null }); });

  it('mode NEUTRE → attaque', () => {
    combat();
    expect(currentTargetingMode(useGame.getState).id).toBe('attack');
  });
  it('action=cast → mode cast', () => {
    combat({ action: 'cast', selectedSpellId: 'carreau' });
    expect(currentTargetingMode(useGame.getState).id).toBe('cast');
  });
  it('action=heal → mode soin', () => {
    combat({ action: 'heal' });
    expect(currentTargetingMode(useGame.getState).id).toBe('heal');
  });
  it('action=dispel → mode DISSIPATION (jamais l’attaque : le clic viserait le porteur pour le frapper)', () => {
    combat({ action: 'dispel' });
    expect(currentTargetingMode(useGame.getState).id).toBe('dispel');
  });
  it('action=battery → mode bordée', () => {
    combat({ action: 'battery' });
    expect(currentTargetingMode(useGame.getState).id).toBe('battery');
  });
  it('action=teleport → mode téléportation', () => {
    combat({ action: 'teleport' });
    expect(currentTargetingMode(useGame.getState).id).toBe('teleport');
  });
  it('pendingCleave → mode Frappe Mortelle (priorité maximale)', () => {
    combat();
    useGame.setState({ pendingCleave: { attackerId: 'h1', hitIds: [], count: 0 } as never });
    expect(currentTargetingMode(useGame.getState).id).toBe('cleave');
  });
  it('pendingDualStrike → mode 2ᵉ frappe', () => {
    combat();
    useGame.setState({ pendingDualStrike: { attackerId: 'h1', offWeaponUid: 'x', mainRoll: 10 } as never });
    expect(currentTargetingMode(useGame.getState).id).toBe('dual');
  });
  it('pendingCast.pickingTargets → mode Surincantation', () => {
    combat();
    useGame.setState({ pendingCast: { casterId: 'h1', targetId: 'e1', spellId: 'carreau', missile: true, pickingTargets: true, result: { cast: true } } as never });
    expect(currentTargetingMode(useGame.getState).id).toBe('overcast');
  });
  it('pose de zone (pilonnage indirect) → mode placing-zone', () => {
    combat();
    useGame.setState({ pendingSiegeAim: { gunnerId: 'h1', weaponUid: 'w', radius: 2, rangeTiles: 10 } as never });
    expect(currentTargetingMode(useGame.getState).id).toBe('placing-zone');
  });
});

describe('candidates des modes à liste', () => {
  beforeEach(() => { useGame.setState({ battle: null, party: [], pendingCleave: null, pendingDualStrike: null, pendingCast: null, pendingAttack: null, pendingSiegeAim: null }); });

  it('soin : candidates = alliés soignables (un allié blessé adjacent)', () => {
    const { hero, ally } = combat({ action: 'heal' });
    ally.wounds.current = Math.max(0, ally.wounds.max - 4); // soignable
    useGame.setState({ battle: { ...useGame.getState().battle! } });
    const mode = currentTargetingMode(useGame.getState);
    const ids = mode.candidates!(useGame.getState, hero).map((c) => c.id);
    expect(ids).toContain('h2');
    expect(ids).not.toContain('e1'); // jamais un ennemi
  });

  it('surincantation : candidates = overcastTargetCandidates (autres ennemis en portée, hors la cible)', () => {
    const { hero } = combat();
    useGame.setState({ pendingCast: { casterId: 'h1', targetId: 'e1', spellId: 'carreau', missile: true, pickingTargets: true, result: { cast: true } } as never });
    const mode = currentTargetingMode(useGame.getState);
    const ids = mode.candidates!(useGame.getState, hero).map((c) => c.id);
    expect(ids).toContain('e2'); // l'autre ennemi en portée
    expect(ids).not.toContain('e1'); // la cible principale est exclue
    expect(ids).not.toContain('h1'); // ni le lanceur
  });

  it('attaque : l’affordance vise les ENNEMIS (réticule sur l’ennemi, none sur l’allié)', () => {
    const { hero, ally, e1 } = combat();
    const mode = currentTargetingMode(useGame.getState);
    expect(mode.affordance!(useGame.getState, hero, e1).kind).toBe('ok'); // ennemi adjacent → frappe
    expect(mode.affordance!(useGame.getState, hero, ally).kind).toBe('none'); // allié → pas une cible d'attaque
  });

  it('Frappe Mortelle : le libellé du réticule SUIT attackTestLabel (arme à Résolution alternative), jamais codé en dur (#203)', () => {
    const { hero, e1 } = combat();
    hero.weapons[0] = { ...hero.weapons[0], resolveChar: 'force' };
    useGame.setState({ pendingCleave: { attackerId: 'h1', hitIds: [], count: 0 } as never, battle: { ...useGame.getState().battle! } });
    const mode = currentTargetingMode(useGame.getState);
    const r = mode.affordance!(useGame.getState, hero, e1);
    expect(r.kind).toBe('ok');
    expect((r as { skill: string }).skill).toBe('Force');
  });

  it('2ᵉ frappe (deux armes) : le libellé du réticule SUIT attackTestLabel de l’arme SECONDAIRE, jamais codé en dur (#203)', () => {
    const { hero, e1 } = combat();
    const off = { ...hero.weapons[0], uid: 'off1', resolveChar: 'force' as const };
    hero.weapons = [...hero.weapons, off];
    useGame.setState({ pendingDualStrike: { attackerId: 'h1', offWeaponUid: 'off1', mainRoll: 10 } as never, battle: { ...useGame.getState().battle! } });
    const mode = currentTargetingMode(useGame.getState);
    const r = mode.affordance!(useGame.getState, hero, e1);
    expect(r.kind).toBe('ok');
    expect((r as { skill: string }).skill).toBe('Force');
  });
});

describe('TILE_MODES — garde structurelle : aperçu non-vide sur une tuile valide (#198)', () => {
  beforeEach(() => { useGame.setState({ battle: null, party: [], pendingCleave: null, pendingDualStrike: null, pendingCast: null, pendingAttack: null, pendingSiegeAim: null }); });

  it('catalogue = teleport + push + placing-zone, chacun avec tileValidAt/commitTile/tilePreview', () => {
    expect(TILE_MODES.map((m) => m.id).sort()).toEqual(['placing-zone', 'push', 'teleport']);
    for (const m of TILE_MODES) {
      expect(typeof m.tileValidAt).toBe('function');
      expect(typeof m.commitTile).toBe('function');
      expect(typeof m.tilePreview).toBe('function');
    }
  });

  it('teleport : tilePreview non-vide (target + chemin depuis l’actif) sur une tuile de battle.reachable', () => {
    const { hero } = combat({ action: 'teleport', reachable: new Map([['9,6', 0]]) });
    const mode = TILE_MODES.find((m) => m.id === 'teleport')!;
    const pt = { x: 9, y: 6 };
    expect(mode.tileValidAt(useGame.getState, hero, pt)).toBe(true);
    const pv = mode.tilePreview(useGame.getState, hero, pt);
    expect(pv).not.toBeNull();
    expect(pv!.target).toEqual(pt);
    expect(pv!.path).toEqual([hero.pos, pt]);
  });

  it('push : tilePreview non-vide et porte le COÛT de battle.reachable', () => {
    const { hero } = combat({ action: 'push', reachable: new Map([['8,6', 2]]) });
    const mode = TILE_MODES.find((m) => m.id === 'push')!;
    const pt = { x: 8, y: 6 };
    expect(mode.tileValidAt(useGame.getState, hero, pt)).toBe(true);
    const pv = mode.tilePreview(useGame.getState, hero, pt);
    expect(pv).not.toBeNull();
    expect(pv!.cost).toBe(2);
  });

  it('placing-zone : tilePreview non-vide (au moins un libellé de badge)', () => {
    const { hero } = combat();
    const mode = TILE_MODES.find((m) => m.id === 'placing-zone')!;
    const pv = mode.tilePreview(useGame.getState, hero, { x: 6, y: 7 });
    expect(pv).not.toBeNull();
    expect(pv!.label).toBeTruthy();
  });

  it('tilePreviewAt (sélecteur au survol, #198) : non-vide en mode PUSH sur une case atteignable, null en mode neutre (ATTACK n’a pas de tileValidAt)', () => {
    combat({ action: 'push', reachable: new Map([['8,6', 1]]) });
    expect(tilePreviewAt(useGame.getState, { x: 8, y: 6 })).not.toBeNull();
    combat({ action: null }); // mode neutre → attaque implicite, pas un mode-case
    expect(tilePreviewAt(useGame.getState, { x: 7, y: 6 })).toBeNull();
  });
});

/**
 * SORTIE de l'interlude `placing-zone` (#1411 P0-B) — UN mode, DEUX sources (sort de ZdE après jet,
 * pilonnage indirect de siège) : l'entrée du registre `place-zone-back` doit MORDRE pour les deux,
 * routée par `placingZoneOf` comme le commit l'est déjà (`commitPlacedZone`).
 */
describe('interlude `placing-zone` — la sortie du registre MORD, par source', () => {
  beforeEach(() => { useGame.setState({ battle: null, party: [], pendingCleave: null, pendingDualStrike: null, pendingCast: null, pendingAttack: null, pendingSiegeAim: null }); });

  it('PILONNAGE : la sortie referme le placeur — le pending tombe et le mode avec lui', () => {
    combat({ selectedAttack: 'servir-mortier' });
    useGame.setState({ pendingSiegeAim: { gunnerId: 'h1', weaponUid: 'w', radius: 2, rangeTiles: 10 } as never });
    expect(currentTargetingMode(useGame.getState).id).toBe('placing-zone');
    runAction('place-zone-back', useGame.getState);
    expect(useGame.getState().pendingSiegeAim, 'le placeur de siège doit être refermé').toBeNull();
    expect(useGame.getState().battle!.selectedAttack, 'l’option « Servir … » se désarme avec lui').toBeUndefined();
    expect(currentTargetingMode(useGame.getState).id).not.toBe('placing-zone');
  });

  it('SORT de zone : la MÊME sortie revient à la modale — le jet posé n’est pas perdu', () => {
    combat();
    useGame.setState({ pendingCast: { casterId: 'h1', spellId: 'carreau', result: { cast: true }, zone: { placing: true, radius: 2 } } as never });
    expect(currentTargetingMode(useGame.getState).id).toBe('placing-zone');
    runAction('place-zone-back', useGame.getState);
    expect(useGame.getState().pendingCast, 'le sort JETÉ survit : on revient à sa modale').not.toBeNull();
    expect(useGame.getState().pendingCast!.zone!.placing).toBe(false);
    expect(currentTargetingMode(useGame.getState).id).not.toBe('placing-zone');
  });
});

/**
 * TÉLÉPORTATION À L'ÉTAGE (z > 0) — l'ensemble `battle.reachable` est ÉCRIT par `flyReachable`
 * (convention `tileKey` : z=0 sans suffixe, z>0 « x,y,z ») ; le mode et le commit doivent le LIRE
 * avec la même clé, sinon plus aucune case n'est valide à l'étage — pas même celle du lanceur, qui
 * porte la sortie « Rester sur place ». La sonde bâtit l'ensemble avec le VRAI écrivain.
 */
describe('téléportation — les cases se lisent à la clé de `flyReachable`, étage compris', () => {
  const etage = () => {
    const w = 16, h = 12;
    return { id: 's', dimensions: { w, h },
      layers: [{ z: 0, tiles: new Array(w * h).fill('herbe') }, { z: 1, tiles: new Array(w * h).fill('herbe') }],
      entities: [], dialogues: [], triggers: [], encounters: [] } as never;
  };
  /** Combat armé en téléportation, lanceur posé à l'étage `z`, portée réelle depuis `flyReachable`. */
  function armer(z: number) {
    const { hero } = combat();
    hero.pos = { x: 6, y: 6, ...(z ? { z } : {}) };
    const scene = etage();
    const reachable = flyReachable(scene, hero.pos, 3, { blocked: new Set<string>() });
    useGame.setState({ scene, battle: { ...useGame.getState().battle!, action: 'teleport', reachable } as never });
    return { hero, reachable };
  }

  for (const z of [0, 1]) {
    it(`z=${z} : la case du lanceur et une voisine sont VALIDES pour le mode`, () => {
      const { hero, reachable } = armer(z);
      expect(reachable.size, 'sans case atteignable, la sonde ne mesurerait rien').toBeGreaterThan(1);
      const mode = TILE_MODES.find((m) => m.id === 'teleport')!;
      expect(mode.tileValidAt(useGame.getState, hero, { ...hero.pos! }), 'sa propre case porte la sortie « Rester sur place »').toBe(true);
      expect(mode.tileValidAt(useGame.getState, hero, { x: 7, y: 6, ...(z ? { z } : {}) })).toBe(true);
    });

    it(`z=${z} : « Rester sur place » SORT du mode, et un clic valide TÉLÉPORTE`, () => {
      const { hero } = armer(z);
      runAction('teleport-place', useGame.getState);
      expect(useGame.getState().battle!.action, 'la sortie doit désarmer la téléportation').toBeNull();
      const { hero: h2 } = armer(z);
      useGame.getState().battleClickTile({ x: 7, y: 6, ...(z ? { z } : {}) });
      expect(h2.pos).toEqual({ x: 7, y: 6, ...(z ? { z } : {}) });
      expect(useGame.getState().battle!.action).toBeNull();
      expect(hero.id).toBe(h2.id);
    });
  }
});

/**
 * LA PORTE DE CLIC (`combatantClickActs`, partagée carte/curseur/frise) ne filtre que le HORS-SUJET :
 * une cible `invalid` PASSE, pour que le commit prononce son refus. Deux garde-fous structurels.
 */
describe('porte de clic — elle laisse passer l’infaisable pour qu’il soit DIT', () => {
  beforeEach(() => { useGame.setState({ battle: null, party: [], refus: null, combatCursor: null }); });

  it('AUCUN mode à `candidates` ne se passe d’affordance (sinon sa cible invalide ne serait jamais jugée)', () => {
    const sansAffordance = TARGETING_MODES.filter((m) => m.candidates && !m.affordance).map((m) => m.id);
    expect(sansAffordance, 'un mode à candidates SANS affordance fermerait le clic sur ses non-candidats').toEqual([]);
  });

  it('sa PROPRE case ne commet rien (mode neutre) : aucun geste, aucun refus', () => {
    const { hero } = combat();
    expect(cursorCommitIntent(useGame.getState, { tile: { ...hero.pos! } }), 'se cliquer soi-même n’est pas un geste').toBeNull();
    expect(useGame.getState().refus).toBeNull();
  });
});

describe('spellAffinity — HELPFUL_TARGET_OPS (#131)', () => {
  it("Bénédiction de Sauvagerie (op cible unique critTwice, LDB 41 l.164) → 'ally'", () => {
    const spell = findSpellById('benediction-de-sauvagerie')!;
    expect(spellAffinity(spell)).toBe('ally');
  });

  it("Baume pour un esprit blessé (op cible unique suppressPsych, LDB 43 l.62) → 'ally'", () => {
    const spell = findSpellById('baume-pour-un-esprit-blesse')!;
    expect(spellAffinity(spell)).toBe('ally');
  });

  it("Malédiction de malchance (op cible unique testMod AMBIGU, amount:-10, LDB 49 l.52) reste 'any' — un malus ne doit jamais retomber en 'ally'", () => {
    const spell = findSpellById('malediction-de-malchance')!;
    expect(spellAffinity(spell)).toBe('any');
  });
});

/**
 * MODE DISSIPATION (LDB 46 l.158-162) — la cible du clic est le PORTEUR du Sort, jamais un adversaire
 * à frapper (spec HUD §1d). Le SORT reste un paramètre : commit direct quand le porteur n'en porte
 * qu'un, élection du porteur (panneau-paramètre de la console) quand il en porte plusieurs.
 */
describe('DISPEL_MODE — le clic-token élit le PORTEUR, il n’attaque jamais', () => {
  /** Marque un combattant PORTEUR de `n` Sorts permanents distincts (effets `ActiveEffect.spell`).
   *  Forme RÉELLE d'un effet actif (`bonus` et `duration` REQUIS, `engine/types.ts`) : un effet sans
   *  durée n'existe nulle part dans le jeu et fait jeter le peintre de pastilles
   *  (`gameIso/effectIcons.ts` lit `e.duration.scale`). Le type le GARDE ici. */
  function porteur(c: Combatant, n: number) {
    c.activeEffects = Array.from({ length: n }, (_, i): ActiveEffect => ({
      label: `Effet ${i + 1}`,
      bonus: 0,
      duration: { scale: 'permanent' },
      spell: { spellId: `sort-${i + 1}`, casterId: 'e2', label: `Sort ${i + 1}`, ni: 3 + i },
    }));
  }

  beforeEach(() => { useGame.setState({ battle: null, party: [], pendingDispel: null, pendingAttack: null, dispelCarrierId: null }); });

  it('deux Sorts sur le porteur → le clic ÉLIT le porteur (aucune attaque, aucun jet ouvert)', () => {
    const { hero, e1 } = combat({ action: 'dispel' });
    hero.skills.push({ id: 'langue', spec: 'magick', advances: 0 } as never);
    porteur(e1, 2);
    useGame.getState().battleClickEntity('e1');
    expect(useGame.getState().dispelCarrierId, 'le porteur est élu — le SORT reste à choisir').toBe('e1');
    expect(useGame.getState().pendingAttack, 'cliquer le porteur ne l’attaque JAMAIS en mode Dissiper').toBeNull();
    expect(useGame.getState().pendingDispel, 'rien n’est engagé tant que le paramètre n’est pas choisi').toBeNull();
  });

  it('UN seul Sort → commit DIRECT (un panneau à un choix serait du bruit)', () => {
    const { hero, e1 } = combat({ action: 'dispel' });
    hero.skills.push({ id: 'langue', spec: 'magick', advances: 0 } as never);
    porteur(e1, 1);
    useGame.getState().battleClickEntity('e1');
    expect(useGame.getState().dispelCarrierId, 'aucun paramètre à demander').toBeNull();
    expect(useGame.getState().pendingDispel).toMatchObject({ spellId: 'sort-1', spellCasterId: 'e2', ni: 3 });
  });

  it('cible SANS Sort dissipable : rien au survol, et le clic d’une SURFACE dit son refus', () => {
    const { hero, e1, e2 } = combat({ action: 'dispel' });
    hero.skills.push({ id: 'langue', spec: 'magick', advances: 0 } as never);
    porteur(e1, 2);
    const mode = currentTargetingMode(useGame.getState);
    expect(mode.affordance!(useGame.getState, hero, e2), 'invalide = le survol n’affiche rien').toMatchObject({ kind: 'invalid', reason: 'sans-sort-dissipable' });
    expect(mode.affordance!(useGame.getState, hero, e1)).toMatchObject({ kind: 'ok', title: 'Dissiper' });
    // Le clic passe par la PORTE partagée des 3 surfaces (carte/curseur/frise) : elle doit LAISSER
    // PASSER une cible invalide, sinon le commit ne prononce jamais son refus.
    expect(combatantClickActs(useGame.getState, e2), 'la porte de clic ferme la cible : le refus ne se dirait jamais').toBe(true);
    cliqueParLeCurseur(e2);
    expect(useGame.getState().refus?.texte).toBe(t('cs.refusSansSortDissipable'));
    expect(useGame.getState().dispelCarrierId).toBeNull();
    expect(useGame.getState().pendingAttack, 'jamais une attaque en mode Dissiper').toBeNull();
  });

  it('le refus ne CONSOMME rien : ni Action, ni Mouvement, ni Avantage, ni jet ouvert', () => {
    const { hero, e1, e2 } = combat({ action: 'dispel' });
    hero.skills.push({ id: 'langue', spec: 'magick', advances: 0 } as never);
    porteur(e1, 2);
    const avant = { ...useGame.getState().battle! } as unknown as Record<string, unknown>;
    const avAvantage = hero.advantage;
    cliqueParLeCurseur(e2);
    const apres = useGame.getState().battle! as unknown as Record<string, unknown>;
    expect(useGame.getState().refus?.texte, 'témoin : le refus a bien été prononcé').toBeTruthy();
    expect([apres.acted, apres.movementUsed, apres.action]).toEqual([avant.acted, avant.movementUsed, avant.action]);
    expect(hero.advantage).toBe(avAvantage);
    expect(useGame.getState().pendingCascade, 'aucune fenêtre de jet n’a été ouverte').toBeNull();
  });

  it('les CANDIDATS du mode (Tab/curseur) sont les porteurs, pas les ennemis', () => {
    const { hero, e1 } = combat({ action: 'dispel' });
    porteur(e1, 2);
    const mode = currentTargetingMode(useGame.getState);
    expect(mode.candidates!(useGame.getState, hero).map((c) => c.id)).toEqual(['e1']);
  });
});
