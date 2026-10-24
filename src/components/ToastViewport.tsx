import type { ToastView } from '../app/controller';
import { t } from '../localization';

export function ToastViewport({
  toast,
  onDismiss,
}: {
  toast: ToastView | null;
  onDismiss: () => void;
}) {
  if (!toast) return null;
  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="true">
      <button
        type="button"
        className={`toast toast--${toast.tone}`}
        onClick={onDismiss}
        data-testid="toast"
      >
        <span className="toast__dot" aria-hidden="true" />
        <span>{toast.message}</span>
        <span className="toast__hint">{t('close')}</span>
      </button>
    </div>
  );
}
