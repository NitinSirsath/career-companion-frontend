import { Toast } from '@base-ui/react/toast';
import { CheckmarkFilled, Close, WifiOff } from '@carbon/icons-react';

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
      className="flex min-h-12 w-full items-center gap-4 bg-inverse pl-4 text-[14px] text-inverse-text transition-[opacity,translate] duration-240 ease-entrance data-ending-style:translate-y-4 data-ending-style:opacity-0 data-ending-style:ease-exit data-starting-style:translate-y-4 data-starting-style:opacity-0"
    >
      {(toast.data as { offline?: boolean } | undefined)?.offline ? (
        <WifiOff size={16} aria-hidden="true" className="shrink-0" />
      ) : (
        <CheckmarkFilled size={16} aria-hidden="true" className="shrink-0 text-ok" />
      )}
      <Toast.Title className="flex-1 py-3" />
      <Toast.Action className="h-12 cursor-pointer px-4 text-inverse-link hover:underline" />
      <Toast.Close
        aria-label="Close"
        className="flex size-12 shrink-0 cursor-pointer items-center justify-center"
      >
        <Close size={16} aria-hidden="true" />
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
