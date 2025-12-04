// Network Configuration
export const AVALANCHE_FUJI_CHAIN_ID = 43113;

// Token Addresses (Avalanche Fuji Testnet)
export const USDC_FUJI_ADDRESS = "0x5425890298aed601595a70AB815c96711a31Bc65" as `0x${string}`;

const normalizeBase = (value?: string) => {
  if (!value) return "";
  return value.replace(/\/+$/, "");
};

// External Sabaki feeds (public for UI, monetized via proxy)
export const SABAKI_FEED_URL = process.env.SABAKI_FEED_URL || "https://sabaki.ai/feed";
export const SABAKI_PM_URL = process.env.SABAKI_PM_URL || "https://sabaki.ai/pm";

// API Configuration (this Next app)
export const API_BASE_URL = normalizeBase(process.env.NEXT_PUBLIC_API_BASE_URL) || "";
export const API_ENDPOINTS = {
  FEED: `${API_BASE_URL}/api/facts/feed`,
  PM: `${API_BASE_URL}/api/facts/pm`,
} as const;

// Payment Amounts (USDC with 6 decimals)
export const PAYMENT_AMOUNTS = {
  FEED: {
    amount: "10000", // $0.01 USDC
    bigInt: BigInt(10000),
  },
  PM: {
    amount: "150000", // $0.15 USDC
    bigInt: BigInt(150000),
  },
} as const;

export const FACT_PRICE_AMOUNT = process.env.FACT_PRICE_AMOUNT || "250000";
