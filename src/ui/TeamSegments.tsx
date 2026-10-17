import { Prose, type AnnotationProse } from './Prose';

export type TeamSegment = AnnotationProse;

export function TeamSegments({ segments }: { segments: readonly TeamSegment[] }) {
  return <Prose md={segments.map(s => s.text).join('')} annotations={segments} compact />;
}
