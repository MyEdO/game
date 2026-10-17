import { nommerChamps } from '../grammaire/meta';
/** LDB 14 l.159-169 ; LDB 14 l.161. */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { gameOpSchema } from '../grammaire/mecanique';

export const file = 'grapple.json';
export const famille = 'config';

const doc = document(
  'grapple',
  famille,
  {
    init: z.array(gameOpSchema),
    win: nommerChamps(z.strictObject({
      damage: z.array(gameOpSchema),
      entangle: z.array(gameOpSchema),
      free: z.array(gameOpSchema),
    }), {
      damage: { label: 'dégâts' },
      entangle: { label: 'entraver' },
      free: { label: 'se libérer' },
    }),
  },
  {
    init: {
      label: "Effets posés à l'engagement",
      hint: "Effets posés sur l'ADVERSAIRE touché quand l'Empoignade est déclarée (État Empêtré + relation d'Empoignade)",
    },
    win: {
      label: 'Issues du Test opposé gagné',
      hint: 'Les 3 issues offertes à CELUI des deux empoignés qui remporte le Test opposé de Force',
    },
  },
  { codex: { keys: ['grapple'] }, edit: { object: 'single' } },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
