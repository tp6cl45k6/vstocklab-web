import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AgGridAngular } from 'ag-grid-angular';
import {
  ColDef,
  themeQuartz
} from 'ag-grid-community';

import { AgCharts } from 'ag-charts-angular';
import {
  AgChartOptions
} from 'ag-charts-community';
import { AccountService, AccountSummary } from '../../services/account';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, AgGridAngular, AgCharts],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss']
})
export class DashboardComponent implements OnInit {
  summary: AccountSummary | null = null;

  // 重新宣告 AG Grid 的主題變數
  public myTheme = themeQuartz;

  // 📊 AG Grid 的資料陣列與欄位定義
  public rowData: any[] = [];
  public colDefs: ColDef[] = [
    { field: 'category', headerName: '資產項目', flex: 1.5 },
    {
      field: 'amount', headerName: '金額 (NT$)', flex: 1,
      valueFormatter: (p) => new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', minimumFractionDigits: 0 }).format(p.value)
    }
  ];

  // 📊 AG Charts 圓餅圖的初始設定 (精簡版)
  public chartOptions: AgChartOptions = {
    data: [],
    background: { fill: 'transparent' },
    series: [{
      type: 'pie',
      angleKey: 'amount',
      calloutLabelKey: 'asset',
      sectorLabelKey: 'amount',
      innerRadiusRatio: 0.5 // 甜甜圈圖效果
    }]
  } as any;

  // 🚀 核心：總資產與當前水位
  public totalAssets: number = 0;           // 正確的總資產
  public currentStockRatio: number = 0;     // 當前股票佔總資產的百分比 (%)

  // 🚀 核心：策略區間閾值 (Thresholds)
  public zone1Max: number = 30; // 0% ~ 30%
  public zone2Max: number = 60; // 30% ~ 60%
  public zone3Max: number = 80; // 60% ~ 80%
  // 80% ~ 100% 為最後一個區間

  constructor(private accountService: AccountService) {}

  ngOnInit() {
    this.accountService.getAccountSummary().subscribe({
      next: (data) => {
        this.summary = data;
        const reservedSettlement = Math.abs(data.settlementAmount);
        const realAvailableCash = data.balance - reservedSettlement;

        // 2. 修正總資產：真實可用現金 + 股票帳面淨值
        this.totalAssets = realAvailableCash + data.stockValue;

        // 3. 計算當前股票部位佔比 (%)
        if (this.totalAssets > 0) {
          this.currentStockRatio = (data.stockValue / this.totalAssets) * 100;
        }

        this.rowData = [
          { category: '🟢 真實可用現金', amount: realAvailableCash },
          { category: '🔴 T+2 已佔用交割款', amount: reservedSettlement },
          { category: '🔵 股票帳面淨值', amount: data.stockValue },
          { category: '💰 銀行帳戶總餘額', amount: data.balance }
        ];

        this.chartOptions = {
          ...this.chartOptions,
          data: [
            // 順序與顏色嚴格對應左側表格：綠、紅、藍
            { asset: '可用現金', amount: realAvailableCash },
            { asset: '待交割款', amount: reservedSettlement },
            { asset: '帳面市值', amount: data.stockValue }
          ],
          series: [{
            type: 'pie',
            angleKey: 'amount',
            calloutLabelKey: 'asset', // 拉出引線顯示名稱
            fills: ['#2ecc71', '#e74c3c', '#3498db'],
            strokeWidth: 2,
            stroke: 'white', // 加上白色間距讓扇形更好看
            innerRadiusRatio: 0.65,
            innerLabels: [
              { text: 'VStockLab 總資產', fontSize: 14, color: '#7f8c8d' },
              {
                // 甜甜圈中間顯示修正後的總資產
                text: `NT$ ${(this.totalAssets / 10000).toFixed(1)}萬`,
                fontSize: 22,
                fontWeight: 'bold',
                color: '#2c3e50',
                margin: 4
              }
            ] as any,

            sectorLabelKey: 'amount',
            sectorLabel: {
              color: 'white',
              fontWeight: 'bold',
              formatter: ({ value }: any) => {
                // 計算這個扇形佔整個圓的百分比
                const total = realAvailableCash + reservedSettlement + data.stockValue;
                const percentage = ((Number(value) / total) * 100).toFixed(1);

                // 如果佔比太小(例如交割款)，就不顯示文字避免擠在一起
                if (Number(percentage) < 5) return '';

                // 顯示： xx%
                return `${percentage}%`;
              }
            },
            tooltip: {
              renderer: (params: any) => {
                return {
                  title: params.datum.asset,
                  content: `NT$ ${Number(params.datum.amount).toLocaleString('zh-TW')}`
                };
              }
            }
          }]
        } as any;
      }
    });
  }

  // 更新區間閾值的函數
  updateZone(zoneNumber: number, event: Event) {
    const value = Number((event.target as HTMLInputElement).value);
    if (zoneNumber === 1) this.zone1Max = value;
    if (zoneNumber === 2) this.zone2Max = value;
    if (zoneNumber === 3) this.zone3Max = value;
  }

  // 根據當前水位，AI 自動判定落在哪個策略
  get activeStrategy() {
    if (this.currentStockRatio <= this.zone1Max) {
      return { id: 1, name: '策略一 (建倉期)', desc: '持股過低。啟動網格買入或定期定額策略，優先佈局高股息 ETF。', color: '#2ecc71', range: `0% ~ ${this.zone1Max}%` };
    } else if (this.currentStockRatio <= this.zone2Max) {
      return { id: 2, name: '策略二 (波段操作)', desc: '持股適中。套用動能交易腳本，尋找突破買點，並嚴格執行部分停利。', color: '#f39c12', range: `${this.zone1Max}% ~ ${this.zone2Max}%` };
    } else if (this.currentStockRatio <= this.zone3Max) {
      return { id: 3, name: '策略三 (高位防禦)', desc: '持股偏高。停止買進新部位，啟動移動停損腳本，保留現金彈性。', color: '#e67e22', range: `${this.zone2Max}% ~ ${this.zone3Max}%` };
    } else {
      return { id: 4, name: '策略四 (極端警戒)', desc: '滿倉風險極高。強制減碼弱勢股，嚴禁使用融資，確保 T+2 交割安全。', color: '#e74c3c', range: `${this.zone3Max}% ~ 100%` };
    }
  }
}
