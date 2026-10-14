import { expect, it } from "vitest";
import { placeMarginCards } from "./margin-layout";

it("keeps the active card anchored and packs nearby notes without overlapping", () => {
  const cards = [
    { id: "first", desired: 300, height: 40, mini: true },
    { id: "active", desired: 320, height: 250, mini: false },
    { id: "note", desired: 340, height: 60, mini: false },
  ];
  const tops = placeMarginCards(cards, "active");
  expect(tops.active).toBe(320);
  expect(tops.first + cards[0].height + 16).toBeLessThanOrEqual(tops.active);
  expect(tops.note).toBe(586);
  const crowded = placeMarginCards(
    cards.map((card) => ({ ...card, desired: 0 })),
    "active",
  );
  expect(crowded.first).toBe(0);
  expect(crowded.active).toBeGreaterThanOrEqual(cards[0].height + 16);
});
