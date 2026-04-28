"use client"

import { useEffect } from "react";
export function useTimelineReveal(selector = ".tl-item") {
  useEffect(() => {
    const items = document.querySelectorAll(selector);
    console.log("Timeline observer — items found:", items.length); // ← add this

    if (items.length === 0) return; // nothing to observe, exit early

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          console.log("Intersecting:", entry.isIntersecting, entry.target); // ← add this
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      },
      { threshold: 0.25 }
    );

    items.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}