import { useEffect, useState } from 'react';
import type { MailMessage } from '../../contracts/mailbox';
import { hasRemoteImages, mailFrameDocument, MailColors, setsOwnColors } from '../../lib/mailHtml';
import { mailText } from '../../lib/mailThread';
import { Button } from '../ui/button';
import { Collapse } from '../ui/collapse';

/** The theme's text colour and the card's colour, or null when the page has none (as in tests). */
function readThemeColors(background: string): MailColors | null {
  const css = getComputedStyle(document.documentElement);
  const text = css.getPropertyValue('--text-primary').trim();
  const page = css.getPropertyValue(background).trim();
  return text && page ? { text, background: page } : null;
}

/** The theme's colours, read again when the theme changes the root element's classes. */
function useThemeColors(background: string): MailColors | null {
  const [, setThemeChanges] = useState(0);
  useEffect(() => {
    const observer = new MutationObserver(() => setThemeChanges((count) => count + 1));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return readThemeColors(background);
}

/**
 * The sender's HTML in a frame that cannot run scripts, send forms or reach the network. The
 * frame shares the page's origin only so its height can be read; nothing inside it can use that.
 */
function MailFrame({
  html,
  showImages,
  showQuote,
  mine,
}: {
  html: string;
  showImages: boolean;
  showQuote: boolean;
  mine: boolean;
}) {
  const [height, setHeight] = useState(160);
  const theme = useThemeColors(mine ? '--tint' : '--surface');
  const colors = theme && !setsOwnColors(html) ? theme : undefined;
  return (
    <iframe
      title="Mail text"
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      srcDoc={mailFrameDocument(html, showImages, colors, !showQuote)}
      className="block w-full border-0 transition-[height] duration-240 ease-standard"
      style={{ height }}
      onLoad={(event) => {
        const page = event.currentTarget.contentDocument?.documentElement;
        if (page) setHeight(page.scrollHeight);
      }}
    />
  );
}

/**
 * A message's text: plain text as it is, HTML inside the safe frame. The quoted earlier mail is
 * left out unless `showQuote` is on.
 */
export function MailBody({
  message,
  showQuote = true,
  mine = false,
}: {
  message: MailMessage;
  showQuote?: boolean;
  /** The user's own mail, drawn on the tinted card. */
  mine?: boolean;
}) {
  const [showImages, setShowImages] = useState(false);
  const { html, own, quoted } = mailText(message);
  if (!html) {
    return (
      <div className="max-w-[75ch] text-sm leading-[22px] break-words whitespace-pre-wrap">
        <p>{own || 'This mail has no text.'}</p>
        {quoted && (
          <Collapse open={showQuote}>
            {/* The gap sits inside, so a closed quote leaves no space behind. */}
            <p className="pt-3 text-text-secondary">{quoted}</p>
          </Collapse>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {!showImages && hasRemoteImages(html) && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary">
          <span>Pictures are hidden, so the sender cannot tell that you opened this mail.</span>
          <Button variant="ghost" size="sm" onClick={() => setShowImages(true)}>
            Show images
          </Button>
        </div>
      )}
      <MailFrame html={html} showImages={showImages} showQuote={showQuote} mine={mine} />
    </div>
  );
}
