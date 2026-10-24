import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppearancePanel } from './AppearancePanel';
import { asRigSpeciesId } from '../gameIso/rig/appearance';
import type { Appearance } from '../engine/authoringAppearance';
import { equipDe } from '../noyau/equipementDessine';


const app: Omit<Appearance, 'species'> = { sex: 'F', build: 0.4, seed: 2 };

describe('AppearancePanel', () => {
  it('rend un aperçu de rig + les réglages coiffure/morphologie/variante, sans contrôle de Sexe', () => {
    const html = renderToStaticMarkup(
      <AppearancePanel species={asRigSpeciesId('humain')} value={app} equip={equipDe([], [])} career="soldat" onChange={vi.fn()} />,
    );
    expect(html).toContain('data-bone='); // aperçu RigSprite présent
    expect(html).toContain('Coiffure');
    expect(html).toContain('Morphologie');
    expect(html).toContain('type="range"');
    expect(html).toContain('Variante');
    expect(html).not.toContain('>Sexe<');
    expect(html).not.toContain('Masculin');
  });
});
