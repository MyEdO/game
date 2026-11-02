import { CharFrame } from './CharFrame';
import { Row } from './Layout';
import type { CharVariant } from './PortraitTile';
import type { Combatant } from '../engine/types';

/**
 * Sujet d'une modale : identité nommée et jauge partagées, avec les États sous `variant="full"`.
 */
export function ModalSubject({ c, variant = 'vital' }: { c: Combatant; variant?: CharVariant }) {
  return (
    <Row justify="center" className="modal-subject">
      <CharFrame c={c} variant={variant} size="md" />
    </Row>
  );
}
