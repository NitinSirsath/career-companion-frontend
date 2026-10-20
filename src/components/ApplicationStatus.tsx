import { Tag } from './ui/tag';
import type { ApplicationStatus } from '../contracts/application';
import { statusTag } from '../lib/statusTags';

/** A valid null status is shown as a neutral unknown, never defaulted to Applied. */
export function StatusBadge({ status }: { status: ApplicationStatus | null }) {
  const tag = statusTag(status);
  return <Tag color={tag.color}>{tag.label}</Tag>;
}
