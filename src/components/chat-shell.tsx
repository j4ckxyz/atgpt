"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Plus,
  LayoutDashboard,
  Github,
  LogOut,
  Wallet,
  X,
  Trash2,
  Pencil,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Chat } from "@/components/chat";
import { useConversations } from "@/hooks/use-conversations";
import { cn } from "@/lib/utils";
import { SITE } from "@/lib/site";

const nf = new Intl.NumberFormat("en-US");

export function ChatShell() {
  const router = useRouter();
  const {
    activeId,
    active,
    activeReady,
    history,
    newChat,
    selectChat,
    deleteChat,
    renameChat,
    setActiveMessages,
  } = useConversations();

  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [balance, setBalance] = useState<number | null | undefined>(undefined);
  const [currency, setCurrency] = useState("credits");
  const editRef = useRef<HTMLInputElement>(null);

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
  }, []);

  useEffect(() => {
    if (editingId) editRef.current?.focus();
  }, [editingId]);

  // Cmd/Ctrl+Shift+O starts a new chat (the current one is already saved).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        newChat();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newChat]);

  function handleNewChat() {
    newChat();
    setOpen(false);
  }

  function openChat(id: string) {
    selectChat(id);
    setOpen(false);
  }

  function commitRename() {
    if (editingId) renameChat(editingId, draftTitle);
    setEditingId(null);
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
          aria-hidden="true"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        id="sidebar-nav"
        aria-label="Navigation"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 -translate-x-full flex-col border-r bg-secondary/40 p-3 transition-transform duration-300 ease-out md:static md:translate-x-0",
          open && "translate-x-0"
        )}
      >
        <div className="mb-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm">
            <span className="grid h-7 w-7 place-items-center rounded-xl bg-primary text-sm font-extrabold text-primary-foreground">
              @
            </span>
            <span className="font-bold tracking-tight">atGPT</span>
            <Badge variant="outline" className="ml-1">
              beta
            </Badge>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Button
          variant="outline"
          className="justify-start bg-card"
          onClick={handleNewChat}
        >
          <Plus className="h-4 w-4" />
          New chat
        </Button>

        {/* History */}
        <div className="-mr-1 mt-4 flex min-h-0 flex-1 flex-col">
          <p className="px-2 pb-1.5 text-xs font-semibold text-muted-foreground">
            Recent
          </p>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {history.length === 0 ? (
              <p className="px-2 py-1 text-xs leading-relaxed text-muted-foreground">
                Your chats show up here, saved on this device only.
              </p>
            ) : (
              <ul className="space-y-0.5">
                {history.map((c) => {
                  const isActive = c.id === activeId;
                  const isEditing = c.id === editingId;
                  return (
                    <li key={c.id}>
                      {isEditing ? (
                        <Input
                          ref={editRef}
                          value={draftTitle}
                          onChange={(e) => setDraftTitle(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename();
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          className="h-8 bg-card text-sm"
                        />
                      ) : (
                        <div
                          className={cn(
                            "group flex min-h-[44px] items-center gap-1 rounded-lg px-2 py-2 text-sm transition-colors active:bg-accent/80",
                            isActive
                              ? "bg-accent text-accent-foreground"
                              : "hover:bg-accent/60"
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => openChat(c.id)}
                            className="min-w-0 flex-1 truncate text-left"
                            title={c.title}
                          >
                            {c.title}
                          </button>
                          <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
                            <button
                              type="button"
                              aria-label="Rename chat"
                              onClick={() => {
                                setEditingId(c.id);
                                setDraftTitle(c.title);
                              }}
                              className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground active:bg-background active:text-foreground"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label="Delete chat"
                              onClick={() => deleteChat(c.id)}
                              className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-background hover:text-destructive active:bg-background active:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="mt-2 space-y-2 border-t pt-3"
          style={{ paddingBottom: "max(0px, env(safe-area-inset-bottom))" }}
        >
          <Button asChild variant="ghost" className="h-9 w-full justify-start">
            <Link href="/dashboard">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
          </Button>
          <div className="flex items-center gap-2 rounded-lg bg-card px-3 py-2 text-sm">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">
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
        {activeReady ? (
          <Chat
            key={activeId}
            initialMessages={active?.messages ?? []}
            onMessagesChange={setActiveMessages}
            onMenu={() => setOpen(true)}
            onNewChat={handleNewChat}
          />
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}
