/**
 * Schéma de `semences-de-scene.json` (#1716) — ce qu'une scène NEUVE reçoit à sa création
 * (`emptyScene`, `src/noyau/monde/scene.ts`), en DONNÉE éditable au Codex plutôt qu'en littéraux de code.
 * Objet RACINE unique (famille `config`), même emballage que `details.json`/`ambiance.json`.
 *
 * Les champs portent EXACTEMENT les noms qu'ils prennent sur la scène (`ambiance`, `metresPerTile`,
 * `ambientLight`, `reliefDefaults`, `roofDefaults`) : la semence se déverse telle quelle. Seul
 * `terrain` n'a pas d'homonyme sur la scène — c'est le sol dont `layers[0]` est rempli.
 *
 * Les schémas des champs sont ceux de la SCÈNE, jamais des copies (`defs-scenes/scene.ts` :
 * `ambianceSchema`, `reliefDefaultsSchema`, `sceneRoofDefaultsSchema` — ce dernier borne déjà
 * `pitchDeg` à `PENTE_TOIT_DEG`). La PLAGE de pente, elle, n'est PAS de la semence : elle borne le
 * PARSE de toutes les scènes déjà écrites, une plage éditable ferait refuser au chargement des
 * projets utilisateur aujourd'hui valides.
 *
 * `ambientLight` est ici plus STRICT que le champ qu'il alimente (`Scene.ambientLight` est une
 * `z.string()` libre) : une semence nomme un palier RÉEL de `lightLevels.json` — une semence qui
 * nommerait un palier inexistant poserait le défaut faux sur CHAQUE scène créée ensuite. ABSENT =
 * `auto`, l'éclairage suit l'horloge via `ambiance` : la sentinelle n'est pas une VALEUR du champ,
 * c'est son absence, et `emptyScene` (`noyau/monde/scene.ts`) la rend en clair sur la scène produite. Un
 * champ typé `idDe(…)` ne se mêle pas d'une chaîne hors registre — une union « sentinelle | idDe »
 * n'existe nulle part au dépôt (mesuré), et elle poserait au registre des slots une valeur qui ne
 * résout pas.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { idDe } from '../grammaire/ref';
import { ambianceSchema, reliefDefaultsSchema, sceneRoofDefaultsSchema } from '../defs-scenes/scene';

export const file = 'semences-de-scene.json';
export const famille = 'config';

const doc = document(
  'semences-de-scene',
  famille,
  {
    ambiance: ambianceSchema,
    metresPerTile: z.number().positive(),
    ambientLight: idDe('lightLevel').optional(),
    terrain: idDe('terrain'),
    reliefDefaults: reliefDefaultsSchema,
    roofDefaults: sceneRoofDefaultsSchema,
  },
  {
    ambiance: { label: 'Ambiance', hint: 'Dedans ou dehors — c’est elle qui fait suivre l’horloge à l’éclairage' },
    metresPerTile: { label: 'Mètres par case', hint: 'Échelle métrique d’une case (2 m) ; 4 et plus = Scène MER' },
    ambientLight: { label: 'Éclairage', hint: 'Absent = suit l’horloge via l’ambiance ; sinon un palier de `lightLevels.json`' },
    terrain: { label: 'Sol de départ', hint: 'Terrain dont la couche du sol est remplie à la création' },
    reliefDefaults: { label: 'Matières de relief', hint: 'Falaise, rampe, dalle de tablier, pilier' },
    roofDefaults: { label: 'Toiture par défaut', hint: 'Couverture, pente de référence (degrés) et borne de comble' },
  },
  { codex: { keys: ['semencesDeScene'] }, edit: { object: 'single' } },
  { exiges: ['maison'] },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
