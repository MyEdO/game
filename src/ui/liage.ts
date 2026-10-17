/**
 * LIAGE — le PÉRIMÈTRE du liage automatique, déclaré en un seul endroit (#1392 Lot E, train T0).
 *
 * Invariant (design v8 §1) : un lien automatique (appariement de libellé, `tokenizeLinks`) n'existe
 * que sur une prose de SOURCE ADRESSÉE — un champ d'une entrée, désigné par son `Porteur`. Une prose
 * SYNTHÉTISÉE (fabriquée depuis des champs structurés) ne lie rien par libellé : ses références sont
 * des rangées `{ t:'ref' }` émises là où l'id est connu. Une prose RUNTIME ou une chaîne d'UI ne lie
 * rien. Question à laquelle l'invariant répond (verbatim utilisateur 2026-08-18) : « ne pas avoir le
 * controle sur ce qu'on met en évidence est un soucis ».
 *
 * Module PUR : il lit le registre des proses nommées (`champs-prose-de-scene.ts`) et le schéma de
 * projet (`projetSchema`, pour ses entrées embarquées). Il portera en T1 le tokeniseur
 * partagé rapport/rendu. Ici il ne porte que les DEUX listes fermées que les gardes comparent au
 * code réel — `SITES_PROSE` (qui rend du markdown, et avec quel porteur) et `CHEMINS_ADRESSES`
 * (quels champs sont adressés).
 */
import { champsProseDeScene, type CheminProseDeScene } from '../data/schemas/grammaire/champs-prose-de-scene';
import { adressesDesEntreesEmbarquees } from '../data/schemas/grammaire/document';
import { projetSchema } from '../data/schemas/defs-scenes/projet';

/**
 * PORTEUR d'une prose rendue : le champ d'où sort le texte, VERBATIM.
 *
 * `type` = la clé de CATÉGORIE Codex de l'entrée quand elle en a une (celle que `CodexEntry` passait
 * déjà en `selfCategory` — elle tranche les homonymes, cf. `PRIORITY_CAT_ORDER`), sinon le `type` du
 * dataset (`lieux-services`…). `id` = l'id STABLE de l'entrée. `chemin` = chemin de clés jusqu'au
 * champ, en notation `scripts/source/adresses.mjs:66-76` (clés par `.`, index accolés : `rows[3].text`,
 * `details.texts.age.bySpecies.humain`).
 *
 * Un texte qui n'existe verbatim dans AUCUN champ (synthèse, gabarit substitué, chaîne d'UI) n'a pas
 * de porteur — et ne lie donc rien.
 *
 * `chemin` n'est lu par AUCUN renderer : `<Prose>` ne consulte que `type`/`id` (ils arment
 * `tokenizeLinks`). Ses lecteurs sont les GARDES (`liens-du-catalogue.test.tsx` confronte le chemin
 * émis à `CHEMINS_ADRESSES`) et le rapport d'adressage de T1. Il est donc l'ADRESSE du champ, à
 * garder juste même si l'écran ne change pas quand il ment.
 */
export interface Porteur {
  type: string;
  id: string;
  chemin: string;
}

/** D'où vient le texte d'un site qui rend du markdown. */
export type OrigineProse =
  /** (S) champ d'une entrée de données ou d'un document de projet — porteur attendu. */
  | 'S'
  /** (Y) synthèse : texte fabriqué depuis des champs structurés — jamais de porteur. */
  | 'Y'
  /** (R) runtime : snapshot d'instance, texte de dialogue joué — jamais de porteur. */
  | 'R'
  /** (UI) littéral de l'interface (démo de galerie, phrase d'écran) — jamais de porteur. */
  | 'UI';

/**
 * Un SITE TERMINAL qui rend du markdown : un élément JSX d'un composant porteur de prose
 * (`Prose{md}`, `ActivityPane{desc}`, `DetailFrame{prose}`, `LoreText{md}`, `ProseField{lecture}`, les volets
 * d'interlude)
 * dont la valeur n'est PAS la simple transmission d'une prop du composant courant, ou un appel de `mdToText`.
 *
 * `cle` = `fichier#Balise.prop#n` (`fichier#mdToText#n` pour un appel), `n` = rang de ce couple balise/prop
 * DANS le fichier, en ordre de source — jamais un numéro de ligne, qui bougerait au premier commentaire ajouté.
 * `porteur` (pour S) = `type.chemin` du champ rendu — mémo de lecture ; la garde ne résout PAS les
 * valeurs (angle mort DIT dans `prose-sites.test.ts`), elle vérifie que la PROP `porteur` est passée
 * exactement là où cette liste en déclare un.
 */
