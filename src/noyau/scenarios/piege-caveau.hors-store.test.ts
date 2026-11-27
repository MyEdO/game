import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { evalCondition, flowHasTest, type ConditionCtx } from '../../engine/flowCore';
import { validateScene } from '../../noyau/validateScene';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { runFlow } from '../../noyau/combatEffects';
import { layerTiles } from '../../noyau/monde/scene';
import { scenario } from '../../scenes/test-scenarios/piege-caveau';
import { lancementDuScenario } from '../../scenes/test-scenarios/_shared';
import { condCtx } from '../bourseFlow';
import { lancerLeScenario } from '../lancementDeScenario';
import { draineCascade } from '../cascade.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });
const scenarioConstruit = scenario.construire(idsDeTest);

/**
 * « Le Caveau piégé » est du CONTENU pur (données éditeur), produit par `buildScene(MapSpec)`
 * (grille ASCII z0 pour les murs 'mur', entités/triggers déclaratifs). Ce gate prouve que la Scene PRODUITE
 * garde la géométrie attendue (périmètre + cloison + trouée de herse) et que la VITRINE Flow+Condition est
 * cohérente sur le vrai moteur : la condition composée de la herse (clé OU levier, ET NON alarme) évalue
 * correctement, et la dalle piégée est bien un Test à branches.
 */
describe('Scénario « Le Caveau piégé » : vitrine Flow + Condition', () => {
  const scene = scenarioConstruit.scene;
  const herse = scene.triggers.find((t) => t.id === 'herse')!;
  const dalle = scene.triggers.find((t) => t.id === 'dalle-piegee')!;
  const cleDuCaveau = scenarioConstruit.narratif!.objets[0];
  const withKey = [{ items: [{ trappingId: cleDuCaveau.id }] }];
  const at = (flags: Record<string, boolean>, party: ConditionCtx['party'] = []) =>
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
    expect(validateScene([scene], null, scenarioConstruit.narratif).filter((w) => w.level === 'error')).toEqual([]);
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

  it('le levier pose son drapeau (runtime)', () => {
    lancerLeScenario(banc.getState, banc.setState, lancementDuScenario(scenario, idsDeTest));
    expect(draineCascade(banc.getState), 'la séquence d’entrée en scène, avant tout geste').toEqual(['entreeEnScene']);
    banc.setState({ partyPos: { x: 2, y: 3 } });
    banc.getState().jouerAction('levier', 'fouiller');
    expect(banc.getState().flags.levier_tire).toBe(true);
  });

  it('ramasser la clé ouvre la herse, même si son libellé a changé', () => {
    const lancement = lancementDuScenario(scenario, idsDeTest);
    const narratif = lancement.narratif!;
    const cleRenommee = { ...narratif.objets[0], label: 'Clé ternie' };
    lancerLeScenario(banc.getState, banc.setState, { ...lancement, narratif: { ...narratif, objets: [cleRenommee] } });
    expect(banc.getState().campaignNarratif?.objets).toContainEqual(cleRenommee);
    expect(evalCondition(herse.when!, condCtx(banc.getState))).toBe(false);
    expect(draineCascade(banc.getState), 'la séquence d’entrée en scène, avant tout geste').toEqual(['entreeEnScene']);

    banc.setState({ partyPos: { x: 2, y: 7 } });
    banc.getState().jouerAction('cle', 'fouiller');
    const ligne = banc.getState().pendingLoot?.gear[0];
    expect(ligne).toMatchObject({ label: cleRenommee.label, effect: { objet: { id: cleDuCaveau.id } } });
    const porteur = banc.getState().party[0].id;
    banc.getState().fenetreChoisir('butin', 'ligne', ligne!.uid, porteur);

    expect(banc.getState().party[0].items).toContainEqual(expect.objectContaining({
      trappingId: cleDuCaveau.id, label: cleRenommee.label,
    }));
    expect(evalCondition(herse.when!, condCtx(banc.getState))).toBe(true);
  });

  it('le coffre donne une ARME de catalogue (LDB 62 l.125-127), Précise et non identifiée, tenable en main', () => {
    const tresor = scene.entities.find((e) => e.id === 'tresor')!;
    banc.setState({ battle: null, flags: {}, party: scenario.construire(idsDeTest).party, scene, pendingLoot: null });
    runFlow(banc.getState, banc.setState, tresor.usable!.actions![0].flow);
    const gear = banc.getState().pendingLoot!.gear;
    expect(gear.length).toBe(1);
    const heroId = banc.getState().party[0].id;
    const avant = new Set((banc.getState().party[0].items ?? []).map((i) => i.uid)); // le héros porte déjà l'équipement de sa carrière
    banc.getState().fenetreChoisir('butin', 'ligne', gear[0].uid, heroId);
    const hero = banc.getState().party.find((h) => h.id === heroId)!;
    const lame = hero.items!.find((i) => !avant.has(i.uid));
    expect(lame).toBeDefined();
    expect(lame!.trappingId).toBe('arme-simple');
    expect(lame!.kind).toBe('melee'); // une FICHE d'arme, pas une étiquette custom (kind 'misc', sans Dégâts)
    expect(lame!.damage).toEqual({ plusBF: true, flat: 4 });
    expect(lame!.qualities.map((q) => q.id)).toContain('precise');
    expect(lame!.identified).toBe(false);
    // tenue en main (loadout actif) → elle devient une arme JOUABLE, qualité Précise comprise
    banc.getState().garnirLaPanoplie(heroId, hero.activeLoadoutId!, 'main', lame!.uid);
    const armed = banc.getState().party.find((h) => h.id === heroId)!;
    const w = armed.weapons.find((x) => x.uid === lame!.uid);
    expect(w).toBeDefined();
    expect(w!.qualities.map((q) => q.id)).toContain('precise');
  });

  beforeEach(() => banc.setState({ battle: null, flags: {}, pendingTest: null }));
});
