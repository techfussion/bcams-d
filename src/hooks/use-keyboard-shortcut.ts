/**
 * useKeyboardShortcut — Global keyboard shortcut handler
 * 
 * Registers keyboard shortcuts scoped to the window with modifier key support.
 * Automatically prevents default browser behavior and cleans up on unmount.
 */
import { useEffect, useCallback } from 'react';

interface ShortcutOptions {
  /** The key to listen for (e.g., 'k', 'Enter', 'Escape') */
  key: string;
  /** Require Ctrl (or Cmd on Mac) */
  ctrlOrCmd?: boolean;
  /** Require Shift */
  shift?: boolean;
  /** Require Alt */
  alt?: boolean;
  /** Prevent default browser behavior. Default: true */
  preventDefault?: boolean;
  /** Only fire when no input/textarea is focused. Default: true */
  ignoreInputs?: boolean;
}

export function useKeyboardShortcut(
  options: ShortcutOptions,
  callback: () => void,
  deps: unknown[] = []
) {
  const {
    key,
    ctrlOrCmd = false,
    shift = false,
    alt = false,
    preventDefault = true,
    ignoreInputs = true,
  } = options;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoizedCallback = useCallback(callback, deps);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if user is typing in an input
      if (ignoreInputs) {
        const target = e.target as HTMLElement;
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable
        ) {
          return;
        }
      }

      // Check modifier keys
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlMatch = ctrlOrCmd
        ? isMac ? e.metaKey : e.ctrlKey
        : true;
      const shiftMatch = shift ? e.shiftKey : !e.shiftKey;
      const altMatch = alt ? e.altKey : !e.altKey;

      if (e.key.toLowerCase() === key.toLowerCase() && ctrlMatch && shiftMatch && altMatch) {
        if (preventDefault) {
          e.preventDefault();
          e.stopPropagation();
        }
        memoizedCallback();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [key, ctrlOrCmd, shift, alt, preventDefault, ignoreInputs, memoizedCallback]);
}
