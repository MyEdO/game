import { useState } from 'react';
import type { Warning } from '../../state/validateScene';
import { PLAN_DEFECT_FAMILIES, type PlanDefectFamily } from '../../noyau/planDefects';
import { Icon } from '../Icon';
import { ListRow } from '../ListRow';
import { Band } from '../Band';

/**
 * Panneau VALIDATION de l'éditeur : réfs cassées, architecture, ids dupliqués, ET défauts de PLAN
 * (`scope: 'plan'`, la MÊME détection que `npm run map:check`) groupés par famille. Chaque rangée est
 * un bouton — clic → `onSelect(warning)`, l'éditeur emmène l'auteur sur l'étage et l'endroit fautifs.
 *
 * Un validateur ne vaut que sa COUVERTURE : sans défaut, le panneau n'affirme pas « tout va bien », il
 * ÉNUMÈRE ce qu'il a contrôlé — les familles de plan sont itérées depuis `PLAN_DEFECT_FAMILIES`, donc
 * une famille ajoutée demain se déclare toute seule.
 */

/** Rangées montrées d'emblée par famille — au-delà, la répétition se déplie à la demande. Le COMPTE
 *  reste toujours affiché dans l'en-tête de la bande : on cache la répétition, jamais l'ampleur. */
const FAMILY_PREVIEW = 12;

function WarningRow({ w, onSelect }: { w: Warning; onSelect: (w: Warning) => void }) {
  return (
    <ListRow
      onClick={() => onSelect(w)}
      title={w.message}
      label={<><Icon id="ui/warning" size="sm" /> {w.message}</>}
    >
      <span className={`chip${w.level === 'error' ? ' tone-danger' : ''}`}>{w.level === 'error' ? 'erreur' : 'avertissement'}</span>
    </ListRow>
  );
}

function PlanFamilyBand({
  id,
  title,
  rows,
  onSelect,
}: {
  id: PlanDefectFamily;
  title: string;
  rows: Warning[];
  onSelect: (w: Warning) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? rows : rows.slice(0, FAMILY_PREVIEW);
  const rest = rows.length - shown.length;
  return (
    <Band title={title} right={<><span className="chip">{id}</span> <span className="count">{rows.length}</span></>}>
      <div className="ed-validation-rows">
        {shown.map((w, i) => (
          <WarningRow key={`${id}-${i}`} w={w} onSelect={onSelect} />
        ))}
        {rest > 0 && <ListRow onClick={() => setExpanded(true)} label={`Afficher les ${rest} restants`} />}
        {expanded && rows.length > FAMILY_PREVIEW && <ListRow onClick={() => setExpanded(false)} label="Réduire" />}
      </div>
    </Band>
  );
}

/** Sans défaut : le périmètre CONTRÔLÉ, énuméré — la couverture est la seule chose qu'un validateur
 *  puisse affirmer. Les familles de plan viennent du registre, jamais d'une liste recopiée. */
function ValidationScope() {
  return (
    <div className="ed-validation">
      <p className="ed-ok">
        <Icon id="ui/done" size="sm" /> Aucun défaut détecté.
      </p>
      <p className="ed-validation-head">Contrôlé :</p>
      <ul className="ed-validation-scope">
        <li>Réfs de logique (déclencheurs, dialogues, rencontres, entités, carte du monde)</li>
        <li>Architecture (corps, étages, façades, toitures)</li>
        {PLAN_DEFECT_FAMILIES.map((f) => (
          <li key={f.id}>{f.title}</li>
        ))}
      </ul>
    </div>
  );
}

export function ValidationPanel({ warnings, onSelect }: { warnings: Warning[]; onSelect: (w: Warning) => void }) {
  if (!warnings.length) return <ValidationScope />;
  const errs = warnings.filter((w) => w.level === 'error').length;
  const plan = warnings.filter((w) => w.scope === 'plan' && w.plan);
  // Complément EXACT de `plan` : un avertissement de plan SANS endroit exploitable n'appartient à
  // aucune bande de famille — il rejoint la liste générale plutôt que de disparaître du panneau tout
  // en étant compté dans l'en-tête.
  const others = warnings.filter((w) => w.scope !== 'plan' || !w.plan);
  return (
    <div className="ed-validation">
      <div className="ed-validation-head">
        {errs} erreur(s), {warnings.length - errs} avertissement(s) — dont {plan.length} défaut(s) de plan
      </div>
      {others.length > 0 && (
        <div className="ed-validation-rows">
          {others.map((w, i) => (
            <WarningRow key={`o-${i}`} w={w} onSelect={onSelect} />
          ))}
        </div>
      )}
      {PLAN_DEFECT_FAMILIES.map((f) => {
        const rows = plan.filter((w) => w.plan!.family === f.id);
        return rows.length ? <PlanFamilyBand key={f.id} id={f.id} title={f.title} rows={rows} onSelect={onSelect} /> : null;
      })}
    </div>
  );
}
