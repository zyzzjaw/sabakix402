import { createPublicClient, http, type Hex, keccak256, stringToBytes } from "viem";
import { avalancheFuji } from "viem/chains";
import SP500_ORACLE_ABI from "./abis/SP500Oracle.json";

export const DEFAULT_RPC_URL =
  process.env.FUJI_RPC_URL ?? "https://api.avax-test.network/ext/bc/C/rpc";
export const SP500_ORACLE_ADDRESS = (process.env.SP500_ORACLE_ADDR ??
  "0xA17b8A538286f0415e0a5166440f0E452BF35968") as Hex;

type OracleAbi = typeof SP500_ORACLE_ABI;

const clientCache = new Map<string, ReturnType<typeof createPublicClient<OracleAbi>>>();

function getClient(rpcUrl: string = DEFAULT_RPC_URL) {
  if (!clientCache.has(rpcUrl)) {
    clientCache.set(
      rpcUrl,
      createPublicClient({
        chain: avalancheFuji,
        transport: http(rpcUrl),
      }),
    );
  }
  return clientCache.get(rpcUrl)!;
}

export interface OnchainAttestation {
  periodId: Hex;
  metricId: Hex;
  evidenceHash: Hex;
  urlHash: Hex;
  value: bigint;
  decimals: number;
  normalizedValue: number;
  observedAt: number;
  sourceType: number;
  lastUpdated: number;
}

export const METRIC_LABELS = {
  NON_GAAP: "non-gaap:EPS",
  CONSENSUS: "consensus_eps",
};

export function toBytes32(value: string): Hex {
  return keccak256(stringToBytes(value));
}

export async function readAttestation(opts: {
  ticker: string;
  periodId: Hex;
  metricId: Hex;
  rpcUrl?: string;
  oracleAddress?: Hex;
}): Promise<OnchainAttestation | null> {
  const {
    ticker,
    periodId,
    metricId,
    rpcUrl = DEFAULT_RPC_URL,
    oracleAddress = SP500_ORACLE_ADDRESS,
  } = opts;
  const client = getClient(rpcUrl);
  try {
    const result = await client.readContract({
      address: oracleAddress,
      abi: SP500_ORACLE_ABI,
      functionName: "getAttestation",
      args: [ticker, periodId, metricId],
    });

    if (!result) return null;

    const value = BigInt(result.value);
    const decimals = Number(result.decimals);
    const normalizedValue = Number(value) / 10 ** decimals;

    return {
      periodId: result.periodId as Hex,
      metricId: result.metricId as Hex,
      evidenceHash: result.evidenceHash as Hex,
      urlHash: result.urlHash as Hex,
      value,
      decimals,
      normalizedValue,
      observedAt: Number(result.observedAt),
      sourceType: Number(result.sourceType),
      lastUpdated: Number(result.lastUpdated),
    };
  } catch (err: any) {
    if (err?.details?.includes?.("no_attestation")) {
      return null;
    }
    if (err?.message?.includes?.("execution reverted")) {
      return null;
    }
    throw err;
  }
}

