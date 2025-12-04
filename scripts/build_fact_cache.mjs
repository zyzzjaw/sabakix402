#!/usr/bin/env node

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline";
import { keccak256, stringToBytes } from "viem";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_INPUT = path.resolve(__dirname, "../../attestations_posted.jsonl");
const DEFAULT_OUTPUT = path.resolve(__dirname, "../data/facts_cache.json");

function parseArgs(argv) {
  const args = { input: DEFAULT_INPUT, out: DEFAULT_OUTPUT, limit: Infinity };
  for (let i = 2; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--input" && value) {
      args.input = path.resolve(value);
      i += 1;
    } else if (flag === "--out" && value) {
      args.out = path.resolve(value);
      i += 1;
    } else if (flag === "--limit" && value) {
      args.limit = Number(value) || Infinity;
      i += 1;
    } else if (flag === "--help") {
      printHelp();
      process.exit(0);
    } else {
      console.warn(`Unknown flag ${flag}, ignoring`);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/build_fact_cache.mjs [--input file] [--out file] [--limit N]

Defaults:
  --input  ${DEFAULT_INPUT}
  --out    ${DEFAULT_OUTPUT}
`);
}

const METRIC_LABELS = {
  non_gaap_eps: "non-gaap:EPS",
  consensus_eps: "consensus_eps",
};

function safeNumber(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim().length) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function safeKeccak(value) {
  return keccak256(stringToBytes(value ?? ""));
}

function pickLatest(existing, nextRow) {
  if (!existing) return true;
  const existingDate = Date.parse(existing.updated ?? "") || 0;
  const nextDate = Date.parse(nextRow.updated ?? "") || 0;
  return nextDate >= existingDate;
}

async function buildCache({ input, out, limit }) {
  if (!fs.existsSync(input)) {
    throw new Error(`Ledger file not found: ${input}`);
  }

  const rl = readline.createInterface({
    input: fs.createReadStream(input, { encoding: "utf-8" }),
    crlfDelay: Infinity,
  });

  const factMap = new Map();
  let processed = 0;

  for await (const line of rl) {
    if (!line || !line.trim()) continue;
    try {
      const row = JSON.parse(line);
      if ((row.status || "").toLowerCase() !== "posted") continue;
      const ticker = (row.ticker || "").toUpperCase();
      const periodId = row.periodId || "";
      if (!ticker || !periodId) continue;

      const key = `${ticker}::${periodId}`;
      const entry = factMap.get(key);
      if (!entry || pickLatest(entry, row)) {
        factMap.set(key, row);
      }

      processed += 1;
      if (processed >= limit) break;
    } catch (err) {
      console.warn("Skipping malformed line:", err.message);
      continue;
    }
  }

  const facts = {};
  for (const [key, row] of factMap.entries()) {
    const [ticker, periodId] = key.split("::");
    const nonGaap = safeNumber(row.non_gaap_eps);
    const consensus = safeNumber(row.consensus_eps);
    const pmConsensus = safeNumber(row.pm_consensus_eps);

    facts[key] = {
      schema_id: "SEC_EPS_V1",
      ticker,
      periodId,
      period_keccak: safeKeccak(periodId),
      ticker_keccak: safeKeccak(ticker),
      metric_ids: {
        non_gaap_eps: safeKeccak(METRIC_LABELS.non_gaap_eps),
        consensus_eps: safeKeccak(METRIC_LABELS.consensus_eps),
      },
      non_gaap_eps: nonGaap,
      consensus_eps: consensus,
      pm_consensus_eps: pmConsensus,
      pm_market_url: row.pm_market_url || null,
      pm_chain_outcome: row.pm_chain_outcome || null,
      provenance: {
        filing_url: row.filing_url || null,
        exhibit_url: row.exhibit_url || null,
        dedupe_id: row.dedupe_id || null,
        updated: row.updated || row.time || null,
      },
      attestation: {
        tx_hash: Array.isArray(row.tx_hashes) ? row.tx_hashes.find((tx) => typeof tx === "string" && tx.length) || null : row.tx_hash || null,
        evidence_hash: row.evidence_hash_actual || null,
        url_hash: row.url_hash_actual || null,
        observed_at: typeof row.observed_at === "number" ? row.observed_at : null,
      },
    };
  }

  const payload = {
    meta: {
      generated_at: new Date().toISOString(),
      source: input,
    },
    facts,
  };

  await fsp.mkdir(path.dirname(out), { recursive: true });
  await fsp.writeFile(out, JSON.stringify(payload, null, 2));

  console.log(
    JSON.stringify(
      {
        facts: Object.keys(facts).length,
        generated_at: payload.meta.generated_at,
        cache: out,
      },
      null,
      2,
    ),
  );
}

const args = parseArgs(process.argv);
buildCache(args).catch((err) => {
  console.error(err);
  process.exit(1);
});

