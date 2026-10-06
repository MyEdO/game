/**
 * Champ d'édition JSON brut PARTAGÉ — repli universel pour toute donnée sans éditeur dédié (params
 * d'op mécanique sans formulaire, champ json inféré du Compendium…). Parse à la volée : un JSON
 * invalide n'écrase PAS la valeur (onChange n'est appelé qu'au parse réussi) ; il est marqué
 * `aria-invalid`, dit par son message, et signalé saisie en cours (`useSaisieEnCours`) au porteur
 * d'un geste d'enregistrement. Source UNIQUE (CodexEdit le réutilise).
 */
import { useId, useState } from 'react';
import { useSaisieEnCours } from '../SourceRefField';

export function JsonField({ label, sujet, value, onChange, rows = 4 }: {
  label: string;
  /** POSITION du champ dans son conteneur (« de la rangée 2 de windModifiers ») : complète son nom
   *  accessible, pour que deux champs de même libellé, dans deux rangées, ne se confondent pas. */
  sujet?: string;
  value: unknown;
  onChange: (v: unknown) => void;
  rows?: number;
}) {
  const [raw, setRaw] = useState(() => JSON.stringify(value ?? null, null, 2));
  const [err, setErr] = useState(false);
  useSaisieEnCours(err);
  const messageId = useId();
  return (
    <label className="ed-field">
      <span>{label} <em className="ed-hint">(JSON)</em></span>
      <textarea
        aria-label={sujet ? `${label} ${sujet}` : label}
        aria-invalid={err || undefined}
        aria-describedby={err ? messageId : undefined}
        rows={rows}
        value={raw}
        onChange={(e) => {
          setRaw(e.target.value);
          try { onChange(JSON.parse(e.target.value)); setErr(false); } catch { setErr(true); }
        }}
      />
      {err && <span id={messageId} className="hint" role="status">JSON invalide : cette saisie n'est pas retenue.</span>}
    </label>
  );
}
