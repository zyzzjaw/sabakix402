"use client";

import { useState, useEffect, type ReactNode } from "react";
import { createThirdwebClient } from "thirdweb";
import { wrapFetchWithPayment } from "thirdweb/x402";
import { ConnectButton, useActiveWallet, useActiveAccount } from "thirdweb/react";
import { createWallet } from "thirdweb/wallets";
import { PaymentCard } from "@/components/payment-card";
import { ContentDisplay } from "@/components/content-display";
import { TransactionLog, LogEntry } from "@/components/transaction-log";
import { Separator } from "@/components/ui/separator";
import { createNormalizedFetch } from "@/lib/payment";
import { AVALANCHE_FUJI_CHAIN_ID, PAYMENT_AMOUNTS, API_ENDPOINTS, API_BASE_URL } from "@/lib/constants";

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
});

const wallets = [createWallet("io.metamask")];

type ResourceTier = "eps" | "pm";

type ResourceConfig = {
    label: string;
    description: string;
    priceLabel: string;
    endpoint: string;
    price: bigint;
    notes: string[];
  badgeText?: string;
  disabled?: boolean;
  disabledLabel?: string;
};

const RESOURCE_CONFIG: Record<ResourceTier, ResourceConfig> = {
  eps: {
    label: "EPS Fact Bundle",
    description: "Pay-per-fact access to Sabaki's posted EPS attestations.",
    priceLabel: "0.01",
    // Point directly to a sample fact endpoint (ICUI CY2025Q3)
    endpoint: `${API_BASE_URL || ""}/api/facts/ICUI?period=CY2025Q3`,
    price: PAYMENT_AMOUNTS.FEED.bigInt,
    notes: [
      "Returns the same JSON exposed at /api/facts/{ticker}",
      "Includes ledger hashes + live SP500Oracle proofs",
      "Enable dev mode by sending header x-skip-payment: 1 (ALLOW_UNPAID_FACTS must be true)",
    ],
  },
  pm: {
    label: "Polymarket Snapshot",
    description: "Mirror of sabaki.ai/pm (coming soon).",
    priceLabel: "0.015",
    endpoint: API_ENDPOINTS.PM,
    price: PAYMENT_AMOUNTS.PM.bigInt,
    notes: [
      "Future add-on: normalized Polymarket markets",
      "Resolved + pending metadata for cross-checking predictions",
      "Not available in this hackathon build",
    ],
    badgeText: "soon",
    disabled: true,
    disabledLabel: "In Progress",
  },
};

const AGENT_INFO = {
  agentId: 1,
  registry: "0x947B58885eee5f47C12a1B4320fFc7DC34aC6652",
  registryDisplay: "0x947B...6652",
  agentJson: "https://facts.sabaki.ai/agent.json",
  contract: "0xA17b8A538286f0415e0a5166440f0E452BF35968",
};

const PageShell = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 p-8">
    <div className="max-w-7xl mx-auto space-y-8">{children}</div>
  </div>
);

interface ContentData {
  resource: ResourceTier;
  source: string;
  count?: number;
  payload: unknown;
  paymentReceipt?: string | null;
  timestamp: string;
}

