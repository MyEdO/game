/**
 * Garde-fou STRUCTUREL — aucune couche non-espèce ne déclare de clé de sorte PORTEUR (#583, #599, #1903).
 * Question : une tenue, une arme ou une armure peut-elle écraser la peau, la chevelure ou les yeux de
 * son porteur ? Primitive : `auditClesPorteur` (`scripts/guards/lib/clesPorteurAudit.ts`), projection de
 * `PORTEUR`. Périmètre : TOUS les defs des trois registres (un audit partiel a déjà masqué le trou, 16
 * tenues sur 117).
 */
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { TENUE_DEFS } from './tenues/_registry.generated';
import { WEAPON_DEFS } from './weapons/_registry.generated';
import { ARMOUR_DEFS } from './armour/_registry.generated';
import { auditClesPorteur } from '../../../../scripts/guards/lib/clesPorteurAudit';
import { listerDossier } from '../../../../scripts/guards/lib/lister.mjs';

const COUCHES = () => [
  ...TENUE_DEFS.map((d) => ({ id: `tenue:${d.id}`, palette: d.palette })),
  ...WEAPON_DEFS.map((d) => ({ id: `arme:${d.slug}`, palette: d.palette })),
  ...ARMOUR_DEFS.map((d) => ({ id: `armure:${d.id}`, palette: d.palette })),
];

describe('aucune tenue, arme ni armure ne déclare de clé porteur (peau, cheveux, yeux et leur gamme)', () => {
  it.each([['tenue', 'tenues'], ['arme', 'weapons'], ['armure', 'armour']])(
    'le balayage couvre chaque def déposé du registre %s (un fichier de `%s/defs/` = une couche, id unique)',
    (famille, dossier) => {
      const fichiers = listerDossier(fileURLToPath(new URL(`./${dossier}/defs/`, import.meta.url))).filter((f) => f.endsWith('.ts'));
      const ids = COUCHES().filter((c) => c.id.startsWith(`${famille}:`)).map((c) => c.id);
      expect(ids.length).toBe(fichiers.length);
      expect(new Set(ids).size).toBe(ids.length);
    },
  );

  it('aucun def ne déclare de clé porteur dans sa palette', () => {
    const offenders = auditClesPorteur(COUCHES());
    expect(offenders, `Defs qui déclarent une clé du PORTEUR — elle vient de l'espèce, jamais d'une tenue,\n` +
      `d'une arme ou d'une armure (retirer la clé, ou la renommer si elle peint en fait une AUTRE chose —\n` +
      `ex. la guimpe/voile de Nonne) :\n` +
      offenders.map((o) => `  ${o.id}: ${o.keys.join(', ')}`).join('\n'),
    ).toEqual([]);
  });
});

/** MORSURES — une clé porteur injectée dans une couche de chaque registre rougit-elle la garde ? */
describe('morsure : une clé porteur déclarée rougit la garde', () => {
  const cas: [string, { palette?: Record<string, string> }, string, string][] = [
    ['tenue', TENUE_DEFS[0], `tenue:${TENUE_DEFS[0].id}`, 'peauO'],
    ['tenue', TENUE_DEFS[0], `tenue:${TENUE_DEFS[0].id}`, 'cheveuxO'],
    ['arme', WEAPON_DEFS[0], `arme:${WEAPON_DEFS[0].slug}`, 'yeux'],
    ['armure', ARMOUR_DEFS[0], `armure:${ARMOUR_DEFS[0].id}`, 'peauH'],
  ];
  it.each(cas)('%s : `%s` injectée', (_r, def, id, cle) => {
    const saved = def.palette;
    try {
      def.palette = { ...(saved ?? {}), [cle]: '#8a5a36' };
      expect(auditClesPorteur(COUCHES()).some((o) => o.id === id && o.keys.includes(cle))).toBe(true);
    } finally {
      def.palette = saved;
    }
  });

  it('restaurée, la garde redevient verte', () => {
    expect(auditClesPorteur(COUCHES())).toEqual([]);
  });
});
