/**
 * Schéma zod d'un PROJET DE SCÈNE (`ProjectDoc`, `src/state/worldMap.ts`) — le paquet de campagne
 * auto-suffisant `{ type: 'projet', id, label, versionContenu, narratif, scenes, worldMap?, activeAxes? }`.
 *
 * C'est la porte UNIQUE du seam `parseProject`. Le document ADOPTE la fabrique `document()`
 * (`../grammaire/document.ts`, #1552) en famille `config` — même code que les defs de configuration
 * sur objet unique (patron `defs/crew-morale.ts`) : l'enveloppe pose `type`, `id`, `label`, `desc`,
 * `icon` et la provenance (`source` ∨ `maison`), la fabrique scelle, et les sémantiques restantes du
 * seam passent par `options.affinerEntree` — FK intra-document des références narratives
 * (`refsNarrativesPendantes` : `entity.presetId`, Effects). `activeAxes` résout au registre par `refs('axe')`. Les invariants du bloc narratif restent portés par
 * `narratifSchema`. Anti-collisions et résolutions de spécialisation restent des `superRefine` :
 * jamais des `ref()` (une référence intra-document n'entre pas au registre global).
 *
 * L'ENVELOPPE est PLATE (#1467 L1b) : les champs d'identité vivent à la RACINE, sans poche `meta`.
 * L'identité n'est plus facultative (arbitrage utilisateur 2026-08-31, AskUser verbatim : « Un projet
 * se NOMME avant d'être enregistré (Recommandé) ») : `id` et `label` sont posés REQUIS par
 * l'enveloppe, `versionContenu` l'est ici — le trio d'identité de #766 était déjà tout-ou-rien, il
 * devient toujours-vrai, et son `superRefine` meurt avec l'optionalité qui le motivait.
 * Aucun numéro de forme : ce schéma EST le contrôle de format du document (#2404).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { nommerChamps, metaDesChamps } from '../grammaire/meta';
import { refs } from '../grammaire/ref';
import { listeCle } from '../grammaire/collection-cle';
import { sceneSchema } from './scene';
import { worldMapSchema } from './worldmap';
import { narratifSchema } from './narratif';
import { refsNarrativesPendantes, type NarratifAReferences } from './refs-narratives';

/** Provenance d'une campagne AUTHORÉE À L'ÉDITEUR : aucun livre ne la publie, et un folio ne se
 *  devine pas. SOURCE UNIQUE — posée par l'éditeur sur un projet qu'il nomme pour la première fois
 *  (`src/ui/editor/Editor.tsx`). */
export const MAISON_PROJET_AUTHORE =
  'campagne authorée à l’éditeur de scènes — aucun livre ne la publie, le document ne cite aucun folio à sa racine';

/** Handle du document de projet : le schéma sert `parseProject`, `meta`/`exposition` le registre. */
export const projetDoc = document(
  'projet',
  'config',
  {
    /** Numéro de CONTENU de l'auteur (dédup d'import : même `id`, version supérieure → remplacement
     *  proposé), jamais un numéro de forme. */
    versionContenu: z.number(),
    auteur: z.string().min(1).optional(),
    scenes: listeCle(sceneSchema, 'id', {
      min: { taille: 1, message: 'le projet ne porte aucune scène : il en faut au moins une pour l’ouvrir ou le jouer.' },
    }),
    worldMap: worldMapSchema.optional(),
    /** Axes de forces/faiblesses ACTIFS de la campagne (#409) — absent = socle `coreAxisIds`. */
    activeAxes: refs('axe').optional(),
    narratif: narratifSchema,
  },
  {
    versionContenu: { label: 'Version de contenu', hint: "Numéro de l'auteur, comparé à l'import (dédup de bibliothèque)" },
    auteur: { label: 'Auteur', texte: { regime: 'designation' } },
    scenes: { label: 'Scènes' },
    worldMap: { label: 'Carte du monde' },
    activeAxes: { label: 'Axes actifs', texte: { regime: 'technique', usage: 'ids des axes actifs du registre' } },
    narratif: { label: 'Bloc narratif' },
  },
  {
    codex: {
      exempt: {
        kind: 'vocabulaire-app-interne',
        raison:
          "paquet de campagne (conteneur d'application : scènes, carte du monde, bloc narratif) — le Codex expose des fiches de RÈGLE, pas un document de campagne ; les règles qu'un projet référence y sont déjà exposées par leurs propres documents.",
      },
    },
    edit: {
      none: "édité par l'ÉDITEUR DE SCÈNES (`src/ui/editor/Editor.tsx`), jamais par un formulaire d'atelier du Codex — aucune catégorie Codex ne l'expose",
    },
  },
  {
    affinerEntree: (entree) =>
      nommerChamps(entree, {
        ...metaDesChamps(entree),
        id: { label: 'Identifiant', texte: { regime: 'technique', usage: 'id stable du projet' } },
        label: { label: 'Nom', texte: { regime: 'designation' } },
        labelF: { label: 'Nom féminin', texte: { regime: 'designation' } },
        desc: { label: 'Description', texte: { regime: 'document', horsContrat: { motif: 'sans-saisie-campagne', preuve: 'src/ui/editor/Editor.tsx:Avancé' } } },
        maison: { label: 'Maison', texte: { regime: 'technique', usage: 'diagnostic de provenance documentaire du projet' } },
        icon: { label: 'Icône', texte: { regime: 'technique', usage: 'id de l’icône du projet' } },
      }).superRefine((valeur, ctx) => {
        const doc = valeur as { scenes: unknown[]; worldMap?: unknown; narratif: NarratifAReferences };
        /** FK INTRA-document (#671, #679) : toute référence narrative des scènes (`presetId` d'entité,
         *  `documentId`/`indiceId`/`stade` d'Effect, Flows portés compris) et de la carte du monde résout
         *  au narratif du document — visiteur unique `./refs-narratives.ts`. */
        for (const f of refsNarrativesPendantes(doc, doc.narratif)) ctx.addIssue({ code: 'custom', path: [...f.chemin], message: f.message });
      }),
  },
);

/** `ProjectDoc` — le document SCELLÉ, porte unique du seam `parseProject`. */
export const projetSchema = projetDoc.schema;
