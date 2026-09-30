/**
 * Champ d'édition JSON brut PARTAGÉ — repli universel pour toute donnée sans éditeur dédié (params
 * d'op mécanique sans formulaire, champ json inféré du Compendium…). Parse à la volée : un JSON
 * invalide est marqué en rouge (`de-invalid`) ET n'écrase PAS la valeur (onChange n'est appelé qu'au
 * parse réussi) → AUCUNE perte tant que la frappe est incomplète. Source UNIQUE (CodexEdit le réutilise).
 */
import { useState } from 'react';

export function JsonField({ label, value, onChange, rows = 4 }: {
  label: string;
  value: unknown;
  onChange: (v: unknown) => void;
  rows?: number;
}) {
  const [raw, setRaw] = useState(() => JSON.stringify(value ?? null, null, 2));
  const [err, setErr] = useState(false);
  return (
    <label className="ed-field">
      <span>{label} <em className="ed-hint">(JSON)</em></span>
      <textarea
        rows={rows}
        className={err ? 'de-invalid' : ''}
        value={raw}
        onChange={(e) => {
          setRaw(e.target.value);
          try { onChange(JSON.parse(e.target.value)); setErr(false); } catch { setErr(true); }
        }}
      />
    </label>
  );
}
