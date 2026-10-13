"use client";

import { useEffect } from "react";

export function DynamicFavicon() {
  useEffect(() => {
    function setFavicon(isDark: boolean) {
      try {
        const targetHref = isDark
          ? `/icon-dark.png?v=${Date.now()}`
          : `/icon-light.png?v=${Date.now()}`;

        const existingLinks = document.querySelectorAll<HTMLLinkElement>("link[rel*='icon']");
        let targetLink = document.getElementById("app-favicon") as HTMLLinkElement | null;

        if (!targetLink) {
          targetLink = existingLinks[0] || null;
        }

        if (!targetLink) {
          targetLink = document.createElement("link");
          targetLink.id = "app-favicon";
          targetLink.rel = "icon";
          document.head.appendChild(targetLink);
        }

        targetLink.id = "app-favicon";
        targetLink.rel = "icon";
        targetLink.type = "image/png";
        targetLink.href = targetHref;

        existingLinks.forEach((l) => {
          if (l !== targetLink) {
            l.remove();
          }
        });
      } catch (err) {
        console.error("Error setting favicon:", err);
      }
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const isDarkMatch = mediaQuery.matches;

    fetch("/api/theme")
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.isDark === "boolean") {
          setFavicon(data.isDark || isDarkMatch);
        } else {
          setFavicon(isDarkMatch);
        }
      })
      .catch(() => {
        setFavicon(isDarkMatch);
      });

    const handler = (e: MediaQueryListEvent) => {
      setFavicon(e.matches);
    };

    mediaQuery.addEventListener("change", handler);
    return () => {
      mediaQuery.removeEventListener("change", handler);
    };
  }, []);

  return null;
}
