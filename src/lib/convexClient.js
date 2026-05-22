import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

const url = process.env.NEXT_PUBLIC_CONVEX_URL;
export const isConvexEnabled = !!url;

export const convex = isConvexEnabled ? new ConvexHttpClient(url) : null;
export { api };
