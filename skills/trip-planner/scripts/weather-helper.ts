#!/usr/bin/env bun
/**
 * Weather helper for trip planning.
 * Fetches weather forecasts using wttr.in (free, no API key required).
 *
 * Usage:
 *   bun scripts/weather-helper.ts "New York"
 *   bun scripts/weather-helper.ts "Tokyo" --json
 *   bun scripts/weather-helper.ts "London" --start 2026-01-15 --end 2026-01-20
 */

type TempCategory = "freezing" | "cold" | "cool" | "mild" | "warm" | "hot";

interface WttrHourly {
  chanceofrain?: string;
  chanceofsnow?: string;
  weatherDesc?: Array<{ value?: string }>;
}

interface WttrDay {
  date?: string;
  maxtempF?: string;
  mintempF?: string;
  maxtempC?: string;
  mintempC?: string;
  hourly?: WttrHourly[];
}

interface WttrResponse {
  current_condition?: Array<Record<string, unknown>>;
  weather?: WttrDay[];
}

interface ForecastSummary {
  location: string;
  forecast_generated: string;
  temperature: {
    min_f: number;
    max_f: number;
    min_c: number;
    max_c: number;
    category: TempCategory;
  };
  precipitation: {
    rain_chance_max: number;
    snow_chance_max: number;
    bring_umbrella: boolean;
    bring_snow_gear: boolean;
  };
  packing_recommendations: {
    winter_coat: boolean;
    light_jacket: boolean;
    warm_layers: boolean;
    shorts: boolean;
    umbrella: boolean;
    waterproof_shoes: boolean;
    sunscreen: boolean;
    hat_warm: boolean;
    hat_sun: boolean;
    gloves: boolean;
    scarf: boolean;
  };
  daily_forecasts: Array<{
    date: string | null;
    high_f: string | null;
    low_f: string | null;
    high_c: string | null;
    low_c: string | null;
    description: string;
  }>;
  summary: string;
}

async function fetchWeather(location: string): Promise<WttrResponse> {
  const url = `https://wttr.in/${encodeURIComponent(location)}?format=j1`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": "curl/7.64.1" },
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    console.error(`Error fetching weather: ${(err as Error).message}`);
    process.exit(1);
  }
  if (!res.ok) {
    console.error(`Error fetching weather: HTTP ${res.status}`);
    process.exit(1);
  }
  try {
    return (await res.json()) as WttrResponse;
  } catch (err) {
    console.error(`Error parsing weather data: ${(err as Error).message}`);
    process.exit(1);
  }
}

function toInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
}

function describeDay(day: WttrDay): string {
  const hours = day.hourly;
  if (!hours || hours.length === 0) return "Unknown";
  // wttr.in returns 8 hourly slots (every 3 hours); index 4 is noon-ish.
  // Fall back to the middle of whatever we got if the day is short.
  const idx = hours.length > 4 ? 4 : Math.floor(hours.length / 2);
  return hours[idx]?.weatherDesc?.[0]?.value ?? "Unknown";
}

