import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { scenario } from '../../scenes/test-scenarios/42-belier-porte';
import { resolveAttack, firedWeapon, firedAttackBlock, attackPlan } from '../../noyau/combatFlow';
import { placeCombatant } from '../../noyau/monde/spawn';
import { seedBattleRng } from '../../noyau/battleRng';
import { combatValue } from '../../engine/combat';
import { effectiveChar } from '../../engine/characteristics';
import { rule } from '../../engine/policy';
import { pushSlot } from '../../noyau/siegePush';
import { hoverTargeting } from '../../noyau/targeting';
import type { Combatant } from '../../engine/types';
import { chebyshev } from '../../engine/grid';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });
const scenarioConstruit = scenario.construire(idsDeTest);

/**
 * BÉLIER — PORTE : consommateur LIVE du modèle ENGIN DE SIÈGE CREWÉ (poste `ShipPoste`, ADE II 8
 * l.233) sur la Scène PRODUITE par le scénario réel (`42-belier-porte.ts`) — le Soldat SERT le bélier
 * (chef de pièce), 5 servants PNJ complètent l'Équipe de 6. `war-machine-crew.test.ts` couvre déjà la
 * mécanique PURE (`warMachineCrewPenalty`) ; ici on prouve qu'elle est bien CÂBLÉE au scénario : poste
 * authoré, `crewIds` réels (dont un HÉROS chef), résolution par Force contre une vraie porte, les 3
 * courbes d'effectif d'Équipe (complet / 3-6 / sous la moitié) — LOT 1 — et la MOBILITÉ « Pousser »
 * (ADE II 8 l.258, Lot 2 #156) : mouvement simple plafonné, formation rigide, seuil de pousseurs.
 */
function startBelier(): { soldat: Combatant; crew: Combatant[]; ram: Combatant; porte: Combatant } {
  banc.setState({ party: scenario.construire(idsDeTest).party });
  banc.getState().lancerLaScene(scenarioConstruit.scene);
  banc.getState().lancerLeCombat('siege-belier');
  banc.getState().fenetreValider('debutDuRound');
  banc.abandonner();
  const b = banc.getState().battle!;
  const ram = b.combatants.find((c) => c.postes?.length)!;
  const soldat = b.combatants.find((c) => c.kind === 'heros' && !!c.mannedPoste)!;
  const crew = (ram.postes![0].crewIds ?? []).map((id) => b.combatants.find((c) => c.id === id)!);
  const porte = b.combatants.find((c) => c.creatureId === 'porte-de-ville')!;
  return { soldat, crew, ram, porte };
}

/** Force le tour de `id` (le Soldat, chef de pièce) — la poussée exige que l'ACTIF soit le chef. */
function setActive(id: string): void {
  const b = banc.getState().battle!;
  // Tour NEUF : réinitialise l'Action ET le Mouvement (pousser consomme le Mouvement → une poussée par tour).
  banc.setState({ battle: { ...b, turn: b.order.indexOf(id), acted: false, action: null, movementUsed: 0 } });
}

