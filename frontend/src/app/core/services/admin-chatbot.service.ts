import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiSuccess } from '../../shared/models/api-response.model';
import type { ChatResponse } from './chatbot.service';

@Injectable({ providedIn: 'root' })
export class AdminChatbotService {
  private readonly http = inject(HttpClient);

  sendMessage(message: string): Observable<ApiSuccess<ChatResponse>> {
    return this.http.post<ApiSuccess<ChatResponse>>(
      `${environment.apiUrl}/api/ai/admin/chat`,
      { message },
    );
  }
}
