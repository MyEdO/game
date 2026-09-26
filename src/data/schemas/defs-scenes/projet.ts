/**
 * Schéma zod d'un PROJET DE SCÈNE (`ProjectDoc`, `src/state/worldMap.ts`) — le paquet de campagne
 * auto-suffisant `{ type: 'projet', schema, id, label, versionContenu, narratif, scenes,
 * worldMap?, activeAxes? }`, `schema` étant la version de forme courante (`SCHEMA_PROJET`).
 *
 * C'est la porte UNIQUE du seam `parseProject`. Le document ADOPTE la fabrique `document()`
 * (`../grammaire/document.ts`, #1552) en famille `config` — même code que les defs de configuration
 * sur objet unique (patron `defs/crew-morale.ts`) : l'enveloppe pose `type`, `id`, `label`, `desc`,
 * `icon` et la provenance (`source` ∨ `maison`), la fabrique scelle, et les sémantiques restantes du
 * seam passent par `options.affinerEntree` — FK intra-document `entity.presetId` →
 * `narratif.presetsPnj`. `activeAxes` résout au registre par `refs('axe')`. Les invariants du bloc narratif restent portés par
 * `narratifSchema`. Anti-collisions et résolutions de spécialisation restent des `superRefine` :
 * jamais des `ref()` (une référence intra-document n'entre pas au registre global).
 *
 * L'ENVELOPPE est PLATE (#1467 L1b) : les champs d'identité vivent à la RACINE, sans poche `meta`.
 * L'identité n'est plus facultative (arbitrage utilisateur 2026-08-31, AskUser verbatim : « Un projet
 * se NOMME avant d'être enregistré (Recommandé) ») : `id` et `label` sont posés REQUIS par
 * l'enveloppe, `versionContenu` l'est ici — le trio d'identité de #766 était déjà tout-ou-rien, il
 * devient toujours-vrai, et son `superRefine` meurt avec l'optionalité qui le motivait.
 * La version de FORME du document reste le littéral `schema`, champ de charge utile de ce document.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { refs } from '../grammaire/ref';
import { listeCle } from '../grammaire/collection-cle';
import { sceneSchema } from './scene';
import { worldMapSchema } from './worldmap';
import { narratifSchema } from './narratif';

/** Version de FORME du document de projet — reprise par `CURRENT_PROJECT_SCHEMA` (`worldMap.ts`). */
export const SCHEMA_PROJET = 15;

/** Handle du document de projet : `schema` sert `parseProject`, `meta`/`exposition` le registre. */
export const projetDoc = document(
  'projet',
  'config',
  {
    schema: z.literal(SCHEMA_PROJET),
    /** Numéro de CONTENU de l'auteur (dédup d'import : même `id`, version supérieure → remplacement
     *  proposé). La version de FORME du document est `schema`, jamais ce champ. */
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
    schema: { label: 'Version de forme du document' },
    versionContenu: { label: 'Version de contenu', hint: "Numéro de l'auteur, comparé à l'import (dédup de bibliothèque)" },
    auteur: { label: 'Auteur' },
    scenes: { label: 'Scènes' },
    worldMap: { label: 'Carte du monde' },
    activeAxes: { label: 'Axes actifs' },
    narratif: { label: 'Bloc narratif' },
  },
  {
    // EXPOSITION DÉCORATIVE à ce jour, et c'est mesuré : `exposition-derivee.ts` dérive ses tables du
    // SEUL registre `SCHEMA_DEFS` (racine `src/data`) ; aucun consommateur ne lit l'`exposition` des
    // entrées de `SCHEMA_DEFS_SCENES`. Elle est déclarée quand même : la fabrique l'EXIGE de tout
    // document, et cette déclaration-ci dit ce qu'un projet est — illisible au Codex, édité par
    // l'éditeur de scènes. Le jour où la dérivation couvrira les deux racines, elle sera déjà vraie.
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
      entree.superRefine((valeur, ctx) => {
        const doc = valeur as {
          scenes: { entities?: { presetId?: string }[] }[];
          narratif: { presetsPnj: { id: string }[] };
        };
        /** FK INTRA-document (#671) : tout `presetId` d'entité de scène résout un preset déclaré. */
        const presets = new Set(doc.narratif.presetsPnj.map((p) => p.id));
        doc.scenes.forEach((s, is) => {
          (s.entities ?? []).forEach((e, ie) => {
            if (e.presetId === undefined || presets.has(e.presetId)) return;
            ctx.addIssue({
              code: 'custom',
              path: ['scenes', is, 'entities', ie, 'presetId'],
              message: `preset de PNJ inconnu « ${e.presetId} » (narratif.presetsPnj).`,
            });
          });
        });
      }),
  },
);

/** `ProjectDoc` — le document SCELLÉ, porte unique du seam `parseProject`. */
export const projetSchema = projetDoc.schema;
