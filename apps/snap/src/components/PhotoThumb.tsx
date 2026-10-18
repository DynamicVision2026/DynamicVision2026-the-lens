import { useEffect, useState } from "react";
import type { SavedPage } from "../lib/model";

export function PhotoThumb({ photo, alt }: { photo: SavedPage["photo"]; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!photo) return;
    const u = URL.createObjectURL(new Blob([photo.bytes], { type: photo.mime }));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [photo]);
  if (!url) return null;
  return (
    <>
      <button type="button" className="thumb" onClick={() => setOpen(true)} aria-label={alt}>
        <img src={url} alt={alt} />
      </button>
      {open && (
        <div className="lightbox" role="dialog" onClick={() => setOpen(false)}>
          <img src={url} alt={alt} />
        </div>
      )}
    </>
  );
}
