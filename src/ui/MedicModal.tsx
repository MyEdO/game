import { Fragment, type ReactNode } from 'react';
import { useGame } from '../state/store';
import { flowStakeRef, skillRefLabel } from '../data';
import { stakeRuleOf } from './StakeNote';
import { CodexRef } from './compendium/CodexRef';
import { Modal } from './Modal';
import { OptionChooser } from './OptionChooser';
import { CharFrame } from './CharFrame';
import { TeamPortrait } from './TeamPortrait';
import { Coins } from './Coins';
import { DrBar } from './DrBar';
import { useHealJetProps } from './jetProps/useHealJetProps';
import { EmbeddedShell, useRollShell } from './RollShell';
import { isHealable, lodgedAmmoCount, type HealMode } from '../engine/healing';
import { hasTreatableTrauma, hasSurgeryTrauma, surgeryTraumas, recoverableTraumas, hasLimbAwaitingAid } from '../engine/trauma';
import { bestHealerFor, HEAL_STAKE } from '../state/medicFlow';
import { partyMoneyTotal } from '../state/bourseFlow';
import { toMoney } from '../engine/money';
import type { Combatant } from '../engine/types';
import { Icon } from './Icon';
import { VsHeader } from './VsHeader';
import { HEAL_ACT } from './healSubtitle';
import { GatedAction } from './GatedAction';
import { useSurgeryJetProps } from './jetProps/useSurgeryJetProps';

const ACT_META: Record<HealMode, { icon: ReactNode; label: string }> = {
  wounds: { icon: <Icon id="journal/heal" size="sm" />, label: 'Soigner les Blessures' },
  bleed: { icon: <Icon id="condition/bleeding" size="sm" />, label: 'Arrêter l’Hémorragie' },
  trauma: { icon: <Icon id="medical/tear" size="sm" />, label: 'Soigner la déchirure' },
  surgery: { icon: <Icon id="medical/scalpel" size="sm" />, label: 'Opérer' },
  recovery: { icon: <Icon id="medical/crutch" size="sm" />, label: 'Rééduquer un membre' },
  ammo: { icon: <Icon id="item/ammo" size="sm" />, label: 'Retirer une munition' },
};

/** Pourquoi un acte est grisé — affiché en title (info de décision, pas de texte tuto). */
function actBlockReason(patient: Combatant, act: HealMode, hasSurgeon: boolean): string | null {
  switch (act) {
    case 'wounds':
      if (patient.wounds.current >= patient.wounds.max) return 'Blessures au maximum';
      if (patient.soinRencontreUtilise) return 'A déjà reçu son soin de Blessures (une fois par rencontre)'; // LDB 09 l.233
      return null;
    case 'bleed':
      return (patient.conditions ?? []).some((c) => c.id === 'hemorragique' && c.value > 0) ? null : 'Aucune Hémorragie';
    case 'trauma':
      return hasTreatableTrauma(patient) ? null : 'Aucune déchirure à traiter';
    case 'surgery':
      if (!hasSurgeryTrauma(patient)) return 'Aucune blessure ne relève de la chirurgie';
      if (!hasSurgeon) return 'Aucun soigneur avec le Talent Chirurgie'; // prérequis LDB 10
      return null;
    case 'recovery':
      if (recoverableTraumas(patient).length) return null;
      if (hasLimbAwaitingAid(patient)) return 'Aide Médicale requise d’abord'; // LDB 18 l.120/179 : « Après application de cette Aide… »
      return 'Aucun membre désactivé à rééduquer';
    case 'ammo':
      return lodgedAmmoCount(patient) > 0 ? null : 'Aucune munition logée';
  }
}


/**
 * INFIRMERIE — modale de soins PERSISTANTE (hors combat) : bandeau patients (tuiles full, la jauge
 * et les pastilles d'États SONT le diagnostic) → dossier du patient (actes : Guérison / Hémorragie /
 * Déchirure / Chirurgie, tarifés chez un PNJ `medicalAid`) → zone de jet embarquée (`useHealJetProps`,
 * `useSurgeryJetProps`), dont la boîte des soins pose les gestes dans SON pied (`useRollShell`).
 * Elle ne se ferme pas après un jet : on enchaîne actes et patients. Le pied porte la sortie de
 * l'état courant (`docs/charte-ui.md`, `.cadre-pied`) : « Terminer » au repos, les gestes du jet
 * posé (Échap annule le jet, jamais l'opération), « Arrêter l'opération » pendant une opération armée,
 * en `.danger` dès qu'une passe a abouti (LDB 10 l.184). La CHIRURGIE est « armée » : DrBar +
 * passes, et Bander/Hémorragie restent des actes normaux du même patient entre deux passes.
 */
