/**
 * Money is stored as an integer number of paise (1 rupee = 100 paise), never as a float.
 * Floats can't represent most decimals exactly: 0.1 + 0.2 === 0.30000000000000004.
 * Adding up thousands of float amounts slowly drifts; integers never do.
 * The API speaks rupees; we convert only at the edges.
 */
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function toRupees(paise: number): number {
  return paise / 100;
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

/** 125000 paise -> "₹1,250" (Indian digit grouping: ₹1,25,000 for a lakh). */
export function formatINR(paise: number): string {
  return inr.format(Math.round(paise / 100));
}
