/**
 * Briques d'APPARENCE (#1897) : un seul contrat `({ appearance, onChange(next), reglages })`. `reglages`
 * est la liste des réglages rendus, en donnée ; toute écriture passe par `apparenceSuivante`. Styles :
 * `styles/reglages-apparence.css`.
 */
import { armesChoisissables, findTrappingById, findCreatureById, findSpeciesById, speciesSingular } from '../../data';
import { idsDe } from '../../data/schemas/grammaire/ref';
import type { EntityAppearance } from '../../engine/authoringAppearance';
import { sexeSchema } from '../../data/schemas/grammaire/valeurs';
import { libelleDeValeur } from '../../data/schemas/grammaire/meta';
import type { Weapon } from '../../engine/types';
import type { TrappingResolver } from '../../engine/items';
import { apparencesAdmissiblesDObjet, candidatsDApparenceDObjet, referenceDApparenceDObjet } from '../../data/apparencesObjets';
import { MediaSelect } from '../MediaSelect';
import { useVersionDesDatasets } from '../useVersionDesDatasets';

/** Apparence après `patch` : une clé posée à `undefined` est RETIRÉE (la donnée d'auteur ne garde aucune clé vide). */
export function apparenceSuivante<T extends object>(a: T, patch: Partial<T>): T {
  const next = { ...a } as Record<string, unknown>;
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete next[k];
    else next[k] = v;
  }
  return next as T;
}

/** #2948 */
export function ApparencesObjetsField({ appearance, onChange, weapons, resolveTrapping = findTrappingById }: {
  appearance: EntityAppearance;
  onChange: (next: EntityAppearance) => void;
  weapons: readonly Pick<Weapon, 'trappingId'>[];
  resolveTrapping?: TrappingResolver;
}) {
  useVersionDesDatasets();
  const ids = [...new Set(weapons.flatMap((w) => w.trappingId ? [w.trappingId] : []))];
  const objets = ids.map((id) => ({ id, choices: apparencesAdmissiblesDObjet({ trappingId: id }, resolveTrapping) })).filter((o) => o.choices.length > 1);
  if (!objets.length) return null;
  return <div className="ed-field">
    <span>Apparences d’objets</span>
    {objets.map(({ id, choices }) => <div className="reglage-apparence" key={id}>
      <span>{resolveTrapping(id)?.label ?? id}</span>
      <MediaSelect
        title={`Apparence — ${resolveTrapping(id)?.label ?? id}`}
        triggerClassName="btn"
        value={candidatsDApparenceDObjet(id, appearance.apparencesObjets?.[id]?.id, resolveTrapping)[0]}
        options={choices.map((a) => ({ key: a.id, label: a.label }))}
        onSelect={(choix) => {
          const record = { ...appearance.apparencesObjets };
          const reference = referenceDApparenceDObjet(id, choix, resolveTrapping);
          if (reference) record[id] = reference;
          else delete record[id];
          onChange(apparenceSuivante(appearance, { apparencesObjets: Object.keys(record).length ? record : undefined }));
        }}
      />
    </div>)}
  </div>;
}

/** Réglages de `ReglagesApparence`. */
type ReglageApparence = 'species' | 'sex';

/** Libellé d'AFFICHAGE d'une espèce d'auteur, lu sur son registre (espèce jouable, puis bestiaire) ; l'id nu hors registres. */
function libelleDEspece(id: string): string {
  return (findSpeciesById(id) ? speciesSingular(id) : '') || findCreatureById(id)?.label || id;
}

/** Groupes d'espèces PROPOSÉS, lus sur les registres (`species.json`, `creatures.json`) ; lecteur de règle :
 *  `bodyShapeForSpecies` (`engine/bodyForm.ts`). */
function groupesDEspece(): { libelle: string; ids: string[] }[] {
  const trie = (ids: Iterable<string>) => [...ids].sort((a, b) => libelleDEspece(a).localeCompare(libelleDEspece(b), 'fr'));
  return [{ libelle: 'Espèces jouables', ids: trie(idsDe('species')) }, { libelle: 'Bestiaire', ids: trie(idsDe('creature')) }];
}

/** Réglages d'apparence SANS titre de rubrique : l'hôte les range sous SON titre « Apparence ». */
export function ReglagesApparence<T extends EntityAppearance>({
  appearance,
  onChange,
  reglages,
}: {
  appearance: T;
  onChange: (next: T) => void;
  reglages: readonly ReglageApparence[];
}) {
  const poser = (patch: Partial<EntityAppearance>) => onChange(apparenceSuivante<EntityAppearance>(appearance, patch) as T);
  const { species, sex } = appearance;
  const groupes = groupesDEspece();
  const horsRegistres = species != null && !groupes.some((g) => g.ids.includes(species));
  return (
    <>
      {reglages.includes('species') && (
        <label className="reglage-apparence">
          Espèce
          <select value={species ?? ''} onChange={(e) => poser({ species: e.target.value || undefined })}>
            <option value="">— selon le profil —</option>
            {horsRegistres && <option value={species}>{`${species} (hors registre)`}</option>}
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
            {sex == null && <option value="" disabled>— non précisé —</option>}
            {sexeSchema.options.map((s) => <option key={s} value={s}>{libelleDeValeur(sexeSchema, s)}</option>)}
          </select>
        </label>
      )}
    </>
  );
}

/** Arme équipée d'une entité de scène (`SceneEntity.weapon`, un `trappingId`). */
export function ArmeEquipeeField({ weapon, onWeapon }: { weapon?: string; onWeapon: (w: string | undefined) => void }) {
  return (
    <label className="ed-field">
      Arme équipée
      <select value={weapon ?? ''} onChange={(e) => onWeapon(e.target.value || undefined)}>
        <option value="">— aucune —</option>
        {armesChoisissables().map((w) => (
          <option key={w.id} value={w.id}>{w.label}</option>
        ))}
      </select>
    </label>
  );
}
