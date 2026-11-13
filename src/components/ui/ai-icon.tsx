import { createLucideIcon } from 'lucide-react';

/**
 * The AI's icon (owner, 13 Nov 2026): the shape of Carbon's MachineLearningModel, drawn with thin
 * round lines like the Lucide icons beside it. Never a sparkle: AI is a tool here, not magic.
 */
export const AiIcon = createLucideIcon('ai', [
  [
    'path',
    {
      d: 'M12 5.6A1.6 1.6 0 0 0 10.4 4H10a6.5 6.5 0 0 0-6.5 6.5v3A6.5 6.5 0 0 0 10 20h.4a1.6 1.6 0 0 0 1.6-1.6z',
      key: 'head',
    },
  ],
  ['path', { d: 'M12 5.6A1.6 1.6 0 0 1 13.6 4h1', key: 'top' }],
  ['path', { d: 'M12 18.4a1.6 1.6 0 0 0 1.6 1.6h1', key: 'bottom' }],
  ['path', { d: 'M3.7 11.2H6a1.4 1.4 0 0 0 1.4-1.4V8.6', key: 'fold-up' }],
  ['path', { d: 'M12 14.6H9.6a1.4 1.4 0 0 0-1.4 1.4v1.2', key: 'fold-down' }],
  ['path', { d: 'M12 12h5.4', key: 'line-mid' }],
  ['path', { d: 'M12 10.4l4.6-4.6', key: 'line-up' }],
  ['path', { d: 'M12 13.6l4.6 4.6', key: 'line-down' }],
  ['circle', { cx: '19', cy: '12', r: '1.6', key: 'dot-mid' }],
  ['circle', { cx: '17.9', cy: '4.7', r: '1.5', key: 'dot-up' }],
  ['circle', { cx: '17.9', cy: '19.3', r: '1.5', key: 'dot-down' }],
]);
