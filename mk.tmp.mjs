import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await (await b.newContext()).newPage();
await p.goto("file:///root/script.html", { waitUntil: "networkidle" });
await p.emulateMedia({ media: "print" });
await p.pdf({
  path: "/root/Nidan-Presentation-Script.pdf",
  format: "A4",
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: "<div></div>",
  footerTemplate: `<div style="width:100%;font-family:Helvetica,Arial,sans-serif;font-size:7.5pt;color:#7d8c8e;padding:0 15mm;display:flex;justify-content:space-between;">
      <span>Nidan &middot; Team CODEKRUX &middot; presentation script</span>
      <span class="pageNumber"></span>
    </div>`,
  margin: { top: "16mm", bottom: "18mm", left: "15mm", right: "15mm" },
});
await b.close();
console.log("done");
