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

  // ==========================================
  // 🌟 修正：補上 http://localhost:3000 確保資料送對後端伺服器
  // ==========================================
  saveStrategySettings(accountNumber: string, ownerName: string, settings: any) {
    const payload = {
      accountNumber: accountNumber,
      ownerName: ownerName,
      settings: settings
    };
    // 🌟 加上完整的後端網址
    return this.http.post('http://localhost:3000/api/strategy/save', payload);
  }

  loadStrategySettings(accountNumber: string, ownerName: string) {
    // 🌟 加上完整的後端網址
    return this.http.get<any>(`http://localhost:3000/api/strategy/load?accountNumber=${accountNumber}&ownerName=${ownerName}`);
  }
  // ==========================================
}
