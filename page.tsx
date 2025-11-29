"use client";

import { useState, useEffect } from "react";
import { createThirdwebClient } from "thirdweb";
import { wrapFetchWithPayment } from "thirdweb/x402";
import { ConnectButton, useActiveWallet, useActiveAccount } from "thirdweb/react";
import { PaymentCard } from "@/components/payment-card";
import { ContentDisplay } from "@/components/content-display";
import { TransactionLog, LogEntry } from "@/components/transaction-log";
import { Separator } from "@/components/ui/separator";
import { createNormalizedFetch } from "@/lib/payment";
import { AVALANCHE_FUJI_CHAIN_ID, PAYMENT_AMOUNTS, API_ENDPOINTS } from "@/lib/constants";

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
});

type ResourceTier = "feed" | "pm";

const RESOURCE_CONFIG: Record<
  ResourceTier,
  {
    label: string;
    description: string;
    priceLabel: string;
    endpoint: string;
    price: bigint;
    notes: string[];
  }
> = {
  feed: {
    label: "EPS Fact Feed",
    description: "Pay-per-fact access to Sabaki's posted EPS attestations.",
    priceLabel: "$0.01",
    endpoint: API_ENDPOINTS.FEED,
    price: PAYMENT_AMOUNTS.FEED.bigInt,
    notes: [
      "Full JSON payload from sabaki.ai/feed",
      "Includes tx hashes, AI votes, and evidence hashes",
      "Great for agents that need verified EPS facts",
    ],
  },
  pm: {
    label: "Polymarket Snapshot",
    description: "Mirror of sabaki.ai/pm with resolved + pending markets.",
    priceLabel: "$0.15",
    endpoint: API_ENDPOINTS.PM,
    price: PAYMENT_AMOUNTS.PM.bigInt,
    notes: [
      "All normalized Polymarket markets",
      "Resolved date + outcome metadata",
      "Use for cross-checking predictions",
    ],
  },
};

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

      const normalizedFetch = createNormalizedFetch(AVALANCHE_FUJI_CHAIN_ID);
      const fetchWithPay = wrapFetchWithPayment(normalizedFetch, client, wallet, config.price);

      addLog("Requesting payment authorization...", "info");
      const response = await fetchWithPay(config.endpoint);
      const paymentReceipt = response.headers.get("x-payment-response");

      const payload = await response.json();

      if (response.status === 200) {
        updateLogStatus("Initiating", "success");
        updateLogStatus("Requesting payment authorization", "success");
        addLog("Payment successful!", "success");
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
        const errorMsg = (payload as { error?: string; errorMessage?: string })?.errorMessage || (payload as { error?: string })?.error || "Unknown error";
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center space-y-6 p-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Sabaki x402 Demo</h1>
            <p className="text-muted-foreground">Pay-per-fact access on Avalanche Fuji</p>
            <p className="text-sm text-muted-foreground mt-1">Connect a wallet to begin</p>
          </div>
          <ConnectButton client={client} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">Sabaki Fact Base • x402 Paywall</h1>
          <p className="text-muted-foreground">Buy auditable data feeds via HTTP 402 + Thirdweb</p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <ConnectButton client={client} />
          </div>
        </div>

        <Separator />

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
      </div>
    </div>
  );
}
