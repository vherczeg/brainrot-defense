import { useEffect, useId, useRef, type ReactNode } from 'react';
import { t } from '../localization';
import { Icon } from './Icon';

interface ModalProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly onClose?: () => void;
  readonly tone?: 'default' | 'victory' | 'defeat' | 'danger';
  readonly size?: 'small' | 'medium' | 'large';
  readonly testId?: string;
}

export function Modal({
  title,
  children,
  onClose,
  tone = 'default',
  size = 'medium',
  testId,
}: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable =
      dialog.querySelector<HTMLElement>('[data-autofocus]') ??
      dialog.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
    focusable?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onClose) {
        event.preventDefault();
        onClose();
      }
      if (event.key !== 'Tab') return;
      const items = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && onClose) onClose();
      }}
      data-testid={testId}
    >
      <div
        ref={dialogRef}
        className={`modal modal--${tone} modal--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal__header">
          <h2 id={titleId} className="modal__title">
            {title}
          </h2>
          {onClose ? (
            <button
              type="button"
              className="icon-button icon-button--ghost"
              onClick={onClose}
              aria-label={t('ariaModalClose')}
            >
              <Icon name="close" size={20} />
            </button>
          ) : null}
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}
