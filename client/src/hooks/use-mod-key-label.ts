import { useEffect, useState } from "react";

/**
 * Label for the primary modifier key (⌘ on Apple platforms, Ctrl elsewhere).
 */
export function useModKeyLabel(): string {
  const [label, setLabel] = useState("⌘");

  useEffect(() => {
    const isApple = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);
    setLabel(isApple ? "⌘" : "Ctrl");
  }, []);

  return label;
}
