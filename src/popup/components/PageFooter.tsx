import logo from "@/assets/logo.png";
import { cn } from "@/popup/lib/utils";
import { CoffeeIcon } from "lucide-react";

/*
 * A copy of the Lazyboard site's footer (lazyboard/web/src/components/
 * SiteFooter.tsx). Links that go to site pages there go to this page's own
 * tabs here, and the logo is the bundled one.
 */

const COFFEE_URL = "https://buymeacoffee.com/kentjdev";
const MAKER_URL = "https://apps.hamiken.com";
const SOURCE_URL =
    "https://chromewebstore.google.com/detail/shorts-for-the-lazy/ljobilbibimbccbcciioiooafhinelhn";

const linkClass =
    "w-fit text-[13px] text-foreground/85 transition-colors hover:text-primary focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary";

/** The page-wide footer: brand and links above a full-width wordmark. */
export function PageFooter() {
    return (
        <footer className="mt-8 overflow-hidden border-t border-edge/60 bg-card/40 pt-10 sm:mt-26 sm:pt-14">
            <div className="grid gap-10 px-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-16 sm:px-10 lg:px-16">
                <a
                    href="#month"
                    className="inline-flex w-fit items-center gap-3 self-start rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                    aria-label="Shorts for the Lazy, this month"
                >
                    <img
                        src={logo}
                        alt=""
                        className="size-12 rounded-2xl border"
                    />
                    <div className="flex flex-col">
                        <span className="text-[15px] font-semibold tracking-tight">
                            Shorts for the Lazy
                        </span>
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                            by Hamiken
                        </span>
                    </div>
                </a>

                <nav
                    aria-label="Footer"
                    className="grid grid-cols-2 gap-x-8 gap-y-8 sm:gap-x-16"
                >
                    <div className="flex flex-col items-start gap-3">
                        <h2 className="mb-1 text-[12px] font-medium text-muted-foreground">
                            Legal
                        </h2>
                        <a href="#privacy" className={linkClass}>
                            Privacy
                        </a>
                        <a href="#terms" className={linkClass}>
                            Terms of use
                        </a>
                    </div>
                    <div className="flex flex-col items-start gap-3">
                        <h2 className="mb-1 text-[12px] font-medium text-muted-foreground">
                            Project
                        </h2>
                        <a
                            href={MAKER_URL}
                            target="_blank"
                            rel="noreferrer"
                            className={linkClass}
                        >
                            Hamiken
                        </a>
                        <a
                            href={SOURCE_URL}
                            target="_blank"
                            rel="noreferrer"
                            className={linkClass}
                        >
                            Chrome Extension
                        </a>
                        <a
                            href={COFFEE_URL}
                            target="_blank"
                            rel="noreferrer"
                            className={cn(
                                linkClass,
                                "flex items-center gap-2 hover:dark:text-yellow-300",
                            )}
                        >
                            <CoffeeIcon size={16} strokeWidth={2.5} />
                            Buy me a Coffee
                        </a>
                    </div>
                </nav>
            </div>

            <svg
                viewBox="0 0 1000 180"
                className="mt-14 block w-full select-none sm:mt-20"
                aria-hidden
            >
                <defs>
                    <linearGradient
                        id="wordmark-fade"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                    >
                        <stop offset="0%" stopColor="var(--primary)" />
                        <stop
                            offset="100%"
                            stopColor="var(--primary)"
                            stopOpacity="0.15"
                        />
                    </linearGradient>
                </defs>
                <text
                    x="0"
                    y="168"
                    fontSize="218"
                    fontWeight="700"
                    letterSpacing="-8"
                    textLength="1000"
                    lengthAdjust="spacingAndGlyphs"
                    fill="url(#wordmark-fade)"
                >
                    Lazyboard
                </text>
            </svg>
        </footer>
    );
}
