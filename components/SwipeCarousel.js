'use client';
import { useRef, useState } from 'react';

// Reusable swipe carousel for costing / billing / calculation-result panels.
//
// Desktop: renders as a plain grid (see .swipe-track CSS) — looks exactly
// like the existing side-by-side layout, no behavior change.
// Mobile (<=768px): becomes a horizontally swipeable, scroll-snapped strip
// with a tab header and dot indicators, so the 2-3 panels can be checked
// back and forth with a left/right swipe instead of being squeezed side by side.
//
// panels: [{ key, label, content, mobileOnly? }]
// mobileOnly panels (e.g. a duplicated "live result" summary) are hidden on
// desktop via CSS so they don't show twice next to an existing sidebar.
export default function SwipeCarousel({ panels }) {
  const trackRef = useRef(null);
  const [active, setActive] = useState(0);

  function scrollToIndex(i) {
    const track = trackRef.current;
    const child = track?.children?.[i];
    if (child) child.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    setActive(i);
  }

  function handleScroll() {
    const track = trackRef.current;
    if (!track || !track.clientWidth) return;
    const idx = Math.round(track.scrollLeft / track.clientWidth);
    setActive(Math.max(0, Math.min(panels.length - 1, idx)));
  }

  return (
    <div className="swipe-carousel">
      <div className="swipe-tabs">
        {panels.map((p, i) => (
          <button
            type="button"
            key={p.key}
            className={active === i ? 'active' : ''}
            onClick={() => scrollToIndex(i)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="swipe-track" ref={trackRef} onScroll={handleScroll}>
        {panels.map(p => (
          <div className={`swipe-panel${p.mobileOnly ? ' mobile-only' : ''}`} key={p.key}>
            {p.content}
          </div>
        ))}
      </div>
      <div className="swipe-dots">
        {panels.map((p, i) => (
          <span
            key={p.key}
            className={`swipe-dot${active === i ? ' active' : ''}`}
            onClick={() => scrollToIndex(i)}
          />
        ))}
      </div>
    </div>
  );
}
