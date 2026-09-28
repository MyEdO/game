import { useMemo } from 'react';
import { RigSprite, rigComposition } from '../gameIso/rig/composeRig';
import type { Appearance, RigSpeciesId } from '../gameIso/rig/appearance';
import type { EquipCtx } from '../gameIso/rig/parts/equipment';
import { apparenceSuivante } from '../gameIso/rig/parts/cosmetic';
import { ColorPalettePickers } from './ColorPalettePickers';
import { ReglagesApparence } from './editor/MonsterPartsFields';

/**
 * Panneau d'apparence du créateur de personnage : GRAND aperçu live du rig + `ReglagesApparence`
 * (coiffure, morphologie, variante) + couleurs. L'espèce vient de l'étape Race, le sexe de la bande
 * Identité. Responsive : l'aperçu passe au-dessus des réglages sous 700 px (`.appear-panel`).
 */
export function AppearancePanel({
  species,
  value,
  equip,
  career,
  onChange,
}: {
  species: RigSpeciesId;
  value: Omit<Appearance, 'species'>;
  equip: EquipCtx;
  career?: string;
  onChange: (next: Omit<Appearance, 'species'>) => void;
}) {
  const comp = useMemo(() => rigComposition({ ...value, species }, equip, career), [value, species, equip, career]);
  return (
    <div className="appear-panel">
      <svg viewBox="0 0 120 150" className="appear-figure">
        <rect x={0} y={0} width={120} height={150} fill="#1d2230" rx={6} />
        <RigSprite comp={comp} />
      </svg>
      <div className="appear-controls">
        <div className="appear-fields">
          <ReglagesApparence appearance={value} onChange={onChange} reglages={['hairstyle', 'build', 'variante']} />
        </div>
        <ColorPalettePickers colors={value.colors} onColors={(colors) => onChange(apparenceSuivante(value, { colors }))} />
      </div>
    </div>
  );
}
