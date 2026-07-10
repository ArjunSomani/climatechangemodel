import { get } from "@vercel/blob";

export interface EiaIndex {
  regions: string[];
  sources: string[];
  eia_version: string;
  date_range: [string, string];
  blob_urls: Record<string, string>;
}

export interface EiaHourRow {
  hour: number;
  [source: string]: number;
}

export interface EiaWeekRow {
  date: string;
  [source: string]: number | string;
}

export interface EiaYearRow {
  year: number;
  [source: string]: number;
}

export interface EiaRegionData {
  region: string;
  typical_day: EiaHourRow[];
  weekly: EiaWeekRow[];
  yearly_max_mw: EiaYearRow[];
}

const INDEX_URL_PATHNAME = "eia-explorer/index.json";

async function fetchBlobJson<T>(pathnameOrUrl: string): Promise<T | null> {
  const result = await get(pathnameOrUrl, { access: "private" });
  if (!result || result.statusCode !== 200) return null;
  return JSON.parse(await new Response(result.stream).text());
}

export async function getEiaIndex(): Promise<EiaIndex | null> {
  return fetchBlobJson<EiaIndex>(INDEX_URL_PATHNAME);
}

export async function getEiaRegionData(
  region: string
): Promise<EiaRegionData | null> {
  const index = await getEiaIndex();
  const url = index?.blob_urls[region];
  if (!url) return null;
  return fetchBlobJson<EiaRegionData>(url);
}
