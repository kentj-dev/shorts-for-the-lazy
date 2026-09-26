import { PageLoader } from "@/popup/components/PageLoader";
import { Button } from "@/popup/components/ui/button";
import { Card } from "@/popup/components/ui/card";
import { Input } from "@/popup/components/ui/input";
import { Switch } from "@/popup/components/ui/switch";
import { useHistory } from "@/popup/hooks/useHistory";
import { useSettings } from "@/popup/hooks/useSettings";
import {
    HISTORY_LIMIT,
    shortUrl,
    thumbnailUrl,
    type RecentShort,
} from "@/shared/history";
import { History, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

/** "0:42", "2:05". */
function formatLength(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function startOfDay(time: number): number {
    const date = new Date(time);
    return new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
    ).getTime();
}

function dayLabel(dayStart: number): string {
    const today = startOfDay(Date.now());
    if (dayStart === today) return "Today";
    // Date math, not 24h subtraction, so a daylight-saving day still works.
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (dayStart === yesterday.getTime()) return "Yesterday";
    return new Date(dayStart).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
    });
}

/** Consecutive entries grouped by the local day they were watched. */
function groupByDay(
    entries: readonly RecentShort[],
): Array<{ day: number; entries: RecentShort[] }> {
    const groups: Array<{ day: number; entries: RecentShort[] }> = [];
    for (const entry of entries) {
        const day = startOfDay(entry.watchedAt);
        const last = groups.at(-1);
        if (last?.day === day) last.entries.push(entry);
        else groups.push({ day, entries: [entry] });
    }
    return groups;
}

function ShortCard({
    entry,
    onRemove,
}: {
    entry: RecentShort;
    onRemove: () => void;
}) {
    const [thumbnailFailed, setThumbnailFailed] = useState(false);
    const title = entry.title || "Untitled Short";

    return (
        <li className="group relative min-w-0">
            <a
                href={shortUrl(entry.id)}
                target="_blank"
                rel="noreferrer"
                className="block rounded-md focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
                <div className="relative aspect-[9/16] overflow-hidden rounded-md border border-edge bg-secondary">
                    {thumbnailFailed ? (
                        <History
                            className="absolute inset-0 m-auto size-6 text-muted-foreground"
                            strokeWidth={1.75}
                        />
                    ) : (
                        <img
                            src={thumbnailUrl(entry.id)}
                            alt=""
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onError={() => setThumbnailFailed(true)}
                            className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                        />
                    )}
                    {entry.lengthSeconds > 0 ? (
                        <span className="absolute right-1.5 bottom-1.5 rounded bg-black/75 px-1 py-px text-[11px] font-medium text-white tabular-nums">
                            {formatLength(entry.lengthSeconds)}
                        </span>
                    ) : null}
                </div>
                <p
                    className="mt-2 line-clamp-2 text-[13px] leading-snug font-medium"
                    title={title}
                >
                    {title}
                </p>
                <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                    {entry.channel ? `${entry.channel} · ` : ""}
                    {new Date(entry.watchedAt).toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                    })}
                </p>
            </a>
            <button
                type="button"
                aria-label={`Remove ${title} from history`}
                onClick={onRemove}
                className="absolute top-1.5 right-1.5 flex size-7 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-black/80 focus-visible:opacity-100 focus-visible:ring-[3px] focus-visible:ring-white/60 focus-visible:outline-none"
            >
                <X className="size-3.5" strokeWidth={2.2} />
            </button>
        </li>
    );
}

/** Recently watched Shorts, newest first, kept only in this browser. */
export function HistoryView() {
    const { history, remove, clear } = useHistory();
    const { settings, save } = useSettings();
    const [query, setQuery] = useState("");
    const [confirmingClear, setConfirmingClear] = useState(false);

    // The confirm step undoes itself if it isn't taken.
    useEffect(() => {
        if (!confirmingClear) return undefined;
        const timer = setTimeout(() => setConfirmingClear(false), 4000);
        return () => clearTimeout(timer);
    }, [confirmingClear]);

    const groups = useMemo(() => {
        const needle = query.trim().toLowerCase();
        const matches = needle
            ? (history ?? []).filter(({ title, channel }) =>
                  `${title} ${channel}`.toLowerCase().includes(needle),
              )
            : (history ?? []);
        return groupByDay(matches);
    }, [history, query]);

    if (!history || !settings) return <PageLoader />;

    return (
        <>
            <div className="flex flex-wrap items-end gap-3 px-0.5">
                <div className="min-w-0 flex-1">
                    <h2 className="text-[19px] leading-tight font-semibold tracking-tight">
                        History
                    </h2>
                    <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                        Your last {HISTORY_LIMIT} Shorts, saved only in this
                        browser.
                    </p>
                </div>
                <label className="flex shrink-0 cursor-pointer items-center gap-2 text-[13px] text-muted-foreground">
                    Save history
                    <Switch
                        checked={settings.historyEnabled}
                        onCheckedChange={(historyEnabled) =>
                            void save({ historyEnabled })
                        }
                    />
                </label>
            </div>

            {history.length > 0 ? (
                <div className="mt-5 flex gap-2">
                    <div className="relative min-w-0 flex-1">
                        <Search
                            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                            strokeWidth={2}
                        />
                        <Input
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search titles and channels"
                            aria-label="Search history"
                            className="border-edge bg-card ps-9"
                        />
                    </div>
                    <Button
                        variant={confirmingClear ? "destructive" : "outline"}
                        className={confirmingClear ? "" : "border-edge"}
                        onClick={() => {
                            if (!confirmingClear) {
                                setConfirmingClear(true);
                                return;
                            }
                            setConfirmingClear(false);
                            void clear();
                        }}
                    >
                        <Trash2 strokeWidth={2} />
                        {confirmingClear ? "Clear all?" : "Clear"}
                    </Button>
                </div>
            ) : null}

            {history.length === 0 ? (
                <Card className="mt-6 items-center gap-2 rounded-md border-edge px-6 py-12 text-center shadow-none">
                    <History
                        className="size-6 text-muted-foreground"
                        strokeWidth={1.75}
                    />
                    <p className="text-[14px] font-medium">
                        {settings.historyEnabled
                            ? "Nothing here yet"
                            : "History is off"}
                    </p>
                    <p className="max-w-sm text-[13px] text-muted-foreground">
                        {settings.historyEnabled
                            ? "A Short shows up here once you've watched half of it."
                            : "Turn on Save history to keep a list of the Shorts you watch."}
                    </p>
                </Card>
            ) : groups.length === 0 ? (
                <p className="mt-10 text-center text-[13px] text-muted-foreground">
                    No Shorts match “{query.trim()}”.
                </p>
            ) : (
                <div className="mt-6 space-y-8">
                    {groups.map(({ day, entries }) => (
                        <section key={day} className="space-y-3">
                            <h3 className="px-0.5 text-[15px] leading-tight font-semibold tracking-tight">
                                {dayLabel(day)}
                            </h3>
                            <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-5">
                                {entries.map((entry) => (
                                    <ShortCard
                                        key={entry.id}
                                        entry={entry}
                                        onRemove={() => void remove(entry.id)}
                                    />
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            )}

            <p className="mt-10 text-center text-[12px] text-muted-foreground">
                History never leaves your browser. Thumbnails load from
                YouTube's image server when this page opens.
            </p>
        </>
    );
}
