import { describe, test, expect } from "bun:test";
import { getForecastSummary } from "../scripts/weather-helper.ts";

const makeDay = (overrides: Record<string, unknown> = {}) => ({
  date: "2026-06-15",
  maxtempF: "70",
  mintempF: "55",
  maxtempC: "21",
  mintempC: "13",
  hourly: Array.from({ length: 8 }, (_, i) => ({
    chanceofrain: "10",
    chanceofsnow: "0",
    weatherDesc: [{ value: `slot-${i}` }],
  })),
  ...overrides,
});

describe("getForecastSummary", () => {
  test("returns error when weather array is missing", () => {
    const out = getForecastSummary("Nowhere", {});
    expect(out).toEqual({ error: "Could not fetch weather data" });
  });

  test("categorizes a cold rainy day correctly", () => {
    const out = getForecastSummary("Reykjavik", {
      weather: [
        makeDay({
          mintempF: "30",
          maxtempF: "40",
          hourly: [
            {
              chanceofrain: "60",
              chanceofsnow: "0",
              weatherDesc: [{ value: "Rain" }],
            },
          ],
        }),
      ],
    });
    if ("error" in out) throw new Error("expected forecast, got error");
    expect(out.temperature.category).toBe("freezing");
    expect(out.precipitation.bring_umbrella).toBe(true);
    expect(out.packing_recommendations.winter_coat).toBe(true);
    expect(out.packing_recommendations.shorts).toBe(false);
  });

  test("categorizes a hot dry day correctly", () => {
    const out = getForecastSummary("Phoenix", {
      weather: [makeDay({ mintempF: "78", maxtempF: "100" })],
    });
    if ("error" in out) throw new Error("expected forecast, got error");
    expect(out.temperature.category).toBe("hot");
    expect(out.packing_recommendations.shorts).toBe(true);
    expect(out.packing_recommendations.sunscreen).toBe(true);
    expect(out.packing_recommendations.winter_coat).toBe(false);
  });

  test("describeDay does not crash when hourly has fewer than 5 entries", () => {
    // Regression: the original Python helper indexed hourly[4] unconditionally
    // and would IndexError on short days.
    const out = getForecastSummary("Atlantis", {
      weather: [
        makeDay({
          hourly: [
            {
              chanceofrain: "0",
              chanceofsnow: "0",
              weatherDesc: [{ value: "Sunny" }],
            },
          ],
        }),
      ],
    });
    if ("error" in out) throw new Error("expected forecast, got error");
    expect(out.daily_forecasts[0].description).toBe("Sunny");
  });

  test("describeDay falls back to Unknown when hourly is empty", () => {
    const out = getForecastSummary("Limbo", {
      weather: [makeDay({ hourly: [] })],
    });
    if ("error" in out) throw new Error("expected forecast, got error");
    expect(out.daily_forecasts[0].description).toBe("Unknown");
  });

  test("clamps daily_forecasts to at most 7 entries", () => {
    const out = getForecastSummary("Anywhere", {
      weather: Array.from({ length: 10 }, () => makeDay()),
    });
    if ("error" in out) throw new Error("expected forecast, got error");
    expect(out.daily_forecasts.length).toBe(7);
  });
});
