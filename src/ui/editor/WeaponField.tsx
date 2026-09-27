/**
 * Éditeur RÉUTILISABLE d'une `Weapon` (arme dérivée/naturelle conférée par une mutation, un trait, un
 * objet…). Édite le VRAI objet `Weapon` — pas de structure intermédiaire. Les champs de LOADOUT
 * (hand/uid/reload/bypass/skin) sont runtime et hors édition : on ne décrit ici que l'arme elle-même.
 */
import type { Weapon, QualityInstance, ReachValue } from '../../engine/types';
import { REACH_LABELS, REACH_VARIABLE } from '../../engine/types';
import { damageString, parseDamage, REACH_IDS } from '../../engine/items';
import { parseQualityInstance } from '../../engine/qualities/normalize';
import { qualityRefLabel } from '../../data';
import { NumberField } from '../NumberField';
import { RefField, REF_FIELD } from '../compendium/RefField';

/** Valeurs sélectionnables de l'Allonge = le vocabulaire FERMÉ `ReachValue` lui-même (les sept
 *  longueurs de l'axe, LDB 62 l.156-164, puis « Variable », l.31) : la `<option>` et la valeur
 *  écrite dans la donnée sont la MÊME liste typée — aucune reconversion de texte. */
const REACH_OPTIONS: ReachValue[] = [...REACH_IDS.map((id) => REACH_LABELS[id]), REACH_VARIABLE];

export function WeaponField({ value, onChange }: { value: Weapon | undefined; onChange: (v: Weapon | undefined) => void }) {
  if (!value) {
    return (
      <div className="ed-field">
        <label className="dr"><input type="checkbox" checked={false} onChange={() => onChange({ label: '', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] })} /> confère une ARME (naturelle / dérivée)</label>
      </div>
    );
  }
  const w = value;
  const patch = (p: Partial<Weapon>) => onChange({ ...w, ...p });
  // Portée : SPEC (mètres fixes OU `{bf}` = BF×N, arme de jet). Toggle « ×BF » + valeur, sans perte de donnée.
  const rangeBf = typeof w.range === 'object' && w.range != null;
  const rangeNum: number | undefined = rangeBf ? (w.range as { bf: number }).bf : typeof w.range === 'number' ? w.range : undefined;
  return (
    <div className="ed-field ed-weapon">
      <label className="dr"><input type="checkbox" checked onChange={() => onChange(undefined)} /> ARME conférée</label>
      <div className="tf-row">
        <input placeholder="Nom (ex. Cornes)" value={w.label} onChange={(e) => patch({ label: e.target.value })} />
        <label className="dr">Type
          <select value={w.type} onChange={(e) => patch({ type: e.target.value as Weapon['type'] })}>
            <option value="melee">Mêlée</option>
            <option value="ranged">Distance</option>
          </select>
        </label>
        <label className="dr">Dégâts<input placeholder="+BF / +BF+4 / +9" value={damageString(w.damage)} onChange={(e) => patch({ damage: parseDamage(e.target.value) })} /></label>
        <label className="dr">Mains
          <select value={w.hands ?? 1} onChange={(e) => patch({ hands: Number(e.target.value) === 2 ? 2 : 1 })}>
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
        </label>
        <RefField cfg={REF_FIELD['trappings.subType']} label="Groupe" nullable value={w.subType ?? ''}
          onChange={(v) => patch({ subType: typeof v === 'string' && v !== '' ? v : undefined })} />
        {w.type === 'melee' ? (
          <label className="dr">Allonge
            {/* Choix FERMÉ sur l'axe (LDB 62 l.156-164) + « Variable » (l.31) : une saisie libre
                produisait des Allonges hors axe, muettes pour toute règle de longueur. */}
            <select value={w.reach ?? ''} onChange={(e) => patch({ reach: REACH_OPTIONS.find((r) => r === e.target.value) })}>
              <option value="">—</option>
              {REACH_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
        ) : (
          <label className="dr">Portée {rangeBf ? '(×BF)' : '(m)'}
            <NumberField variant="nu" label={`Portée ${rangeBf ? '(×BF)' : '(m)'}`} min={0} vide value={rangeNum}
              onChange={(n) => patch({ range: n == null ? undefined : rangeBf ? { bf: n } : n })} />
            <label className="bf-toggle"><input type="checkbox" checked={rangeBf}
              onChange={(e) => { const n = typeof rangeNum === 'number' ? rangeNum : 0; patch({ range: e.target.checked ? { bf: n } : n }); }} /> ×BF</label>
          </label>
        )}
      </div>
      <label className="dr">Qualités<input placeholder="Perçante, Solide 3… (séparées par des virgules)" value={w.qualities.map(qualityRefLabel).join(', ')}
        onChange={(e) => patch({ qualities: e.target.value.split(',').map((s) => parseQualityInstance(s.trim())).filter((q): q is QualityInstance => q != null) })} /></label>
    </div>
  );
}
