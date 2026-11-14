/**
 * #766 LOT A — une SAVE de campagne est AUTO-SUFFISANTE et REJOUABLE.
 *
 * Contrat POSITIF du snapshot `campaignDoc` : après un reload (registre `sceneRegistry` en mémoire
 * module reparti de zéro — seule la scène courante y serait sinon), le chargement d'une
 * save (`chargerLaSave`) RÉ-ENREGISTRE toutes les scènes du paquet ET RE-DÉRIVE la couche narrative
 * (`campaignNarratif`). Le reload se simule par `resetSceneRegistry()` (#777) : le registre repart de zéro,
 * scene-b n'y est réenregistrée que par le chargement de la save.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { resetSceneRegistry } from './monde/registreDesScenes';
import { objetDuNarratif, presetDuNarratif } from './monde/resolveursDuNarratif';
import { etatInitialDuJeu } from './etat';
import { chargerSurLeBanc, sauverLeBanc } from './persistance/save.testkit';
import { emptyScene, type Scene } from './monde/scene';
import { emptyNarratif } from './monde/campaignNarratif';
import type { NarratifBlock } from '../data/schemas/defs-scenes/narratif';
import type { WorldMap } from './worldMap';
import { objetDeCampagne } from '../scenes/fixtures/objetDeCampagne.testkit';
import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import { campagneALancer, lancerCampagne, campagneDuJeu, diligenceCampaign } from '../scenes/campaign';
import { applyEffects } from './combatEffects';
import { appliquerLInstantane, instantaneDeLaCoop } from './coop';

/** Scène minimale (heroStart) chargeable par le chemin RÉEL (`chargerLeProjet`/`quitterLaScene`). */
function scene(id: string): Scene {
  const s = emptyScene('scene-test', 6, 6);
  s.id = id;
  s.label = id;
  s.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
  return s;
}

let banc: Banc;
/** Le résolveur de preset du narratif chargé sur le banc. */
const presetPnjById = (id: string) => presetDuNarratif(banc.getState().campaignNarratif)(id);

const OBJET_ID = 'snap-lame-maudite';
const narratif: NarratifBlock = {
  ...emptyNarratif(),
  affaires: [{ id: 'snap-aff', titre: 'Le Corbeau noir' }],
  indices: [],
  presetsPnj: [{ id: 'snap-pnj', profil: {} }],
  objets: [objetDeCampagne({ id: OBJET_ID, label: 'Lame maudite' })],
};

const worldMap: WorldMap = {
  id: 'snap-carte', label: 'Carte', places: [{ id: 'p', label: 'Bourg', pos: { x: 0, y: 0 }, scene: { id: 'scene-a' } }], routes: [],
};

describe('chargerLeProjet — la scène d’entrée est une scène du paquet, ou le chargement LÈVE', () => {
  beforeEach(() => {
    resetSceneRegistry();
    banc = ouvrirLeBanc();
  });

  it.each([
    ['id inconnu', [scene('sa'), scene('sb')], 'INEXISTANTE', /« INEXISTANTE » absente \(sa, sb\)/],
    ['paquet sans scène', [], 'x', /« x » absente \(\)/],
  ] as const)('%s : aucune scène démarrée ni enregistrée, aucun `campaignDoc` écrit', (_nom, scenes, entree, motif) => {
    banc.getState().chargerLeProjet({ scenes: [scene('avant')], entryId: 'avant', projet: null });
    const docAvant = banc.getState().campaignDoc;
    expect(() => banc.getState().chargerLeProjet({ scenes: [...scenes], entryId: entree, projet: null })).toThrow(motif);
    expect(banc.getState().scene?.id).toBe('avant');
    expect(banc.getState().campaignDoc).toBe(docAvant);
    banc.getState().quitterLaScene('sb');
    expect(banc.getState().scene?.id).toBe('avant');
  });
});

