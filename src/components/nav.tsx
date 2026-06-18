"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, LayoutDashboard, MessagesSquare, Github } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SITE } from "@/lib/site";

const links = [
  { href: "/", label: "Chat", icon: MessagesSquare },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
        <Link href="/" className="mr-3 flex items-center gap-2 text-sm">
          <span className="grid h-7 w-7 place-items-center rounded-xl bg-primary text-primary-foreground text-xs font-extrabold">
            co
          </span>
          <span className="font-bold tracking-tight">co/core</span>
        </Link>
        <Badge variant="outline" className="mr-2 hidden sm:inline-flex">
          demo
        </Badge>

        <nav className="flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Button
                key={href}
                asChild
                variant={active ? "secondary" : "ghost"}
                size="sm"
              >
                <Link href={href} className={cn(active && "font-semibold")}>
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              </Button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <Button asChild variant="ghost" size="icon" title="Source on GitHub">
            <a href={SITE.repoUrl} target="_blank" rel="noreferrer">
              <Github className="h-4 w-4" />
              <span className="sr-only">Source on GitHub</span>
            </a>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            disabled={loggingOut}
          >
            <LogOut className="h-4 w-4" />
            {loggingOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </div>
    </header>
  );
}
