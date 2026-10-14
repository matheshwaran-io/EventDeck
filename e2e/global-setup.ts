import { randomUUID } from "node:crypto";
import { mkdirSync, openSync, writeSync, closeSync, writeFileSync } from "node:fs";
import path from "node:path";
import QRCode from "qrcode";

export const FAKE_CAMERA_DIR = path.resolve("e2e", ".fake-camera");
export const FAKE_CAMERA_VIDEO = path.join(FAKE_CAMERA_DIR, "ticket-qr.y4m");
export const FAKE_CAMERA_TOKEN = path.join(FAKE_CAMERA_DIR, "token.json");

/**
 * Renders a real ticket QR (EVD1:<token>) into a Y4M video that Chromium plays
 * as its webcam (--use-file-for-fake-video-capture), so the camera → html5-qrcode
 * → server validation path is exercised end to end, not just the component.
 */
export default async function globalSetup() {
  mkdirSync(FAKE_CAMERA_DIR, { recursive: true });
  const token = randomUUID().replace(/-/g, "");
  const qr = QRCode.create(`EVD1:${token}`, { errorCorrectionLevel: "M" });
  const W = 640;
  const H = 480;
  const size = qr.modules.size;
  const quiet = 4;
  const px = Math.floor(400 / (size + quiet * 2));
  const total = (size + quiet * 2) * px;
  const ox = Math.floor((W - total) / 2);
  const oy = Math.floor((H - total) / 2);

  const y = Buffer.alloc(W * H, 255);
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (qr.modules.get(r, c))
        for (let dy = 0; dy < px; dy++)
          y.fill(0, (oy + (r + quiet) * px + dy) * W + ox + (c + quiet) * px, (oy + (r + quiet) * px + dy) * W + ox + (c + quiet + 1) * px);
  const chroma = Buffer.alloc((W / 2) * (H / 2) * 2, 128);

  const fd = openSync(FAKE_CAMERA_VIDEO, "w");
  writeSync(fd, `YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`);
  for (let f = 0; f < 10; f++) {
    writeSync(fd, "FRAME\n");
    writeSync(fd, y);
    writeSync(fd, chroma);
  }
  closeSync(fd);
  writeFileSync(FAKE_CAMERA_TOKEN, JSON.stringify({ token }));
}
