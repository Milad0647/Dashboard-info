import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const EXPORT_WIDTH_PX = 1280;
const PAGE_MARGIN_MM = 8;

async function waitForImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })
    )
  );
}

function addCanvasToPdf(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  isFirstPage: boolean
) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - PAGE_MARGIN_MM * 2;
  const contentHeight = pageHeight - PAGE_MARGIN_MM * 2;

  const imgWidth = contentWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  const imgData = canvas.toDataURL("image/jpeg", 0.92);

  if (imgHeight <= contentHeight) {
    if (!isFirstPage) pdf.addPage();
    pdf.addImage(imgData, "JPEG", PAGE_MARGIN_MM, PAGE_MARGIN_MM, imgWidth, imgHeight);
    return;
  }

  let offsetY = 0;
  let pageIndex = 0;

  while (offsetY < imgHeight) {
    if (!isFirstPage || pageIndex > 0) pdf.addPage();
    pdf.addImage(
      imgData,
      "JPEG",
      PAGE_MARGIN_MM,
      PAGE_MARGIN_MM - offsetY,
      imgWidth,
      imgHeight
    );
    offsetY += contentHeight;
    pageIndex += 1;
  }
}

export async function exportCampaignScreenshotPdf(options: {
  rootSelector?: string;
  filename: string;
  onProgress?: (current: number, total: number, label: string) => void;
}) {
  const root = document.querySelector(options.rootSelector ?? "[data-campaign-export-root]") as HTMLElement | null;
  if (!root) {
    throw new Error("Campaign export root not found");
  }

  const sections = Array.from(root.querySelectorAll<HTMLElement>("[data-export-section]"));
  if (sections.length === 0) {
    throw new Error("No export sections found");
  }

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let isFirstPage = true;

  for (let index = 0; index < sections.length; index += 1) {
    const section = sections[index];
    const label = section.getAttribute("data-export-label") ?? `بخش ${index + 1}`;
    options.onProgress?.(index + 1, sections.length, label);

    section.scrollIntoView({ block: "start" });
    await waitForImages(section);
    await new Promise((resolve) => setTimeout(resolve, 300));

    const canvas = await html2canvas(section, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      width: EXPORT_WIDTH_PX,
      windowWidth: EXPORT_WIDTH_PX,
    });

    addCanvasToPdf(pdf, canvas, isFirstPage);
    isFirstPage = false;
  }

  pdf.save(options.filename);
}
