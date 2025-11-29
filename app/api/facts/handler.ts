import { createThirdwebClient } from "thirdweb";
import { settlePayment, facilitator } from "thirdweb/x402";
import { avalancheFuji } from "thirdweb/chains";
import { USDC_FUJI_ADDRESS } from "@/lib/constants";

type FactConfig = {
  resource: "feed" | "pm";
  upstreamUrl: string;
  priceAmount: string;
};

const client = createThirdwebClient({
  secretKey: process.env.THIRDWEB_SECRET_KEY!,
});

const thirdwebFacilitator = facilitator({
  client,
  serverWalletAddress: process.env.THIRDWEB_SERVER_WALLET_ADDRESS!,
});

const mergeSearchParams = (upstreamUrl: string, requestUrl: string) => {
  const upstream = new URL(upstreamUrl);
  const incoming = new URL(requestUrl);
  incoming.searchParams.forEach((value, key) => {
    upstream.searchParams.set(key, value);
  });
  return upstream.toString();
};

export function createFactHandler(config: FactConfig) {
  return async function handler(request: Request) {
    const paymentData =
      request.headers.get("x-payment") ?? request.headers.get("X-PAYMENT");

    const upstreamUrl = mergeSearchParams(config.upstreamUrl, request.url);

    const result = await settlePayment({
      resourceUrl: upstreamUrl,
      method: request.method,
      paymentData,
      payTo: process.env.MERCHANT_WALLET_ADDRESS!,
      network: avalancheFuji,
      price: {
        amount: config.priceAmount,
        asset: {
          address: USDC_FUJI_ADDRESS,
        },
      },
      facilitator: thirdwebFacilitator,
    });

    if (result.status !== 200) {
      return new Response(JSON.stringify(result.responseBody), {
        status: result.status,
        headers: result.responseHeaders,
      });
    }

    const upstreamResponse = await fetch(upstreamUrl, {
      headers: {
        accept: request.headers.get("accept") || "application/json",
      },
      cache: "no-store",
    });

    if (!upstreamResponse.ok) {
      return Response.json(
        {
          error: `Upstream ${config.resource} responded with ${upstreamResponse.status}`,
        },
        { status: 502 },
      );
    }

    const body = await upstreamResponse.text();
    const headers = new Headers(result.responseHeaders);
    const upstreamType = upstreamResponse.headers.get("content-type");
    headers.set("Cache-Control", "no-store");
    headers.set("Content-Type", upstreamType || "application/json");

    return new Response(body, {
      status: 200,
      headers,
    });
  };
}

