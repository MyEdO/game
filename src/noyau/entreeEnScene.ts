/** Entrée en scène : partie neuve (`startScene`, `loadProject`) et changement de scène (`transitionTo`). */
import { registerScene, sceneDuRegistre } from './monde/registreDesScenes';
import { startOf } from './monde/scene';
import { findFreeTile } from './monde/combatGeometry';
import { spawnFacing } from './monde/exploreNav';
import { poserCapDuGroupe } from './monde/combatants';
import { etatInitialDuJeu } from './etat';
import * as possessionsFlow from './possessionsFlow';
import { bus, EVT } from './bus';
import { openEncounterPsych } from './encounterPsychFlow';
import { pushReveal } from './combatEffects';
import { emptyNarratif } from './monde/campaignNarratif';
import { t } from '../i18n';
import { suspendActiveCascade, dropSceneEntrySteps } from './cascade';
import * as partyFlow from './partyFlow';
import { captureMutation, applyMutation as applySceneMutation } from './monde/sceneInstance';
import { resetFields } from './stateFields';
import { TIME_COST } from '../engine/timeCost';
import type { Get, SetDuJournal } from './flowTypes';
import type { ActionsDuNoyau } from './actionsDuNoyau';

export function creerActionsDEntreeEnScene(get: Get, set: SetDuJournal) {
  return {
    setPendingCampaign: (pc) => set({ pendingCampaign: pc }),
    startScene: (scene, narratif) => {
      registerScene(scene);
      const start = scene.entities.find((e) => e.kind === 'heroStart');
      const pos = startOf(scene) ?? findFreeTile(scene);
      // Démarrage d'une partie / d'un scénario : on repart de l'état NEUF du jeu (`etatInitialDuJeu`). On ne
      // conserve QUE l'écran, le groupe (posé par `setParty`) et la SESSION COOP (net : héberger une partie
      // PUIS la lancer ne doit pas dissoudre le salon — Jalon 7). L'interface se remet chez son hôte, à
      // l'entrée en scène (`EVT.ARRIVEE_EN_SCENE`).
      const { screen, party, net } = get();
      const capEntrant = start?.facing ?? spawnFacing(pos, scene.dimensions);
      set({
        ...etatInitialDuJeu(),
        screen, party, net,
        scene: JSON.parse(JSON.stringify(scene)),
        mode: 'exploration',
        partyPos: pos,
        // Orientation d'ENTRÉE du meneur : authorée (facing du heroStart) sinon vers le CONTENU
        // (spawnFacing — en POV, un spawn au bord sud ne doit pas contempler le vide hors-carte).
        facing: poserCapDuGroupe({}, capEntrant),
        flags: { ...scene.flags },
        campaignSceneId: scene.id,
        journal: scene.startMessage ? [scene.startMessage.texte] : [],
        campaignNarratif: narratif ?? null,
      });
      bus.emit(EVT.ARRIVEE_EN_SCENE, { sceneId: scene.id, neuve: true });
      // Semis des Possessions de dotation (#617/#618) — ICI, jamais `loadGame` (qui restaure
      // `data.possessions` de la save) : `startScene` est le SEUL seam qui repart d'un registre
      // `possessions` vidé (le reset ci-dessus), pour toute partie neuve (créateur → campagne,
      // devtools scenario()/campaign()) — `transitionTo`/`loadProject` (scène suivante d'un même
      // projet) n'y repassent pas, `party` déjà doté n'est jamais re-semé (garde de la fonction).
      possessionsFlow.seedStartingPossessions(get, set);
      bus.emit(EVT.SCENE_DIRTY);
      openEncounterPsych(get, set); // couture C : Peur/Terreur/trait ciblé à la rencontre des PNJ présents
      // N1 : l'entrée de zone remonte en MODALE (« le Journal n'est pas lu ») — étape d'AFFICHAGE
      // skippable ; le Journal garde l'archive consultable. Poussée APRÈS `openEncounterPsych` et en
      // séquence PROPRE (`own`) : la carte passe DEVANT les Tests de Sang-froid de la rencontre, qui
      // sont parqués par la doctrine du slot et repris à la clôture de la carte — jamais perdus.
      if (scene.startMessage) pushReveal(set, { kind: 'sceneEntry', title: scene.label, lines: [scene.startMessage.texte], sceneId: scene.id }, { own: true });
    },
    loadProject: ({ scenes, entryId, worldMap, narratif, projet }) => {
      // Enregistre toutes les scènes du projet (pour que les portes reveal:'door'
      // résolvent leurs intérieurs), puis démarre la scène d'entrée.
      const entry = scenes.find((s) => s.id === entryId);
      if (!entry) throw new Error(`loadProject : scène d’entrée « ${entryId} » absente (${scenes.map((s) => s.id).join(', ')})`);
      for (const s of scenes) registerScene(s);
      get().startScene(entry, narratif);
      // La carte du PROJET remplace la carte vide de l'état de départ (remise par le reset de
      // startScene) ; un projet sans carte n'offre pas de voyage.
      if (worldMap !== undefined) set({ worldMap });
      // Ouverture cérémonielle du chapitre (#717) : posée ICI, `startScene` vient de remettre l'état à
      // l'init. Absente du paquet = démarrage direct.
      set({ pendingOuverture: structuredClone(narratif?.ouverture ?? null) }); // #2097
      // Document SOURCE de la partie (#766) : snapshot AUTO-SUFFISANT du paquet, embarqué au save par
      // `stateFields` → au chargement, `applyLoadedSave` ré-enregistre ces scènes et re-dérive le narratif.
      // Posé APRÈS startScene (qui vide `campaignDoc` via le reset à l'init).
      set({ campaignDoc: { scenes, worldMap: worldMap ?? null, narratif: narratif ?? emptyNarratif(), startSceneId: entry.id, projet } });
    },
    /** Transition vers une autre scène (conserve groupe, flags, inventaire, argent).
     *  `pos` force la case d'arrivée (utilisé par `transitionBack`). */
    transitionTo: (sceneId, entry, pos) => {
      const target = sceneDuRegistre(sceneId);
      if (!target) {
        get().log(t('store.sceneMissing', { scene: sceneId }));
        return;
      }
      const heroStart = target.entities.find((e) => e.kind === 'heroStart');
      const start = pos || (entry && target.entryPoints?.[entry]) || startOf(target) || findFreeTile(target);
      // Orientation d'ENTRÉE : authorée SEULEMENT si on spawne réellement au heroStart (ni `pos` forcé
      // ni point d'entrée nommé) ; sinon vers le CONTENU de la NOUVELLE carte (le cap hérité de
      // l'ancienne scène n'a aucun sens ici — en POV il peut regarder le vide hors-carte).
      const authored = !pos && !(entry && target.entryPoints?.[entry]) ? heroStart?.facing : undefined;
      // Couture UNIVERSELLE de suspension (noyau/cascade.ts) : une cascade active PARQUÉE au lieu d'être
      // perdue par `resetFields('scene')` ci-dessous (ex. un abordage ouvre `startCombat` PUIS transitionne
      // vers sa scène — l'ORDRE des deux appels varie selon l'appelant, cette couture protège les deux).
      suspendActiveCascade(get, set);
      // …puis la pile parquée perd les cartes d'entrée de la scène QUITTÉE (`dropSceneEntrySteps`) :
      // elles narrent un lieu qu'on ne joue plus, et resurgiraient par-dessus la scène d'arrivée. Le
      // reste de la pile (jour de voyage, Tests de rencontre) traverse la transition intact.
      dropSceneEntrySteps(get, set);
      // Persistance d'INSTANCE de scène (#707) : capture le delta de la scène qu'on QUITTE (entités
      // retirées — décor consommé, PNJ tué par `removeEntity`/réconciliation de combat — et flags
      // runtime de portes/structures/tuiles) vs son document authored, puis applique l'instance stockée
      // de la scène CIBLE (si déjà visitée) au clone frais ci-dessous — SEULE couture, aucun site de
      // mutation (`removeEntity`, `setDoorOpen`…) n'est instrumenté.
      // Le GROUPE quitte la scène : plus personne du groupe n'y tient de place (une scène quittée ne
      // garde pas un héros absent). Libéré AVANT la capture, sinon l'instance persistée rappellerait le
      // meneur à sa chaise au revisit — et l'assise des PNJ authorés, elle, s'y capture normalement.
      const leaving = partyFlow.releaseHeroSeats(get().scene);
      const sceneInstances = { ...get().sceneInstances };
      if (leaving) {
        const leavingAuthored = sceneDuRegistre(leaving.id);
        const mut = leavingAuthored ? captureMutation(leaving, leavingAuthored) : undefined;
        if (mut) sceneInstances[leaving.id] = mut;
        else delete sceneInstances[leaving.id];
      }
      // Le groupe est passé : l'assise superposée est élaguée au moment même où la scène entre en état
      // (meuble retiré par la mutation, slot disparu du catalogue, emplacement de héros que le groupe
      // courant n'atteint pas).
      const scene = applySceneMutation(JSON.parse(JSON.stringify(target)), sceneInstances[target.id], get().party.length);
      set((s) => ({
        scene,
        sceneInstances,
        mode: 'exploration',
        partyPos: { ...start },
        facing: poserCapDuGroupe(s.facing, authored ?? spawnFacing(start, target.dimensions)),
        lightLevel: null, // nouvelle scène → lumière auto (un setLight ne se propage pas d'une scène à l'autre)
        // flags persistants : on conserve l'état narratif et on ajoute les
        // valeurs par défaut de la nouvelle scène pour les clés absentes.
        flags: { ...target.flags, ...s.flags },
        // Reset des champs transitoires du changement de scène (manifeste UNIQUE, scope 'scene') :
        // tous les pending* d'exploration/combat + `document`. `dialogue`/`battle` (état coeur) restent
        // explicites ci-dessous.
        ...resetFields('scene'),
        dialogue: null,
        battle: null,
        campaignSceneId: target.id,
      }));
      if (target.startMessage) get().log(target.startMessage.texte);
      get().advanceTime(TIME_COST.sceneTransition); // seam « tout est horodaté » : 0 en intérieur (paramétrable, #T2 extérieur/voyage)
      bus.emit(EVT.SCENE_DIRTY);
      // Point de reprise de l'hôte AVANT qu'une rencontre ne démarre le combat.
      bus.emit(EVT.ARRIVEE_EN_SCENE, { sceneId: target.id, neuve: false });
      openEncounterPsych(get, set); // couture C : Psychologie à la rencontre dans la nouvelle scène
      // N1 : entrée de zone (transition) en MODALE — étape d'AFFICHAGE skippable (Journal = archive),
      // poussée APRÈS `openEncounterPsych` et en séquence PROPRE (`own`), pour la même raison qu'à
      // `startScene` : la carte passe devant, les Tests de rencontre sont parqués puis repris.
      if (target.startMessage) pushReveal(set, { kind: 'sceneEntry', title: target.label, lines: [target.startMessage.texte], sceneId: target.id }, { own: true });
    },
  } satisfies Partial<ActionsDuNoyau>;
}
