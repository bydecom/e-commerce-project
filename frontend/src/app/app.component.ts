import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { StoreSettingService } from './core/services/store-setting.service';
import { IdleService } from './core/services/idle.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
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
