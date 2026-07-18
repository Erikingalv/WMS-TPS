"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Instalación offline no disponible; la app sigue funcionando en línea.
      });
    }
  }, []);

  return null;
}
