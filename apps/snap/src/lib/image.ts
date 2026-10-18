const MAX_UPLOAD_EDGE = 1600;
const THUMB_EDGE = 900;

async function toJpeg(bitmap: ImageBitmap, maxEdge: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/jpeg", quality));
}

/**
 * Prepare a photo: the upload copy (original if already ≤1600 px JPEG, else downscaled)
 * and a small thumbnail that stays on this device.
 */
export async function preparePhoto(file: File): Promise<{ upload: Blob; thumb?: { bytes: ArrayBuffer; mime: string } }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { upload: file }; // e.g. HEIC on a browser that cannot decode it: let the server try
  }
  const small = Math.max(bitmap.width, bitmap.height) <= MAX_UPLOAD_EDGE && file.type === "image/jpeg";
  const upload = small ? file : await toJpeg(bitmap, MAX_UPLOAD_EDGE, 0.85);
  const thumbBlob = await toJpeg(bitmap, THUMB_EDGE, 0.8);
  bitmap.close();
  return { upload, thumb: { bytes: await thumbBlob.arrayBuffer(), mime: "image/jpeg" } };
}
