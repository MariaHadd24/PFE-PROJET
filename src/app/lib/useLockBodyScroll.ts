import { useEffect } from 'react';

type BodyScrollLockState = {
  count: number;
  prevOverflow: string;
  prevHtmlOverflow: string;
  prevPaddingRight: string;
};

const STATE_KEY = '__PFE_BODY_SCROLL_LOCK__';

function getState(): BodyScrollLockState {
  const g = globalThis as any;
  if (!g[STATE_KEY]) {
    g[STATE_KEY] = {
      count: 0,
      prevOverflow: '',
      prevHtmlOverflow: '',
      prevPaddingRight: '',
    } satisfies BodyScrollLockState;
  }
  return g[STATE_KEY] as BodyScrollLockState;
}

function getScrollbarWidthPx() {
  if (typeof window === 'undefined') return 0;
  return Math.max(0, window.innerWidth - document.documentElement.clientWidth);
}

export function useLockBodyScroll(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    if (typeof document === 'undefined') return;

    const state = getState();
    state.count += 1;

    if (state.count === 1) {
      const bodyStyle = document.body.style;
      const htmlStyle = document.documentElement.style;
      state.prevOverflow = bodyStyle.overflow;
      state.prevHtmlOverflow = htmlStyle.overflow;
      state.prevPaddingRight = bodyStyle.paddingRight;

      const scrollbarWidth = getScrollbarWidthPx();
      bodyStyle.overflow = 'hidden';
      htmlStyle.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        bodyStyle.paddingRight = `${scrollbarWidth}px`;
      }
    }

    return () => {
      const s = getState();
      s.count = Math.max(0, s.count - 1);
      if (s.count === 0) {
        const bodyStyle = document.body.style;
        const htmlStyle = document.documentElement.style;
        bodyStyle.overflow = s.prevOverflow;
        htmlStyle.overflow = s.prevHtmlOverflow;
        bodyStyle.paddingRight = s.prevPaddingRight;
      }
    };
  }, [locked]);
}
