import { useProfile } from '../../api/auth';
import { ThemeSelector } from '../ThemeSelector';
import { PageHeader } from '../layout/PageHeader';
import { FactList, SettingsSection } from '../layout/SettingsSection';
import { SectionError } from '../ui/section-error';
import { SkeletonList } from '../ui/skeleton';
import { SetPasswordForm } from './SetPasswordForm';

/** The signed-in user's account: the ways they sign in, their password, and the theme. */
export function AccountPage() {
  const { data: profile, isLoading, isError } = useProfile();
  return (
    <div className="flex flex-col">
      <PageHeader title="Account" description="How you sign in, and how the app looks." />
      {isLoading && <SkeletonList rows={3} label="Loading your account" />}
      {isError && <SectionError title="Your account could not be loaded" />}
      {profile && (
        <>
          <SettingsSection title="How you sign in" help="The ways this account can sign in.">
            <FactList
              facts={[
                { label: 'Email', value: profile.email },
                { label: 'Google', value: profile.hasGoogle ? 'Connected' : 'Not used' },
                { label: 'Password', value: profile.hasPassword ? 'Set' : 'Not set' },
              ]}
            />
          </SettingsSection>
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
            <SetPasswordForm key={String(profile.hasPassword)} hasPassword={profile.hasPassword} />
          </SettingsSection>
          <SettingsSection
            title="Appearance"
            help="System follows your computer's light or dark setting."
          >
            <ThemeSelector className="max-w-80" />
          </SettingsSection>
        </>
      )}
    </div>
  );
}
