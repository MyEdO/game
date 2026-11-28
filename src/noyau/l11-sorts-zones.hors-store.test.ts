/**
 * L11 — sorts à ZONE PERSISTANTE (LDB 47) : Mur de feu (« Quiconque traverse le mur de feu
 * gagne 1 État En flammes et subit une frappe de BFM Dégâts ») et Grands feux d'U'Zhul
 * (« le feu continue de brûler dans la ZdE pour la durée du Sort »).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { ligneDeTexte } from '../engine/journal';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { applyCast, castCommitZone, castZoneSpell, zoneRadiusTilesAt } from './combatFlow';
import { wardedAgainst, organicProjectile } from './combat/hitModifiers';
import { sceneMetresPerTile, emptyScene } from './monde/scene';
import { createHero } from '../engine/character';
import { findSpellById } from '../data';
import { testScene } from '../scenes/test-fixture';
import type { CastResult, MissileResult } from '../engine/magic';
import type { Combatant, Weapon } from '../engine/types';
import type { GameOp } from '../engine/ops';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc({ desFixes: true }); });

describe('L11 — zones persistantes posées par les sorts', () => {
  function setup() {
    const W = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'W', seed: 3 });
    banc.setState({ party: [W] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    banc.getState().ensemencerLeTirage(5);
    const b = banc.getState().battle!;
    const caster = b.combatants.find((c) => c.label === 'W')!;
    caster.skills.push({ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 70 });
    caster.characteristics['force-mentale'] = 40; // BFM 4
    caster.pos = { x: 5, y: 10 };
    const T = b.combatants.filter((c) => c.kind === 'ennemi')[0];
    T.pos = { x: 10, y: 10 };
    return { caster, T };
  }

  it('Mur de feu : mur perpendiculaire centré sur la cible, durée (BFM) Rounds, onCross armé', () => {
    const { caster, T } = setup();
    const ok: CastResult = { cast: true, roll: 30, target: 70, sl: 6, isCritical: false, isFumble: false, log: ligneDeTexte('ok') };
    applyCast(banc.getState, banc.setState, caster, [T], findSpellById('mur-de-feu')!, ok, false);
    const wall = (banc.getState().battle!.zones ?? []).find((z) => z.label === 'Mur de feu')!;
    expect(wall).toBeTruthy();
    expect(wall.rounds).toBe(4); // (BFM 4) Rounds
    expect(wall.onCross?.some((o) => o.op === 'condition' && o.id.id === 'en-flammes')).toBe(true);
    // axe O→E → mur VERTICAL passant par la cible ; longueur : BFM 4 m + 3 paliers (+2 DR) × 4 m = 16 m → 8 cases
    expect(wall.tiles.every((t) => t.x === 10)).toBe(true);
    expect(wall.tiles).toHaveLength(8);
    expect(wall.tiles.some((t) => t.y === 10)).toBe(true);
    expect(wall.casterId).toBe(caster.id);
  });

  it('Forêt d’épines : onCross Empêtré porte escapeStrength = FM du lanceur (LDB 48 l.749)', () => {
    const { caster } = setup();
    castZoneSpell(banc.getState, banc.setState, caster, 'foret-d-epines');
    banc.getState().jetLancer('incantation');
    banc.getState().jetImposerLeResultat('incantation', 3);
    banc.getState().jetValider('incantation');
    castCommitZone(banc.getState, banc.setState, { x: 8, y: 10 });
    const zone = (banc.getState().battle!.zones ?? []).find((z) => z.label === 'Forêt d\'épines')!;
    expect(zone).toBeTruthy();
    const empetreOp = zone.onCross?.find((o): o is Extract<GameOp, { op: 'condition' }> => o.op === 'condition' && o.id.id === 'empetre');
    expect(empetreOp?.escapeStrength).toEqual({ charOf: 'force-mentale' });
  });

  it('Bouclier anti-flèches / Dôme : auras posées par le cast ; géométrie intérieur/extérieur', () => {
    const { caster, T } = setup();
    const ok: CastResult = { cast: true, roll: 30, target: 70, sl: 0, isCritical: false, isFumble: false, log: ligneDeTexte('ok') };
    applyCast(banc.getState, banc.setState, caster, [caster], findSpellById('bouclier-anti-fleches')!, ok, false);
    applyCast(banc.getState, banc.setState, caster, [caster], findSpellById('dome')!, ok, false);
    const effects = caster.activeEffects ?? [];
    // Les DEUX auras déclarent leur zone par la ligne « Cible » de leur sort (`LDB 47 l.356` pour le
    // Bouclier anti-flèches, `l.408` pour le Dôme). Une ZdE est un DIAMÈTRE (`LDB 47 l.28`) : à BFM 4,
    // c'est 4 m de diamètre, donc 2 m de RAYON — jamais 4 m de rayon, une zone DEUX fois trop large.
    expect(effects.some((e) => e.arrowWard?.radiusMeters === 2)).toBe(true);
    expect(effects.some((e) => e.domeWard?.radiusMeters === 2)).toBe(true);
    // Géométrie : héros adjacent au porteur = couvert vs un tireur lointain…
    const ally = { ...caster, id: 'ally', activeEffects: [], pos: { x: 6, y: 10 } } as Combatant;
    const combatants = [caster, ally, T];
    const terre = banc.getState().scene;
    const mer = { ...terre!, metresPerTile: 10 };
    expect(wardedAgainst(combatants, T, ally, 'arrowWard', terre)).toBe(true);
    // …mais un attaquant DANS la zone n'est pas gêné (le projectile n'« entre » pas).
    const inside = { ...T, id: 'in', pos: { x: 5, y: 11 } } as Combatant;
    expect(wardedAgainst([caster, ally, inside], inside, ally, 'arrowWard', terre)).toBe(false);
    // ÉCHELLE DE LA SCÈNE (#1507) : l'aura reste chiffrée en MÈTRES, et sa conversion en cases est la
    // primitive partagée (`porteeEnCases`, plancher d'UNE case — formule verrouillée par
    // `echelle-de-scene.test.ts`). Avec la ZdE du RAW (4 m de DIAMÈTRE → 2 m de rayon), ce rayon tient
    // dans UNE case à toute échelle : un allié à DEUX cases n'est couvert ni à terre ni en mer. Le
    // contraste « couvert à terre, découvert en mer » que ces lignes montraient tenait à un rayon de
    // 4 m — la zone DOUBLÉE que ce lot corrige (LDB 47 l.28 : une ZdE est un diamètre).
    const loin = { ...caster, id: 'loin', activeEffects: [], pos: { x: 7, y: 10 } } as Combatant;
    expect(wardedAgainst([caster, loin, T], T, loin, 'arrowWard', terre)).toBe(false);
    expect(wardedAgainst([caster, loin, T], T, loin, 'arrowWard', mer)).toBe(false);
    // …et la case ADJACENTE au porteur reste couverte à toute échelle (plancher d'UNE case).
    expect(wardedAgainst(combatants, T, ally, 'arrowWard', mer)).toBe(true);
  });

  it('gabarit de zone : 4 m de rayon = 2 cases à 2 m/case, 0 case à 10 m/case', () => {
    const mptTerre = sceneMetresPerTile(emptyScene('scene-test', 1, 1));
    expect([mptTerre, zoneRadiusTilesAt(4, 0, mptTerre)]).toEqual([2, 2]);
    expect(zoneRadiusTilesAt(4, 0, 10)).toBe(0);
    // La Surincantation « +Zone » agrandit le MÊME gabarit métrique : elle suit l'échelle elle aussi.
    expect(zoneRadiusTilesAt(4, 1, mptTerre)).toBeGreaterThan(zoneRadiusTilesAt(4, 0, mptTerre));
  });

  it('organicProjectile : flag maison Weapon.organicProjectile — flèches/carreaux/javelots oui, poudre/fronde/couteaux non', () => {
    const w = (organic: boolean | undefined): Weapon => ({ label: 'x', type: 'distance', damage: { plusBF: false, flat: 7 }, qualities: [], organicProjectile: organic } as unknown as Weapon);
    expect(organicProjectile(w(true))).toBe(true); // arc/arbalète/javelot (data trappings.json)
    expect(organicProjectile(w(false))).toBe(false);
    expect(organicProjectile(w(undefined))).toBe(false); // poudre noire/fronde/couteau de lancer : absent = non organique
  });

  it('Grands feux d’U’Zhul : disque (BFM m) autour de la cible touchée, perRound armé', () => {
    const { caster, T } = setup();
    const ok: CastResult & Partial<MissileResult> = {
      cast: true, roll: 30, target: 70, sl: 0, isCritical: false, isFumble: false, log: ligneDeTexte('ok'),
      hit: true, woundsLost: 0, defenderDefeated: false, location: 'corps',
    };
    applyCast(banc.getState, banc.setState, caster, [T], findSpellById('grands-feux-d-u-zhul')!, ok, true);
    const fire = (banc.getState().battle!.zones ?? []).find((z) => z.label === "Grands feux d'U'Zhul")!;
    expect(fire).toBeTruthy();
    expect(fire.rounds).toBe(4); // (BFM) Rounds
    expect(fire.perRound?.some((o) => o.op === 'wounds' && o.ignoreAP === true)).toBe(true);
    expect(fire.tiles).toHaveLength(9);
    expect(fire.tiles.some((t) => t.x === 10 && t.y === 10)).toBe(true);
  });
});
