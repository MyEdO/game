/**
 * Briques d'APPARENCE (#1897) : un seul contrat `({ appearance, onChange(next), reglages })`. `reglages`
 * est la liste des réglages rendus, en donnée (patron des `slots` de `ColorPalettePickers`) ; toute
 * écriture passe par `apparenceSuivante`. Styles : `styles/reglages-apparence.css`.
 */
import { MONSTER_HEAD_OPTIONS, MONSTER_ARM_OPTIONS, MONSTER_LEG_OPTIONS } from '../../gameIso/rig/parts/monstrous';
import { EYE_OPTIONS } from '../../gameIso/rig/parts/eyes';
import { ColorPalettePickers, MONSTER_COLOR_SLOTS } from '../ColorPalettePickers';
import { hairstylesForSex } from '../../gameIso/rig/parts/hairstyles';
import { apparenceSuivante, type ApparenceEditee } from '../../gameIso/rig/parts/cosmetic';
import { tenueOptions } from '../../gameIso/rig/parts/career';
import { harnaisOptions } from '../../gameIso/rig/quadruped/harnais';
import { elementsOf } from '../../gameIso/rig/parts/elements';
import { defById } from '../../gameIso/rig/creatures';
import { libelleDeFormeDeNuee } from '../../gameIso/rig/swarm/forms';
import { raceById } from '../../gameIso/rig/races';
import { armesChoisissables, findSpeciesById, speciesSingular, DEFAULT_RACE_ID } from '../../data';
import { domaineDEspeces } from '../../data/schemas/grammaire/art';
import type { EntityAppearance } from '../../engine/authoringAppearance';
import { sexeSchema } from '../../data/schemas/grammaire/valeurs';
import { libelleDeValeur } from '../../data/schemas/grammaire/meta';
import { Icon } from '../Icon';

/** Réglages de `ReglagesApparence` ; `variante` = « un autre visage » (graine + 1, reproductible). */
export type ReglageApparence = 'species' | 'sex' | 'build' | 'hairstyle' | 'variante';

/** Réglages de `MonsterPartsFields`. */
export type ReglagePart = 'monster' | 'eyes' | 'features' | 'tenue' | 'harnais' | 'colors';

const CASES_MONSTRE = [['cornes', 'Cornes'], ['queue', 'Queue'], ['ailes', 'Ailes']] as const;

/** Libellé d'AFFICHAGE d'une espèce d'auteur, lu sur l'entrée de son registre ; l'id nu hors registre. */
function libelleDEspece(id: string): string {
  return (findSpeciesById(id) ? speciesSingular(id) : '') || defById(id)?.label || libelleDeFormeDeNuee(id) || id;
}

/** Groupes d'espèces PROPOSÉS (`domaineDEspeces`) : une Nuée ne se dessine que par une forme de nuée,
 *  toute autre entité jamais par une forme de nuée (`resolveRender`, `gameIso/rig/bodyPlan.ts`). */
function groupesDEspece(nuee: boolean): { libelle: string; ids: string[] }[] {
  const domaine = domaineDEspeces();
  const trie = (ids: readonly string[]) => [...ids].sort((a, b) => libelleDEspece(a).localeCompare(libelleDEspece(b), 'fr'));
  return nuee
    ? [{ libelle: 'Formes de nuée', ids: trie(domaine.nuees) }]
    : [{ libelle: 'Espèces jouables', ids: trie(domaine.jouables) }, { libelle: 'Créatures', ids: trie(domaine.creatures) }];
}

