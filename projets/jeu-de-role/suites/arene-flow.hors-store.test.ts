import { idsDeTest } from '../../../src/engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from '../../../src/noyau/banc.testkit';
import { runFlow } from '../../../src/noyau/combatEffects';
import type { RectDeCases } from '../../../src/data/schemas/grammaire/valeurs';
import { wallBetween, type Scene, type WallSeg } from '../../../src/noyau/monde/scene';
import { evalCondition, flowEffects, type Condition } from '../../../src/engine/flowCore';
import { parseProject } from '../../../src/noyau/worldMap';
import { groupeVitrineDeScenario } from '../../../src/scenes/test-scenarios/_heros';
import { lireProjetLivre } from '../../../scripts/source/projetLivre.mjs';
import { areneCampaign } from '../campagnes';
import { poserLaCampagne } from '../../../src/noyau/campagne.testkit';
import { campagneDuJeu } from '../../../src/noyau/campagneLivree';
import { poserLeGroupe } from '../../../src/noyau/marcheDuGroupe';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** Évalue la Condition `when` d'un choix contre l'état VIVANT (source unique evalCondition). */
const condOk = (when: Condition) => evalCondition(when, { flags: banc.getState().flags, gameTime: 0 });

/**
 * Preuve que l'arène (données pures) tourne sur le MOTEUR EXISTANT, sans code applicatif :
 * chargerLeProjet (voie de l'éditeur) → on entre sur le sol → un trigger déclenche le combat →
 * les Effets onVictory donnent argent/XP, posent le flag et transitionnent au hub → la porte
 * de la zone suivante s'ouvre (flag). Tout via des primitives déjà testées (checkTriggers,
 * lancerLeCombat, applyEffects, transition, condMet).
 */
const doc = parseProject(lireProjetLivre('jeu-de-role/campagnes/arene/arene-projet.json'));
const project: Scene[] = doc.scenes;
const zone1 = project.find((s) => s.id === 'arene-zone1')!;

