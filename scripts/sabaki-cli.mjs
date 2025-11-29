#!/usr/bin/env node
import { createThirdwebClient } from "thirdweb";
import { wrapFetchWithPayment } from "thirdweb/x402";
import { privateKeyToAccount } from "thirdweb/wallets";
import { avalancheFuji } from "thirdweb/chains";

const RESOURCE_MAP = {
  feed: {
    endpoint: "/api/facts/feed",
    maxValue: BigInt(10000), // $0.01 USDC (6 decimals)
  },
  pm: {
    endpoint: "/api/facts/pm",
    maxValue: BigInt(150000), // $0.15 USDC
  },
};

const decodeBase64 = (value) => Buffer.from(value, "base64").toString("utf8");
const encodeBase64 = (value) => Buffer.from(value, "utf8").toString("base64");

const normalizeSignatureV = (signature, chainId) => {
  const vHex = signature.slice(130);
  const vValue = parseInt(vHex, 16);
  let normalizedV = vValue;

  if (vValue === 0 || vValue === 1) {
    normalizedV = vValue + 27;
  } else if (vValue >= 35) {
    const yParity = (vValue - 35 - chainId * 2) % 2;
    normalizedV = yParity + 27;
  }

  return signature.slice(0, 130) + normalizedV.toString(16).padStart(2, "0");
};

const createNormalizedFetch = (chainId) => {
  return async (input, init) => {
    let paymentHeader = null;
    if (init?.headers instanceof Headers) {
      paymentHeader = init.headers.get("x-payment") || init.headers.get("X-PAYMENT");
    } else if (init?.headers && typeof init.headers === "object") {
      paymentHeader = init.headers["x-payment"] || init.headers["X-PAYMENT"];
    }

    if (paymentHeader) {
      try {
        const decoded = JSON.parse(decodeBase64(paymentHeader));
        if (decoded.payload?.signature) {
          decoded.payload.signature = normalizeSignatureV(decoded.payload.signature, chainId);
          const normalizedHeader = encodeBase64(JSON.stringify(decoded));

          if (init?.headers instanceof Headers) {
            init.headers.set("X-PAYMENT", normalizedHeader);
          } else if (init?.headers && typeof init.headers === "object") {
            delete init.headers["x-payment"];
            delete init.headers["X-PAYMENT"];
            init.headers["X-PAYMENT"] = normalizedHeader;
          }
        }
      } catch (err) {
        console.warn("Unable to normalize signature:", err);
      }
    }

    return fetch(input, init);
  };
};

const parseArgs = () => {
  const [, , cmd, ...rest] = process.argv;
  const args = {};

  for (let i = 0; i < rest.length; i++) {
    const part = rest[i];
    if (part.startsWith("--")) {
      const [key, value] = part.split("=");
      if (value !== undefined) {
        args[key.slice(2)] = value;
      } else {
        args[key.slice(2)] = rest[i + 1];
        i += 1;
      }
    } else if (!args._) {
      args._ = [];
      args._.push(part);
    } else {
      args._.push(part);
    }
  }

  return { command: cmd, options: args };
};

const help = () => {
  console.log(`
Usage:
  sabaki-cli fetch --resource <feed|pm>

Environment:
  THIRDWEB_SECRET_KEY        Thirdweb server secret key
  X402_CLI_PRIVATE_KEY       Private key used to sign x402 payments
  CLI_API_BASE_URL           Base URL of the x402 proxy (default: http://localhost:3000)
  NEXT_PUBLIC_THIRDWEB_CLIENT_ID (optional) fallback for client creation
`);
};

const main = async () => {
  const { command, options } = parseArgs();

  if (command !== "fetch" || !options.resource) {
    help();
    process.exit(command ? 1 : 0);
  }

  const resource = options.resource;
  if (!(resource in RESOURCE_MAP)) {
    console.error(`Unknown resource "${resource}". Use "feed" or "pm".`);
    process.exit(1);
  }

  const secretKey = process.env.THIRDWEB_SECRET_KEY;
  const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;
  const privateKey = process.env.X402_CLI_PRIVATE_KEY;

  if (!secretKey && !clientId) {
    console.error("Missing THIRDWEB_SECRET_KEY or NEXT_PUBLIC_THIRDWEB_CLIENT_ID.");
    process.exit(1);
  }

  if (!privateKey) {
    console.error("Missing X402_CLI_PRIVATE_KEY in environment.");
    process.exit(1);
  }

  const base = (process.env.CLI_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
  const endpoint = `${base}${RESOURCE_MAP[resource].endpoint}`;

  const client = createThirdwebClient(
    secretKey
      ? { secretKey }
      : { clientId: clientId! },
  );

  const account = privateKeyToAccount({
    client,
    privateKey,
  });

  let currentChain = avalancheFuji;

  const wallet = {
    id: "sabaki.cli",
    getChain: () => currentChain,
    getAccount: () => account,
    autoConnect: async () => account,
    connect: async () => account,
    disconnect: async () => {},
    switchChain: async (chain) => {
      currentChain = chain;
    },
    subscribe: () => () => {},
    getConfig: () => ({}),
  };

  const normalizedFetch = createNormalizedFetch(avalancheFuji.id);
  const fetchWithPay = wrapFetchWithPayment(normalizedFetch, client, wallet, RESOURCE_MAP[resource].maxValue);

  console.log(`→ Fetching ${resource} facts via ${endpoint}`);
  const response = await fetchWithPay(endpoint);
  const receipt = response.headers.get("x-payment-response");
  const rawBody = await response.text();

  if (response.status !== 200) {
    console.error("Payment failed:", rawBody);
    process.exit(1);
  }

  let parsed;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    parsed = rawBody;
  }

  console.log(`✅ Payment settled${receipt ? ` (receipt: ${receipt})` : ""}`);
  console.log(JSON.stringify(parsed, null, 2));
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

