import { describe, it, expect } from 'vitest';
import {
  scanNamedImport,
  RAW_SYMBOL, RAW_ALLOWED, CHANNEL_SYMBOL, CHANNEL_ALLOWED, PRECIP_SYMBOL, PRECIP_ALLOWED,
} from '../../scripts/guards/lib/weatherTestModQuarantine.mjs';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';

/**
 * QUARANTAINE du CANAL météo « Tests physiques » (EDOC 8 l.82, #341). Le calcul brut
 * `weatherPhysicalTestMod` n'est importable QUE par le lecteur canonique `src/engine/weatherTestMod.ts` ;
 * le lecteur `weatherTestMods` (qui produit la ligne « Météo : … ») QUE par les étages de Test canoniques
 * (`combat.ts` : attack/defenseModifiers/baseTestMods ; `travelPostes.ts` : rangées d'Activité). Garde
 * STRUCTURELLE (doctrine « gardes structurelles, pas greps ») : pousser la météo dans une NOUVELLE surface
 * (une future modale, un nouvel écran) devient INEXPRIMABLE sans éditer la whitelist — c'est la garde qui
 * aurait attrapé le trou de la DÉFENSE avant l'audit. Whitelist FIXE, zéro violation tolérée.
 */

/** Les `.ts(x)` de `src/` (hors tests) rendus par la primitive de marche `readCorpus` : chemin POSIX
 *  relatif à la racine repo + texte. */
function offendersFor(symbol: string, allowed: string[]): string[] {
  const out: string[] = [];
  for (const { rel, text } of readCorpus(['src'])) {
    if (allowed.includes(rel)) continue;
    const found = scanNamedImport(text, symbol);
    for (const f of found) out.push(`${rel}:${f.line} importe '${symbol}' de '${f.source}'`);
  }
  return out;
}

describe('quarantaine d’import — canal météo « Tests physiques » (#341)', () => {
  /** Le verdict de cette garde est une LISTE VIDE d'offenseurs : un corpus vide la rendrait verte
   *  sans rien mesurer. Le peuplement est asserté par les surfaces AUTORISÉES elles-mêmes — chacune
   *  est dans le corpus ET le scanner y VOIT l'import qu'elle a le droit de faire. Une whitelist
   *  dont plus aucune entrée ne porte l'import serait un cimetière, et le dirait ici. */
  it('PEUPLEMENT : chaque surface AUTORISÉE est dans le corpus, et le scanner y voit son import', () => {
    const parRel = new Map(readCorpus(['src']).map((f) => [f.rel, f.text]));
    expect(parRel.size, 'corpus vide : la garde serait verte sans rien scanner').toBeGreaterThan(0);
    for (const [symbol, allowed] of [[RAW_SYMBOL, RAW_ALLOWED], [CHANNEL_SYMBOL, CHANNEL_ALLOWED], [PRECIP_SYMBOL, PRECIP_ALLOWED]] as const) {
      for (const rel of allowed) {
        const text = parRel.get(rel);
        expect(text, `${rel} absent du corpus — le scan ne couvre plus la surface qu’il autorise`).toBeDefined();
        expect(
          scanNamedImport(text!, symbol),
          `${rel} n’importe plus '${symbol}' : exemption périmée, ou scanner muet`,
        ).not.toHaveLength(0);
      }
    }
  });

  it(`'${RAW_SYMBOL}' n’est importé QUE par le lecteur canonique (${RAW_ALLOWED.join(', ')})`, () => {
    expect(
      offendersFor(RAW_SYMBOL, RAW_ALLOWED),
      'Calcul brut de météo importé hors du lecteur canonique — passer par `weatherTestMods` (src/engine/weatherTestMod.ts).',
    ).toEqual([]);
  });

  it(`'${CHANNEL_SYMBOL}' n’est importé QUE par les étages de Test canoniques (${CHANNEL_ALLOWED.join(', ')})`, () => {
    expect(
      offendersFor(CHANNEL_SYMBOL, CHANNEL_ALLOWED),
      'Canal météo câblé dans une surface non canonique — router le Test par combatModifiers/baseTestMods ou par une rangée d’Activité, ou ÉDITER la whitelist (revue).',
    ).toEqual([]);
  });

  it(`'${PRECIP_SYMBOL}' n’est importé QUE par le monteur canonique et le moteur de combat (${PRECIP_ALLOWED.join(', ')})`, () => {
    expect(
      offendersFor(PRECIP_SYMBOL, PRECIP_ALLOWED),
      'Précipitations câblées site par site — déclarer `pont` sur la ligne de jet (`rollSeam.rollLine`, MDG 13 l.185), ou ÉDITER la whitelist (revue).',
    ).toEqual([]);
  });

  it('FAIL-CLOSED : le scanner détecte un import nommé (valeur ET type, alias)', () => {
    expect(scanNamedImport("import { weatherPhysicalTestMod } from '../engine/travelStages';", 'weatherPhysicalTestMod')).toHaveLength(1);
    expect(scanNamedImport("import { a, weatherTestMods as w } from './x';", 'weatherTestMods')).toHaveLength(1);
    expect(scanNamedImport("import type { weatherTestMods } from './x';", 'weatherTestMods')).toHaveLength(1);
    expect(scanNamedImport("import { weatherRangedMod } from './x';", 'weatherPhysicalTestMod')).toHaveLength(0);
  });
});
