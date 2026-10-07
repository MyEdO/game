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
 * Module PUR : son SEUL import est la feuille `champs-prose-de-scene.ts` (une liste de chaînes,
 * sans zod ni donnée). Il portera en T1 le tokeniseur
 * partagé rapport/rendu. Ici il ne porte que les DEUX listes fermées que les gardes comparent au
 * code réel — `SITES_PROSE` (qui rend du markdown, et avec quel porteur) et `CHEMINS_ADRESSES`
 * (quels champs sont adressés).
 */
import { champsProseDeScene } from '../data/schemas/grammaire/champs-prose-de-scene';

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
 * dont la valeur n'est PAS la simple transmission d'une prop du composant courant.
 *
 * `cle` = `fichier#Balise.prop#n` (`n` = rang de ce couple balise/prop DANS le fichier, en ordre de
 * source) — jamais un numéro de ligne, qui bougerait au premier commentaire ajouté.
 * `porteur` (pour S) = `type.chemin` du champ rendu — mémo de lecture ; la garde ne résout PAS les
 * valeurs (angle mort DIT dans `prose-sites.test.ts`), elle vérifie que la PROP `porteur` est passée
 * exactement là où cette liste en déclare un.
 */
export interface SiteProse {
  cle: string;
  origine: OrigineProse;
  porteur?: string;
  /** Pourquoi ce site ne porte rien, quand l'absence n'est pas évidente. */
  note?: string;
}

/**
 * Les sites terminaux de prose de `src/**` (hors `*.test.tsx`). Liste FERMÉE : un site de plus, un
 * site qui change de porteur, et `src/ui/prose-sites.test.ts` rougit — dans les deux sens.
 */
