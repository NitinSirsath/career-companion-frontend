import { useProfile } from '../../api/auth';
import type { UserProfile } from '../../contracts/auth';
import { THEME_CHOICES } from '../../lib/theme';
import { usePhoneNav } from '../phone/phoneNav';
import { PlainLinkRow, PlainRow, PlainSection } from '../phone/PlainList';
import { useTheme } from '../ThemeProvider';
import { ThemeSelector } from '../ThemeSelector';
import { PageHeader } from '../layout/PageHeader';
import { FactList, SettingsSection } from '../layout/SettingsSection';
import { SectionError } from '../ui/section-error';
import { SkeletonList } from '../ui/skeleton';
import { AlertsSection } from './AlertsSection';
import { SetPasswordForm } from './SetPasswordForm';

/** The ways this account can sign in: a fact list on laptops, plain rows on phones. */
function SignInFacts({ profile, phone }: { profile: UserProfile; phone: boolean }) {
  const facts = [
    { label: 'Email', value: profile.email },
    { label: 'Google', value: profile.hasGoogle ? 'Connected' : 'Not used' },
    { label: 'Password', value: profile.hasPassword ? 'Set' : 'Not set' },
  ];
  if (phone)
    return (
      <PlainSection
        label="How you sign in"
        note="The ways this account can sign in."
        className="mt-0"
      >
        {facts.map((fact) => (
          <PlainRow key={fact.label} value={<span className="break-all">{fact.value}</span>}>
            {fact.label}
          </PlainRow>
        ))}
      </PlainSection>
    );
  return (
    <SettingsSection title="How you sign in" help="The ways this account can sign in.">
      <FactList facts={facts} />
    </SettingsSection>
  );
}

/** Phones: Appearance has its own page under Settings; this row opens it. */
function AppearanceRow() {
  const { theme } = useTheme();
  return (
    <PlainSection>
      <PlainLinkRow
        to="/settings/appearance"
        value={THEME_CHOICES.find((choice) => choice.value === theme)?.label}
      >
        Appearance
      </PlainLinkRow>
    </PlainSection>
  );
}

/** The signed-in user's account: the ways they sign in, their password, the theme and alerts. */
export function AccountPage() {
  const { data: profile, isLoading, isError } = useProfile();
  const phone = !!usePhoneNav();
  return (
    <div className="flex flex-col">
      <PageHeader
        phoneSmallTitle
        title="Account"
        description={
          phone ? undefined : 'How you sign in, how the app looks, and alerts on this device.'
        }
      />
      {isLoading && <SkeletonList rows={3} label="Loading your account" />}
      {isError && <SectionError title="Your account could not be loaded" />}
      {profile && (
        <>
          <SignInFacts profile={profile} phone={phone} />
          {profile.testAccount ? (
            <SettingsSection title="Password" help="This is a test account.">
              <p className="text-sm text-text-secondary">
                Your password is set on the server. Ask the person who gave you this account to
                change it.
              </p>
            </SettingsSection>
          ) : (
            <SettingsSection
              title={profile.hasPassword ? 'Change password' : 'Set password'}
              help={
                <>
                  <span className="font-semibold text-text-primary">Forgot your password?</span>{' '}
                  {profile.hasGoogle
                    ? 'Sign in with Google and set a new one here. The app sends no reset mail.'
                    : 'The app sends no reset mail. In dev mode, create another test user.'}
                </>
              }
            >
              {/* A new form after the first password is saved: it then asks for the current one. */}
              <SetPasswordForm
                key={String(profile.hasPassword)}
                hasPassword={profile.hasPassword}
              />
            </SettingsSection>
          )}
          {phone ? (
            <AppearanceRow />
          ) : (
            <SettingsSection
              title="Appearance"
              help="System follows your computer's light or dark setting."
            >
              <ThemeSelector className="max-w-80" />
            </SettingsSection>
          )}
          <AlertsSection />
        </>
      )}
    </div>
  );
}
