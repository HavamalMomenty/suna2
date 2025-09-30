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

            ##### ENDPOINT ADDED AFTER 9/30 below
            # ---------- Meta ----------
            "token": {
                "route": "/token",
                "method": "GET",
                "name": "Token",
                "description": "Issue an authentication token.",
                "payload": {},
            },
            "healthcheck": {
                "route": "/healthcheck",
                "method": "GET",
                "name": "Healthcheck",
                "description": "Check if service is available.",
                "payload": {},
            },

            # ---------- Properties (BFE) ----------
            "properties_list": {
                "route": "/api/v2/properties",
                "method": "GET",
                "name": "Get Properties",
                "description": "List/search properties (basic GET).",
                "payload": {},  # filters as query params
            },
            "properties_advanced": {
                "route": "/api/v2/properties",
                "method": "POST",
                "name": "Get Properties Advanced",
                "description": "Advanced property search (POST).",
                "payload": {},  # body with filters
            },
            "property_tax_ois": {
                "route": "/api/v2/properties/{bfe_number}/tax/ois",
                "method": "GET",
                "name": "Property OIS Tax",
                "description": "OIS tax details for property.",
                "payload": {"bfe_number": "BFE number (required)"},
            },
            "property_tax_old": {
                "route": "/api/v2/properties/{bfe_number}/tax/old",
                "method": "GET",
                "name": "Property Old Tax",
                "description": "Legacy/old tax details for property.",
                "payload": {"bfe_number": "BFE number (required)"},
            },
            "property_bbr": {
                "route": "/api/v2/properties/{bfe_number}/bbr",
                "method": "GET",
                "name": "Property BBR Details",
                "description": "Property BBR details by BFE.",
                "payload": {"bfe_number": "BFE number (required)"},
            },
            "property_ebr": {
                "route": "/api/v2/properties/{bfe_number}/ebr",
                "method": "GET",
                "name": "Property EBR Details",
                "description": "Property EBR details by BFE.",
                "payload": {"bfe_number": "BFE number (required)"},
            },
            "property_owners": {
                "route": "/api/v2/properties/{bfe_number}/owners",
                "method": "GET",
                "name": "Property Owners",
                "description": "Owners for a property.",
                "payload": {"bfe_number": "BFE number (required)"},
            },

            # ---------- BBR ----------
            "bbr_cases": {
                "route": "/api/v2/bbr/cases",
                "method": "GET",
                "name": "BBR Cases",
                "description": "BBR case records.",
                "payload": {"bfe_number": "(optional) filter"},
            },

            # ---------- Trades ----------
            "trades_advanced": {
                "route": "/api/v2/trades",
                "method": "POST",
                "name": "Trades Advanced",
                "description": "Advanced trades search (POST).",
                "payload": {},  # body with filters
            },

            # ---------- Cadastres ----------
            "cadastres": {
                "route": "/api/v2/cadastres",
                "method": "GET",
                "name": "Cadastres",
                "description": "List/search cadastres.",
                "payload": {},  # filters as query
            },
            "cadastres_advanced": {
                "route": "/api/v2/cadastres",
                "method": "POST",
                "name": "Cadastres Advanced",
                "description": "Advanced cadastre search (POST).",
                "payload": {},  # body with filters
            },
            "cadastre_by_id": {
                "route": "/api/v2/cadastres/{id}",
                "method": "GET",
                "name": "Cadastre By ID",
                "description": "Fetch single cadastre by id.",
                "payload": {"id": "Cadastre id"},
            },

            # ---------- CVR ----------
            "cvr_companies": {
                "route": "/api/v2/cvr/companies",
                "method": "GET",
                "name": "CVR Companies",
                "description": "List/search companies.",
                "payload": {},  # filters as query
            },
            "cvr_companies_advanced": {
                "route": "/api/v2/cvr/companies",
                "method": "POST",
                "name": "CVR Companies Advanced",
                "description": "Advanced company search (POST).",
                "payload": {},  # body with filters
            },
            "cvr_company_timeline": {
                "route": "/api/v2/cvr/companies/{cvr_number}/timeline",
                "method": "GET",
                "name": "Company Timeline",
                "description": "Timeline for company by CVR.",
                "payload": {"cvr_number": "CVR number"},
            },
            "cvr_company_financials": {
                "route": "/api/v2/cvr/companies/{cvr_number}/financials",
                "method": "GET",
                "name": "Company Financials",
                "description": "All financials for company.",
                "payload": {"cvr_number": "CVR number"},
            },
            "cvr_members": {
                "route": "/api/v2/cvr/members",
                "method": "GET",
                "name": "CVR Members",
                "description": "List/search members.",
                "payload": {},  # filters as query
            },
            "cvr_members_advanced": {
                "route": "/api/v2/cvr/members",
                "method": "POST",
                "name": "CVR Members Advanced",
                "description": "Advanced members search (POST).",
                "payload": {},  # body with filters
            },
            "cvr_member_by_unit": {
                "route": "/api/v2/cvr/members/{unit_number}",
                "method": "GET",
                "name": "CVR Member",
                "description": "Member by unit number.",
                "payload": {"unit_number": "Unit number"},
            },
            "cvr_member_timeline": {
                "route": "/api/v2/cvr/members/{cvr_number}/timeline",
                "method": "GET",
                "name": "Member Timeline",
                "description": "Timeline for a member by CVR.",
                "payload": {"cvr_number": "CVR number"},
            },
            "cvr_p_units": {
                "route": "/api/v2/cvr/p-units",
                "method": "GET",
                "name": "CVR P Units",
                "description": "List/search production units.",
                "payload": {},  # filters as query
            },
            "cvr_p_units_advanced": {
                "route": "/api/v2/cvr/p-units",
                "method": "POST",
                "name": "CVR P Units Advanced",
                "description": "Advanced P-units search (POST).",
                "payload": {},  # body with filters
            },
            "cvr_p_unit": {
                "route": "/api/v2/cvr/p-units/{p_number}",
                "method": "GET",
                "name": "CVR P Unit",
                "description": "Production unit by P-number.",
                "payload": {"p_number": "P-number"},
            },
            "cvr_network_pair": {
                "route": "/api/v2/cvr/network/pair",
                "method": "GET",
                "name": "Connections Between Pair",
                "description": "Network connections between two entities.",
                "payload": {},  # use query params
            },
            "cvr_expand_network": {
                "route": "/api/v2/cvr/{id}/expand-network",
                "method": "GET",
                "name": "Expand Network",
                "description": "Expand ownership/people network graph.",
                "payload": {"id": "internal graph id"},
            },
            "cvr_registrations": {
                "route": "/api/v2/cvr/registrations",
                "method": "GET",
                "name": "Registration Texts",
                "description": "Company registration texts.",
                "payload": {},  # filters as query
            },

            # ---------- Persons / EJF ----------
            "ejf_persons": {
                "route": "/api/v2/ejf/persons",
                "method": "GET",
                "name": "EJF Persons",
                "description": "List/search persons (Ejerfortegnelsen).",
                "payload": {},  # filters as query
            },
            "ejf_persons_advanced": {
                "route": "/api/v2/ejf/persons",
                "method": "POST",
                "name": "EJF Persons Advanced",
                "description": "Advanced person search (POST).",
                "payload": {},  # body with filters
            },
            "ejf_person_by_id": {
                "route": "/api/v2/ejf/persons/{id}",
                "method": "GET",
                "name": "EJF Person By ID",
                "description": "Fetch person by EJF id.",
                "payload": {"id": "EJF person id"},
            },
            "ejf_person_portfolio": {
                "route": "/api/v2/ejf/persons/{id}/portfolio",
                "method": "GET",
                "name": "EJF Person Portfolio",
                "description": "Portfolio for an EJF person id.",
                "payload": {"id": "EJF person id"},
            },
            "ejf_others": {
                "route": "/api/v2/ejf/others",
                "method": "GET",
                "name": "EJF Others",
                "description": "Other owners list/search.",
                "payload": {},  # filters as query
            },
            "ejf_others_advanced": {
                "route": "/api/v2/ejf/others",
                "method": "POST",
                "name": "EJF Others Advanced",
                "description": "Advanced others search (POST).",
                "payload": {},  # body with filters
            },
            "ejf_other_by_id": {
                "route": "/api/v2/ejf/others/{id}",
                "method": "GET",
                "name": "EJF Other By ID",
                "description": "Fetch 'other' by id.",
                "payload": {"id": "EJF other id"},
            },
            "robinson_list": {
                "route": "/api/v2/robinson",
                "method": "GET",
                "name": "Robinson List",
                "description": "Get Robinson list.",
                "payload": {},
            },
            "robinson_check": {
                "route": "/api/v2/robinson/check",
                "method": "GET",
                "name": "Check Robinson List",
                "description": "Check if entry is on Robinson list.",
                "payload": {},  # query params
            },

            # ---------- Financials (catalog) ----------
            "financials": {
                "route": "/api/v2/cvr/financials",
                "method": "GET",
                "name": "Financials",
                "description": "Financial statements (catalog/list).",
                "payload": {},  # filters as query
            },
            "financials_advanced": {
                "route": "/api/v2/cvr/financials",
                "method": "POST",
                "name": "Financials Advanced",
                "description": "Advanced financials search (POST).",
                "payload": {},  # body with filters
            },
            "financials_by_id": {
                "route": "/api/v2/cvr/financials/{id}",
                "method": "GET",
                "name": "Financials By ID",
                "description": "Financial statement by id.",
                "payload": {"id": "Financials id"},
            },

            # ---------- GI ----------
            "gi_documents": {
                "route": "/api/v2/gi/{bfe_number}",
                "method": "GET",
                "name": "GI Documents",
                "description": "Grundejernes Investeringsfond documents for property.",
                "payload": {"bfe_number": "BFE number (required)"},
            },

            # ---------- GIS ----------
            "gis_mvt": {
                "route": "/api/v2/gis/mvt/{layer}/{z}/{x}/{y}.pbf",
                "method": "GET",
                "name": "Vector Layer (MVT)",
                "description": "Vector tiles for GIS layer.",
                "payload": {"layer": "Layer", "z": "Zoom", "x": "X", "y": "Y"},
            },
            "gis_proxy": {
                "route": "/api/v2/gis/proxy",
                "method": "GET",
                "name": "Geoservice Proxy",
                "description": "Proxy to external geoservices.",
                "payload": {},  # target as query
            },
            "gis_convert": {
                "route": "/api/v2/gis/convert",
                "method": "POST",
                "name": "Convert GIS File to GeoJSON",
                "description": "Upload/convert GIS file to GeoJSON.",
                "payload": {},  # file/body payload
            },
            "gis_meta": {
                "route": "/api/v2/gis/meta",
                "method": "GET",
                "name": "GeoJSON Layer Meta",
                "description": "Metadata for available GIS layers.",
                "payload": {},
            },

            # ---------- POI (Shops & Queries) ----------
            "poi_shop_brand_get": {
                "route": "/api/v2/poi/shops/brands/{name}",
                "method": "GET",
                "name": "POI Shop Brand",
                "description": "Get a shop brand by name.",
                "payload": {"name": "Brand name"},
            },
            "poi_shop_brand_delete": {
                "route": "/api/v2/poi/shops/brands/{name}",
                "method": "DELETE",
                "name": "Delete POI Shop Brand",
                "description": "Delete a shop brand.",
                "payload": {"name": "Brand name"},
            },
            "poi_shop_brands": {
                "route": "/api/v2/poi/shops/brands",
                "method": "GET",
                "name": "POI Shop Brands",
                "description": "List shop brands.",
                "payload": {},
            },
            "poi_shop_brand_add": {
                "route": "/api/v2/poi/shops/brands",
                "method": "POST",
                "name": "Add POI Shop Brand",
                "description": "Create a shop brand.",
                "payload": {},  # body with brand data
            },
            "poi_shop_query_get": {
                "route": "/api/v2/poi/shops/queries/{brand}/{query_name}",
                "method": "GET",
                "name": "POI Shop Query",
                "description": "Get a saved shop query.",
                "payload": {"brand": "Brand", "query_name": "Query name"},
            },
            "poi_shop_query_delete": {
                "route": "/api/v2/poi/shops/queries/{brand}/{query_name}",
                "method": "DELETE",
                "name": "Delete POI Shop Query",
                "description": "Delete a saved shop query.",
                "payload": {"brand": "Brand", "query_name": "Query name"},
            },
            "poi_shop_queries": {
                "route": "/api/v2/poi/shops/queries",
                "method": "GET",
                "name": "POI Shop Queries",
                "description": "List saved shop queries.",
                "payload": {},
            },
            "poi_shop_query_add": {
                "route": "/api/v2/poi/shops/queries",
                "method": "POST",
                "name": "Add POI Shop Query",
                "description": "Create a saved shop query.",
                "payload": {},  # body with query
            },
            "poi_shop_by_source": {
                "route": "/api/v2/poi/shops/{data_source}/{source_id}",
                "method": "GET",
                "name": "POI Shop",
                "description": "Get shop by external data source/id.",
                "payload": {"data_source": "Source name", "source_id": "Source id"},
            },
            "poi_shops_search": {
                "route": "/api/v2/poi/shops/search",
                "method": "POST",
                "name": "Search POI Shops",
                "description": "Search shops around a location/area.",
                "payload": {},  # body with search params
            },
            "poi_schools": {
                "route": "/api/v2/poi/institutions/schools",
                "method": "POST",
                "name": "POI Schools",
                "description": "Get schools near a location/geometry.",
                "payload": {},  # body with params
            },
            "poi_daycare": {
                "route": "/api/v2/poi/institutions/daycare",
                "method": "POST",
                "name": "POI Daycare",
                "description": "Get daycare institutions near a location/geometry.",
                "payload": {},  # body with params
            },
            "poi_public_transport": {
                "route": "/api/v2/poi/public_transport",
                "method": "POST",
                "name": "POI Public Transport",
                "description": "Public transport proximity/coverage.",
                "payload": {},  # body with params
            },
            "poi_traffic": {
                "route": "/api/v2/poi/traffic",
                "method": "POST",
                "name": "POI Traffic",
                "description": "Traffic intensity metrics.",
                "payload": {},  # body with params
            },
            "poi_noise": {
                "route": "/api/v2/poi/noise",
                "method": "POST",
                "name": "POI Traffic Noise",
                "description": "Traffic noise metrics.",
                "payload": {},  # body with params
            },

            # ---------- Energy (BBR Energy from OIS) ----------
            "energy_building": {
                "route": "/api/v2/energy/buildings/{building_id}",
                "method": "GET",
                "name": "Energy From Building ID",
                "description": "BBR energy from OIS by building id.",
                "payload": {"building_id": "Building id"},
            },
            "energy_property": {
                "route": "/api/v2/energy/properties/{bfe_number}",
                "method": "GET",
                "name": "Energy By Property",
                "description": "BBR energy from OIS by BFE.",
                "payload": {"bfe_number": "BFE number (required)"},
            },

            # ---------- Tinglysning - Andelsbolig ----------
            "tingly_ab_address": {
                "route": "/api/v2/tinglysning/andelsbolig/search/address",
                "method": "GET",
                "name": "Search Andelsbolig By Address",
                "description": "Find andelsbolig by address.",
                "payload": {"query": "address string (query param)"},
            },
            "tingly_ab_municipality": {
                "route": "/api/v2/tinglysning/andelsbolig/search/municipality",
                "method": "GET",
                "name": "Search Andelsbolig By Municipality",
                "description": "Find andelsbolig by municipality.",
                "payload": {"municipality": "name/code (query param)"},
            },
            "tingly_ab_zip": {
                "route": "/api/v2/tinglysning/andelsbolig/search/zip_code",
                "method": "GET",
                "name": "Search Andelsbolig By Zip Code",
                "description": "Find andelsbolig by ZIP.",
                "payload": {"zip_code": "ZIP code (query param)"},
            },
            "tingly_ab_person": {
                "route": "/api/v2/tinglysning/andelsbolig/search/person",
                "method": "GET",
                "name": "Search Andelsbolig By Person",
                "description": "Find andelsbolig by person.",
                "payload": {"query": "person query (query param)"},
            },
            "tingly_ab_cvr": {
                "route": "/api/v2/tinglysning/andelsbolig/search/cvr-number/{cvr_number}",
                "method": "GET",
                "name": "Search Andelsbolig By CVR",
                "description": "Find andelsbolig by company CVR.",
                "payload": {"cvr_number": "CVR number"},
            },
            "tingly_andelsboligattest": {
                "route": "/api/v2/tinglysning/andelsbolig/attest/{uuid}",
                "method": "GET",
                "name": "Andelsboligattest By UUID",
                "description": "Fetch andelsboligattest metadata by UUID.",
                "payload": {"uuid": "Document UUID"},
            },

            # ---------- Tinglysning - Ejendom ----------
            "tingly_address_limited": {
                "route": "/api/v2/tinglysning/property/search/address-limited",
                "method": "GET",
                "name": "Tinglysning Search by Address (Limited)",
                "description": "Limited address search.",
                "payload": {"query": "address string (query param)"},
            },
            "tingly_cadastre": {
                "route": "/api/v2/tinglysning/property/search/cadastre/{land_lot}/{cadastre_number}",
                "method": "GET",
                "name": "Tinglysning Search by Cadastre",
                "description": "Search tinglysning by cadastre.",
                "payload": {"land_lot": "Land lot", "cadastre_number": "Cadastre number"},
            },
            "tingly_uma": {
                "route": "/api/v2/tinglysning/property/search/uma/{uma}",
                "method": "GET",
                "name": "Tinglysning Search by UMA",
                "description": "Search by unregistered area (umatriculeret areal).",
                "payload": {"uma": "UMA id"},
            },
            "tingly_tingbogsattest_historic": {
                "route": "/api/v2/tinglysning/tingbogsattest/historic/{uuid}",
                "method": "GET",
                "name": "Historic Claims By UUID",
                "description": "Historic claims for a tingbogsattest UUID.",
                "payload": {"uuid": "Document UUID"},
            },
            "tingly_ogsaalystpaa": {
                "route": "/api/v2/tinglysning/ogsaalystpaa",
                "method": "GET",
                "name": "Også Lyst På",
                "description": "Also registered on (cross-registrations).",
                "payload": {},  # query params
            },
            "tingly_esr_number": {
                "route": "/api/v2/tinglysning/property/search/esr-number/{municipality_code}/{property_number}",
                "method": "GET",
                "name": "Tinglysning Search by Municipality ESR",
                "description": "Search by municipality/property number.",
                "payload": {"municipality_code": "Municipality code", "property_number": "Property number"},
            },

            # ---------- Tinglysning - Køretøj ----------
            "tingly_vehicle_id": {
                "route": "/api/v2/tinglysning/vehicle/search/id/{id}",
                "method": "GET",
                "name": "Search Vehicle By ID",
                "description": "Find vehicle by ID.",
                "payload": {"id": "Vehicle id"},
            },
            "tingly_vehicle_cvr": {
                "route": "/api/v2/tinglysning/vehicle/search/cvr-number/{cvr_number}",
                "method": "GET",
                "name": "Search Vehicle By CVR",
                "description": "Find vehicles by company CVR.",
                "payload": {"cvr_number": "CVR number"},
            },
            "tingly_vehicle_person": {
                "route": "/api/v2/tinglysning/vehicle/search/person",
                "method": "GET",
                "name": "Search Vehicle By Person",
                "description": "Find vehicles by person.",
                "payload": {"query": "person query (query param)"},
            },
            "tingly_bilbogsattest": {
                "route": "/api/v2/tinglysning/bilbogsattest/{uuid}",
                "method": "GET",
                "name": "Bilbogsattest By UUID",
                "description": "Fetch bilbogsattest metadata by UUID.",
                "payload": {"uuid": "Document UUID"},
            },

            # ---------- Tinglysning - Person/Virksomhed ----------
            "tingly_company_cvr": {
                "route": "/api/v2/tinglysning/company/search/cvr-number/{cvr_number}",
                "method": "GET",
                "name": "Search Company By CVR",
                "description": "Find company by CVR in tinglysning.",
                "payload": {"cvr_number": "CVR number"},
            },
            "tingly_person_name": {
                "route": "/api/v2/tinglysning/person/search/name",
                "method": "GET",
                "name": "Search Person By Name",
                "description": "Find person by name in tinglysning.",
                "payload": {"query": "name (query param)"},
            },
            "tingly_person_cpr": {
                "route": "/api/v2/tinglysning/person/search/cpr-number/{cpr_number}",
                "method": "GET",
                "name": "Search Person By CPR",
                "description": "Find person by CPR in tinglysning.",
                "payload": {"cpr_number": "CPR number"},
            },
            "tingly_person_company_by_uuid": {
                "route": "/api/v2/tinglysning/person-company/{uuid}",
                "method": "GET",
                "name": "Person Company By UUID",
                "description": "Get person/company record by UUID.",
                "payload": {"uuid": "UUID"},
            },

            # ---------- Tinglysning - Virksomhed ----------
            "tingly_company_registrations": {
                "route": "/api/v2/tinglysning/companies/registrations/{cvr_number}",
                "method": "GET",
                "name": "Company Registrations",
                "description": "Search company registrations.",
                "payload": {"cvr_number": "CVR number"},
            },
            "tingly_company_documents": {
                "route": "/api/v2/tinglysning/companies/documents/{cvr_number}",
                "method": "GET",
                "name": "Company Documents",
                "description": "Search company documents.",
                "payload": {"cvr_number": "CVR number"},
            },

            # ---------- Tinglysning - ATD / Påtegning ----------
            "tingly_atd_by_aliasid": {
                "route": "/api/v2/tinglysning/atd/aliasid/{alias_id}",
                "method": "GET",
                "name": "ATD by Alias ID",
                "description": "Aktuelt Tinglyst Dokument by alias id.",
                "payload": {"alias_id": "Alias id"},
            },
            "tingly_paategning_by_aliasid": {
                "route": "/api/v2/tinglysning/paategning/aliasid/{alias_id}",
                "method": "GET",
                "name": "Påtegninger by Alias ID",
                "description": "Annotations by alias id.",
                "payload": {"alias_id": "Alias id"},
            },
            "tingly_paategning_by_uuid": {
                "route": "/api/v2/tinglysning/paategning/uuid/{uuid}",
                "method": "GET",
                "name": "Påtegninger by UUID",
                "description": "Annotations by UUID.",
                "payload": {"uuid": "UUID"},
            },

            # ---------- Tinglysning - Changes ----------
            "tingly_changes_properties": {
                "route": "/api/v2/tinglysning/changes/properties",
                "method": "GET",
                "name": "Changes (Properties)",
                "description": "Change events for properties.",
                "payload": {},  # use query params (from/to, etc.)
            },
            "tingly_changes_vehicles": {
                "route": "/api/v2/tinglysning/changes/vehicles",
                "method": "GET",
                "name": "Changes (Vehicles)",
                "description": "Change events for vehicles.",
                "payload": {},
            },
            "tingly_changes_person_company": {
                "route": "/api/v2/tinglysning/changes/person-company",
                "method": "GET",
                "name": "Changes (Person/Company)",
                "description": "Change events for person/company.",
                "payload": {},
            },
            "tingly_changes_andelsbolig": {
                "route": "/api/v2/tinglysning/changes/andelsbolig",
                "method": "GET",
                "name": "Changes (Andelsbolig)",
                "description": "Change events for andelsbolig.",
                "payload": {},
            },

            # ---------- Tinglysning - Downloads ----------
            "tingly_download_andelsboligattest": {
                "route": "/api/v2/tinglysning/download/andelsboligattest/{uuid}",
                "method": "GET",
                "name": "Download Andelsboligattest",
                "description": "Download andelsboligattest PDF.",
                "payload": {"uuid": "Document UUID"},
            },
            "tingly_download_bilbogsattest": {
                "route": "/api/v2/tinglysning/download/bilbogsattest/{uuid}",
                "method": "GET",
                "name": "Download Bilbogsattest",
                "description": "Download bilbogsattest PDF.",
                "payload": {"uuid": "Document UUID"},
            },
            "tingly_download_personbogsattest": {
                "route": "/api/v2/tinglysning/download/personbogsattest/{uuid}",
                "method": "GET",
                "name": "Download Personbogsattest",
                "description": "Download personbogsattest PDF.",
                "payload": {"uuid": "Document UUID"},
            },
            "tingly_download_atd": {
                "route": "/api/v2/tinglysning/download/atd/{uuid}",
                "method": "GET",
                "name": "Download ATD",
                "description": "Download ATD PDF.",
                "payload": {"uuid": "Document UUID"},
            },
            "tingly_download_dokumentanmeldelse": {
                "route": "/api/v2/tinglysning/download/dokumentanmeldelse/{document_uuid}/{report_uuid}",
                "method": "GET",
                "name": "Download Dokumentanmeldelse",
                "description": "Download document filing report.",
                "payload": {"document_uuid": "Document UUID", "report_uuid": "Report UUID"},
            },
            "tingly_download_akt": {
                "route": "/api/v2/tinglysning/download/akt/{uuid}",
                "method": "GET",
                "name": "Download Akt",
                "description": "Download ACT (case file) PDF.",
                "payload": {"uuid": "UUID"},
            },
            "tingly_download_annex": {
                "route": "/api/v2/tinglysning/download/annex/{uuid}",
                "method": "GET",
                "name": "Download Annex",
                "description": "Download annex PDF.",
                "payload": {"uuid": "UUID"},
            },
            "tingly_convert_pdf_to_akt": {
                "route": "/api/v2/tinglysning/convert/{pdf_id}",
                "method": "GET",
                "name": "Convert PDF ID to AKT UUID",
                "description": "Convert PDF id to AKT UUID.",
                "payload": {"pdf_id": "PDF id"},
            },

            # ---------- Minutes ----------
            "minutes_meeting": {
                "route": "/api/v2/minutes/meetings/{id}",
                "method": "GET",
                "name": "Minutes Meeting",
                "description": "Fetch a meeting by id.",
                "payload": {"id": "meeting id"},
            },
            "minutes_appendix": {
                "route": "/api/v2/minutes/appendices/{id}",
                "method": "GET",
                "name": "Minutes Appendix",
                "description": "Fetch appendix by id.",
                "payload": {"id": "appendix id"},
            },
            "minutes_appendices": {
                "route": "/api/v2/minutes/appendices",
                "method": "GET",
                "name": "Minutes Appendices",
                "description": "List/search appendices.",
                "payload": {},  # filters as query
            },
            "minutes_sections_list": {
                "route": "/api/v2/minutes/sections",
                "method": "GET",
                "name": "Minutes Sections",
                "description": "List/search sections by cases.",
                "payload": {},  # filters as query
            },
            "minutes_section_presign": {
                "route": "/api/v2/minutes/sections/{id}/presign",
                "method": "GET",
                "name": "Minutes Section Presign",
                "description": "Presigned URL for section download.",
                "payload": {"id": "section id"},
            },
            "minutes_appendix_download": {
                "route": "/api/v2/minutes/appendices/{id}/download",
                "method": "GET",
                "name": "Download Minutes Appendix",
                "description": "Download appendix file.",
                "payload": {"id": "appendix id"},
            },
            "minutes_section_download": {
                "route": "/api/v2/minutes/sections/{id}/download",
                "method": "GET",
                "name": "Download Minutes Section",
                "description": "Download section file.",
                "payload": {"id": "section id"},
            },
            "minutes_cases": {
                "route": "/api/v2/minutes/cases",
                "method": "GET",
                "name": "Minutes Cases",
                "description": "List/search minutes cases.",
                "payload": {},  # filters as query
            },

            # ---------- Listings ----------
            "listings": {
                "route": "/api/v2/listings",
                "method": "GET",
                "name": "Listings",
                "description": "List/search property listings.",
                "payload": {},  # filters as query
            },
            "listings_advanced": {
                "route": "/api/v2/listings",
                "method": "POST",
                "name": "Listings Advanced",
                "description": "Advanced listings search (POST).",
                "payload": {},  # body with filters
            },
            "listings_timeline": {
                "route": "/api/v2/listings/{bfe_number}/timeline",
                "method": "GET",
                "name": "Listings Timeline",
                "description": "Timeline for listings on a property.",
                "payload": {"bfe_number": "BFE number (required)"},
            },

            # ---------- Teledata (118) ----------
            "teledata_whatwhere": {
                "route": "/api/v2/teledata/whatwhere",
                "method": "GET",
                "name": "Teledata What/Where",
                "description": "What/Where lookup.",
                "payload": {"query": "search string (query param)"},
            },
            "teledata_search": {
                "route": "/api/v2/teledata/search",
                "method": "GET",
                "name": "Teledata Search",
                "description": "General teledata search.",
                "payload": {"query": "search string (query param)"},
            },
            "teledata_city": {
                "route": "/api/v2/teledata/city",
                "method": "GET",
                "name": "Teledata City List",
                "description": "List of cities.",
                "payload": {},
            },
            "teledata_by_address_id": {
                "route": "/api/v2/teledata/addresses/{address_id}",
                "method": "GET",
                "name": "Teledata By Address ID",
                "description": "Teledata record by address id.",
                "payload": {"address_id": "Address id"},
            },
            "teledata_by_person_id": {
                "route": "/api/v2/teledata/persons/{person_id}",
                "method": "GET",
                "name": "Teledata By Person ID",
                "description": "Teledata record by person id.",
                "payload": {"person_id": "Person id"},
            },
            "teledata_by_phone": {
                "route": "/api/v2/teledata/phone/{phone_number}",
                "method": "GET",
                "name": "Teledata By Phone Number",
                "description": "Teledata record by phone number.",
                "payload": {"phone_number": "Phone number"},
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
