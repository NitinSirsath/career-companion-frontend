import { Link } from '@tanstack/react-router';
import { Idea, MachineLearningModel } from '@carbon/icons-react';
import type { DashboardResponse } from '../../contracts/dashboard';
import { tipWords } from '../../lib/dashboardTips';
import { mailDateTime } from '../../lib/mails';

/** Where "See them" goes: the gone-quiet card on this page. */
export const GONE_QUIET_ID = 'gone-quiet';

/**
 * Up to three tips from fixed rules and one from the AI, only when true (owner, 27 Oct 2026).
 * The AI tip is flat, with the AI icon and the model's name in words: no glow, no logo.
 */
export function Tips({
  tips,
  aiTip,
}: {
  tips: DashboardResponse['tips'];
  aiTip: DashboardResponse['aiTip'];
}) {
  if (!tips.length && !aiTip) return null;
  return (
    <ul className="border border-border-subtle" aria-label="Tips">
      {tips.map((tip) => {
        const words = tipWords(tip);
        return (
          <li
            key={tip.kind}
            className="flex items-start gap-3 border-b border-border-subtle px-4 py-3 last:border-b-0 md:px-5 md:py-3.5"
          >
            <Idea size={16} className="mt-0.5 shrink-0 text-text-secondary" aria-hidden />
            <p className="text-sm">
              {words.text}{' '}
              {words.link?.to === 'GONE_QUIET' && (
                <a href={`#${GONE_QUIET_ID}`} className="text-link hover:underline">
                  {words.link.label}
                </a>
              )}
              {words.link?.to === 'MAILS_NEEDS_ACTION' && (
                <Link
                  to="/mails"
                  search={{ request: 'open' }}
                  className="text-link hover:underline"
                >
                  {words.link.label}
                </Link>
              )}
            </p>
          </li>
        );
      })}
      {aiTip && (
        <li className="flex items-start gap-3 px-4 py-3 md:px-5 md:py-3.5">
          <MachineLearningModel
            size={16}
            className="mt-0.5 shrink-0 text-text-secondary"
            aria-hidden
          />
          <div className="text-sm">
            <p>{aiTip.text}</p>
            <p className="mt-1 text-xs text-text-secondary">
              AI tip by {aiTip.modelName}, from your numbers only · {mailDateTime(aiTip.createdAt)}
            </p>
          </div>
        </li>
      )}
    </ul>
  );
}
