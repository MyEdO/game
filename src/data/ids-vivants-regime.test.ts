import { describe, it, expect, afterEach } from 'vitest';
import { props, skills, domains, refEstVolumique, type PropData, type SkillData, type DomainData } from './index';
import { setDataset } from './overrides';
import { idDe, entreeOuverte, refusDeSpec } from './schemas/grammaire/ref';
import { poserSourceDIdsVivants, type SourceDIdsVivants } from './schemas/grammaire/idsVivants';
import { sceneEntitySchema } from './schemas/defs-scenes/scene';

/**
 * RÉGIME VIF DES IDS (#1897) — tout dataset-tableau du seam (`ARRAYS`, `data/overrides.ts`) est lu en
 * MÉMOIRE par `ref.ts`, qu'il ait une route d'édition au Codex ou non (`props.json` est `edit: none` :
 * aucun écran ne l'écrit). Chaque cas LIT d'abord (le mémo de `idsVivants.ts`
 * se remplit), ÉCRIT au seam, puis relit : un mémo qui ignorerait la version servirait l'ancien monde.
 */

const DECORS_LIVRES: PropData[] = [...props];
const COMPETENCES_LIVREES: SkillData[] = [...skills];
const DOMAINES_LIVRES: DomainData[] = [...domains];
afterEach(() => {
  setDataset('props', DECORS_LIVRES);
  setDataset('skills', COMPETENCES_LIVREES);
  setDataset('domains', DOMAINES_LIVRES);
});

const entite = (ref: string, facing?: string) => ({ id: 'p-1', kind: 'prop', ref, pos: { x: 1, y: 1 }, ...(facing ? { facing } : {}) });

describe('régime vif — `props.json` sans route d’édition', () => {
  it('un décor posé par `setDataset` est accepté par `idDe(\'prop\')` et par le schéma d’entité', () => {
    const base = props.find((p) => p.id === 'tonneau')!;
    const noeud = idDe('prop');
    expect(noeud.safeParse('decor-neuf').success).toBe(false);
    setDataset('props', [...DECORS_LIVRES, { ...base, id: 'decor-neuf', label: 'Décor neuf' }]);
    expect(noeud.safeParse('decor-neuf').success).toBe(true);
    expect(sceneEntitySchema.safeParse(entite('decor-neuf')).success).toBe(true);
  });

  it('un `volume` posé par `setDataset` sur un décor plat rend son cap diagonal refusé', () => {
    const plat = props.find((p) => !p.volume && !p.foot)!;
    const volumique = props.find((p) => p.volume)!;
    expect(refEstVolumique(plat.id)).toBe(false);
    expect(sceneEntitySchema.safeParse(entite(plat.id, 'NE')).success).toBe(true);
    setDataset('props', DECORS_LIVRES.map((p) => (p.id === plat.id ? { ...p, volume: volumique.volume } : p)));
    expect(refEstVolumique(plat.id)).toBe(true);
    const verdict = sceneEntitySchema.safeParse(entite(plat.id, 'NE'));
    expect(verdict.success).toBe(false);
    expect(verdict.error?.issues.map((i) => i.message).join('\n')).toMatch(/cap cardinal/);
  });
});

describe('régime vif — l’admission d’une spécialisation suit l’ENTRÉE éditée au Codex, sans `npm run gen`', () => {
  const ouverte = skills.find((s) => s.specsOpen === true && !!s.specs?.length)!;
  const fermee = skills.find((s) => !s.specsOpen && !s.specsSource && !!s.specs?.length)!;

  it('décocher « Spécialisation ouverte » (la case générique écrit `specsOpen: false`) FERME l’entrée', () => {
    expect(entreeOuverte('skill', ouverte.id)).toBe(true);
    expect(refusDeSpec('skill', ouverte.id, 'texte-libre')).toBeNull();
    setDataset('skills', COMPETENCES_LIVREES.map((s) => (s.id === ouverte.id ? { ...s, specsOpen: false } : s)));
    expect(entreeOuverte('skill', ouverte.id)).toBe(false);
    expect(refusDeSpec('skill', ouverte.id, 'texte-libre')).toBe('horsCatalogue');
  });

  it('cocher « Spécialisation ouverte » OUVRE une entrée fermée', () => {
    expect(refusDeSpec('skill', fermee.id, 'texte-libre')).toBe('horsCatalogue');
    setDataset('skills', COMPETENCES_LIVREES.map((s) => (s.id === fermee.id ? { ...s, specsOpen: true } : s)));
    expect(refusDeSpec('skill', fermee.id, 'texte-libre')).toBeNull();
  });

  it('une spécialisation ajoutée à `specs[]` d’une entrée fermée est admise aussitôt', () => {
    expect(refusDeSpec('skill', fermee.id, 'spec-neuve')).toBe('horsCatalogue');
    setDataset('skills', COMPETENCES_LIVREES.map((s) => (s.id === fermee.id ? { ...s, specs: [...s.specs!, { id: 'spec-neuve', label: 'Spec neuve' }] } : s)));
    expect(refusDeSpec('skill', fermee.id, 'spec-neuve')).toBeNull();
  });

  it('un domaine créé est admis aussitôt dans l’univers d’une entrée à `specsSource` (Focalisation)', () => {
    expect(refusDeSpec('skill', 'focalisation', 'domaine-neuf')).toBe('horsCatalogue');
    setDataset('domains', [...DOMAINES_LIVRES, { ...DOMAINES_LIVRES[0], id: 'domaine-neuf', label: 'Domaine neuf' }]);
    expect(refusDeSpec('skill', 'focalisation', 'domaine-neuf')).toBeNull();
  });
});

describe('mémo des ids vivants — daté par la source', () => {
  it('poser une autre source vide le mémo, même à version égale', () => {
    const noeud = idDe('etat');
    expect(noeud.safeParse('etat-synthetique').success).toBe(false);
    const vraie: SourceDIdsVivants = poserSourceDIdsVivants(undefined)!;
    poserSourceDIdsVivants({
      entrees: (f) => (f === 'etats.json' ? [...vraie.entrees(f)!, { id: 'etat-synthetique' }] : vraie.entrees(f)),
      version: vraie.version,
    });
    try {
      expect(noeud.safeParse('etat-synthetique').success).toBe(true);
    } finally {
      poserSourceDIdsVivants(vraie);
    }
    expect(noeud.safeParse('etat-synthetique').success).toBe(false);
  });
});
