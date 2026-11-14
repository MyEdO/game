/**
 * IDS VIVANTS (#1686 lot 3a-2) — le second régime déclaré par `_ids.generated.ts` : les références se
 * refinent contre les datasets EN MÉMOIRE, pas seulement contre le fichier figé au dernier
 * `npm run gen`. Sans lui, une entité créée à l'atelier rend INVALIDE toute donnée qui la référence,
 * et le save du Compendium la refuse — alors que la donnée est juste.
 *
 * Mesure sur le chemin RÉEL : `setDataset` (le seam de mutation en place d'`overrides.ts`) puis
 * `validateDataset` (la porte que `CodexEdit.save` emprunte), sur `props.json` qui référence une
 * matière par `idDe('material', 'prop')` — donc par la SOUS-LISTE discriminée, le cas le plus étroit.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { setDataset, datasetArray } from '../overrides';
import { validateDataset } from './validate';
import { props } from '../index';

const NEUVE = {
  id: 'sonde-matiere-neuve',
  type: 'materials',
  label: 'Matière de sonde',
  domain: 'prop',
  color: '#123456',
  roughness: 0.5,
  metalness: 0,
} as const;

const AVANT = datasetArray('materials').slice();
afterEach(() => { setDataset('materials', AVANT as never); });

/** Le document `props.json` réel, dont la 1ʳᵉ primitive volumique référence la matière `id`. */
function propsAvecMatiere(id: string): unknown {
  const doc = structuredClone(props);
  const cible = doc.flatMap((p) => p.volume?.primitives ?? []).find((prim) => prim.material !== undefined);
  expect(cible, 'aucune primitive de `props.json` ne référence de matière — la sonde ne mesure rien').toBeTruthy();
  if (cible) Object.assign(cible, { material: id });
  return doc;
}

describe('références — les ids se lisent sur la donnée EN MÉMOIRE (#1686)', () => {
  it('une matière CRÉÉE en mémoire est référençable AUSSITÔT, sans `npm run gen`', () => {
    expect(
      validateDataset('props.json', propsAvecMatiere(NEUVE.id)),
      'la matière neuve est déjà connue du registre GÉNÉRÉ — la sonde ne prouverait rien',
    ).toContain(NEUVE.id);

    setDataset('materials', [...AVANT, NEUVE] as never);
    expect(validateDataset('props.json', propsAvecMatiere(NEUVE.id))).toBeNull();
  });

  it('une matière RETIRÉE de la mémoire cesse d’être référençable — nommément', () => {
    const [premiere] = AVANT.filter((m) => m.domain === 'prop');
    setDataset('materials', AVANT.filter((m) => m.id !== premiere.id) as never);
    const refus = validateDataset('props.json', propsAvecMatiere(premiere.id));
    expect(refus, 'le registre figé a servi de laissez-passer').toContain(premiere.id);
    expect(refus).toContain('materials.json');
  });

  it('le DOMAINE reste discriminant en mémoire : une matière de TOITURE ne passe pas pour une matière de décor', () => {
    const toit = AVANT.find((m) => m.domain === 'roof')!;
    expect(validateDataset('props.json', propsAvecMatiere(toit.id))).toContain('prop');
  });

  it('une référence INCONNUE des deux régimes reste refusée', () => {
    setDataset('materials', [...AVANT, NEUVE] as never);
    expect(validateDataset('props.json', propsAvecMatiere('matiere-qui-n-existe-pas'))).toContain('matiere-qui-n-existe-pas');
  });
});
