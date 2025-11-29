import { createFactHandler } from "../handler";
import { PAYMENT_AMOUNTS, SABAKI_PM_URL } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const GET = createFactHandler({
  resource: "pm",
  upstreamUrl: SABAKI_PM_URL,
  priceAmount: PAYMENT_AMOUNTS.PM.amount,
});

