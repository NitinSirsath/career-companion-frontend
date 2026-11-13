import { CheckIcon } from 'lucide-react';
import { THEME_CHOICES } from '../../lib/theme';
import { useTheme } from '../ThemeProvider';
import { PhoneGroup, PhoneRow, PhoneSection } from './PhoneList';
import { PhoneTitle } from './PhoneTitle';

/** Light, dark, or as the phone is set (owner, 13 Nov 2026): a page of its own under Settings. */
export function AppearancePage() {
  const { theme, setTheme } = useTheme();
  return (
    <div>
      <div className="px-1 pb-[18px]">
        <PhoneTitle size="detail">Appearance</PhoneTitle>
      </div>
      <PhoneSection className="mt-0" note="System follows your phone's light or dark setting.">
        <PhoneGroup>
          {THEME_CHOICES.map((choice) => (
            <PhoneRow
              key={choice.value}
              onClick={() => setTheme(choice.value)}
              value={
                theme === choice.value ? (
                  <CheckIcon size={20} aria-label="Chosen" className="text-link" />
                ) : undefined
              }
            >
              {choice.label}
            </PhoneRow>
          ))}
        </PhoneGroup>
      </PhoneSection>
    </div>
  );
}
