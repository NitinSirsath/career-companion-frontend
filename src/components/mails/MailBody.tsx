import { useEffect, useState } from 'react';
import type { MailMessage } from '../../contracts/mailbox';
import { hasRemoteImages, mailFrameDocument, MailColors, setsOwnColors } from '../../lib/mailHtml';
import { Button } from '../ui/button';

/** The theme's text and card colours, or null when the page has none (as in tests). */
function readThemeColors(): MailColors | null {
  const css = getComputedStyle(document.documentElement);
  const text = css.getPropertyValue('--text-primary').trim();
  const background = css.getPropertyValue('--surface').trim();
  return text && background ? { text, background } : null;
}

/** The theme's colours, read again when the theme changes the root element's classes. */
function useThemeColors(): MailColors | null {
  const [colors, setColors] = useState(readThemeColors);
  useEffect(() => {
    const observer = new MutationObserver(() => setColors(readThemeColors()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return colors;
}

/**
 * The sender's HTML in a frame that cannot run scripts, send forms or reach the network. The
 * frame shares the page's origin only so its height can be read; nothing inside it can use that.
 */
function MailFrame({ html, showImages }: { html: string; showImages: boolean }) {
  const [height, setHeight] = useState(160);
  const theme = useThemeColors();
  const colors = theme && !setsOwnColors(html) ? theme : undefined;
  return (
    <iframe
      title="Mail text"
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      srcDoc={mailFrameDocument(html, showImages, colors)}
      className="block w-full border-0"
      style={{ height }}
      onLoad={(event) => {
        const page = event.currentTarget.contentDocument?.documentElement;
        if (page) setHeight(page.scrollHeight);
      }}
    />
  );
}

/** A message's text: plain text as it is, HTML inside the safe frame. */
export function MailBody({ message }: { message: MailMessage }) {
  const [showImages, setShowImages] = useState(false);
  if (!message.html)
    return (
      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
        {message.text?.trim() || 'This mail has no text.'}
      </p>
    );
  return (
    <div className="space-y-3">
      {!showImages && hasRemoteImages(message.html) && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary">
          <span>Pictures are hidden, so the sender cannot tell that you opened this mail.</span>
          <Button variant="tertiary" size="sm" onClick={() => setShowImages(true)}>
            Show images
          </Button>
        </div>
      )}
      <MailFrame html={message.html} showImages={showImages} />
    </div>
  );
}
