/** Champs ÉDITABLES de background — Motivation + Ambitions court/long terme (LDB 05 l.730-736).
 *  Primitive PARTAGÉE (source UNIQUE des libellés + hints de décision) : le créateur (étape Détails,
 *  liée au brouillon) et la fiche (onglet Background, liée au héros via `ecrireLHistorique`) la
 *  consomment tous deux — plus de markup dupliqué ni de hints qui divergent entre les deux surfaces.
 *  Bâtie sur la primitive de champ canonique `.field` (libellé au-dessus du contrôle). */
export interface BackgroundValues {
  motivation: string;
  ambitionShort: string;
  ambitionLong: string;
}

export function BackgroundFields({
  values,
  onChange,
  disabled,
}: {
  values: BackgroundValues;
  onChange: (patch: Partial<BackgroundValues>) => void;
  disabled?: boolean;
}) {
  return (
    <div className="bg-edit">
      <div className="field">
        <span>
          Motivation <em className="bg-hint">recharge la Détermination</em>
        </span>
        <input
          type="text"
          value={values.motivation}
          disabled={disabled}
          placeholder="Ex. Devoir, Vengeance, Rebelle…"
          onChange={(e) => onChange({ motivation: e.target.value })}
        />
      </div>
      <div className="field">
        <span>
          Ambition à court terme <em className="bg-hint">accomplie : +50 PX</em>
        </span>
        <textarea
          rows={2}
          value={values.ambitionShort}
          disabled={disabled}
          placeholder="Ex. Venger un camarade tombé au combat…"
          onChange={(e) => onChange({ ambitionShort: e.target.value })}
        />
      </div>
      <div className="field">
        <span>
          Ambition à long terme <em className="bg-hint">accomplie : +500 PX</em>
        </span>
        <textarea
          rows={2}
          value={values.ambitionLong}
          disabled={disabled}
          placeholder="Ex. Posséder un relais de diligences…"
          onChange={(e) => onChange({ ambitionLong: e.target.value })}
        />
      </div>
    </div>
  );
}
