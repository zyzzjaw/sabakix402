import { createThirdwebClient } from "thirdweb";
import { settlePayment, facilitator } from "thirdweb/x402";
import { avalancheFuji } from "thirdweb/chains";

type FactConfig = {
  resource: "feed" | "pm";
  upstreamUrl: string;
  priceAmount: string;
};

export class EnvVarMissingError extends Error {
  constructor(readonly missing: string[]) {
    super(`Missing required environment variables: ${missing.join(", ")}`);
    this.name = "EnvVarMissingError";
  }
}

let cachedFacilitator: ReturnType<typeof facilitator> | null = null;

export const ensureFacilitator = () => {
  if (cachedFacilitator) return cachedFacilitator;

  const missing: string[] = [];
  const secretKey = process.env.THIRDWEB_SECRET_KEY;
  const serverWallet = process.env.THIRDWEB_SERVER_WALLET_ADDRESS;

  if (!secretKey) missing.push("THIRDWEB_SECRET_KEY");
  if (!serverWallet) missing.push("THIRDWEB_SERVER_WALLET_ADDRESS");

  if (missing.length) {
    throw new EnvVarMissingError(missing);
  }

  const safeSecretKey = secretKey as string;
  const safeServerWallet = serverWallet as string;

  const client = createThirdwebClient({ secretKey: safeSecretKey });
  cachedFacilitator = facilitator({
    client,
    serverWalletAddress: safeServerWallet,
  });

  return cachedFacilitator;
};

export const ensureMerchantWallet = () => {
  const merchant = process.env.MERCHANT_WALLET_ADDRESS;
  if (!merchant) {
    throw new EnvVarMissingError(["MERCHANT_WALLET_ADDRESS"]);
  }
  return merchant;
};

export const misconfiguredResponse = (missing: string[]) => {
  return new Response(
    JSON.stringify({
      error: "Server misconfiguration",
      missingEnv: missing,
    }),
    {
      status: 500,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    },
  );
};

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
    let facilitatorInstance: ReturnType<typeof facilitator>;
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

    const paymentData =
      request.headers.get("x-payment") ?? request.headers.get("X-PAYMENT");

    const upstreamUrl = mergeSearchParams(config.upstreamUrl, request.url);

    const result = await settlePayment({
      resourceUrl: upstreamUrl,
      method: request.method,
      paymentData,
      payTo: merchantWallet,
      network: avalancheFuji,
      price: config.priceAmount, // native AVAX (wei) on Fuji
      facilitator: facilitatorInstance,
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

