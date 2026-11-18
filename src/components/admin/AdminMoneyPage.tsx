import { Navigate } from '@tanstack/react-router';
import { useAdminOverview, useFreeAIMoney } from '../../api/admin';
import { usePhoneNav } from '../phone/phoneNav';
import { usd } from '../../lib/admin';
import { PlainRow, PlainSection } from '../phone/PlainList';
import { PhoneTitle } from '../phone/PhoneTitle';
import { SectionError } from '../ui/section-error';
import { SkeletonList } from '../ui/skeleton';
import { CallsChart } from './AdminPage';

/** Today, this month and what is left, as plain rows. */
function MoneyRows() {
  const money = useFreeAIMoney();
  const data = money.data;
  if (money.isLoading) return <SkeletonList rows={2} label="Checking OpenRouter" />;
  if (!data || data.state === 'UNAVAILABLE')
    return <SectionError title="Could not check OpenRouter" onRetry={() => void money.refetch()} />;
  if (data.state === 'NO_KEY') return <PlainRow>The free AI key is not set.</PlainRow>;
  return (
    <>
      <PlainRow value={usd(data.todayUsd)}>Today</PlainRow>
      <PlainRow value={usd(data.monthUsd)}>This month</PlainRow>
      {data.leftUsd !== null && data.limitUsd !== null && (
        <PlainRow value={`${usd(data.leftUsd)} of ${usd(data.limitUsd)}`}>Left</PlainRow>
      )}
    </>
  );
}

/**
 * Free AI money, on phones (Admin › Free AI money): what the free AI cost on OpenRouter, and AI
 * calls per day for all accounts. On laptops both sit on the Admin page itself.
 */
export function AdminMoneyPage() {
  const overview = useAdminOverview();
  return (
    <div className="flex flex-col">
      <PhoneTitle size="bar">Free AI money</PhoneTitle>
      <PlainSection label="Free AI on OpenRouter" className="mt-3">
        <MoneyRows />
      </PlainSection>
      <PlainSection
        label="AI calls per day"
        note="All accounts, last 14 days. Today's bar is lighter: the day is not over. Days are UTC days, like the AI daily limits."
      >
        {overview.isLoading && <SkeletonList rows={1} label="Loading AI use" />}
        {overview.error && <SectionError title="Could not load AI use" />}
        {overview.data && <CallsChart days={overview.data.aiCallsByDay} />}
      </PlainSection>
    </div>
  );
}

/** The route's page: on laptops the Admin page itself, which shows the same. */
export function AdminMoneyRoute() {
  const phone = !!usePhoneNav();
  return phone ? <AdminMoneyPage /> : <Navigate to="/admin" replace />;
}
