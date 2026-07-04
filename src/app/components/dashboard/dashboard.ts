import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AgGridAngular } from 'ag-grid-angular';
import {
  ColDef,
  themeQuartz
} from 'ag-grid-community';

import { AgCharts } from 'ag-charts-angular';
import {
  AgChartOptions,
  ModuleRegistry as ChartModuleRegistry,
  PieSeriesModule
} from 'ag-charts-community';
import { AccountService, AccountSummary } from '../../services/account'; // 確認您的路徑

// 註冊 AG Charts 需要的模組 (例如：圓餅圖)
ChartModuleRegistry.registerModules([PieSeriesModule]);

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
  // 📊 AG Charts 穩健版設定 (確保背景透明與基本屬性正確)
  public chartOptions: AgChartOptions = {
    data: [],
    background: { visible: false },
    series: [{
      type: 'pie'as any,
      angleKey: 'amount',
      calloutLabelKey: 'asset',
      sectorLabelKey: 'amount',
      innerRadiusRatio: 0.6, // 甜甜圈樣式
    }]
  };

  // 🚀 動態策略控制台變數
  public totalAssets: number = 0;           // 正確的總資產
  public currentHoldingsPercentage: number = 0;

  // 核心：自訂策略邊界陣列 (預設 30, 60, 80)
  public breakpoints: number[] = [30, 60, 80];

  // 策略區塊顏色庫
  private strategyColors = ['#2ecc71', '#f39c12', '#e67e22', '#e74c3c', '#8e44ad', '#2c3e50'];

  constructor(private accountService: AccountService) {}

  ngOnInit() {
    this.accountService.getAccountSummary().subscribe({
      next: (data) => {
        this.summary = data;
        const reservedSettlement = Math.abs(data.settlementAmount);
        const realAvailableCash = data.balance - reservedSettlement;

        // 計算真實總資產與持股佔比 (淨權益數 / 真實總資產)
        this.totalAssets = realAvailableCash + data.stockValue;
        this.currentHoldingsPercentage = this.totalAssets > 0 ? (data.stockValue / this.totalAssets) * 100 : 0;

        // ... (更新 AG Grid rowData 的邏輯保留) ...
        this.rowData = [
          { category: '🟢 真實可用現金', amount: realAvailableCash },
          { category: '🔴 T+2 已佔用交割款', amount: reservedSettlement },
          { category: '🔵 股票帳面淨值', amount: data.stockValue },
          { category: '💰 銀行帳戶總餘額', amount: data.balance }
        ];

        // ⚠️ 關鍵修正：透過展開運算子 (...) 產生全新物件，強制觸發 AG Charts 重繪
        this.chartOptions = {
          ...this.chartOptions,
          data: [
            // 順序與顏色嚴格對應左側表格：綠、紅、藍
            { asset: '可用現金', amount: realAvailableCash },
            { asset: '待交割款', amount: reservedSettlement },
            { asset: '帳面市值', amount: data.stockValue }
          ]
        };
      }
    });
  }

  // ➕ 新增自訂區間
  addBreakpoint(value: string) {
    const num = Number(value);
    // 確保輸入的是 1~99 的數字，且陣列中還沒有這個值
    if (num > 0 && num < 100 && !this.breakpoints.includes(num)) {
      this.breakpoints.push(num);
      // 由小到大排序，確保長條圖繪製正確
      this.breakpoints.sort((a, b) => a - b);
    }
  }

  // ➖ 刪除自訂區間
  removeBreakpoint(bp: number) {
    this.breakpoints = this.breakpoints.filter(val => val !== bp);
  }

  // 🧩 動態計算長條圖的每一個區塊 (Segments)
  getSegments() {
    let segments = [];
    let previous = 0;

    this.breakpoints.forEach((bp, index) => {
      segments.push({
        start: previous,
        end: bp,
        width: bp - previous,
        color: this.strategyColors[index % this.strategyColors.length],
        isLast: false
      });
      previous = bp;
    });

    // 補上最後一段到 100% 的區塊
    segments.push({
      start: previous,
      end: 100,
      width: 100 - previous,
      color: this.strategyColors[this.breakpoints.length % this.strategyColors.length],
      isLast: true
    });

    return segments;
  }

  // 🎯 根據當前持股水位，動態決定要顯示的策略內容
  getCurrentStrategyInfo() {
    const segments = this.getSegments();
    // 找出當前水位落在哪一個區塊
    const activeSeg = segments.find(s => this.currentHoldingsPercentage >= s.start && this.currentHoldingsPercentage <= s.end) || segments[0];

    // 動態回傳策略內容
    let strategyName = '';
    let strategyDesc = '';

    if (activeSeg.start < 30) {
      strategyName = '防禦建倉期 (Low Risk)';
      strategyDesc = '水位極低。啟動 n8n 監控 00919、00999A 等高股息 ETF 買點，穩健建立底倉。';
    } else if (activeSeg.start < 60) {
      strategyName = '波段操作期 (Medium Risk)';
      strategyDesc = '持股適中。透過 AI 顧問過濾 VStockLab 訊號，尋找強勢突破股進行波段操作。';
    } else {
      strategyName = '動能警戒區 (High Risk)';
      strategyDesc = '部位偏高！需嚴格控管融資槓桿，並強制啟動 n8n 自動停損停利機制。';
    }

    return {
      range: `[${activeSeg.start}% ~ ${activeSeg.end}%]`,
      color: activeSeg.color,
      name: strategyName,
      description: strategyDesc
    };
  }
}
