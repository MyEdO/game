import { nommerChamps } from '../grammaire/meta';
/** LDB 21 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { enumNomme, stakeFormSchema, varianteDeCibleSchema } from '../grammaire/valeurs';
import { flowTestSchema, mecaniqueDe, passifsDe } from '../grammaire/mecanique';
import { idDe, ref, refs } from '../grammaire/ref';

export const file = 'psychology.json';
export const famille = 'entite';

const doc = document(
  'psychology',
  famille,
  {
    passive: passifsDe().optional(),
    /** Effets d'une affliction : seuls à lire son instance (`endPsych.instance`) et sa Cible en vue (Condition
     *  `cibleEnVue`). LDB 21 l.19, l.39, l.48 */
    effects: z.array(mecaniqueDe({ 'endPsych.instance': 'admis', 'condition.cibleEnVue': 'admis' }).triggeredEffect).optional(),
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
    cibles: z.array(varianteDeCibleSchema).min(1).optional(),
    endedByOtherPsych: z.boolean().optional(),
    immuneToFromTarget: refs('psychology').optional(),
    attackDR: nommerChamps(z.strictObject({ amount: z.number(), vs: z.enum(['source', 'group', 'any']) }), { amount: { label: 'Quantité' }, vs: { label: 'Contre' } }).optional(),
    immuneWhileActive: refs('psychology').optional(),
    containedSocialMod: z.number().optional(),
    targetCauses: nommerChamps(z.strictObject({ kind: idDe('psychology'), indice: z.number() }), { kind: { label: 'Type' }, indice: { label: 'Indice' } }).optional(),
    triggerOn: z.enum(['encounter', 'threatened']).optional(),
    retestAt: enumNomme({ roundStart: 'début du Round', roundEnd: 'fin du Round' }).optional(),
    /** ENJEU du Test de Psychologie (#1117 L2) — porté par l'ENTRÉE, pas par un gabarit de `kind` :
     *  les conséquences diffèrent d'une entrée à l'autre (`resolution`/`failCondition`/`failAmount`/
     *  `becomes`), donc un texte au `kind` serait tautologique. Patron `ActivityDef.stake` : l'entité
     *  qui PORTE la règle porte aussi ce que son jet met en jeu. `{indice}` = trou rempli par le flux. */
    stake: z.string().optional(),
    /** FORME DÉCLARÉE du `stake` (même contrat que `stakes.form`/`activities`). */
    stakeForm: stakeFormSchema.optional(),
    resolution: z.enum(['etendu', 'terreur', 'simple']).optional(),
    failCondition: ref('etat').optional(),
    failAmount: nommerChamps(z
      .strictObject({
        base: z.union([z.literal('indice'), z.number()]).optional(),
        perDegreeOfFailure: z.number().optional(),
      }), { base: { label: 'Base' }, perDegreeOfFailure: { label: 'Par degré d’échec' } })
      .optional(),
    becomes: ref('psychology').optional(),
    test: flowTestSchema.optional(),
  },
  {
    passive: { label: 'Effets passifs' },
    effects: { label: 'Effets déclenchés' },
    gating: { label: 'Restrictions Action/Mouvement/défense' },
    psychImmune: { label: 'Immunise à toute Psychologie' },
    cibles: {
      label: 'Cibles admises',
      hint: 'Ce que la Cible peut désigner : un Groupe, une personne (Amour : des individus seulement)',
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
    retestAt: { label: 'Re-test', hint: 'Moment du re-test d’une affliction active : début (défaut) ou fin de Round' },
    stake: { label: 'Enjeu' },
    stakeForm: { label: 'Forme de l’enjeu' },
    resolution: { label: 'Mode de résolution', hint: 'Étendu / Terreur / Simple' },
    failCondition: { label: 'État infligé à l’échec', hint: 'État posé quand le Test échoue' },
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
  {
    exiges: ['desc', 'source'],
    // `psychImmune` : sous-liste marquée de `traits.json › capabilities.psychType` ; `becomes` : de l'op `beginPsych`.
    espace: { marqueurs: ['psychImmune', 'becomes'] },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
