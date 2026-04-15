import type { Request, Response } from 'express';
import { success } from '../../utils/response';

interface RawItem {
  code: string;
  name_with_type: string;
  parent_code?: string;
}

interface LocationItem {
  id: string;
  full_name: string;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const tinh_tp    = require('hanhchinhvn/dist/tinh_tp.json')    as Record<string, RawItem>;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const quan_huyen = require('hanhchinhvn/dist/quan_huyen.json') as Record<string, RawItem>;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const xa_phuong  = require('hanhchinhvn/dist/xa_phuong.json')  as Record<string, RawItem>;

function mapItem(item: RawItem): LocationItem {
  return { id: item.code, full_name: item.name_with_type };
}

// Pre-computed once at startup — zero latency on every request
const PROVINCES: LocationItem[] = Object.values(tinh_tp)
  .map(mapItem)
  .sort((a, b) => a.id.localeCompare(b.id));

// Lazy cache per province/district so memory stays lean on small deployments
const districtCache = new Map<string, LocationItem[]>();
const wardCache     = new Map<string, LocationItem[]>();

export function getProvinces(_req: Request, res: Response): void {
  res.json(success(PROVINCES));
}

export function getDistricts(req: Request, res: Response): void {
  const { provinceId } = req.params as { provinceId: string };

  if (!districtCache.has(provinceId)) {
    const data = Object.values(quan_huyen)
      .filter((d) => d.parent_code === provinceId)
      .map(mapItem)
      .sort((a, b) => a.id.localeCompare(b.id));
    districtCache.set(provinceId, data);
  }

  res.json(success(districtCache.get(provinceId)!));
}

export function getWards(req: Request, res: Response): void {
  const { districtId } = req.params as { districtId: string };

  if (!wardCache.has(districtId)) {
    const data = Object.values(xa_phuong)
      .filter((w) => w.parent_code === districtId)
      .map(mapItem)
      .sort((a, b) => a.id.localeCompare(b.id));
    wardCache.set(districtId, data);
  }

  res.json(success(wardCache.get(districtId)!));
}
