import { useEffect, useMemo, useRef, useState } from 'react';
import { buildMoments, sampleMoments } from './animation';
import { type Diagram } from './model';

export function usePlayback(diagram: Diagram) {
  const moments = useMemo(() => buildMoments(diagram), [diagram]);
  const total = moments[moments.length - 1].at;
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const position = useRef(0);

  useEffect(() => {
    if (!playing) return;
    const started = performance.now() - position.current;
    let frame: number;
    function tick(now: number) {
      position.current = Math.max(0, Math.min(total, now - started));
      setElapsed(position.current);
      if (position.current < total) frame = requestAnimationFrame(tick);
      else setPlaying(false);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, total]);

  function toggle() {
    if (!total) return;
    if (playing) {
      setPlaying(false);
      return;
    }
    if (elapsed === null || elapsed >= total) position.current = 0;
    setElapsed(position.current);
    setPlaying(true);
  }

  function reset() {
    setPlaying(false);
    setElapsed(null);
    position.current = 0;
  }

  return { moments, total, playing, elapsed, toggle, reset, elements: elapsed === null ? null : sampleMoments(moments, elapsed) };
}

export function PlaybackControls({ playback }: { playback: ReturnType<typeof usePlayback> }) {
  const { total, elapsed, playing, toggle, reset } = playback;
  if (!total) return null;
  const label = playing ? 'Pause' : elapsed !== null && elapsed > 0 && elapsed < total ? 'Resume' : 'Play';
  return <div className="button-row">
    <button type="button" onClick={toggle}>{label}</button>
    {elapsed !== null && <button type="button" onClick={reset}>Stop</button>}
    {elapsed !== null && <progress aria-label="Playback progress" value={elapsed} max={total} />}
  </div>;
}
