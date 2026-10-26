import { useEffect } from 'react';

export function useModalFocus(active: boolean, context: string): void {
  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement;
    const visibleModal = (selector: string) =>
      [...document.querySelectorAll<HTMLElement>(selector)].find(
        (element) => element.getClientRects().length > 0,
      );
    const modal =
      visibleModal('.renderer-recovery .modal') ??
      visibleModal('.top-modal .modal') ??
      visibleModal('.modal');
    if (!modal) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const controls = () =>
      [
        ...modal.querySelectorAll<HTMLElement>(
          'summary, a[href], button:not(:disabled), select:not(:disabled), textarea:not(:disabled), input:not(:disabled):not([type="hidden"])',
        ),
      ].filter((element) => element.getClientRects().length > 0);
    controls()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const list = controls();
      const first = list[0];
      const last = list.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', trap);
    return () => {
      document.removeEventListener('keydown', trap);
      document.body.style.overflow = previousOverflow;
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true });
    };
  }, [active, context]);
}
