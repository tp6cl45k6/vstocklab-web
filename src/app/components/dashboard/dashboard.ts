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
  target?: string; // 🌟 補上目標標的
  prompt?: string; // 🌟 補上提示詞
  desc?: string;   // 保持可選，為了相容舊資料
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
  public accountNumber: string = '';
  public ownerName: string = '';
  public myTheme: string = 'ag-theme-alpine';

  // --- 第二區：策略水位拖曳與持股指標 ---
  @ViewChild('progressBar') progressBar!: ElementRef;
  public currentHolding: number = 0; // 預設 0，稍後依真實資料計算
  // --- 🌟 在上方變數宣告區加入這些 ---
  public baseCapital: number = 0;   // 100% 尾邊的基準 (可用現金 + 投資成本)
  public costPercent: number = 0;   // 本金水位 (%)
  public valuePercent: number = 0;  // 市值水位 (%)
  public isProfit: boolean = false; // 是否賺錢
  public deltaLeft: number = 0;     // 色帶起始點
  public deltaWidth: number = 0;    // 色帶寬度
  public thresholds: number[] = [30, 80];
  public zones: StrategyZone[] = [
    { color: '#2ecc71', name: '保守佈局期', target: '所有股票', prompt: '請根據「台股夜盤指標 (EWT)」與「美股科技股 (TSM, NVDA)」的漲跌幅，作為今日台股大盤的開盤預期，推估目標 ETF 的震盪區間，在等比例跌價時分批買進。' },
    { color: '#f1c40f', name: '波段操作期 (Medium Risk)', target: '所有股票', prompt: '請根據「台股夜盤指標 (EWT)」與「美股科技股 (TSM, NVDA)」的漲跌幅，精準推估三檔主動式 ETF（00403A、00405A、00407A）今日的預估開盤價與震盪區間，尋找強勢突破股操作。' },
    { color: '#e74c3c', name: '獲利了結期', target: '所有股票', prompt: '請分析目前大盤資金流向，若目標標的處於高檔且乖離率過大，提供分批獲利了結的減碼建議。' }
  ];
  // --- 🌟 區段編輯模式變數 ---
  public isEditingZone: boolean = false;
  public editTempName: string = '';
  public editTempTarget: string = ''; // 🌟 替換為 Target
  public editTempPrompt: string = ''; // 🌟 替換為 Prompt

  // 🌟 新增：下拉選單可選的標的
  public availableTargets: string[] = ['所有股票', '00403A (統一升級50)', '00405A (富邦台灣龍耀)', '00407A (凱基台灣)'];

  // 🌟 新增：系統內建的 AI 策略提示詞範本
  public systemPrompts = [
    { label: '--- 🤖 快速套用系統策略範本 ---', value: '' },
    { label: '📉 逢低佈局 (大盤回檔承接)', value: '請根據昨日美股四大指數與台積電 ADR 表現，評估今日台股大盤壓力與支撐。針對目標標的，若開盤預估跌幅超過 1.5%，請規劃往下分批承接的買進點位與資金比例，並提示需避開的風險板塊。' },
    { label: '🚀 強勢動能 (夜盤與美股連動)', value: '請根據「台股夜盤指標 (EWT)」與「美股科技股 (TSM, NVDA)」的漲跌幅，作為今日台股大盤的開盤預期，精準推估目標標的今日的預估開盤價與震盪區間，尋找強勢突破的操作機會。' },
    { label: '💰 高檔停利 (乖離率過大減碼)', value: '請分析目前大盤資金流向與標的季線乖離率。若目標標的處於高檔且乖離率過大，或遇到前波技術面高點壓力，請啟動風險控管機制，提供分批獲利了結的減碼建議。' },
    { label: '💸 高股息專用 (殖利率推估)', value: '針對高股息 ETF 目標標的，請計算目前 2026 年價位對應的預估年化殖利率。若預估殖利率高於您的設定標準且成分股基本面無虞，請評估除息前的買點，並給出資金分批進場建議。' }
  ];

  public activeHandleIndex: number | null = null;
  public activeZoneIndex: number = 1;

  // 🌟 2. 注入 AccountService
  constructor(private accountService: AccountService) { }

  ngOnInit() {
    // 先初始化 summary，避免非同步互相覆蓋
    this.summary = {
      totalAsset: 0,
      balance: 0,
      stockValue: 0,
      settlementAmount: 0,
      totalInvestmentCost: 0
    };
    // 🌟 3. 呼叫後端 API 取得真實「帳戶總覽」
    this.accountService.getAccountSummary().subscribe({

      next: (data) => {
        // 🌟 1. 取得帳號與姓名 (對齊 server.js 回傳的欄位)
        this.accountNumber = data.accountNumber || 'default_acc';
        this.ownerName = data.ownerName || 'default_name';

        const rawBalance = data.balance || 0;
        const rawSettlement = data.settlementAmount || 0;
        const rawStockValue = data.stockValue || 0;

        // ✅ 終極修正：真實購買力 = 帳戶餘額 + 待交割款 (交割款為負數，直接相加即為扣除)
        const realPurchasingPower = rawBalance + rawSettlement;
        // 直接使用後端回傳的欄位名稱 (對齊 server.js)
        this.summary.totalAsset = realPurchasingPower + rawStockValue;
        this.summary.balance = realPurchasingPower;
        this.summary.stockValue = rawStockValue;
        this.summary.settlementAmount = rawSettlement;

        this.updateCurrentHolding();
        this.renderPieChart();

        // 🌟 2. 帳號資訊回來後，立刻根據帳號讀取本地策略設定！
        this.loadSettings();

        // 也可以順便計算真實的「當前持股比例」(股票市值 / (可用現金 + 股票市值))
        // const total = this.summary.balance + this.summary.stockValue;
        // if (total > 0) {
        //   this.currentHolding = Number(((this.summary.stockValue / total) * 100).toFixed(1));
        // }
      },
      error: (err) => console.error('無法取得帳戶總覽資料', err)
    });

    // 🌟 4. 呼叫後端 API 取得真實「庫存明細」
    this.accountService.getInventory().subscribe({
      next: (inventoryData) => {
        this.rowData = inventoryData;

        // ✅ 自動加總所有庫存的「投資成本」
        // 🌟 加上 : any，告訴 TypeScript 不要管這個物件的型別
        const totalInvest = inventoryData.reduce((sum, item: any) => sum + (item.investmentCost || 0), 0);
        // 確保 summary 物件存在後，將總成本塞入
        // if (!this.summary) {
        //   this.summary = {};
        // }
        this.summary.totalInvestmentCost = totalInvest;
        this.updateCurrentHolding();
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

    // 🌟 重新計算顏色
    this.updateZoneColors();
  }

  @HostListener('document:mouseup')
  stopDrag() {
    this.activeHandleIndex = null;
  }

  selectZone(index: number) {
    this.activeZoneIndex = index;
    this.isEditingZone = false; // 🌟 切換區段時自動退出編輯模式
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

    // 🌟 重新計算顏色
    this.updateZoneColors();
  }

  splitZone(zoneIndex: number, event: MouseEvent) {
    event.stopPropagation();
    const lowerBound = zoneIndex === 0 ? 0 : this.thresholds[zoneIndex - 1];
    const upperBound = zoneIndex === this.thresholds.length ? 100 : this.thresholds[zoneIndex];
    const newBoundary = Math.round((lowerBound + upperBound) / 2);

    this.thresholds.splice(zoneIndex, 0, newBoundary);
    const currentZone = this.zones[zoneIndex];
    this.zones.splice(zoneIndex + 1, 0, {
      color: '', // 🌟 先給空字串，交給下面的演算法決定
      name: currentZone.name + ' (拆分)',
      desc: '自訂切割產生的新策略區間。'
    });

    // 🌟 重新計算顏色
    this.updateZoneColors();
  }

  getZoneWidth(index: number): number {
    const lower = index === 0 ? 0 : this.thresholds[index - 1];
    const upper = index === this.thresholds.length ? 100 : this.thresholds[index];
    return upper - lower;
  }

  // --- 🌟 替換原有的 updateCurrentHolding() ---
  updateCurrentHolding() {
    // 必須確認成本與可用現金都有數值才能計算
    if (this.summary && this.summary.totalInvestmentCost >= 0 && this.summary.balance >= 0) {

      // 基準 (100% 尾邊) = 總投資成本 + 真實可用現金
      this.baseCapital = this.summary.totalInvestmentCost + this.summary.balance;

      if (this.baseCapital > 0) {
        // 1. 紀錄「本金水位」起點
        this.costPercent = Number(((this.summary.totalInvestmentCost / this.baseCapital) * 100).toFixed(1));

        // 2. 紀錄「市值水位」終點 (這也是策略實際要看的位置)
        this.valuePercent = Number(((this.summary.stockValue / this.baseCapital) * 100).toFixed(1));

        // 3. 判斷賺賠 (台股：紅賺、綠賠)
        this.isProfit = this.summary.stockValue >= this.summary.totalInvestmentCost;

        // 4. 計算損益色帶的位置與寬度
        this.deltaLeft = Math.min(this.costPercent, this.valuePercent);
        const diff = Math.abs(this.valuePercent - this.costPercent);
        this.deltaWidth = diff < 0.5 ? 0.5 : diff; // 若差距太小，保底給 0.5% 寬度才看得到

        // 當前持股變量改吃「市值水位」
        this.currentHolding = this.valuePercent;
      } else {
        this.costPercent = 0;
        this.valuePercent = 0;
        this.deltaWidth = 0;
      }
    }
  }

  // --- 🌟 動態綠黃紅漸層計算引擎 ---
  updateZoneColors() {
    this.zones.forEach((zone, index) => {
      const lower = index === 0 ? 0 : this.thresholds[index - 1];
      const upper = index === this.thresholds.length ? 100 : this.thresholds[index];
      const mid = (lower + upper) / 2; // 找出區塊的中心點
      zone.color = this.getColorByPercentage(mid);
    });
  }

  getColorByPercentage(percent: number): string {
    const p = Math.max(0, Math.min(100, percent));
    let r1, g1, b1, r2, g2, b2, fraction;

    if (p <= 50) {
      // 0% ~ 50%：綠色 (#2ecc71) 漸層到 黃色 (#f1c40f)
      r1 = 46; g1 = 204; b1 = 113;
      r2 = 241; g2 = 196; b2 = 15;
      fraction = p / 50;
    } else {
      // 50% ~ 100%：黃色 (#f1c40f) 漸層到 紅色 (#e74c3c)
      r1 = 241; g1 = 196; b1 = 15;
      r2 = 231; g2 = 76; b2 = 60;
      fraction = (p - 50) / 50;
    }

    const r = Math.round(r1 + (r2 - r1) * fraction);
    const g = Math.round(g1 + (g2 - g1) * fraction);
    const b = Math.round(b1 + (b2 - b1) * fraction);

    return `rgb(${r}, ${g}, ${b})`;
  }

  // --- 🌟 套用系統策略提示詞 ---
  applySystemPrompt(event: any) {
    const selectedPrompt = event.target.value;
    if (selectedPrompt) {
      this.editTempPrompt = selectedPrompt; // 替換 Textarea 的內容
      event.target.value = ''; // 選擇完畢後將下拉選單恢復至預設(第一項)，方便下次重新選擇
    }
  }

  // --- 🌟 卡片編輯功能 ---
  startEditZone() {
    this.isEditingZone = true;
    const current = this.zones[this.activeZoneIndex];
    this.editTempName = current.name || '';
    // 向下相容舊版資料：如果舊資料沒有 target 或 prompt，就給預設值
    this.editTempTarget = current.target || '所有股票';
    this.editTempPrompt = current.prompt || current.desc || '';
  }

  saveZoneEdit() {
    this.zones[this.activeZoneIndex].name = this.editTempName;
    this.zones[this.activeZoneIndex].target = this.editTempTarget;
    this.zones[this.activeZoneIndex].prompt = this.editTempPrompt;
    // 清空舊的 desc，確保未來都吃 prompt 欄位
    delete this.zones[this.activeZoneIndex].desc;

    this.isEditingZone = false;
    this.saveSettings();
  }

  cancelZoneEdit() {
    this.isEditingZone = false;
  }

  // --- 🌟 雲端策略設定檔存取 (取代原本的 LocalStorage) ---
  saveSettings() {
    if (!this.accountNumber || !this.ownerName) {
      alert('⚠️ 尚未取得帳號資訊，無法儲存設定！');
      return;
    }

    // 將邊界 (thresholds) 與 區段 (zones) 打包
    const settings = {
      thresholds: this.thresholds,
      zones: this.zones
    };

    // 呼叫 API 將設定寫入後端與 Google Cloud
    this.accountService.saveStrategySettings(this.accountNumber, this.ownerName, settings)
      .subscribe({
        next: () => {
          alert(`✅ 策略設定已成功同步至雲端！\n帳號：${this.accountNumber} (${this.ownerName})`);
        },
        // 🌟 修正：加上 : any
        error: (err: any) => {
          console.error('❌ 雲端儲存失敗', err);
          alert('⚠️ 儲存至雲端失敗，請檢查網路或後端連線。');
        }
      });
  }

  loadSettings() {
    if (!this.accountNumber || !this.ownerName) return;

    this.accountService.loadStrategySettings(this.accountNumber, this.ownerName)
      .subscribe({
        // 🌟 修正：加上 : any
        next: (response: any) => {
          // 檢查雲端是否有回傳設定檔資料
          if (response && response.settings && response.settings.thresholds && response.settings.zones) {
            this.thresholds = response.settings.thresholds;
            this.zones = response.settings.zones;

            // 載入後，強制重新計算一次漸層顏色
            this.updateZoneColors();
            console.log(`✅ 已從雲端載入 ${this.ownerName} 的策略設定`);
          } else {
            console.log(`ℹ️ 雲端查無 ${this.ownerName} 的設定，使用系統預設策略`);
          }
        },
        // 🌟 修正：加上 : any
        error: (err: any) => {
          console.error('❌ 讀取雲端策略設定失敗', err);
          console.log('ℹ️ 暫時使用系統預設策略');
        }
      });
  }
}
