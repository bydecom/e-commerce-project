import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface ToastMessage {
  text: string;
  variant?: 'info' | 'success' | 'error';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly subject = new Subject<ToastMessage>();

  readonly messages$ = this.subject.asObservable();

  show(text: string, variant: ToastMessage['variant'] = 'info'): void {
    this.subject.next({ text, variant });
  }
}
