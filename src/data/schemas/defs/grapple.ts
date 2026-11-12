import { nommerChamps } from '../grammaire/meta';
/** LDB 14 l.159-169 ; LDB 14 l.161. */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { executeesDe } from '../grammaire/mecanique';

export const file = 'grapple.json';
export const famille = 'config';

const doc = document(
  'grapple',
  famille,
  {
    init: executeesDe(),
    win: nommerChamps(z.strictObject({
      degats: executeesDe(),
      empetrer: executeesDe(),
      liberer: executeesDe(),
    }), {
      degats: { label: 'dégâts' },
      empetrer: { label: 'entraver' },
      liberer: { label: 'se libérer' },
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
  { codex: { keys: ['grapple'] }, edit: { object: 'unique' } },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
