/**
 * Champ de PROSE VERBATIM (règle stricte 5) : un texte de source en Markdown, souvent de plusieurs
 * paragraphes (lettre, pitch, prose de stade), se saisit dans une zone à sa mesure — jamais un
 * `<textarea>` nu de deux lignes. Libellé au-dessus (`.ed-field`), zone `.prose-field`.
 */
export function ProseField({ label, value, onChange, nu, ariaLabel }: {
  label: string;
  value: string;
  onChange: (texte: string) => void;
  /** Zone seule, `label` en nom accessible : le site nomme déjà la prose par un contrôle voisin
   *  (même contrat que `NumberField variant="nu"`). */
  nu?: boolean;
  /** Nom accessible POSITIONNÉ (« Description de la variante 2 ») quand le libellé visible se répète
   *  d'une rangée à l'autre. */
  ariaLabel?: string;
}) {
  const zone = (
    <textarea className="prose-field" aria-label={nu ? label : ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} />
  );
  if (nu) return zone;
  return (
    <label className="ed-field">
      <span>{label}</span>
      {zone}
    </label>
  );
}
