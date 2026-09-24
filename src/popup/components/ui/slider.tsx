import * as React from "react";
import { cn } from "@/popup/lib/utils";
import { Slider as SliderPrimitive } from "radix-ui";

function Slider({
    className,
    ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
    return (
        <SliderPrimitive.Root
            data-slot="slider"
            className={cn(
                "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50",
                className,
            )}
            {...props}
        >
            <SliderPrimitive.Track
                data-slot="slider-track"
                className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-input"
            >
                <SliderPrimitive.Range
                    data-slot="slider-range"
                    className="absolute h-full bg-primary"
                />
            </SliderPrimitive.Track>
            <SliderPrimitive.Thumb
                data-slot="slider-thumb"
                className="block size-4 shrink-0 cursor-pointer rounded-full border border-primary bg-white shadow-sm transition-[color,box-shadow] hover:ring-4 hover:ring-ring/30 focus-visible:ring-4 focus-visible:ring-ring/40 focus-visible:outline-hidden"
            />
        </SliderPrimitive.Root>
    );
}

export { Slider };
