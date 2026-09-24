import { createRoot } from "react-dom/client";
import "@/styles/popup.css";
import { App } from "@/popup/App";
import { applyTheme, readThemePreference } from "@/popup/lib/theme";

// Before the first render, so a dark popup is never painted light first.
applyTheme(readThemePreference());

const container = document.getElementById("root");
if (container) createRoot(container).render(<App />);