describe('#766 — save de campagne auto-suffisante et rejouable', () => {
  beforeEach(() => {
    resetSceneRegistry();
    banc = ouvrirLeBanc();
  });

  it('reload (registre vidé) : campaignDoc re-registre la scène B → quitterLaScene réussit', () => {
    // 1. Charge un projet MULTI-scènes par le chemin réel, puis sauve.
    banc.setState({ party: tousLesHerosDeScenario(idsDeTest).slice(0, 1), battle: null });
    banc.getState().chargerLeProjet({ scenes: [scene('scene-a'), scene('scene-b')], entryId: 'scene-a', worldMap, narratif, projet: null });
    expect(banc.getState().scene?.id).toBe('scene-a');
    expect(banc.getState().campaignDoc?.scenes.map((s) => s.id)).toEqual(['scene-a', 'scene-b']);
    const save = sauverLeBanc(banc);

    // 2. Reload : `sceneRegistry` reparti de zéro, scene-b INCONNUE.
    resetSceneRegistry();
    banc.setState({ party: tousLesHerosDeScenario(idsDeTest).slice(0, 1) });
    banc.getState().chargerLeProjet({ scenes: [scene('scene-solo')], entryId: 'scene-solo', projet: null });
    banc.getState().quitterLaScene('scene-b');
    expect(banc.getState().scene?.id).toBe('scene-solo'); // scene-b introuvable → transition ignorée

    // 3. Chargement de la save : re-registration des scènes du paquet + re-dérivation du narratif.
    chargerSurLeBanc(banc, save);
    expect(banc.getState().scene?.id).toBe('scene-a');
    expect(banc.getState().worldMap?.id).toBe('snap-carte'); // carte du paquet restaurée
    // La couche narrative est re-dérivée de campaignDoc.narratif (non persistée au snapshot).
    expect(presetPnjById('snap-pnj')?.id).toBe('snap-pnj');
    expect(objetDuNarratif(banc.getState().campaignNarratif)(OBJET_ID)?.label).toBe('Lame maudite');
    // La preuve : scene-b, absente du registre reparti de zéro, l'est de nouveau → la transition réussit.
    banc.getState().quitterLaScene('scene-b');
    expect(banc.getState().scene?.id).toBe('scene-b');
  });

  it('l’Arène lancée sans choix (#1692) : sa save porte son paquet, et ses zones résolvent au rechargement', () => {
    banc.setState({ party: tousLesHerosDeScenario(idsDeTest).slice(0, 1), battle: null });
    const arene = campagneALancer(null);
    expect(lancerCampagne(banc.getState, null)).toBeNull();
    expect(banc.getState().campaignDoc?.scenes.map((s) => s.id)).toEqual(arene.scenes.map((s) => s.id));
    const save = sauverLeBanc(banc);

    resetSceneRegistry();
    banc.setState(etatInitialDuJeu());
    chargerSurLeBanc(banc, save);
    expect(banc.getState().worldMap?.id).toBe(arene.worldMap?.id);
    banc.getState().quitterLaScene('arene-hub');
    expect(banc.getState().scene?.id).toBe('arene-hub');
  });
});

describe('#2206 — l’identité du projet et la provenance du document remis survivent à la save et à la coop', () => {
  const avecDocument: NarratifBlock = { ...narratif, documents: [{ id: 'snap-doc', titre: 'Lettre', prose: 'Une lettre.' }] };

  /** Un projet `snap-projet` chargé par le chemin réel, son document remis par l'effet `document`. */
  function charger(): void {
    banc.setState({ party: tousLesHerosDeScenario(idsDeTest).slice(0, 1), battle: null });
    banc.getState().chargerLeProjet({ scenes: [scene('scene-a')], entryId: 'scene-a', narratif: avecDocument, projet: { id: 'snap-projet' } });
    applyEffects(banc.getState, banc.setState, [{ type: 'document', documentId: 'snap-doc' }]);
  }

  beforeEach(() => {
    resetSceneRegistry();
    banc = ouvrirLeBanc();
  });

  it('save → load : `campaignDoc.projet` et `document.documentId` reviennent', () => {
    charger();
    const save = sauverLeBanc(banc);
    banc.setState(etatInitialDuJeu());
    expect(banc.getState().campaignDoc).toBeNull();
    chargerSurLeBanc(banc, save);
    expect(banc.getState().campaignDoc?.projet).toEqual({ id: 'snap-projet' });
    expect(banc.getState().document?.documentId).toBe('snap-doc');
  });

  it('snapshot coop : l’invité adopte `campaignDoc.projet`, `document.documentId` et `pendingCampaign.projet`', () => {
    charger();
    banc.setState({ pendingCampaign: campagneDuJeu(diligenceCampaign) });
    const data = JSON.parse(JSON.stringify(instantaneDeLaCoop(banc.getState()))) as Record<string, unknown>;
    banc.setState(etatInitialDuJeu());
    banc.setState(appliquerLInstantane(data, banc.getState()).etat);
    expect(banc.getState().campaignDoc?.projet).toEqual({ id: 'snap-projet' });
    expect(banc.getState().document?.documentId).toBe('snap-doc');
    expect(banc.getState().pendingCampaign?.projet).toEqual({ id: diligenceCampaign.id });
  });
});
