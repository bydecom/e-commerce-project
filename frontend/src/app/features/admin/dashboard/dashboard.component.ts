import { DatePipe, DecimalPipe, isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { DashboardApiService } from '../../../core/services/dashboard-api.service';
import type {
  DashboardOrderStatusItem,
  DashboardRatingDistribution,
  DashboardSummary,
} from '../../../shared/models/dashboard.model';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, RouterLink],
  template: `
    <div class="mx-auto max-w-7xl space-y-8">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p class="mt-1 text-sm text-gray-500">Real-time business insights and operational metrics.</p>
        </div>
        <button
          type="button"
          (click)="load()"
          [disabled]="loading()"
          class="flex shrink-0 items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4"
            [class.animate-spin]="loading()"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {{ loading() ? 'Loading…' : 'Refresh' }}
        </button>
      </div>

      <!-- PDF export (layout aligned with System traffic logs) -->
      <div class="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 shadow-sm">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div class="flex-1 space-y-3">
            <p class="text-sm font-semibold text-indigo-900">Export PDF report</p>
            <div class="flex flex-wrap gap-3">
              <div class="w-full min-w-[140px] sm:w-40">
                <label class="block text-xs font-medium text-gray-600">Time range</label>
                <select
                  [(ngModel)]="pdfFilter.type"
                  class="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="ALL">All time</option>
                  <option value="MONTH">By month</option>
                  <option value="QUARTER">By quarter</option>
                  <option value="YEAR">By year</option>
                  <option value="CUSTOM">Date range</option>
                </select>
              </div>
              @if (pdfFilter.type === 'MONTH') {
                <div class="w-24">
                  <label class="block text-xs font-medium text-gray-600">Month</label>
                  <select
                    [(ngModel)]="pdfFilter.month"
                    class="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-2 text-sm"
                  >
                    @for (m of monthOptions; track m) {
                      <option [ngValue]="m">{{ m }}</option>
                    }
                  </select>
                </div>
                <div class="w-28">
                  <label class="block text-xs font-medium text-gray-600">Year</label>
                  <input
                    type="number"
                    [(ngModel)]="pdfFilter.year"
                    min="2000"
                    max="2100"
                    class="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-2 text-sm"
                  />
                </div>
              }
              @if (pdfFilter.type === 'QUARTER') {
                <div class="w-24">
                  <label class="block text-xs font-medium text-gray-600">Quarter</label>
                  <select
                    [(ngModel)]="pdfFilter.quarter"
                    class="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-2 text-sm"
                  >
                    @for (q of quarterOptions; track q) {
                      <option [ngValue]="q">Q{{ q }}</option>
                    }
                  </select>
                </div>
                <div class="w-28">
                  <label class="block text-xs font-medium text-gray-600">Year</label>
                  <input
                    type="number"
                    [(ngModel)]="pdfFilter.year"
                    min="2000"
                    max="2100"
                    class="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-2 text-sm"
                  />
                </div>
              }
              @if (pdfFilter.type === 'YEAR') {
                <div class="w-32">
                  <label class="block text-xs font-medium text-gray-600">Year</label>
                  <input
                    type="number"
                    [(ngModel)]="pdfFilter.year"
                    min="2000"
                    max="2100"
                    class="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-2 text-sm"
                  />
                </div>
              }
              @if (pdfFilter.type === 'CUSTOM') {
                <div class="w-40">
                  <label class="block text-xs font-medium text-gray-600">From</label>
                  <input
                    type="date"
                    [(ngModel)]="pdfFilter.start"
                    class="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-2 text-sm"
                  />
                </div>
                <div class="w-40">
                  <label class="block text-xs font-medium text-gray-600">To</label>
                  <input
                    type="date"
                    [(ngModel)]="pdfFilter.end"
                    class="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-2 text-sm"
                  />
                </div>
              }
            </div>
            <p class="text-xs text-gray-500">
              The exported PDF uses the time range above for the business summary.
            </p>
          </div>
          <button
            type="button"
            (click)="exportPdf()"
            [disabled]="exporting()"
            class="shrink-0 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {{ exporting() ? 'Building PDF…' : 'Download PDF' }}
          </button>
        </div>
      </div>

      @if (error()) {
        <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {{ error() }}
        </div>
      }

      @if (loading() && !data()) {
        <div class="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          @for (i of [1, 2, 3, 4, 5, 6]; track i) {
            <div class="h-28 animate-pulse rounded-xl bg-gray-200"></div>
          }
        </div>
      }

      @if (data(); as d) {
        <section class="grid grid-cols-2 items-stretch gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <div class="flex h-full min-h-[8.5rem] flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Total revenue</p>
            <p class="mt-2 text-2xl font-bold text-gray-900">
              {{ d.keyMetrics.totalRevenue | number : '1.0-0' }}
              <span class="ml-1 text-sm font-normal text-gray-500">VND</span>
            </p>
            <p class="mt-auto pt-2 text-xs leading-snug text-gray-400">All completed (DONE) orders</p>
          </div>
          <div class="flex h-full min-h-[8.5rem] flex-col rounded-xl border border-blue-100 bg-blue-50 p-5 shadow-sm">
            <p class="text-xs font-medium uppercase tracking-wide text-blue-600">Orders</p>
            <p class="mt-2 text-2xl font-bold text-blue-700">{{ d.keyMetrics.totalOrders | number }}</p>
            <p class="mt-auto pt-2 text-xs leading-snug text-blue-400">All statuses</p>
          </div>
          <div class="flex h-full min-h-[8.5rem] flex-col rounded-xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
            <p class="text-xs font-medium uppercase tracking-wide text-emerald-600">Active products</p>
            <p class="mt-2 text-2xl font-bold text-emerald-700">{{ d.keyMetrics.activeProducts | number }}</p>
            <p class="mt-auto pt-2 text-xs leading-snug text-emerald-400">AVAILABLE</p>
          </div>
          <div class="flex h-full min-h-[8.5rem] flex-col rounded-xl border border-violet-100 bg-violet-50 p-5 shadow-sm">
            <p class="text-xs font-medium uppercase tracking-wide text-violet-600">Customers</p>
            <p class="mt-2 text-2xl font-bold text-violet-700">{{ d.keyMetrics.totalCustomers | number }}</p>
            <p class="mt-auto pt-2 text-xs leading-snug text-violet-400">USER role accounts</p>
          </div>
          <div class="flex h-full min-h-[8.5rem] flex-col rounded-xl border border-sky-100 bg-sky-50 p-5 shadow-sm">
            <p class="text-xs font-medium uppercase tracking-wide text-sky-600">Avg. Order Value</p>
            <p class="mt-2 text-2xl font-bold text-sky-700">
              {{ d.keyMetrics.avgOrderValue | number : '1.0-0' }}
              <span class="ml-1 text-sm font-normal text-sky-400">VND</span>
            </p>
            <p class="mt-auto pt-2 text-xs leading-snug text-sky-400">Per completed order</p>
          </div>
          <div class="flex h-full min-h-[8.5rem] flex-col rounded-xl border border-rose-100 bg-rose-50 p-5 shadow-sm">
            <p class="text-xs font-medium uppercase tracking-wide text-rose-600">Repeat Customers</p>
            <p class="mt-2 text-2xl font-bold text-rose-700">{{ d.keyMetrics.repeatCustomers }}</p>
            <p class="mt-auto pt-2 text-xs leading-snug text-rose-400">of {{ d.keyMetrics.totalBuyers }} buyers</p>
          </div>
        </section>

        <section class="grid gap-6 lg:grid-cols-3">
          <div class="rounded-xl border border-orange-100 bg-white shadow-sm">
            <div class="flex items-center justify-between border-b border-orange-100 px-5 py-4">
              <div class="flex items-center gap-2">
                <span
                  class="flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-orange-600"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </span>
                <h2 class="text-sm font-semibold text-gray-800">Pending orders</h2>
                <span class="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-600">
                  {{ d.actionRequired.pendingOrders.length }}
                </span>
              </div>
              <a routerLink="/admin/orders" class="text-xs text-blue-600 hover:underline">View all</a>
            </div>
            <ul class="divide-y divide-gray-50">
              @for (o of d.actionRequired.pendingOrders; track o.id) {
                <li class="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium text-gray-800">{{ o.user.name || o.user.email }}</p>
                    <p class="text-xs text-gray-400">{{ o.createdAt | date : 'medium' }}</p>
                  </div>
                  <span class="ml-4 shrink-0 text-sm font-semibold text-orange-600">
                    {{ o.total | number : '1.0-0' }} VND
                  </span>
                </li>
              } @empty {
                <li class="px-5 py-6 text-center text-sm text-gray-400">No pending orders</li>
              }
            </ul>
          </div>

          <div class="rounded-xl border border-red-100 bg-white shadow-sm">
            <div class="flex items-center justify-between border-b border-red-100 px-5 py-4">
              <div class="flex items-center gap-2">
                <span class="flex h-7 w-7 items-center justify-center rounded-full bg-red-100 text-red-600">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </span>
                <h2 class="text-sm font-semibold text-gray-800">Negative feedback</h2>
                <span class="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600">
                  {{ d.actionRequired.negativeFeedbacks.length }}
                </span>
              </div>
              <a routerLink="/admin/feedbacks" class="text-xs text-blue-600 hover:underline">View all</a>
            </div>
            <ul class="divide-y divide-gray-50">
              @for (f of d.actionRequired.negativeFeedbacks; track f.id) {
                <li class="px-5 py-3 hover:bg-gray-50">
                  <div class="flex items-center justify-between">
                    <p class="truncate text-sm font-medium text-gray-800">{{ f.product.name }}</p>
                    <span class="ml-4 flex shrink-0 items-center gap-0.5">
                      @for (s of ratingStars(f.rating); track $index) {
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-3.5 w-3.5"
                          [class]="s ? 'text-amber-400' : 'text-gray-200'"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                          />
                        </svg>
                      }
                    </span>
                  </div>
                  @if (f.comment) {
                    <p class="mt-0.5 truncate text-xs text-gray-400">"{{ f.comment }}"</p>
                  }
                  <p class="mt-0.5 text-xs text-gray-400">by {{ f.user.name || 'Anonymous' }}</p>
                </li>
              } @empty {
                <li class="px-5 py-6 text-center text-sm text-gray-400">No negative feedback</li>
              }
            </ul>
          </div>

          <div class="rounded-xl border border-yellow-100 bg-white shadow-sm">
            <div class="flex items-center justify-between border-b border-yellow-100 px-5 py-4">
              <div class="flex items-center gap-2">
                <span
                  class="flex h-7 w-7 items-center justify-center rounded-full bg-yellow-100 text-yellow-600"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                </span>
                <h2 class="text-sm font-semibold text-gray-800">Low stock</h2>
                <span class="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-bold text-yellow-600">
                  {{ d.actionRequired.lowStockProducts.length }}
                </span>
              </div>
              <a routerLink="/admin/products" class="text-xs text-blue-600 hover:underline">View all</a>
            </div>
            <ul class="divide-y divide-gray-50">
              @for (p of d.actionRequired.lowStockProducts; track p.id) {
                <li class="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                  <p class="truncate text-sm font-medium text-gray-800">{{ p.name }}</p>
                  <span
                    class="ml-4 shrink-0 rounded-full px-2 py-0.5 text-xs font-bold"
                    [class]="p.stock === 0 ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-700'"
                  >
                    {{ p.stock === 0 ? 'Out of stock' : 'Stock: ' + p.stock }}
                  </span>
                </li>
              } @empty {
                <li class="px-5 py-6 text-center text-sm text-gray-400">Stock levels OK</li>
              }
            </ul>
          </div>
        </section>

        <section class="grid gap-6 lg:grid-cols-3">
          <div class="col-span-2 flex flex-col gap-4 lg:min-h-0">
            <div
              class="relative flex min-h-[280px] flex-col overflow-hidden rounded-xl border border-indigo-100/80 bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/80 p-6 shadow-sm transition-all hover:shadow-md lg:min-h-[300px] lg:flex-1"
            >
              <div
                class="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-indigo-200/35 blur-3xl"
                aria-hidden="true"
              ></div>
              <div
                class="absolute -bottom-12 -left-12 h-44 w-44 rounded-full bg-purple-200/30 blur-3xl"
                aria-hidden="true"
              ></div>

              <div class="relative z-10 flex items-start">
                <div class="flex items-center gap-3">
                  <div
                    class="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-sm ring-1 ring-black/5"
                  >
                    <svg
                      class="h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813A3.75 3.75 0 007.466 7.89l.813-2.846A.75.75 0 019 4.5z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3
                      class="bg-gradient-to-r from-indigo-800 to-purple-800 bg-clip-text text-base font-bold tracking-wide text-transparent"
                    >
                      AI Business Insights
                    </h3>
                    <p class="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-gray-500">
                      Last 7 days vs prior
                    </p>
                    <p class="mt-1.5 max-w-xl text-[10px] leading-relaxed text-gray-500">
                      Revenue · Order count · Customer insights
                    </p>
                  </div>
                </div>
              </div>

              <div class="relative z-10 mt-6 min-h-[120px] flex-1">
                @if (adviceLoading()) {
                  <div class="flex h-full min-h-[120px] flex-col items-center justify-center space-y-3 opacity-90">
                    <div
                      class="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"
                    ></div>
                    <p class="text-sm font-medium text-indigo-700">Analyzing your data…</p>
                  </div>
                } @else if (adviceError()) {
                  <div class="rounded-md border border-red-100 bg-red-50 p-4 text-sm text-red-600">
                    {{ adviceError() }}
                  </div>
                } @else if (adviceBullets().length > 0) {
                  <div class="space-y-3">
                    @for (line of adviceBullets(); track $index) {
                      <div
                        class="flex items-start gap-3 rounded-lg bg-white/70 p-3.5 shadow-sm ring-1 ring-black/5 backdrop-blur-sm transition-all hover:bg-white"
                      >
                        <div
                          class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600"
                        >
                          <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2.5"
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </div>
                        <p class="text-sm font-medium leading-relaxed text-gray-700">{{ line }}</p>
                      </div>
                    }
                  </div>
                }
              </div>

              <div class="relative z-10 mt-10 pt-4">
                <p class="text-[10px] leading-relaxed text-gray-400">
                  Powered by Gemini AI.
                </p>
              </div>
            </div>

            <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:flex-1">
              <h2 class="text-sm font-semibold text-gray-800">Revenue — last 7 days</h2>
              <div class="mt-8 flex h-48 items-end justify-between gap-2 lg:gap-4 px-2">
                @if (revenueChartBars().length === 0) {
                  <p class="w-full pb-10 text-center text-sm text-gray-400">No data</p>
                } @else {
                  @for (bar of revenueChartBars(); track bar.date) {
                    <div class="group relative flex h-full flex-1 flex-col items-center justify-end">
                      <span
                        class="absolute -top-8 z-10 hidden whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:block"
                      >
                        {{ bar.revenue | number : '1.0-0' }} VND
                      </span>
                      <div
                        class="w-full max-w-[40px] rounded-t-md bg-indigo-500 shadow-sm transition-all duration-300 group-hover:bg-indigo-600"
                        [style.height.%]="bar.heightPct"
                        style="min-height: 4px"
                      ></div>
                      <span
                        class="mt-2 w-full truncate text-center text-[10px] font-medium text-gray-500 sm:text-xs"
                      >
                        {{ bar.label }}
                      </span>
                    </div>
                  }
                }
              </div>
            </div>
          </div>

          <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div class="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 class="text-sm font-semibold text-gray-800">Review Sentiment</h2>
              <a
                routerLink="/admin/feedbacks"
                class="text-[10px] font-medium text-blue-600 hover:underline"
              >
                View details
              </a>
            </div>

            <div class="mt-5 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <svg viewBox="0 0 36 36" class="h-28 w-28 shrink-0 -rotate-90">
                @for (seg of sentimentSegments(); track seg.label) {
                  <circle
                    cx="18"
                    cy="18"
                    r="15.915"
                    fill="transparent"
                    [attr.stroke]="seg.color"
                    stroke-width="4"
                    [attr.stroke-dasharray]="seg.dashArray"
                    [attr.stroke-dashoffset]="seg.offset"
                    class="transition-all duration-500 ease-out"
                  />
                }
              </svg>

              <ul class="w-full max-w-[140px] space-y-2">
                @for (seg of sentimentSegments(); track seg.label) {
                  <li class="flex items-center justify-between text-xs">
                    <span class="flex items-center gap-2 text-gray-600">
                      <span class="inline-block h-2.5 w-2.5 rounded-full" [style.background]="seg.color"></span>
                      {{ seg.label }}
                    </span>
                    <span class="font-bold text-gray-900">{{ seg.count }}</span>
                  </li>
                }
              </ul>
            </div>

            <div class="my-5 border-t border-gray-100"></div>

            <div class="space-y-3.5">
              <p class="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Rating Breakdown</p>

              @for (r of [5, 4, 3, 2, 1]; track r) {
                <div class="flex items-center gap-3 text-xs">
                  <div class="flex w-8 shrink-0 items-center justify-end font-medium text-gray-600">
                    {{ r }}<span class="ml-0.5 text-amber-400">★</span>
                  </div>

                  <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div
                      class="h-full rounded-full bg-amber-400 transition-[width] duration-500 ease-out"
                      [style.width.%]="ratingBarWidth(r, d.charts.ratingDistribution)"
                    ></div>
                  </div>

                  <div class="w-6 shrink-0 text-right font-medium text-gray-500">
                    {{ getRatingCount(r, d.charts.ratingDistribution) }}
                  </div>
                </div>
              }
            </div>
          </div>

          <div class="col-span-full rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 class="text-sm font-semibold text-gray-800">Orders by status</h2>
            <div class="mt-4 space-y-3">
              @for (item of d.charts.orderStatus; track item.status) {
                <div class="flex items-center gap-3">
                  <span class="w-28 shrink-0 text-xs font-medium text-gray-600">
                    {{ statusLabel(item.status) }}
                  </span>
                  <div class="flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div
                      class="h-3 rounded-full transition-all"
                      [class]="statusBarColor(item.status)"
                      [style.width.%]="orderBarWidth(item.count, d.charts.orderStatus)"
                    ></div>
                  </div>
                  <span class="w-8 shrink-0 text-right text-xs text-gray-500">{{ item.count }}</span>
                </div>
              } @empty {
                <p class="text-sm text-gray-400">No data</p>
              }
            </div>
          </div>
        </section>

        <section class="grid gap-6 lg:grid-cols-2">
          <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 class="text-sm font-semibold text-gray-800">Top 5 selling products</h2>
            <ul class="mt-4 space-y-3">
              @for (p of d.charts.topProducts; track p.name; let i = $index) {
                <li class="flex items-center gap-3">
                  <span
                    class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600"
                  >
                    {{ i + 1 }}
                  </span>
                  <div class="min-w-0 flex-1">
                    <div class="mb-1 flex justify-between text-xs">
                      <span class="truncate font-medium text-gray-700">{{ p.name }}</span>
                      <span class="ml-2 shrink-0 font-bold text-indigo-600">{{ p.qty }}</span>
                    </div>
                    <div class="h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <div
                        class="h-full rounded-full bg-indigo-500 transition-[width] duration-500"
                        [style.width.%]="topProductBarWidth(p.qty, d.charts.topProducts)"
                      ></div>
                    </div>
                  </div>
                </li>
              } @empty {
                <li class="py-4 text-center text-sm text-gray-400">No data</li>
              }
            </ul>
          </div>

          <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 class="text-sm font-semibold text-gray-800">Products by category</h2>
            <ul class="mt-4 space-y-3">
              @for (c of d.charts.categoryBreakdown; track c.name) {
                <li class="flex items-center gap-3 text-xs">
                  <span class="w-28 shrink-0 truncate font-medium text-gray-600">{{ c.name }}</span>
                  <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div
                      class="h-full rounded-full bg-emerald-500 transition-[width] duration-500"
                      [style.width.%]="categoryBarWidth(c.count, d.charts.categoryBreakdown)"
                    ></div>
                  </div>
                  <span class="w-6 shrink-0 text-right font-medium text-gray-500">{{ c.count }}</span>
                </li>
              } @empty {
                <li class="py-4 text-center text-sm text-gray-400">No categories</li>
              }
            </ul>
          </div>
        </section>
      }
    </div>
  `,
})
export class AdminDashboardComponent implements OnInit {
  private readonly api = inject(DashboardApiService);
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly data = signal<DashboardSummary | null>(null);
  readonly exporting = signal(false);

