import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http'; // 👈 新增這行
import { Observable } from 'rxjs';

export interface AccountSummary {
  accountNumber: string;
  ownerName: string;
  balance: number;
  stockValue: number;
  settlementAmount: number;
}

@Injectable({
  providedIn: 'root',
})
export class AccountService {

  // 注入 HttpClient
  constructor(private http: HttpClient) {}

  getAccountSummary(): Observable<AccountSummary> {
    // 捨棄假資料，直接打向剛剛建立的本機後端 API
    return this.http.get<AccountSummary>('http://localhost:3000/api/account/summary');
  }
}
