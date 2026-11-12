import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { EFFECT_HANDLERS, applyEffects, runFlow } from '../../noyau/combatEffects';
import { sceneNpc } from '../../noyau/monde/sceneNpc';
import { emptyScene, wallBetween, type ArchitectureRect, type Scene, type SceneEntity, type WallSeg } from '../../noyau/monde/scene';
import { evalCondition, flowEffects, type Condition } from '../../engine/flowCore';
import { parseProject } from '../../noyau/worldMap';
import { groupeVitrineDeScenario } from '../../scenes/test-scenarios/_heros';
import { creditBourse } from '../../noyau/bourseFlow';
import { bourseOf } from '../../engine/bourse';
import { testValue } from '../../engine/skills';
import { bonus, effectiveChar } from '../../engine/characteristics';
import { lireProjetLivre } from '../../../scripts/source/projetLivre.mjs';
import { lancerCampagne, campagneDuJeu, areneCampaign } from '../../scenes/campaign';
import { presetDuNarratif } from '../monde/resolveursDuNarratif';
import { poserLeGroupe } from '../../noyau/marcheDuGroupe';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** Le résolveur de preset du narratif chargé sur le banc. */
const presetPnjById = (id: string) => presetDuNarratif(banc.getState().campaignNarratif)(id);

/** Évalue la Condition `when` d'un choix contre l'état VIVANT (source unique evalCondition). */
const condOk = (when: Condition) => evalCondition(when, { flags: banc.getState().flags, gameTime: 0 });

/**
 * Preuve que l'arène (données pures) tourne sur le MOTEUR EXISTANT, sans code applicatif :
 * chargerLeProjet (voie de l'éditeur) → on entre sur le sol → un trigger déclenche le combat →
 * les Effets onVictory donnent argent/XP, posent le flag et transitionnent au hub → la porte
 * de la zone suivante s'ouvre (flag). Tout via des primitives déjà testées (checkTriggers,
 * lancerLeCombat, applyEffects, transition, condMet).
 */
const doc = parseProject(lireProjetLivre('arene/arene-projet.json'));
const project: Scene[] = doc.scenes;
const zone1 = project.find((s) => s.id === 'arene-zone1')!;