export const SITES_PROSE: SiteProse[] = [
  // ── Codex : la fiche et ses rangées ───────────────────────────────────────────────────────────
  { cle: 'src/ui/compendium/CodexEntry.tsx#Prose.md#1', origine: 'S', porteur: '<entrée>.<chemin de la rangée>', note: 'rangée `t:text` : porteur composé par `CodexRowView` quand la rangée en déclare un (sinon nu)' },
  { cle: 'src/ui/compendium/CodexEntry.tsx#Prose.md#2', origine: 'Y', note: 'corps d’un `t:fold` — forme technique d’atelier (`describe`), jamais un champ' },
  { cle: 'src/ui/compendium/CodexEntry.tsx#Prose.md#3', origine: 'S', porteur: '<catégorie>.desc' },
  { cle: 'src/ui/compendium/CodexEntry.tsx#Prose.md#4', origine: 'S', porteur: '<catégorie>.maison' },
  { cle: 'src/ui/compendium/DescRefField.tsx#Prose.md#1', origine: 'S', note: 'RESTE T0 : aperçu de l’adresse en cours d’édition. Le champ générique de l’atelier (`CodexEdit.tsx:1829`) ne connaît ni le type ni l’id de l’entrée à ce point ; c’est le train T2 qui fait descendre le porteur dans le champ générique (design v6 §7).' },

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
  { cle: 'src/ui/CityHubScreen.tsx#ActivityPane.desc#5', origine: 'UI', note: 'littéral d’écran (« Ce point mène à un autre endroit. ») — aucune source' },

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
  { cle: 'src/ui/StakeNote.tsx#Prose.md#1', origine: 'Y', note: 'les 3 formes de `resolveStake` (`src/data/index.ts`) : synthèse, texte authoré de scène, gabarit substitué — aucune n’est un champ rendu verbatim' },
  { cle: 'src/ui/DialogueHistoryScreen.tsx#Prose.md#1', origine: 'R', note: 'texte de nœud RECOPIÉ au tour joué (journal runtime)' },
  { cle: 'src/ui/MerchantPanel.tsx#Prose.md#1', origine: 'R', note: '`ItemInstance.desc` — snapshot d’instance, surchargeable par un objet custom (`giveTrapping`)' },
  { cle: 'src/ui/PartyScreen.tsx#DetailFrame.prose#1', origine: 'Y', note: 'présentation composée des champs du héros + libellés i18n' },

  // ── Prose de SCÈNE : adressée, mais son projet n'a pas d'identité en jeu (reste nommé de T0) ───
  { cle: 'src/ui/CampaignOpeningScreen.tsx#Prose.md#1', origine: 'S', note: 'RESTE T0 : `narratif.ouverture.pitch` est un champ adressé (cf. `CHEMINS_ADRESSES`) mais l’id du projet n’est pas en portée — `campaignDoc` (`src/state/store.ts:2218`) ne porte pas d’id et `pendingCampaign` redevient `null` après `loadProject` (`src/state/devtools.test.ts:444`). Un porteur à l’id faux serait pire que pas de porteur.' },
  { cle: 'src/ui/CarnetScreen.tsx#Prose.md#1', origine: 'S', note: 'RESTE T0 : `narratif.indices[].stades[].prose` — même blocage d’identité de projet' },
  { cle: 'src/ui/CarnetScreen.tsx#Prose.md#2', origine: 'S', note: 'RESTE T0 : idem (lectures précédentes)' },
  { cle: 'src/ui/DocumentModal.tsx#Prose.md#1', origine: 'S', note: 'RESTE T0 : `store.document.text` — la prose de `narratif.documents[].prose` que pose l’effet `document` (`src/state/combatEffects.ts`), même blocage d’identité de projet ; la même surface rend aussi le rapport de naufrage, texte RUNTIME (`src/state/shipwreck.ts`)' },
  { cle: 'src/ui/MassBattleView.tsx#Prose.md#1', origine: 'S', note: 'RESTE T0 : `massBattle.terrain`, authoré dans l’effet de scène — même blocage d’identité de projet' },
  { cle: 'src/ui/editor/DialogueDetail.tsx#ProseField.lecture#1', origine: 'S', note: 'RESTE T0 : réplique d’un nœud de dialogue lue tant qu’elle adresse un passage (`descRef`) — prose de scène, même blocage d’identité de projet' },
  { cle: 'src/ui/editor/EffectList.tsx#ProseField.lecture#1', origine: 'S', note: 'RESTE T0 : ligne de l’effet `journal` lue tant qu’elle adresse un passage (`descRef`) — prose de scène, même blocage d’identité de projet' },

  // ── Galerie DEV (montée vivante : des sites réels, pas des fixtures) ──────────────────────────
  { cle: 'src/ui/gallery/registry.tsx#DetailFrame.prose#1', origine: 'S', porteur: 'careers.desc' },
  { cle: 'src/ui/gallery/registry.tsx#DetailFrame.prose#2', origine: 'S', porteur: 'careers.desc' },
  { cle: 'src/ui/gallery/registry.tsx#ActivityPane.desc#1', origine: 'UI', note: 'démo : chaîne de galerie' },
  { cle: 'src/ui/gallery/registry.tsx#ProseField.lecture#1', origine: 'S', note: 'démo de la réplique adressée, composée comme `DialogueDetail` et amorcée de `psychology.json#terreur` (`desc` + `descRef`) : nue comme le site qu’elle montre' },
];

/**
 * Liste des couples `(type, chemin)` comparés aux porteurs émis par le registre du Codex.
 *
 * Les chemins de PROJET sont la projection du registre des proses nommées
 * (`champsProseDeScene`, `src/data/schemas/grammaire/champs-prose-de-scene.ts`). Leur présence au
 * registre ne dit pas que le rendu porte une identité de liage : le terrain est rendu sans porteur.
 */
export const CHEMINS_ADRESSES: readonly { type: string; chemin: string }[] = [
  // Enveloppe de document : les deux clés de prose de toute entrée (`champsProse` + `maison`).
  { type: '*', chemin: 'desc' },
  { type: '*', chemin: 'maison' },
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
];