export default function Home() {
  const wallet = useActiveWallet();
  const account = useActiveAccount();
  const [content, setContent] = useState<ContentData | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isPaying, setIsPaying] = useState<ResourceTier | null>(null);
  const [devMode, setDevMode] = useState(false);

  useEffect(() => {
    setLogs([]);
    setContent(null);
  }, [wallet, account?.address]);

  const addLog = (message: string, type: LogEntry["type"]) => {
    setLogs((prev) => [...prev, { message, type, timestamp: new Date() }]);
  };

  const updateLogStatus = (messagePattern: string, newType: LogEntry["type"]) => {
    setLogs((prev) =>
      prev.map((log) => (log.message.includes(messagePattern) ? { ...log, type: newType } : log)),
    );
  };

  const handlePayment = async (resource: ResourceTier) => {
    if (!wallet) return;

    setIsPaying(resource);
    setContent(null);
    setLogs([]);

    const config = RESOURCE_CONFIG[resource];

    try {
      addLog(`Initiating ${config.label} payment...`, "info");
      let response: Response;

      if (devMode) {
        addLog(
          "Dev mode enabled: skipping on-chain payment and calling endpoint with x-skip-payment: 1.",
          "info",
        );
        response = await fetch(config.endpoint, {
          headers: {
            "x-skip-payment": "1",
          },
        });
      } else {
        const normalizedFetch = createNormalizedFetch(AVALANCHE_FUJI_CHAIN_ID);
        const fetchWithPay = wrapFetchWithPayment(normalizedFetch, client, wallet, {
          maxValue: config.price,
        });

        addLog("Requesting payment authorization...", "info");
        response = await fetchWithPay(config.endpoint);
      }

      const paymentReceipt = response.headers.get("x-payment-response");

      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        // leave payload as null; handle below
      }

      if (response.status === 200 && payload !== null) {
        updateLogStatus("Initiating", "success");
        if (!devMode) {
          updateLogStatus("Requesting payment authorization", "success");
          addLog("Payment successful!", "success");
        } else {
          addLog("Dev mode: bundle fetched without payment.", "success");
        }
        addLog("Payload delivered", "success");

        const count = Array.isArray(payload) ? payload.length : undefined;

        setContent({
          resource,
          source: config.endpoint,
          count,
          payload,
          paymentReceipt,
          timestamp: new Date().toISOString(),
        });
      } else {
        updateLogStatus("Initiating", "error");
        updateLogStatus("Requesting payment authorization", "error");
        let errorMsg =
          (payload as { error?: string; errorMessage?: string })?.errorMessage ||
          (payload as { error?: string })?.error ||
          "Payment failed and no JSON body was returned";

        const lower = errorMsg.toLowerCase();
        if (
          lower.includes("does not have enough funds") ||
          lower.includes("not have enough funds") ||
          lower.includes("insufficient funds")
        ) {
          errorMsg +=
            " Your wallet doesn’t have enough testnet USDC on Avalanche Fuji. Visit https://faucet.circle.com/, select Avalanche Fuji, request 1 testnet USDC, then try again.";
        }

        addLog(`Payment failed: ${errorMsg}`, "error");
      }
    } catch (error) {
      updateLogStatus("Initiating", "error");
      updateLogStatus("Requesting payment authorization", "error");
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      addLog(`Error: ${errorMsg}`, "error");
    } finally {
      setIsPaying(null);
    }
  };

  if (!wallet) {
    return (
      <PageShell>
        <div className="flex items-center justify-center">
          <div className="text-center space-y-6 p-8 bg-slate-900/60 border border-slate-800 rounded-2xl shadow-lg max-w-xl w-full">
          <div>
            <h1 className="text-4xl font-bold mb-2">Sabaki x402 Demo</h1>
              <p className="text-slate-300">Pay-per-fact access on Avalanche Fuji</p>
              <p className="text-sm text-slate-400 mt-1">Connect a wallet to begin</p>
            </div>
            <ConnectButton client={client} wallets={wallets} />
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
        <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold">Sabaki EPS Fact Agent • Paid EPS Facts</h1>
        <p className="text-slate-300">On-chain audited earnings facts, paid per request on Avalanche Fuji</p>
          <div className="flex items-center justify-center gap-2 pt-2">
          <ConnectButton client={client} wallets={wallets} />
        </div>
      </div>

      <div className="bg-slate-900/70 border border-slate-800 rounded-xl shadow p-6 space-y-3 text-sm text-left">
        <p className="font-semibold">How to demo:</p>
        <ol className="list-decimal list-inside space-y-1 text-slate-300">
          <li>Connect a Fuji wallet and click the EPS Fact Bundle card to run the full x402 payment.</li>
          <li>
            No wallet? Send requests with header{" "}
            <code className="bg-slate-100 px-1 py-0.5 rounded">x-skip-payment: 1</code> (dev mode is
            enabled via ALLOW_UNPAID_FACTS), or toggle Dev mode below to hit the endpoint without
            paying.
          </li>
          <li>
            The JSON you see here is exactly what agents get from{" "}
            <code className="bg-slate-100 px-1 py-0.5 rounded">/api/facts/[ticker]</code>: it includes the reported
            EPS, the Polymarket consensus number, links back to the Fuji SP500Oracle attestation, and a payment
            receipt + signature so anyone can verify the call was paid for.
          </li>
        </ol>
        <div className="pt-2 flex items-center gap-2 text-slate-300 text-sm">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={devMode}
              onChange={(e) => setDevMode(e.target.checked)}
              className="h-4 w-4 rounded border-slate-600 bg-slate-900"
            />
            <span>
              Dev mode: call the fact endpoint without paying (sends{" "}
              <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-900">x-skip-payment: 1</code>
              ).
            </span>
          </label>
        </div>
      </div>

      <Separator />

      <div className="bg-slate-900/70 border border-slate-800 rounded-xl shadow p-6 space-y-4 text-left">
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-400">On-chain Agent Identity (ERC-8004)</p>
          <h2 className="text-2xl font-semibold">Sabaki EPS Fact Agent</h2>
          <p className="text-slate-300">
            This endpoint is registered as an ERC-8004 agent on Avalanche Fuji (agentId {AGENT_INFO.agentId}), so
            anyone can look up who owns it and what it claims to do before they trust or pay it.
          </p>
        </div>
        <div className="grid gap-3 text-sm">
          <div className="flex flex-col">
            <span className="text-slate-400">Registry Address</span>
            <code className="bg-slate-800 px-3 py-1 rounded w-fit text-slate-100 border border-slate-700">{AGENT_INFO.registry}</code>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-400">Agent Metadata</span>
            <a href={AGENT_INFO.agentJson} target="_blank" className="text-blue-400 underline">
              {AGENT_INFO.agentJson}
            </a>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-400">Fact Contract</span>
            <code className="bg-slate-800 px-3 py-1 rounded w-fit text-slate-100 border border-slate-700">{AGENT_INFO.contract}</code>
          </div>
        </div>
        <p className="text-xs text-slate-400">
          Tip: run{" "}
          <code className="bg-slate-800 px-1 py-0.5 rounded text-slate-100 border border-slate-700">
            cast call {AGENT_INFO.registry} &quot;tokenURI(uint256)&quot; {AGENT_INFO.agentId} --rpc-url
            fuji
          </code>{" "}
          (assuming your Foundry config sets the default Fuji RPC) to verify the metadata hash matches the URL above.
        </p>
      </div>

        <div className="flex flex-wrap justify-center gap-6">
          {(Object.keys(RESOURCE_CONFIG) as ResourceTier[]).map((resource) => {
            const config = RESOURCE_CONFIG[resource];
            return (
              <PaymentCard
                key={resource}
                tier={config.label}
                price={config.priceLabel}
                description={config.description}
                features={config.notes}
                onPayClick={() => handlePayment(resource)}
                isPaying={isPaying === resource}
              badgeText={config.badgeText}
              disabled={config.disabled}
              disabledLabel={config.disabledLabel}
              />
            );
          })}
        </div>

        {content && (
          <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <ContentDisplay
              resource={RESOURCE_CONFIG[content.resource].label}
              count={content.count}
              source={content.source}
              payload={content.payload}
              paymentReceipt={content.paymentReceipt}
              timestamp={content.timestamp}
            />
          </div>
        )}

        {logs.length > 0 && (
          <div className="max-w-4xl mx-auto animate-in fade-in-from-bottom-4 duration-700">
            <TransactionLog logs={logs} />
          </div>
        )}

      <div className="max-w-4xl mx-auto bg-slate-900/70 border border-slate-800 rounded-xl shadow p-6 space-y-3 text-sm text-left">
        <p className="text-sm uppercase tracking-wide text-slate-400">Where these facts come from</p>
        <p className="text-slate-300">
          Every paid EPS fact in this demo comes from the Sabaki extraction pipeline: we ingest SEC
          filings, extract Non-GAAP EPS, join against Polymarket targets, and post attestations with
          evidence and URL hashes to the SP500Oracle contract on Avalanche Fuji.
        </p>
        <p className="text-slate-300">
          The same underlying data powers the public Sabaki dashboard at{" "}
          <a href="https://sabaki.ai/" target="_blank" className="text-blue-400 underline">
            https://sabaki.ai/
          </a>
          , which lets you see the broader feed of attestations and the Polymarket Mirror view. This
          x402 page focuses on a single agent endpoint that sells those facts on a pay-per-fact basis.
        </p>
      </div>
    </PageShell>
  );
}
