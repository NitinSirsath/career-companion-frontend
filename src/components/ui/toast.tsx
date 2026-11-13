import { Toast } from '@base-ui/react/toast';
import { CircleCheckIcon, WifiOffIcon, XIcon } from 'lucide-react';

/** One manager for the whole app, so any code can show a toast without a hook. */
const toastManager = Toast.createToastManager();

interface ToastOptions {
  /** Reverses what the toast confirms. Only offer it where the app can really undo. */
  undo?: () => void;
  /** Says that nothing happened because the device is offline: the offline icon, not the tick. */
  offline?: boolean;
}

/** A short confirmation at the bottom right, gone after 5 seconds: "Marked done", with Undo. */
export function showToast(title: string, { undo, offline = false }: ToastOptions = {}) {
  toastManager.add({
    title,
    timeout: 5000,
    actionProps: undo ? { children: 'Undo', onClick: undo } : undefined,
    data: { offline },
  });
}

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((toast) => (
    <Toast.Root
      key={toast.id}
      toast={toast}
      // Round and frosted, sliding in with a small spring (owner, 13 Nov 2026).
      className="flex min-h-12 w-full items-center gap-3 overflow-hidden rounded-3xl bg-inverse/84 pl-5 text-[14px] text-inverse-text shadow-popup backdrop-blur-[18px] backdrop-saturate-160 transition-[opacity,translate] duration-420 ease-spring data-ending-style:translate-y-4 data-ending-style:opacity-0 data-ending-style:duration-240 data-ending-style:ease-exit data-starting-style:translate-y-6 data-starting-style:opacity-0"
    >
      {(toast.data as { offline?: boolean } | undefined)?.offline ? (
        <WifiOffIcon size={16} aria-hidden="true" className="shrink-0" />
      ) : (
        <CircleCheckIcon size={16} aria-hidden="true" className="shrink-0 text-ok" />
      )}
      <Toast.Title className="flex-1 py-3" />
      <Toast.Action className="h-12 cursor-pointer px-4 text-inverse-link hover:underline" />
      <Toast.Close
        aria-label="Close"
        className="flex size-12 shrink-0 cursor-pointer items-center justify-center"
      >
        <XIcon size={16} aria-hidden="true" />
      </Toast.Close>
    </Toast.Root>
  ));
}

/** Put once at the app root. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <Toast.Provider toastManager={toastManager}>
      {children}
      <Toast.Portal>
        {/* On phones it sits above the bottom bar, so the bar stays in reach. */}
        <Toast.Viewport className="fixed right-4 bottom-20 z-[60] flex w-[calc(100vw-2rem)] flex-col gap-2 sm:right-6 sm:w-[24rem] md:bottom-6">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}
