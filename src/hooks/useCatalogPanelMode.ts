import { useEffect, useState } from 'react';

const PANEL_MODE_KEY = 'sanatpish_panel_mode_v1';

function readPanelMode(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(PANEL_MODE_KEY) !== '0';
  } catch {
    return true;
  }
}

export function useCatalogPanelMode() {
  const [panelMode, setPanelMode] = useState<boolean>(readPanelMode);

  useEffect(() => {
    try {
      window.localStorage.setItem(PANEL_MODE_KEY, panelMode ? '1' : '0');
    } catch {
      // Storage may be unavailable in private browsing or restricted environments.
    }
  }, [panelMode]);

  return [panelMode, setPanelMode] as const;
}
