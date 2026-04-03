export const API_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_URL && typeof window !== "undefined") {
  console.error("NEXT_PUBLIC_API_URL is not configured");
}
