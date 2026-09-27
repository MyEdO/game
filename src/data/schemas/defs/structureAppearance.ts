/**
 * Schéma de `structureAppearance.json` — apparence PARTAGÉE d'une structure d'arête (mur/porte),
 * consommée comme `StructureAppearanceDef[]` (`src/gameIso/catalog/structures/types.ts`). Chaque champ
 * est une COULEUR ou une mesure que le rendu lit par PARTIE de mur (`wallPartColor`).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { claireVoieSchema, detailRecipeSchema } from '../grammaire/valeurs';
import { habilleUneBaie, type BlocsDApparence } from '../../formesDArete';

export const file = 'structureAppearance.json';
export const famille = 'entite';

/** Parties de mur admises comme clés de `relief` — RECOPIE de `WALL_PARTS`
 *  (`src/gameIso/catalog/structures/types.ts`) : `src/data` ne dépend jamais RUNTIME de `src/gameIso`
 *  (pureté de couche, `eslint.config.js`). La parité des deux listes est gardée par
 *  `src/gameIso/catalog/structures/relief.test.ts`. */
export const WALL_PART_KEYS = [
  'face', 'poteau', 'couronnement', 'panneau', 'moulure', 'plinthe',
  'chambranle', 'jambage',
  'vantail', 'vantail-planche', 'poignee',
  'vitre', 'meneau',
  'parapet', 'bande', 'arase', 'merlon',
  'linteau', 'seuil',
  'barreau', 'traverse',
  'gravats', 'gravats-tas',
] as const;

/** Parties SURCHARGEABLES par `relief.jut`/`relief.thick` : les 16 parties des familles `saillie` et
 *  `traversant`. Les 7 parties de la famille `matiere` (`face, poteau, couronnement, jambage, parapet,
 *  arase, merlon`) en sont ABSENTES : leur volume EST celui du mur (`wallPartDepthM` rend `wallM` sans
 *  lire la surcharge) — c'est `relief.wallM` qui règle celui-là, pour toutes à la fois. Les y admettre
 *  au schéma promettait une surcharge qui n'agit sur rien. */
export const RELIEF_PART_KEYS = WALL_PART_KEYS.filter(
  (k) => !(['face', 'poteau', 'couronnement', 'jambage', 'parapet', 'arase', 'merlon'] as readonly string[]).includes(k),
) as Exclude<(typeof WALL_PART_KEYS)[number], 'face' | 'poteau' | 'couronnement' | 'jambage' | 'parapet' | 'arase' | 'merlon'>[];

/** Profondeur (m) par partie, toutes optionnelles, AUCUNE clé étrangère (`strictObject`). */
const reliefParPartie = z.strictObject(
  Object.fromEntries(RELIEF_PART_KEYS.map((k) => [k, z.number().optional()])) as Record<
    (typeof RELIEF_PART_KEYS)[number],
    z.ZodOptional<z.ZodNumber>
  >,
);

