import { DatePipe, DecimalPipe, isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Component, ElementRef, OnDestroy, OnInit, PLATFORM_ID, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Chart, registerables } from 'chart.js';
import { environment } from '../../../../environments/environment';
import { DashboardApiService, type RevenueComparisonMode } from '../../../core/services/dashboard-api.service';
import type {
  DashboardOrderStatusItem,
  DashboardRatingDistribution,
  DashboardSummary,
  DashboardTopCustomer,
} from '../../../shared/models/dashboard.model';

Chart.register(...registerables);

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, RouterLink],
  template: `
    <div class="mx-auto max-w-7xl space-y-8">
      <div class="flex flex-col gap-4 border-b border-gray-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
        </div>

        <div class="flex items-center gap-3">
          <!-- Mode switcher -->
          <div class="inline-flex items-center rounded-lg bg-gray-100 p-1 ring-1 ring-gray-200">
            @for (m of modes; track m.value) {
              <button
                type="button"
                (click)="setMode(m.value)"
                class="rounded-md px-3 py-1.5 text-xs font-medium transition-all"
                [class]="globalMode() === m.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
              >
                {{ m.label }}
              </button>
            }
          </div>

          <!-- Export PDF dropdown -->
          <div class="relative">
            <button
              type="button"
              (click)="exportOpen.set(!exportOpen())"
              class="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              Export PDF
              <svg
                class="h-3.5 w-3.5 transition-transform duration-200"
                [class.rotate-180]="exportOpen()"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>

            @if (exportOpen()) {
              <!-- Click-outside backdrop -->
              <div class="fixed inset-0 z-20" (click)="exportOpen.set(false)"></div>

              <!-- Dropdown panel -->
              <div
                class="absolute right-0 top-full z-30 mt-2 w-80 rounded-xl border border-gray-200 bg-white p-4 shadow-lg"
                (click)="$event.stopPropagation()"
              >
                <p class="mb-3 text-xs font-semibold text-gray-700">Export PDF report</p>

                <div class="flex flex-col gap-3">
                  <div>
                    <label class="block text-xs font-medium text-gray-500">Time range</label>
                    <select
                      [(ngModel)]="pdfFilter.type"
                      class="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-1.5 text-sm"
                    >
                      <option value="ALL">All time</option>
                      <option value="MONTH">By month</option>
                      <option value="QUARTER">By quarter</option>
                      <option value="YEAR">By year</option>
                      <option value="CUSTOM">Date range</option>
                    </select>
                  </div>

                  @if (pdfFilter.type === 'MONTH') {
                    <div class="flex gap-2">
                      <div class="flex-1">
                        <label class="block text-xs font-medium text-gray-500">Month</label>
                        <select
                          [(ngModel)]="pdfFilter.month"
                          class="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
                        >
                          @for (m of monthOptions; track m) {
                            <option [ngValue]="m">{{ m }}</option>
                          }
                        </select>
                      </div>
                      <div class="flex-1">
                        <label class="block text-xs font-medium text-gray-500">Year</label>
                        <input
                          type="number"
                          [(ngModel)]="pdfFilter.year"
                          min="2000" max="2100"
                          class="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
                        />
                      </div>
                    </div>
                  }

                  @if (pdfFilter.type === 'QUARTER') {
                    <div class="flex gap-2">
                      <div class="flex-1">
                        <label class="block text-xs font-medium text-gray-500">Quarter</label>
                        <select
                          [(ngModel)]="pdfFilter.quarter"
                          class="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
                        >
                          @for (q of quarterOptions; track q) {
                            <option [ngValue]="q">Q{{ q }}</option>
                          }
                        </select>
                      </div>
                      <div class="flex-1">
                        <label class="block text-xs font-medium text-gray-500">Year</label>
                        <input
                          type="number"
                          [(ngModel)]="pdfFilter.year"
                          min="2000" max="2100"
                          class="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
                        />
                      </div>
                    </div>
                  }

                  @if (pdfFilter.type === 'YEAR') {
                    <div>
                      <label class="block text-xs font-medium text-gray-500">Year</label>
                      <input
                        type="number"
                        [(ngModel)]="pdfFilter.year"
                        min="2000" max="2100"
                        class="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
                      />
                    </div>
                  }

                  @if (pdfFilter.type === 'CUSTOM') {
                    <div class="flex gap-2">
                      <div class="flex-1">
                        <label class="block text-xs font-medium text-gray-500">From</label>
                        <input
                          type="date"
                          [(ngModel)]="pdfFilter.start"
                          class="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
                        />
                      </div>
                      <div class="flex-1">
                        <label class="block text-xs font-medium text-gray-500">To</label>
                        <input
                          type="date"
                          [(ngModel)]="pdfFilter.end"
                          class="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
                        />
                      </div>
                    </div>
                  }
                </div>

                <div class="mt-3 flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
                  <p class="text-[11px] text-gray-400">Exports DONE orders only</p>
                  <button
                    type="button"
                    (click)="exportPdf()"
                    [disabled]="exporting()"
                    class="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                    </svg>
                    {{ exporting() ? 'Building…' : 'Download PDF' }}
                  </button>
                </div>
              </div>
            }
          </div>

          <!-- Refresh -->
          <button
            type="button"
            (click)="load()"
            [disabled]="loading()"
            class="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <svg
              class="h-4 w-4"
              [class.animate-spin]="loading()"
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            {{ loading() ? 'Loading…' : 'Refresh' }}
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
        <section class="grid grid-cols-2 items-stretch gap-4 lg:grid-cols-4 xl:grid-cols-4">
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
          <div class="flex h-full min-h-[8.5rem] flex-col rounded-xl border border-amber-100 bg-amber-50 p-5 shadow-sm">
            <p class="text-xs font-medium uppercase tracking-wide text-amber-600">Avg Processing Time</p>
            <p class="mt-2 text-2xl font-bold text-amber-700">
              {{ d.keyMetrics.avgProcessingDays }} <span class="ml-1 text-sm font-normal text-amber-500">Days</span>
            </p>
            <p class="mt-auto pt-2 text-xs leading-snug text-amber-400">PENDING to DONE</p>
          </div>
          <div class="flex h-full min-h-[8.5rem] flex-col rounded-xl border border-red-100 bg-red-50 p-5 shadow-sm">
            <p class="text-xs font-medium uppercase tracking-wide text-red-600">Cancellation Rate</p>
            <p class="mt-2 text-2xl font-bold text-red-700">
              {{ d.keyMetrics.cancellationRate }} <span class="ml-1 text-sm font-normal text-red-500">%</span>
            </p>
            <p class="mt-auto pt-2 text-xs leading-snug text-red-400">Of total orders</p>
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

              <div class="relative z-10 mt-2 pt-4">
                <p class="text-[10px] leading-relaxed text-gray-400">
                  Powered by Gemini AI.
                </p>
              </div>
            </div>

            <!-- Revenue comparison (global mode) -->
            <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:flex-1 flex flex-col">
              <div class="flex items-start justify-between flex-wrap gap-2">
                <div>
                  <h2 class="text-sm font-semibold text-gray-900">Revenue comparison</h2>
                  <p class="mt-0.5 text-xs text-gray-500">
                    {{ comparisonCaption() }}
                  </p>
                </div>
              </div>

              <div class="mt-4 grid grid-cols-3 gap-2">
                <div class="rounded-md bg-gray-50 p-3">
                  <div class="mb-1 text-[11px] text-gray-500">Current period</div>
                  <div class="text-[17px] font-semibold text-gray-900">
                    {{ formatCurrencyCompact(compSummary().currentTotal) }}
                    <span class="ml-0.5 text-[11px] font-normal text-gray-500">VND</span>
                  </div>
                  @if (compSummary(); as s) {
                    <div
                      class="mt-1 flex items-center gap-1 text-[11px] font-medium"
                      [class]="s.changePercent === null ? 'text-gray-400' : (s.changePercent >= 0 ? 'text-emerald-600' : 'text-red-600')"
                    >
                      @if (s.changePercent === null) {
                        <span>No prior data</span>
                      } @else {
                        <span>{{ s.changePercent >= 0 ? '▲' : '▼' }}</span>
                        <span>{{ (s.changePercent >= 0 ? '+' : '') + s.changePercent }}% vs prior</span>
                      }
                    </div>
                  }
                </div>

                <div class="rounded-md bg-gray-50 p-3">
                  <div class="mb-1 text-[11px] text-gray-500">Previous period</div>
                  <div class="text-[17px] font-semibold text-gray-900">
                    {{ formatCurrencyCompact(compSummary().prevTotal) }}
                    <span class="ml-0.5 text-[11px] font-normal text-gray-500">VND</span>
                  </div>
                  <div class="mt-1 text-[11px] text-gray-500">Comparison base</div>
                </div>

                <div class="rounded-md bg-gray-50 p-3">
                  <div class="mb-1 text-[11px] text-gray-500">Best period</div>
                  <div class="text-[17px] font-semibold text-gray-900">
                    {{ formatCurrencyCompact(compSummary().bestVal) }}
                    <span class="ml-0.5 text-[11px] font-normal text-gray-500">VND</span>
                  </div>
                  <div class="mt-1 text-[11px] text-gray-500">{{ compSummary().bestLabel }}</div>
                </div>
              </div>

              <div class="relative mt-5 h-[220px] w-full flex-1">
                <canvas #compCanvas role="img" aria-label="Revenue comparison chart"></canvas>
              </div>

              <hr class="my-4 border-gray-100" />
              <div class="flex items-center justify-between flex-wrap gap-2 text-[11px] text-gray-500">
                <div class="flex gap-4">
                  <span class="flex items-center gap-1.5">
                    <span class="block h-2.5 w-2.5 rounded-sm bg-indigo-500"></span> Current
                  </span>
                  <span class="flex items-center gap-1.5">
                    <span class="block h-2.5 w-2.5 rounded-sm bg-indigo-200"></span> Previous
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-6">
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

          <!-- Top Customers -->
          <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div class="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h2 class="text-sm font-semibold text-gray-800">Top Customers</h2>
                <p class="mt-0.5 text-[11px] text-gray-400">Highest spenders in selected period</p>
              </div>
            </div>

            <ul class="mt-4 space-y-3">
              @for (c of d.charts.topCustomers; track c.userId; let i = $index) {
                <li class="flex items-center gap-3">
                  <span
                    class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                    [class]="i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-100 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-400'"
                  >
                    {{ i + 1 }}
                  </span>

                  <div class="min-w-0 flex-1">
                    <div class="flex items-center justify-between gap-2">
                      <span class="truncate text-xs font-medium text-gray-800">
                        {{ c.name ?? c.email }}
                      </span>
                      <span class="shrink-0 text-xs font-semibold text-gray-900">
                        {{ formatCurrencyCompact(c.totalSpent) }}
                        <span class="text-[10px] font-normal text-gray-400">VND</span>
                      </span>
                    </div>
                    <div class="mt-0.5 flex items-center justify-between gap-2">
                      <span class="truncate text-[11px] text-gray-400">{{ c.email }}</span>
                      <span class="shrink-0 text-[11px] text-gray-400">{{ c.orderCount }} orders</span>
                    </div>
                    <div class="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        class="h-full rounded-full bg-indigo-400 transition-[width] duration-500 ease-out"
                        [style.width.%]="topCustomerBarWidth(c.totalSpent, d.charts.topCustomers)"
                      ></div>
                    </div>
                  </div>
                </li>
              } @empty {
                <li class="py-4 text-center text-sm text-gray-400">No data for selected period</li>
              }
            </ul>
          </div>
          </div><!-- end right column wrapper -->

          <div class="col-span-full rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div class="flex items-center justify-between">
              <h2 class="text-sm font-semibold text-gray-800">Orders by status</h2>
              <span class="text-xs text-gray-400">{{ totalOrderCount(d.charts.orderStatus) }} total</span>
            </div>
            <div class="mt-4 space-y-3">
              @for (item of d.charts.orderStatus; track item.status) {
                <div class="flex items-center gap-3">
                  <span
                    class="w-24 shrink-0 rounded px-2 py-0.5 text-center text-xs font-medium"
                    [class]="statusBadgeClass(item.status)"
                  >
                    {{ statusLabel(item.status) }}
                  </span>
                  <div class="flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div
                      class="h-3 rounded-full transition-all"
                      [class]="statusBarColor(item.status)"
                      [style.width.%]="orderBarWidth(item.count, d.charts.orderStatus)"
                    ></div>
                  </div>
                  <span class="w-12 shrink-0 text-right text-xs">
                    <span class="font-medium text-gray-700">{{ item.count }}</span>
                    <span class="ml-1 text-gray-400">{{ orderPct(item.count, d.charts.orderStatus) }}%</span>
                  </span>
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
                  <span class="w-5 shrink-0 text-right text-[11px] text-gray-400">#{{ i + 1 }}</span>
                  <div class="min-w-0 flex-1">
                    <div class="mb-1 flex justify-between text-xs">
                      <span class="truncate font-medium text-gray-700">{{ p.name }}</span>
                      <span class="ml-2 shrink-0 flex items-center gap-1">
                        <span class="font-medium text-gray-800">{{ p.qty }}</span>
                        <span class="text-[10px] text-gray-400">
                          {{ topProductPct(p.qty, d.charts.topProducts) }}%
                        </span>
                      </span>
                    </div>
                    <div class="h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <div
                        class="h-full rounded-full transition-[width] duration-500"
                        [style.width.%]="topProductBarWidth(p.qty, d.charts.topProducts)"
                        [style.background]="topProductBarColor(i)"
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
                      class="h-full rounded-full transition-[width] duration-500"
                      [style.width.%]="categoryBarWidth(c.count, d.charts.categoryBreakdown)"
                      [style.background]="categoryBarColor($index)"
                    ></div>
                  </div>
                  <span class="w-12 shrink-0 flex items-center justify-end gap-1 text-right">
                    <span class="font-medium text-gray-700">{{ c.count }}</span>
                    <span class="text-[10px] text-gray-400">
                      {{ categoryPct(c.count, d.charts.categoryBreakdown) }}%
                    </span>
                  </span>
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
export class AdminDashboardComponent implements OnInit, OnDestroy {
  private readonly api = inject(DashboardApiService);
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  @ViewChild('compCanvas') compCanvas!: ElementRef<HTMLCanvasElement>;
  private compChart: Chart | null = null;

  readonly today = new Date();

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly data = signal<DashboardSummary | null>(null);
  readonly exporting = signal(false);
  readonly exportOpen = signal(false);

  readonly globalMode = signal<RevenueComparisonMode>('WEEK');

  readonly modes: { value: RevenueComparisonMode; label: string }[] = [
    { value: 'WEEK',    label: '7 Days'  },
    { value: 'MONTH',   label: 'Month'   },
    { value: 'QUARTER', label: 'Quarter' },
    { value: 'YEAR',    label: 'Year'    },
  ];

  readonly compSummary = computed(() => {
    const rev = this.data()?.charts.revenueComparison;
    if (!rev) {
      return { currentTotal: 0, prevTotal: 0, changePercent: null as number | null, bestVal: 0, bestLabel: '–' };
    }

    const cur = Array.isArray(rev.current) ? rev.current : [];
    const labels = Array.isArray(rev.labels) ? rev.labels : [];
    const bestVal = cur.length > 0 ? Math.max(...cur, 0) : 0;
    const bestIdx = bestVal > 0 ? cur.indexOf(bestVal) : -1;
    const bestLabel = bestIdx >= 0 ? (labels[bestIdx] ?? '–') : '–';

    return {
      currentTotal: rev.summary?.currentTotal ?? 0,
      prevTotal: rev.summary?.prevTotal ?? 0,
      changePercent: rev.summary?.changePercent ?? null,
      bestVal,
      bestLabel,
    };
  });

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

  ngOnDestroy(): void {
    this.compChart?.destroy();
    this.compChart = null;
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getSummary(this.globalMode()).subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
        setTimeout(() => this.buildComparisonChart(), 0);
      },
      error: (err: Error) => {
        this.error.set(err.message || 'Could not load dashboard.');
        this.loading.set(false);
      },
    });
  }

  comparisonCaption(): string {
    const m = this.globalMode();
    if (m === 'MONTH') return 'Weekly breakdown — this month vs last month';
    if (m === 'QUARTER') return 'Monthly breakdown — this quarter vs last quarter';
    if (m === 'YEAR') return 'Monthly breakdown — this year vs last year';
    return 'Daily breakdown — this week vs last week';
  }

  private buildComparisonChart(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const rev = this.data()?.charts.revenueComparison;
    if (!rev || !this.compCanvas?.nativeElement) {
      this.compChart?.destroy();
      this.compChart = null;
      return;
    }

    const labels = rev.labels ?? [];
    const current = rev.current ?? [];
    const previous = rev.previous ?? [];

    const isDark = matchMedia('(prefers-color-scheme: dark)').matches;
    const tick = isDark ? '#94A3B8' : '#6B7280';
    const grid = isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)';
    const tooltipBg = isDark ? '#1E293B' : '#1F2937';

    this.compChart?.destroy();
    this.compChart = new Chart(this.compCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Current',
            data: current,
            backgroundColor: '#6366F1',
            borderColor: '#4F46E5',
            borderWidth: 1,
            borderRadius: 5,
            borderSkipped: false,
            barPercentage: 0.9,
            categoryPercentage: 0.6,
            order: 1,
          },
          {
            label: 'Previous',
            data: previous,
            backgroundColor: isDark ? '#3730A3' : '#C7D2FE',
            borderColor: isDark ? '#4338CA' : '#A5B4FC',
            borderWidth: 1,
            borderRadius: 5,
            borderSkipped: false,
            barPercentage: 0.9,
            categoryPercentage: 0.6,
            order: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 500, easing: 'easeOutQuart' as any },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: tooltipBg,
            titleColor: '#F9FAFB',
            bodyColor: '#D1D5DB',
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              title: (ctx: any) => ctx?.[0]?.label,
              label: (ctx: any) => {
                const v = Number(ctx?.parsed?.y ?? 0);
                const prefix = ctx?.dataset?.label === 'Previous' ? '  Previous: ' : '  Current:  ';
                return `${prefix}${this.formatCurrencyCompact(v)} VND`;
              },
              afterBody: (ctx: any) => {
                const cur = Number(ctx?.find((c: any) => c.dataset?.label === 'Current')?.parsed?.y ?? 0);
                const prev = Number(ctx?.find((c: any) => c.dataset?.label === 'Previous')?.parsed?.y ?? 0);
                if (!prev) return '';
                const diff = (((cur - prev) / prev) * 100).toFixed(1);
                return `  Change:    ${cur >= prev ? '+' : ''}${diff}%`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: tick, font: { size: 11 }, autoSkip: false, maxRotation: 0 },
          },
          y: {
            border: { display: false, dash: [4, 4] },
            grid: { color: grid },
            title: {
              display: true,
              text: 'VND',
              color: tick,
              font: { size: 11 },
            },
            ticks: {
              color: tick,
              font: { size: 10 },
              maxTicksLimit: 5,
              callback: (v: any) => this.formatCurrencyCompact(Number(v)),
            },
            min: 0,
          },
        },
      },
    });
  }

  setMode(mode: RevenueComparisonMode): void {
    if (this.globalMode() === mode) return;
    this.globalMode.set(mode);
    this.load();
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
    this.exportOpen.set(false);
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

  totalOrderCount(items: DashboardOrderStatusItem[]): number {
    return items.reduce((s, i) => s + i.count, 0);
  }

  orderPct(count: number, items: DashboardOrderStatusItem[]): string {
    const total = this.totalOrderCount(items);
    return total > 0 ? ((count / total) * 100).toFixed(0) : '0';
  }

  statusBadgeClass(status: string): string {
    const map: Record<string, string> = {
      PENDING: 'bg-amber-50 text-amber-700',
      CONFIRMED: 'bg-blue-50 text-blue-700',
      SHIPPING: 'bg-indigo-50 text-indigo-700',
      DONE: 'bg-emerald-50 text-emerald-700',
      CANCELLED: 'bg-slate-100 text-slate-600',
    };
    return map[status] ?? 'bg-gray-100 text-gray-600';
  }

  orderBarWidth(count: number, items: DashboardOrderStatusItem[]): number {
    const max = Math.max(...items.map((i) => i.count), 1);
    return Math.round((count / max) * 100);
  }

  topProductPct(qty: number, list: { qty: number }[]): string {
    const total = list.reduce((s, p) => s + p.qty, 0);
    return total > 0 ? ((qty / total) * 100).toFixed(0) : '0';
  }

  topProductBarColor(index: number): string {
    const colors = ['#6366F1', '#818CF8', '#A5B4FC', '#C7D2FE', '#E0E7FF'];
    return colors[index] ?? '#E0E7FF';
  }

  topProductBarWidth(qty: number, list: { qty: number }[]): number {
    const max = Math.max(...list.map((p) => p.qty), 1);
    return Math.round((qty / max) * 100);
  }

  categoryPct(count: number, list: { count: number }[]): string {
    const total = list.reduce((s, c) => s + c.count, 0);
    return total > 0 ? ((count / total) * 100).toFixed(0) : '0';
  }

  categoryBarColor(index: number): string {
    const colors = ['#10B981', '#34D399', '#6EE7B7', '#6EE7B7', '#A7F3D0', '#D1FAE5'];
    return colors[index] ?? '#D1FAE5';
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

  topCustomerBarWidth(spent: number, customers: DashboardTopCustomer[]): number {
    const max = Math.max(...customers.map((c) => c.totalSpent), 1);
    return Math.round((spent / max) * 100);
  }

  formatCurrencyCompact(value: number): string {
    if (!Number.isFinite(value)) return '0';
    const v = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    if (v >= 1_000_000_000) return sign + (v / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
    if (v >= 1_000_000) return sign + (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (v >= 1_000) return sign + (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    return sign + Math.round(v).toString();
  }
}
