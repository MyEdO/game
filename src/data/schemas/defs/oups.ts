/**
 * Schéma de `oups.json` — Maladresses, folio 160 : les 7 bandes du Tableau des Oups !
 * (`LDB 14 l.21-30`) et l'Incident de Tir (`LDB 14 l.32-34`), section DISTINCTE du livre, hors de la
 * table. Ces deux sections du livre partagent ICI un seul dataset ; le découpage côté produit est la
 * question #1544.
 *
 * UNE SEULE FORME D'ENTRÉE, la disjonction portée par la charge par `kind` (`chargeParDiscriminant`),
 * que `document()` borne au parse (`refusDeCharge`, `grammaire/collection-cle.ts`) : `min`/`max`/`mod`
 * sont déclarés optionnels, et la charge les exige dans les deux sens — un `misfire` ne porte rien, une
 * bande d100 ses DEUX bornes, le Malus d'Action en plus son `mod`. Une union de deux `strictObject`
 * dirait la même chose au parse, mais elle
 * n'a ni `.shape` ni enveloppe : `document()` ne saurait y poser ni sa provenance, ni son `type`, ni
 * ses métas d'édition. La contrainte reste au schéma, elle change seulement de porteur.
 *
 * La VUE TS reste l'union manuscrite `OupsRow = OupsEntry | OupsMisfireEntry` (`src/data/oups.ts`) :
 * le handle scelle ses nœuds (`z.infer` vaut `unknown`), aucun type n'est dérivé d'ici. C'est cette
 * union qui donne à `oupsTable` ses `min`/`max` NON optionnels (lus par `findTableEntry`) et au Codex
 * sa discrimination `'min' in o` (`src/ui/compendium/registry.ts`, bloc `key: 'oups'`).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { enumNomme } from '../grammaire/valeurs';
import { tableTotale } from '../../../lib/tableTotale';

export const file = 'oups.json';
export const famille = 'entite';

/** Effets mécaniques que le moteur sait jouer (`OupsKind` + `misfire`, `src/engine/oups.ts`), NOMMÉS :
 *  les options de l'enum SONT les clés de cette table (#1694). */
const KINDS = {
  selfWound: 'Auto-blessure',
  weaponDamageActLast: 'Arme abîmée + agit en dernier',
  actionPenalty: 'Malus d’Action',
  loseMovement: 'Perte de Mouvement',
  loseAction: 'Perte d’Action',
  trauma: 'Traumatisme',
  hitAlly: 'Touche un allié',
  misfire: 'Incident de Tir',
} as const;

/** CHARGE par `kind` (`espace.chargeParDiscriminant`), toute exigée : la bande d100 porte ses bornes, le
 *  Malus d'Action son modificateur, l'Incident de Tir rien (LDB 14 l.21-34). */
const chargeParDiscriminant: Readonly<Record<string, readonly string[]>> = tableTotale(
  Object.keys(KINDS) as (keyof typeof KINDS)[],
  (kind) => (kind === 'misfire' ? [] : kind === 'actionPenalty' ? ['min', 'max', 'mod'] : ['min', 'max']),
);

const doc = document(
  'oups',
  famille,
  {
    min: z.number().optional(),
    max: z.number().optional(),
    kind: enumNomme(KINDS),
    mod: z.number().optional(),
  },
  {
    min: { label: 'Borne basse du d100' },
    max: { label: 'Borne haute du d100' },
    kind: {
      label: 'Effet mécanique',
      hint: 'misfire = Incident de Tir, HORS table (LDB 14 folio 160)',
    },
    mod: { label: 'Modificateur de l’Action suivante', hint: 'Malus d’Action seulement' },
  },
  {
    codex: { keys: ['oups'] },
    edit: { dataset: 'oups' },
  },
  {
    exiges: ['source'],
    espace: { discriminant: 'kind', chargeParDiscriminant },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
