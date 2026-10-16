import { useEffect } from 'react';

export function useModalFocus(active: boolean, context: string): void {
  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement;
    const modal =
      document.querySelector<HTMLElement>('.top-modal .modal') ??
      document.querySelector<HTMLElement>('.modal');
    if (!modal) return;
    const buttons = () => [...modal.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    buttons()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const list = buttons();
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
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [active, context]);
}
