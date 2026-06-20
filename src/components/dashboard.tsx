"use client";

import { useState } from "react";
import {
  Wallet,
  TrendingUp,
  ShieldCheck,
  Fingerprint,
  RefreshCw,
  Cpu,
  ArrowUpRight,
  ChevronRight,
  MemoryStick,
  Activity,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SITE } from "@/lib/site";
import type {
  AgentStatus,
  ModelDirectory,
  ModelDirectoryEntry,
} from "@/lib/cocore";

const nf = new Intl.NumberFormat("en-US");

function relTime(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function shortDid(did: string) {
  return did.length <= 28 ? did : `${did.slice(0, 18)}…${did.slice(-6)}`;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="font-mono text-2xl font-semibold tracking-tight">
          {value}
        </div>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function ModelRow({ m }: { m: ModelDirectoryEntry }) {
  const [open, setOpen] = useState(false);
  const day = m.activity?.day;
  return (
    <>
      <tr
        className="cursor-pointer border-b last:border-0 hover:bg-accent/40"
        onClick={() => setOpen((v) => !v)}
      >
        <td className="py-2 pr-2 align-top">
          <ChevronRight
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              open && "rotate-90"
            )}
          />
        </td>
        <td className="py-2 pr-4 align-top">
          <span className="break-all">{m.modelId}</span>
        </td>
        <td className="py-2 pr-4 text-right align-top">{m.machineCount}</td>
        <td className="py-2 pr-4 text-right align-top text-muted-foreground">
          {day ? nf.format(day.requests) : "—"}
        </td>
        <td className="py-2 pr-4 text-right align-top text-muted-foreground">
          {m.inputPricePerMTok === null ? "—" : nf.format(m.inputPricePerMTok)}
        </td>
        <td className="py-2 text-right align-top text-muted-foreground">
          {m.outputPricePerMTok === null
            ? "—"
            : nf.format(m.outputPricePerMTok)}
        </td>
      </tr>
      {open && (
        <tr className="border-b last:border-0 bg-muted/30">
          <td />
          <td colSpan={5} className="py-3 pr-4">
            <div className="space-y-2">
              {m.machines.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No per-machine detail reported.
                </p>
              )}
              {m.machines.map((mc) => (
                <div
                  key={mc.did}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border bg-background px-3 py-2 text-xs"
                >
                  <span className="font-medium">
                    {mc.machineLabel || shortDid(mc.did)}
                  </span>
                  {mc.chip && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Cpu className="h-3 w-3" />
                      {mc.chip}
                    </span>
                  )}
                  {mc.ramGB != null && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <MemoryStick className="h-3 w-3" />
                      {mc.ramGB} GB
                    </span>
                  )}
                  {mc.activity?.day && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Activity className="h-3 w-3" />
                      {nf.format(mc.activity.day.requests)} req /{" "}
                      {nf.format(mc.activity.day.tokens)} tok · 24h
                    </span>
                  )}
                  <span className="ml-auto text-muted-foreground">
                    seen {relTime(mc.lastSeen)}
                  </span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function Dashboard({
  initialStatus,
  initialLatestVersion,
  directory,
}: {
  initialStatus: AgentStatus;
  initialLatestVersion: string | null;
  directory: ModelDirectory | null;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [latestVersion, setLatestVersion] = useState(initialLatestVersion);
  const [dir, setDir] = useState(directory);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setRefreshing(true);
    setError(null);
    try {
      const [statusRes, dirRes] = await Promise.all([
        fetch("/api/status", { cache: "no-store" }),
        fetch("/api/models?view=directory", { cache: "no-store" }),
      ]);
      const statusData = await statusRes.json();
      if (!statusRes.ok) {
        setError(statusData.error ?? "Could not refresh");
        return;
      }
      setStatus(statusData.status);
      setLatestVersion(statusData.latestVersion);
      if (dirRes.ok) setDir(await dirRes.json());
    } catch {
      setError("Network error");
    } finally {
      setRefreshing(false);
    }
  }

  const currency = status.currency || "credits";
  const outdated =
    !!latestVersion &&
    !!status.agentVersion &&
    latestVersion.replace(/^v/, "") !== status.agentVersion.replace(/^v/, "");

  const models = dir?.models ?? [];
  const totalMachines = models.reduce((acc, m) => acc + m.machineCount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Here&apos;s where you stand on the network today.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={refreshing}
        >
          <RefreshCw
            className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"}
          />
          Refresh
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Wallet}
          label="Credit balance"
          value={status.balance === null ? "—" : nf.format(status.balance)}
          sub={currency}
        />
        <StatCard
          icon={TrendingUp}
          label="Earned (24h)"
          value={nf.format(status.earned24h)}
          sub={`${currency} from served jobs`}
        />
        <StatCard
          icon={ShieldCheck}
          label="Trust level"
          value={
            <span className="text-base">{status.trustLevel ?? "unknown"}</span>
          }
          sub="provider attestation"
        />
        <StatCard
          icon={Cpu}
          label="Agent version"
          value={
            <span className="text-base">{status.agentVersion ?? "—"}</span>
          }
          sub={
            outdated ? (
              <span className="text-primary">
                update available → {latestVersion}
              </span>
            ) : (
              `latest: ${latestVersion ?? "—"}`
            )
          }
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Fingerprint className="h-4 w-4" />
            Decentralized identity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <code className="break-all font-mono text-sm">{status.did}</code>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Network · models being served</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Click a row for per-machine detail (chip, RAM, 24h activity).
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Badge variant="secondary">{models.length} models</Badge>
            <Badge variant="secondary">{totalMachines} machines</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {dir?.appviewUnreachable && (
            <p className="mb-3 text-xs text-destructive">
              Directory served from an empty set — the AppView may be
              unreachable.
            </p>
          )}
          {models.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No models are being served right now.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="w-6 py-2" />
                    <th className="py-2 pr-4 font-medium">Model</th>
                    <th className="py-2 pr-4 text-right font-medium">Machines</th>
                    <th className="py-2 pr-4 text-right font-medium">Req 24h</th>
                    <th className="py-2 pr-4 text-right font-medium">In /MTok</th>
                    <th className="py-2 text-right font-medium">Out /MTok</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {[...models]
                    .sort((a, b) => b.machineCount - a.machineCount)
                    .map((m) => (
                      <ModelRow key={m.modelId} m={m} />
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <a
        href={SITE.consoleUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        Open co/core console
        <ArrowUpRight className="h-3 w-3" />
      </a>
    </div>
  );
}
