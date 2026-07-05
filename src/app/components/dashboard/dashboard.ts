import { Component, ElementRef, ViewChild, HostListener, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { AgCharts } from 'ag-charts-angular';
// 🌟 匯入 AG Charts 模組註冊器與社群版全模組 (單數 Module)
import { ModuleRegistry, AllCommunityModule } from 'ag-charts-community';

// 🌟 執行模組註冊 (徹底解決圓餅圖空白與其明細錯誤)
ModuleRegistry.registerModules([AllCommunityModule]);

export interface StrategyZone {
  color: string;
  name: string;
  desc: string;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss'],
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    AgGridAngular,
    AgCharts
  ]
})
export class DashboardComponent implements OnInit {
  // --- 第一區：帳戶總覽與資料網格 ---
  public summary: any = null;
  public rowData: any[] = [];
  public colDefs: any[] = [];
  public chartOptions: any = {};
  public myTheme: string = 'ag-theme-alpine';

  // --- 第二區：策略水位拖曳與持股指標 ---
  @ViewChild('progressBar') progressBar!: ElementRef;
  public currentHolding: number = 36.6; // 當前持股水位百分比
  public thresholds: number[] = [30, 80];
  public zones: StrategyZone[] = [
    { color: '#82e0aa', name: '保守佈局期', desc: '等待低檔建倉...' },
    { color: '#f39c12', name: '波段操作期 (Medium Risk)', desc: '持股適中。透過 AI 顧問過濾 VStockLab 訊號，尋找強勢突破股進行波段操作。' },
    { color: '#e74c3c', name: '獲利了結期', desc: '高檔分批獲利了結...' }
  ];
  public activeHandleIndex: number | null = null;
  public activeZoneIndex: number = 1; // 預設選中中間的波段操作期

  constructor() {}

  ngOnInit() {
    // 1. 上方四大卡片資料
    this.summary = {
      totalAsset: 1083769,
      balance: 685969,
      stockValue: 395167,
      settlementAmount: -146447
    };

    // 2. AG Charts 圓餅圖設定 (🌟 動態計算萬單位與百分比)
    const rawChartData = [
      { asset: '可用現金', amount: this.summary.balance },
      { asset: '帳面市值', amount: this.summary.stockValue },
      { asset: '待交割款', amount: Math.abs(this.summary.settlementAmount) }
    ];

    const totalAmount = rawChartData.reduce((sum, item) => sum + item.amount, 0);

    const processedChartData = rawChartData.map(item => {
      const percentage = ((item.amount / totalAmount) * 100).toFixed(1);
      const valueInWan = (item.amount / 10000).toFixed(1);
      return {
        ...item,
        displayLabel: `${valueInWan}萬\n(${percentage}%)`
      };
    });

    this.chartOptions = {
      data: processedChartData,
      series: [{
        type: 'pie',
        angleKey: 'amount',
        calloutLabelKey: 'asset',       // 圓餅外側：資產名稱
        sectorLabelKey: 'displayLabel', // 圓餅內側：數值與比例
        sectorLabel: {
          color: 'white',
          fontWeight: 'bold',
          fontSize: 12
        },
        tooltip: {
          renderer: (params: any) => {
            return {
              content: `${params.datum.asset}: ${params.datum.amount.toLocaleString()} 元`
            };
          }
        }
      }]
    };

    // 3. 完整的 12 個專業庫存欄位 (🌟 使用 cellClassRules 解決 Error #200)
    this.colDefs = [
      {
        headerName: '股票名稱', field: 'stockName', flex: 1.5,
        cellRenderer: (params: any) => `
          <div style="line-height: 1.3; margin-top: 4px;">
            <div style="color: #0d6efd; font-weight: bold;">${params.value}</div>
            <div style="color: #0d6efd; font-size: 11px;">${params.data.stockNo}</div>
          </div>
        `
      },
      { headerName: '交易別', field: 'tradeType', flex: 0.8 },
      { headerName: '股數', field: 'qty', flex: 1, valueFormatter: (params: any) => params.value.toLocaleString() },
      {
        headerName: '未實現損益', field: 'pnl', flex: 1,
        cellClassRules: {
          'vstock-pnl-up': (params: any) => params.value > 0,
          'vstock-pnl-down': (params: any) => params.value < 0
        },
        valueFormatter: (params: any) => params.value > 0 ? `+${params.value.toLocaleString()}` : params.value.toLocaleString()
      },
      {
        headerName: '報酬率%', field: 'pnlRate', flex: 1,
        cellClassRules: {
          'vstock-pnl-up': (params: any) => params.value > 0,
          'vstock-pnl-down': (params: any) => params.value < 0
        },
        valueFormatter: (params: any) => params.value > 0 ? `+${params.value.toFixed(2)}` : params.value.toFixed(2)
      },
      { headerName: '成交均價', field: 'costPrice', flex: 1, valueFormatter: (params: any) => params.value.toFixed(2) },
      { headerName: '投資成本', field: 'investmentCost', flex: 1, valueFormatter: (params: any) => params.value.toLocaleString() },
      { headerName: '融資金額', field: 'marginAmount', flex: 1, valueFormatter: (params: any) => params.value.toLocaleString() },
      { headerName: '券擔保品', field: 'collateral', flex: 0.8 },
      { headerName: '市價', field: 'currentPrice', flex: 1, valueFormatter: (params: any) => params.value.toFixed(2) },
      { headerName: '帳面價值', field: 'bookValue', flex: 1.2, valueFormatter: (params: any) => params.value.toLocaleString() },
      {
        headerName: '明細', flex: 0.8,
        cellRenderer: () => `<button style="background: #e74c3c; color: white; border: none; padding: 4px 10px; border-radius: 4px; font-size: 12px; cursor: pointer; margin-top: 10px;">明細</button>`
      }
    ];

    this.rowData = [
      { stockNo: '00403A', stockName: '主動統一升級50', tradeType: '融資', qty: 35000, pnl: 550, pnlRate: 0.35, costPrice: 11.08, investmentCost: 158300, marginAmount: 230000, collateral: 0, currentPrice: 11.14, bookValue: 158850 },
      { stockNo: '00405A', stockName: '主動富邦台灣龍耀', tradeType: '融資', qty: 35000, pnl: 493, pnlRate: 0.37, costPrice: 9.39, investmentCost: 135016, marginAmount: 194000, collateral: 0, currentPrice: 9.44, bookValue: 135509 },
      { stockNo: '00407A', stockName: '主動凱基台灣', tradeType: '融資', qty: 25000, pnl: 3, pnlRate: 0.00, costPrice: 9.98, investmentCost: 100805, marginAmount: 149000, collateral: 0, currentPrice: 10.02, bookValue: 100808 }
    ];
  }

