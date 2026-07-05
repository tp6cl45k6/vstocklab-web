import { Component, ElementRef, ViewChild, HostListener, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { AgCharts } from 'ag-charts-angular';
import { ModuleRegistry, AllCommunityModule } from 'ag-charts-community';

// 🌟 1. 引入剛剛定義好的 AccountService
import { AccountService } from '../../services/account';

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
  // 初始值給 null 或 0，等待 API 資料回來
  public summary: any = null;
  public rowData: any[] = [];
  public colDefs: any[] = [];
  public chartOptions: any = {};
  public myTheme: string = 'ag-theme-alpine';

  // --- 第二區：策略水位拖曳與持股指標 ---
  @ViewChild('progressBar') progressBar!: ElementRef;
  public currentHolding: number = 0; // 預設 0，稍後依真實資料計算
  public thresholds: number[] = [30, 80];
  public zones: StrategyZone[] = [
    { color: '#82e0aa', name: '保守佈局期', desc: '等待低檔建倉...' },
    { color: '#f39c12', name: '波段操作期 (Medium Risk)', desc: '持股適中。透過 AI 顧問過濾 VStockLab 訊號，尋找強勢突破股進行波段操作。' },
    { color: '#e74c3c', name: '獲利了結期', desc: '高檔分批獲利了結...' }
  ];
  public activeHandleIndex: number | null = null;
  public activeZoneIndex: number = 1;

  // 🌟 2. 注入 AccountService
  constructor(private accountService: AccountService) { }

  ngOnInit() {
    // 🌟 3. 呼叫後端 API 取得真實「帳戶總覽」
    this.accountService.getAccountSummary().subscribe({

      next: (data) => {
        const rawBalance = data.balance || 0;
        const rawSettlement = data.settlementAmount || 0;
        const rawStockValue = data.stockValue || 0;

        // ✅ 終極修正：真實購買力 = 帳戶餘額 + 待交割款 (交割款為負數，直接相加即為扣除)
        const realPurchasingPower = rawBalance + rawSettlement;
        // 直接使用後端回傳的欄位名稱 (對齊 server.js)
        this.summary = {
          totalAsset: realPurchasingPower + rawStockValue, // 總資產維持不變 (帳戶餘額 + 市值)
          balance: realPurchasingPower,           // 卡片與圓餅圖改吃「真實購買力」
          stockValue: rawStockValue,
          settlementAmount: rawSettlement
        };

        // 資料回來後，重新渲染圓餅圖
        this.renderPieChart();

        // 也可以順便計算真實的「當前持股比例」(股票市值 / (可用現金 + 股票市值))
        const total = this.summary.balance + this.summary.stockValue;
        if (total > 0) {
          this.currentHolding = Number(((this.summary.stockValue / total) * 100).toFixed(1));
        }
      },
      error: (err) => console.error('無法取得帳戶總覽資料', err)
    });

    // 🌟 4. 呼叫後端 API 取得真實「庫存明細」
    this.accountService.getInventory().subscribe({
      next: (inventoryData) => {
        // 直接把 API 回傳的完整陣列塞給 AG Grid
        this.rowData = inventoryData;
      },
      error: (err) => console.error('無法取得庫存明細資料', err)
    });

    // --- AG Grid 欄位設定 (保持不變) ---
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
  }

  // 🌟 將圓餅圖渲染邏輯獨立出來
  renderPieChart() {
    if (!this.summary) return;

    const rawChartData = [
      { asset: '可用現金', amount: this.summary.balance },
      { asset: '帳面市值', amount: this.summary.stockValue },
      { asset: '待交割款', amount: Math.abs(this.summary.settlementAmount) }
    ];

    const totalAmount = rawChartData.reduce((sum, item) => sum + item.amount, 0);

    const processedChartData = rawChartData.map(item => {
      const percentage = totalAmount === 0 ? '0.0' : ((item.amount / totalAmount) * 100).toFixed(1);
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
        calloutLabelKey: 'asset',
        sectorLabelKey: 'displayLabel',
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
    const num = parseInt(color.replace("#", ""), 16),
      amt = Math.round(2.55 * percent),
      R = (num >> 16) + amt,
      B = (num >> 8 & 0x00FF) + amt,
      G = (num & 0x0000FF) + amt;
    return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 + (B < 255 ? B < 1 ? 0 : B : 255) * 0x100 + (G < 255 ? G < 1 ? 0 : G : 255)).toString(16).slice(1);
  }
}
