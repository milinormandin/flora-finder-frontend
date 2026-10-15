"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, Compass, Leaf, Map } from "lucide-react";
import { cn } from "@/lib/utils";
import PlantSearch from "./PlantSearch";

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
        <div className="page-container grid min-h-[var(--app-header-height)] grid-cols-[auto_1fr] items-center gap-x-6 gap-y-3 py-3 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:py-0">
          <Link href="/" className="flex h-11 shrink-0 items-center gap-2.5 rounded-md" aria-label="Flora Finder home">
            <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-card text-primary">
              <Leaf className="size-5" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <span className="text-[17px] font-semibold tracking-[-0.03em]">Flora Finder</span>
          </Link>

          <div className="col-span-2 min-w-0 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:mx-auto lg:w-full lg:max-w-md">
            <PlantSearch key={pathname} />
          </div>

          <nav aria-label="Main navigation" className="col-start-2 row-start-1 hidden h-11 items-center justify-self-end gap-6 md:flex lg:col-start-3 lg:h-[var(--app-header-height)] lg:gap-8">
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
