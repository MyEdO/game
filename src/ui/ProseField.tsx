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
  /** Prose LUE (adresse d'un passage, `descRef`) : rendue à la place de la zone, sous le même
   *  libellé — le champ garde sa place quand le texte redevient saisissable. Prop de markdown du
   *  porteur `ProseField{lecture}` : chaque site qui la passe se déclare dans `SITES_PROSE`
   *  (`src/ui/liage.ts`) ; `value` n'est que la valeur de la zone de saisie. */
  lecture?: string;
}) {
  const lue = lecture !== undefined;
  const zone = lue ? <Prose md={lecture} /> : (
    <textarea className="prose-field" aria-label={nu ? label : ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} />
  );
  if (nu) return zone;
  const Champ = lue ? 'div' : 'label';
  return (
    <Champ className="ed-field">
      <span>{label}</span>
      {zone}
    </Champ>
  );
}
