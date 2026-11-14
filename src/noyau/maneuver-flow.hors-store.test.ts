/**
 * Flux de MANŒUVRE de créature par modale (`pendingManeuver` + `FLOWS.manoeuvre`). Un héros qui
 * possède un trait d'attaque de créature (mutation/polymorphie) active Souffle/Vomi/Langue/Regard/
 * Étreinte via la modale de jet d'ATTAQUANT ; Hurlement reste immédiat
 * (pas de jet d'attaquant). Couvre : ouverture sans jet (result===null), Lancer→Appliquer (Avantage
 * dépensé, `acted` selon l'activation, Dégâts/effets), Avantage variable du Regard (+DR → Pétrifié),
 * influence du jet d'attaquant (Résilience/Chance +1 DR).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { cliquerSurLeCombattant } from './combatOrParty';
import { offresDeLActif } from './actionRegistry';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

describe('FLOWS.manoeuvre — manœuvre de créature par modale (store)', () => {
  function setup() {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'heros')!;
    const enemies = b.combatants.filter((c) => c.kind === 'ennemi');
    enemies.slice(1).forEach((e) => (e.dead = true));
    const E = enemies[0];
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 11, y: 10 };
    E.wounds = blessuresDeBase(30, 30, E);
    E.armour = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
    const turn = b.order.indexOf(H.id);
    banc.setState({ battle: { ...b, turn, movementUsed: 0, acted: false } });
    return { H, E };
  }

  /** Active une manœuvre SPÉCIALE ciblée comme la hotbar : arme l'attaque (`armerLAttaque`) puis clique
   *  l'entité (point d'impact / victime) → la zone ouvre `pendingManeuver{targetId}` (1er clic, sans aperçu). */
  function activate(kind: string, targetId: string) {
    banc.getState().armerLAttaque(kind);
    cliquerSurLeCombattant(banc.getState, targetId);
  }

  it('Souffle : ouvrir n’ouvre PAS de jet (result===null) ; Lancer→Appliquer dépense 2 Av, Action préservée, Dégâts', () => {
    banc.getState().ensemencerLeTirage(2);
    const { H, E } = setup();
    H.traits = [{ id: 'souffle', value: 15, arg: 'feu' }];
    H.characteristics['capacite-de-tir'] = 90; // touche déterministe vs Esquive
    H.advantage = 3;
    const before = E.wounds.current;
    activate('souffle', E.id);
    const pm = banc.getState().pendingManeuver;
    expect(pm).toBeTruthy();
    expect(pm!.kind).toBe('souffle');
    expect(pm!.avantageSpent).toBe(2); // coût RAW (fixe)
    expect(pm!.result).toBeNull(); // rien n’est tiré avant Lancer
    banc.getState().jetLancer('manoeuvre');
    expect(banc.getState().pendingManeuver!.result).toBeTruthy();
    banc.getState().jetValider('manoeuvre');
    const st = banc.getState();
    expect(st.pendingManeuver).toBeNull();
    const h2 = st.battle!.combatants.find((c) => c.id === H.id)!;
    const e2 = st.battle!.combatants.find((c) => c.id === E.id)!;
    expect(h2.advantage).toBe(1); // 3 − 2
    expect(e2.wounds.current).toBeLessThan(before);
    expect(st.battle!.acted).toBe(false); // gratuite : l’Action reste
  });

  it('#3642 — depuis la barre, le Souffle s’arme par sa case, puis sa résolution touche la cible (LDB 85 l.322)', () => {
    banc.getState().ensemencerLeTirage(2);
    const { H, E } = setup();
    H.traits = [{ id: 'souffle', value: 15, arg: 'feu' }];
    H.characteristics['capacite-de-tir'] = 90;
    H.advantage = 3;
    const before = E.wounds.current;
    const s = banc.getState();
    const offre = offresDeLActif({ scene: s.scene, active: H, battle: s.battle!, netMode: s.net.mode, gameTime: s.gameTime, state: s })
      .find((o) => o.args.attackId === 'souffle' || o.args.attackKind === 'souffle')!;
    expect(offre.gate.ok, 'la case du Souffle est fermée').toBe(true);
    banc.jouerLaCase(offre.actionId, offre.args);
    cliquerSurLeCombattant(banc.getState, E.id);
    expect(banc.getState().pendingManeuver?.kind, 'le Souffle de la barre n’a ouvert aucune attaque').toBe('souffle');
    banc.getState().jetLancer('manoeuvre');
    banc.getState().jetValider('manoeuvre');
    expect(banc.getState().battle!.combatants.find((c) => c.id === E.id)!.wounds.current).toBeLessThan(before);
  });

  it('Hurlement : reste IMMÉDIAT (pas de pendingManeuver) — jets SUBIS au feed', () => {
    banc.getState().ensemencerLeTirage(2);
    const { H, E } = setup();
    H.traits = [{ id: 'hurlement-fantomatique' }];
    H.characteristics.initiative = 40;
    H.advantage = 4;
    const before = E.wounds.current;
    banc.getState().lancerLAttaqueDeZone('hurlement');
    const st = banc.getState();
    expect(st.pendingManeuver).toBeNull(); // pas de modale (pas de jet d’attaquant)
    expect(st.battle!.combatants.find((c) => c.id === E.id)!.wounds.current).toBeLessThan(before);
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.advantage).toBe(0); // tous les Av dépensés
  });

  it('Étreinte : manœuvre-Action → jetValider@manoeuvre pose `acted`', () => {
    banc.getState().ensemencerLeTirage(2);
    const { H, E } = setup();
    H.traits = [{ id: 'etreinte-glaciale' }];
    H.characteristics['capacite-de-combat'] = 90;
    H.advantage = 2;
    activate('etreinte-glaciale', E.id);
    const pm = banc.getState().pendingManeuver;
    expect(pm!.kind).toBe('etreinte');
    expect(pm!.avantageSpent).toBe(2);
    banc.getState().jetLancer('manoeuvre');
    banc.getState().jetValider('manoeuvre');
    const st = banc.getState();
    expect(st.battle!.acted).toBe(true); // Étreinte = Action (LDB 85 l.112)
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.advantage).toBe(0); // 2 − 2
  });

  it('Regard : Avantage variable → réglage maneuver.avantage à 2 ajoute +2 DR à la marge (Pétrifié)', () => {
    banc.getState().ensemencerLeTirage(2);
    const { H, E } = setup();
    H.traits = [{ id: 'regard-petrifiant' }];
    H.characteristics['capacite-de-tir'] = 95;
    H.advantage = 6;
    E.characteristics.initiative = 1;
    E.skills = E.skills.filter((s) => s.id !== 'initiative');
    activate('regard-petrifiant', E.id);
    expect(banc.getState().pendingManeuver!.avantageSpent).toBe(1); // défaut variable = 1
    banc.getState().jetRegler('manoeuvre', 'avantage', 6); // dépense tout → +6 DR
    expect(banc.getState().pendingManeuver!.avantageSpent).toBe(6);
    banc.getState().jetLancer('manoeuvre');
    banc.getState().jetValider('manoeuvre');
    const st = banc.getState();
    expect(st.battle!.acted).toBe(true); // Regard = Action (l.238)
    const e2 = st.battle!.combatants.find((c) => c.id === E.id)!;
    expect(e2.conditions.some((c) => c.id === 'petrifie') || e2.wounds.current === 0).toBe(true);
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.advantage).toBe(0); // 6 dépensés
  });

  it('réglage maneuver.avantage clampe à 1..Avantage', () => {
    const { H, E } = setup();
    H.traits = [{ id: 'regard-petrifiant' }];
    H.advantage = 3;
    activate('regard-petrifiant', E.id);
    banc.getState().jetRegler('manoeuvre', 'avantage', 99);
    expect(banc.getState().pendingManeuver!.avantageSpent).toBe(3); // plafonné à l’Avantage
    banc.getState().jetRegler('manoeuvre', 'avantage', 0);
    expect(banc.getState().pendingManeuver!.avantageSpent).toBe(1); // plancher 1
  });

  it('Résilience : forceSuccess garantit la réussite du jet d’attaquant (touche puis Dégâts)', () => {
    banc.getState().ensemencerLeTirage(2);
    const { H, E } = setup();
    H.traits = [{ id: 'souffle', value: 15, arg: 'feu' }];
    H.characteristics['capacite-de-tir'] = 1; // raterait sans Résilience
    H.advantage = 3;
    H.resilience = 1;
    const before = E.wounds.current;
    activate('souffle', E.id);
    banc.getState().jetLancer('manoeuvre');
    expect(banc.getState().pendingManeuver!.result!.success).toBe(false); // jet raté
    banc.getState().jetForcerLaReussite('manoeuvre');
    expect(banc.getState().pendingManeuver!.result!.success).toBe(true); // forcé réussi
    banc.getState().jetValider('manoeuvre');
    expect(banc.getState().battle!.combatants.find((c) => c.id === E.id)!.wounds.current).toBeLessThan(before);
  });

  it('orientation : une manœuvre CIBLÉE tourne l’attaquant vers sa cible avant l’animation', () => {
    banc.getState().ensemencerLeTirage(2);
    const { H, E } = setup();
    H.traits = [{ id: 'souffle', value: 15, arg: 'feu' }];
    H.characteristics['capacite-de-tir'] = 90;
    H.advantage = 3;
    E.pos = { x: 10, y: 9 }; // adjacente PLEIN NORD de l’attaquant (10,10)
    banc.setState({ facing: { [H.id]: 'S' } }); // dos tourné à la cible avant la manœuvre
    activate('souffle', E.id);
    banc.getState().jetLancer('manoeuvre');
    banc.getState().jetValider('manoeuvre');
    expect(banc.getState().facing[H.id]).toBe('N');
  });

  it('orientation : cible choisie MORTE avant la résolution → l’attaquant vise le centre RECENTRÉ, pas le clic périmé', () => {
    banc.getState().ensemencerLeTirage(2);
    const { H, E } = setup();
    H.traits = [{ id: 'souffle', value: 15, arg: 'feu' }];
    H.characteristics['capacite-de-tir'] = 90;
    H.advantage = 3;
    const D = banc.getState().battle!.combatants.find((c) => c.kind === 'ennemi' && c.id !== E.id)!;
    D.dead = false;
    D.wounds = blessuresDeBase(30, 30, D);
    D.pos = { x: 10, y: 11 }; // plein SUD : la cible CLIQUÉE
    E.pos = { x: 10, y: 9 }; // plein NORD : le seul ennemi encore debout à la résolution
    banc.setState({ facing: { [H.id]: 'O' } });
    activate('souffle', D.id);
    banc.getState().jetLancer('manoeuvre');
    D.dead = true; // elle tombe avant que le souffle ne parte → la zone se recentre sur le plus proche vivant
    banc.getState().jetValider('manoeuvre');
    expect(banc.getState().facing[H.id]).toBe('N');
  });
});
