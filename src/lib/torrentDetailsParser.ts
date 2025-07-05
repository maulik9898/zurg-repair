import * as cheerio from "cheerio";
import type { Torrent, TorrentFile } from "../types/torrent";

export function parseTorrentFiles(html: string): TorrentFile[] {
  const $ = cheerio.load(html);
  const files: TorrentFile[] = [];

  // Look for file rows in the Files section
  let foundFilesSection = false;

  $("table tbody tr").each((_i, el) => {
    const row = $(el);

    // Check if this is the Files section header
    const headerText = row.find("th").text().trim();
    if (headerText === "Files") {
      foundFilesSection = true;
      return; // Skip the header row
    }

    // If we haven't found the Files section yet, skip this row
    if (!foundFilesSection) {
      return;
    }

    // Stop if we hit another section header (th elements)
    if (row.find("th").length > 0) {
      return false; // Break out of the loop
    }

    // Parse file rows - each file row has exactly 2 td elements
    const tds = row.find("td");
    if (tds.length === 2) {
      const fileName = $(tds[0]).text().trim();
      const rightCell = $(tds[1]);

      // Extract size from memory-stat span
      const sizeText = rightCell.find("span.memory-stat").text().trim();

      // Extract status from badge span
      const statusText = rightCell.find("span.badge").text().trim();

      // Extract file ID from any form action
      let fileId = "";

      // Look through all forms in the right cell to find one with a file ID
      rightCell.find("form").each((_formIndex, formEl) => {
        const formAction = $(formEl).attr("action") || "";

        // Match patterns like /files/{id}/delete, /files/{id}/restore, /files/{id}/toggle-force-show
        const match = formAction.match(/\/files\/(\d+)\//);
        if (match && match[1]) {
          fileId = match[1];
          return false; // Break out of the each loop
        }
      });

      // Only add if we have all required fields
      if (fileName && sizeText && statusText && fileId) {
        files.push({
          name: fileName,
          size: sizeText,
          status: statusText,
          id: fileId,
        });
      }
    }
  });

  return files;
}
