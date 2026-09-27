/**
 * Éditeur RÉUTILISABLE d'une liste de `PsychTrait` (traits psychologiques conférés — Frénésie d'une
 * mutation, Animosité(Elfes), Phobie(Serpents)…). Édite les vrais `PsychTrait` ({type, cible?, indice?}).
 * Source UNIQUE des libellés de type psy (cf. `PsychType`).
 */
import { estCibleType, type PsychTrait, type PsychType } from '../../engine/psychology';
import { memoParVersion, psychologies, psychologyLabel } from '../../data';
import { NumberField } from '../NumberField';
import { AjoutRangee } from '../AjoutRangee';

// Types conférables = ceux de `psychology.json` (exclut `trauma`, marqueur INTERNE) ; libellés/ciblage
// DÉRIVÉS de la donnée (source UNIQUE, jamais une map ni un Set codés en dur).
const typesPsy = memoParVersion('psychologies', (): PsychType[] => psychologies.map((p) => p.id as PsychType));
/** Types À INDICE (Peur 2…) — pour n'afficher le champ Indice que quand il est utile. */
const INDEXED = new Set<PsychType>(['peur', 'terreur', 'phobie']);

export function PsychTraitsField({ value, onChange }: { value: PsychTrait[] | undefined; onChange: (v: PsychTrait[] | undefined) => void }) {
  const list = value ?? [];
  const set = (next: PsychTrait[]) => onChange(next.length ? next : undefined);
  const upd = (i: number, p: Partial<PsychTrait>) => set(list.map((t, j) => (j === i ? { ...t, ...p } : t)));
  return (
    <div className="ed-field">
      <span>Traits psychologiques conférés (Frénésie, Animosité, Phobie…)</span>
      {list.map((t, i) => (
        <div className="tf-row" key={i}>
          <select value={t.type} onChange={(e) => upd(i, { type: e.target.value as PsychType })}>
            {typesPsy().map((p) => <option key={p} value={p}>{psychologyLabel(p)}</option>)}
          </select>
          {estCibleType(t.type) && (
            <input placeholder="cible (Elfes, Serpents…)" value={t.cible ?? ''} onChange={(e) => upd(i, { cible: e.target.value || undefined })} />
          )}
          {INDEXED.has(t.type) && (
            <label className="dr">Indice<NumberField variant="nu" label="Indice" min={0} vide value={t.indice} onChange={(n) => upd(i, { indice: n ?? undefined })} /></label>
          )}
          <button className="btn small danger" title="Retirer" onClick={() => set(list.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <AjoutRangee libelle="Trait psy" onAjout={() => set([...list, { type: 'frenesie' }])} />
    </div>
  );
}
