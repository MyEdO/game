/**
 * Schéma de `stakes.json` — l'ENJEU d'un jet de cascade (#1117, collection #1681) : ce que le jet met
 * en jeu, et le FOYER de la règle qui l'exige. Chargé en `STAKES` (`src/data/index.ts`), lu par
 * `resolveStake` à la clé `{ dataset: cascade, kind: cle }`, construite par `stakeRef` et ses portes
 * typées (`nightStakeRef`, `voyageStakeRef`, `flowStakeRef`, `combatStakeRef`).
 *
 * Le discriminant `cascade` dit QUELLE famille de jets l'entrée sert (ses valeurs sont celles de
 * `StakeKey.dataset`) ; `cle` est la clé de consommation : le `kind` de l'étape (nuit, voyage, combat)
 * ou l'id du jet de modale (`FlowStakeId`). Le couple `(cascade, cle)` est unique.
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
  night: 'Cascade de repos',
  voyage: 'Cascade de voyage',
  flow: 'Modales de jet',
  combat: 'Cascade de combat',
} as const satisfies Record<StakeCascade, string>;

/**
 * Par cascade : les clés de CHARGE admises (`cles`), celles EXIGÉES (`requises`), et si l'entrée doit
 * porter une PORTE vers sa règle (`porte` : `rule`, `entryCategory` ou `entryFromSource`). Le voyage
 * n'en exige pas : `stake-rule-ratchet.test.ts` énumère son stock sans foyer.
 */
const CHARGE_PAR_CASCADE = {
  night: { cles: ['template', 'form', 'rule'], requises: ['template', 'form'], porte: true },
  voyage: { cles: ['template', 'form', 'rule'], requises: ['template', 'form'], porte: false },
  flow: { cles: ['template', 'form', 'rule', 'entryCategory'], requises: ['template', 'form'], porte: true },
  combat: { cles: ['template', 'form', 'rule', 'entryCategory', 'entryFromSource'], requises: [], porte: true },
} as const satisfies Record<StakeCascade, { cles: readonly string[]; requises: readonly string[]; porte: boolean }>;

const chargeParDiscriminant: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  Object.entries(CHARGE_PAR_CASCADE).map(([cascade, charge]) => [cascade, charge.cles as readonly string[]]),
);
const requisesParDiscriminant: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  Object.entries(CHARGE_PAR_CASCADE).map(([cascade, charge]) => [cascade, charge.requises as readonly string[]]),
);

const doc = document(
  'stakes',
  famille,
  {
    cascade: enumNomme(LIBELLES_DE_CASCADE),
    cle: z.string().min(1),
    template: z.string().optional(),
    form: stakeFormSchema.optional(),
    rule: foyerDeRegleSchema.optional(),
    entryCategory: z.string().optional(),
    entryFromSource: z.boolean().optional(),
  },
  {
    cascade: { label: 'Cascade', hint: 'Famille de jets que l’enjeu sert — les champs admis en dépendent' },
    cle: {
      label: 'Clé de consommation',
      hint: 'Étape de la cascade servie (ou du tirage, quand l’étape joue deux tables), ou identifiant du jet de modale — distincte de l’identifiant',
    },
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
          cle: string;
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
        if (CHARGE_PAR_CASCADE[e.cascade]?.porte && !e.rule && !e.entryCategory && !e.entryFromSource) {
          ctx.addIssue({ code: 'custom', path: ['rule'], message: `${e.id} : ni foyer (rule) ni catégorie d’entrée` });
        }
        // Le jet de modale se désigne par son id (`FlowStakeId`, union générée des ids de la cascade).
        if (e.cascade === 'flow' && e.cle !== e.id) {
          ctx.addIssue({ code: 'custom', path: ['cle'], message: `${e.id} : la clé d’un jet de modale est son identifiant (« ${e.cle} »)` });
        }
      }),
    affinerDataset: (dataset) =>
      dataset.superRefine((v, ctx) => {
        const vus = new Map<string, string>();
        for (const e of v as { id: string; cascade: string; cle: string }[]) {
          const cle = `${e.cascade}/${e.cle}`;
          const deja = vus.get(cle);
          if (deja) ctx.addIssue({ code: 'custom', path: [], message: `stakes.json : « ${deja} » et « ${e.id} » servent la même clé ${cle}` });
          else vus.set(cle, e.id);
        }
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
