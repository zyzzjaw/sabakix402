import { readFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_CACHE_PATH = path.join(process.cwd(), "data", "facts_cache.json");

export type Hex = `0x${string}`;

export interface FactAttestationSnapshot {
  tx_hash?: string | null;
  evidence_hash?: Hex | null;
  url_hash?: Hex | null;
  observed_at?: number | null;
}

export interface FactProvenance {
  filing_url?: string | null;
  exhibit_url?: string | null;
  dedupe_id?: string | null;
  updated?: string | null;
}

export interface FactBundleRecord {
  schema_id: string;
  ticker: string;
  periodId: string;
  period_keccak: Hex;
  ticker_keccak: Hex;
  metric_ids: {
    non_gaap_eps: Hex;
    consensus_eps: Hex;
  };
  non_gaap_eps: number | null;
  consensus_eps: number | null;
  pm_consensus_eps: number | null;
  pm_market_url?: string | null;
  pm_chain_outcome?: string | null;
  provenance: FactProvenance;
  attestation: FactAttestationSnapshot;
}

export interface FactCacheFile {
  meta: {
    generated_at: string;
    source: string;
  };
  facts: Record<string, FactBundleRecord>;
}

export async function loadFactCache(cachePath: string = DEFAULT_CACHE_PATH): Promise<FactCacheFile> {
  const resolved = path.isAbsolute(cachePath) ? cachePath : path.join(process.cwd(), cachePath);
  const raw = await readFile(resolved, "utf-8");
  const parsed = JSON.parse(raw) as FactCacheFile;
  if (!parsed?.facts || typeof parsed.facts !== "object") {
    throw new Error(`Fact cache missing facts map: ${resolved}`);
  }
  return parsed;
}

export function getFactFromCache(
  cache: FactCacheFile,
  ticker: string,
  periodId?: string,
): FactBundleRecord | null {
  if (!cache?.facts) return null;
  const normalizedTicker = ticker.toUpperCase();

  if (periodId) {
    const key = `${normalizedTicker}::${periodId}`;
    return cache.facts[key] ?? null;
  }

  // If period is not provided, pick the most recent by provenance.updated
  const candidates = Object.values(cache.facts).filter((record) => record.ticker === normalizedTicker);
  if (!candidates.length) return null;
  const sorted = candidates.sort((a, b) => {
    const aDate = Date.parse(a.provenance.updated ?? "") || 0;
    const bDate = Date.parse(b.provenance.updated ?? "") || 0;
    return bDate - aDate;
  });
  return sorted[0] ?? null;
}

export function listCachedFacts(cache: FactCacheFile): Array<{
  ticker: string;
  periodId: string;
  updated?: string | null;
}> {
  if (!cache?.facts) return [];
  return Object.values(cache.facts).map((record) => ({
    ticker: record.ticker,
    periodId: record.periodId,
    updated: record.provenance.updated,
  }));
}

