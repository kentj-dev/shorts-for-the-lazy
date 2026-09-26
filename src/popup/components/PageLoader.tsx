import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

/** Storage usually answers well within this, so the spinner rarely shows. */
const SPINNER_DELAY_MS = 250;

/**
 * Holds a full-tab page's place while its data loads. It is a screen tall,
 * so the footer stays below the fold instead of jumping up and back down.
 */
export function PageLoader() {
    const [showSpinner, setShowSpinner] = useState(false);
    useEffect(() => {
        const timer = setTimeout(() => setShowSpinner(true), SPINNER_DELAY_MS);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div
            role="status"
            aria-label="Loading"
            className="flex min-h-dvh items-start justify-center pt-24"
        >
            {showSpinner ? (
                <LoaderCircle
                    className="size-6 animate-spin text-muted-foreground"
                    strokeWidth={2}
                />
            ) : null}
        </div>
    );
}
