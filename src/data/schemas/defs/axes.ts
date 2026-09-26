/**
 * Schéma de `axes.json` — catalogue des AXES de forces/faiblesses (ticket #409, verbatim en corps
 * d'issue, 2026-07-13 : mini-radar par personnage, paramétrable par campagne). Mécanique MAISON
 * (aucune page RAW — clé d'ENVELOPPE `maison`, EXIGÉE ici par `options.exiges`, jamais
 * `sourceRefSchema` qui réclamerait un folio inexistant) :
 * chaque axe liste ses SOURCES en ids STABLES de `skills.json`/`talents.json` (`skills`/`talents`,
 * TOP-LEVEL — patron `crewRoles.skills`, `{id,spec?}[]`, éditeur `SkillSpecListField` au Codex),
 * résolues par `axisScore` (`src/engine/axes.ts`). `core` marque le socle de base (actif par défaut
 * sur une campagne sans `activeAxes` déclaré — cf. `WorldMap`/`ProjectDoc`).
 *
 * Doctrine : la Caractéristique d'un axe entre UNIQUEMENT via une Compétence, jamais un
 * canal caractéristique nu — un axe sans Compétence Avancée formée reste à 0, comme au jeu (LDB 09
 * l.30, Compétence Avancée sans Augmentation = Test impossible, cf. `docs/raw/4e/competences.md`).
 */
import { z } from 'zod';
import { document, type EnveloppeDocument } from '../grammaire/document';
import { refOuSpec, type RefDesignee } from '../grammaire/ref';

export const file = 'axes.json';
export const famille = 'entite';

const champs = {
  /** Socle de base (actif par défaut si la campagne ne déclare pas `activeAxes`). */
  core: z.boolean().optional(),
  /** Spécialisation absente = TOUTE spec compte. */
  skills: z.array(refOuSpec('skill')).optional(),
  /** Spécialisation absente = TOUTE spec compte. */
  talents: z.array(refOuSpec('talent')).optional(),
};

const doc = document(
  'axes',
  famille,
  champs,
  {
    core: { label: 'Axe de socle', hint: 'Actif par défaut sur une campagne qui ne déclare pas ses axes actifs' },
    skills: { label: 'Compétences source', hint: 'Compétences dont la valeur alimente l’axe' },
    talents: { label: 'Talents source', hint: 'Talents dont la possession alimente l’axe' },
  },
  {
    codex: { keys: ['axes'] },
    edit: { dataset: 'axes' },
  },
  { exiges: ['maison'] },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
/** VUE TS du dataset — le nœud rendu par la fabrique est SCELLÉ (`z.infer` y vaut `unknown`), la vue
 *  se recompose donc depuis l'enveloppe et les champs déclarés, sans rouvrir aucun nœud. */
export type AxesData = (EnveloppeDocument & Omit<z.infer<z.ZodObject<typeof champs>>, 'skills' | 'talents'> & { skills?: RefDesignee[]; talents?: RefDesignee[] })[];
