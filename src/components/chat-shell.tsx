"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Plus,
  LayoutDashboard,
  Github,
  LogOut,
  Wallet,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Chat } from "@/components/chat";
import { cn } from "@/lib/utils";
import { SITE } from "@/lib/site";

const nf = new Intl.NumberFormat("en-US");

export function ChatShell() {
  const router = useRouter();
  const [convKey, setConvKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [balance, setBalance] = useState<number | null | undefined>(undefined);
  const [currency, setCurrency] = useState("credits");

  useEffect(() => {
    fetch("/api/status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.status) {
          setBalance(d.status.balance);
          setCurrency(d.status.currency || "credits");
        }
      })
      .catch(() => {});
  }, [convKey]);

  function newChat() {
    setConvKey((k) => k + 1);
    setOpen(false);
  }

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 -translate-x-full flex-col border-r bg-card/50 p-3 transition-transform md:static md:translate-x-0",
          open && "translate-x-0"
        )}
      >
        <div className="mb-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm">
            <span className="grid h-7 w-7 place-items-center rounded-xl bg-primary text-xs font-extrabold text-primary-foreground">
              co
            </span>
            <span className="font-bold tracking-tight">co/core</span>
            <Badge variant="outline" className="ml-1">
              demo
            </Badge>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Button variant="outline" className="justify-start" onClick={newChat}>
          <Plus className="h-4 w-4" />
          New chat
        </Button>

        <Button
          asChild
          variant="ghost"
          className="mt-1 justify-start text-muted-foreground"
        >
          <Link href="/dashboard">
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
        </Button>

        <div className="flex-1 px-2 py-6">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Conversations aren&apos;t saved in this demo — &ldquo;New chat&rdquo;
            starts a fresh context.
          </p>
        </div>

        <div className="space-y-2 border-t pt-3">
          <div className="flex items-center gap-2 rounded-md bg-secondary/60 px-3 py-2 text-sm">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono">
              {balance === undefined
                ? "…"
                : balance === null
                  ? "—"
                  : nf.format(balance)}
            </span>
            <span className="text-xs text-muted-foreground">{currency}</span>
          </div>
          <div className="flex items-center justify-between">
            <Button asChild variant="ghost" size="sm">
              <a href={SITE.repoUrl} target="_blank" rel="noreferrer">
                <Github className="h-4 w-4" />
                Source
              </a>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              disabled={loggingOut}
            >
              <LogOut className="h-4 w-4" />
              {loggingOut ? "…" : "Sign out"}
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <Chat key={convKey} onMenu={() => setOpen(true)} onNewChat={newChat} />
      </div>
    </div>
  );
}
