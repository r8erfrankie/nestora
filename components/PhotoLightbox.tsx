'use client';

import Lightbox from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';

interface PhotoLightboxProps {
  images: string[];
  startIndex?: number;
  open: boolean;
  onClose: () => void;
}

export function PhotoLightbox({ images, startIndex = 0, open, onClose }: PhotoLightboxProps) {
  return (
    <Lightbox
      open={open}
      close={onClose}
      index={startIndex}
      slides={images.map((src) => ({ src }))}
      plugins={[Zoom]}
    />
  );
}
