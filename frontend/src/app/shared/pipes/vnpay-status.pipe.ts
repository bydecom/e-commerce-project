import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'vnpayStatus',
  standalone: true,
})
export class VnpayStatusPipe implements PipeTransform {
  transform(code: string | null | undefined): string {
    if (!code) return 'Unknown status';

    const statusMap: Record<string, string> = {
      '00': 'Transaction successful',
      '07': 'Successfully debited (suspected fraud)',
      '09': 'Not registered for Internet Banking',
      '10': 'Verification failed (3 times)',
      '11': 'Payment timeout expired',
      '12': 'Account or card blocked',
      '24': 'Customer cancelled transaction',
      '51': 'Insufficient balance',
      '65': 'Transaction limit exceeded',
      '75': 'Bank is undergoing maintenance',
      '79': 'Incorrect password entered too many times',
      '99': 'Exception error',
    };

    return statusMap[code] || `Unknown error (${code})`;
  }
}