describe('Bélier — porte (belier-porte) : engin de siège CREWÉ, jamais une arme portée', () => {

  it("scène : une porte-de-ville brèchable sur l'arête N de (5,4), formation ALIGNÉE en x, à 3 cases de la porte", () => {
    const s = scenarioConstruit.scene;
    expect(s.dimensions).toEqual({ w: 10, h: 15 });
    const gate = s.walls!.find((w) => w.structure === 'porte-de-ville');
    expect(gate).toMatchObject({ x: 5, y: 4, side: 'N' });
  });

  it('le Soldat SERT le bélier en POSTE (jamais dans son inventaire) : Équipe au complet (6/6), arme dérivée resolveChar=F', () => {
    const { soldat, ram, porte } = startBelier();
    expect(soldat.items?.some((i) => i.trappingId === 'belier-ade2')).toBeFalsy(); // jamais dans le loadout du héros
    expect(soldat.mannedPoste?.item.trappingId).toBe('belier-ade2');
    expect(ram.postes?.[0].crewIds).toHaveLength(6); // Équipe requise (ADE II 8 l.233)
    const belier = soldat.weapons.find((w) => w.label === 'Bélier')!;
    expect(belier).toBeTruthy();
    expect(belier.type).toBe('melee');
    expect(belier.resolveChar).toBe('force');
    expect(belier.weaponGroup).toBe('machine-de-guerre');
    expect(belier.qualities.map((q) => q.id).sort()).toEqual(['belier', 'devastatrice', 'equipe', 'percutante', 'siege'].sort());
    const w = firedWeapon(banc.getState().scene, soldat, porte, belier.uid, banc.getState().battle!.combatants);
    expect(w.crewTeamIncomplete).toBeUndefined(); // Équipe au complet → arme nette
  });

  it("le jet d'attaque du Bélier se résout sur la Force du Soldat — PAS sa CC (ADE II 8 l.233)", () => {
    const { soldat } = startBelier();
    const belier = soldat.weapons.find((w) => w.label === 'Bélier')!;
    // La CC et la Force DIVERGENT volontairement (ADE II 8 l.233 : « utilise Force ») pour désambiguïser :
    // si le moteur résolvait encore sur CC, la valeur de Test observée serait TRÈS différente.
    soldat.characteristics['capacite-de-combat'] = 20;
    soldat.characteristics.force = 65;
    expect(combatValue(soldat, 'melee', belier)).toBe(65); // Force brute, aucune Spé n'entre en jeu
    expect(combatValue(soldat, 'melee', belier)).not.toBe(effectiveChar(soldat, 'capacite-de-combat'));
  });

  it('une touche RÉUSSIE contre la porte lui inflige des Blessures (Atout Bélier + Siège, ×2 dégâts structure)', () => {
    const { soldat, ram, porte } = startBelier();
    const scene = banc.getState().scene!;
    expect(porte).toBeTruthy();
    // #210 : l'adjacence d'une pièce de MÊLÉE servie se mesure depuis l'EMPREINTE DE LA COQUE (`meleeWarMachineHullOf`),
    // pas depuis le chef qui la sert — c'est l'affût 2×2 qui doit toucher la porte, pas seulement le Soldat.
    soldat.pos = { x: 5, y: 5 };
    placeCombatant(soldat, scene, soldat.pos);
    ram.pos = { x: 6, y: 5 };
    placeCombatant(ram, scene, ram.pos);
    soldat.characteristics.force = 90; // Test quasi-garanti (Force très haute), aucune Spé requise (raw characteristic)
    seedBattleRng(1);
    // Arme EXPLICITE (Bélier) : le Soldat garde SON arme personnelle en plus du poste servi (kind-agnostique,
    // comme un canonnier qui garde sa dague) — l'auto-sélection `attackWeapon` prendrait sinon sa propre arme.
    const belier = soldat.weapons.find((w) => w.label === 'Bélier')!;
    const r = resolveAttack(() => banc.getState(), soldat, porte, undefined, false, false, false, firedWeapon(banc.getState().scene, soldat, porte, belier.uid, banc.getState().battle!.combatants));
    expect(r).not.toBeNull();
    expect(r!.weapon.resolveChar).toBe('force'); // le jet qui vient de se résoudre était bien un Test de Force
    expect(r!.res.hit).toBe(true); // Force 90 → Test quasi-garanti
    expect(r!.res.woundsLost ?? 0).toBeGreaterThan(0); // la porte encaisse RÉELLEMENT (Atout Siège ×2 dégâts structure)
  });

  it('Équipe incomplète (3/6, ≥ moitié) : −20 baké, mais toujours UTILISABLE', () => {
    const { soldat, crew, porte } = startBelier();
    // Neutralise 3 des 5 servants PNJ (jamais le chef) → 3/6 restants (chef + 2 servants).
    for (const c of crew.filter((x) => x.id !== soldat.id).slice(0, 3)) c.wounds = { ...c.wounds, current: 0 };
    const belier = soldat.weapons.find((w) => w.label === 'Bélier')!;
    const w = firedWeapon(banc.getState().scene, soldat, porte, belier.uid, banc.getState().battle!.combatants);
    expect(w.crewTeamIncomplete).toBe(true);
    expect(firedAttackBlock(() => banc.getState(), soldat, porte, belier.uid)).toBeNull(); // toujours utilisable
  });

  it("sous la moitié (2/6) : INUTILISABLE — firedAttackBlock refuse l'attaque", () => {
    const { soldat, crew, porte } = startBelier();
    // Neutralise 4 des 5 servants PNJ (jamais le chef) → 2/6 restants (chef + 1 servant, < moitié).
    for (const c of crew.filter((x) => x.id !== soldat.id).slice(0, 4)) c.wounds = { ...c.wounds, current: 0 };
    const belier = soldat.weapons.find((w) => w.label === 'Bélier')!;
    const block = firedAttackBlock(() => banc.getState(), soldat, porte, belier.uid);
    expect(block).toMatchObject({ reason: 'sous-effectif' });
  });

  // ── Lot 2 (#156) : MOBILITÉ — « Pousser » l'engin (ADE II 8 l.258, mouvement simple, aucun jet) ──

  it("gate de la case « Pousser » (console via `pushSlot`, GAP intégration UI) : visible pour le CHEF, absent pour un héros sans poste, désactivé sous-effectif", () => {
    const { soldat, crew } = startBelier();
    const combatants = banc.getState().battle!.combatants;
    // CHEF d'un engin mobile → bouton VISIBLE et actif (Équipe complète 6/6).
    expect(pushSlot(soldat, combatants)).toEqual({ show: true, undercrew: false });
    // Un autre héros du groupe (ne sert AUCUN poste) → aucun bouton.
    const other = combatants.find((c) => c.kind === 'heros' && !c.mannedPoste)!;
    expect(other).toBeTruthy();
    expect(pushSlot(other, combatants)).toEqual({ show: false, undercrew: false });
    // Sous la moitié de l'Équipe (2/6) → bouton VISIBLE mais DÉSACTIVÉ (parité tir sous-effectif).
    for (const c of crew.filter((x) => x.id !== soldat.id).slice(0, 4)) c.wounds = { ...c.wounds, current: 0 };
    expect(pushSlot(soldat, combatants)).toEqual({ show: true, undercrew: true });
  });

  it("pousserLEngin peuple `battle.reachable` de cases VALIDES (aperçu de portée non vide) — pas seulement le commit", () => {
    const { soldat } = startBelier();
    setActive(soldat.id);
    const start = { ...soldat.pos! };
    banc.getState().pousserLEngin();
    const reach = banc.getState().battle!.reachable;
    // Non vide ET porte des DESTINATIONS réelles (pas seulement la case de départ) : le joueur voit où pousser.
    expect(reach.size).toBeGreaterThan(1);
    const destinations = [...reach.keys()].filter((k) => k !== `${start.x},${start.y}`);
    expect(destinations.length).toBeGreaterThan(0);
    // Toutes dans le plafond maison (chebyshev ≤ vitesse de poussée) depuis la case du chef.
    const cap = Number(rule('engin-de-siege-vitesse-de-poussee'));
    for (const k of reach.keys()) {
      const [x, y] = k.split(',').map(Number);
      expect(chebyshev({ x, y }, start)).toBeLessThanOrEqual(cap);
    }
    // La case juste au nord (vers la porte) EST une destination proposée.
    expect(reach.has(`${start.x},${start.y - 1}`)).toBe(true);
    // Toggle (parité cast/heal) : re-cliquer la case « Pousser » (son geste armé, `desarmerLeMode`) ferme le mode sans
    // consommer l'Action.
    banc.jouerLaCase('poussee');
    expect(banc.getState().battle!.action).toBeNull();
    expect(banc.getState().battle!.reachable.size).toBe(0);
    expect(banc.getState().battle!.acted).toBe(false);
  });

  it("le CHEF pousse → l'engin ET tous les servants translatent du MÊME delta (formation rigide, comme avancerLeNavire)", () => {
    const { soldat, crew, ram } = startBelier();
    setActive(soldat.id);
    const movers = [ram, ...crew];
    const before = new Map(movers.map((c) => [c.id, { ...c.pos! }]));
    banc.getState().pousserLEngin();
    expect(banc.getState().battle!.action).toBe('poussee');
    const dest = { x: soldat.pos!.x, y: soldat.pos!.y - 2 };
    banc.getState().cliquerLaCase(dest);
    const delta = { x: dest.x - before.get(soldat.id)!.x, y: dest.y - before.get(soldat.id)!.y };
    expect(delta).toEqual({ x: 0, y: -2 });
    for (const c of movers) {
      const b = before.get(c.id)!;
      expect(c.pos).toEqual({ x: b.x + delta.x, y: b.y + delta.y }); // MÊME delta pour l'engin ET chaque servant
    }
    // Consomme le MOUVEMENT du chef (pas l'Action, LDB 13 l.106) ; chaque servant paiera le sien à son tour
    // (loseNextMovement) ; l'engin reste SANS tour (inert, jamais dans battle.order).
    expect(banc.getState().battle!.action).toBeNull();
    expect(banc.getState().battle!.acted).toBe(false); // pousser = Mouvement, l'Action reste libre
    expect(banc.getState().battle!.movementUsed).toBeGreaterThan(0); // le Mouvement du chef est dépensé
    for (const c of crew.filter((x) => x.id !== soldat.id)) expect(c.loseNextMovement).toBe(true); // servants : Mouvement à leur tour
    expect(banc.getState().battle!.order).not.toContain(ram.id);
  });

  it('portée de poussée PLAFONNÉE à la vitesse maison (`engin-de-siege-vitesse-de-poussee`, défaut 2 cases) — RAW muet, ADE II 8 l.258', () => {
    const { soldat, ram } = startBelier();
    setActive(soldat.id);
    const cap = Number(rule('engin-de-siege-vitesse-de-poussee'));
    expect(cap).toBe(2);
    const start = { ...soldat.pos! };
    banc.getState().pousserLEngin();
    // Hors de portée (cap+1) : la case n'est même pas dans `battle.reachable` → le clic est ignoré, personne ne bouge.
    const tooFar = { x: start.x, y: start.y - (cap + 1) };
    expect(banc.getState().battle!.reachable.has(`${tooFar.x},${tooFar.y}`)).toBe(false);
    banc.getState().cliquerLaCase(tooFar);
    expect(soldat.pos).toEqual(start);
    expect(banc.getState().battle!.action).toBe('poussee'); // toujours ouvert : ce n'était pas un commit
    // Dans la portée (exactement le plafond) : le clic commet.
    const atCap = { x: start.x, y: start.y - cap };
    banc.getState().cliquerLaCase(atCap);
    expect(soldat.pos).toEqual(atCap);
    expect(ram.pos).toEqual({ x: atCap.x + 1, y: atCap.y }); // offset relatif chef↔engin préservé
  });

  it('seuil de pousseurs (ADE II 8 l.233, MÊME seuil que le tir) : 3/6 (≥ moitié) autorise, 2/6 (sous la moitié) refuse', () => {
    const { soldat: soldatA, crew: crewA } = startBelier();
    setActive(soldatA.id);
    for (const c of crewA.filter((x) => x.id !== soldatA.id).slice(0, 3)) c.wounds = { ...c.wounds, current: 0 }; // 3/6 restants
    banc.getState().pousserLEngin();
    expect(banc.getState().battle!.action).toBe('poussee'); // effectif suffisant → poussée ouverte

    banc.setState({ battle: null });
    const { soldat: soldatB, crew: crewB } = startBelier();
    setActive(soldatB.id);
    for (const c of crewB.filter((x) => x.id !== soldatB.id).slice(0, 4)) c.wounds = { ...c.wounds, current: 0 }; // 2/6 restants
    banc.getState().pousserLEngin();
    expect(banc.getState().battle!.action).toBeNull(); // sous la moitié → poussée IMPOSSIBLE (comme un tir sous-effectif)
  });

  it("EXACTEMENT 2 poussées plein Nord (cap 2, cases 2 puis 1) amènent l'empreinte au contact DIRECT de la porte (anti-régression du grind)", () => {
    const { soldat, ram, porte } = startBelier();
    const pushBy = (dy: number) => {
      setActive(soldat.id);
      banc.getState().pousserLEngin();
      banc.getState().cliquerLaCase({ x: soldat.pos!.x, y: soldat.pos!.y - dy });
    };
    // Départ (3 cases d'écart) : hors d'Allonge, la porte étant inanimée (jamais de Charge/approche implicite).
    expect(attackPlan(() => banc.getState(), soldat, porte).kind).toBe('bloque');
    pushBy(2); // (3,8) → (3,6) : reliquat de 1 case restant, toujours hors d'Allonge
    expect(attackPlan(() => banc.getState(), soldat, porte).kind).toBe('bloque');
    pushBy(1); // (3,6) → (3,5) : contact — la 2e poussée suffit
    expect(soldat.pos).toEqual({ x: 3, y: 5 });
    expect(ram.pos).toEqual({ x: 4, y: 5 }); // formation rigide : offset chef↔engin inchangé après 2 poussées cumulées
    // Contact DIRECT (dx=0) : la case (5,5) de l'empreinte 2×2 (colonnes 4-5) est juste au Nord de la porte (5,4).
    expect(attackPlan(() => banc.getState(), soldat, porte).kind).toBe('attaque');
  });

  it("après avoir POUSSÉ la formation jusqu'à la porte (2 poussées, cap 2), le bélier l'assène (Force + Blessures)", () => {
    const { soldat: avant, ram, porte } = startBelier();
    avant.characteristics.force = 90; // Test quasi-garanti (indépendant de la mobilité testée ici)
    // La Force déplace le maximum des Blessures : l'écriture suivante copie le soldat, il se relit par son id.
    const lu = () => banc.getState().battle!.combatants.find((c) => c.id === avant.id)!;
    const pushBy = (dy: number) => {
      setActive(avant.id);
      banc.getState().pousserLEngin();
      banc.getState().cliquerLaCase({ x: lu().pos!.x, y: lu().pos!.y - dy });
    };
    pushBy(2); // (3,8) → (3,6)
    pushBy(1); // (3,6) → (3,5) : adjacente DIRECTE à la porte (arête N de (5,4), dx=0)
    const soldat = lu();
    expect(soldat.pos).toEqual({ x: 3, y: 5 });
    expect(ram.pos).toEqual({ x: 4, y: 5 }); // formation rigide : offset chef↔engin inchangé après 2 poussées cumulées
    seedBattleRng(1);
    const belier = soldat.weapons.find((w) => w.label === 'Bélier')!;
    const r = resolveAttack(() => banc.getState(), soldat, porte, undefined, false, false, false, firedWeapon(banc.getState().scene, soldat, porte, belier.uid, banc.getState().battle!.combatants));
    expect(r).not.toBeNull();
    expect(r!.res.hit).toBe(true); // Force 90 → Test quasi-garanti
    expect(r!.res.woundsLost ?? 0).toBeGreaterThan(0); // la porte encaisse RÉELLEMENT, après le trajet poussé
  });

  // ── Addendum (retour utilisateur) : « un intent, une entrée » — l'option générique 'arme' et
  // l'option dédiée « Servir <pièce> » ne se recouvrent JAMAIS pour une pièce de mêlée servie. ──

  it("option générique « Attaque » (auto, SANS weaponUid) : jamais le Bélier, même coque adjacente et chef loin — réservé à « Servir »", () => {
    const { soldat, porte } = startBelier();
    const pushBy = (dy: number) => {
      setActive(soldat.id);
      banc.getState().pousserLEngin();
      banc.getState().cliquerLaCase({ x: soldat.pos!.x, y: soldat.pos!.y - dy });
    };
    pushBy(2);
    pushBy(1); // coque adjacente à la porte ; le chef (3,5) en reste à distance 2
    const belier = soldat.weapons.find((w) => w.label === 'Bélier')!;
    const w = firedWeapon(banc.getState().scene, soldat, porte, undefined, banc.getState().battle!.combatants);
    expect(w.uid).not.toBe(belier.uid); // jamais auto-choisi
    expect(w.type).toBe('melee'); // une arme PERSONNELLE (ou le repli générique), jamais la pièce
  });

  it('option DÉDIÉE « Servir le Bélier » (weaponUid explicite) : le Bélier reste choisi, géométrie de la coque (non-régression)', () => {
    const { soldat, ram, porte } = startBelier();
    ram.pos = { x: 6, y: 5 };
    placeCombatant(ram, banc.getState().scene!, ram.pos);
    soldat.pos = { x: 0, y: 0 }; // chef très loin — hors-sujet pour la pièce servie
    placeCombatant(soldat, banc.getState().scene!, soldat.pos);
    const belier = soldat.weapons.find((w) => w.label === 'Bélier')!;
    const w = firedWeapon(banc.getState().scene, soldat, porte, belier.uid, banc.getState().battle!.combatants);
    expect(w.uid).toBe(belier.uid);
  });

  it("survol (hover/aim) : « Servir le Bélier » sélectionné → libellé de compétence « Force » ; « Attaque » générique → l'arme personnelle du chef (jamais « Force »)", () => {
    const { soldat, porte } = startBelier();
    const pushBy = (dy: number) => {
      setActive(soldat.id);
      banc.getState().pousserLEngin();
      banc.getState().cliquerLaCase({ x: soldat.pos!.x, y: soldat.pos!.y - dy });
    };
    pushBy(2);
    pushBy(1); // coque adjacente (le clic « Servir » doit fonctionner sans approche)
    setActive(soldat.id);
    const b = () => banc.getState().battle!;
    banc.setState({ battle: { ...b(), selectedAttack: 'poste' } });
    const hoverPoste = hoverTargeting(() => banc.getState(), soldat, porte);
    expect(hoverPoste.kind).toBe('ok');
    expect((hoverPoste as { skill?: string }).skill).toMatch(/^Force/); // Force (armes-de-siege) : attackTestLabel + subType
    banc.setState({ battle: { ...b(), selectedAttack: 'arme' } });
    const hoverArme = hoverTargeting(() => banc.getState(), soldat, porte);
    expect((hoverArme as { skill?: string }).skill).not.toMatch(/^Force/);
  });
});
