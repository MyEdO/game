/**
 * Champs « mutant modulaire » partagés : parts monstrueuses par slot (Tête, Bras G,
 * Bras D, Cornes, Queue) + Arme équipée. Utilisé par l'inspecteur d'entité ET par
 * l'inspecteur de spawn de rencontre → mêmes contrôles, séparation apparence↔stats.
 */
import { MONSTER_HEAD_OPTIONS, MONSTER_ARM_OPTIONS, MONSTER_LEG_OPTIONS } from '../../gameIso/rig/parts/monstrous';
import { EYE_OPTIONS } from '../../gameIso/rig/parts/eyes';
import { ColorPalettePickers, MONSTER_COLOR_SLOTS } from '../ColorPalettePickers';
import { hairstylesForSex } from '../../gameIso/rig/parts/hairstyles';
import { tenueOptions } from '../../gameIso/rig/parts/career';
import { harnaisOptions } from '../../gameIso/rig/quadruped/harnais';
import { elementsOf } from '../../gameIso/rig/parts/elements';
import { creatureSpeciesOptions } from '../../gameIso/rig/creatures';
import type { MonsterPartsSel, ColorsSel } from '../../engine/authoringAppearance';
import { sexeSchema, type Sexe } from '../../data/schemas/grammaire/valeurs';
import { libelleDeValeur } from '../../data/schemas/grammaire/meta';

/** Armes équipables proposées (une par forme/groupe — affichées par le rig). */
export const EDITOR_WEAPONS = ['Épée', 'Hache', 'Masse', 'Dague', 'Lance', 'Hallebarde', 'Bâton de combat', 'Arc', 'Arbalète', 'Pistolet', 'Fronde', 'Fouet'];

/**
 * Réglages d'APPARENCE partagés (Espèce, Sexe, Carrure, Coiffure) : des `.ed-subfield` SANS titre de
 * rubrique — l'hôte les range sous SON unique titre « Apparence » (`Fold` de l'inspecteur, `.ed-field`
 * du narratif et du Codex).
 */