/** Réglages d'apparence SANS titre de rubrique : l'hôte les range sous SON titre « Apparence ». */
export function ReglagesApparence<T extends ApparenceEditee>({
  appearance,
  onChange,
  reglages,
  nuee = false,
}: {
  appearance: T;
  onChange: (next: T) => void;
  reglages: readonly ReglageApparence[];
  /** L'entité porte le trait Nuée (l'hôte le sait) : seules les formes de nuée sont proposées. */
  nuee?: boolean;
}) {
  const poser = (patch: Partial<ApparenceEditee>) => onChange(apparenceSuivante(appearance, patch as Partial<T>));
  const { species, sex, build, hairstyle, seed } = appearance;
  const groupes = groupesDEspece(nuee);
  const horsDomaine = species != null && !groupes.some((g) => g.ids.includes(species));
  return (
    <>
      {reglages.includes('species') && (
        <label className="reglage-apparence">
          Espèce
          <select value={species ?? ''} onChange={(e) => poser({ species: e.target.value || undefined })}>
            <option value="">{`— selon le profil (à défaut : ${raceById(DEFAULT_RACE_ID).label}) —`}</option>
            {horsDomaine && <option value={species}>{`${libelleDEspece(species)} (inconnue)`}</option>}
            {groupes.map((g) => (
              <optgroup key={g.libelle} label={g.libelle}>
                {g.ids.map((id) => <option key={id} value={id}>{libelleDEspece(id)}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
      )}
      {reglages.includes('sex') && (
        <label className="reglage-apparence">
          Sexe
          <select value={sex ?? ''} onChange={(e) => poser({ sex: sexeSchema.parse(e.target.value) })}>
            {sex == null && <option value="" disabled>Tiré au rendu</option>}
            {sexeSchema.options.map((s) => <option key={s} value={s}>{libelleDeValeur(sexeSchema, s)}</option>)}
          </select>
        </label>
      )}
      {reglages.includes('build') && (
        <label className="reglage-apparence">
          Morphologie
          <input type="range" min={0} max={1} step={0.05} title="frêle ↔ corpulent" value={build ?? 0.5} onChange={(e) => poser({ build: Number(e.target.value) })} />
        </label>
      )}
      {reglages.includes('hairstyle') && (
        <label className="reglage-apparence">
          Coiffure
          <select value={hairstyle ?? ''} onChange={(e) => poser({ hairstyle: e.target.value || undefined })}>
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
      )}
      {reglages.includes('variante') && (
        <label className="reglage-apparence">
          Visage
          <button type="button" className="btn small" onClick={() => poser({ seed: (seed ?? 0) + 1 })}>
            <Icon id="nav/dice" size="sm" /> Variante
          </button>
        </label>
      )}
    </>
  );
}

/** Parts monstrueuses, yeux, traits additifs, tenue, harnachement et couleurs d'une apparence
 *  d'auteur. L'arme (`weapon`/`onWeapon`) n'est pas de l'apparence : sans `onWeapon`, pas de sélecteur. */
export function MonsterPartsFields({
  appearance,
  onChange,
  reglages,
  weapon,
  onWeapon,
}: {
  appearance: EntityAppearance;
  onChange: (next: EntityAppearance) => void;
  reglages: readonly ReglagePart[];
  weapon?: string;
  onWeapon?: (w: string | undefined) => void;
}) {
  const poser = (patch: Partial<EntityAppearance>) => onChange(apparenceSuivante(appearance, patch));
  const { monster, eyes, features, tenue, harnais, colors } = appearance;
  return (
    <>
      {reglages.includes('monster') && (
        <div className="ed-field">
          <span>Mutations</span>
          {([
            ['Tête', 'tete', MONSTER_HEAD_OPTIONS],
            ['Bras gauche', 'brasG', MONSTER_ARM_OPTIONS],
            ['Bras droit', 'brasD', MONSTER_ARM_OPTIONS],
            ['Jambes', 'jambes', MONSTER_LEG_OPTIONS],
          ] as const).map(([lbl, slot, opts]) => (
            <label key={slot} className="reglage-apparence">
              {lbl}
              <select value={monster?.[slot] ?? ''} onChange={(e) => poser({ monster: { [slot]: e.target.value || undefined } })}>
                {opts.map((o) => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
            </label>
          ))}
          {CASES_MONSTRE.map(([k, lbl]) => (
            <label key={k} className="reglage-apparence">
              <input type="checkbox" checked={!!monster?.[k]} onChange={(e) => poser({ monster: { [k]: e.target.checked || undefined } })} />
              {lbl}
            </label>
          ))}
          {reglages.includes('eyes') && ([['Œil gauche', 'G'], ['Œil droit', 'D']] as const).map(([lbl, side]) => (
            <label key={side} className="reglage-apparence">
              {lbl}
              <select value={eyes?.[side] ?? ''} onChange={(e) => poser({ eyes: { [side]: e.target.value || undefined } })}>
                <option value="">— normal —</option>
                {Object.entries(EYE_OPTIONS).map(([key, o]) => (
                  <option key={key} value={key}>{o.label}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
      {onWeapon && (
        <label className="ed-field">
          Arme équipée
          <select value={weapon ?? ''} onChange={(e) => onWeapon(e.target.value || undefined)}>
            <option value="">— aucune —</option>
            {armesChoisissables().map((w) => (
              <option key={w.id} value={w.id}>{w.label}</option>
            ))}
          </select>
        </label>
      )}
      {reglages.includes('features') && (
        <div className="ed-field">
          <span>Traits &amp; difformités (apparence pure — sans trait/talent)</span>
          {[...elementsOf('trait'), ...elementsOf('mutation')].map((e) => {
            const on = (features ?? []).includes(e.key);
            return (
              <label key={e.key} className="ed-check">
                <input type="checkbox" checked={on}
                  onChange={() => poser({ features: on ? (features ?? []).filter((k) => k !== e.key) : [...(features ?? []), e.key] })} />
                <span>{e.label}</span>
              </label>
            );
          })}
        </div>
      )}
      {reglages.includes('tenue') && (
        <label className="ed-field">
          Tenue
          <select value={tenue ?? ''} onChange={(e) => poser({ tenue: e.target.value || undefined })}>
            <option value="">— par défaut (selon l’espèce) —</option>
            {tenueOptions().map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </label>
      )}
      {reglages.includes('harnais') && (
        <label className="ed-field">
          Harnachement
          <select value={harnais ?? ''} onChange={(e) => poser({ harnais: e.target.value || undefined })}>
            <option value="">— aucun (bête nue) —</option>
            {harnaisOptions().map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </label>
      )}
      {reglages.includes('colors') && <ColorPalettePickers colors={colors} onColors={(p) => poser({ colors: p })} slots={MONSTER_COLOR_SLOTS} />}
    </>
  );
}
