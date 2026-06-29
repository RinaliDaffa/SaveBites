/**
 * SaveBites V3 — QR Code SVG (Server Component)
 *
 * Renders an SVG QR code generated server-side from a payload string.
 * Uses the `qrcode` npm package which produces a pure SVG string (no canvas).
 *
 * This is a Server Component because `qrcode` relies on Buffer/Canvas. It's
 * also zero-JS — the consumer's order detail page ships the QR image directly
 * inside the initial HTML.
 *
 * The payload is the 6-char `pickup_code` from `generate_pickup_code()` SQL
 * function (chars: ABCDEFGHJKLMNPQRSTUVWXYZ23456789). At ~6 chars the QR is
 * tiny, highly scannable, and encodes only what the merchant has an index for.
 *
 * SECURITY NOTE: `qrcode` produces a controlled SVG with only `<path>` and
 * `<rect>` elements from a fixed alphanumeric alphabet — no `<script>`, no
 * event attributes. The `__html` assignment is therefore safe.
 */

import QRCode from 'qrcode';
import { QrCode as QrIcon } from 'lucide-react';

interface QrCodeSvgProps {
  payload: string;
  size?: number;
  caption?: string;
  ariaLabel?: string;
}

export async function QrCodeSvg({
  payload,
  size = 220,
  caption,
  ariaLabel = 'Pickup QR code',
}: QrCodeSvgProps) {
  if (!payload) {
    return (
      <div className="flex flex-col items-center gap-2 text-white/90">
        <div className="rounded-2xl bg-white/10 p-6">
          <QrIcon className="w-32 h-32 opacity-50" />
        </div>
        {caption && <p className="text-xs">{caption}</p>}
      </div>
    );
  }

  // Generate SVG string server-side. The 'svg' renderer emits a pure SVG
  // element string — no canvas, no DOM, no client JS needed.
  const svg = await QRCode.toString(payload, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 1,
    width: size,
    color: {
      // QR on a white container: dark modules, light background.
      dark: '#047857',
      light: '#ffffff',
    },
  });

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="rounded-2xl bg-white p-3 shadow-inner"
        role="img"
        aria-label={ariaLabel}
        // Safe: pickup_code is a 6-char uppercase alphanumeric from generate_pickup_code()
        // which emits only <path>/<rect> SVG elements — no <script>, no event attrs.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      {caption && <p className="text-xs text-white/80">{caption}</p>}
    </div>
  );
}
