import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listerDossier } from '../../../../scripts/guards/lib/lister.mjs';
import { estFichierVitest } from '../../../../scripts/guards/lib/fichierVitest.mjs';

// Garde STRUCTURELLE : la SÉLECTION DE VUE d'un prop orienté vit dans la MACHINERIE (`propSvg`,
// `catalog/decor/index.ts`), JAMAIS dans une def. Une def déclare ses trois vues (`PropViz.views`) ;
// elle ne projette pas `dir`/`camRot` et ne choisit pas la vue elle-même (cf. cible du chantier
// des props orientés). Toute réintroduction d'une projection dans `defs/**` échoue ici.

const DEFS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'defs');

/** Motifs de sélection de vue interdits dans une def de prop (ils appartiennent à `propSvg`). */
const FORBIDDEN: { pattern: RegExp; why: string }[] = [
  { pattern: /\bproject\s*\(/, why: 'project() — la projection vue/miroir vit dans propSvg' },
  { pattern: /rig\/facing/, why: 'import de rig/facing — la machinerie sélectionne la vue' },
  { pattern: /\bctx\??\.dir\b/, why: 'lecture de ctx.dir — une def ne choisit pas sa vue' },
  { pattern: /dims\??\.rot\b/, why: 'lecture du cran caméra — réservé à la machinerie' },
];

/** Retire commentaires de bloc et de ligne : on verrouille le CODE, pas la prose (un commentaire peut
 *  légitimement citer `project`/`rig/facing` pour expliquer où vit la machinerie). */
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('props orientés — sélection de vue hors des defs', () => {
  const files = listerDossier(DEFS_DIR).filter((f) => f.endsWith('.ts') && !estFichierVitest(f));

  it('aucune def ne projette dir/camRot ni ne sélectionne de vue', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const code = stripComments(readFileSync(join(DEFS_DIR, f), 'utf8'));
      for (const { pattern, why } of FORBIDDEN)
        if (pattern.test(code)) offenders.push(`${f}: ${why}`);
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
