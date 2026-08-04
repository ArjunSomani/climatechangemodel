import { readBlobText } from "@/lib/blobRead";

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

// Goes through readBlobText for the same reason library.ts and runs.ts do: these
// are server-render-path HTTPS round-trips to blob storage and they fail
// transiently (ConnectTimeoutError / ECONNRESET both observed). This file was
// missed when the retry was introduced, so /data-explorer kept the old
// one-attempt-then-500 behaviour the others no longer had.
async function fetchBlobJson<T>(pathnameOrUrl: string): Promise<T | null> {
  const body = await readBlobText(pathnameOrUrl);
  if (body === null) return null;
  return JSON.parse(body) as T;
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
