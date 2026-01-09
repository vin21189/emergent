from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import httpx
from emergentintegrations.llm.chat import LlmChat, UserMessage
import pandas as pd
import io

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Models
class DoctorSearchInput(BaseModel):
    name: str
    email: EmailStr
    hospital: str
    pubmed_topic: str

class DoctorSearchResult(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    hospital: str
    pubmed_topic: str
    predicted_country: str
    confidence_score: float
    sources: List[str]
    reasoning: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Services
async def search_pubmed(author_name: str, topic: str) -> dict:
    """Search PubMed for author's publications and extract affiliation data."""
    try:
        base_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
        params = {
            "db": "pubmed",
            "term": f"{author_name}[Author] AND {topic}",
            "retmode": "json",
            "retmax": 5
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            search_response = await client.get(base_url, params=params)
            search_data = search_response.json()
            
            pmids = search_data.get("esearchresult", {}).get("idlist", [])
            
            if not pmids:
                return {"affiliations": [], "found": False}
            
            # Fetch details for the articles
            fetch_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
            fetch_params = {
                "db": "pubmed",
                "id": ",".join(pmids),
                "retmode": "xml"
            }
            
            fetch_response = await client.get(fetch_url, params=fetch_params)
            
            # Extract affiliations from XML (simplified)
            affiliations = []
            if "Affiliation" in fetch_response.text or "affiliation" in fetch_response.text.lower():
                # Simple extraction - look for country patterns
                text_lower = fetch_response.text.lower()
                common_countries = [
                    "united states", "usa", "u.s.a", "china", "united kingdom", "uk",
                    "germany", "france", "japan", "canada", "australia", "india",
                    "italy", "spain", "brazil", "netherlands", "switzerland",
                    "sweden", "south korea", "singapore", "israel"
                ]
                for country in common_countries:
                    if country in text_lower:
                        affiliations.append(country.title())
            
            return {"affiliations": list(set(affiliations)), "found": True, "count": len(pmids)}
    
    except Exception as e:
        logger.error(f"PubMed search error: {e}")
        return {"affiliations": [], "found": False, "error": str(e)}

async def predict_country_with_ai(name: str, email: str, hospital: str, topic: str, pubmed_data: dict) -> dict:
    """Use AI to predict the country based on all available data."""
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        
        # Prepare context for AI
        context = f"""
Analyze the following information about a healthcare professional and predict their country of origin:

Name: {name}
Email: {email}
Hospital Affiliation: {hospital}
PubMed Research Topic: {topic}

PubMed Data:
- Found publications: {pubmed_data.get('found', False)}
- Number of publications: {pubmed_data.get('count', 0)}
- Affiliations found: {', '.join(pubmed_data.get('affiliations', [])) if pubmed_data.get('affiliations') else 'None'}

Based on:
1. Hospital name and typical naming conventions
2. Email domain patterns
3. PubMed publication affiliations
4. Research topic and regional research patterns

Provide:
1. Most likely country (just the country name)
2. Confidence score (0-100)
3. Brief reasoning (max 2 sentences)

Format your response EXACTLY as:
COUNTRY: [country name]
CONFIDENCE: [number]
REASONING: [reasoning]
"""
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"country-predict-{uuid.uuid4()}",
            system_message="You are a geographic and institutional analysis expert. Analyze healthcare professional data to predict their country accurately."
        ).with_model("openai", "gpt-5.2")
        
        message = UserMessage(text=context)
        response = await chat.send_message(message)
        
        # Parse response
        lines = response.strip().split('\n')
        country = "Unknown"
        confidence = 50.0
        reasoning = "Unable to determine with high confidence"
        
        for line in lines:
            if line.startswith("COUNTRY:"):
                country = line.replace("COUNTRY:", "").strip()
            elif line.startswith("CONFIDENCE:"):
                try:
                    confidence = float(line.replace("CONFIDENCE:", "").strip())
                except:
                    confidence = 50.0
            elif line.startswith("REASONING:"):
                reasoning = line.replace("REASONING:", "").strip()
        
        return {
            "country": country,
            "confidence": confidence,
            "reasoning": reasoning
        }
    
    except Exception as e:
        logger.error(f"AI prediction error: {e}")
        return {
            "country": "Unknown",
            "confidence": 0.0,
            "reasoning": f"Error during prediction: {str(e)}"
        }

# Routes
@api_router.get("/")
async def root():
    return {"message": "GeoMed AI - Healthcare Professional Country Predictor"}

@api_router.post("/predict-country", response_model=DoctorSearchResult)
async def predict_country(input: DoctorSearchInput):
    """Main endpoint to predict country based on doctor information."""
    try:
        # Step 1: Search PubMed
        pubmed_data = await search_pubmed(input.name, input.pubmed_topic)
        
        # Step 2: Use AI to analyze all data
        ai_prediction = await predict_country_with_ai(
            input.name,
            input.email,
            input.hospital,
            input.pubmed_topic,
            pubmed_data
        )
        
        # Step 3: Determine sources
        sources = ["AI Analysis"]
        if pubmed_data.get("found"):
            sources.append("PubMed Publications")
        if "." in input.email:
            domain = input.email.split("@")[1]
            sources.append(f"Email Domain ({domain})")
        sources.append("Hospital Name Analysis")
        
        # Create result
        result = DoctorSearchResult(
            name=input.name,
            email=input.email,
            hospital=input.hospital,
            pubmed_topic=input.pubmed_topic,
            predicted_country=ai_prediction["country"],
            confidence_score=ai_prediction["confidence"],
            sources=sources,
            reasoning=ai_prediction["reasoning"]
        )
        
        # Save to database
        doc = result.model_dump()
        doc['timestamp'] = doc['timestamp'].isoformat()
        await db.doctor_searches.insert_one(doc)
        
        return result
    
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/search-history", response_model=List[DoctorSearchResult])
async def get_search_history():
    """Get all past searches."""
    try:
        searches = await db.doctor_searches.find({}, {"_id": 0}).sort("timestamp", -1).to_list(100)
        
        for search in searches:
            if isinstance(search['timestamp'], str):
                search['timestamp'] = datetime.fromisoformat(search['timestamp'])
        
        return searches
    except Exception as e:
        logger.error(f"Error fetching history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/search-history/{search_id}", response_model=DoctorSearchResult)
async def get_search_by_id(search_id: str):
    """Get specific search result by ID."""
    try:
        search = await db.doctor_searches.find_one({"id": search_id}, {"_id": 0})
        
        if not search:
            raise HTTPException(status_code=404, detail="Search not found")
        
        if isinstance(search['timestamp'], str):
            search['timestamp'] = datetime.fromisoformat(search['timestamp'])
        
        return search
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching search: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()