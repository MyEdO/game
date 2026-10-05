import { describe, it, expect, beforeEach } from 'vitest';
import { evalCondition, flowHasTest, flowEffects } from '../../state/flow';
import { validateScene } from '../../state/validateScene';
import { useGame } from '../../state/store';
import { runFlow, assignGearAt } from '../../state/combatEffects';
import { layerTiles } from '../../state/scene';
import { scenario } from './piege-caveau';
const scenarioConstruit = scenario.construire();

/**
 * « Le Caveau piégé » est du CONTENU pur (données éditeur), désormais produit par `buildScene(MapSpec)`
 * (grille ASCII z0 pour les murs 'mur', entités/triggers déclaratifs). Ce gate prouve que la Scene PRODUITE
 * garde la géométrie attendue (périmètre + cloison + trouée de herse) et que la VITRINE Flow+Condition est
 * cohérente sur le vrai moteur : la condition composée de la herse (clé OU levier, ET NON alarme) évalue
 * correctement, et la dalle piégée est bien un Test à branches.
 */
describe('Scénario « Le Caveau piégé » : vitrine Flow + Condition', () => {
  const scene = scenarioConstruit.scene;
  const herse = scene.triggers.find((t) => t.id === 'herse')!;
  const dalle = scene.triggers.find((t) => t.id === 'dalle-piegee')!;
  const withKey = [{ items: [{ label: 'Clef', trappingId: 'clef' }] }];
  const at = (flags: Record<string, boolean>, party: { items: { label: string; trappingId: string }[] }[] = []) =>
    evalCondition(herse.when!, { flags, gameTime: 0, party });

  it('la Scene produite garde ses dimensions, base pierre et murs (périmètre + cloison, trouée en (10,5))', () => {
    expect(scene.dimensions).toEqual({ w: 14, h: 10 });
    const tiles = layerTiles(scene, 0);
    const at0 = (x: number, y: number) => tiles[y * 14 + x];
    expect(at0(2, 5)).toBe('pierre'); // sol intérieur (départ héros)
    expect(at0(0, 0)).toBe('mur'); // coin de périmètre
    expect(at0(7, 0)).toBe('mur'); // bord haut
    expect(at0(10, 3)).toBe('mur'); // cloison du trésor
    expect(at0(10, 5)).toBe('pierre'); // la trouée = la herse (pas un mur)
  });

  it('passe validateScene sans erreur', () => {
    expect(validateScene([scene]).filter((w) => w.level === 'error')).toEqual([]);
  });

  it('la herse : (TIENT la clé OU levier) ET NON alarme — toutes les combinaisons', () => {
    expect(at({})).toBe(false); // rien, pas la clé
    expect(at({}, withKey)).toBe(true); // tenir la clé suffit (hasItem)
    expect(at({ levier_tire: true })).toBe(true); // le levier suffit
    expect(at({ levier_tire: true }, withKey)).toBe(true); // les deux
    expect(at({ alarme: true }, withKey)).toBe(false); // l’alarme verrouille (NON alarme), clé en main ou non
    expect(at({ levier_tire: true, alarme: true })).toBe(false);
    expect(at({ alarme: true })).toBe(false);
  });

  it('la dalle piégée est un Test à branches (réussite / échec)', () => {
    expect(flowHasTest(dalle.flow)).toBe(true);
  });

  it('le levier pose son flag (runtime) ; la clé donne « Clé en fer » lu par la herse (hasItem)', () => {
    const levier = scene.entities.find((e) => e.id === 'levier')!;
    const cle = scene.entities.find((e) => e.id === 'cle')!;
    useGame.setState({ battle: null, flags: {}, party: scenario.construire().party, scene });
    runFlow(useGame.getState, useGame.setState, levier.usable!.actions![0].flow);
    expect(useGame.getState().flags.levier_tire).toBe(true);
    // la fouille de la clé donne la Clef du catalogue — c'est elle que la condition hasItem de la herse lit.
    expect(flowEffects(cle.usable!.actions![0].flow).some((e) => e.type === 'giveTrapping' && e.trappingId === 'clef')).toBe(true);
  });

  it('le coffre donne une ARME de catalogue (LDB 62 l.125-127), Précise et non identifiée, tenable en main', () => {
    const tresor = scene.entities.find((e) => e.id === 'tresor')!;
    useGame.setState({ battle: null, flags: {}, party: scenario.construire().party, scene, pendingLoot: null });
    runFlow(useGame.getState, useGame.setState, tresor.usable!.actions![0].flow);
    const gear = useGame.getState().pendingLoot!.gear;
    expect(gear.length).toBe(1);
    const heroId = useGame.getState().party[0].id;
    const avant = new Set((useGame.getState().party[0].items ?? []).map((i) => i.uid)); // le héros porte déjà l'équipement de sa carrière
    assignGearAt(useGame.getState, useGame.setState, 'pendingLoot', 0, heroId);
    const hero = useGame.getState().party.find((h) => h.id === heroId)!;
    const lame = hero.items!.find((i) => !avant.has(i.uid));
    expect(lame).toBeDefined();
    expect(lame!.trappingId).toBe('arme-simple');
    expect(lame!.kind).toBe('melee'); // une FICHE d'arme, pas une étiquette custom (kind 'misc', sans Dégâts)
    expect(lame!.damage).toEqual({ plusBF: true, flat: 4 });
    expect(lame!.qualities.map((q) => q.id)).toContain('precise');
    expect(lame!.identified).toBe(false);
    // tenue en main (loadout actif) → elle devient une arme JOUABLE, qualité Précise comprise
    useGame.getState().setLoadoutSlot(heroId, hero.activeLoadoutId!, 'main', lame!.uid);
    const armed = useGame.getState().party.find((h) => h.id === heroId)!;
    const w = armed.weapons.find((x) => x.uid === lame!.uid);
    expect(w).toBeDefined();
    expect(w!.qualities.map((q) => q.id)).toContain('precise');
  });

  beforeEach(() => useGame.setState({ battle: null, flags: {}, pendingTest: null }));
});
