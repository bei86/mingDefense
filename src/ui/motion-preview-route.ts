export function motionPreviewRequested(search: string, development: boolean): boolean {
  return development && new URLSearchParams(search).get('preview') === 'mouse-motion';
}

export function motionPreviewUrl(pathname: string): string {
  return `${pathname}?preview=mouse-motion`;
}
