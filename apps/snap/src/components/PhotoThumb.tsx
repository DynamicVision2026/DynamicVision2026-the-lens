import { useEffect, useState } from "react";
import type { SavedPage } from "../lib/model";

/** Object URL of a saved page photo (revoked when the photo changes or the component goes). */
export function usePhotoUrl(photo: SavedPage["photo"]): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!photo) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(new Blob([photo.bytes], { type: photo.mime }));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [photo]);
  return url;
}

/**
 * Page thumbnail. Without `onOpen` a tap shows the photo in a simple lightbox (テスト前リスト, ふりかえり);
 * with it, the caller opens its own viewer (the map's page viewer).
 */
export function PhotoThumb({ photo, alt, onOpen }: { photo: SavedPage["photo"]; alt: string; onOpen?: () => void }) {
  const url = usePhotoUrl(photo);
  const [open, setOpen] = useState(false);
  if (!url) return null;
  return (
    <>
      <button type="button" className="thumb" onClick={() => (onOpen ? onOpen() : setOpen(true))} aria-label={alt} data-testid="photo-thumb">
        <img src={url} alt="" />
      </button>
      {open && (
        <div className="lightbox" role="dialog" onClick={() => setOpen(false)}>
          <img src={url} alt={alt} />
        </div>
      )}
    </>
  );
}
