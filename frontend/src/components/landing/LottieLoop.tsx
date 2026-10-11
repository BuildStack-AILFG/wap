"use client";

import { useEffect, useRef } from "react";
import type { AnimationItem } from "lottie-web";

/**
 * Plays a Lottie JSON from /public on loop. lottie-web is imported lazily so it
 * stays out of the first-load bundle, and playback pauses while off-screen.
 * With prefers-reduced-motion it renders a single still frame.
 */
export default function LottieLoop({
  src,
  className,
  style,
  label,
}: {
  src: string;
  className?: string;
  style?: React.CSSProperties;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let anim: AnimationItem | null = null;
    let observer: IntersectionObserver | null = null;
    let cancelled = false;

    import("lottie-web").then(({ default: lottie }) => {
      if (cancelled) return;
      anim = lottie.loadAnimation({ container: el, renderer: "svg", loop: !reduced, autoplay: false, path: src });
      if (reduced) {
        anim.addEventListener("DOMLoaded", () => anim?.goToAndStop(anim.totalFrames - 1, true));
        return;
      }
      observer = new IntersectionObserver(([entry]) => (entry.isIntersecting ? anim?.play() : anim?.pause()));
      observer.observe(el);
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
      anim?.destroy();
    };
  }, [src]);

  return <div ref={ref} className={className} style={style} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
}
