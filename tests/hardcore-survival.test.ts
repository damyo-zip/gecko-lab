import { describe, expect, test } from "vitest";
import { createNewGame } from "@/game/play";
import { makeSave } from "@/game/save";
import { migrateV2 } from "@/game/hardcore/create";
import { feed, feedAll, loseHearts } from "@/game/hardcore/survival";
import { addDays, dateNumber, seoulDate } from "@/game/hardcore/time";
import { catchUp } from "@/game/hardcore/calendar";
import { exportBackup, parseBackup } from "@/game/hardcore/save";

const start = () => migrateV2(makeSave(createNewGame("survival")), "2026-10-13");
describe("Korean calendar and care", () => {
  test("KST midnight is independent of host timezone, including leap days", () => {
    expect(seoulDate(Date.parse("2026-10-13T14:59:59Z"))).toBe("2026-10-13");
    expect(seoulDate(Date.parse("2026-10-13T15:00:00Z"))).toBe("2026-10-14");
    expect(addDays("2024-02-28", 2)).toBe("2024-03-01");
    expect(() => dateNumber("2025-02-29")).toThrow();
  });
  test("five missed midnights kill permanently without deleting ancestors", () => {
    const g = start(), id = Object.keys(g.individuals)[0];
    for (let day = 0; day < 5; day++) { g.lastDate = addDays(g.lastDate, 1); loseHearts(g); }
    expect(g.individuals[id]).toMatchObject({ hearts: 0, status: "dead", diedDate: "2026-10-18" });
    expect(() => feed(g, id)).toThrow();
    expect(Object.keys(g.individuals)).toHaveLength(6);
  });
  test("daily manual care sustains life and cannot be repeated or applied at full hearts", () => {
    const g = start(), id = Object.keys(g.individuals)[0]; g.food = 20;
    expect(() => feed(g, id)).toThrow();
    for (let day = 0; day < 10; day++) {
      g.lastDate = addDays(g.lastDate, 1); loseHearts(g); feed(g, id);
      expect(g.individuals[id].hearts).toBe(5);
      expect(() => feed(g, id)).toThrow();
    }
    expect(g.individuals[id].status).toBe("owned");
  });
  test("bulk feed respects inventory, daily eligibility and dead/sold records", () => {
    const g = start(); g.lastDate = addDays(g.lastDate, 1); loseHearts(g); g.food = 1;
    feedAll(g);
    expect(Object.values(g.individuals).filter(i => i.hearts === 5)).toHaveLength(1);
    expect(g.food).toBe(0); expect(() => feedAll(g)).toThrow("재고");
  });
  test("migration preserves old IDs, genes, seeds, parents and capacity", () => {
    const old = createNewGame("survival"), g = migrateV2(makeSave(old), "2026-10-13");
    for (const individual of Object.values(old.individuals)) {
      expect(g.individuals[individual.id]).toMatchObject(individual);
      expect(g.individuals[individual.id].hearts).toBe(5);
    }
    expect(g.capacity).toBeGreaterThanOrEqual(6);
    expect(g.rules.adultAfter).toBe(old.rules.adultAfter);
  });
  test("offline catch-up is identical to five sequential days and idempotent", () => {
    const initial = start(), offline = catchUp(initial, "2026-10-18");
    let sequential = initial;
    for (let day = 1; day <= 5; day++) sequential = catchUp(sequential, addDays(initial.lastDate, day));
    expect(offline.individuals).toEqual(sequential.individuals);
    expect(offline.turn).toBe(5);
    expect(catchUp(offline, offline.lastDate)).toBe(offline);
    expect(catchUp(offline, "2026-10-12")).toBe(offline);
    expect(initial.individuals[Object.keys(initial.individuals)[0]].hearts).toBe(5);
  });
  test("v3 backup round trip and checksum/version rejection", () => {
    const game = start(), input = exportBackup(game);
    expect(parseBackup(input, game.lastDate)).toEqual(game);
    const corrupt = JSON.parse(input); corrupt.game.money++;
    expect(() => parseBackup(JSON.stringify(corrupt), game.lastDate)).toThrow("무결성");
    corrupt.version = 999; expect(() => parseBackup(JSON.stringify(corrupt), game.lastDate)).toThrow("버전");
  });
});
