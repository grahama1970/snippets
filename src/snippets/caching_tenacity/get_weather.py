"""
This script demonstrates how to fetch a 7-day weather forecast using the OpenWeatherMap API.
It uses caching with aiocache to store and retrieve forecast data, and tenacity to handle retries.
The forecast is cached for 10 minutes (600 seconds).
This is a great design pattern for any API that is rate limited or has a lot of requests.
"""

import os
import httpx
from datetime import datetime, timedelta
import asyncio
from typing import Optional, Dict, Any, List
from tenacity import retry, stop_after_attempt, wait_exponential
from dotenv import load_dotenv
from loguru import logger
from tabulate import tabulate
from aiocache import cached, Cache

load_dotenv()

# Constants
BASE_URL = "http://api.openweathermap.org/data/2.5"
API_KEY = os.getenv("OPENWEATHER_API_KEY")

if not API_KEY:
    logger.error("OPENWEATHER_API_KEY not found in environment variables")
    raise ValueError("OPENWEATHER_API_KEY environment variable is required")


@cached(ttl=600, cache=Cache.MEMORY)  # Cache for 10 minutes (600 seconds)
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10),
    retry_error_callback=lambda retry_state: None,
)
async def get_forecast(date: datetime, city: str = "London") -> Optional[Dict[str, Any]]:
    """
    Get 7-day weather forecast data.
    For dates beyond the forecast, use historical data from previous year.
    
    Returns a structured forecast with daily data.
    """
    try:
        logger.info(f"Fetching 7-day forecast for {city}")
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{BASE_URL}/forecast/daily",  # Using daily forecast endpoint
                params={
                    "q": city,
                    "appid": API_KEY,
                    "units": "metric",
                    "cnt": 7  # Request 7 days of data
                },
                timeout=10.0
            )
            response.raise_for_status()
            data = response.json()

            # Transform the data into a structured format
            forecast_data = []
            target_date = date.date()
            
            for day_data in data["list"]:
                forecast_date = datetime.fromtimestamp(day_data["dt"]).date()
                daily_data = {
                    "date": forecast_date.strftime("%Y-%m-%d"),
                    "day": forecast_date.strftime("%A"),  # Day name (Monday, Tuesday, etc.)
                    "temperature": {
                        "morning": round(day_data["temp"]["morn"]),
                        "day": round(day_data["temp"]["day"]),
                        "evening": round(day_data["temp"]["eve"]),
                        "night": round(day_data["temp"]["night"])
                    },
                    "condition": day_data["weather"][0]["main"],
                    "description": day_data["weather"][0]["description"],
                    "humidity": day_data["humidity"],
                    "wind_speed": round(day_data["speed"]),
                    "is_birthday": forecast_date == target_date
                }
                forecast_data.append(daily_data)

            logger.success(f"Successfully fetched 7-day forecast for {city}")
            return {
                "city": city,
                "forecast": forecast_data,
                "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }

    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error occurred: {e.response.status_code} - {e.response.text}")
        raise
    except httpx.RequestError as e:
        logger.error(f"Request failed: {e}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return None


async def main():
    # Test with a date 3 days from now
    test_date = datetime.now() + timedelta(days=3)
    logger.info(f"Testing weather forecast for: {test_date}")

    try:
        forecast = await get_forecast(test_date, "Buffalo")
        if forecast:
            # Prepare data for tabulate
            table_data = []
            headers = ["Date", "Day", "Condition", "Temp (Day)", "Humidity", "Wind Speed"]
            
            for day in forecast["forecast"]:
                table_data.append([
                    day["date"],
                    day["day"],
                    day["condition"],
                    f"{day['temperature']['day']}°C",
                    f"{day['humidity']}%",
                    f"{day['wind_speed']} m/s"
                ])
            
            # Create and print the table
            table = tabulate(table_data, headers, tablefmt="pretty")
            logger.info(f"\n7-Day Forecast for {forecast['city']}:\n{table}")
        else:
            logger.warning("No forecast found for the given date")
    except Exception as e:
        logger.error(f"Test failed: {e}")


if __name__ == "__main__":
    asyncio.run(main())
