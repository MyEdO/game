// GÉNÉRÉ par scripts/gen-registry.mjs — NE PAS ÉDITER À LA MAIN.
// Ajouter une entrée = déposer un fichier dans defs/ puis `npm run gen`.
import type { QuadHeadDef } from './types';
import { quadHead as e0 } from './defs/aigle';
import { quadHead as e1 } from './defs/basilic';
import { quadHead as e2 } from './defs/boeuf';
import { quadHead as e3 } from './defs/cheval';
import { quadHead as e4 } from './defs/chimere';
import { quadHead as e5 } from './defs/crapaud';
import { quadHead as e6 } from './defs/dechiqueteur';
import { quadHead as e7 } from './defs/dragon';
import { quadHead as e8 } from './defs/felin';
import { quadHead as e9 } from './defs/hydre';
import { quadHead as e10 } from './defs/loup-feroce';
import { quadHead as e11 } from './defs/loup';
import { quadHead as e12 } from './defs/ours';
import { quadHead as e13 } from './defs/rat';
import { quadHead as e14 } from './defs/sanglier';

export const QUAD_HEAD_DEFS: QuadHeadDef[] = [e0, e1, e2, e3, e4, e5, e6, e7, e8, e9, e10, e11, e12, e13, e14];

/** Union GÉNÉRÉE des `key` déclarés dans les defs — le typage réel des consommateurs. */
export type QuadHeadId =
  | 'aigle'
  | 'basilic'
  | 'boeuf'
  | 'cheval'
  | 'chimere'
  | 'crapaud'
  | 'dechiqueteur'
  | 'dragon'
  | 'felin'
  | 'hydre'
  | 'loup'
  | 'loup-feroce'
  | 'ours'
  | 'rat'
  | 'sanglier';