  // --- 策略條拖拉與操作邏輯 ---
  startDrag(index: number, event: MouseEvent) {
    this.activeHandleIndex = index;
    event.stopPropagation();
  }

  @HostListener('document:mousemove', ['$event'])
  onDrag(event: MouseEvent) {
    if (this.activeHandleIndex === null) return;
    const rect = this.progressBar.nativeElement.getBoundingClientRect();
    let newPercent = ((event.clientX - rect.left) / rect.width) * 100;
    const min = this.activeHandleIndex === 0 ? 1 : this.thresholds[this.activeHandleIndex - 1] + 1;
    const max = this.activeHandleIndex === this.thresholds.length - 1 ? 99 : this.thresholds[this.activeHandleIndex + 1] - 1;
    newPercent = Math.max(min, Math.min(newPercent, max));
    this.thresholds[this.activeHandleIndex] = Math.round(newPercent * 10) / 10;
  }

  @HostListener('document:mouseup')
  stopDrag() {
    this.activeHandleIndex = null;
  }

  selectZone(index: number) {
    this.activeZoneIndex = index;
  }

  deleteZone(index: number, event: MouseEvent) {
    event.stopPropagation();
    if (this.zones.length <= 1) return;

    this.zones.splice(index, 1);
    if (index === 0) {
      this.thresholds.splice(0, 1);
    } else {
      this.thresholds.splice(index - 1, 1);
    }
    if (this.activeZoneIndex >= this.zones.length) {
      this.activeZoneIndex = this.zones.length - 1;
    }
  }

  splitZone(zoneIndex: number, event: MouseEvent) {
    event.stopPropagation();
    const lowerBound = zoneIndex === 0 ? 0 : this.thresholds[zoneIndex - 1];
    const upperBound = zoneIndex === this.thresholds.length ? 100 : this.thresholds[zoneIndex];
    const newBoundary = Math.round((lowerBound + upperBound) / 2);

    this.thresholds.splice(zoneIndex, 0, newBoundary);
    const currentZone = this.zones[zoneIndex];
    this.zones.splice(zoneIndex + 1, 0, {
      color: this.lightenColor(currentZone.color, 20),
      name: currentZone.name + ' (拆分)',
      desc: '自訂切割產生的新策略區間。'
    });
  }

  getZoneWidth(index: number): number {
    const lower = index === 0 ? 0 : this.thresholds[index - 1];
    const upper = index === this.thresholds.length ? 100 : this.thresholds[index];
    return upper - lower;
  }

  lightenColor(color: string, percent: number): string {
    const num = parseInt(color.replace("#",""), 16),
    amt = Math.round(2.55 * percent),
    R = (num >> 16) + amt,
    B = (num >> 8 & 0x00FF) + amt,
    G = (num & 0x0000FF) + amt;
    return "#" + (0x1000000 + (R<255?R<1?0:R:255)*0x10000 + (B<255?B<1?0:B:255)*0x100 + (G<255?G<1?0:G:255)).toString(16).slice(1);
  }
}
