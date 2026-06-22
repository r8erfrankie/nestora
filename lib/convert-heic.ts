/**
 * ensureJpeg — convert HEIC/HEIF files to JPEG before upload.
 *
 * HEIC is Apple's default camera format. Browsers (Chrome, Firefox, Edge)
 * cannot decode it, so raw HEIC files produce broken previews and broken
 * <img> tags after upload. Converting to JPEG on the client means Supabase
 * stores a universally-readable file and previews work immediately.
 *
 * Safe to call on any file: non-HEIC files are returned unchanged.
 * If conversion fails (library load error, corrupt file, etc.) the original
 * file is returned so the upload can still proceed.
 */
export async function ensureJpeg(file: File): Promise<File> {
  const isHeic =
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    /\.(heic|heif)$/i.test(file.name);

  if (!isHeic) return file;

  try {
    // Dynamic import keeps heic2any out of the main bundle — it's only loaded
    // when a HEIC file is actually selected.
    const heic2any = (await import('heic2any')).default;

    const result = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.85,
    });

    // heic2any returns Blob | Blob[]; multi-page HEIC returns an array — take the first frame.
    const blob = Array.isArray(result) ? result[0] : result;
    const newName = file.name.replace(/\.(heic|heif)$/i, '.jpg');

    return new File([blob], newName, { type: 'image/jpeg' });
  } catch (err) {
    console.warn('[ensureJpeg] HEIC conversion failed, uploading original file:', err);
    return file;
  }
}
