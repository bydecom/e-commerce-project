import { Injectable, signal } from '@angular/core';

export type ShopDateSort = 'newest' | 'oldest';
export type ShopPriceSort = 'any' | 'asc' | 'desc';

/** Draft browse state read by the header search; URL is applied truth after navigation. */
@Injectable({ providedIn: 'root' })
export class ShopBrowseDraftService {
  readonly categoryIds = signal<number[]>([]);
  readonly dateSort = signal<ShopDateSort>('newest');
  readonly priceSort = signal<ShopPriceSort>('any');

  setFromRoute(cats: number[], dateSort: ShopDateSort, priceSort: ShopPriceSort): void {
    this.categoryIds.set([...new Set(cats)].sort((a, b) => a - b));
    this.dateSort.set(dateSort);
    this.priceSort.set(priceSort);
  }

  setCategoryIds(ids: number[]): void {
    this.categoryIds.set([...new Set(ids)].sort((a, b) => a - b));
  }

  setDateSort(v: ShopDateSort): void {
    this.dateSort.set(v);
  }

  setPriceSort(v: ShopPriceSort): void {
    this.priceSort.set(v);
  }
}

export function parseCatsQueryParam(raw: string | null): number[] {
  if (!raw?.trim()) return [];
  return [
    ...new Set(
      raw
        .split(',')
        .map((x) => parseInt(x.trim(), 10))
        .filter((n) => !Number.isNaN(n))
    ),
  ].sort((a, b) => a - b);
}

export function normalizeDateSortParam(v: string | null): ShopDateSort {
  return v === 'oldest' ? 'oldest' : 'newest';
}

export function normalizePriceSortParam(v: string | null): ShopPriceSort {
  if (v === 'asc') return 'asc';
  if (v === 'desc') return 'desc';
  return 'any';
}
