import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  IChartApi,
  LineSeries,
  UTCTimestamp,
  createChart,
} from 'lightweight-charts';
import { TechnicalAnalysisDto } from '../../core/models/portfolio.models';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-candlestick-chart',
  standalone: true,
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .chart-toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 10px;
      }
      .btn-group {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .toggle-chip {
        padding: 4px 10px;
        border-radius: var(--radius-sm);
        border: 1px solid var(--border-color);
        background: var(--bg-muted);
        color: var(--text-secondary);
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
      }
      .toggle-chip.active {
        border-color: var(--color-accent);
        color: var(--color-accent);
        background: var(--color-gain-bg);
      }
      .chart-box {
        width: 100%;
        height: 340px;
      }
      .oscillator-box {
        width: 100%;
        height: 115px;
        margin-top: 8px;
        border-top: 1px solid var(--border-color);
        padding-top: 6px;
      }
      .osc-label {
        font-size: 11px;
        color: var(--text-muted);
        margin-bottom: 4px;
        display: flex;
        justify-content: space-between;
      }
    `,
  ],
  template: `
    <div>
      <div class="chart-toolbar">
        <div class="btn-group" role="group" aria-label="Chart timeframe">
          @for (tf of timeframes; track tf) {
            <button
              type="button"
              class="toggle-chip mono"
              [class.active]="timeframe() === tf"
              (click)="timeframeChange.emit(tf)"
            >
              {{ tf }}
            </button>
          }
        </div>

        <div class="btn-group" role="group" aria-label="Technical indicators">
          <button
            type="button"
            class="toggle-chip"
            [class.active]="showSma()"
            (click)="toggleIndicator('sma')"
          >
            SMA 20/50
          </button>
          <button
            type="button"
            class="toggle-chip"
            [class.active]="showEma()"
            (click)="toggleIndicator('ema')"
          >
            EMA 12/26
          </button>
          <button
            type="button"
            class="toggle-chip"
            [class.active]="showBollinger()"
            (click)="toggleIndicator('bb')"
          >
            Bollinger
          </button>
          <button
            type="button"
            class="toggle-chip"
            [class.active]="showVolume()"
            (click)="toggleIndicator('vol')"
          >
            Volume
          </button>
          <button
            type="button"
            class="toggle-chip"
            [class.active]="oscillator() === 'RSI'"
            (click)="setOscillator('RSI')"
          >
            RSI (14)
          </button>
          <button
            type="button"
            class="toggle-chip"
            [class.active]="oscillator() === 'MACD'"
            (click)="setOscillator('MACD')"
          >
            MACD
          </button>
        </div>
      </div>

      <div #mainChart class="chart-box"></div>

      @if (oscillator() !== 'NONE') {
        <div class="oscillator-box">
          <div class="osc-label mono">
            <span>{{ oscillator() === 'RSI' ? 'RSI (14) — Overbought 70 / Oversold 30' : 'MACD (12, 26, 9)' }}</span>
            @if (analysis(); as a) {
              <span>
                RSI {{ a.summary.rsiValue | number: '1.1-1' }} · Hist {{ a.summary.macdHistogram | number: '1.2-2' }}
              </span>
            }
          </div>
          <div #oscChart style="width: 100%; height: 90px;"></div>
        </div>
      }
    </div>
  `,
})
export class CandlestickChartComponent implements AfterViewInit, OnDestroy {
  private readonly auth = inject(AuthService);

  readonly analysis = input<TechnicalAnalysisDto | null>(null);
  readonly timeframe = input<string>('1Y');
  readonly timeframeChange = output<string>();

  readonly timeframes = ['1D', '1W', '1M', '1Y', '5Y'];

  readonly showSma = signal<boolean>(true);
  readonly showEma = signal<boolean>(false);
  readonly showBollinger = signal<boolean>(false);
  readonly showVolume = signal<boolean>(true);
  readonly oscillator = signal<'NONE' | 'RSI' | 'MACD'>('RSI');

  @ViewChild('mainChart', { static: true }) mainChartRef!: ElementRef<HTMLDivElement>;
  @ViewChild('oscChart') oscChartRef?: ElementRef<HTMLDivElement>;

  private mainChart: IChartApi | null = null;
  private oscChart: IChartApi | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    effect(() => {
      const data = this.analysis();
      const dark = this.auth.theme() === 'dark';
      this.showSma();
      this.showEma();
      this.showBollinger();
      this.showVolume();
      this.oscillator();
      if (data && this.mainChartRef) {
        queueMicrotask(() => this.renderCharts(data, dark));
      }
    });
  }

  ngAfterViewInit(): void {
    const data = this.analysis();
    if (data) {
      this.renderCharts(data, this.auth.theme() === 'dark');
    }
    this.resizeObserver = new ResizeObserver(() => {
      if (this.mainChart && this.mainChartRef?.nativeElement) {
        this.mainChart.applyOptions({ width: this.mainChartRef.nativeElement.clientWidth });
      }
      if (this.oscChart && this.oscChartRef?.nativeElement) {
        this.oscChart.applyOptions({ width: this.oscChartRef.nativeElement.clientWidth });
      }
    });
    this.resizeObserver.observe(this.mainChartRef.nativeElement);
  }

  toggleIndicator(kind: 'sma' | 'ema' | 'bb' | 'vol'): void {
    if (kind === 'sma') this.showSma.update((v) => !v);
    if (kind === 'ema') this.showEma.update((v) => !v);
    if (kind === 'bb') this.showBollinger.update((v) => !v);
    if (kind === 'vol') this.showVolume.update((v) => !v);
  }

  setOscillator(mode: 'RSI' | 'MACD'): void {
    this.oscillator.update((cur) => (cur === mode ? 'NONE' : mode));
  }

  private renderCharts(data: TechnicalAnalysisDto, dark: boolean): void {
    this.destroyCharts();
    const container = this.mainChartRef?.nativeElement;
    if (!container || !data.candles.length) return;

    const textColor = dark ? '#94a3b8' : '#475569';
    const gridColor = dark ? 'rgba(30, 41, 59, 0.55)' : 'rgba(226, 232, 240, 0.8)';

    this.mainChart = createChart(container, {
      width: container.clientWidth || 640,
      height: 340,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor,
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      rightPriceScale: { borderColor: gridColor },
      timeScale: { borderColor: gridColor, timeVisible: data.timeframe === '1D' || data.timeframe === '1W' },
    });

    const candleSeries = this.mainChart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#f43f5e',
      borderUpColor: '#10b981',
      borderDownColor: '#f43f5e',
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e',
    });

    candleSeries.setData(
      data.candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    if (this.showVolume()) {
      const volSeries = this.mainChart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: '',
      });
      volSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.82, bottom: 0 },
      });
      volSeries.setData(
        data.candles.map((c) => ({
          time: c.time as UTCTimestamp,
          value: c.volume,
          color: c.close >= c.open ? 'rgba(16, 185, 129, 0.28)' : 'rgba(244, 63, 94, 0.28)',
        }))
      );
    }

    if (this.showSma()) {
      const s20 = this.mainChart.addSeries(LineSeries, { color: '#38bdf8', lineWidth: 2 });
      s20.setData(data.sma20.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
      const s50 = this.mainChart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 2 });
      s50.setData(data.sma50.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    }

    if (this.showEma()) {
      const e12 = this.mainChart.addSeries(LineSeries, { color: '#a855f7', lineWidth: 2 });
      e12.setData(data.ema12.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
      const e26 = this.mainChart.addSeries(LineSeries, { color: '#ec4899', lineWidth: 2 });
      e26.setData(data.ema26.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    }

    if (this.showBollinger() && data.bollinger.length) {
      const upper = this.mainChart.addSeries(LineSeries, { color: 'rgba(99, 102, 241, 0.75)', lineWidth: 1 });
      const lower = this.mainChart.addSeries(LineSeries, { color: 'rgba(99, 102, 241, 0.75)', lineWidth: 1 });
      upper.setData(data.bollinger.map((b) => ({ time: b.time as UTCTimestamp, value: b.upper })));
      lower.setData(data.bollinger.map((b) => ({ time: b.time as UTCTimestamp, value: b.lower })));
    }

    this.mainChart.timeScale().fitContent();

    const oscEl = this.oscChartRef?.nativeElement;
    if (this.oscillator() !== 'NONE' && oscEl) {
      this.oscChart = createChart(oscEl, {
        width: oscEl.clientWidth || container.clientWidth || 640,
        height: 90,
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor,
        },
        grid: {
          vertLines: { color: gridColor },
          horzLines: { color: gridColor },
        },
        rightPriceScale: { borderColor: gridColor },
        timeScale: { visible: false },
      });

      if (this.oscillator() === 'RSI') {
        const rsiLine = this.oscChart.addSeries(LineSeries, { color: '#10b981', lineWidth: 2 });
        rsiLine.setData(data.rsi14.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
      } else if (this.oscillator() === 'MACD') {
        const hist = this.oscChart.addSeries(HistogramSeries, {});
        hist.setData(
          data.macd.map((m) => ({
            time: m.time as UTCTimestamp,
            value: m.histogram,
            color: m.histogram >= 0 ? 'rgba(16, 185, 129, 0.6)' : 'rgba(244, 63, 94, 0.6)',
          }))
        );
        const macdLine = this.oscChart.addSeries(LineSeries, { color: '#38bdf8', lineWidth: 2 });
        macdLine.setData(data.macd.map((m) => ({ time: m.time as UTCTimestamp, value: m.macd })));
        const sigLine = this.oscChart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 1 });
        sigLine.setData(data.macd.map((m) => ({ time: m.time as UTCTimestamp, value: m.signal })));
      }
      this.oscChart.timeScale().fitContent();
    }
  }

  private destroyCharts(): void {
    if (this.mainChart) {
      this.mainChart.remove();
      this.mainChart = null;
    }
    if (this.oscChart) {
      this.oscChart.remove();
      this.oscChart = null;
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.destroyCharts();
  }
}
