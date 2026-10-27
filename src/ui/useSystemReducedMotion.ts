import { useSyncExternalStore } from 'react';

let query: MediaQueryList | undefined;
function motionQuery(): MediaQueryList {
  return (query ??= window.matchMedia('(prefers-reduced-motion: reduce)'));
}
function subscribe(onChange: () => void): () => void {
  const media = motionQuery();
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}
function snapshot(): boolean {
  return motionQuery().matches;
}
function serverSnapshot(): boolean {
  return false;
}
export function useSystemReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
