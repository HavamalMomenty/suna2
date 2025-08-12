import os
import requests
from typing import Dict, Optional, Any
import logging

from agent.tools.data_providers.RapidDataProviderBase import RapidDataProviderBase, EndpointSchema

logger = logging.getLogger(__name__)


class ResightsProvider(RapidDataProviderBase):
    """Provider for accessing Resights.dk API via RapidAPI"""

    def __init__(self, api_key: Optional[str] = None, access_token: Optional[str] = None):
        self.api_key = api_key or os.getenv("RAPID_API_KEY")
        self.access_token = access_token or os.getenv("RESIGHTS_TOKEN")

        print(self.access_token)
        endpoints: Dict[str, EndpointSchema] = {
            "owners": {
                "route": "/properties/{bfe_number}/owners",
                "method": "GET",
                "name": "Property Owners",
                "description": "Get current ownership details for a property.",
                "payload": {
                    "bfe_number": "BFE number identifying the property (required)"
                }
            },
            "transactions_latest": {
                "route": "/properties/{bfe_number}/trades/latest",
                "method": "GET",
                "name": "Latest Sale Transaction",
                "description": "Get latest transaction including buyer, seller, and purchase price.",
                "payload": {
                    "bfe_number": "BFE number identifying the property (required)"
                }
            },
            "valuations_latest": {
                "route": "/properties/{bfe_number}/valuations/latest",
                "method": "GET",
                "name": "Latest Valuation",
                "description": "Retrieve the most recent public property valuation including land and building value.",
                "payload": {
                    "bfe_number": "BFE number identifying the property (required)"
                }
            },
            "cashflow_summary": {
                "route": "/properties/{bfe_number}/cashflow/summary",
                "method": "GET",
                "name": "Cash Flow Summary",
                "description": "Retrieve overall cashflow summary including rental income, vacancy, and expenses.",
                "payload": {
                    "bfe_number": "BFE number identifying the property (required)"
                }
            },
            "cashflow_rentroll": {
                "route": "/properties/{bfe_number}/cashflow/rentroll",
                "method": "GET",
                "name": "Rent Roll",
                "description": "Get detailed rent roll data including unit-level rent amounts and lease status.",
                "payload": {
                    "bfe_number": "BFE number identifying the property (required)"
                }
            },
            "cashflow_expenses_monthly": {
                "route": "/properties/{bfe_number}/cashflow/expenses/monthly",
                "method": "GET",
                "name": "Monthly Expenses",
                "description": "Breakdown of monthly operational and maintenance costs.",
                "payload": {
                    "bfe_number": "BFE number identifying the property (required)"
                }
            },
            "cashflow_income_monthly": {
                "route": "/properties/{bfe_number}/cashflow/income/monthly",
                "method": "GET",
                "name": "Monthly Income",
                "description": "Breakdown of monthly income from rentals and other sources.",
                "payload": {
                    "bfe_number": "BFE number identifying the property (required)"
                }
            },
            "property_details": {
                "route": "/properties/{bfe_number}",
                "method": "GET",
                "name": "Property Details",
                "description": "High-level information including address, building type, area, and cadastral details.",
                "payload": {
                    "bfe_number": "BFE number identifying the property (required)"
                }
            },
            "property_summary": {
                "route": "/properties/{bfe_number}/summary",
                "method": "GET",
                "name": "Property Summary",
                "description": "Consolidated view of size, usage, valuations, building age, and other core metadata.",
                "payload": {
                    "bfe_number": "BFE number identifying the property (required)"
                }
            },
            "buildings": {
                "route": "/properties/{bfe_number}/buildings",
                "method": "GET",
                "name": "Building Information",
                "description": "Detailed data about all buildings on the property including age, floors, and material.",
                "payload": {
                    "bfe_number": "BFE number identifying the property (required)"
                }
            },
            "restrictions": {
                "route": "/properties/{bfe_number}/restrictions",
                "method": "GET",
                "name": "Property Restrictions",
                "description": "Legal and zoning restrictions that may affect development or use.",
                "payload": {
                    "bfe_number": "BFE number identifying the property (required)"
                }
            },
            "land_values": {
                "route": "/properties/{bfe_number}/land-values",
                "method": "GET",
                "name": "Land Value History",
                "description": "Time series of land valuation by public authorities.",
                "payload": {
                    "bfe_number": "BFE number identifying the property (required)"
                }
            },
            "loans": {
                "route": "/properties/{bfe_number}/loans",
                "method": "GET",
                "name": "Registered Loans",
                "description": "Information on mortgages or loans registered against the property.",
                "payload": {
                    "bfe_number": "BFE number identifying the property (required)"
                }
            },
            "units": {
                "route": "/properties/{bfe_number}/units",
                "method": "GET",
                "name": "Unit Count",
                "description": "Get the number of residential units in a property (e.g. apartments or condos).",
                "payload": {
                    "bfe_number": "BFE number identifying the property (required)"
                }
            },
            "distances": {
                "route": "/properties/{bfe_number}/distances",
                "method": "GET",
                "name": "Nearby Facilities",
                "description": "Get walking and driving distances from the property to key locations like schools, shops, public transit, and more.",
                "payload": {
                    "bfe_number": "BFE number identifying the property (required)"
                }
            }
        }


        base_url = "https://resights.p.rapidapi.com/api/v2"
        super().__init__(base_url, endpoints)

    def call_endpoint(self, route: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        import re

        if route not in self.endpoints:
            raise ValueError(f"Unknown route: {route}")

        endpoint = self.endpoints[route]
        route_template = endpoint["route"]

        for match in re.findall(r"{(\w+)}", route_template):
            if match not in payload:
                raise ValueError(f"Missing required path parameter: {match}")
            route_template = route_template.replace(f"{{{match}}}", str(payload.pop(match)))

        url = f"{self.base_url}{route_template}"
        
        headers = {
            "X-RapidAPI-Key": self.api_key,
            "X-RapidAPI-Host": "resights.p.rapidapi.com"
        }

        if self.access_token:
            headers["Authorization"] = self.access_token


        try:
            response = requests.get(url, headers=headers, params=payload)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error("Resights error: %s", e)
            return {"error": str(e), "url": url}
    
    def call_raw_path(self, path: str, query: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Call an arbitrary Resights API path directly (without endpoint schema)."""
        url = f"{self.base_url}{path}"
        headers = {
            "X-RapidAPI-Key": self.api_key,
            "X-RapidAPI-Host": "resights.p.rapidapi.com"
        }
        if self.access_token:
            headers["Authorization"] = self.access_token

        try:
            response = requests.get(url, headers=headers, params=query or {})
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error("Resights raw path error: %s", e)
            return {"error": str(e), "url": url}

if __name__ == "__main__":
    from dotenv import load_dotenv
    from pprint import pprint
    import time


    load_dotenv()

    """
    PYTHONPATH=backend python3 backend/agent/tools/data_providers/ResightsProvider.py
    """

    provider = ResightsProvider()

    
    bfe_number = ""
    print("\n📌 Property Owners")
    pprint(provider.call_endpoint("owners", {"bfe_number": bfe_number}))
    time.sleep(1)

    print("\n📌 Latest Sale Transaction")
    pprint(provider.call_endpoint("transactions_latest", {"bfe_number": bfe_number}))
    time.sleep(1)

    print("\n📌 Latest Valuation")
    pprint(provider.call_endpoint("valuations_latest", {"bfe_number": bfe_number}))
    time.sleep(1)
