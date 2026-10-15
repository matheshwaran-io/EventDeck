// Renders every *.svg in this folder to ../diagrams/*.png at 1.5x using the project's Playwright Chromium.
const path = require("path"), fs = require("fs");
const ROOT = path.resolve(__dirname, "../../../..");
const { chromium } = require("module").createRequire(path.join(ROOT, "package.json"))("@playwright/test");
(async () => {
  const b = await chromium.launch();
  for (const f of fs.readdirSync(__dirname).filter((f) => f.endsWith(".svg"))) {
    const svg = fs.readFileSync(path.join(__dirname, f), "utf8");
    const [, w, h] = svg.match(/width="(\d+)" height="(\d+)"/);
    const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1.5 });
    await p.setContent(`<html><body style="margin:0">${svg}</body></html>`);
    await p.screenshot({ path: path.join(__dirname, "../diagrams", f.replace(".svg", ".png")) });
    await p.close();
    console.log("rendered", f);
  }
  await b.close();
})();
