import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

export interface AccountSummary {
  accountNumber: string;
  ownerName: string;
  balance: number;          // 帳戶餘額
  stockValue: number;       // 股票市值
  settlementAmount: number; // T+2 交割金額
}

@Injectable({
  providedIn: 'root',
})
export class AccountService {
  getAccountSummary(): Observable<AccountSummary> {
    // 模擬打 API 並等待 500 毫秒的延遲感
    return of({
      accountNumber: '0012345678',
      ownerName: 'Demo User',
      balance: 125000,
      stockValue: 854300,
      settlementAmount: -32000, // 負數代表需要扣款
    }).pipe(delay(500));
  }
}