export function getForecastSummary(
  location: string,
  data: WttrResponse,
): ForecastSummary | { error: string } {
  if (!data || !data.weather) {
    return { error: "Could not fetch weather data" };
  }

  const forecasts = data.weather;
  const tempsF: number[] = [];
  const tempsC: number[] = [];
  const rainChances: number[] = [];
  const snowChances: number[] = [];

  for (const day of forecasts) {
    tempsF.push(toInt(day.maxtempF, 70));
    tempsF.push(toInt(day.mintempF, 50));
    tempsC.push(toInt(day.maxtempC, 20));
    tempsC.push(toInt(day.mintempC, 10));

    for (const hour of day.hourly ?? []) {
      rainChances.push(toInt(hour.chanceofrain, 0));
      snowChances.push(toInt(hour.chanceofsnow, 0));
    }
  }

  const minTempF = tempsF.length ? Math.min(...tempsF) : 50;
  const maxTempF = tempsF.length ? Math.max(...tempsF) : 70;
  const minTempC = tempsC.length ? Math.min(...tempsC) : 10;
  const maxTempC = tempsC.length ? Math.max(...tempsC) : 20;
  const maxRain = rainChances.length ? Math.max(...rainChances) : 0;
  const maxSnow = snowChances.length ? Math.max(...snowChances) : 0;

  const tempCategory: TempCategory =
    minTempF <= 32
      ? "freezing"
      : minTempF <= 45
        ? "cold"
        : minTempF <= 60
          ? "cool"
          : maxTempF <= 75
            ? "mild"
            : maxTempF <= 85
              ? "warm"
              : "hot";

  const isCold = tempCategory === "freezing" || tempCategory === "cold";
  const isCool = tempCategory === "cool";
  const isMild = tempCategory === "mild";
  const isWarm = tempCategory === "warm" || tempCategory === "hot";

  const summaryBits = [
    `${tempCategory[0].toUpperCase()}${tempCategory.slice(1)} weather expected.`,
    `Temps: ${minTempF}°F - ${maxTempF}°F (${minTempC}°C - ${maxTempC}°C).`,
  ];
  if (maxRain > 30) summaryBits.push(`Rain likely (${maxRain}% chance).`);
  if (maxSnow > 30) summaryBits.push(`Snow possible (${maxSnow}% chance).`);

  return {
    location,
    forecast_generated: new Date().toISOString(),
    temperature: {
      min_f: minTempF,
      max_f: maxTempF,
      min_c: minTempC,
      max_c: maxTempC,
      category: tempCategory,
    },
    precipitation: {
      rain_chance_max: maxRain,
      snow_chance_max: maxSnow,
      bring_umbrella: maxRain > 30,
      bring_snow_gear: maxSnow > 30 || minTempF <= 32,
    },
    packing_recommendations: {
      winter_coat: isCold,
      light_jacket: isCool || isMild,
      warm_layers: isCold || isCool,
      shorts: isWarm,
      umbrella: maxRain > 30,
      waterproof_shoes: maxRain > 50 || maxSnow > 30,
      sunscreen: isWarm || isMild,
      hat_warm: isCold,
      hat_sun: isWarm,
      gloves: isCold,
      scarf: isCold,
    },
    daily_forecasts: forecasts.slice(0, Math.min(7, forecasts.length)).map((day) => ({
      date: day.date ?? null,
      high_f: day.maxtempF ?? null,
      low_f: day.mintempF ?? null,
      high_c: day.maxtempC ?? null,
      low_c: day.mintempC ?? null,
      description: describeDay(day),
    })),
    summary: summaryBits.join(" ") + " ",
  };
}

interface CliArgs {
  location: string;
  start?: string;
  end?: string;
  json: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { location: "", json: false };
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") {
      args.json = true;
    } else if (a === "--start") {
      args.start = argv[++i];
    } else if (a === "--end") {
      args.end = argv[++i];
    } else if (a === "-h" || a === "--help") {
      printHelp();
      process.exit(0);
    } else {
      positional.push(a);
    }
  }
  if (positional.length === 0) {
    printHelp();
    process.exit(2);
  }
  args.location = positional.join(" ");
  return args;
}

function printHelp(): void {
  console.log(
    `Usage: bun weather-helper.ts <location> [--start YYYY-MM-DD] [--end YYYY-MM-DD] [--json]\n` +
      `\n` +
      `  <location>   Destination city (quote multi-word names)\n` +
      `  --start      Trip start date (informational; wttr.in always returns the next 3 days)\n` +
      `  --end        Trip end date (informational)\n` +
      `  --json       Emit machine-readable JSON instead of the human summary\n`,
  );
}

function printHuman(forecast: ForecastSummary): void {
  console.log(`\n🌤️  Weather Forecast for ${forecast.location}`);
  console.log("=".repeat(50));
  console.log(`\n${forecast.summary}`);
  console.log(
    `\nTemperature Range: ${forecast.temperature.min_f}°F - ${forecast.temperature.max_f}°F`,
  );
  console.log(
    `                   (${forecast.temperature.min_c}°C - ${forecast.temperature.max_c}°C)`,
  );

  console.log("\n📅 Daily Forecast:");
  for (const day of forecast.daily_forecasts) {
    console.log(`  ${day.date}: ${day.low_f}°F - ${day.high_f}°F | ${day.description}`);
  }

  console.log("\n🎒 Packing Recommendations:");
  const recs = forecast.packing_recommendations;
  const labels: Array<[keyof typeof recs, string]> = [
    ["winter_coat", "Winter coat / heavy jacket"],
    ["light_jacket", "Light jacket"],
    ["warm_layers", "Warm layers (sweaters, long sleeves)"],
    ["shorts", "Shorts / light clothing"],
    ["umbrella", "Umbrella / rain gear"],
    ["waterproof_shoes", "Waterproof shoes"],
    ["gloves", "Gloves"],
    ["scarf", "Scarf"],
    ["hat_warm", "Warm hat / beanie"],
    ["hat_sun", "Sun hat / cap"],
    ["sunscreen", "Sunscreen"],
  ];
  for (const [key, label] of labels) {
    if (recs[key]) console.log(`  ✓ ${label}`);
  }
  console.log();
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const data = await fetchWeather(args.location);
  const result = getForecastSummary(args.location, data);

  if ("error" in result) {
    console.error(result.error);
    process.exit(1);
  }

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printHuman(result);
  }
}

if (import.meta.main) {
  await main();
}
