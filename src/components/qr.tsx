"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Renders the QR as a data URI. No canvas dependency at render time, so it
 *  prints correctly and works from the offline cache. */
export function QrBlock({ value, size = 140 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const url = value.startsWith("http") ? value : `${location.origin}${value}`;
    QRCode.toDataURL(url, {
      width: size * 2,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0F181B", light: "#FFFFFF" },
    }).then(setSrc).catch(() => setSrc(null));
  }, [value, size]);

  if (!src) {
    return <div className="skeleton" style={{ width: size, height: size }} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Emergency card QR code"
      width={size}
      height={size}
      className="rounded-[6px] bg-white p-1"
    />
  );
}
