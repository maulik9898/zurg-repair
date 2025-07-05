import * as cheerio from "cheerio";
import type { Torrent } from "../types/torrent";

export function parseTorrentList(html: string): Torrent[] {
  const $ = cheerio.load(html);
  const torrents: Torrent[] = [];

  $("table#torrentTable tbody tr.torrent-row").each((_i, el) => {
    const row = $(el);
    const hash = row.data("hash") as string;
    const name = row.data("name") as string;
    const size = row.find(".torrent-size").text().trim();
    const date = row.find(".torrent-date").text().trim();

    // Status will be determined from the individual torrent detail page

    if (hash && name && size && date) {
      torrents.push({ name, hash, size, date });
    }
  });

  return torrents;
}
