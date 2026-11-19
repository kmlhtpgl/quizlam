"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QRCodeImage({ value, size = 180 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: { dark: "#101B36", light: "#FFF8E7" },
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [value, size]);

  if (!dataUrl) return <div className="animate-pulse rounded-2xl bg-cream/10" style={{ width: size, height: size }} />;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={dataUrl} alt="Quizlam room QR code" width={size} height={size} className="rounded-2xl bg-cream p-2" />
  );
}
