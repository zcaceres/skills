#!/usr/bin/env python3
"""
Weather helper for trip planning.
Fetches weather forecasts using wttr.in (free, no API key required).
"""

import argparse
import json
import sys
import urllib.request
import urllib.error
from datetime import datetime, timedelta


def fetch_weather(location: str, days: int = 3) -> dict:
    """
    Fetch weather forecast for a location.

    Args:
        location: City name or location (e.g., "New York", "London", "Tokyo")
        days: Number of days to forecast (max 3 for wttr.in free tier)

    Returns:
        Dictionary with weather data
    """
    # wttr.in JSON format
    # Format codes: https://github.com/chubin/wttr.in
    encoded_location = urllib.parse.quote(location)
    url = f"https://wttr.in/{encoded_location}?format=j1"

    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'curl/7.64.1'})
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode('utf-8'))
            return data
    except urllib.error.URLError as e:
        print(f"Error fetching weather: {e}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error parsing weather data: {e}", file=sys.stderr)
        sys.exit(1)


def get_forecast_summary(location: str, start_date: str = None, end_date: str = None) -> dict:
    """
    Get a summarized forecast for trip planning.

    Args:
        location: Destination city
        start_date: Trip start date (YYYY-MM-DD), defaults to today
        end_date: Trip end date (YYYY-MM-DD), defaults to start_date + 3 days

    Returns:
        Dictionary with summary suitable for packing decisions
    """
    data = fetch_weather(location)

    if not data or 'weather' not in data:
        return {"error": "Could not fetch weather data"}

    # Parse dates
    if start_date:
        start = datetime.strptime(start_date, "%Y-%m-%d")
    else:
        start = datetime.now()

    if end_date:
        end = datetime.strptime(end_date, "%Y-%m-%d")
    else:
        end = start + timedelta(days=3)

    # Current conditions
    current = data.get('current_condition', [{}])[0]

    # Analyze forecast days
    forecasts = data.get('weather', [])

    temps_f = []
    temps_c = []
    conditions = []
    rain_chances = []
    snow_chances = []

    for day in forecasts:
        temps_f.append(int(day.get('maxtempF', 70)))
        temps_f.append(int(day.get('mintempF', 50)))
        temps_c.append(int(day.get('maxtempC', 20)))
        temps_c.append(int(day.get('mintempC', 10)))

        # Check hourly for rain/snow
        for hour in day.get('hourly', []):
            rain_chances.append(int(hour.get('chanceofrain', 0)))
            snow_chances.append(int(hour.get('chanceofsnow', 0)))
            conditions.append(hour.get('weatherDesc', [{}])[0].get('value', ''))

    # Determine packing recommendations
    min_temp_f = min(temps_f) if temps_f else 50
    max_temp_f = max(temps_f) if temps_f else 70
    min_temp_c = min(temps_c) if temps_c else 10
    max_temp_c = max(temps_c) if temps_c else 20
    max_rain = max(rain_chances) if rain_chances else 0
    max_snow = max(snow_chances) if snow_chances else 0

    # Weather category for packing
    if min_temp_f <= 32:
        temp_category = "freezing"
    elif min_temp_f <= 45:
        temp_category = "cold"
    elif min_temp_f <= 60:
        temp_category = "cool"
    elif max_temp_f <= 75:
        temp_category = "mild"
    elif max_temp_f <= 85:
        temp_category = "warm"
    else:
        temp_category = "hot"

    return {
        "location": location,
        "forecast_generated": datetime.now().isoformat(),
        "temperature": {
            "min_f": min_temp_f,
            "max_f": max_temp_f,
            "min_c": min_temp_c,
            "max_c": max_temp_c,
            "category": temp_category
        },
        "precipitation": {
            "rain_chance_max": max_rain,
            "snow_chance_max": max_snow,
            "bring_umbrella": max_rain > 30,
            "bring_snow_gear": max_snow > 30 or min_temp_f <= 32
        },
        "packing_recommendations": {
            "winter_coat": temp_category in ["freezing", "cold"],
            "light_jacket": temp_category in ["cool", "mild"],
            "warm_layers": temp_category in ["freezing", "cold", "cool"],
            "shorts": temp_category in ["warm", "hot"],
            "umbrella": max_rain > 30,
            "waterproof_shoes": max_rain > 50 or max_snow > 30,
            "sunscreen": temp_category in ["warm", "hot", "mild"],
            "hat_warm": temp_category in ["freezing", "cold"],
            "hat_sun": temp_category in ["warm", "hot"],
            "gloves": temp_category in ["freezing", "cold"],
            "scarf": temp_category in ["freezing", "cold"]
        },
        "daily_forecasts": [
            {
                "date": day.get('date'),
                "high_f": day.get('maxtempF'),
                "low_f": day.get('mintempF'),
                "high_c": day.get('maxtempC'),
                "low_c": day.get('mintempC'),
                "description": day.get('hourly', [{}])[4].get('weatherDesc', [{}])[0].get('value', 'Unknown') if day.get('hourly') else 'Unknown'
            }
            for day in forecasts[:min(7, len(forecasts))]
        ],
        "summary": f"{temp_category.title()} weather expected. Temps: {min_temp_f}°F - {max_temp_f}°F ({min_temp_c}°C - {max_temp_c}°C). " +
                   (f"Rain likely ({max_rain}% chance). " if max_rain > 30 else "") +
                   (f"Snow possible ({max_snow}% chance). " if max_snow > 30 else "")
    }


def main():
    parser = argparse.ArgumentParser(description='Fetch weather forecast for trip planning')
    parser.add_argument('location', help='Destination city (e.g., "New York", "London")')
    parser.add_argument('--start', help='Trip start date (YYYY-MM-DD)')
    parser.add_argument('--end', help='Trip end date (YYYY-MM-DD)')
    parser.add_argument('--json', action='store_true', help='Output as JSON')

    args = parser.parse_args()

    forecast = get_forecast_summary(args.location, args.start, args.end)

    if args.json:
        print(json.dumps(forecast, indent=2))
    else:
        # Human-readable output
        print(f"\n🌤️  Weather Forecast for {forecast['location']}")
        print("=" * 50)
        print(f"\n{forecast['summary']}")
        print(f"\nTemperature Range: {forecast['temperature']['min_f']}°F - {forecast['temperature']['max_f']}°F")
        print(f"                   ({forecast['temperature']['min_c']}°C - {forecast['temperature']['max_c']}°C)")

        print("\n📅 Daily Forecast:")
        for day in forecast['daily_forecasts']:
            print(f"  {day['date']}: {day['low_f']}°F - {day['high_f']}°F | {day['description']}")

        print("\n🎒 Packing Recommendations:")
        recs = forecast['packing_recommendations']
        if recs['winter_coat']:
            print("  ✓ Winter coat / heavy jacket")
        if recs['light_jacket']:
            print("  ✓ Light jacket")
        if recs['warm_layers']:
            print("  ✓ Warm layers (sweaters, long sleeves)")
        if recs['shorts']:
            print("  ✓ Shorts / light clothing")
        if recs['umbrella']:
            print("  ✓ Umbrella / rain gear")
        if recs['waterproof_shoes']:
            print("  ✓ Waterproof shoes")
        if recs['gloves']:
            print("  ✓ Gloves")
        if recs['scarf']:
            print("  ✓ Scarf")
        if recs['hat_warm']:
            print("  ✓ Warm hat / beanie")
        if recs['hat_sun']:
            print("  ✓ Sun hat / cap")
        if recs['sunscreen']:
            print("  ✓ Sunscreen")
        print()


if __name__ == '__main__':
    import urllib.parse
    main()
