/**
 * Champ de PROSE VERBATIM (règle stricte 5) : un texte de source en Markdown, souvent de plusieurs
 * paragraphes (lettre, pitch, prose de stade), se saisit dans une zone à sa mesure — jamais un
 * `<textarea>` nu de deux lignes. Libellé au-dessus (`.ed-field`), zone `.prose-field`.
 */
export function ProseField({ label, value, onChange, nu }: {
  label: string;
  value: string;
  onChange: (texte: string) => void;
  /** Zone seule, `label` en nom accessible : le site nomme déjà la prose par un contrôle voisin
   *  (même contrat que `RefField nu` / `NumberField variant="nu"`). */
  nu?: boolean;
}) {
  const zone = (
    <textarea className="prose-field" aria-label={nu ? label : undefined} value={value} onChange={(e) => onChange(e.target.value)} />
  );
  if (nu) return zone;
  return (
    <label className="ed-field">
      <span>{label}</span>
      {zone}
    </label>
  );
}
