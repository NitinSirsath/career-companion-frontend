import { format } from 'date-fns';
import { TopBarActions } from '../layout/Breadcrumb';
import { GlassCapsule } from '../phone/GlassButton';
import { PhoneRefresh } from '../phone/PhoneRefresh';
import { PhoneTitle } from '../phone/PhoneTitle';

/**
 * The top of Today on phones (owner, 18 Nov 2026, mock `PHONE-LINEAR-mock/` screen 7): the big
 * title "Today", the date under it, and refresh as one glass circle.
 */
export function PhoneDashboardTop({ now = new Date() }: { now?: Date }) {
  return (
    <div className="flex flex-col gap-[3px] px-0.5 pt-0.5">
      <TopBarActions>
        <GlassCapsule label="Today tools">
          <PhoneRefresh />
        </GlassCapsule>
      </TopBarActions>
      <PhoneTitle>Today</PhoneTitle>
      <p className="text-phone-sub text-text-secondary">{format(now, 'EEEE, MMM d')}</p>
    </div>
  );
}
