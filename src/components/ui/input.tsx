import * as React from "react";
import { cn } from "../../lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn("flex h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-base shadow-sm outline-none transition-colors placeholder:text-stone-400 focus-visible:border-green-800 focus-visible:ring-2 focus-visible:ring-green-800/20 disabled:opacity-60", className)}
      {...props}
    />
  );
}

export { Input };
