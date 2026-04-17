import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiSuccess } from '../../shared/models/api-response.model';

export type ChatAction =
  | { type: 'NAVIGATE_TO'; payload: { path: string } }
  | { type: 'SUGGEST_OPTIONS'; payload: { options: string[] } }
  | { type: 'SHOW_ORDERS'; payload: { orders: Array<{ id: number; status: string; total: number; date: string }> } }
  | { type: 'SHOW_PRODUCTS'; payload: { products: Array<{ id: number; name: string; price: number; imageUrl: string | null }> } };

export interface ChatResponse {
  text: string;
  actions: ChatAction[];
}

@Injectable({ providedIn: 'root' })
export class ChatbotService {
  private readonly http = inject(HttpClient);

  sendMessage(message: string): Observable<ApiSuccess<ChatResponse>> {
    return this.http.post<ApiSuccess<ChatResponse>>(`${environment.apiUrl}/api/ai/chat`, { message });
  }
}

