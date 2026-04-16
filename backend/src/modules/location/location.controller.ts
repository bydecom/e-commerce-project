import type { Request, Response } from 'express';
import { success } from '../../utils/response';
import { ensureRedisConnected, redisClient } from '../../config/redis';

// Theo API 2025: không còn District, chỉ Province -> Ward
type LocationItem = { code: number; name: string };

function apiBase(): string {
  return (process.env.LOCATION_API_BASE || 'https://provinces.open-api.vn/api/v2').trim().replace(/\/+$/, '');
}

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`Location API failed: ${r.status} ${r.statusText}`);
  return (await r.json()) as T;
}

// TTL cache: 30 ngày
const CACHE_TTL = 30 * 24 * 60 * 60;

function sortByName(items: LocationItem[]): LocationItem[] {
  return items.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getProvinces(_req: Request, res: Response): Promise<void> {
  const cacheKey = 'location:provinces';

  await ensureRedisConnected();
  const redis = redisClient();

  const cached = await redis.get(cacheKey);
  if (cached) {
    res.json(success(JSON.parse(cached) as LocationItem[]));
    return;
  }

  const rows = await fetchJson<LocationItem[]>(`${apiBase()}/p/`);
  const data = sortByName(Array.isArray(rows) ? rows : []);

  await redis.set(cacheKey, JSON.stringify(data), { EX: CACHE_TTL });
  res.json(success(data));
}

export async function getWardsByProvince(req: Request, res: Response): Promise<void> {
  const { provinceId } = req.params as { provinceId: string };
  const cacheKey = `location:wards:province:${provinceId}`;

  await ensureRedisConnected();
  const redis = redisClient();

  const cached = await redis.get(cacheKey);
  if (cached) {
    res.json(success(JSON.parse(cached) as LocationItem[]));
    return;
  }

  const rows = await fetchJson<LocationItem[]>(
    `${apiBase()}/w/?province=${encodeURIComponent(provinceId)}`
  );
  const data = sortByName(Array.isArray(rows) ? rows : []);

  await redis.set(cacheKey, JSON.stringify(data), { EX: CACHE_TTL });
  res.json(success(data));
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
