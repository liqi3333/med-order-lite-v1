import { renderHomePage } from "./pages/home-page.js";
import { renderDrugDetailPage, renderDrugLibraryPage } from "./pages/drug-pages.js";
import { renderImportPage } from "./pages/import-page.js";
import { renderOrderPage } from "./pages/order-page.js";
import { renderError } from "./components/shell.js";

function parts(): string[] {
  const hash = window.location.hash || "#/";
  const path = hash.split("?")[0].replace(/^#\/?/, "");
  return path.split("/").filter(Boolean).map(decodeURIComponent);
}

export async function route(): Promise<void> {
  const p = parts();
  try {
    if (p.length === 0) return renderHomePage();
    if (p[0] === "drugs" && !p[1]) return renderDrugLibraryPage();
    if (p[0] === "drugs" && p[1]) return renderDrugDetailPage(p[1]);
    if (p[0] === "orders") return renderOrderPage();
    if (p[0] === "import") return renderImportPage();
    renderError("未找到页面。", "404");
  } catch (error) {
    renderError(error instanceof Error ? error.message : String(error));
  }
}
