import type { Status } from '../../engine/money';
import { statutSchema } from '../../data/schemas/grammaire/valeurs';
import { optionsDuNoeud } from '../../data/schemas/grammaire/meta';
import { NumberField } from '../NumberField';

/**
 * Saisie d'un Statut (`statutSchema`) : choix d'Échelon puis Standing, écrits en ids. `facultatif` offre
 * « aucun », qui retire le Statut. LDB 08 l.9
 */
export function ChampDeStatut({ value, onChange, echelon, standing, facultatif = false }: {
  value: Status | undefined;
  onChange: (statut: Status | undefined) => void;
  /** Noms accessibles des deux saisies. */
  echelon: string;
  standing: string;
  facultatif?: boolean;
}) {
  const poser = (tier: string, valeur: number) => {
    const lu = statutSchema.safeParse({ tier, standing: valeur });
    onChange(lu.success ? lu.data : undefined);
  };
  return (
    <>
      <select aria-label={echelon} value={value?.tier ?? ''} onChange={(e) => poser(e.target.value, value?.standing ?? 1)}>
        {facultatif && <option value="">aucun</option>}
        {optionsDuNoeud(statutSchema.shape.tier).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      {value && <NumberField variant="nu" label={standing} min={0} value={value.standing} onChange={(n) => poser(value.tier, n)} />}
    </>
  );
}