export function ReglagesApparence({
  species,
  sex,
  build,
  hairstyle,
  onSpecies,
  onSex,
  onBuild,
  onHairstyle,
}: {
  species?: string;
  sex?: Sexe;
  build?: number;
  hairstyle?: string;
  onSpecies: (id: string | undefined) => void;
  onSex: (s: Sexe) => void;
  onBuild: (b: number) => void;
  onHairstyle: (id: string | undefined) => void;
}) {
  return (
    <>
      <label className="ed-subfield">
        Espèce
        <select value={species ?? ''} onChange={(e) => onSpecies(e.target.value || undefined)}>
          <option value="">(par défaut : Humain)</option>
          {creatureSpeciesOptions().map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </label>
      <label className="ed-subfield">
        Sexe
        <select value={sex ?? ''} onChange={(e) => onSex(sexeSchema.parse(e.target.value))}>
          {sex == null && <option value="" disabled>Tiré au rendu</option>}
          {sexeSchema.options.map((s) => <option key={s} value={s}>{libelleDeValeur(sexeSchema, s)}</option>)}
        </select>
      </label>
      <label className="ed-subfield">
        Carrure
        <input type="range" min={0} max={1} step={0.05} value={build ?? 0.5} onChange={(e) => onBuild(Number(e.target.value))} />
      </label>
      <label className="ed-subfield">
        Coiffure
        <select value={hairstyle ?? ''} onChange={(e) => onHairstyle(e.target.value || undefined)}>
          <option value="">Défaut (espèce)</option>
          {sex
            ? hairstylesForSex(sex).map((h) => <option key={h.id} value={h.id}>{h.label}</option>)
            : sexeSchema.options.map((s) => (
              <optgroup key={s} label={`Sexe : ${libelleDeValeur(sexeSchema, s)}`}>
                {hairstylesForSex(s).map((h) => <option key={h.id} value={h.id}>{h.label}</option>)}
              </optgroup>
            ))}
        </select>
      </label>
    </>
  );
}

export function MonsterPartsFields({
  monster,
  weapon,
  colors,
  tenue,
  harnais,
  eyes,
  features,
  onMonster,
  onWeapon,
  onColors,
  onTenue,
  onHarnais,
  onEyes,
  onFeatures,
}: {
  monster?: MonsterPartsSel;
  weapon?: string;
  colors?: ColorsSel;
  tenue?: string;
  harnais?: string;
  eyes?: { G?: string; D?: string };
  /** Traits ADDITIFS choisis (clés du catalogue d'éléments). */
  features?: string[];
  onMonster: (patch: Partial<MonsterPartsSel>) => void;
  /** Optionnel : si absent, le sélecteur « Arme équipée » est masqué (ex. apparence de créature —
   *  l'arme vient des Traits, pas de l'apparence). */
  onWeapon?: (w: string | undefined) => void;
  onColors: (patch: Partial<ColorsSel>) => void;
  onTenue?: (c: string | undefined) => void;
  /** Optionnel : si absent, le sélecteur « Harnachement » est masqué (il n'a de sens que là où
   *  l'apparence peut porter un gabarit quadrupède — l'apparence par défaut d'une créature). */
  onHarnais?: (id: string | undefined) => void;
  onEyes?: (patch: { G?: string; D?: string }) => void;
  /** Optionnel : si absent, le picker « Traits » est masqué. */
  onFeatures?: (f: string[]) => void;
}) {
  return (
    <>
      <div className="ed-field">
        <span>Mutations</span>
        {([
          ['Tête', 'tete', MONSTER_HEAD_OPTIONS],
          ['Bras gauche', 'brasG', MONSTER_ARM_OPTIONS],
          ['Bras droit', 'brasD', MONSTER_ARM_OPTIONS],
          ['Jambes', 'jambes', MONSTER_LEG_OPTIONS],
        ] as const).map(([lbl, slot, opts]) => (
          <label key={slot} className="ed-subfield">
            {lbl}
            <select value={monster?.[slot] ?? ''} onChange={(e) => onMonster({ [slot]: e.target.value || undefined })}>
              {opts.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </label>
        ))}
        <label className="ed-subfield">
          <input type="checkbox" checked={!!monster?.cornes} onChange={(e) => onMonster({ cornes: e.target.checked || undefined })} />
          Cornes
        </label>
        <label className="ed-subfield">
          <input type="checkbox" checked={!!monster?.queue} onChange={(e) => onMonster({ queue: e.target.checked || undefined })} />
          Queue
        </label>
        <label className="ed-subfield">
          <input type="checkbox" checked={!!monster?.ailes} onChange={(e) => onMonster({ ailes: e.target.checked || undefined })} />
          Ailes
        </label>
        {onEyes && ([['Œil gauche', 'G'], ['Œil droit', 'D']] as const).map(([lbl, side]) => (
          <label key={side} className="ed-subfield">
            {lbl}
            <select value={eyes?.[side] ?? ''} onChange={(e) => onEyes({ [side]: e.target.value || undefined })}>
              <option value="">— normal —</option>
              {Object.entries(EYE_OPTIONS).map(([key, o]) => (
                <option key={key} value={key}>{o.label}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {onWeapon && (
        <label className="ed-field">
          Arme équipée
          <select value={weapon ?? ''} onChange={(e) => onWeapon(e.target.value || undefined)}>
            <option value="">— aucune —</option>
            {EDITOR_WEAPONS.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </label>
      )}
      {onFeatures && (
        <div className="ed-field">
          <span>Traits &amp; difformités (apparence pure — sans trait/talent)</span>
          {[...elementsOf('trait'), ...elementsOf('mutation')].map((e) => {
            const on = (features ?? []).includes(e.key);
            return (
              <label key={e.key} className="ed-check">
                <input type="checkbox" checked={on}
                  onChange={() => onFeatures(on ? (features ?? []).filter((k) => k !== e.key) : [...(features ?? []), e.key])} />
                <span>{e.label}</span>
              </label>
            );
          })}
        </div>
      )}
      <label className="ed-field">
        Tenue
        <select value={tenue ?? ''} onChange={(e) => onTenue?.(e.target.value || undefined)}>
          <option value="">— par défaut (selon l’espèce) —</option>
          {tenueOptions().map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      </label>
      {onHarnais && (
        <label className="ed-field">
          Harnachement
          <select value={harnais ?? ''} onChange={(e) => onHarnais(e.target.value || undefined)}>
            <option value="">— aucun (bête nue) —</option>
            {harnaisOptions().map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </label>
      )}
      <ColorPalettePickers colors={colors} onColors={onColors} slots={MONSTER_COLOR_SLOTS} />
    </>
  );
}
