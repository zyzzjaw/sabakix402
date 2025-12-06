import { NextRequest, NextResponse } from "next/server";
import { settlePayment } from "thirdweb/x402";
import { avalancheFuji } from "thirdweb/chains";

import {
  ensureFacilitator,
  ensureMerchantWallet,
  EnvVarMissingError,
  misconfiguredResponse,
} from "../handler";
import { loadFactCache, getFactFromCache } from "@/lib/factStore";
import { FACT_PRICE_AMOUNT } from "@/lib/constants";
import { readAttestation, SP500_ORACLE_ADDRESS } from "@/lib/onchain";
import { signBundle } from "@/lib/signing";

const ALLOW_UNPAID = process.env.ALLOW_UNPAID_FACTS === "true";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: any) {
  try {
    let facilitatorInstance: ReturnType<typeof ensureFacilitator>;
    let merchantWallet: string;
    try {
      facilitatorInstance = ensureFacilitator();
      merchantWallet = ensureMerchantWallet();
    } catch (err) {
      if (err instanceof EnvVarMissingError) {
        return misconfiguredResponse(err.missing);
      }
      throw err;
    }

    const ticker = context?.params?.ticker
      ? String(context.params.ticker).toUpperCase()
      : undefined;
    if (!ticker) {
      return NextResponse.json({ error: "missing_ticker_param" }, { status: 400 });
    }
    const periodParam = request.nextUrl.searchParams.get("period") ?? undefined;

    let cache;
    try {
      cache = await loadFactCache();
    } catch (err) {
      console.error("Failed to load fact cache:", err);
      return NextResponse.json(
        { error: "fact_cache_unavailable", message: err instanceof Error ? err.message : String(err) },
        { status: 500 },
      );
    }

    const record = getFactFromCache(cache, ticker, periodParam);
    if (!record) {
      return NextResponse.json({ error: "fact_not_found" }, { status: 404 });
    }

    const allowBypass =
      ALLOW_UNPAID && request.headers.get("x-skip-payment") === "1";

    let paymentReceipt: unknown = null;
    let responseHeaders = new Headers({
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    });

    if (!allowBypass) {
      const paymentData =
        request.headers.get("x-payment") ?? request.headers.get("X-PAYMENT");

      let settleResult;
      try {
        settleResult = await settlePayment({
          resourceUrl: request.url,
          method: request.method,
          paymentData,
          payTo: merchantWallet,
          network: avalancheFuji,
          price: FACT_PRICE_AMOUNT,
          facilitator: facilitatorInstance,
        });
      } catch (err) {
        console.error("settlePayment threw", err);
        return NextResponse.json(
          { error: "settle_exception", message: err instanceof Error ? err.message : String(err) },
          { status: 500 },
        );
      }

      if (settleResult.status !== 200) {
        const fallbackBody =
          settleResult.responseBody && Object.keys(settleResult.responseBody).length > 0
            ? settleResult.responseBody
            : { error: "settle_failed", status: settleResult.status, note: "empty settle body" };
        const headers = new Headers(settleResult.responseHeaders);
        headers.set("Content-Type", "application/json");
        return new Response(JSON.stringify(fallbackBody), {
          status: settleResult.status,
          headers,
        });
      }

      paymentReceipt = settleResult.paymentReceipt ?? null;
      responseHeaders = new Headers(settleResult.responseHeaders);
      responseHeaders.set("Cache-Control", "no-store");
      responseHeaders.set("Content-Type", "application/json");
    } else {
      paymentReceipt = {
        skipped: true,
        reason: "ALLOW_UNPAID_FACTS",
      };
    }

    const [onchainNonGaap, onchainConsensus] = await Promise.all([
      readAttestation({
        ticker: record.ticker,
        periodId: record.period_keccak,
        metricId: record.metric_ids.non_gaap_eps,
      }),
      readAttestation({
        ticker: record.ticker,
        periodId: record.period_keccak,
        metricId: record.metric_ids.consensus_eps,
      }),
    ]);

    const serializedOnchainNonGaap = onchainNonGaap
      ? { ...onchainNonGaap, value: onchainNonGaap.value.toString() }
      : null;
    const serializedOnchainConsensus = onchainConsensus
      ? { ...onchainConsensus, value: onchainConsensus.value.toString() }
      : null;

    const nowIso = new Date().toISOString();

    const basePayload: Record<string, unknown> = {
      schema_id: record.schema_id,
      ticker: record.ticker,
      periodId: record.periodId,
      facts: {
        non_gaap_eps: record.non_gaap_eps,
        consensus_eps: record.consensus_eps ?? record.pm_consensus_eps,
        pm_consensus_eps: record.pm_consensus_eps,
      },
      provenance: record.provenance,
      polymarket: {
        market_url: record.pm_market_url,
        chain_outcome: record.pm_chain_outcome,
        consensus_eps: record.pm_consensus_eps,
      },
      attestation: {
        contract: SP500_ORACLE_ADDRESS,
        ledger: record.attestation,
        on_chain: Boolean(serializedOnchainNonGaap) || Boolean(serializedOnchainConsensus),
        on_chain_non_gaap: serializedOnchainNonGaap,
        on_chain_consensus: serializedOnchainConsensus,
      },
      cache_generated_at: cache.meta.generated_at,
      generated_at: nowIso,
      payment_receipt: paymentReceipt,
    };

    const signed = await signBundle(basePayload);
    const responsePayload = signed
      ? { ...basePayload, signature: signed.signature, signer: signed.signer }
      : basePayload;

    return new NextResponse(JSON.stringify(responsePayload), {
      status: 200,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error("GET /api/facts error", err);
    return NextResponse.json(
      { error: "internal_error", message: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

