import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AccountSummary {
  accountNumber: string;
  ownerName: string;
  balance: number;
  stockValue: number;
  settlementAmount: number;
}

// 📦 庫存明細介面
export interface InventoryItem {
  stockNo: string;
  stockName: string;
  qty: number;
  costPrice: number;
  currentPrice: number;
  pnl: number;
  pnlRate: number;
}

@Injectable({
  providedIn: 'root'
})
export class AccountService {
  private apiUrl = 'http://localhost:3000/api/account';

  constructor(private http: HttpClient) {}

  getAccountSummary(): Observable<AccountSummary> {
    return this.http.get<AccountSummary>(`${this.apiUrl}/summary`);
  }

  // 📦 獲取庫存明細 API
  getInventory(): Observable<InventoryItem[]> {
    return this.http.get<InventoryItem[]>(`${this.apiUrl}/inventory`);
  }
}
