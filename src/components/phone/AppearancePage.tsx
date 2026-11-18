import { CheckIcon } from 'lucide-react';
import { THEME_CHOICES } from '../../lib/theme';
import { useTheme } from '../ThemeProvider';
import { PlainRow, PlainSection } from './PlainList';
import { PhoneTitle } from './PhoneTitle';

/** Light, dark, or as the phone is set (owner, 13 Nov 2026): a page of its own under Settings. */
export function AppearancePage() {
  const { theme, setTheme } = useTheme();
  return (
    <div>
      <div className="pb-1">
        <PhoneTitle size="bar">Appearance</PhoneTitle>
      </div>
      <PlainSection className="mt-0" note="System follows your phone's light or dark setting.">
        {THEME_CHOICES.map((choice) => (
          <PlainRow
            key={choice.value}
            onClick={() => setTheme(choice.value)}
            end={
              theme === choice.value ? (
                <CheckIcon size={20} aria-label="Chosen" className="text-accent" />
              ) : undefined
            }
          >
            {choice.label}
          </PlainRow>
        ))}
      </PlainSection>
    </div>
  );
}
