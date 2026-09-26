import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listerDossier } from '../../scripts/guards/lib/lister.mjs';
import { CIBLES_PAR_RACINE, type RacineDeCatalogue } from '../state/combatEffects';

/**
 * CLIQUET de donnée (#1874 C0) : toute feuille `ops` d'une racine de CATALOGUE (`src/data`) porte un `on`
 * de la table de SA racine (`CIBLES_PAR_RACINE`, `state/combatEffects.ts`), ou n'en porte pas (défaut =
 * première entrée). Pendant catalogue de `EFFECT_HANDLERS.ops.refs` → `validateScene` pour la scène.
 *
 * La racine se lit au CHAMP de donnée qui porte la feuille — jamais à une liste d'ids. Une feuille qu'aucun
 * champ connu ne porte est une racine NEUVE : rouge, nommée, jusqu'à ce qu'elle entre au registre.
 */
const DATA = fileURLToPath(new URL('.', import.meta.url));

/** Le champ porteur → sa racine. L'ordre compte : le plus spécifique d'abord. */
const RACINE_PAR_CHAMP: readonly { racine: RacineDeCatalogue; champ: RegExp; fichier?: string }[] = [
  { racine: 'critiqueDeCoque', champ: /\.crewHit\.test[.[]/ },
  { racine: 'maladie', champ: /\.(onTick|dailyTest)\.test[.[]/ },
  { racine: 'consommable', champ: /^\.consumable[.[]/ },
  { racine: 'sort', champ: /^(\.variants\[\d+\])?\.effects[.[]/, fichier: 'spells.json' },
  { racine: 'critique', champ: /^\.entries\[\d+\]\.(test|escalation\.onNextCritWhileCondition\.test)[.[]/, fichier: 'criticals.json' },
  { racine: 'declenche', champ: /^\.(effects|onHitEffects)\[\d+\]\.flow[.[]/ },
];

/** `blocs` = les nœuds de Flow qui ENGLOBENT la feuille, du plus haut au plus proche (`kind` + chemin). */
type Feuille = { site: string; racine?: RacineDeCatalogue; on?: string; blocs: { kind: string; chemin: string }[] };

/** Toutes les feuilles `ops` d'un document de donnée, avec la racine que leur champ porteur désigne. */
function feuillesDeCatalogue(fichier: string, json: unknown): Feuille[] {
  const out: Feuille[] = [];
  const walk = (n: unknown, id: string, chemin: string, blocs: Feuille['blocs']): void => {
    if (Array.isArray(n)) { n.forEach((v, i) => walk(v, id, `${chemin}[${i}]`, blocs)); return; }
    if (!n || typeof n !== 'object') return;
    const o = n as Record<string, unknown>;
    if (o.type === 'ops' && Array.isArray(o.ops)) {
      const racine = RACINE_PAR_CHAMP.find((r) => (!r.fichier || r.fichier === fichier) && r.champ.test(chemin))?.racine;
      out.push({ site: `${fichier} ${id}${chemin}`, ...(racine ? { racine } : {}), ...(typeof o.on === 'string' ? { on: o.on } : {}), blocs });
    }
    const sous = typeof o.kind === 'string' ? [...blocs, { kind: o.kind, chemin }] : blocs;
    for (const [k, v] of Object.entries(o)) walk(v, id, `${chemin}.${k}`, sous);
  };
  for (const entree of Array.isArray(json) ? json : [json]) {
    walk(entree, String((entree as { id?: unknown })?.id ?? '?'), '', []);
  }
  return out;
}

const feuilles = listerDossier(DATA)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => feuillesDeCatalogue(f, JSON.parse(readFileSync(join(DATA, f), 'utf8'))));

const horsTable = (fs: Feuille[]): string[] =>
  fs.filter((f) => f.racine && f.on !== undefined
    && !(CIBLES_PAR_RACINE[f.racine] as readonly { on: string }[]).some((c) => c.on === f.on))
    .map((f) => `${f.site} — on:'${f.on}' hors de la table \`${f.racine}\``);

/** Racine `maladie` : les blocs entre le nœud `test` PORTEUR (`.onTick.test`, `.dailyTest.test`) et la
 *  feuille. Tout autre que `seq`/`do` est rendu, nommé : `spellOps` (`engine/flowCore.ts`) l'aplatit. */
const blocsAplatis = (fs: Feuille[]): string[] =>
  fs.filter((f) => f.racine === 'maladie').flatMap((f) => {
    const porteur = f.blocs.findIndex((b) => /\.(onTick|dailyTest)\.test$/.test(b.chemin));
    return f.blocs.slice(porteur + 1).filter((b) => b.kind !== 'seq' && b.kind !== 'do')
      .map((b) => `${f.site} — bloc \`${b.kind}\` à ${b.chemin} : \`spellOps\` (\`engine/flowCore.ts\`) l’aplatit`);
  });

describe('cliquet de donnée — le `on` d’une feuille de catalogue appartient à la table de SA racine (#1874)', () => {
  it('aucune feuille `ops` sans racine connue', () => {
    expect(feuilles.filter((f) => !f.racine).map((f) => f.site),
      'feuille portée par un champ qu’aucune racine ne nomme : l’ajouter à `CIBLES_PAR_RACINE` et à `RACINE_PAR_CHAMP`').toEqual([]);
  });

  it('aucun `on` hors de la table de sa racine', () => {
    expect(horsTable(feuilles)).toEqual([]);
  });

  it('anti-vacuité : chaque racine de catalogue porte au moins une feuille', () => {
    const vues = new Set(feuilles.map((f) => f.racine));
    const racines = Object.keys(CIBLES_PAR_RACINE).filter((r) => r !== 'scene');
    expect(racines.filter((r) => !vues.has(r as RacineDeCatalogue)), 'racine sans feuille : le champ porteur a glissé').toEqual([]);
  });

  it('racine `maladie` : entre le Test porteur et la feuille, seulement des `seq` et des `do`', () => {
    expect(blocsAplatis(feuilles)).toEqual([]);
  });

  it('morsure : un `if` sous l’échec du cycle d’un symptôme est rendu, nommé', () => {
    const symptome = [{ id: 'sonde', onTick: { test: { kind: 'test', fail: { kind: 'if', cond: { kind: 'flag', expr: 'x' },
      then: { kind: 'do', effect: { type: 'ops', ops: [] } } } } } }];
    expect(blocsAplatis(feuillesDeCatalogue('symptoms.json', symptome)))
      .toEqual(['symptoms.json sonde.onTick.test.fail.then.effect — bloc `if` à .onTick.test.fail : `spellOps` (`engine/flowCore.ts`) l’aplatit']);
  });

  it('morsure : une feuille `on:caster` dans le cycle d’un symptôme est hors table', () => {
    const symptome = [{ id: 'sonde', onTick: { test: { kind: 'test', fail: { kind: 'do', effect: { type: 'ops', on: 'caster', ops: [] } } } } }];
    expect(horsTable(feuillesDeCatalogue('symptoms.json', symptome)))
      .toEqual(["symptoms.json sonde.onTick.test.fail.effect — on:'caster' hors de la table `maladie`"]);
  });
});
