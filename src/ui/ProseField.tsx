import { Prose } from './Prose';

/**
 * Champ de PROSE VERBATIM (règle stricte 5) : un texte de source en Markdown, souvent de plusieurs
 * paragraphes (lettre, pitch, prose de stade), se saisit dans une zone à sa mesure — jamais un
 * `<textarea>` nu de deux lignes. Libellé au-dessus (`.ed-field`), zone `.prose-field`, ou prose lue (`lecture`).
 */
export function ProseField({ label, value, onChange, nu, ariaLabel, lecture }: {
  label: string;
  value: string;
  onChange: (texte: string) => void;
  /** Zone seule, `label` en nom accessible : le site nomme déjà la prose par un contrôle voisin
   *  (même contrat que `NumberField variant="nu"`). */
  nu?: boolean;
  /** Nom accessible POSITIONNÉ (« Description de la variante 2 ») quand le libellé visible se répète
   *  d'une rangée à l'autre. */
  ariaLabel?: string;
  /** Texte LU (adresse d'un passage, `descRef`) : la prose rendue à la place de la zone, sous le même
   *  libellé — le champ garde sa place quand le texte redevient saisissable. */
  lecture?: boolean;
}) {
  const zone = lecture ? <Prose md={value} /> : (
    <textarea className="prose-field" aria-label={nu ? label : ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} />
  );
  if (nu) return zone;
  const Champ = lecture ? 'div' : 'label';
  return (
    <Champ className="ed-field">
      <span>{label}</span>
      {zone}
    </Champ>
  );
}
