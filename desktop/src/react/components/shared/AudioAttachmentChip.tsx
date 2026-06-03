import { memo, useEffect, useMemo, useRef, useState } from 'react';
import styles from './AudioAttachmentChip.module.css';

export interface AudioAttachmentFile {
  path: string;
  name: string;
  base64Data?: string;
  mimeType?: string;
}

interface AudioAttachmentChipProps {
  file: AudioAttachmentFile;
  showAt?: boolean;
  showName?: boolean;
  onRemove?: () => void;
  className?: string;
}

export const AudioAttachmentChip = memo(function AudioAttachmentChip({
  file,
  showAt = false,
  showName = true,
  onRemove,
  className,
}: AudioAttachmentChipProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mountedRef = useRef(true);
  const [playing, setPlaying] = useState(false);
  const src = useMemo(() => getAudioUrl(file), [file]);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
    }
    audioRef.current = null;
    if (mountedRef.current) setPlaying(false);
  };

  useEffect(() => () => {
    mountedRef.current = false;
    stopAudio();
  }, []);

  const toggle = () => {
    if (playing) {
      stopAudio();
      return;
    }
    if (!src) return;

    stopAudio();
    const audio = new Audio(src);
    audioRef.current = audio;
    setPlaying(true);
    audio.onended = () => {
      if (audioRef.current === audio) stopAudio();
    };
    audio.onerror = () => {
      if (audioRef.current === audio) stopAudio();
    };
    const playResult = audio.play();
    if (playResult && typeof playResult.catch === 'function') {
      playResult.catch(() => {
        if (audioRef.current === audio) stopAudio();
      });
    }
  };

  return (
    <span className={`${styles.chip}${className ? ` ${className}` : ''}`} title={file.name}>
      {showAt && <span className={styles.at} aria-hidden="true">@</span>}
      <button
        type="button"
        className={`${styles.play}${playing ? ` ${styles.isPlaying}` : ''}`}
        onClick={toggle}
        aria-label={playing ? `Pause ${file.name}` : `Play ${file.name}`}
        disabled={!src}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      <span className={styles.wave} aria-hidden="true" data-testid="audio-attachment-wave">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </span>
      {showName && <span className={styles.name}>{file.name}</span>}
      {onRemove && (
        <button
          type="button"
          className={styles.remove}
          onClick={() => {
            stopAudio();
            onRemove();
          }}
          aria-label={`Remove ${file.name}`}
        >
          <RemoveIcon />
        </button>
      )}
    </span>
  );
});

function getAudioUrl(file: AudioAttachmentFile): string | null {
  if (file.base64Data && file.mimeType) {
    return `data:${file.mimeType};base64,${file.base64Data}`;
  }
  if (typeof window === 'undefined') return null;
  return window.platform?.getFileUrl?.(file.path) || null;
}

function PlayIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.14v13.72L18.8 12 8 5.14z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 5h3v14H7zM14 5h3v14h-3z" />
    </svg>
  );
}

function RemoveIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
