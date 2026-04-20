  import { CommonModule } from '@angular/common';
  import { Component, ElementRef, ViewChild, signal, AfterViewChecked, OnInit, inject } from '@angular/core';
  import { FormsModule } from '@angular/forms';
  import { Router, RouterLink } from '@angular/router';
  import { ChatbotService, type ChatAction as ApiChatAction } from '../../../core/services/chatbot.service';
  import { ServerCartService } from '../../../core/services/server-cart.service';
  import { OrderStatusBadgeComponent } from '../order-status-badge/order-status-badge.component';

  interface ChatAction {
    type: 'NAVIGATE_TO' | 'SUGGEST_OPTIONS' | 'SHOW_ORDERS' | 'SHOW_PRODUCTS' | 'REFRESH_CART';
    payload?: unknown;
  }

  interface ChatMessage {
    text: string;
    isUser: boolean;
    options?: string[];
    orders?: Array<{ id: number; status: string; total: number; date: string }>;
    products?: Array<{ id: number; name: string; price: number; imageUrl: string | null }>;
  }

  @Component({
    selector: 'app-chatbot',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink, OrderStatusBadgeComponent],
    template: `
      <div class="fixed bottom-6 right-8 z-[9999]">
        @if (showChat()) {
          <div
            class="mb-4 flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl transition-all duration-300"
            [ngClass]="{
              'fixed inset-0 h-full w-full mb-0 rounded-none': isFullScreen(),
              'absolute bottom-16 right-0 h-[550px] w-[380px] max-h-[80vh] max-w-[90vw]': !isFullScreen()
            }"
          >
            <div class="flex flex-shrink-0 items-center justify-between bg-gray-900 p-3 text-white">
              <div class="flex items-center gap-2">
                <svg class="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                <h3 class="text-sm font-bold tracking-wide">BanDai Assistant</h3>
              </div>
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  (click)="toggleFullScreen()"
                  class="rounded-md p-1.5 text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
                >
                  @if (isFullScreen()) {
                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"
                      />
                    </svg>
                  } @else {
                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
                      />
                    </svg>
                  }
                </button>
                <button
                  type="button"
                  (click)="toggleChat()"
                  class="rounded-md p-1.5 text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
                >
                  <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div class="flex-1 overflow-y-auto bg-gray-50 p-4" #messagesContainer>
              <div [ngClass]="{ 'mx-auto max-w-4xl': isFullScreen() }" class="space-y-4">
                @for (msg of messages(); track $index) {
                  <div class="flex flex-col" [ngClass]="{ 'items-end': msg.isUser, 'items-start': !msg.isUser }">
                    <div
                      class="max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed shadow-sm"
                      [ngClass]="msg.isUser
                        ? 'bg-indigo-600 text-white rounded-tr-none'
                        : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'"
                    >
                      {{ msg.text }}
                    </div>

                    @if (!msg.isUser && msg.products && msg.products.length > 0) {
                      <div class="mt-2 grid w-full max-w-[85%] grid-cols-1 gap-3">
                        @for (product of msg.products; track product.id) {
                          <article
                            class="group flex overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-slate-200/60 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:ring-indigo-200/80"
                          >
                            <div
                              class="relative h-24 w-24 flex-shrink-0 overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200"
                            >
                              @if (product.imageUrl) {
                                <img
                                  [src]="product.imageUrl"
                                  [alt]="product.name"
                                  class="h-full w-full object-contain p-2 transition duration-300 group-hover:scale-[1.02]"
                                />
                              } @else {
                                <div class="flex h-full items-center justify-center text-xs text-slate-400">No photo</div>
                              }
                            </div>
                            <div class="flex flex-1 flex-col justify-between p-3">
                              <h3 class="line-clamp-2 text-sm font-semibold leading-snug text-slate-900">
                                {{ product.name }}
                              </h3>
                              <div class="mt-1 flex items-center justify-between">
                                <p class="text-sm font-bold text-indigo-600">
                                  {{ product.price | number: '1.0-0' }}đ
                                </p>
                                <a
                                  [routerLink]="['/products', product.id]"
                                  (click)="closeChat()"
                                  class="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-indigo-700"
                                >
                                  View details
                                </a>
                              </div>
                            </div>
                          </article>
                        }
                      </div>
                    }

                    @if (!msg.isUser && msg.orders && msg.orders.length > 0) {
                      <div class="mt-2 grid w-full max-w-[85%] grid-cols-1 gap-2">
                        @for (order of msg.orders; track order.id) {
                          <div
                            class="flex flex-col rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition hover:border-indigo-300"
                          >
                            <div class="mb-1 flex items-center justify-between gap-2">
                              <span class="text-xs font-bold text-gray-700">Order #{{ order.id }}</span>
                              <app-order-status-badge [status]="order.status" size="sm" />
                            </div>
                            <div class="mt-1 flex items-center justify-between">
                              <span class="text-xs text-gray-500">{{ order.date | date: 'dd/MM/yyyy' }}</span>
                              <span class="text-sm font-bold text-indigo-600">{{ order.total | number: '1.0-0' }} VND</span>
                            </div>
                            <a
                              [routerLink]="['/orders', order.id]"
                              (click)="closeChat()"
                              class="mt-2 text-center text-[11px] font-semibold text-indigo-500 hover:text-indigo-700"
                            >
                              View details &rarr;
                            </a>
                          </div>
                        }
                      </div>
                    }

                    @if (!msg.isUser && msg.options && msg.options.length > 0) {
                      <div class="mt-2 flex max-w-[85%] flex-wrap gap-2">
                        @for (opt of msg.options; track opt) {
                          <button
                            type="button"
                            (click)="sendQuickReply(opt)"
                            class="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-100"
                          >
                            {{ opt }}
                          </button>
                        }
                      </div>
                    }
                  </div>
                }

                @if (isTyping()) {
                  <div class="flex items-center gap-2 text-sm text-gray-500">
                    <div class="flex space-x-1.5 rounded-2xl rounded-tl-none border border-gray-100 bg-white p-3 shadow-sm">
                      <div class="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400"></div>
                      <div
                        class="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400"
                        style="animation-delay: 0.2s"
                      ></div>
                      <div
                        class="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400"
                        style="animation-delay: 0.4s"
                      ></div>
                    </div>
                  </div>
                }
              </div>
            </div>

            <div class="flex-shrink-0 border-t border-gray-100 bg-white p-3">
              <div [ngClass]="{ 'mx-auto max-w-4xl': isFullScreen() }" class="flex flex-col gap-2">
                <div class="flex items-end gap-2">
                  <textarea
                    [(ngModel)]="inputText"
                    (keyup.enter)="handleEnter($event)"
                    placeholder="Ask me anything..."
                    class="hide-scrollbar min-h-[44px] max-h-[100px] flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-[14px] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    rows="1"
                  ></textarea>

                  <button
                    type="button"
                    (click)="sendMessage()"
                    [disabled]="!inputText.trim() || isTyping()"
                    class="flex h-[44px] w-[44px] flex-shrink-0 items-center justify-center rounded-xl bg-gray-900 text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                      />
                    </svg>
                  </button>
                </div>

                <div class="flex items-center justify-between px-1">
                  <button
                    type="button"
                    (click)="resetConversation()"
                    class="flex items-center gap-1 text-[11px] text-gray-500 transition-colors hover:text-indigo-600"
                  >
                    <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    Reset
                  </button>
                  <span class="text-[10px] font-medium text-gray-400">Powered by AI</span>
                </div>
              </div>
            </div>
          </div>
        }

        <button
          type="button"
          (click)="toggleChat()"
          class="flex h-14 w-14 items-center justify-center rounded-full bg-gray-900 text-white shadow-xl transition-transform hover:scale-105 focus:outline-none ring-4 ring-indigo-50"
          [ngClass]="{ 'bg-indigo-600 ring-indigo-100': showChat() }"
        >
          @if (showChat()) {
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
            </svg>
          } @else {
            <svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          }
        </button>
      </div>
    `,
    styles: [
      `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `,
    ],
  })
  export class ChatbotComponent implements OnInit, AfterViewChecked {
    private readonly router = inject(Router);
    private readonly chatbotApi = inject(ChatbotService);
    private readonly serverCart = inject(ServerCartService);
    @ViewChild('messagesContainer') private messagesContainer!: ElementRef<HTMLElement>;

    readonly showChat = signal(false);
    readonly isFullScreen = signal(false);
    readonly isTyping = signal(false);

    inputText = '';

    readonly messages = signal<ChatMessage[]>([]);

    /** Last products from SHOW_PRODUCTS — sent to the API as context on the next message. */
    private lastShownProductsCtx: Array<{ id: number; name: string }> = [];

    ngOnInit(): void {
      this.fetchInitialGreeting();
    }

    ngAfterViewChecked(): void {
      this.scrollToBottom();
    }

    toggleChat(): void {
      if (this.showChat() && this.isFullScreen()) {
        this.isFullScreen.set(false);
        return;
      }
      this.showChat.update((v) => !v);
    }

    closeChat(): void {
      this.isFullScreen.set(false);
      this.showChat.set(false);
    }

    toggleFullScreen(): void {
      this.isFullScreen.update((v) => !v);
    }

    handleEnter(event: Event): void {
      const e = event as KeyboardEvent;
      if (!e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    }

    resetConversation(): void {
      this.messages.set([]);
      this.fetchInitialGreeting();
    }

    private fetchInitialGreeting(): void {
      this.isTyping.set(true);
      this.chatbotApi.sendMessage('hello').subscribe({
        next: (res) => {
          this.isTyping.set(false);
          if (!res?.success) return;
          const newMsg: ChatMessage = { text: res.data.text, isUser: false };
          const actions = Array.isArray(res.data.actions) ? (res.data.actions as ApiChatAction[]) : [];
          if (actions.length) this.executeActions(actions, newMsg);
          this.messages.set([newMsg]);
        },
        error: () => {
          this.isTyping.set(false);
          this.messages.set([
            {
              text: 'Hello! I am BanDai AI Assistant. I can help you find products or check your order information.',
              isUser: false,
              options: ['View cart', 'Find products', 'My orders'],
            },
          ]);
        },
      });
    }

    sendQuickReply(option: string): void {
      const lowerOpt = option.toLowerCase();
      const isLocalIntercept =
        lowerOpt.includes('cart') || lowerOpt.includes('orders') || lowerOpt.includes('find products');

      if (isLocalIntercept) {
        this.messages.update((msgs) => [...msgs, { text: option, isUser: true }]);

        if (lowerOpt.includes('cart')) {
          this.messages.update((msgs) => [
            ...msgs,
            { text: 'I will take you to the cart page right now!', isUser: false },
          ]);
          void this.router.navigate(['/cart']);
          return;
        }

        if (lowerOpt.includes('orders')) {
          this.messages.update((msgs) => [
            ...msgs,
            { text: 'I will take you to the orders page right now!', isUser: false },
          ]);
          void this.router.navigate(['/orders']);
          return;
        }

        this.messages.update((msgs) => [
          ...msgs,
          {
            text: 'What product do you want to find? Please enter the keyword (e.g. "acer", "iphone", "laptop") into the chat box!',
            isUser: false,
          },
        ]);
        return;
      }

      this.inputText = option;
      this.sendMessage();
    }

    sendMessage(): void {
      const text = this.inputText.trim();
      if (!text) return;

      this.messages.update((msgs) => [...msgs, { text, isUser: true }]);
      this.inputText = '';

      this.isTyping.set(true);
      this.chatbotApi
        .sendMessage(
          text,
          this.lastShownProductsCtx.length > 0 ? { lastShownProducts: this.lastShownProductsCtx } : undefined
        )
        .subscribe({
          next: (res) => {
            this.isTyping.set(false);
            if (!res?.success) {
              this.messages.update((msgs) => [
                ...msgs,
                { text: "Sorry, I don't understand your request.", isUser: false },
              ]);
              return;
            }

            const botMsg: ChatMessage = { text: res.data.text, isUser: false };
            const actions = Array.isArray(res.data.actions) ? (res.data.actions as ApiChatAction[]) : [];
            if (actions.length) this.executeActions(actions, botMsg);
            this.messages.update((msgs) => [...msgs, botMsg]);
          },
          error: () => {
            this.isTyping.set(false);
            this.messages.update((msgs) => [
              ...msgs,
              { text: 'Sorry, the AI server is busy. Please try again later!', isUser: false },
            ]);
          },
        });
    }

    private executeActions(actions: ApiChatAction[], botMessage: ChatMessage): void {
      // Reload cart from API before NAVIGATE_TO so header/badge updates even when the next action changes route.
      if (actions.some((a) => a.type === 'REFRESH_CART')) {
        void this.serverCart.refresh().subscribe();
      }

      for (const action of actions) {
        switch (action.type) {
          case 'REFRESH_CART':
            break;
          case 'NAVIGATE_TO': {
            const path = action.payload?.path;
            if (path) void this.router.navigate([path]);
            break;
          }
          case 'SUGGEST_OPTIONS': {
            botMessage.options = Array.isArray(action.payload?.options) ? action.payload.options : [];
            break;
          }
          case 'SHOW_ORDERS': {
            botMessage.orders = Array.isArray(action.payload?.orders) ? action.payload.orders : [];
            break;
          }
          case 'SHOW_PRODUCTS': {
            const list = Array.isArray(action.payload?.products) ? action.payload.products : [];
            botMessage.products = list;
            this.lastShownProductsCtx = list.slice(0, 20).map((p) => ({ id: p.id, name: p.name }));
            break;
          }
        }
      }
    }

    private scrollToBottom(): void {
      if (!this.messagesContainer) return;
      try {
        this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
      } catch {
      }
    }
  }

