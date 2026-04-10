import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FOOTER_CONTACT } from '../../constants/footer-contact';
import { StoreSettingService } from '../../../core/services/store-setting.service';

const DEFAULT_TAGLINE =
  'Quality products, fair prices, and a straightforward shopping experience.';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
})
export class FooterComponent {
  private readonly storeSetting = inject(StoreSettingService);

  readonly fallback = FOOTER_CONTACT;
  readonly year = new Date().getFullYear();

  readonly shopName = computed(() => this.storeSetting.setting()?.name ?? 'E‑Commerce');

  readonly tagline = computed(() => {
    const d = this.storeSetting.setting()?.description?.trim();
    return d ? d : DEFAULT_TAGLINE;
  });

  readonly logoUrl = computed(() => this.storeSetting.setting()?.logoUrl ?? null);

  readonly email = computed(() => this.storeSetting.setting()?.email ?? FOOTER_CONTACT.email);

  readonly phone = computed(() => this.storeSetting.setting()?.phone ?? FOOTER_CONTACT.phone);

  readonly phoneDial = computed(() => {
    const raw = this.storeSetting.setting()?.phone ?? FOOTER_CONTACT.phone;
    const digits = raw.replace(/\D/g, '');
    return digits || FOOTER_CONTACT.phoneDial.replace(/\D/g, '');
  });

  readonly address = computed(() => this.storeSetting.setting()?.address ?? FOOTER_CONTACT.address);
}
