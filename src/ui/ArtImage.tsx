import { useState } from 'react';
import { artUrl, type ArtKey } from '../render/art';

export function ArtImage({ asset, className = '' }: { asset: ArtKey; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={artUrl(asset)}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`art-image ${className}`}
      onError={() => setFailed(true)}
    />
  );
}
