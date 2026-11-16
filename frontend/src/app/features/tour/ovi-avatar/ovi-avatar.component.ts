import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { OviMood } from '../types/tour.types';

/**
 * Ovi, la pelota guía: SVG propio con colores del tablero (verde botella en los dos temas);
 * el lima de las mejillas va sobre verde botella, como pide el design system.
 */
@Component({
  selector: 'app-ovi-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.ovi--sm]': "size() === 'sm'",
    '[attr.data-mood]': 'mood()'
  },
  template: `
    <svg class="ovi" viewBox="0 0 120 120" role="img" aria-label="Ovi, la pelota guía">
      <!-- Sombra en el piso -->
      <ellipse class="ovi-shadow" cx="60" cy="112" rx="30" ry="5" />
      <g class="ovi-body">
        <!-- Pelota ovalada, inclinada -->
        <g transform="rotate(-18 60 58)">
          <ellipse class="ovi-ball" cx="60" cy="58" rx="40" ry="31" />
          <ellipse class="ovi-shine" cx="44" cy="40" rx="14" ry="6" />
          <!-- Costuras de punta a punta -->
          <path class="ovi-seam" d="M22 58 Q60 44 98 58" />
          <!-- Cordones -->
          <path class="ovi-lace" d="M50 46 v6 M57 44.5 v6 M64 44.5 v6 M71 46 v6" />
        </g>
        <!-- Ojos -->
        <g class="ovi-eyes">
          <ellipse class="ovi-eye" cx="47" cy="66" rx="6.5" ry="7.5" />
          <circle class="ovi-pupil" cx="48.5" cy="67" r="3.4" />
          @if (mood() === 'wink') {
            <path class="ovi-wink" d="M65 67 q7 -6 14 0" />
          } @else {
            <ellipse class="ovi-eye" cx="72" cy="61" rx="6.5" ry="7.5" />
            <circle class="ovi-pupil" cx="73.5" cy="62" r="3.4" />
          }
        </g>
        <!-- Mejillas lima -->
        <ellipse class="ovi-cheek" cx="40" cy="78" rx="5" ry="3" />
        <ellipse class="ovi-cheek" cx="83" cy="71" rx="5" ry="3" />
        <!-- Boca -->
        @if (mood() === 'talking') {
          <ellipse class="ovi-mouth ovi-mouth--talk" cx="63" cy="80" rx="6" ry="4.5" />
        } @else {
          <path class="ovi-mouth" d="M53 80 q9 8 19 -3" />
        }
        <!-- Silbato colgando -->
        <path class="ovi-cord" d="M30 74 Q34 92 50 96" />
        <g class="ovi-whistle">
          <rect x="48" y="91" width="15" height="9" rx="4.5" />
          <circle cx="52" cy="95.5" r="1.8" class="ovi-whistle-hole" />
        </g>
      </g>
    </svg>
  `,
  styles: [`
    :host {
      display: inline-block;
      width: 112px;
      height: 112px;
      flex: 0 0 auto;
    }

    :host(.ovi--sm) {
      width: 64px;
      height: 64px;
    }

    .ovi {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }

    .ovi-shadow { fill: var(--border); }
    .ovi-ball { fill: var(--board-bg-start); stroke: var(--grass); stroke-width: 3; }
    .ovi-shine { fill: var(--on-board); opacity: 0.18; }
    .ovi-seam { fill: none; stroke: var(--on-board); stroke-width: 2.5; stroke-linecap: round; opacity: 0.85; }
    .ovi-lace { stroke: var(--on-board); stroke-width: 2.5; stroke-linecap: round; }
    .ovi-eye { fill: var(--on-board); }
    .ovi-pupil { fill: var(--board-bg-end); }
    .ovi-wink { fill: none; stroke: var(--on-board); stroke-width: 3; stroke-linecap: round; }
    .ovi-cheek { fill: var(--brand-signature); opacity: 0.85; }
    .ovi-mouth { fill: none; stroke: var(--on-board); stroke-width: 3; stroke-linecap: round; }
    .ovi-mouth--talk { fill: var(--board-bg-end); stroke-width: 2.5; transform-origin: 63px 80px; }
    .ovi-cord { fill: none; stroke: var(--border-strong); stroke-width: 1.8; }
    .ovi-whistle rect { fill: var(--border-strong); }
    .ovi-whistle-hole { fill: var(--board-bg-end); }

    .ovi-body { transform-origin: 60px 100px; animation: ovi-bob 2.4s ease-in-out infinite; }
    :host([data-mood='talking']) .ovi-mouth--talk { animation: ovi-talk 0.42s ease-in-out infinite alternate; }

    @keyframes ovi-bob {
      0%, 100% { transform: translateY(0) rotate(0deg); }
      50% { transform: translateY(-3px) rotate(2deg); }
    }

    @keyframes ovi-talk {
      from { transform: scaleY(0.45); }
      to { transform: scaleY(1); }
    }

    @media (prefers-reduced-motion: reduce) {
      .ovi-body,
      :host([data-mood='talking']) .ovi-mouth--talk { animation: none; }
    }
  `]
})
export class OviAvatarComponent {
  readonly mood = input<OviMood>('happy');
  readonly size = input<'sm' | 'md'>('md');
}
