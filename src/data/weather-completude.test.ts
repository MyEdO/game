/**
 * MÉTÉO DE VOYAGE — la DONNÉE est la seule vérité du libellé (#1580).
 *
 * Deux contrats, aux deux bouts de la chaîne :
 *  1. COMPLÉTUDE au SCHÉMA — le z.enum `weatherIdSchema` refuse un id INCONNU mais ne dit rien d'une
 *     SUPPRESSION : le `superRefine` de `defs/weather.ts` ferme ce trou, en NOMMANT l'id manquant.
 *     La sonde le mesure par la porte réelle (`validateDataset`), celle que les trois portes du projet
 *     empruntent (CI `schema-contract`, boot `dev-validate`, save transactionnel du Codex).
 *  2. CANAL — éditer le `label` d'une condition au Codex se voit à la PORTE (`weatherCondition`) ET
 *     sur un site RÉEL (la `ModLine` « Météo : … » du canal `weatherTestMods`, EDOC 8 l.82). Sans ce
 *     second bout, une carte FR pourrait renaître ailleurs sans qu'aucun test ne la voie.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDataset } from './schemas/validate';
import { weatherIdSchema } from './schemas/defs/weather';
import { setDataset } from './overrides';
import { weatherConditions } from './index';
import { weatherCondition } from '../engine/travelStages';
import { weatherTestMods } from '../engine/weatherTestMod';

const DIR = fileURLToPath(new URL('.', import.meta.url));
/** Le document tel qu'il vit SUR DISQUE — immunisé aux mutations en mémoire d'un test antérieur du
 *  worker (`isolate: false`), qui rendraient le clone déjà amputé. */
function disque(): { conditions: { id: string }[] } {
  return JSON.parse(readFileSync(join(DIR, 'weather.json'), 'utf8'));
}

describe('weather.json — COMPLÉTUDE des conditions (l’alphabet vit au SCHÉMA)', () => {
  it('le document du disque passe son schéma', () => {
    expect(validateDataset('weather.json', disque())).toBeNull();
  });

  it('une condition SUPPRIMÉE est refusée, l’id manquant NOMMÉ — et la remise ré-accepte', () => {
    for (const id of weatherIdSchema.options) {
      const ampute = disque();
      ampute.conditions = ampute.conditions.filter((c) => c.id !== id);
      const err = validateDataset('weather.json', ampute);
      expect(err, `suppression de « ${id} » acceptée — la météo n’aurait plus de libellé`).toBeTruthy();
      expect(err).toContain(`manquante(s) — ${id}.`);
      // REMISE : le refus tient à l'absence, pas à un état global de la sonde.
      ampute.conditions = disque().conditions;
      expect(validateDataset('weather.json', ampute)).toBeNull();
    }
  });

  it('l’alphabet du schéma et les ids de la donnée coïncident EXACTEMENT', () => {
    expect(disque().conditions.map((c) => c.id).sort()).toEqual([...weatherIdSchema.options].sort());
  });

  it('un `label` VIDÉ est refusé — la chaîne vide n’est pas un nom de météo', () => {
    // `label` est devenu l'unique source du nom à l'écran : avant, l'i18n garantissait le non-vide par
    // construction (une clé absente du catalogue ne rend pas ''). `.min(1)` reprend cette garantie —
    // patron de l'enveloppe (`grammaire/document.ts`, `label: z.string().min(1)`).
    const vide = disque();
    vide.conditions = vide.conditions.map((c) => (c.id === 'pluie' ? { ...c, label: '' } : c));
    const err = validateDataset('weather.json', vide);
    expect(err, 'label vide accepté — la tuile Météo afficherait une chaîne nue').toBeTruthy();
    expect(err).toContain('conditions « pluie » › label');
  });

  it('un id EN DOUBLE est refusé, l’id dupliqué NOMMÉ', () => {
    // Le `find` de `weatherCondition` prend la PREMIÈRE : un doublon rend la seconde fiche inerte, et
    // l'édition d'une météo au Codex resterait sans effet à l'écran — muet, jamais rouge.
    const double = disque();
    double.conditions = [...double.conditions, { ...double.conditions[0] }];
    const err = validateDataset('weather.json', double);
    expect(err, 'doublon accepté — une fiche inerte, sans un mot').toBeTruthy();
    expect(err).toContain('conditions « sec »');
    expect(err).toContain('« sec » dupliqué');
    expect(err!.split('\n').filter((l) => l.startsWith('  - ')), 'un doublon, une faute').toHaveLength(1);
  });
});

describe('weather.json — le LIBELLÉ est la donnée, jusqu’au site affiché', () => {
  it('éditer un `label` au Codex change la porte ET la ModLine « Météo : … »', () => {
    const orig = weatherConditions.map((c) => structuredClone(c));
    try {
      setDataset(
        'weatherConditions',
        weatherConditions.map((c) =>
          c.id === 'pluie' ? { ...c, label: 'Bruine de Reikland' }
            : c.id === 'pluie-diluvienne' ? { ...c, label: 'Déluge de Morrslieb' }
              : c,
        ),
      );
      expect(weatherCondition('pluie').label).toBe('Bruine de Reikland');
      // SITE RÉEL : la pénalité -10 aux Tests physiques (EDOC 8 l.82) sous pluie diluvienne, sur une
      // carac physique (`force`) — la ligne porte le libellé de la DONNÉE, pas une carte FR.
      const mods = weatherTestMods('pluie-diluvienne', 'force');
      expect(mods).toHaveLength(1);
      expect(mods[0].label).toBe('Météo : Déluge de Morrslieb');
      expect(mods[0].value).toBe(-10);
    } finally {
      setDataset('weatherConditions', orig);
    }
    expect(weatherCondition('pluie').label).toBe('Pluie');
    expect(weatherTestMods('pluie-diluvienne', 'force')[0].label).toBe('Météo : Pluie diluvienne');
  });

  it('CEINTURE : une condition absente de la donnée fait ÉCHOUER la porte en NOMMANT l’id', () => {
    const orig = weatherConditions.map((c) => structuredClone(c));
    try {
      setDataset('weatherConditions', weatherConditions.filter((c) => c.id !== 'neige'));
      expect(() => weatherCondition('neige')).toThrow(/neige/);
    } finally {
      setDataset('weatherConditions', orig);
    }
    expect(weatherCondition('neige').label).toBe('Neige');
  });
});
