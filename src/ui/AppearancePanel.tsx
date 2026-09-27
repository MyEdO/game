import { RigSprite } from '../gameIso/rig/composeRig';
import type { Appearance } from '../gameIso/rig/appearance';
import type { EquipCtx } from '../gameIso/rig/parts/equipment';
import { ColorPalettePickers } from './ColorPalettePickers';
import { hairstylesForSex } from '../gameIso/rig/parts/hairstyles';
import { coiffureChoisie, coiffureRetombee } from '../gameIso/rig/parts/cosmetic';
import { Icon } from './Icon';
import { sexeSchema } from '../data/schemas/grammaire/valeurs';
import { libelleDeValeur } from '../data/schemas/grammaire/meta';

/**
 * Panneau d'apparence réutilisable (créateur de personnage). GRAND aperçu live du rig (c'est la
 * récompense de l'écran) + réglages cosmétiques (sexe, morphologie, coiffure, variante, couleurs).
 * Le corps/arme/armure suit la carrière ; sexe/morpho sont libres. Responsive : l'aperçu passe
 * au-dessus des réglages sous 700 px (styles.css `.appear-panel`).
 */
export function AppearancePanel({
  value,
  equip,
  career,
  onChange,
}: {
  value: Appearance;
  equip: EquipCtx;
  career?: string;
  onChange: (a: Appearance) => void;
}) {
  const set = (patch: Partial<Appearance>) => onChange(coiffureRetombee({ ...value, ...patch }));
  return (
    <div className="appear-panel">
      <svg viewBox="0 0 120 150" className="appear-figure">
        <rect x={0} y={0} width={120} height={150} fill="#1d2230" rx={6} />
        <RigSprite appearance={value} equip={equip} career={career} />
      </svg>
      <div className="appear-controls">
        <div className="appear-fields">
          <label>
            Sexe
            <select value={value.sex} onChange={(e) => set({ sex: sexeSchema.parse(e.target.value) })}>
              {sexeSchema.options.map((s) => (
                <option key={s} value={s}>
                  {libelleDeValeur(sexeSchema, s)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Coiffure
            <select
              value={value.hairstyle ?? ''}
              onChange={(e) => set(coiffureChoisie(e.target.value || undefined))}
            >
              <option value="">Défaut (espèce)</option>
              {hairstylesForSex(value.sex).map((h) => (
                <option key={h.id} value={h.id}>
                  {h.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Morphologie <em className="hint">(frêle ↔ corpulent)</em>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={value.build}
              onChange={(e) => set({ build: Number(e.target.value) })}
            />
          </label>
          <label>
            Visage
            <button type="button" className="btn small" onClick={() => set({ seed: (value.seed ?? 0) + 1 })}>
              <Icon id="nav/dice" size="sm" /> Variante
            </button>
          </label>
        </div>
        <ColorPalettePickers colors={value.colors} onColors={(patch) => set({ colors: { ...(value.colors ?? {}), ...patch } })} />
      </div>
    </div>
  );
}
