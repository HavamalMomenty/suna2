import os
import requests
from typing import Dict, Optional, Any
import logging
import asyncio

from agent.tools.data_providers.RapidDataProviderBase import RapidDataProviderBase, EndpointSchema

logger = logging.getLogger(__name__)


class ResightsProvider(RapidDataProviderBase):
    """Provider for accessing Resights.dk API (via RapidAPI gateway or direct token)."""

    def __init__(self, api_key: Optional[str] = None, access_token: Optional[str] = None, user_id: Optional[str] = None):
        self.api_key = api_key or os.getenv("RAPID_API_KEY")
        self.user_id = user_id
        self.access_token = access_token
        self._token_service = None
        self._token_initialized = False
        
        # If no access_token provided and we have a user_id, we'll initialize the token lazily
        # when needed in the async context
        if not self.access_token and self.user_id:
            # Initialize token service for later use
            try:
                from services.user_token_service import UserTokenService
                self._token_service = UserTokenService()
            except Exception as e:
                logger.error(f"Error initializing token service for user {user_id}: {e}")
                self._token_service = None
        else:
            # Fallback to environment variable if no user_id or access_token provided
            self.access_token = self.access_token or os.getenv("RESIGHTS_TOKEN")
        
        # Log if no token is available (but don't throw error)
        if not self.access_token:
            logger.warning("No Resights token available. ResightsProvider will not be able to make API calls.")

        # Base URL for RapidAPI gateway (matches your header usage). If you switch to direct API,
        # set base_url to "https://api.resights.dk" and use Bearer tokens.
        base_url = "https://resights.p.rapidapi.com"

        # ---- Endpoint catalog (GET only + safe POST-ready) ----
        # All routes below are from Resights public docs:
        # - Properties, valuations, indicators, trades (GET/POST) :contentReference[oaicite:3]{index=3}
        # - BBR (buildings/units/floors/plots/staircases/tech installs) :contentReference[oaicite:4]{index=4}
        # - EMO (energy labels by BFE or id) :contentReference[oaicite:5]{index=5}
        # - POI (within-radius, n-closest; advanced POST kept for later) :contentReference[oaicite:6]{index=6}
        # - Plandata (municipal planning layers) :contentReference[oaicite:7]{index=7}
        # - Tinglysning (search + documents + downloads + changes) :contentReference[oaicite:8]{index=8}
        # - CVR (companies, members, network, financials) :contentReference[oaicite:9]{index=9}
        # - GIS (geojson, geodanmark buildings, export bbox) :contentReference[oaicite:10]{index=10}
        # - Minutes (municipal meeting docs) :contentReference[oaicite:11]{index=11}
        endpoints: Dict[str, EndpointSchema] = {
            # ---------- Properties (BFE) ----------
            "property_by_bfe": {
                "route": "/api/v2/properties/{bfe_number}",
                "method": "GET",
                "name": "Property Details (BFE)",
                "description": "Get property core by BFE.",
                "payload": {"bfe_number": "BFE number (required)"},
            },
            "property_overview": {
                "route": "/api/v2/properties/{bfe_number}/overview",
                "method": "GET",
                "name": "Property Overview",
                "description": "One-shot summary for underwriting intake.",
                "payload": {"bfe_number": "BFE number (required)"},
            },
            "property_tax": {
                "route": "/api/v2/properties/{bfe_number}/tax",
                "method": "GET",
                "name": "Property Tax",
                "description": "Public tax details for property.",
                "payload": {"bfe_number": "BFE number (required)"},
            },
            "property_bbr_history": {
                "route": "/api/v2/properties/{bfe_number}/bbr/history",
                "method": "GET",
                "name": "BBR History",
                "description": "Historic BBR records for property.",
                "payload": {"bfe_number": "BFE number (required)"},
            },
            "property_trades": {
                "route": "/api/v2/properties/{bfe_number}/trades",
                "method": "GET",
                "name": "Property Trades",
                "description": "All registered trades for property.",
                "payload": {"bfe_number": "BFE number (required)"},
            },
            "transactions_latest": {
                "route": "/api/v2/properties/{bfe_number}/trades/latest",
                "method": "GET",
                "name": "Latest Sale Transaction",
                "description": "Latest trade incl. buyer, seller, price.",
                "payload": {"bfe_number": "BFE number (required)"},
            },
            "valuations": {
                "route": "/api/v2/properties/{bfe_number}/valuations",
                "method": "GET",
                "name": "Valuations (All)",
                "description": "All valuations for the property.",
                "payload": {"bfe_number": "BFE number (required)"},
            },
            "valuations_latest": {
                "route": "/api/v2/properties/{bfe_number}/valuations/latest",
                "method": "GET",
                "name": "Latest Valuation",
                "description": "Most recent valuation incl. land/building.",
                "payload": {"bfe_number": "BFE number (required)"},
            },
            "valuations_new": {
                "route": "/api/v2/properties/{bfe_number}/valuations/new",
                "method": "GET",
                "name": "New Valuation",
                "description": "New valuation endpoint (when available).",
                "payload": {"bfe_number": "BFE number (required)"},
            },
            "indicators": {
                "route": "/api/v2/properties/{bfe_number}/indicators",
                "method": "GET",
                "name": "Indicators",
                "description": "Property-level indicators/signals.",
                "payload": {"bfe_number": "BFE number (required)"},
            },

            # ---------- BBR (Bygnings- og Boligregistret) ----------
            "bbr_buildings": {
                "route": "/api/v2/bbr/buildings",
                "method": "GET",
                "name": "BBR Buildings",
                "description": "Buildings (filter by bfe_number or geometry).",
                "payload": {"bfe_number": "(optional) filter"},
            },
            "bbr_units": {
                "route": "/api/v2/bbr/units",
                "method": "GET",
                "name": "BBR Units",
                "description": "Unit-level facts.",
                "payload": {"bfe_number": "(optional) filter"},
            },
            "bbr_floors": {
                "route": "/api/v2/bbr/floors",
                "method": "GET",
                "name": "BBR Floors",
                "description": "Floors data.",
                "payload": {"bfe_number": "(optional) filter"},
            },
            "bbr_plots": {
                "route": "/api/v2/bbr/plots",
                "method": "GET",
                "name": "BBR Plots",
                "description": "Plots for property/cadastre.",
                "payload": {"bfe_number": "(optional) filter"},
            },
            "bbr_staircases": {
                "route": "/api/v2/bbr/staircases",
                "method": "GET",
                "name": "BBR Staircases",
                "description": "Staircases data.",
                "payload": {"bfe_number": "(optional) filter"},
            },
            "bbr_technical_installations": {
                "route": "/api/v2/bbr/technical-installations",
                "method": "GET",
                "name": "BBR Technical Installations",
                "description": "Technical installations.",
                "payload": {"bfe_number": "(optional) filter"},
            },

            # ---------- EMO (Energy labels) ----------
            "emo_energy_by_bfe": {
                "route": "/api/v2/emo/energy",
                "method": "GET",
                "name": "Energy Label by BFE",
                "description": "Query energy label using bfe_number param.",
                "payload": {"bfe_number": "BFE number (query param)"},
            },
            "emo_energy_by_id": {
                "route": "/api/v2/emo/energy/{id}",
                "method": "GET",
                "name": "Energy Label by ID",
                "description": "Retrieve energy label by EMO id.",
                "payload": {"id": "EMO document id"},
            },

            # ---------- POI (GET-only helpers; POST variants supported below) ----------
            "poi_within_radius": {
                "route": "/api/v2/poi/within-radius/{lat}/{lon}/{radius}",
                "method": "GET",
                "name": "POIs Within Radius",
                "description": "Generic POIs within a radius (meters).",
                "payload": {"lat": "Latitude", "lon": "Longitude", "radius": "Meters"},
            },
            "poi_n_closest": {
                "route": "/api/v2/poi/n-closest/{lat}/{lon}/{n}",
                "method": "GET",
                "name": "N Closest POIs",
                "description": "Generic nearest POIs.",
                "payload": {"lat": "Latitude", "lon": "Longitude", "n": "Count"},
            },

            # ---------- Plandata ----------
            "plandata": {
                "route": "/api/v2/plandata",
                "method": "GET",
                "name": "Plandata",
                "description": "Municipal planning layers.",
                "payload": {},  # use bbox/filters as query params if available
            },

            # ---------- Trades (market comps) ----------
            "trades": {
                "route": "/api/v2/trades",
                "method": "GET",
                "name": "Trades",
                "description": "List/search trades (basic GET).",
                "payload": {},  # add filters as query params
            },
            "trade_by_id": {
                "route": "/api/v2/trades/{id}",
                "method": "GET",
                "name": "Trade By ID",
                "description": "Fetch a single trade.",
                "payload": {"id": "Trade id"},
            },
            "trades_portfolio": {
                "route": "/api/v2/trades/portfolio/{type}/{id}",
                "method": "GET",
                "name": "Portfolio Trades",
                "description": "Trades for a portfolio entity.",
                "payload": {"type": "portfolio type", "id": "portfolio id"},
            },

            # ---------- Tinglysning (search + docs + changes) ----------
            "tingly_address": {
                "route": "/api/v2/tinglysning/property/search/address",
                "method": "GET",
                "name": "Tinglysning Search by Address",
                "description": "Resolve to property hits/UUIDs/BFE.",
                "payload": {"query": "address string (query param)"},
            },
            "tingly_bfe": {
                "route": "/api/v2/tinglysning/property/search/bfe-number/{bfe_number}",
                "method": "GET",
                "name": "Tinglysning Search by BFE",
                "description": "Search tinglysning via BFE.",
                "payload": {"bfe_number": "BFE number"},
            },
            "tingly_tingbogsattest": {
                "route": "/api/v2/tinglysning/tingbogsattest/{uuid}",
                "method": "GET",
                "name": "Tingbogsattest (meta)",
                "description": "Get tingbogsattest by UUID (metadata).",
                "payload": {"uuid": "Document UUID"},
            },
            "tingly_tingbogsattest_download": {
                "route": "/api/v2/tinglysning/download/tingbogsattest/{uuid}",
                "method": "GET",
                "name": "Download Tingbogsattest",
                "description": "Download tingbogsattest PDF.",
                "payload": {"uuid": "Document UUID"},
            },
            "tingly_atd_by_uuid": {
                "route": "/api/v2/tinglysning/atd/uuid/{uuid}",
                "method": "GET",
                "name": "ATD by UUID",
                "description": "Aktuelt Tinglyst Dokument.",
                "payload": {"uuid": "ATD UUID"},
            },
            "tingly_changes_latest": {
                "route": "/api/v2/tinglysning/changes/latest",
                "method": "GET",
                "name": "Latest Changes",
                "description": "Polling endpoint for change events.",
                "payload": {},
            },

            # ---------- CVR ----------
            "cvr_company": {
                "route": "/api/v2/cvr/companies/{cvr_number}",
                "method": "GET",
                "name": "CVR Company",
                "description": "Company details by CVR.",
                "payload": {"cvr_number": "CVR number"},
            },
            "cvr_financials_latest": {
                "route": "/api/v2/cvr/companies/{cvr_number}/financials/latest",
                "method": "GET",
                "name": "CVR Financials Latest",
                "description": "Latest company financials.",
                "payload": {"cvr_number": "CVR number"},
            },
            "cvr_network": {
                "route": "/api/v2/cvr/{id}/network",
                "method": "GET",
                "name": "CVR Network",
                "description": "Ownership/people network graph.",
                "payload": {"id": "internal graph id (from CVR)"},
            },
            "cvr_partners_in_crime": {
                "route": "/api/v2/cvr/{id}/partners-in-crime",
                "method": "GET",
                "name": "Partners In Crime",
                "description": "Network risk signal.",
                "payload": {"id": "internal graph id (from CVR)"},
            },

            # ---------- GIS ----------
            "gis_geojson": {
                "route": "/api/v2/gis/geojson",
                "method": "GET",
                "name": "GIS GeoJSON Layer",
                "description": "Generic GIS layer endpoint.",
                "payload": {},  # pass layer params as query
            },
            "gis_geodanmark_buildings": {
                "route": "/api/v2/gis/geodanmark/buildings",
                "method": "GET",
                "name": "GeoDanmark Buildings",
                "description": "Building footprints.",
                "payload": {},  # filter via query
            },
            "gis_export_bbox": {
                "route": "/api/v2/gis/export/{xmin}/{ymin}/{xmax}/{ymax}",
                "method": "POST",
                "name": "GIS Export (BBox)",
                "description": "Export layers in bounding box (POST).",
                "payload": {"xmin": "xmin", "ymin": "ymin", "xmax": "xmax", "ymax": "ymax"},
            },

            # ---------- Minutes (kommunale referater) ----------
            "minutes_section": {
                "route": "/api/v2/minutes/sections/{id}",
                "method": "GET",
                "name": "Minutes Section",
                "description": "Fetch a section by id.",
                "payload": {"id": "section id"},
            },
            "minutes_appendix_presign": {
                "route": "/api/v2/minutes/appendices/{id}/presign",
                "method": "GET",
                "name": "Minutes Appendix Presign",
                "description": "Presigned URL for appendix download.",
                "payload": {"id": "appendix id"},
            },
        }

        super().__init__(base_url, endpoints)

    async def _ensure_token_initialized(self):
        """Initialize the user token if needed."""
        if self._token_initialized or not self._token_service or not self.user_id:
            return
            
        try:
            self.access_token = await self._token_service.get_resights_token(self.user_id)
            if not self.access_token:
                # Fallback to environment variable
                self.access_token = os.getenv("RESIGHTS_TOKEN")
                if not self.access_token:
                    logger.warning(f"No Resights token found for user {self.user_id} and no fallback token available")
                else:
                    logger.info(f"Using fallback Resights token for user {self.user_id}")
            else:
                logger.info(f"Successfully loaded Resights token for user {self.user_id}")
            self._token_initialized = True
        except Exception as e:
            logger.error(f"Error retrieving user token for user {self.user_id}: {e}")
            self.access_token = os.getenv("RESIGHTS_TOKEN")
            self._token_initialized = True

    async def call_endpoint_async(self, route: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Async version of call_endpoint that ensures token is initialized."""
        await self._ensure_token_initialized()
        return self.call_endpoint(route, payload)

    def call_endpoint(self, route: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        import re

        if route not in self.endpoints:
            raise ValueError(f"Unknown route: {route}")

        endpoint = self.endpoints[route]
        route_template = endpoint["route"]
        method = endpoint.get("method", "GET").upper()

        # Resolve path params
        path_params = re.findall(r"{(\w+)}", route_template)
        for param in path_params:
            if param not in payload:
                raise ValueError(f"Missing required path parameter: {param}")
            route_template = route_template.replace(f"{{{param}}}", str(payload.pop(param)))

        url = f"{self.base_url}{route_template}"

        headers = {
            "X-RapidAPI-Key": self.api_key,
            "X-RapidAPI-Host": "resights.p.rapidapi.com",
        }
        if self.access_token:
            # For direct API use "Bearer <token>"; for RapidAPI some setups accept a raw token header.
            headers["Authorization"] = self.access_token

        try:
            if method == "POST":
                response = requests.post(url, headers=headers, json=payload or {})
            else:
                response = requests.get(url, headers=headers, params=payload or {})
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error("Resights error: %s", e)
            return {"error": str(e), "url": url, "method": method}

    def call_raw_path(self, path: str, query: Optional[Dict[str, Any]] = None, method: str = "GET", json: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Call an arbitrary Resights API path directly (convenience for exploration)."""
        # Check if we have a token before making API calls
        if not self.access_token:
            return {"error": "No Resights token configured. Please add your Resights token in user settings."}
            
        url = f"{self.base_url}{path}"
        headers = {
            "X-RapidAPI-Key": self.api_key,
            "X-RapidAPI-Host": "resights.p.rapidapi.com",
        }
        if self.access_token:
            headers["Authorization"] = self.access_token

        try:
            m = method.upper()
            if m == "POST":
                response = requests.post(url, headers=headers, params=query or {}, json=json or {})
            else:
                response = requests.get(url, headers=headers, params=query or {})
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error("Resights raw path error: %s", e)
            return {"error": str(e), "url": url, "method": method}


if __name__ == "__main__":
    from dotenv import load_dotenv
    from pprint import pprint
    import time

    load_dotenv()

    """
    Example:
    PYTHONPATH=backend python3 backend/agent/tools/data_providers/ResightsProvider.py
    """

    provider = ResightsProvider()

    # --- Minimal smoke tests (fill in a real BFE/coords to try) ---
    bfe_number = ""  # e.g. "1234567"
    if bfe_number:
        print("\n📌 Property Overview")
        pprint(provider.call_endpoint("property_overview", {"bfe_number": bfe_number}))
        time.sleep(0.5)

        print("\n📌 Latest Valuation")
        pprint(provider.call_endpoint("valuations_latest", {"bfe_number": bfe_number}))
        time.sleep(0.5)

        print("\n📌 Energy label (EMO) by BFE (as query param)")
        pprint(provider.call_endpoint("emo_energy_by_bfe", {"bfe_number": bfe_number}))
        time.sleep(0.5)

    # Example: POI within radius (use real coords)
    # pprint(provider.call_endpoint("poi_within_radius", {"lat": 55.6761, "lon": 12.5683, "radius": 500}))