  readonly adviceLoading = signal(false);
  readonly adviceError = signal<string | null>(null);
  readonly adviceBullets = signal<string[]>([]);

  readonly monthOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  readonly quarterOptions = [1, 2, 3, 4];

  pdfFilter = {
    type: 'ALL' as 'ALL' | 'MONTH' | 'QUARTER' | 'YEAR' | 'CUSTOM',
    month: new Date().getMonth() + 1,
    quarter: Math.floor(new Date().getMonth() / 3) + 1,
    year: new Date().getFullYear(),
    start: '',
    end: '',
  };

  readonly revenueChartBars = computed(() => {
    const points = this.data()?.charts.revenueLast7Days ?? [];
    if (points.length === 0) return [];
    const max = Math.max(...points.map((p) => p.revenue), 1);
    return points.map((p) => ({
      date: p.date,
      revenue: p.revenue,
      heightPct: Math.round((p.revenue / max) * 100),
      label: p.date.slice(5),
    }));
  });

  readonly sentimentSegments = computed(() => {
    const s = this.data()?.charts.sentiment;
    if (!s) return [];
    const total = s.POSITIVE + s.NEUTRAL + s.NEGATIVE || 1;
    const circumference = 100;
    const items = [
      { label: 'Positive', count: s.POSITIVE, color: '#10b981' },
      { label: 'Neutral', count: s.NEUTRAL, color: '#f59e0b' },
      { label: 'Negative', count: s.NEGATIVE, color: '#ef4444' },
    ];
    let offset = 0;
    return items.map((item) => {
      const pct = (item.count / total) * circumference;
      const seg = { ...item, dashArray: `${pct} ${circumference - pct}`, offset: -offset };
      offset += pct;
      return seg;
    });
  });

