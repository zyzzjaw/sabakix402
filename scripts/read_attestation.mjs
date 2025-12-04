#!/usr/bin/env node

import { createPublicClient, http, keccak256, stringToBytes } from "viem";
import { avalancheFuji } from "viem/chains";
import ABI from "../lib/abis/SP500Oracle.json" assert { type: "json" };

const DEFAULT_RPC = process.env.FUJI_RPC_URL ?? "https://api.avax-test.network/ext/bc/C/rpc";
const DEFAULT_ADDR = (process.env.SP500_ORACLE_ADDR ?? "0xA17b8A538286f0415e0a5166440f0E452BF35968").toLowerCase();

function usage() {
  console.log("Usage: node scripts/read_attestation.mjs --ticker ICUI --period CY2025Q3 --metric \"non-gaap:EPS\" [--rpc <url>] [--addr <address>]");
}

function parseArgs(argv) {
  const args = { ticker: null, period: null, metric: "non-gaap:EPS", rpc: DEFAULT_RPC, addr: DEFAULT_ADDR };
  for (let i = 2; i < argv.length; i += 1) {
    const flag = argv[i];
    const val = argv[i + 1];
    if (!val && flag !== "--help") continue;
    if (flag === "--ticker") {
      args.ticker = val;
      i += 1;
    } else if (flag === "--period") {
      args.period = val;
      i += 1;
    } else if (flag === "--metric") {
      args.metric = val;
      i += 1;
    } else if (flag === "--rpc") {
      args.rpc = val;
      i += 1;
    } else if (flag === "--addr") {
      args.addr = val;
      i += 1;
    } else if (flag === "--help") {
      usage();
      process.exit(0);
    }
  }
  return args;
}

function hashToBytes32(value) {
  return keccak256(stringToBytes(value ?? ""));
}

async function main() {
  const { ticker, period, metric, rpc, addr } = parseArgs(process.argv);
  if (!ticker || !period) {
    usage();
    process.exit(1);
  }

  const client = createPublicClient({
    chain: avalancheFuji,
    transport: http(rpc),
  });

  const args = [ticker, hashToBytes32(period), hashToBytes32(metric)];
  try {
    const result = await client.readContract({
      abi: ABI,
      address: addr,
      functionName: "getAttestation",
      args,
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Failed to read attestation:", err.message ?? err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

