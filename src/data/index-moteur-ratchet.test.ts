/**
 * Cliquet décroissant de la dette de JSDoc de `src/engine`, et contrat POSITIF de l'index (#903bis).
 *
 * Volet 1 — cliquet : `docs/index-moteur.md` (`scripts/docs/build-index-moteur.mjs`) donne à CHAQUE
 * export public un concept de FICHIER (`FILE_CONCEPTS`), donc closure garantie ; mais un export SANS
 * JSDoc n'est cherchable que par le sujet de son module, pas par son contenu. Ce test fige le nombre
 * d'exports sans JSDoc pour qu'il ne CROISSE plus sans un geste visible en revue : le plafond vit
 * ICI, dans le test, pas dans la lib de mesure — sinon « ne peut que décroître » ne serait qu'un
 * commentaire.
 *
 * Volet 2 — contrat POSITIF : l'incident fondateur de #903bis. `rollCareer` (src/engine/creation.ts)
 * porte un JSDoc qui documente que plusieurs Carrières peuvent partager une borne de tirage ; deux
 * agents de grounding successifs ont conclu à tort que ce mécanisme n'existait pas. Ce test verrouille
 * que chercher « carrière aléatoire » dans l'index GÉNÉRÉ fait remonter `rollCareer` — si ce cas précis
 * casse, l'index ne répond plus à la question qui a motivé sa création, quelle que soit sa taille.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allEngineExports, ENGINE_ROOT } from '../../scripts/docs/lib/engineExports.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const INDEX_PATH = join(ROOT, 'docs', 'index-moteur.md');

/**
 * Plafond du cliquet. Mesuré au moment de ce lot : 301 exports publics de `src/engine` sans JSDoc
 * exploitable (sur 1825). Ne DESCEND qu'en documentant des exports, jamais en relâchant la mesure ;
 * ne MONTE qu'avec un geste visible dans CE fichier, jamais un ajustement silencieux de la lib.
 */
const UNDOCUMENTED_ENGINE_EXPORTS_MAX = 301;

describe('cliquet de la dette de JSDoc de src/engine (#903bis)', () => {
  const rows = allEngineExports(ENGINE_ROOT);
  const undocumented = rows.filter((r) => !r.role);

  it('le nombre d\'exports publics sans JSDoc ne dépasse pas le plafond cliqueté', () => {
    expect(undocumented.length).toBeLessThanOrEqual(UNDOCUMENTED_ENGINE_EXPORTS_MAX);
  });

  it('le plafond cliqueté n\'est pas resté périmé au-dessus de la mesure réelle (resserrer en documentant)', () => {
    // Écart volontairement large (marge de travail en cours) — seul un écart EXCESSIF (>50) signale
    // un plafond qu'on a oublié de resserrer après un gros lot de documentation.
    expect(UNDOCUMENTED_ENGINE_EXPORTS_MAX - undocumented.length).toBeLessThan(50);
  });
});

describe('index par concept — contrat positif rollCareer (#903bis, incident fondateur)', () => {
  it('chercher « carrière aléatoire » dans docs/index-moteur.md fait remonter rollCareer (creation.ts)', () => {
    const text = readFileSync(INDEX_PATH, 'utf8');
    const lines = text.split('\n');
    const conceptLine = lines.find((l) => l.startsWith('| ') && /carri[eè]re al[eé]atoire/i.test(l) && l.includes('`rollCareer`'));
    expect(conceptLine, 'aucune ligne de concept ne contient « carrière aléatoire » ET `rollCareer`').toBeDefined();
    // Le SITE est porté par l'index (fichier:ligne) — la ligne suit le source, elle ne se fige pas.
    expect(conceptLine).toMatch(/`rollCareer` \(creation\.ts:\d+\)/);
  });
});
