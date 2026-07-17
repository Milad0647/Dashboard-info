"use client";

import { useEffect, useRef, useState } from "react";

interface UseInViewOptions {
  rootMargin?: string;
  triggerOnce?: boolean;
}

export function useInView<T extends Element = HTMLDivElement>({
  rootMargin = "200px",
  triggerOnce = true,
}: UseInViewOptions = {}) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;

        if (entry.isIntersecting) {
          setInView(true);
          if (triggerOnce) observer.disconnect();
          return;
        }

        if (!triggerOnce) {
          setInView(false);
        }
      },
      { rootMargin }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [rootMargin, triggerOnce]);

  return { ref, inView };
}
