import { Component, inject } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, Router, RouterOutlet } from '@angular/router';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { ChatbotComponent } from '../../shared/components/chatbot/chatbot.component';
import { CheckoutConfirmModalComponent } from '../../shared/components/checkout-confirm-modal/checkout-confirm-modal.component';
import { CheckoutModalService } from '../../core/services/checkout-modal.service';
import { CheckoutBlockService } from '../../core/services/checkout-block.service';

@Component({
  selector: 'app-user-layout',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, FooterComponent, ChatbotComponent, CheckoutConfirmModalComponent],
  templateUrl: './user-layout.component.html',
})
export class UserLayoutComponent {
  private readonly modal = inject(CheckoutModalService);
  private readonly router = inject(Router);
  private readonly block = inject(CheckoutBlockService);

  readonly modalState = this.modal.state;

  constructor() {
    // Keep modal in sync with navigation results.
    this.router.events.subscribe((evt) => {
      if (!(evt instanceof NavigationEnd || evt instanceof NavigationCancel || evt instanceof NavigationError)) return;

      const url = evt instanceof NavigationEnd ? evt.urlAfterRedirects : this.router.url;
      if (url.startsWith('/checkout')) {
        this.modal.close();
        return;
      }
      if (url.startsWith('/cart') && this.modalState().isOpen && this.modalState().phase === 'loading') {
        // If checkout navigation failed and block exists, show blocked message.
        if (this.block.block()) {
          this.modal.showBlocked();
        } else {
          this.modal.close();
        }
      }
    });
  }

  onModalCancel(): void {
    this.modal.close();
  }

  onModalContinue(): void {
    this.modal.setLoading();
    void this.router.navigateByUrl('/checkout');
  }

  onModalOk(): void {
    this.modal.close();
  }
}
