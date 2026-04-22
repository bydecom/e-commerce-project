import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AdminNavbarComponent } from './admin-navbar.component';
import { AdminChatbotComponent } from '../components/admin-chatbot/admin-chatbot.component';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, AdminNavbarComponent, AdminChatbotComponent],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss',
})
export class AdminLayoutComponent {}
