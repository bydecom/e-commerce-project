import { CommonModule } from '@angular/common';
import {
  AfterViewChecked,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminChatbotService } from '../../../../core/services/admin-chatbot.service';

interface AdminChatMessage {
  text: string;
  isUser: boolean;
  suggestedPrompts?: string[];
}

@Component({
  selector: 'app-admin-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed bottom-6 right-8 z-[9999]">
      @if (showChat()) {
        <div
          class="mb-4 flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl transition-all duration-300"
          [ngClass]="{
            'fixed inset-0 h-full w-full mb-0 rounded-none': isFullScreen(),
            'absolute bottom-16 right-0 h-[520px] w-[380px] max-h-[80vh] max-w-[90vw]': !isFullScreen()
          }"
        >
          <!-- Header -->
          <div class="flex flex-shrink-0 items-center justify-between bg-amber-600 p-3 text-white">
            <div class="flex items-center gap-2">
              <svg class="h-5 w-5 text-amber-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <h3 class="text-sm font-bold tracking-wide">Admin Assistant</h3>
              <span class="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                Admin
              </span>
            </div>
            <div class="flex items-center gap-1">
              <button
                type="button"
                (click)="toggleFullScreen()"
                class="rounded-md p-1.5 text-amber-100 transition-colors hover:bg-amber-700 hover:text-white"
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
                class="rounded-md p-1.5 text-amber-100 transition-colors hover:bg-amber-700 hover:text-white"
              >
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Messages -->
          <div class="flex-1 overflow-y-auto bg-gray-50 p-4" #messagesContainer>
            <div [ngClass]="{ 'mx-auto max-w-4xl': isFullScreen() }" class="space-y-4">
              @for (msg of messages(); track $index) {
                <div class="flex flex-col" [ngClass]="{ 'items-end': msg.isUser, 'items-start': !msg.isUser }">
                  <div
                    class="max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed shadow-sm"
                    [ngClass]="msg.isUser
                      ? 'bg-amber-600 text-white rounded-tr-none'
                      : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'"
                  >{{msg.text}}</div>

                  @if (!msg.isUser && msg.suggestedPrompts && msg.suggestedPrompts.length > 0) {
                    <div class="mt-2 flex max-w-[85%] flex-wrap gap-1.5">
                      @for (prompt of msg.suggestedPrompts; track prompt) {
                        <button
                          type="button"
                          (click)="sendQuickPrompt(prompt)"
                          [disabled]="isTyping()"
                          class="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {{ prompt }}
                        </button>
                      }
                    </div>
                  }
                </div>
              }

              @if (isTyping()) {
                <div class="flex items-center gap-2 text-sm text-gray-500">
                  <div class="flex space-x-1.5 rounded-2xl rounded-tl-none border border-gray-100 bg-white p-3 shadow-sm">
                    <div class="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400"></div>
                    <div class="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400" style="animation-delay: 0.2s"></div>
                    <div class="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400" style="animation-delay: 0.4s"></div>
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Quick prompt suggestions -->
          <div class="flex justify-center items-center flex-shrink-0 flex-wrap gap-1.5 border-t border-gray-100 bg-amber-50 px-3 py-2">
            @for (prompt of quickPrompts; track prompt) {
              <button
                type="button"
                (click)="sendQuickPrompt(prompt)"
                [disabled]="isTyping()"
                class="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {{ prompt }}
              </button>
            }
          </div>

          <!-- Input -->
          <div class="flex-shrink-0 border-t border-gray-100 bg-white p-3">
            <div [ngClass]="{ 'mx-auto max-w-4xl': isFullScreen() }" class="flex flex-col gap-2">
              <div class="flex items-end gap-2">
                <textarea
                  [(ngModel)]="inputText"
                  (keyup.enter)="handleEnter($event)"
                  [disabled]="isTyping()"
                  placeholder="Ask about revenue, orders, customers..."
                  class="hide-scrollbar min-h-[44px] max-h-[100px] flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-[14px] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-gray-100"
                  rows="1"
                ></textarea>
                <button
                  type="button"
                  (click)="sendMessage()"
                  [disabled]="!inputText.trim() || isTyping()"
                  class="flex h-[44px] w-[44px] flex-shrink-0 items-center justify-center rounded-xl bg-amber-600 text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
              <div class="flex items-center justify-between px-1">
                <button
                  type="button"
                  (click)="resetConversation()"
                  class="flex items-center gap-1 text-[11px] text-gray-500 transition-colors hover:text-amber-600"
                >
                  <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Clear history
                </button>
                <span class="text-[10px] font-medium text-gray-400">Powered by AI</span>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Chat launcher button -->
      <button
        type="button"
        (click)="toggleChat()"
        class="flex h-14 w-14 items-center justify-center rounded-full bg-amber-600 text-white shadow-xl transition-transform hover:scale-105 focus:outline-none ring-4 ring-amber-100"
        [ngClass]="{ 'bg-amber-700 ring-amber-200': showChat() }"
        title="Admin Assistant"
      >
        @if (showChat()) {
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
          </svg>
        } @else {
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        }
      </button>
    </div>
  `,
  styles: [
    `
      .hide-scrollbar::-webkit-scrollbar { display: none; }
      .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    `,
  ],
})
export class AdminChatbotComponent implements OnInit, AfterViewChecked {
  private readonly adminChatbotApi = inject(AdminChatbotService);
  private readonly router = inject(Router);

  @ViewChild('messagesContainer') private messagesContainer!: ElementRef<HTMLElement>;

  readonly showChat = signal(false);
  readonly isFullScreen = signal(false);
  readonly isTyping = signal(false);

  inputText = '';
  readonly messages = signal<AdminChatMessage[]>([]);

  readonly quickPrompts = [
    'Weekly overview',
    'This month revenue',
    "Today's orders",
    'Low-stock products',
    'Alerts to review',
  ];

  ngOnInit(): void {
    this.messages.set([
      {
        text: 'Hello! I can report revenue, orders, customers, products, and alerts that need attention. What would you like to check?',
        isUser: false,
      },
    ]);
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
    this.messages.set([
      {
        text: 'Hello! I can report revenue, orders, customers, products, and alerts that need attention. What would you like to check?',
        isUser: false,
      },
    ]);
  }

  sendQuickPrompt(prompt: string): void {
    this.inputText = prompt;
    this.sendMessage();
  }

  sendMessage(): void {
    const text = this.inputText.trim();
    if (!text) return;

    this.messages.update((msgs) => [...msgs, { text, isUser: true }]);
    this.inputText = '';
    this.isTyping.set(true);

    this.adminChatbotApi.sendMessage(text).subscribe({
      next: (res) => {
        this.isTyping.set(false);
        if (!res?.success) {
          this.messages.update((msgs) => [
            ...msgs,
            { text: "Sorry, I couldn't fetch the data. Please try again!", isUser: false },
          ]);
          return;
        }

        const botText = typeof res.data?.text === 'string' ? res.data.text.trim() : '';
        const botMsg: AdminChatMessage = { text: botText, isUser: false };

        for (const action of res.data.actions ?? []) {
          if (action.type === 'NAVIGATE_TO') {
            void this.router.navigate([action.payload.path]);
          }
          if (action.type === 'SUGGEST_PROMPTS') {
            botMsg.suggestedPrompts = action.payload.prompts;
          }
        }

        this.messages.update((msgs) => [...msgs, botMsg]);
      },
      error: () => {
        this.isTyping.set(false);
        this.messages.update((msgs) => [
          ...msgs,
          { text: 'Sorry, the AI system is busy. Please try again later!', isUser: false },
        ]);
      },
    });
  }

  private scrollToBottom(): void {
    if (!this.messagesContainer) return;
    try {
      this.messagesContainer.nativeElement.scrollTop =
        this.messagesContainer.nativeElement.scrollHeight;
    } catch {
      // ignore
    }
  }
}
