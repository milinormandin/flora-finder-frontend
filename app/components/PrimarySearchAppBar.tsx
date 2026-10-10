"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, Compass, Leaf, Map } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Explore", icon: Compass },
  { href: "/map", label: "Map", icon: Map },
  { href: "/plant_list", label: "My Plant List", icon: Bookmark },
];

export default function PrimarySearchAppBar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" || pathname.startsWith("/plant/") : pathname === href;

  return (
    <>
      <header className="border-b border-border bg-background">
        <div className="page-container flex h-[var(--app-header-height)] items-center justify-between gap-4">
          <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-md" aria-label="Flora Finder home">
            <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-card text-primary">
              <Leaf className="size-5" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <span className="text-[17px] font-semibold tracking-[-0.03em]">Flora Finder</span>
          </Link>

          <nav aria-label="Main navigation" className="hidden h-full items-center gap-8 md:flex">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={cn(
                  "flex h-full items-center border-b-2 px-0.5 text-sm font-medium transition-colors",
                  isActive(href)
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className="mx-auto grid h-[72px] max-w-lg grid-cols-3 gap-2 px-4 py-2">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-medium transition-colors",
                isActive(href)
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
              )}
            >
              <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
