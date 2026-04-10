import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { StoreSettingService } from './core/services/store-setting.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'E-Commerce';

  private readonly storeSetting = inject(StoreSettingService);

  constructor() {
    this.storeSetting.load();
  }
}