describe('Arène — la boucle tourne sur le moteur existant (zéro code)', () => {
  it('chargerLeProjet démarre sur la zone d’entrée, sans combat', () => {
    banc.getState().fixerLeGroupe(groupeVitrineDeScenario(idsDeTest));
    expect(poserLaCampagne(banc.getState, campagneDuJeu(areneCampaign), 'arene-zone1')).toBeNull();
    expect(banc.getState().scene?.id).toBe('arene-zone1');
    expect(banc.getState().battle).toBeNull();
  });

  it('entrer sur le sol (dans le rect du trigger) DÉCLENCHE la rencontre', () => {
    banc.getState().fixerLeGroupe(groupeVitrineDeScenario(idsDeTest));
    expect(poserLaCampagne(banc.getState, campagneDuJeu(areneCampaign), 'arene-zone1')).toBeNull();
    poserLeGroupe(banc.getState, banc.setState, { x: 8, y: 8 }); // dans le rect de combat (x≥7) → checkTriggers
    expect(banc.getState().battle).not.toBeNull();
  });

  it('onVictory : argent + flag zone1_clear + transition vers le hub', () => {
    banc.getState().fixerLeGroupe(groupeVitrineDeScenario(idsDeTest));
    expect(poserLaCampagne(banc.getState, campagneDuJeu(areneCampaign), 'arene-zone1')).toBeNull();
    runFlow(banc.getState, banc.setState, zone1.encounters[0].onVictory!);
    expect(banc.getState().flags.zone1_clear).toBe(true);
    expect(banc.getState().scene?.id).toBe('arene-hub');
  });

  it('au hub, la porte des Ruines s’ouvre une fois la Cour nettoyée', () => {
    banc.getState().fixerLeGroupe(groupeVitrineDeScenario(idsDeTest));
    expect(poserLaCampagne(banc.getState, campagneDuJeu(areneCampaign), 'arene-zone1')).toBeNull();
    runFlow(banc.getState, banc.setState, zone1.encounters[0].onVictory!);
    const hub = banc.getState().scene!;
    const dlgHub = hub.dialogues.find((d) => d.id === 'dlg-hub')!;
    const ruines = dlgHub.nodes.flatMap((n) => n.choices).find((c) => c.label.includes('Ruines'))!;
    expect(condOk(ruines.when!)).toBe(true); // zone1_clear && !zone2_clear
  });

  it('ÉCHELLE COMPLÈTE : les 13 victoires enchaînées ouvrent chaque porte puis le titre de champion', () => {
    banc.getState().fixerLeGroupe(groupeVitrineDeScenario(idsDeTest));
    expect(poserLaCampagne(banc.getState, campagneDuJeu(areneCampaign), 'arene-zone1')).toBeNull();
    const dlgHub = project.find((s) => s.id === 'arene-hub')!.dialogues.find((d) => d.id === 'dlg-hub')!;
    const choices = dlgHub.nodes.flatMap((n) => n.choices);
    for (let n = 1; n <= 13; n++) {
      // la porte de la zone N est OUVERTE (condition satisfaite) avant sa victoire…
      const porte = choices.find((c) => c.flow && flowEffects(c.flow).some((e) => e.type === 'transition' && e.scene.id === `arene-zone${n}`))!;
      expect(condOk(porte.when!), `porte zone${n} ouverte`).toBe(true);
      // … on applique la victoire de la zone (enc principal = enc-zoneN) → flag + retour Bourg
      const z = project.find((s) => s.id === `arene-zone${n}`)!;
      const enc = z.encounters.find((e) => e.id === `enc-zone${n}`)!;
      runFlow(banc.getState, banc.setState, enc.onVictory!);
      expect(banc.getState().flags[`zone${n}_clear`], `zone${n}_clear`).toBe(true);
      expect(banc.getState().scene?.id).toBe('arene-hub');
      // … et la porte se REFERME (déjà nettoyée)
      expect(condOk(porte.when!), `porte zone${n} refermée`).toBe(false);
    }
    // le titre de champion est réclamable
    const champion = choices.find((c) => (c.when?.kind === 'flag' ? c.when.expr : '').includes('zone13_clear'))!;
    expect(condOk(champion.when!)).toBe(true);
  });

  it('ARCHITECTURE : la taverne du Bourg est cernée de murs d’arête, franchissable par sa PORTE', () => {
    banc.getState().fixerLeGroupe(groupeVitrineDeScenario(idsDeTest));
    expect(poserLaCampagne(banc.getState, campagneDuJeu(areneCampaign), 'arene-hub')).toBeNull();
    const hub = banc.getState().scene!;
    const bourg = hub.architecture?.find((body) => body.id === 'bourg');
    const taverne = bourg?.masses.find((mass) => mass.id === 'taverne');
    expect(taverne, 'la taverne porte une masse authorée').toBeTruthy();
    const isNorE = (w: WallSeg): w is WallSeg & { side: 'N' | 'E' } => w.side === 'N' || w.side === 'E';
    const foot = taverne!.footprint.reduce((box: RectDeCases, part: RectDeCases) => ({
      x: Math.min(box.x, part.x),
      y: Math.min(box.y, part.y),
      w: Math.max(box.x + box.w, part.x + part.w) - Math.min(box.x, part.x),
      h: Math.max(box.y + box.h, part.y + part.h) - Math.min(box.y, part.y),
    }), taverne!.footprint[0]);
    const perim = (hub.walls ?? []).filter(isNorE).filter(
      (w) => w.x >= foot.x - 1 && w.x <= foot.x + foot.w - 1 && w.y >= foot.y && w.y <= foot.y + foot.h,
    );
    const doors = perim.filter((w) => w.door);
    const solid = perim.filter((w) => w.structure);
    expect(doors.length, 'au moins une porte').toBeGreaterThanOrEqual(1);
    expect(solid.length, 'clôturée par des murs').toBeGreaterThan(0);
    const across = (w: WallSeg & { side: 'N' | 'E' }) => (w.side === 'N' ? { x: w.x, y: w.y - 1 } : { x: w.x + 1, y: w.y });
    expect(wallBetween(hub, solid[0].x, solid[0].y, across(solid[0]).x, across(solid[0]).y)).toBe(true);  // mur = barrière
    expect(wallBetween(hub, doors[0].x, doors[0].y, across(doors[0]).x, across(doors[0]).y)).toBe(false); // porte = passage
  });

  it('CONTRATS : la victoire au camp de Bella pose contrat_foret_fait → la prime du Maître se débloque', () => {
    banc.getState().fixerLeGroupe(groupeVitrineDeScenario(idsDeTest));
    expect(poserLaCampagne(banc.getState, campagneDuJeu(areneCampaign), 'arene-hub')).toBeNull();
    const foret = project.find((s) => s.id === 'arene-exp-foret')!;
    const bande = foret.encounters.find((e) => e.id === 'enc-foret-bande')!;
    runFlow(banc.getState, banc.setState, bande.onVictory!);
    expect(banc.getState().flags.contrat_foret_fait).toBe(true);
    const dlgHub = project.find((s) => s.id === 'arene-hub')!.dialogues.find((d) => d.id === 'dlg-hub')!;
    const prime = dlgHub.nodes.flatMap((n) => n.choices).find((c) => (c.when?.kind === 'flag' ? c.when.expr : '').includes('contrat_foret_fait'))!;
    expect(condOk(prime.when!)).toBe(true);
  });

  it('CARTE DU MONDE : le Bourg est un lieu connu (bouton 🗺️) et ses routes mènent à d’AUTRES scènes du paquet', async () => {
    const { placeOfScene, routesFrom, otherEnd, placeById } = await import('../../../src/noyau/worldMap');
    const wm = doc.worldMap!;
    const bourg = placeOfScene(wm, 'arene-hub')!;
    expect(bourg).toBeTruthy();
    const dests = new Set<string>();
    const frontier = [bourg.id];
    while (frontier.length) {
      const cur = frontier.pop()!;
      for (const r of routesFrom(wm, cur)) {
        const other = otherEnd(r, cur);
        if (!dests.has(other) && other !== bourg.id) {
          dests.add(other);
          frontier.push(other);
        }
      }
    }
    const scenes = [...dests].map((id) => placeById(wm, id)!.scene.id);
    // La population des destinations se DÉRIVE de la carte livrée, elle ne se recopie pas (#1709) :
    // une expédition ajoutée ou renommée par le générateur entre dans la mesure sans toucher ce test.
    expect(scenes.length, 'aucune destination : la carte ne mène nulle part').toBeGreaterThan(0);
    expect(scenes.filter((id) => !project.some((s) => s.id === id)), 'destination(s) sans scène au paquet').toEqual([]);
    expect(scenes).not.toContain(bourg.scene.id); // on part du Bourg, on n'y « voyage » pas
    expect(new Set(scenes).size, 'deux lieux pour la même scène').toBe(scenes.length);
  });
});