export type SiteProse = {
  cle: string;
  origine: OrigineProse;
  /** Pourquoi ce site ne porte rien, quand l'absence n'est pas évidente. */
  note?: string;
} & (
  /** Site de CATALOGUE : il lie, il ne rend jamais une prose de paquet. */
  | { porteur: string; paquet?: never }
  /** Site de PROJET (`porteurDeProjet.ts`) : il lie ET nomme la prose de paquet qu'il porte —
   *  `porteur` = `projet.` + son unique chemin de `paquet`. */
  | { porteur: `projet.${CheminProseDeScene}`; paquet: readonly [CheminProseDeScene] }
  /** Tout autre site DÉCLARE les proses de PAQUET (`PROSES_NOMMEES`) qu'il rend au JOUEUR, liste vide
   *  comprise : il passe `paquet` à `<Prose>`, ou `nommer(…)` à `mdToText`, pour que le texte suive les
   *  identités en vigueur (`src/state/identites.ts`). Une surface d'atelier rend la prose STOCKÉE : `[]`. */
  | { porteur?: never; paquet: readonly CheminProseDeScene[] }
);

/**
 * Les sites terminaux de prose de `src/**` (hors `*.test.tsx`). Liste FERMÉE : un site de plus, un
 * site qui change de porteur, et `src/ui/prose-sites.test.ts` rougit — dans les deux sens.
 */
