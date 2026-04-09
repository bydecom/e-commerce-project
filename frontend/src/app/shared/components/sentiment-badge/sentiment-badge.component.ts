import { Component, Input } from '@angular/core';
import type { SentimentLabel } from '../../models/feedback.model';

@Component({
  selector: 'app-sentiment-badge',
  standalone: true,
  templateUrl: './sentiment-badge.component.html',
  styleUrl: './sentiment-badge.component.scss',
})
export class SentimentBadgeComponent {
  @Input() sentiment: SentimentLabel | null | undefined;
}
