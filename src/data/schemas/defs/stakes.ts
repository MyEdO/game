/**
 * Schéma de `stakes.json` — l'ENJEU d'un jet de cascade (#1117, collection #1681) : ce que le jet met
 * en jeu, et le FOYER de la règle qui l'exige. Chargé en `STAKES` (`src/data/index.ts`), lu par
 * `resolveStake` à la clé `{ dataset: cascade, kind: id }`, construite par `stakeRef` et ses portes
 * typées (`nightStakeRef`, `voyageStakeRef`, `flowStakeRef`, `combatStakeRef`), chacune typée par l'union
 * des ids de sa cascade.
 *
 * Le discriminant `cascade` dit QUELLE famille de jets l'entrée sert (ses valeurs sont celles de
 * `StakeKey.dataset`) ; l'`id` est la seule identité de l'enjeu (#2968 L19).
 *
 * `template` est le texte, gabarit dont les trous `{nom}` reçoivent les valeurs CALCULÉES par le
 * producteur ; `form` dit sa nature : `verbatim` = chaque bloc est contigu au chapitre cité par
 * `source.note` (garde `stake-form.test.ts`), `descripteur` = assemblage mécanique dont le verbatim
 * intégral vit dans la fiche du foyer. Les deux vont ensemble : une entrée sans texte (issue lue en
 * chips d'ops) ne porte que son foyer.
 *
 * FOYER (`rule`) ou ENTRÉE (`entryCategory`, `entryFromSource`) : le renvoi cible l'entité qui PORTE la
 * règle (compétence, État, symptôme, maladie, manœuvre, sort…), `regles.json` n'étant que le foyer des
 * règles de cadre ; le foyer est la règle qui EXIGE le jet, jamais son issue.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { enumNomme, foyerDeRegleSchema, stakeFormSchema } from '../grammaire/valeurs';
import type { StakeCascade } from '../../index';

export const file = 'stakes.json';
export const famille = 'entite';

/** Libellés FR des CASCADES — l'univers du discriminant (`enumNomme`), les groupes du Codex. */
const LIBELLES_DE_CASCADE = {
  nuit: 'Cascade de repos',
  voyage: 'Cascade de voyage',
  flux: 'Modales de jet',
  combat: 'Cascade de combat',
} as const satisfies Record<StakeCascade, string>;

/** Par cascade : les clés de CHARGE admises (`espace.chargeParDiscriminant`). */
const chargeParDiscriminant = {
  nuit: ['template', 'form', 'rule'],
  voyage: ['template', 'form', 'rule'],
  flux: ['template', 'form', 'rule', 'entryCategory'],
  combat: ['template', 'form', 'rule', 'entryCategory', 'entryFromSource'],
} as const satisfies Record<StakeCascade, readonly string[]>;

/** Par cascade : les clés EXIGÉES de sa charge (`espace.requisesParDiscriminant`). */
const requisesParDiscriminant = {
  nuit: ['template', 'form'],
  voyage: ['template', 'form'],
  flux: ['template', 'form'],
  combat: [],
} as const satisfies { readonly [C in StakeCascade]: readonly (typeof chargeParDiscriminant)[C][number][] };

/** Par cascade : l'entrée porte-t-elle une PORTE vers sa règle (`rule`, `entryCategory` ou `entryFromSource`). Le
 *  voyage n'en exige pas : `stake-rule-ratchet.test.ts` énumère son stock sans foyer. */
const PORTE_PAR_CASCADE = { nuit: true, voyage: false, flux: true, combat: true } as const satisfies Record<StakeCascade, boolean>;

const doc = document(
  'stakes',
  famille,
  {
    cascade: enumNomme(LIBELLES_DE_CASCADE),
    template: z.string().optional(),
    form: stakeFormSchema.optional(),
    rule: foyerDeRegleSchema.optional(),
    entryCategory: z.string().optional(),
    entryFromSource: z.boolean().optional(),
  },
  {
    cascade: { label: 'Cascade', hint: 'Famille de jets que l’enjeu sert — les champs admis en dépendent' },
    template: {
      label: 'Gabarit du texte',
      // Les ACCOLADES restent hors du répertoire des libellés (garde `libelles-guard`) : ce sont des
      // signes de code, et les admettre laisserait passer une interpolation à l’écran. Le trou
      // nommé se DIT donc en français plutôt qu’il ne se montre.
      hint: 'Trous nommés remplis par les valeurs calculées au moment du jet — absent quand l’issue se lit en chips d’effets',
    },
    form: {
      label: 'Forme de l’enjeu',
      hint: 'Forme déclarée du gabarit (verbatim / descripteur) — présente si et seulement s’il y a un gabarit',
    },
    rule: { label: 'Règle associée', hint: 'Entité qui EXIGE le jet (jamais son issue), ou fiche de règles-cadre' },
    entryCategory: {
      label: 'Catégorie de l’entrée jouée',
      hint: 'Catégorie Codex de l’entrée jouée quand la règle descend jusqu’à elle (maladie, manœuvre, sort, chanson…)',
    },
    entryFromSource: {
      label: 'Catégorie fournie par la source',
      hint: 'La catégorie de l’entrée vient de l’entité source de l’effet — fournie par le producteur, pas par la donnée',
    },
  },
  {
    codex: { keys: ['stakes'] },
    edit: { dataset: 'stakes' },
  },
  {
    exiges: ['source'],
    espace: { discriminant: 'cascade', chargeParDiscriminant, requisesParDiscriminant },
    affinerEntree: (entree) =>
      entree.superRefine((v, ctx) => {
        const e = v as {
          id: string;
          cascade: StakeCascade;
          template?: string;
          form?: string;
          rule?: unknown;
          entryCategory?: string;
          entryFromSource?: boolean;
        };
        if (!!e.template !== !!e.form) {
          ctx.addIssue({ code: 'custom', path: ['form'], message: `${e.id} : la forme qualifie le gabarit — les deux ensemble, ou aucun` });
        }
        if (!e.template && !e.rule) {
          ctx.addIssue({ code: 'custom', path: ['rule'], message: `${e.id} : entrée sans gabarit ET sans foyer — elle ne dirait plus rien` });
        }
        if (PORTE_PAR_CASCADE[e.cascade] && !e.rule && !e.entryCategory && !e.entryFromSource) {
          ctx.addIssue({ code: 'custom', path: ['rule'], message: `${e.id} : ni foyer (rule) ni catégorie d’entrée` });
        }
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
