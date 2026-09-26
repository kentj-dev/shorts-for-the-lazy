import { Card } from "@/popup/components/ui/card";
import { cn } from "@/popup/lib/utils";
import type { ReactNode } from "react";

interface SettingSectionProps {
    /** Lets the Settings pills scroll to this section. */
    id?: string;
    title: string;
    description?: string;
    children: ReactNode;
    className?: string;
    /** Extra classes for the card around the rows. */
    cardClassName?: string;
}

/** A titled group of rows: heading and subtitle outside, rows in one card. */
export function SettingSection({
    id,
    title,
    description,
    children,
    className,
    cardClassName,
}: SettingSectionProps) {
    return (
        <section
            id={id}
            // Room above the heading when a Settings pill scrolls here.
            className={cn("scroll-mt-3 space-y-1.5", className)}
        >
            <div className="px-0.5">
                <h2 className="px-0.5 text-[15px] leading-tight font-semibold tracking-tight">
                    {title}
                </h2>
                {description ? (
                    <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
                        {description}
                    </p>
                ) : null}
            </div>
            <Card
                className={cn(
                    "gap-0 divide-y divide-border py-0 shadow-none rounded-md border-edge",
                    cardClassName,
                )}
            >
                {children}
            </Card>
        </section>
    );
}
