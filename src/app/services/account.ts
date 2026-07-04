import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

export interface AccountSummary {
  accountNumber: string;
  ownerName: string;
  balance: number;
}

@Injectable({
  providedIn: 'root',
})
export class AccountService {
  getAccountSummary(): Observable<AccountSummary> {
    return of({
      accountNumber: '0012345678',
      ownerName: 'Demo User',
      balance: 125000.5,
    });
  }
}
