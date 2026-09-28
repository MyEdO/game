/**
 * Schéma de `combat-stakes.json` — ENJEU d'un `kind` d'étape de cascade de COMBAT (#1117 L2). Quatrième
 * dataset de la famille (après `night-stakes`, `voyage-stakes`, `flow-stakes`), même contrat de forme
 * DÉCLARÉE (`form`) : `verbatim` = contigu au Source bloc par bloc ; `descripteur` = assemblage
 * mécanique de ce que l'APPLIER du `kind` fait réellement, dont le verbatim intégral vit dans la fiche.
 *
 * FOYER (`rule` + `ruleCategory`) ou ENTRÉE (`entryCategory`) : le renvoi cible l'entité qui PORTE déjà
 * la règle (l'État posé par l'échec, la maladie contractée, la manœuvre subie, le sort prolongé),
 * `regles.json` n'étant que le foyer des règles de cadre. Au moins l'un des deux est exigé — les
 * quatre invariants d'entrée sont portés par `options.affinerEntree`, AVANT le sceau de la fabrique.
 */
import { z } from 'zod';
import { stakeFormSchema } from '../grammaire/valeurs';
import { document } from '../grammaire/document';

export const file = 'combat-stakes.json';
export const famille = 'entite';

const doc = document(
  'combat-stakes',
  famille,
  {
    /** `kind` servi : celui de l'applier de cascade quand il en existe un, sinon celui du TIRAGE
     *  (une même étape joue sur deux jeux de tables — Imparfaite / Colère des dieux). */
    kind: z.string(),
    /** Gabarit du descripteur, dont les trous sont remplis par le flux (valeurs calculées). OPTIONNEL :
     *  un jet dont l'issue se LIT en chips d'ops (`OutcomeNote`, #1117) n'a plus de phrase à stocker,
     *  l'entrée ne garde que son foyer de règle (le ⓘ du titre). */
    template: z.string().optional(),
    /** FORME DÉCLARÉE (garde `night-stake-form.test.ts`, étendue à ce dataset) — qualifie le gabarit :
     *  présente si et seulement s'il y en a un. */
    form: stakeFormSchema.optional(),
    /** Id du FOYER de la règle (entité porteuse, ou fiche de `regles.json` à défaut). Le foyer est la
     *  règle qui EXIGE le jet, JAMAIS son issue : le ⓘ du titre ouvre cette règle, les chips d'issue
     *  ouvrent la conséquence appliquée (arbitrage user 2026-08-09 : « ce jet fait référence à une
     *  règle non ? » — la Surprise pointait l'État Surpris, qui n'est que ce qu'on y perd). */
    rule: z.string().optional(),
    /** Catégorie Codex du foyer (`'regles'`, `'etats'`, `'maladies'`…). */
    ruleCategory: z.string().optional(),
    /** Catégorie Codex de l'ENTRÉE JOUÉE quand le foyer descend jusqu'à elle (`'maladies'`,
     *  `'maneuvers'`, `'spells'`) — le producteur fournit alors l'`entryId` depuis son `meta`. */
    entryCategory: z.string().optional(),
    /** La catégorie de l'entrée vient de l'ENTITÉ SOURCE de l'effet (nature variable — objet,
     *  Talent, maladie…) : seul le PRODUCTEUR peut la nommer. Vaut PORTE, comme `entryCategory`. */
    entryFromSource: z.boolean().optional(),
  },
  {
    kind: { label: 'Type d’étape', hint: 'Étape de la cascade de combat servie (ou du tirage, quand l’étape joue deux tables)' },
    template: { label: 'Gabarit du texte', hint: 'Descripteur mécanique — optionnel quand l’issue se lit en chips d’effets' },
    form: {
      label: 'Forme de l’enjeu',
      hint: 'Qualifie le gabarit (verbatim / descripteur) — présente si et seulement s’il y a un gabarit',
    },
    rule: { label: 'Règle associée', hint: 'Entité qui EXIGE le jet (jamais son issue)' },
    ruleCategory: { label: 'Catégorie de la règle', hint: 'Catégorie Codex de l’entité qui porte la règle' },
    entryCategory: {
      label: 'Catégorie de l’entrée jouée',
      hint: 'Catégorie Codex de l’entrée jouée quand la règle descend jusqu’à l’entrée (maladie, manœuvre, sort)',
    },
    entryFromSource: {
      label: 'Catégorie fournie par la source',
      hint: 'La catégorie de l’entrée vient de l’entité source de l’effet — fournie par le producteur, pas par la donnée',
    },
  },
  {
    codex: { keys: ['combatStakes'] },
    edit: { none: 'exposé en LECTURE seule au Codex (catégorie `combatStakes`) — absent de `CodexEdit.CATEGORY_DATASET`', dataset: 'combatStakes' },
  },
  {
    exiges: ['source'],
    affinerEntree: (entree) =>
      entree.superRefine((v, ctx) => {
        const e = v as {
          id: string;
          template?: string;
          form?: string;
          rule?: string;
          ruleCategory?: string;
          entryCategory?: string;
          entryFromSource?: boolean;
        };
        if (!e.entryCategory && !e.entryFromSource && !(e.rule && e.ruleCategory)) {
          ctx.addIssue({ code: 'custom', message: `${e.id} : ni foyer (rule+ruleCategory) ni entryCategory` });
        }
        if (e.rule && !e.ruleCategory) {
          ctx.addIssue({ code: 'custom', message: `${e.id} : rule sans ruleCategory` });
        }
        if (!!e.template !== !!e.form) {
          ctx.addIssue({ code: 'custom', message: `${e.id} : la forme qualifie le gabarit — les deux ensemble, ou aucun` });
        }
        if (!e.template && !(e.rule && e.ruleCategory)) {
          ctx.addIssue({ code: 'custom', message: `${e.id} : entrée sans gabarit ET sans foyer — elle ne dirait plus rien` });
        }
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