describe('Arène — la boucle tourne sur le moteur existant (zéro code)', () => {
  it('chargerLeProjet démarre sur la zone d’entrée, sans combat', () => {
    banc.getState().fixerLeGroupe(groupeVitrineDeScenario(idsDeTest));
    expect(lancerCampagne(banc.getState, campagneDuJeu(areneCampaign), 'arene-zone1')).toBeNull();
    expect(banc.getState().scene?.id).toBe('arene-zone1');
    expect(banc.getState().battle).toBeNull();
  });

  it('entrer sur le sol (dans le rect du trigger) DÉCLENCHE la rencontre', () => {
    banc.getState().fixerLeGroupe(groupeVitrineDeScenario(idsDeTest));
    expect(lancerCampagne(banc.getState, campagneDuJeu(areneCampaign), 'arene-zone1')).toBeNull();
    poserLeGroupe(banc.getState, banc.setState, { x: 8, y: 8 }); // dans le rect de combat (x≥7) → checkTriggers
    expect(banc.getState().battle).not.toBeNull();
  });

  it('onVictory : argent + flag zone1_clear + transition vers le hub', () => {
    banc.getState().fixerLeGroupe(groupeVitrineDeScenario(idsDeTest));
    expect(lancerCampagne(banc.getState, campagneDuJeu(areneCampaign), 'arene-zone1')).toBeNull();
    runFlow(banc.getState, banc.setState, zone1.encounters[0].onVictory!);
    expect(banc.getState().flags.zone1_clear).toBe(true);
    expect(banc.getState().scene?.id).toBe('arene-hub');
  });

  it('au hub, la porte des Ruines s’ouvre une fois la Cour nettoyée', () => {
    banc.getState().fixerLeGroupe(groupeVitrineDeScenario(idsDeTest));
    expect(lancerCampagne(banc.getState, campagneDuJeu(areneCampaign), 'arene-zone1')).toBeNull();
    runFlow(banc.getState, banc.setState, zone1.encounters[0].onVictory!);
    const hub = banc.getState().scene!;
    const dlgHub = hub.dialogues.find((d) => d.id === 'dlg-hub')!;
    const ruines = dlgHub.nodes.flatMap((n) => n.choices).find((c) => c.label.includes('Ruines'))!;
    expect(condOk(ruines.when!)).toBe(true); // zone1_clear && !zone2_clear
  });

  it('ÉCHELLE COMPLÈTE : les 13 victoires enchaînées ouvrent chaque porte puis le titre de champion', () => {
    banc.getState().fixerLeGroupe(groupeVitrineDeScenario(idsDeTest));
    expect(lancerCampagne(banc.getState, campagneDuJeu(areneCampaign), 'arene-zone1')).toBeNull();
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
    expect(lancerCampagne(banc.getState, campagneDuJeu(areneCampaign), 'arene-hub')).toBeNull();
    const hub = banc.getState().scene!;
    const bourg = hub.architecture?.find((body) => body.id === 'bourg');
    const taverne = bourg?.masses.find((mass) => mass.id === 'taverne');
    expect(taverne, 'la taverne porte une masse authorée').toBeTruthy();
    const isNorE = (w: WallSeg): w is WallSeg & { side: 'N' | 'E' } => w.side === 'N' || w.side === 'E';
    const foot = taverne!.footprint.reduce((box: ArchitectureRect, part: ArchitectureRect) => ({
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
    expect(lancerCampagne(banc.getState, campagneDuJeu(areneCampaign), 'arene-hub')).toBeNull();
    const foret = project.find((s) => s.id === 'arene-exp-foret')!;
    const bande = foret.encounters.find((e) => e.id === 'enc-foret-bande')!;
    runFlow(banc.getState, banc.setState, bande.onVictory!);
    expect(banc.getState().flags.contrat_foret_fait).toBe(true);
    const dlgHub = project.find((s) => s.id === 'arene-hub')!.dialogues.find((d) => d.id === 'dlg-hub')!;
    const prime = dlgHub.nodes.flatMap((n) => n.choices).find((c) => (c.when?.kind === 'flag' ? c.when.expr : '').includes('contrat_foret_fait'))!;
    expect(condOk(prime.when!)).toBe(true);
  });

  it('CARTE DU MONDE : le Bourg est un lieu connu (bouton 🗺️) et ses routes mènent à d’AUTRES scènes du paquet', async () => {
    const { placeOfScene, routesFrom, otherEnd, placeById } = await import('../../noyau/worldMap');
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

  it('medicalAid ouvre l’infirmerie du PNJ : nom/id viennent de l’entité (pas codés en dur), jamais dans le groupe', () => {
    const party = groupeVitrineDeScenario(idsDeTest);
    party[1].wounds = { ...party[1].wounds, current: party[1].wounds.current - 6 };
    banc.setState({ party, scene: hub, battle: null, pendingHeal: null, medic: null });
    creditBourse(banc.getState, banc.setState, party[1].id, { gold: 1, silver: 10, brass: 0 }); // le patient (party[1]) paie son acte (soloPayer)
    applyEffects(banc.getState, banc.setState, [{ type: 'medicalAid', acts: [{ act: 'blessures', cost: { silver: 5 } }], entityId: { id: 'medecin' } }]);
    const m = banc.getState().medic!;
    expect(m.npc!.id).toBe('medecin'); // l'id de l'entité PNJ
    expect(m.npc!.label).toBe('Médecin'); // le label de l'entité (renommable)
    expect(banc.getState().party.some((h) => h.id === m.npc!.id)).toBe(false);
    expect(m.patientId).toBe(party[1].id); // défaut = un patient soignable
    const ph = banc.getState().pendingHeal!; // le brouillon de l'acte, au PNJ ; rien n'est débité avant le lancer
    // La valeur JOUÉE vient de la FICHE référencée par l'entité ; l'effet n'en porte aucune.
    const fiche = sceneNpc(hub, 'medecin', presetPnjById)!;
    expect(ph.skillValue).toBe(testValue(fiche, { skill: { id: 'guerison' } }));
    expect(m.npc!.intBonus).toBe(bonus(effectiveChar(fiche, 'intelligence')));
    expect(bourseOf(banc.getState().party.find((h) => h.id === ph.targetId)!).silver).toBe(10);
    banc.getState().jetLancer('soins');
    expect(bourseOf(banc.getState().party.find((h) => h.id === ph.targetId)!).silver).toBe(5); // 10 − 5 pistoles débitées au lancer, à la bourse du patient
    banc.getState().jetValider('soins');
    expect(banc.getState().pendingHeal).toBeNull();
    expect(banc.getState().medic).not.toBeNull(); // l'infirmerie reste ouverte (autre acte/patient)
    banc.getState().fenetreFermer('infirmerie');
  });

  it('PORTE : un soigneur sans fiche de Guérison n’ouvre AUCUNE infirmerie — rien à lire, rien à inventer (L2 #1548)', () => {
    const party = groupeVitrineDeScenario(idsDeTest);
    party[1].wounds = { ...party[1].wounds, current: party[1].wounds.current - 6 };
    banc.setState({ party, scene: hub, battle: null, pendingHeal: null, medic: null });
    // `fidele` est un figurant de la chapelle : aucune réf de bestiaire, donc aucune Guérison.
    applyEffects(banc.getState, banc.setState, [{ type: 'medicalAid', acts: [{ act: 'blessures' }], entityId: { id: 'fidele' } }]);
    expect(banc.getState().medic).toBeNull();
    // Entité inexistante : même refus ; la validation d'atelier la nomme par le parse (`validateScene.test.ts`).
    applyEffects(banc.getState, banc.setState, [{ type: 'medicalAid', acts: [{ act: 'blessures' }], entityId: { id: 'chirurgien-fantome' } }]);
    expect(banc.getState().medic).toBeNull();
    // La validation d'ATELIER voit ce que voit le runtime : elle résout la FICHE (même `sceneNpc`).
    const ctx = { sceneIds: new Set<string>(), encounterIds: new Set<string>(), entityIds: new Set(hub.entities.map((e) => e.id)), npcSheet: (id: string) => sceneNpc(hub, id, presetPnjById), within: () => true, walkable: () => true };
    expect(EFFECT_HANDLERS.medicalAid.refs!({ type: 'medicalAid', acts: [{ act: 'blessures' }], entityId: { id: 'medecin' } }, ctx)).toEqual([]);
    // Entité EXISTANTE mais sans Guérison : l'atelier la nomme, elle aussi — la porte n'est plus aveugle.
    const sansSoin = EFFECT_HANDLERS.medicalAid.refs!({ type: 'medicalAid', acts: [{ act: 'blessures' }], entityId: { id: 'fidele' } }, ctx);
    expect(sansSoin.map((i) => i.level)).toEqual(['error']);
    expect(sansSoin[0].message).toContain('fidele');
    expect(sansSoin[0].message).toContain('Guérison');
  });

  it('le NOM affiché est celui de l’ENTITÉ, la VALEUR celle de la fiche (L2 #1548)', () => {
    // Scène CONSTRUITE (#1709) : un soigneur dont la FICHE porte un nom et une Guérison, et dont
    // l'ENTITÉ porte un AUTRE nom — la fiche donne les valeurs, l'entité donne le nom. Aucune carte
    // livrée n'entre ici : renommer un PNJ d'une campagne ne doit rougir aucun test.
    const GUERISON = 60;
    const infirmerie: Scene = {
      ...emptyScene('scene-test', 8, 8),
      id: 'fixture-infirmerie',
      entities: [{
        id: 'soigneur', kind: 'personnage', pos: { x: 1, y: 1 }, label: 'Prêtre',
        statblock: { type: 'statblock', label: 'Prêtre de Sigmar', char: { intelligence: 40 }, skills: [{ id: 'guerison', value: GUERISON }] },
      } as SceneEntity],
    };
    const party = groupeVitrineDeScenario(idsDeTest);
    party[1].wounds = { ...party[1].wounds, current: party[1].wounds.current - 6 };
    banc.setState({ party, scene: infirmerie, battle: null, pendingHeal: null, medic: null });
    applyEffects(banc.getState, banc.setState, [{ type: 'medicalAid', acts: [{ act: 'blessures', cost: { silver: 5 } }], entityId: { id: 'soigneur' } }]);
    const m = banc.getState().medic!;
    expect(m.npc!.id).toBe('soigneur');
    expect(m.npc!.label).toBe('Prêtre'); // le nom de l'ENTITÉ, pas celui de la fiche
    expect(m.npc!.skill.value).toBe(GUERISON); // la valeur de la FICHE, que l'effet ne porte pas
    banc.getState().fenetreFermer('infirmerie');
  });

  it('le JOUEUR choisit le patient dans l’infirmerie (choix `infirmerie.patient`)', () => {
    const party = groupeVitrineDeScenario(idsDeTest);
    party[0].wounds = { ...party[0].wounds, current: party[0].wounds.current - 3 };
    party[2].wounds = { ...party[2].wounds, current: party[2].wounds.current - 8 };
    banc.setState({ party, scene: hub, battle: null, pendingHeal: null, medic: null });
    applyEffects(banc.getState, banc.setState, [{ type: 'medicalAid', acts: [{ act: 'blessures' }], entityId: { id: 'medecin' } }]);
    banc.getState().fenetreChoisir('infirmerie', 'patient', party[2].id);
    expect(banc.getState().medic!.patientId).toBe(party[2].id);
    banc.getState().fenetreFermer('infirmerie');
  });

  it('sans patient pertinent, aucun acte ne s’offre (pas de brouillon, pas de jet)', () => {
    banc.setState({ party: groupeVitrineDeScenario(idsDeTest), scene: hub, battle: null, pendingHeal: null, medic: null }); // groupe au max de PB
    applyEffects(banc.getState, banc.setState, [{ type: 'medicalAid', acts: [{ act: 'blessures' }], entityId: { id: 'medecin' } }]);
    expect(banc.getState().pendingHeal).toBeNull();
    banc.getState().fenetreFermer('infirmerie');
  });
});