export function MedicModal() {
  const medic = useGame((s) => s.medic);
  const ph = useGame((s) => s.pendingHeal);
  const ps = useGame((s) => s.pendingSurgery);
  const party = useGame((s) => s.party);
  const money = partyMoneyTotal(useGame.getState); // somme des bourses (le groupe est abonné via `party`)
  const selectPatient = useGame((s) => s.medicSelectPatient);
  const act = useGame((s) => s.medicAct);
  const setWound = useGame((s) => s.medicSetWound);
  const openPass = useGame((s) => s.openSurgeryPass);
  const cancelSurgery = useGame((s) => s.surgeryCancel);
  const close = useGame((s) => s.closeMedic);
  const soin = useHealJetProps({ embedded: true });
  const passe = useSurgeryJetProps();
  const jet = useRollShell(soin ?? passe);
  if (!medic) return null;
  const patient = party.find((c) => c.id === medic.patientId) ?? null;
  const sg = medic.surgery;
  const busy = !!ph || !!sg || !!ps; // jet posé ou opération en cours : patients verrouillés, pas de sortie
  const npc = medic.npc;
  const paid = npc?.acts.some((a) => a.cost);
  const hasSurgeon = npc ? true : !!bestHealerFor(party, 'surgery');

  // Les actes proposés : ceux du PNJ (tarifés) ou les 4 actes du groupe — grisés avec leur raison.
  const offers: { act: HealMode; cost?: { gold?: number; silver?: number; brass?: number } }[] =
    npc ? npc.acts : (['wounds', 'bleed', 'ammo', 'trauma', 'surgery', 'recovery'] as HealMode[]).map((a) => ({ act: a }));

  // PIED de la fenêtre (`docs/charte-ui.md`, `.cadre-pied`) : les gestes du jet posé ; ceux d'une
  // opération armée ; sinon, la sortie.
  const footer = jet ? jet.gestes : sg ? (
    <>
      <button className={sg.last ? 'btn btn-ghost danger' : 'btn btn-ghost'} onClick={cancelSurgery} title={sg.last ? 'Le cumul de DR est perdu' : 'Renoncer (acte remboursé)'}>
        {sg.kind === 'recovery' ? 'Arrêter la rééducation' : 'Arrêter l’opération'}
      </button>
      <button className="btn btn-primary" onClick={openPass}><Icon id={HEAL_ACT[sg.kind].icon} size="sm" /> {sg.kind === 'recovery' ? 'Rééduquer (une passe)' : 'Opérer (une passe)'}</button>
    </>
  ) : (
    <button className="btn" onClick={close}>Terminer</button>
  );

  return (
    <Modal title={npc ? <><Icon id="journal/heal" size="sm" /> Soins — {npc.label}</> : <><Icon id="journal/heal" size="sm" /> Soins</>} onClose={jet ? jet.escClose : busy ? undefined : close} footer={footer} etape={`${medic.patientId ?? ''}:${sg?.kind ?? ''}`}>
      {paid && <span className="medic-purse hint">Bourse <Coins money={money} ton="discret" /></span>}

      {/* Bandeau PATIENTS : tuile full (jauge + États = le diagnostic), sélection or. */}
      <div className="medic-patients">
        {party.map((h) => (
          <CharFrame
            key={h.id}
            c={h}
            variant="full"
            size="md"
            selected={h.id === medic.patientId}
            onClick={!busy && isHealable(h) ? () => selectPatient(h.id) : undefined}
            nom={isHealable(h) ? h.label : `${h.label} — rien à soigner`}
          />
        ))}
      </div>

      {/* Zone de JET : exclusive tant que le jet posé n'est pas résolu. */}
      {soin && jet && <EmbeddedShell title={jet.titre} etape={jet.etape}>{jet.corps}</EmbeddedShell>}

      {/* DOSSIER du patient : les actes (l'opération en cours s'affiche au-dessus des actes). Pendant
          un jet de soin, il reste MONTÉ, masqué et `inert` : l'acte qui a posé le jet est l'invocateur
          auquel le jet rend le focus (`EmbeddedShell`). */}
      {patient && (
        <div className="medic-dossier" hidden={!!ph} inert={!!ph}>
          {sg && (() => {
            const recovery = sg.kind === 'recovery';
            const pool = recovery ? recoverableTraumas(patient) : surgeryTraumas(patient);
            const acte = HEAL_ACT[sg.kind];
            // Le chirurgien n'est un `Combatant` que s'il est du GROUPE : un PNJ tarifé (`healerId`
            // sentinelle, `medicFlow.medicAct`) n'a ni portrait ni fiche — son nom EST le titre de la
            // fenêtre (« Soins — <PNJ> »). Sans acteur, `VsHeader` n'a pas d'A→B à rendre (il tairait
            // aussi son `label`) : l'acte et le patient se disent alors en note.
            const surgeon = sg.healerId ? party.find((c) => c.id === sg.healerId) : undefined;
            return (
            <div className="medic-surgery">
              {/* L'A→B de l'opération est la PRIMITIVE d'opposition (`VsHeader`) : soigneur → patient.
                  La Difficulté vit sur la LIGNE du jet (`pending.difficulty`, #1072) et le DR à cumuler
                  sur la `DrBar` ci-dessous : ni l'une ni l'autre ne se réécrit ici. */}
              {surgeon ? (
                <VsHeader
                  actor={surgeon}
                  target={patient}
                  label={acte.label}
                  verb={acte.icon}
                  targetVariant="full"
                />
              ) : (
                <p className="rm-note">{acte.label} — {patient.label}</p>
              )}
              {!sg.last && pool.length > 1 && (
                <OptionChooser
                  layout="grid"
                  idPrefix="medic-plaie"
                  options={pool.map((t, i) => ({ key: String(i), label: `${t.label} (${t.location})`, selected: i === sg.traumaIdx, onSelect: () => setWound(i) }))}
                />
              )}
              {/* EXCEPTION nommée au site unique `RollRow.extendedDr` (arbitrage user 2026-07-11, verrou
                  `travel-carto.test.ts`) : cet état d'OPÉRATION ARMÉE est visible AVANT/ENTRE les passes,
                  hors de toute rangée de jet (`useSurgeryJetProps` n'a pas de rangée tant qu'aucune passe n'est
                  ouverte) — ce n'est pas la barre d'UN jet mais le cumul PERSISTANT de l'opération. */}
              <DrBar cum={sg.cumDR} target={sg.targetDR} />
              {sg.last && <p className="rm-note">Dernière passe : {sg.last.sl >= 0 ? '+' : ''}{sg.last.sl} DR</p>}
              {/* coût RAW d'une passe de Chirurgie : LDB 10 l.184 (la rééducation Guérison n'inflige rien). */}
              <p className="rm-note">{recovery ? 'Test étendu de Guérison — récupération de l’usage du membre.' : 'Chaque passe inflige 1d10 PB + 1 Hémorragie. À 0 PB, l’opération s’interrompt.'}</p>
              {/* La passe est un jet INFLUENÇABLE (zone embarquée, pied de la fenêtre) ; avant le 1er jet, le pied de la
                  fenêtre porte l'armement et le renoncement. */}
              {!soin && jet && <EmbeddedShell title={jet.titre} etape={jet.etape}>{jet.corps}</EmbeddedShell>}
            </div>
            );
          })()}
          <div className="medic-acts">
            {offers.map(({ act: a, cost }) => {
              if (sg && (a === 'surgery' || a === 'trauma' || a === 'recovery')) return null; // pendant l'op : Bander/Hémorragie seulement
              const reason = actBlockReason(patient, a, hasSurgeon);
              const healer = npc ? undefined : bestHealerFor(party, a)?.actor;
              const meta = ACT_META[a];
              const stacks = a === 'bleed' ? (patient.conditions ?? []).find((c) => c.id === 'hemorragique')?.value ?? 0
                : a === 'ammo' ? lodgedAmmoCount(patient) : 0;
              // L'acte est SA propre porte de règle (#1078) : le bouton s'englobe dans `CodexRef wrap`,
              // dont la cible est le FOYER de l'enjeu de CE jet (`HEAL_STAKE`) et l'`instance` le nom de
              // l'acte. Un acte qui ARME une opération (`surgery`/`recovery`) n'a pas de cible au Codex avant
              // l'armement, où naît la valeur de son enjeu (`targetDR`, `medicAct`) : le même `CodexRef`
              // reste monté, `category`/`id` absents, et ne s'ouvre que s'il a quelque chose à dire — la
              // raison d'un refus (`refus`), sinon rien.
              const stake = a === 'surgery' || a === 'recovery' ? undefined : flowStakeRef(HEAL_STAKE[a]);
              const rule = stake ? stakeRuleOf(stake) : undefined;
              // La raison d'un refus ne peut PAS naître d'un second `CodexRef` imbriqué dans celui de
              // la porte de règle (une seule infobulle par ancrage) : elle passe par `refus` de CE
              // popover, et l'action prend la forme `reasonId` — sans conteneur ni doublon.
              const raison = reason ?? (!npc && !healer ? 'Aucun soigneur (Compétence Guérison) dans le groupe.' : undefined);
              const rid = `medic-act-${a}`;
              const bouton = (
                <GatedAction
                  id={rid}
                  reasonId={rid}
                  label={<>
                    {meta.icon} {meta.label}
                    {(a === 'bleed' || a === 'ammo') && stacks > 0 ? ` ×${stacks}` : ''}
                    {cost && <span className="medic-price"><Coins money={toMoney(cost)} /></span>}
                    {healer && <TeamPortrait combatant={healer} size={20} />}
                  </>}
                  ariaLabel={meta.label}
                  descOfferte={npc ? `${npc.label} (${skillRefLabel(npc.skill)})` : healer ? `Soigné par ${healer.label}` : undefined}
                  enabled={!raison}
                  onClick={() => act(a)}
                  primary={false}
                  btnClassName="medic-act"
                />
              );
              return (
                <Fragment key={a}>
                  <CodexRef category={rule?.category} id={rule?.id} label={meta.label} instance={meta.label} refus={raison} wrap>{bouton}</CodexRef>
                  {raison && <p className="hors-ecran" id={rid}>{raison}</p>}
                </Fragment>
              );
            })}
          </div>
        </div>
      )}

    </Modal>
  );
}
