/**
 * Schéma zod d'un PROJET DE SCÈNE (`ProjectDoc`, `src/state/worldMap.ts`) — le paquet de campagne
 * auto-suffisant `{ type: 'projet', schema: SCHEMA_PROJET, id, label, versionContenu, narratif, scenes,
 * worldMap?, activeAxes? }`, `schema` étant la version de forme courante.
 *
 * C'est la porte UNIQUE du seam `parseProject`. Le document ADOPTE la fabrique `document()`
 * (`../grammaire/document.ts`, #1552) en famille `config` — même code que les defs de configuration
 * sur objet unique (patron `defs/crew-morale.ts`) : l'enveloppe pose `type`, `id`, `label`, `desc`,
 * `icon` et la provenance (`source` ∨ `maison`), la fabrique scelle, et les sémantiques restantes du
 * seam passent par `options.affinerEntree` — FK intra-document `entity.presetId` →
 * `narratif.presetsPnj`, objets du projet instanciables par leur id — et par `options.registresOuverts`,
 * le registre du PROJET des feuilles `idDe` OUVERTES (`registresDuProjet`).
 * `activeAxes` résout au registre par `refs('axe')`. Les invariants du bloc narratif restent portés par
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
import { document, type RegistresOuverts } from '../grammaire/document';
import { refs, refusDeLEntree } from '../grammaire/ref';
import { INSTANCIABLE_PAR_ID } from '../grammaire/sousListes';
import { trappingDesObjetsPuisDuCatalogue, type TrappingData } from '../../index';
import { listeCle } from '../grammaire/collection-cle';
import { sceneSchema } from './scene';
import { worldMapSchema } from './worldmap';
import { narratifSchema } from './narratif';
import { PROJECT_MIGRATIONS } from '../../migrationsDeProjet';
import { versionCourante } from '../../../lib/versionCourante';
import { opExigeUneSource } from '../../../engine/types';

/** Provenance d'un objet du projet, telle qu'un refus de sous-liste la nomme. */
const DES_OBJETS_DU_PROJET = 'des objets du projet (narratif.objets)';

/** Les objets du projet (`narratif.objets`) d'une valeur d'entrée — vide si le bloc est mal formé (le
 *  schéma du bloc le refuse alors lui-même). */
const objetsDe = (valeur: unknown): readonly TrappingData[] => {
  const objets = (valeur as { narratif?: { objets?: unknown } } | null)?.narratif?.objets;
  return Array.isArray(objets) ? (objets as TrappingData[]) : [];
};

/** Les ops à SOURCE (`opExigeUneSource`) d'un document, à leur chemin : un document authoré n'est aucune
 *  entité du Codex, l'op n'y a pas d'Effet qui la désigne. */
function opsASourceDe(noeud: unknown, chemin: (string | number)[] = []): { chemin: (string | number)[]; op: string }[] {
  if (Array.isArray(noeud)) return noeud.flatMap((n, i) => opsASourceDe(n, [...chemin, i]));
  if (noeud === null || typeof noeud !== 'object') return [];
  const op = (noeud as { op?: unknown }).op;
  const ici = typeof op === 'string' && opExigeUneSource(op) ? [{ chemin, op }] : [];
  return [...ici, ...Object.entries(noeud).flatMap(([cle, n]) => opsASourceDe(n, [...chemin, cle]))];
}

/** Le registre du PROJET de chaque type qu'une feuille ouverte désigne (`document()`,
 *  `registresOuverts`) : les objets d'abord (`narratif.objets`), puis le catalogue
 *  (`trappingDesObjetsPuisDuCatalogue`). */
function registresDuProjet(objets: readonly TrappingData[]): RegistresOuverts {
  const parId = new Map(objets.map((o) => [o.id, o]));
  return {
    trapping: {
      resoudre: (id) => trappingDesObjetsPuisDuCatalogue(parId, id),
      ou: 'ni un objet du projet (narratif.objets) ni une entrée du catalogue des objets (trappings.json)',
      provenance: DES_OBJETS_DU_PROJET,
    },
  };
}

/** Version de FORME du document de projet — reprise par `CURRENT_PROJECT_SCHEMA` (`worldMap.ts`). */
export const SCHEMA_PROJET = versionCourante(PROJECT_MIGRATIONS);

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
            if (!e.presetId || presets.has(e.presetId)) return;
            ctx.addIssue({
              code: 'custom',
              path: ['scenes', is, 'entities', ie, 'presetId'],
              message: `preset de PNJ inconnu « ${e.presetId} » (narratif.presetsPnj).`,
            });
          });
        });
        for (const { chemin, op } of opsASourceDe(valeur)) {
          ctx.addIssue({
            code: 'custom',
            path: chemin,
            message: `GameOp « ${op} » : son produit est désigné par l’Effet qui la porte (un sort, un talent… du Codex) ; un document de projet n’en est pas un, l’op n’y est pas admise.`,
          });
        }
        /** Un objet du projet s'instancie par son SEUL id (`itemFromTrappingById`) : `INSTANCIABLE_PAR_ID`. */
        objetsDe(valeur).forEach((o, i) => {
          const refus = refusDeLEntree('trapping', INSTANCIABLE_PAR_ID, o, DES_OBJETS_DU_PROJET);
          if (refus !== null) ctx.addIssue({ code: 'custom', path: ['narratif', 'objets', i], message: `objet du projet désigné par son id : ${refus}` });
        });
      }),
    registresOuverts: (valeur) => registresDuProjet(objetsDe(valeur)),
  },
);

/** `ProjectDoc` — le document SCELLÉ, porte unique du seam `parseProject`. */
export const projetSchema = projetDoc.schema;
