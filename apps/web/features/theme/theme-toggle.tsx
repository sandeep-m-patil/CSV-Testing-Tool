"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function ThemeToggle({ align = "end" }: { align?: "start" | "end" }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="h-9 w-[104px] rounded-md border border-input" aria-hidden />;
  }

  const active = theme ?? "system";
  const current = active === "system" ? "system" : resolvedTheme === "dark" ? "dark" : "light";

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="inline-flex items-center gap-0.5 rounded-md border border-input bg-background p-0.5"
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const isActive = current === option.value;
        return (
          <Button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={option.label}
            title={`${option.label} theme`}
            data-testid={`theme-${option.value}`}
            variant="ghost"
            size="icon"
            onClick={() => setTheme(option.value)}
            className={`h-7 w-7 rounded-sm ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            <Icon className="h-3.5 w-3.5" />
          </Button>
        );
      })}
    </div>
  );
}