const hub = project.find((s) => s.id === 'arene-hub')!;

describe('Médecin (PNJ) — soins payants (LDB 75), via l’infirmerie', () => {
  it('les 4 actes payants (Guérison/hémorragie/déchirure/Chirurgie) sont tarifés 4-6 pa ; le Médecin (Bourg) les offre TOUS', () => {
    // TOUT-EN-SCÈNE : le médecin (place) ET Prêtre (chapelle) vivent tous deux dans `arene-hub`.
    const dlgs = [hub.dialogues.find((d) => d.id === 'dlg-medecin')!, hub.dialogues.find((d) => d.id === 'dlg-frere')!];
    const aids = dlgs.flatMap((d) => d.nodes.flatMap((n) => n.choices.flatMap((c) => (c.flow ? flowEffects(c.flow) : []).filter((e) => e.type === 'medicalAid'))));
    const acts = aids.flatMap((e: any) => e.acts as { act: string; cost?: { silver?: number } }[]);
    expect(acts.every((a) => (a.cost?.silver ?? 0) >= 4 && (a.cost?.silver ?? 0) <= 6)).toBe(true); // 4-6 pistoles RAW
    const medecin = aids.find((e: any) => e.entityId.id === 'medecin') as any;
    expect(new Set(medecin.acts.map((a: { act: string }) => a.act))).toEqual(new Set(['blessures', 'hemorragie', 'traumatisme', 'chirurgie']));
  });
});
