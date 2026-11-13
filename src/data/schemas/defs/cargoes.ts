/**
 * Schéma de `cargoes.json` — LE catalogue des cargaisons (#1684), consommé comme `CargoEntry[]`
 * (`src/engine/cargo.ts`, porte `datasetDe`) : les cargaisons maritimes (MDG 15 l.420-434) et terrestres/fluviales
 * (MSRC 13 l.80-90), chaque entrée PORTANT sa voie. Leur disponibilité saisonnière vit dans les documents
 * de `cargaisons-aleatoires.json`, un par colonne imprimée. Les règles de négoce de chaque livre restent dans
 * leur document (`sea-cargo.json`, `land-cargo.json`) : deux livres, deux barèmes.
 *
 * UNE SEULE FORME D'ENTRÉE, deux disjonctions bornées au parse :
 *  - par `voie` (`espace.chargeParDiscriminant`, `refusDeCharge`) : `wine` n'appartient qu'à la voie
 *    terrestre (MSRC 13 l.93-104) ;
 *  - par `echangeable` (`affinerEntree`) : une MARCHANDISE porte son prix, un MARQUEUR de colonne
 *    Production/Produits (`echangeable: false`, MDG 15 l.321, MSRC 13 l.24-28, l.119) n'en porte aucun
 *    et seul il porte `hint` et `tradeHub`. Porter un prix (`espace.marqueurs`) désigne donc les
 *    marchandises, seules admises aux rangées de `cargaisons-aleatoires.json`.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { enumNomme, prixSaisonnierSchema, tirageSchema } from '../grammaire/valeurs';
import { estObjet } from '../../../lib/objet.mjs';

export const file = 'cargoes.json';
export const famille = 'entite';

/** Les VOIES du commerce — les valeurs du champ discriminant, une par livre de règles de négoce. */
const LIBELLES_DE_VOIE = {
  mer: 'Maritime',
  terre: 'Terrestre et fluviale',
} as const;

/** La VOIE d'une cargaison, vocabulaire nommé du champ discriminant. */
export const voieSchema = enumNomme(LIBELLES_DE_VOIE);

/** Une MARCHANDISE : toute cargaison qui n'est pas un marqueur (`echangeable: false`). */
type Marchandise = { echangeable?: true };
/** Un MARQUEUR de colonne Production/Produits. */
type Marqueur = { echangeable: false };

/** La cargaison lue est-elle un marqueur ? */
const estMarqueur = (e: Record<string, unknown>): boolean => e.echangeable === false;

/** Le verdict sur `cle` d'une cargaison de la nature `nature`, au nom de l'entrée lue. */
const verdict = (cle: string, nature: 'marqueur' | 'marchandise', dit: 'refusée' | 'exigée') => ({
  path: [cle],
  error: (iss: { input?: unknown }) => `cargoes : « ${String(estObjet(iss.input) ? iss.input.id : iss.input)} » (${nature}) : « ${cle} » ${dit}.`,
});

const doc = document(
  'cargoes',
  famille,
  {
    voie: voieSchema,
    /** Discriminant marchandise/marqueur (`isEchangeable`, `src/engine/cargo.ts`). */
    echangeable: z.boolean().optional(),
    price: z.union([prixSaisonnierSchema, tirageSchema]).optional(),
    /** MSRC 13 l.93-104 */
    wine: z.boolean().optional(),
    /** Qualificatif d'affichage ÉDITABLE d'un marqueur, entre parenthèses après son `label`. MSRC 13 l.28 ; MSRC 13 l.119 */
    hint: z.string().optional(),
    /** MDG 15 l.321 ; MSRC 13 l.24-28 */
    tradeHub: z.literal(true).optional(),
  },
  {
    voie: { label: 'Voie', hint: 'Le livre dont la table porte la cargaison : maritime (MDG 15) ou terrestre et fluviale (MSRC 13)' },
    echangeable: { label: 'Échangeable', hint: 'Faux sur un marqueur de colonne Production/Produits (Commerce, Minimum vital, Subsistance)' },
    price: { label: 'Prix' },
    wine: { label: 'Vin', hint: 'Prix tiré à la table de qualité secrète du Vin/Eau-de-vie' },
    hint: { label: 'Aide' },
    tradeHub: { label: 'Centre de commerce' },
  },
  {
    codex: { keys: ['cargoes'] },
    edit: { dataset: 'cargoes' },
  },
  {
    exiges: ['source'],
    espace: { discriminant: 'voie', chargeParDiscriminant: { mer: [], terre: ['wine'] }, requisesParDiscriminant: { terre: [] }, marqueurs: ['price'] },
    affinerEntree: (entree) =>
      entree
        .refine((e): e is Marchandise | (Marqueur & { price?: undefined }) => !estMarqueur(e) || e.price === undefined, verdict('price', 'marqueur', 'refusée'))
        .refine((e): e is Marchandise | (Marqueur & { wine?: undefined }) => !estMarqueur(e) || e.wine === undefined, verdict('wine', 'marqueur', 'refusée'))
        .refine((e): e is Marqueur | (Marchandise & { hint?: undefined }) => estMarqueur(e) || e.hint === undefined, verdict('hint', 'marchandise', 'refusée'))
        .refine((e): e is Marqueur | (Marchandise & { tradeHub?: undefined }) => estMarqueur(e) || e.tradeHub === undefined, verdict('tradeHub', 'marchandise', 'refusée'))
        .refine((e): e is Marqueur | (Marchandise & { price: object }) => estMarqueur(e) || e.price !== undefined, verdict('price', 'marchandise', 'exigée')),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
