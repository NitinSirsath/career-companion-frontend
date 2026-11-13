import { TopBarActions } from '../layout/Breadcrumb';
import { GlassCapsule } from '../phone/GlassButton';
import { PhoneRefresh } from '../phone/PhoneRefresh';
import { PhoneTitle } from '../phone/PhoneTitle';

/**
 * The top of the Dashboard on phones (owner, 13 Nov 2026, approved mock `IOS-LOOK-mock/`): the big
 * title, the greeting and the day under it, and refresh in the glass capsule.
 */
export function PhoneDashboardTop({ greeting, today }: { greeting: string; today: string }) {
  return (
    <div className="flex flex-col gap-[3px] px-1 pt-0.5 pb-1">
      <TopBarActions>
        <GlassCapsule label="Dashboard tools">
          <PhoneRefresh />
        </GlassCapsule>
      </TopBarActions>
      <PhoneTitle>Dashboard</PhoneTitle>
      <p className="text-[15px] leading-5 text-text-secondary">
        {greeting} · {today}
      </p>
    </div>
  );
}
