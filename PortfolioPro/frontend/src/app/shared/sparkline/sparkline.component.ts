import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-sparkline',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="width()"
      [attr.height]="height()"
      [attr.viewBox]="'0 0 ' + width() + ' ' + height()"
      fill="none"
      aria-hidden="true"
    >
      @if (pointsPath()) {
        <polyline
          [attr.points]="pointsPath()"
          [attr.stroke]="strokeColor()"
          stroke-width="1.75"
          stroke-linecap="round"
          stroke-linejoin="round"
          fill="none"
        />
      }
    </svg>
  `,
})
export class SparklineComponent {
  readonly data = input<number[]>([]);
  readonly positive = input<boolean>(true);
  readonly width = input<number>(88);
  readonly height = input<number>(28);

  readonly strokeColor = computed(() =>
    this.positive() ? 'var(--color-gain)' : 'var(--color-loss)'
  );

  readonly pointsPath = computed(() => {
    const pts = this.data();
    if (!pts || pts.length < 2) return '';
    const min = Math.min(...pts);
    const max = Math.max(...pts);
    const span = max - min || 1;
    const w = this.width();
    const h = this.height();
    const pad = 3;
    return pts
      .map((val, idx) => {
        const x = (idx / (pts.length - 1)) * (w - pad * 2) + pad;
        const y = h - pad - ((val - min) / span) * (h - pad * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  });
}
