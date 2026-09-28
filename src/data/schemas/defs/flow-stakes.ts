/**
 * Schéma de `flow-stakes.json` — ENJEU d'un JET DE MODALE MONO (#1117 L1b), keyé par son `id` : le
 * code désigne l'entrée que sa fenêtre sert par `flowStakeRef(id)`, typé `FlowStakeId` (union générée).
 *
 * Troisième dataset de la famille (après `night-stakes` et `voyage-stakes`), même contrat de forme
 * DÉCLARÉE (`form`) : `verbatim` = contigu au Source bloc par bloc ; `descripteur` = assemblage
 * mécanique de ce que le résolveur applique, dont le verbatim intégral vit dans la fiche `rule`.
 *
 * FOYER (`rule` + `ruleCategory`) ou ENTRÉE (`entryCategory`) : le renvoi cible l'entité qui PORTE
 * déjà la règle (compétence, Talent, État, Qualité, Caractéristique, sort, panne…), `regles.json`
 * n'étant que le foyer des règles de cadre. Quand le foyer DESCEND à l'entrée jouée (la chanson
 * chantée, le type de Test d'équipage), l'entrée déclare `entryCategory` et le producteur passe
 * l'`entryId` pris de SON état. Au moins l'un des deux est exigé : un enjeu sans porte est refusé —
 * les deux invariants d'entrée sont portés par `options.affinerEntree`, AVANT le sceau de la fabrique.
 */
import { z } from 'zod';
import { stakeFormSchema } from '../grammaire/valeurs';
import { document } from '../grammaire/document';

export const file = 'flow-stakes.json';
export const famille = 'entite';

const doc = document(
  'flow-stakes',
  famille,
  {
    /** Gabarit du texte d'enjeu, dont les trous sont remplis par le producteur (valeurs calculées). */
    template: z.string(),
    /** FORME DÉCLARÉE (garde `night-stake-form.test.ts`, étendue à ce dataset). EXIGÉE ici, alors
     *  qu'elle est facultative chez les datasets jumeaux — l'écart est un CHOIX, pas un oubli :
     *  `night-stakes` laisse `form` absente parce que son type déclare `verbatim` par DÉFAUT
     *  (13 entrées sur 15 en profitent), `combat-stakes` l'omet exactement quand `template` est
     *  absent (3 sur 3 — il n'y a alors aucun texte à qualifier). Ici `template` est REQUIS : tout
     *  enjeu porte un texte, donc tout enjeu déclare sa forme. */
    form: stakeFormSchema,
    /** Id du FOYER de la règle (entité porteuse, ou fiche de `regles.json` à défaut). */
    rule: z.string().optional(),
    /** Catégorie Codex du foyer (`'regles'`, `'skills'`, `'talents'`, `'etats'`…). */
    ruleCategory: z.string().optional(),
    /** Catégorie Codex de l'ENTRÉE JOUÉE quand le foyer descend jusqu'à elle (`'seaShanties'`,
     *  `'crewTestTypes'`) — le producteur fournit alors l'`entryId` depuis son état. */
    entryCategory: z.string().optional(),
  },
  {
    template: { label: 'Gabarit du texte', hint: 'Trous remplis par le producteur avec les valeurs calculées' },
    form: {
      label: 'Forme de l’enjeu',
      hint: 'Forme déclarée (verbatim/descripteur), toujours requise ici (tout enjeu porte un texte)',
    },
    rule: {
      label: 'Règle associée',
      hint: 'Entité qui porte la règle derrière le jet (compétence, Talent, État, sort, panne…)',
    },
    ruleCategory: { label: 'Catégorie de la règle', hint: 'Catégorie Codex de l’entité qui porte la règle' },
    entryCategory: {
      label: 'Catégorie de l’entrée jouée',
      hint: 'Catégorie Codex de l’entrée jouée quand la règle descend jusqu’à l’entrée (chanson chantée, type de Test d’équipage)',
    },
  },
  {
    codex: { keys: ['flowStakes'] },
    edit: { none: 'exposé en LECTURE seule au Codex (catégorie `flowStakes`) — absent de `CodexEdit.CATEGORY_DATASET`', dataset: 'flowStakes' },
  },
  {
    exiges: ['source'],
    affinerEntree: (entree) =>
      entree.superRefine((v, ctx) => {
        const e = v as { id: string; rule?: string; ruleCategory?: string; entryCategory?: string };
        if (!e.entryCategory && !(e.rule && e.ruleCategory)) {
          ctx.addIssue({ code: 'custom', message: `${e.id} : ni foyer (rule+ruleCategory) ni entryCategory` });
        }
        if (e.rule && !e.ruleCategory) {
          ctx.addIssue({ code: 'custom', message: `${e.id} : rule sans ruleCategory` });
        }
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