const doc = document(
  'structureAppearance',
  famille,
  {
    wallHeightM: z.number().positive().optional(),
    detail: detailRecipeSchema.optional(),
    face: z.string(),
    post: z.string(),
    bayPanel: z.boolean().optional(),
    band: z.string().optional(),
    cap: z.string().optional(),
    rubble: z.string().optional(),
    rubbleHi: z.string().optional(),
    recess: z.string().optional(),
    wood: z
      .strictObject({
        inset: z.string(),
        frame: z.string(),
        cap: z.string(),
        skirt: z.string(),
        rubble: z.string(),
        rubbleHi: z.string(),
      })
      .optional(),
    parapet: z
      .strictObject({
        heightLevelFrac: z.number(),
        merlonCount: z.number(),
        merlonStep: z.number(),
        merlonHeightPx: z.number(),
        bands: z.array(z.number()),
        bandThickPx: z.number(),
        parapetBandFrac: z.number(),
        arasePx: z.number(),
        corpsDeGarde: z.strictObject({ lintelPx: z.number() }).optional(),
      })
      .optional(),
    door: z
      .strictObject({
        openingFrac: z.number(),
        jamb: z.string().optional(),
        jambCap: z.string().optional(),
        leaf: z.string().optional(),
        plank: z.string().optional(),
        handle: z.string().optional(),
      })
      .optional(),
    claireVoie: claireVoieSchema.optional(),
    window: z
      .strictObject({
        glass: z.string(),
        lit: z.string(),
        mullion: z.string(),
      })
      .optional(),
    // RELIEF MINCE (m) par partie de mur : `jut` = saillie par côté, `thick` = épaisseur totale d'une
    // partie traversante (`wallPartDepthM`), `wallM` = épaisseur de la MATIÈRE PLEINE de cette
    // apparence (le défaut est `WALL_MATTER_M`, `catalog/structures`). Les clés de `jut`/`thick` sont
    // CONTRAINTES aux parties RÉELLEMENT surchargeables (`RELIEF_PART_KEYS`) — une clé fautive, comme
    // une clé inerte, échoue au CHARGEMENT au lieu d'être ignorée en silence.
    relief: z
      .strictObject({
        jut: reliefParPartie.optional(),
        thick: reliefParPartie.optional(),
        wallM: z.number().positive().optional(),
      })
      .optional(),
  },
  {
    wallHeightM: { label: 'Hauteur de mur', hint: 'En mètres' },
    detail: { label: 'Recette de détail' },
    face: { label: 'Couleur de face', hint: 'Teinte de base du pan de mur' },
    post: { label: 'Couleur de poteau', hint: 'Teinte des montants' },
    bayPanel: { label: 'Panneau mouluré', hint: 'Ajoute le panneau et sa moulure de travée sur le pan plein' },
    band: { label: 'Couleur de bande', hint: 'Pierre : ferrure de courtine, barreaux de herse' },
    cap: { label: 'Couleur de couronnement' },
    rubble: { label: 'Couleur de gravats' },
    rubbleHi: { label: 'Couleur de gravats (clair)', hint: 'Reflet des gravats' },
    recess: { label: 'Couleur de renfoncement', hint: 'Glyphe en creux de la vue de plan (corps de garde)' },
    wood: {
      label: 'Habillage bois',
      hint: 'Teintes de panneau, cadre/chambranle, couronnement, plinthe et gravats en bois',
    },
    parapet: { label: 'Parapet', hint: 'Hauteur, merlons et bandes du parapet ; son corps de garde (épaisseur du linteau du passage)' },
    door: { label: 'Porte', hint: 'Ouverture, jambages, vantail et poignée' },
    claireVoie: {
      label: 'Claire-voie',
      hint: 'Barreaux ajourés (herse, garde-corps) : nombre, traverses ; plinthe et main courante quand elle tient lieu de mur',
    },
    window: { label: 'Fenêtre', hint: 'Vitre, cadre, meneau et teinte éclairée' },
    relief: {
      label: 'Relief de paroi',
      hint: 'Saillie et épaisseur en mètres par partie de mur, plus l’épaisseur de matière pleine (wallM)',
    },
  },
  {
    codex: {
      exempt: {
        kind: 'vocabulaire-app-interne',
        raison: "presets d'apparence de structure (rendu iso), pas une fiche de contenu.",
      },
    },
    edit: { none: 'presets de rendu édités au fichier — absent de `CodexEdit.CATEGORY_DATASET`' },
  },
  {
    // Le corps de garde se barre de la `claireVoie` de RACINE, la même que celle de la herse et du
    // garde-corps : une seule demeure pour la claire-voie, donc un refine plutôt qu'un bloc imbriqué. Le
    // couple se lit à l'admission (`habilleUneBaie`, `data/formesDArete.ts`).
    affinerEntree: (entree) =>
      entree.refine((v) => !(v as BlocsDApparence).parapet?.corpsDeGarde || habilleUneBaie(v as BlocsDApparence), {
        message: 'structureAppearance : un `parapet.corpsDeGarde` sans `claireVoie` — le passage fermé n’aurait rien pour le barrer.',
        path: ['claireVoie'],
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
