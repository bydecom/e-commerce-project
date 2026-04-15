import type { Request, Response } from 'express';
import { success } from '../../utils/response';

type LocationItem = { id: string; full_name: string };
type WardWithDistrictItem = LocationItem & { districtId: string };

type ProvinceRow = { code: number; name: string };
type DistrictRow = { code: number; name: string };
type WardRow = { code: number; name: string };

type ProvinceDetailDepth2 = ProvinceRow & { districts?: DistrictRow[] | null };
type DistrictDetailDepth2 = DistrictRow & { wards?: WardRow[] | null };

function apiBase(): string {
  return (process.env.LOCATION_API_BASE || 'https://provinces.open-api.vn/api/v2').trim().replace(/\/+$/, '');
}

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`Location API failed: ${r.status} ${r.statusText}`);
  return (await r.json()) as T;
}

function mapRow(row: { code: number; name: string }): LocationItem {
  return { id: String(row.code), full_name: row.name };
}

// Lazy cache per province/district to reduce repeated external calls
const provinceCache = new Map<string, LocationItem[]>();
const districtCache = new Map<string, LocationItem[]>();
const wardCache = new Map<string, LocationItem[]>();
const wardByProvinceCache = new Map<string, WardWithDistrictItem[]>();

export async function getProvinces(_req: Request, res: Response): Promise<void> {
  const cacheKey = 'all';
  if (!provinceCache.has(cacheKey)) {
    const rows = await fetchJson<ProvinceRow[]>(`${apiBase()}/p/`);
    const data = rows.map(mapRow).sort((a, b) => a.id.localeCompare(b.id));
    provinceCache.set(cacheKey, data);
  }
  res.json(success(provinceCache.get(cacheKey)!));
}

export async function getDistricts(req: Request, res: Response): Promise<void> {
  const { provinceId } = req.params as { provinceId: string };
  if (!districtCache.has(provinceId)) {
    const detail = await fetchJson<ProvinceDetailDepth2>(`${apiBase()}/p/${encodeURIComponent(provinceId)}?depth=2`);
    const rows = Array.isArray(detail.districts) ? detail.districts : [];
    const data = rows.map(mapRow).sort((a, b) => a.id.localeCompare(b.id));
    districtCache.set(provinceId, data);
  }
  res.json(success(districtCache.get(provinceId)!));
}

export async function getWards(req: Request, res: Response): Promise<void> {
  const { districtId } = req.params as { districtId: string };
  if (!wardCache.has(districtId)) {
    const detail = await fetchJson<DistrictDetailDepth2>(`${apiBase()}/d/${encodeURIComponent(districtId)}?depth=2`);
    const rows = Array.isArray(detail.wards) ? detail.wards : [];
    const data = rows.map(mapRow).sort((a, b) => a.id.localeCompare(b.id));
    wardCache.set(districtId, data);
  }
  res.json(success(wardCache.get(districtId)!));
}

export async function getWardsByProvince(req: Request, res: Response): Promise<void> {
  const { provinceId } = req.params as { provinceId: string };

  if (!wardByProvinceCache.has(provinceId)) {
    // `api/v2` rejects `depth=3` (422). Do it in 2 steps: Province(depth=2) -> District(depth=2) to get wards.
    const provinceDetail = await fetchJson<ProvinceDetailDepth2>(`${apiBase()}/p/${encodeURIComponent(provinceId)}?depth=2`);
    const districts = Array.isArray(provinceDetail.districts) ? provinceDetail.districts : [];

    const wards: WardWithDistrictItem[] = [];
    const districtDetails = await Promise.all(
      districts.map(async (d) => {
        const dId = String(d.code);
        const detail = await fetchJson<DistrictDetailDepth2>(`${apiBase()}/d/${encodeURIComponent(dId)}?depth=2`);
        return { districtId: dId, wards: Array.isArray(detail.wards) ? detail.wards : [] };
      })
    );

    for (const dd of districtDetails) {
      for (const w of dd.wards) {
        wards.push({ id: String(w.code), full_name: w.name, districtId: dd.districtId });
      }
    }

    wards.sort((a, b) => a.id.localeCompare(b.id));
    wardByProvinceCache.set(provinceId, wards);
  }

  res.json(success(wardByProvinceCache.get(provinceId)!));
}