export const SITES_PROSE: SiteProse[] = [
  { cle: 'src/ui/TeamSegments.tsx#Prose.md#1', origine: 'Y', paquet: [], note: 'projection de segments narrés ; les tons annotent le Markdown complet sans en changer le texte.' },
  { cle: 'src/ui/RecapLine.tsx#Prose.md#1', origine: 'Y', paquet: ['setObjective.desc'], note: 'RecapLine.text matérialise une conséquence de résolution ; l’objectif soldé de la chronique de chapitre (`chapitreRecap.ts`) est un `setObjective.desc` : `paquet` vaut pour la seule ligne qui le porte (`RecapLine.paquet`).' },
  { cle: 'src/ui/RevealBody.tsx#Prose.md#1', origine: 'S', porteur: 'projet.scenes[].startMessage.texte', paquet: ['scenes[].startMessage.texte'], note: '`RevealEntry.sceneId`, posé avec l’entrée de zone (`src/state/store.ts`)' },
  { cle: 'src/ui/LogDrawer.tsx#Prose.md#1', origine: 'S', paquet: ['journal.desc', 'narrative.text'], note: 'journal runtime matérialise journal.desc/narrative.text ; absence de l’id du document porteur.' },
  { cle: 'src/ui/CascadeModal.tsx#Prose.md#1', origine: 'S', paquet: ['flow.choice.prompt'], note: 'CascadeStep.label matérialise flow.choice.prompt ; absence de l’id du document porteur.' },
  { cle: 'src/ui/DesignationHerosModal.tsx#Prose.md#1', origine: 'S', paquet: ['designerHeros.invite'], note: 'PendingDesignationHeros.invite matérialise designerHeros.invite ; le pending ne porte pas l’id du document source.' },
  { cle: 'src/ui/ObjectiveBanner.tsx#Prose.md#1', origine: 'S', paquet: ['setObjective.desc'], note: 'Objective.text matérialisé depuis setObjective.desc ; l’id du document porteur est absent du runtime Objective.' },
  { cle: 'src/ui/BackgroundPanel.tsx#Prose.md#1', origine: 'S', paquet: ['grantFavor.desc'], note: 'favor.desc projeté depuis grantFavor.desc ou une faveur mécanique de catalogue ; Favor runtime ne porte pas l’id de son document source.' },
  { cle: 'src/ui/CampaignLibraryScreen.tsx#Prose.md#1', origine: 'S', porteur: 'projet.desc' },
  // ── Codex : la fiche et ses rangées ───────────────────────────────────────────────────────────
  { cle: 'src/ui/compendium/CodexEntry.tsx#Prose.md#1', origine: 'S', porteur: '<entrée>.<chemin de la rangée>', note: 'rangée `t:text` : porteur composé par `CodexRowView` quand la rangée en déclare un (sinon nu)' },
  { cle: 'src/ui/compendium/CodexEntry.tsx#Prose.md#2', origine: 'Y', paquet: [], note: 'corps d’un `t:fold` — forme technique d’atelier (`describe`), jamais un champ' },
  { cle: 'src/ui/compendium/CodexEntry.tsx#Prose.md#3', origine: 'S', porteur: '<catégorie>.desc' },
  { cle: 'src/ui/compendium/CodexEntry.tsx#Prose.md#4', origine: 'S', porteur: '<catégorie>.maison' },
  { cle: 'src/ui/compendium/DescRefField.tsx#Prose.md#1', origine: 'S', paquet: [], note: 'RESTE T0 : aperçu de l’adresse en cours d’édition. Le champ générique de l’atelier (`CodexEdit.tsx:1829`) ne connaît ni le type ni l’id de l’entrée à ce point ; c’est le train T2 qui fait descendre le porteur dans le champ générique (design v6 §7).' },

  // ── Créateur de personnage ────────────────────────────────────────────────────────────────────
  { cle: 'src/ui/creator/CharacterCreator.tsx#DetailFrame.prose#1', origine: 'S', porteur: 'races.desc' },
  { cle: 'src/ui/creator/CharacterCreator.tsx#DetailFrame.prose#2', origine: 'S', porteur: 'careers.desc' },
  { cle: 'src/ui/creator/CharacterCreator.tsx#DetailFrame.prose#3', origine: 'S', porteur: 'stars.desc' },
  { cle: 'src/ui/creator/CharacterCreator.tsx#LoreText.md#1', origine: 'S', porteur: 'classes.desc' },

  // ── Interlude : les volets d'Activité ─────────────────────────────────────────────────────────
  { cle: 'src/ui/InterludeScreen.tsx#RevenusPane.desc#1', origine: 'S', porteur: 'activities.desc' },
  { cle: 'src/ui/InterludeScreen.tsx#CraftProgressPane.desc#1', origine: 'S', porteur: 'activities.desc' },
  { cle: 'src/ui/InterludeScreen.tsx#CraftPane.desc#1', origine: 'S', porteur: 'activities.desc' },
  { cle: 'src/ui/InterludeScreen.tsx#LearnPane.desc#1', origine: 'S', porteur: 'activities.desc' },
  { cle: 'src/ui/InterludeScreen.tsx#IdentifyPane.desc#1', origine: 'S', porteur: 'activities.desc' },
  { cle: 'src/ui/InterludeScreen.tsx#EntrainementPane.desc#1', origine: 'S', porteur: 'activities.desc' },
  { cle: 'src/ui/InterludeScreen.tsx#ActivityPane.desc#1', origine: 'S', porteur: 'activities.desc' },
  { cle: 'src/ui/InterludeScreen.tsx#ActivityPane.desc#2', origine: 'S', porteur: 'activities.desc' },

  // ── Hub de lieu : les services du catalogue `lieux-services.json` ─────────────────────────────
  { cle: 'src/ui/CityHubScreen.tsx#ActivityPane.desc#1', origine: 'S', porteur: 'lieux-services.desc' },
  { cle: 'src/ui/CityHubScreen.tsx#ActivityPane.desc#2', origine: 'S', porteur: 'lieux-services.desc' },
  { cle: 'src/ui/CityHubScreen.tsx#ActivityPane.desc#3', origine: 'S', porteur: 'lieux-services.desc' },
  { cle: 'src/ui/CityHubScreen.tsx#ActivityPane.desc#4', origine: 'S', porteur: 'lieux-services.desc' },
  { cle: 'src/ui/CityHubScreen.tsx#ActivityPane.desc#5', origine: 'UI', paquet: [], note: 'littéral d’écran (« Ce point mène à un autre endroit. ») — aucune source' },

  // ── Mer & navire ──────────────────────────────────────────────────────────────────────────────
  { cle: 'src/ui/PortView.tsx#Prose.md#1', origine: 'S', porteur: 'navalPorts.desc' },
  { cle: 'src/ui/PortView.tsx#Prose.md#2', origine: 'S', porteur: 'navalTraits.desc' },
  { cle: 'src/ui/ShipSheet.tsx#Prose.md#1', origine: 'S', porteur: 'navalTraits.desc' },
  { cle: 'src/ui/SeaActivitiesModal.tsx#Prose.md#1', origine: 'S', porteur: 'regles.desc' },
  { cle: 'src/ui/SeaActivitiesModal.tsx#Prose.md#2', origine: 'S', porteur: 'activities.desc' },
  { cle: 'src/ui/editor/WorldMapPlacePanel.tsx#Prose.md#1', origine: 'S', porteur: 'navalPorts.desc' },

  // ── Divers écrans ─────────────────────────────────────────────────────────────────────────────
  { cle: 'src/ui/TavernGameModal.tsx#Prose.md#1', origine: 'S', porteur: 'tavernGames.desc' },
  { cle: 'src/ui/MassBattleView.tsx#Prose.md#2', origine: 'S', porteur: 'activities.desc', note: 'une Scène de Round EST une Activité (`battleSceneById` → `activityById`, `state/massBattleFlow.ts:197`)' },

  // ── Nus par nature ────────────────────────────────────────────────────────────────────────────
  { cle: 'src/ui/StakeNote.tsx#Prose.md#1', origine: 'Y', paquet: ['stake.authored'], note: 'les 3 formes de `resolveStake` (`src/data/index.ts`) : synthèse, texte authoré de scène, gabarit substitué — aucune n’est un champ rendu verbatim ; `paquet` vaut pour la seule forme authorée' },
  { cle: 'src/ui/DialogueHistoryScreen.tsx#Prose.md#1', origine: 'R', paquet: ['dialogues[].nodes[].desc'], note: 'texte de nœud RECOPIÉ au tour joué (journal runtime)' },
  { cle: 'src/ui/MerchantPanel.tsx#Prose.md#1', origine: 'R', paquet: [], note: '`ItemInstance.desc` — snapshot d’instance, surchargeable par un objet custom (`giveTrapping`)' },
  { cle: 'src/ui/PartyScreen.tsx#DetailFrame.prose#1', origine: 'Y', paquet: [], note: 'présentation composée des champs du héros + libellés i18n' },

  // ── Prose de PROJET : portée par le document de la partie (`porteurDeProjet.ts`), nue en scénario ──
  { cle: 'src/ui/CampaignOpeningScreen.tsx#Prose.md#1', origine: 'S', porteur: 'projet.narratif.ouverture.sousTitre.texte', paquet: ['narratif.ouverture.sousTitre.texte'] },
  { cle: 'src/ui/CampaignOpeningScreen.tsx#Prose.md#2', origine: 'S', porteur: 'projet.narratif.ouverture.pitch', paquet: ['narratif.ouverture.pitch'] },
  { cle: 'src/ui/ChapterRecapScreen.tsx#Prose.md#1', origine: 'S', porteur: 'projet.narratif.cloture.sousTitre.texte', paquet: ['narratif.cloture.sousTitre.texte'], note: '`pendingChapterRecap.sousTitre`, projeté de `narratif.cloture` (`src/state/chapitreRecap.ts`)' },
  { cle: 'src/ui/CarnetScreen.tsx#Prose.md#1', origine: 'S', porteur: 'projet.narratif.indices[].stades[].prose', paquet: ['narratif.indices[].stades[].prose'] },
  { cle: 'src/ui/CarnetScreen.tsx#Prose.md#2', origine: 'S', porteur: 'projet.narratif.documents[].prose', paquet: ['narratif.documents[].prose'], note: 'document CROISÉ par le stade (`IndiceStade.documentId`, #679)' },
  { cle: 'src/ui/DocumentModal.tsx#Prose.md#1', origine: 'S', porteur: 'projet.narratif.documents[].prose', paquet: ['narratif.documents[].prose'], note: '`store.document.documentId`, posé par l’effet `document` (`src/state/combatEffects.ts`) ; la même surface rend le rapport de naufrage, texte RUNTIME sans `documentId` (`src/state/shipwreck.ts`) : nu, et `paquet` ne vaut que pour le document à `documentId`' },
  { cle: 'src/ui/DialogueBox.tsx#Prose.md#1', origine: 'S', paquet: ['dialogues[].nodes[].desc'], note: 'réplique du nœud courant de la scène : `dialogues[].nodes[].desc` est un sélecteur de charge, pas une adresse enracinée dans le document (#2684)' },
  { cle: 'src/ui/MassBattleView.tsx#Prose.md#1', origine: 'S', paquet: ['massBattle.terrain'], note: '`massBattle.terrain` : `startMassBattle` recopie le texte de la spec dans l’état sans sa provenance (`src/state/massBattleFlow.ts`, `terrain: spec.terrain`) — l’effet qui le portait n’a pas d’adresse connaissable à l’écran. Un porteur à l’id faux serait pire que pas de porteur.' },
  { cle: 'src/ui/editor/DialogueDetail.tsx#ProseField.lecture#1', origine: 'S', paquet: [], note: 'réplique d’un nœud de dialogue lue tant qu’elle adresse un passage (`descRef`) : `dialogues[].nodes[].desc` est un sélecteur de charge, pas une adresse enracinée dans le document (#2684)' },
  { cle: 'src/ui/editor/EffectList.tsx#ProseField.lecture#1', origine: 'S', paquet: [], note: 'ligne de l’effet `journal` lue tant qu’elle adresse un passage (`descRef`) : `journal.desc` est un sélecteur de charge, pas une adresse enracinée dans le document (#2684)' },
  { cle: 'src/ui/editor/NarratifEditor.tsx#ProseField.lecture#1', origine: 'S', paquet: [], note: 'description du profil d’un preset lue tant qu’elle adresse un passage (`profil.descRef`) : `ProjetEdite` ne porte pas l’id du document édité et `ProseField` ne prend pas de `porteur` (#2684)' },
  { cle: 'src/ui/editor/EffectList.tsx#ProseField.lecture#2', origine: 'S', paquet: [], note: 'Objectif adressé, texte matérialisé lu dans l’éditeur.' },
  { cle: 'src/ui/editor/EffectList.tsx#ProseField.lecture#3', origine: 'S', paquet: [], note: 'Faveur adressée, texte matérialisé lu dans l’éditeur.' },

  // ── Texte brut (`mdToText`) : tooltips, titres, raisons de refus ──────────────────────────────
  { cle: 'src/ui/compendium/CodexRef.tsx#mdToText#1', origine: 'S', paquet: [], note: 'aperçu tronqué de la description d’une entrée de catalogue : texte brut, rien à lier' },
  { cle: 'src/ui/WorldMapView.tsx#mdToText#1', origine: 'S', paquet: ['worldMap.routes[].refus.texte'], note: 'raison d’un trajet fermé, en texte brut de refus' },
  { cle: 'src/ui/MerchantPanel.tsx#mdToText#1', origine: 'R', paquet: [], note: '`ItemInstance.desc` en aperçu — snapshot d’instance' },
  { cle: 'src/ui/creator/CharacterCreator.tsx#mdToText#1', origine: 'S', paquet: [], note: 'aperçu tronqué d’une description de catalogue du créateur (espèce, carrière, signe)' },
  { cle: 'src/ui/creator/CharacterCreator.tsx#mdToText#2', origine: 'S', paquet: [], note: 'infobulle de la description d’une demeure du catalogue' },
  { cle: 'src/ui/CascadeModal.tsx#mdToText#1', origine: 'S', paquet: ['flow.choice.prompt'], note: 'titre de la fenêtre : `CascadeStep.label`, ou le titre de séquence' },
  { cle: 'src/ui/CascadeModal.tsx#mdToText#2', origine: 'S', paquet: ['flow.choice.prompt'], note: 'nom accessible du groupe d’options : `CascadeStep.label`' },
  { cle: 'src/ui/CascadeModal.tsx#mdToText#3', origine: 'S', paquet: ['flow.choice.prompt'], note: 'libellé d’option : l’option « oui » d’un `choice` reprend son `prompt` (`src/state/combat/triggeredTest.ts`)' },
  { cle: 'src/ui/CascadeModal.tsx#mdToText#4', origine: 'Y', paquet: [], note: 'détail d’option composé par le flux qui ouvre l’étape' },
  { cle: 'src/ui/InterludeScreen.tsx#mdToText#1', origine: 'S', paquet: [], note: 'infobulle de la description d’une qualité d’artisanat du catalogue' },
  { cle: 'src/ui/InterludeScreen.tsx#mdToText#2', origine: 'S', paquet: [], note: 'infobulle de la description d’une qualité d’artisanat du catalogue' },
  { cle: 'src/ui/InterludeScreen.tsx#mdToText#3', origine: 'S', paquet: [], note: 'infobulle de la description d’un talent du catalogue' },
  { cle: 'src/ui/ObjectiveBanner.tsx#mdToText#1', origine: 'S', paquet: ['setObjective.desc'], note: 'objectif courant du bandeau replié, en texte brut' },

  // ── Galerie DEV (montée vivante : des sites réels, pas des fixtures) ──────────────────────────
  { cle: 'src/ui/gallery/registry.tsx#DetailFrame.prose#1', origine: 'S', porteur: 'careers.desc' },
  { cle: 'src/ui/gallery/registry.tsx#DetailFrame.prose#2', origine: 'S', porteur: 'careers.desc' },
  { cle: 'src/ui/gallery/registry.tsx#ActivityPane.desc#1', origine: 'UI', paquet: [], note: 'démo : chaîne de galerie' },
  { cle: 'src/ui/gallery/registry.tsx#ProseField.lecture#1', origine: 'S', paquet: [], note: 'démo de la réplique adressée, composée comme `DialogueDetail` et amorcée de `psychology.json#terreur` (`desc` + `descRef`) : nue comme le site qu’elle montre' },
];

