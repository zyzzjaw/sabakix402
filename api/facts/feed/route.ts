import { createFactHandler } from "../handler";
import { PAYMENT_AMOUNTS, SABAKI_FEED_URL } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const GET = createFactHandler({
  resource: "feed",
  upstreamUrl: SABAKI_FEED_URL,
  priceAmount: PAYMENT_AMOUNTS.FEED.amount,
});

