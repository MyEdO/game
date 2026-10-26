/**
 * Personnalisation d'un ennemi de rencontre référencé au BESTIAIRE (volet spawn de l'Inspector) :
 *  - aperçu du PROFIL (caractéristiques + traits fixes) — l'auteur voit ce qu'il pose ;
 *  - Traits FACULTATIFS (LDB 76 l.45 : « Traits de créature courants que vous pouvez ajouter si
 *    vous créez votre propre version ») + Traits STANDARD (LDB 76 l.31-33 : « ajoutés à la liste
 *    Facultative de toutes les créatures ») — chaque trait choisi reste une chaîne ÉDITABLE
 *    (l'auteur complète l'Indice/la Cible : « Armure 2 », « Haine (Sigmarites) ») ;
 *  - sorts connus (la donnée bestiaire n'en liste pas — choix d'auteur, datalist sur spells.json).
 */
import { CreatureData, charAbr, memoParVersion, traits } from '../../data';
import { CHAR_KEYS, type CharKey } from '../../engine/types';
import { traitLabels, formatTrait, optionalLabel } from '../../engine/traits/dispatch';
import { parseTraitInstance } from './refFormatLivre';
import { isOptionalNote, type OptionalEntry } from '../../engine/statEntry';
import { RefField } from '../compendium/refField/RefField';

/** Traits Standard de créature (LDB 76 l.28-31) — « ajoutés à la liste Facultative de TOUTES les
 *  créatures » : dérivés de la DONNÉE (`traits.json`, drapeau `standard`), pas d'une liste en dur. */
const traitsStandard = memoParVersion('traits', () => traits.filter((t) => t.standard).map((t) => t.label));

/** Aperçu lecture seule du profil du bestiaire : ligne de caractéristiques (« – » = inexistante,
 *  Schéma des Profils LDB 76) + traits fixes. */
export function CreatureProfile({ creature }: { creature: CreatureData }) {
  const cols: (CharKey | 'M' | 'B')[] = ['M', ...CHAR_KEYS, 'B'];
  return (
    <div className="creature-profile">
      <table>
        <thead>
          <tr>{cols.map((k) => <th key={k}>{k === 'M' || k === 'B' ? k : charAbr(k)}</th>)}</tr>
        </thead>
        <tbody>
          <tr>
            {cols.map((k) => {
              const v = creature.char[k];
              return <td key={k}>{typeof v === 'number' ? v : '–'}</td>;
            })}
          </tr>
        </tbody>
      </table>
      <div className="creature-profile-traits">
        <b>Traits :</b> {traitLabels(creature.traits).join(', ') || '—'}
      </div>
    </div>
  );
}

export function OptionalTraitsPicker({
  creature,
  value,
  onChange,
}: {
  creature: CreatureData;
  value: OptionalEntry[] | undefined;
  onChange: (v: OptionalEntry[] | undefined) => void;
}) {
  const chosen = value ?? [];
  const set = (next: OptionalEntry[]) => onChange(next.length ? next : undefined);
  // OFFRABLES du bestiaire : les optionnels de la créature SAUF le joker « tous les traits » (une note
  // qui n'est PAS posable — juste une indication). Les Traits ORDINAIRES restent éditables en chaîne
  // (l'auteur complète l'Indice/la Cible) ; une variante « swap » est posée telle quelle (note VERBATIM).
  const offerable = (creature.optionals ?? []).filter((o) => !(isOptionalNote(o) && o.note === 'all-traits'));
  const allTraits = (creature.optionals ?? []).some((o) => isOptionalNote(o) && o.note === 'all-traits');
  const addOffer = (idx: number) => set([...chosen, offerable[idx]]);
  const addStandard = (label: string) => set([...chosen, parseTraitInstance(label)]);
  return (
    <div className="ed-field">
      Traits facultatifs (LDB 76) — éditez la chaîne pour compléter l'Indice/la Cible
      {chosen.map((t, i) => (
        <div key={i} className="trait-row">
          {isOptionalNote(t) ? (
            // Note composée (variante « swap » / joker) : texte source VERBATIM, non éditable en chaîne.
            <span className="chip">{optionalLabel(t)}</span>
          ) : (
            <input value={formatTrait(t)} onChange={(e) => set(chosen.map((x, j) => (j === i ? parseTraitInstance(e.target.value) : x)))} />
          )}
          <button className="btn small danger" title="Retirer ce trait facultatif" onClick={() => set(chosen.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
      <select
        value=""
        onChange={(e) => {
          if (!e.target.value) return;
          const [kind, rest] = [e.target.value.slice(0, 4), e.target.value.slice(4)];
          if (kind === 'opt:') addOffer(Number(rest));
          else addStandard(rest);
        }}
      >
        <option value="">+ Ajouter un trait facultatif…</option>
        {offerable.length > 0 && (
          <optgroup label={`Facultatifs de ${creature.label}`}>
            {offerable.map((o, i) => (
              <option key={i} value={`opt:${i}`}>{optionalLabel(o)}</option>
            ))}
          </optgroup>
        )}
        <optgroup label="Traits standard (LDB 76 : toutes créatures)">
          {traitsStandard().map((o) => (
            <option key={o} value={`std:${o}`}>{o}</option>
          ))}
        </optgroup>
      </select>
      {allTraits && (
        <span className="hint">
          Facultatif « Tous les traits » ({creature.label}) : n'importe quel Trait peut être saisi ci-dessus.
        </span>
      )}
    </div>
  );
}

/** Sorts connus d'un ennemi (IDS de spells.json) — l'IA incante les Projectiles magiques connus
 *  (combatFlow). Le contrat externe reste `string[]` d'ids (multilangue) ; adapté aux `RefEntry[]`
 *  de `RefField` (mode `liste`, `ds: 'spells'`) à la frontière. Partagé : spawn `ref` (Inspector) et
 *  statbloc. */
export function SpellsField({ value, onChange }: { value: string[] | undefined; onChange: (v: string[] | undefined) => void }) {
  const list = (value ?? []).map((id) => ({ id }));
  return (
    <RefField
      cfg={{ ds: 'spells' }}
      fieldKey="Sorts connus (LDB 76 — l'IA lance les Projectiles magiques connus)"
      value={list}
      onChange={(v) => {
        const ids = (v as { id: string }[]).map((r) => r.id);
        onChange(ids.length ? ids : undefined);
      }}
    />
  );
}
