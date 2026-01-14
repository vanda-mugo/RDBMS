import { Index } from "../src/core/index";

describe("Debug rangeSearch", () => {
  test("rangeSearch with undefined max (>=)", () => {
    const idx = new Index("test", "val");
    idx.createIndex([{ val: 10 }, { val: 25 }, { val: 50 }]);

    console.log("Testing rangeSearch(25, undefined) for >=");
    const results = idx.rangeSearch(25, undefined);
    console.log("Results:", results);

    expect(results).toHaveLength(2);
    expect(results.map((r) => r.val).sort()).toEqual([25, 50]);
  });

  test("rangeSearch with undefined min (<=)", () => {
    const idx = new Index("test", "val");
    idx.createIndex([{ val: 10 }, { val: 25 }, { val: 50 }]);

    console.log("Testing rangeSearch(undefined, 25) for <=");
    const results = idx.rangeSearch(undefined, 25);
    console.log("Results:", results);

    expect(results).toHaveLength(2);
    expect(results.map((r) => r.val).sort()).toEqual([10, 25]);
  });
});
