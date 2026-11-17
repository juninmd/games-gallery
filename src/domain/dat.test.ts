import { describe, expect, it } from "vitest";
import { parseDat } from "./dat";

const DAT = `<?xml version="1.0"?>
<!DOCTYPE datafile SYSTEM "http://www.logiqx.com/Dats/datafile.dtd">
<datafile>
  <header><name>Nintendo - Super Nintendo</name></header>
  <game name="Chrono Trigger (USA)">
    <description>Chrono Trigger (USA)</description>
    <rom name="Chrono Trigger (USA).sfc" size="4194304" crc="2d206bf7" sha1="x"/>
  </game>
  <game name='Tom &amp; Jerry (Europe) &#233;'>
    <rom name="a.sfc" crc='A1B2C3D4' />
  </game>
  <machine name="Disc Game (Track 2)"><rom name="t1.bin" crc="11111111"/><rom name="t2.bin" crc="22222222"/></machine>
  <game name="Broken"><rom name="b.sfc" crc="xyz"/></game>
  <game><rom name="nameless.sfc" crc="33333333"/></game>
</datafile>`;

describe("DAT parsing", () => {
  it("maps each ROM CRC (uppercased) to its game name, unescaping entities", () => {
    const index = parseDat(DAT);
    expect(index.get("2D206BF7")).toBe("Chrono Trigger (USA)");
    expect(index.get("A1B2C3D4")).toBe("Tom & Jerry (Europe) é");
  });
  it("indexes every track of a multi-file game and skips bad CRCs and nameless games", () => {
    const index = parseDat(DAT);
    expect(index.get("11111111")).toBe("Disc Game (Track 2)");
    expect(index.get("22222222")).toBe("Disc Game (Track 2)");
    expect(index.size).toBe(4);
  });
  it("returns an empty index for text that is not a Logiqx DAT", () => {
    expect(parseDat("{\"games\": []}").size).toBe(0);
    expect(parseDat("").size).toBe(0);
  });
});
