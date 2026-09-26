import { createRoot } from "react-dom/client";
import "@/styles/popup.css";
import { PagesApp } from "@/popup/PagesApp";
import { applyTheme, readThemePreference } from "@/popup/lib/theme";

// Same localStorage as the popup, so the tab matches the popup's appearance.
applyTheme(readThemePreference());

const container = document.getElementById("root");
if (container) createRoot(container).render(<PagesApp />);