  ngOnInit(): void {
    // Avoid calling authenticated APIs during SSR: no Bearer token on the server → 401 Unauthorized.
    if (!isPlatformBrowser(this.platformId)) return;
    this.load();
    this.loadMiniAdvice();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getSummary().subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: (err: Error) => {
        this.error.set(err.message || 'Could not load dashboard.');
        this.loading.set(false);
      },
    });
  }

  loadMiniAdvice(): void {
    this.adviceLoading.set(true);
    this.adviceError.set(null);
    this.api.getMiniAdvice().subscribe({
      next: (bullets) => {
        this.adviceBullets.set(bullets);
        this.adviceLoading.set(false);
      },
      error: (err: Error) => {
        this.adviceError.set(err.message || 'Could not load tips right now.');
        this.adviceLoading.set(false);
      },
    });
  }

  exportPdf(): void {
    if (this.pdfFilter.type === 'CUSTOM' && (!this.pdfFilter.start || !this.pdfFilter.end)) {
      alert('Please select both start and end dates.');
      return;
    }

    let params = new HttpParams().set('type', this.pdfFilter.type);
    if (this.pdfFilter.type === 'MONTH') {
      params = params.set('month', String(this.pdfFilter.month)).set('year', String(this.pdfFilter.year));
    } else if (this.pdfFilter.type === 'QUARTER') {
      params = params
        .set('quarter', String(this.pdfFilter.quarter))
        .set('year', String(this.pdfFilter.year));
    } else if (this.pdfFilter.type === 'YEAR') {
      params = params.set('year', String(this.pdfFilter.year));
    } else if (this.pdfFilter.type === 'CUSTOM') {
      params = params.set('start', this.pdfFilter.start).set('end', this.pdfFilter.end);
    }

    this.exporting.set(true);
    this.http
      .get(`${environment.apiUrl}/api/dashboard/export-pdf`, { params, responseType: 'blob' })
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Business_Report_${Date.now()}.pdf`;
          a.click();
          window.URL.revokeObjectURL(url);
          this.exporting.set(false);
        },
        error: async (err: HttpErrorResponse) => {
          this.exporting.set(false);
          let msg = err.message;
          if (err.error instanceof Blob) {
            try {
              const t = await err.error.text();
              const j = JSON.parse(t) as { message?: string };
              if (j.message) msg = j.message;
            } catch {
              msg = 'Could not generate PDF.';
            }
          }
          alert(msg);
        },
      });
  }

  ratingStars(rating: number): boolean[] {
    return Array.from({ length: 5 }, (_, i) => i < rating);
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      PENDING: 'Pending',
      CONFIRMED: 'Confirmed',
      SHIPPING: 'Shipping',
      DONE: 'Done',
      CANCELLED: 'Cancelled',
    };
    return map[status] ?? status;
  }

  statusBarColor(status: string): string {
    const map: Record<string, string> = {
      PENDING: 'bg-orange-400',
      CONFIRMED: 'bg-blue-400',
      SHIPPING: 'bg-indigo-400',
      DONE: 'bg-emerald-500',
      CANCELLED: 'bg-gray-400',
    };
    return map[status] ?? 'bg-gray-300';
  }

  orderBarWidth(count: number, items: DashboardOrderStatusItem[]): number {
    const max = Math.max(...items.map((i) => i.count), 1);
    return Math.round((count / max) * 100);
  }

  topProductBarWidth(qty: number, list: { qty: number }[]): number {
    const max = Math.max(...list.map((p) => p.qty), 1);
    return Math.round((qty / max) * 100);
  }

  categoryBarWidth(count: number, list: { count: number }[]): number {
    const max = Math.max(...list.map((c) => c.count), 1);
    return Math.round((count / max) * 100);
  }

  /** Bar length vs max star bucket (same idea as order status bars). */
  ratingBarWidth(stars: number, distribution: DashboardRatingDistribution | undefined): number {
    if (!distribution) return 0;
    const max = Math.max(
      distribution[1],
      distribution[2],
      distribution[3],
      distribution[4],
      distribution[5],
      1
    );
    const k = stars as keyof DashboardRatingDistribution;
    const count = distribution[k] ?? 0;
    return Math.round((count / max) * 100);
  }

  getRatingCount(stars: number, distribution: DashboardRatingDistribution | undefined): number {
    if (!distribution) return 0;
    const k = stars as keyof DashboardRatingDistribution;
    return distribution[k] ?? 0;
  }
}
