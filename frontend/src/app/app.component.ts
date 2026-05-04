import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { IdleService } from './core/services/idle.service';
import { StoreSettingService } from './core/services/store-setting.service';
import { ToastComponent } from './shared/components/toast/toast.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastComponent],
  template: `
    <router-outlet />
    <app-toast />
  `,
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  title = 'E-Commerce';

  private readonly storeSetting = inject(StoreSettingService);
  private readonly idleService = inject(IdleService);

  constructor() {
    this.storeSetting.load();
  }

  ngOnInit(): void {
    this.idleService.startWatching();
  }
}
