/**
 * Schéma de `cargoes.json` — LE catalogue des cargaisons (#1684), consommé comme `CargoEntry[]`
 * (`src/engine/cargo.ts`) : le tableau des cargaisons maritime (MDG 15 l.406-434) et le terrestre/fluvial
 * (MSRC 13 l.71-90), chaque entrée PORTANT sa voie. Les règles de négoce de chaque livre restent dans
 * leur document (`sea-cargo.json`, `land-cargo.json`) : deux livres, deux barèmes.
 *
 * UNE SEULE FORME D'ENTRÉE, deux disjonctions bornées au parse :
 *  - par `voie` (`espace.chargeParDiscriminant`, `refusDeCharge`) : `wine` n'appartient qu'à la voie
 *    terrestre (MSRC 13 l.93-104) ;
 *  - par `echangeable` (`affinerEntree`) : une MARCHANDISE porte ses colonnes et son prix, un MARQUEUR de
 *    colonne Production/Produits (`echangeable: false`, MDG 15 l.321, MSRC 13 l.24-28, l.119) n'en porte
 *    aucun et seul il porte `hint` et `tradeHub`.
 * La couverture du d100 se juge par TABLE, donc par voie (`catalogueSaisonnier`).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { catalogueSaisonnier, dispoSaisonniereSchema, enumNomme, prixSaisonnierSchema, tirageSchema } from '../grammaire/valeurs';

export const file = 'cargoes.json';
export const famille = 'entite';

/** Les VOIES du commerce — les valeurs du champ discriminant, une par livre de règles de négoce. */
const LIBELLES_DE_VOIE = {
  mer: 'Maritime',
  terre: 'Terrestre et fluviale',
} as const;

/** Clés propres à une MARCHANDISE, refusées sur un marqueur ; `avail` et `price` y sont exigées. */
const CLES_DE_MARCHANDISE = ['avail', 'price', 'wine'] as const;
const EXIGEES_DE_MARCHANDISE = ['avail', 'price'] as const;
/** Clés propres à un MARQUEUR, refusées sur une marchandise. */
const CLES_DE_MARQUEUR = ['hint', 'tradeHub'] as const;

const doc = document(
  'cargoes',
  famille,
  {
    voie: enumNomme(LIBELLES_DE_VOIE),
    /** Discriminant marchandise/marqueur : `CargoDef.echangeable` (`src/engine/cargo.ts`). */
    echangeable: z.boolean().optional(),
    avail: dispoSaisonniereSchema.optional(),
    price: z.union([prixSaisonnierSchema, tirageSchema]).optional(),
    /** MSRC 13 l.93-104 */
    wine: z.boolean().optional(),
    /** Qualificatif d'affichage ÉDITABLE (« plaque tournante » / « rien à échanger ») — cf. `CargoMarkerDef`. */
    hint: z.string().optional(),
    /** MDG 15 l.321 ; MSRC 13 l.24-28 */
    tradeHub: z.literal(true).optional(),
  },
  {
    voie: { label: 'Voie', hint: 'Le livre dont la table porte la cargaison : maritime (MDG 15) ou terrestre et fluviale (MSRC 13)' },
    echangeable: { label: 'Échangeable', hint: 'Faux sur un marqueur de colonne Production/Produits (Commerce, Minimum vital, Subsistance)' },
    avail: { label: 'Disponibilité' },
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
    espace: { discriminant: 'voie', chargeParDiscriminant: { mer: [], terre: ['wine'] }, requisesParDiscriminant: { terre: [] } },
    affinerEntree: (entree) =>
      entree.superRefine((v, ctx) => {
        const e = v as Record<string, unknown>;
        const marqueur = e.echangeable === false;
        const nom = `cargoes : « ${String(e.id)} » (${marqueur ? 'marqueur' : 'marchandise'})`;
        for (const cle of marqueur ? CLES_DE_MARCHANDISE : CLES_DE_MARQUEUR)
          if (e[cle] !== undefined) ctx.addIssue({ code: 'custom', path: [cle], message: `${nom} : « ${cle} » refusée.` });
        if (!marqueur)
          for (const cle of EXIGEES_DE_MARCHANDISE)
            if (e[cle] === undefined) ctx.addIssue({ code: 'custom', path: [cle], message: `${nom} : « ${cle} » exigée.` });
      }),
    affinerDataset: (dataset) => catalogueSaisonnier(dataset, { site: 'cargoes.json', tablePar: 'voie' }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