/**
 * Liste des couples `(type, chemin)` comparés aux porteurs émis par le registre du Codex.
 *
 * Les chemins de PROJET sont la projection du registre des proses nommées
 * (`champsProseDeScene`, `src/data/schemas/grammaire/champs-prose-de-scene.ts`), puis celle des clés
 * d'enveloppe de chaque entrée EMBARQUÉE (`adressesDesEntreesEmbarquees`). Leur présence ne dit pas
 * que le rendu porte une identité de liage : le terrain est rendu sans porteur.
 */
const CHEMINS_D_ENVELOPPE = ['desc', 'maison'] as const;

export const CHEMINS_ADRESSES: readonly { type: string; chemin: string }[] = [
  // Enveloppe de document : les deux clés de prose de toute entrée (`champsProse` + `maison`).
  ...CHEMINS_D_ENVELOPPE.map((chemin) => ({ type: '*', chemin })),
  // Champs de prose EN RANGÉE (émis avec leur porteur par `registry.ts`).
  { type: 'spells', chemin: 'ritual.type' },
  { type: 'spells', chemin: 'ritual.components' },
  { type: 'spells', chemin: 'ritual.conditions' },
  { type: 'spells', chemin: 'ritual.sacrifices' },
  { type: 'spells', chemin: 'ritual.consequences' },
  { type: 'activities', chemin: 'outcomes[].note' },
  { type: 'details', chemin: 'texts.age.bySpecies.<espèce>' },
  { type: 'details', chemin: 'texts.taille.bySpecies.<espèce>' },
  { type: 'details', chemin: 'texts.taille.all' },
  { type: 'details', chemin: 'texts.nom.bySpecies.<espèce>' },
  { type: 'characteristics', chemin: 'options[].desc' },
  { type: 'creatures', chemin: 'harvest.uses' },
  // Prose des documents de PROJET (scènes) — déclarée par la grammaire, pas ici.
  ...champsProseDeScene().map((chemin) => ({ type: 'projet', chemin })),
  ...adressesDesEntreesEmbarquees([projetSchema]).flatMap((a) => CHEMINS_D_ENVELOPPE.map((c) => ({ type: 'projet', chemin: `${a}.${c}` }))),
];
