import { nommerChamps } from '../grammaire/meta';
/** LDB 21 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { difficultySchema, stakeFormSchema } from '../grammaire/valeurs';
import { gameOpSchema, triggeredEffectSchema } from '../grammaire/mecanique';
import { refOuSpec } from '../grammaire/ref';

export const file = 'psychology.json';
export const famille = 'entite';

const doc = document(
  'psychology',
  famille,
  {
    passive: z.array(gameOpSchema).optional(),
    effects: z.array(triggeredEffectSchema).optional(),
    gating: nommerChamps(z
      .strictObject({
        action: z.literal('none').optional(),
        movement: z.enum(['none', 'half', 'crawl']).optional(),
        cannotDefend: z.literal(true).optional(),
      }), {
      action: { label: 'Action' },
      movement: { label: 'Déplacement' },
      cannotDefend: { label: 'Défense impossible' },
    })
      .optional(),
    psychImmune: z.boolean().optional(),
    targeted: z.boolean().optional(),
    endedByOtherPsych: z.boolean().optional(),
    immuneToFromTarget: z.array(z.string()).optional(),
    attackDR: nommerChamps(z.strictObject({ amount: z.number(), vs: z.enum(['source', 'group', 'any']) }), { amount: { label: 'Quantité' }, vs: { label: 'Contre' } }).optional(),
    immuneWhileActive: z.array(z.string()).optional(),
    containedSocialMod: z.number().optional(),
    targetCauses: nommerChamps(z.strictObject({ kind: z.string(), indice: z.number() }), { kind: { label: 'Type' }, indice: { label: 'Indice' } }).optional(),
    triggerOn: z.enum(['encounter', 'threatened']).optional(),
    /** ENJEU du Test de Psychologie (#1117 L2) — porté par l'ENTRÉE, pas par un gabarit de `kind` :
     *  les conséquences diffèrent d'une entrée à l'autre (`resolution`/`failCondition`/`failAmount`/
     *  `becomes`), donc un texte au `kind` serait tautologique. Patron `ActivityDef.stake` : l'entité
     *  qui PORTE la règle porte aussi ce que son jet met en jeu. `{indice}` = trou rempli par le flux. */
    stake: z.string().optional(),
    /** FORME DÉCLARÉE du `stake` (même contrat que `night-stakes`/`flow-stakes`/`activities`). */
    stakeForm: stakeFormSchema.optional(),
    resolution: z.enum(['extended', 'terreur', 'binary']).optional(),
    failCondition: z.string().optional(),
    failAmount: nommerChamps(z
      .strictObject({
        base: z.union([z.literal('indice'), z.number()]).optional(),
        perDegreeOfFailure: z.number().optional(),
      }), { base: { label: 'Base' }, perDegreeOfFailure: { label: 'Par degré d’échec' } })
      .optional(),
    becomes: z.string().optional(),
    test: nommerChamps(z.strictObject({ skill: refOuSpec('skill').optional(), difficulty: difficultySchema.optional() }), { skill: { label: 'Compétence' }, difficulty: { label: 'Difficulté' } }).optional(),
  },
  {
    passive: { label: 'Effets passifs' },
    effects: { label: 'Effets déclenchés' },
    gating: { label: 'Restrictions Action/Mouvement/défense' },
    psychImmune: { label: 'Immunise à toute Psychologie' },
    targeted: {
      label: 'Vise une cible',
      hint: 'Ce type de Psychologie porte sur une cible désignée (Animosité, Haine, Préjugé, Phobie — la Cible est un Groupe)',
    },
    endedByOtherPsych: { label: 'Levée par un autre état psy' },
    immuneToFromTarget: { label: 'Immunités face à la Cible' },
    attackDR: { label: 'DR d’attaque', hint: 'Modificateur de DR en attaque, selon la cible (source/groupe/n’importe)' },
    immuneWhileActive: { label: 'Immunités pendant l’état' },
    containedSocialMod: {
      label: 'Modificateur social (contenue)',
      hint: 'Malus au Test de Sociabilité du porteur envers sa Cible tant que le Trait reste contenu (Test réussi) — Animosité −20, Préjugé −10',
    },
    targetCauses: {
      label: 'Régime causé par sa Cible',
      hint: 'L’objet visé devient, POUR LE PORTEUR, une source de Peur/Terreur de cet Indice (Phobie → Peur 1)',
    },
    triggerOn: { label: 'Déclenché par', hint: 'Rencontre ou menace' },
    stake: { label: 'Enjeu' },
    stakeForm: { label: 'Forme de l’enjeu' },
    resolution: { label: 'Mode de résolution', hint: 'Étendu / Terreur / binaire' },
    failCondition: { label: 'État infligé à l’échec', hint: 'Identifiant de l’État posé quand le Test échoue' },
    failAmount: {
      label: 'Quantité infligée à l’échec',
      hint: 'Part fixe (ou l’Indice) + N par degré d’échec — nombre de rangs de l’État posé',
    },
    becomes: {
      label: 'Devient',
      hint: 'Psychologie posée à la suite du Test, quel qu’en soit le résultat (Terreur → Peur de même Indice)',
    },
    test: { label: 'Test associé', hint: 'Compétence/Difficulté du Test de Psychologie' },
  },
  {
    codex: { keys: ['psychologies'] },
    edit: { dataset: 'psychologies' },
  },
  { exiges: ['desc', 'source'] },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
