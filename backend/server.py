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
    city: Optional[str] = None
    confidence_score: float
    sources: List[str]
    reasoning: Optional[str] = None
    is_doctor: bool = True
    specialty: Optional[str] = None
    public_profile_url: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BatchUploadResult(BaseModel):
    total_processed: int
    successful: int
    failed: int
    results: List[DoctorSearchResult]
    errors: List[dict]

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
Analyze the following information about a healthcare professional and provide detailed insights:

Name: {name}
Email: {email}
Hospital Affiliation: {hospital}
PubMed Research Topic: {topic}

PubMed Data:
- Found publications: {pubmed_data.get('found', False)}
- Number of publications: {pubmed_data.get('count', 0)}
- Affiliations found: {', '.join(pubmed_data.get('affiliations', [])) if pubmed_data.get('affiliations') else 'None'}

Based on the above information, provide:

1. **Country**: Most likely country. IMPORTANT: If UK/United Kingdom, specify the constituent country:
   - England (if in London, Manchester, Birmingham, Oxford, Cambridge, etc.)
   - Scotland (if in Edinburgh, Glasgow, Aberdeen, etc.)
   - Wales (if in Cardiff, Swansea, etc.)
   - Northern Ireland (if in Belfast, etc.)
   For other countries, provide the country name as normal (e.g., "United States", "Japan", "Germany")

2. **City**: If identifiable from hospital name or email, specify the city (e.g., "London", "Edinburgh", "Manchester"). If not identifiable, respond with "Not specified"

3. **Confidence**: Confidence score (0-100)

4. **Reasoning**: Brief reasoning for location prediction (max 2 sentences)

5. **Is Doctor**: Whether this person is a medical doctor (yes/no). Consider:
   - Name prefix (Dr., MD, Prof., etc.)
   - Hospital affiliation
   - Medical research publications
   - Medical specialty keywords

6. **Specialty**: Medical specialty if identifiable (e.g., Cardiology, Oncology, Neuroscience, Endocrinology, Pediatrics, etc.). Use "General Practice" if unclear. Use the PubMed topic and research area to determine specialty.

7. **Profile URL**: If you can infer a likely public profile URL (e.g., hospital staff page, LinkedIn, ResearchGate, Google Scholar), provide it. Format should be a realistic URL pattern like:
   - Hospital staff directory: https://[hospital-domain]/staff/[name]
   - Google Scholar: https://scholar.google.com/citations?user=[suggest searching]
   - ResearchGate: https://www.researchgate.net/profile/[Name]
   If unsure, respond with "Not found"

Format your response EXACTLY as:
COUNTRY: [country name - e.g., "England" not "United Kingdom" if in England]
CITY: [city name or "Not specified"]
CONFIDENCE: [number]
REASONING: [reasoning]
IS_DOCTOR: [yes/no]
SPECIALTY: [specialty name]
PROFILE_URL: [URL or "Not found"]
"""
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"country-predict-{uuid.uuid4()}",
            system_message="You are a medical professional analyzer and geographic expert. When analyzing UK-based professionals, always specify the constituent country (England, Scotland, Wales, or Northern Ireland) rather than just 'United Kingdom'. Analyze healthcare professional data to predict their specific location, verify medical credentials, identify specialties, and suggest profile URLs accurately."
        ).with_model("openai", "gpt-5.2")
        
        message = UserMessage(text=context)
        response = await chat.send_message(message)
        
        # Parse response
        lines = response.strip().split('\n')
        country = "Unknown"
        city = None
        confidence = 50.0
        reasoning = "Unable to determine with high confidence"
        is_doctor = True
        specialty = None
        profile_url = None
        
        for line in lines:
            if line.startswith("COUNTRY:"):
                country = line.replace("COUNTRY:", "").strip()
            elif line.startswith("CITY:"):
                city = line.replace("CITY:", "").strip()
                if city.lower() in ['not specified', 'unknown', 'n/a', '']:
                    city = None
            elif line.startswith("CONFIDENCE:"):
                try:
                    confidence = float(line.replace("CONFIDENCE:", "").strip())
                except:
                    confidence = 50.0
            elif line.startswith("REASONING:"):
                reasoning = line.replace("REASONING:", "").strip()
            elif line.startswith("IS_DOCTOR:"):
                is_doctor_str = line.replace("IS_DOCTOR:", "").strip().lower()
                is_doctor = is_doctor_str in ['yes', 'true', 'y']
            elif line.startswith("SPECIALTY:"):
                specialty = line.replace("SPECIALTY:", "").strip()
                if specialty.lower() in ['none', 'unknown', 'n/a', '']:
                    specialty = None
            elif line.startswith("PROFILE_URL:"):
                profile_url = line.replace("PROFILE_URL:", "").strip()
                if profile_url.lower() in ['not found', 'none', 'unknown', 'n/a', '']:
                    profile_url = None
        
        return {
            "country": country,
            "city": city,
            "confidence": confidence,
            "reasoning": reasoning,
            "is_doctor": is_doctor,
            "specialty": specialty,
            "profile_url": profile_url
        }
    
    except Exception as e:
        logger.error(f"AI prediction error: {e}")
        return {
            "country": "Unknown",
            "city": None,
            "confidence": 0.0,
            "reasoning": f"Error during prediction: {str(e)}",
            "is_doctor": True,
            "specialty": None,
            "profile_url": None
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
            city=ai_prediction.get("city"),
            confidence_score=ai_prediction["confidence"],
            sources=sources,
            reasoning=ai_prediction["reasoning"],
            is_doctor=ai_prediction.get("is_doctor", True),
            specialty=ai_prediction.get("specialty"),
            public_profile_url=ai_prediction.get("profile_url")
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

@api_router.get("/export-history-excel")
async def export_history_excel():
    """Export search history as Excel file with all details."""
    try:
        from fastapi.responses import StreamingResponse
        
        # Fetch all searches
        searches = await db.doctor_searches.find({}, {"_id": 0}).sort("timestamp", -1).to_list(1000)
        
        if not searches:
            raise HTTPException(status_code=404, detail="No search history found")
        
        # Prepare data for Excel
        data = []
        for search in searches:
            data.append({
                'Name': search.get('name', ''),
                'Email': search.get('email', ''),
                'Hospital Affiliation': search.get('hospital', ''),
                'PubMed Topic': search.get('pubmed_topic', ''),
                'Predicted Country': search.get('predicted_country', ''),
                'Confidence Score (%)': search.get('confidence_score', 0),
                'Is Medical Doctor': 'Yes' if search.get('is_doctor', True) else 'No',
                'Specialty': search.get('specialty', 'Not specified'),
                'Public Profile URL': search.get('public_profile_url', 'Not available'),
                'Reasoning': search.get('reasoning', ''),
                'Data Sources': ', '.join(search.get('sources', [])),
                'Date': search.get('timestamp', '')
            })
        
        # Create DataFrame
        df = pd.DataFrame(data)
        
        # Create Excel file in memory
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='HCP Search History', index=False)
            
            # Auto-adjust column widths
            worksheet = writer.sheets['HCP Search History']
            for column in worksheet.columns:
                max_length = 0
                column_letter = column[0].column_letter
                for cell in column:
                    try:
                        if len(str(cell.value)) > max_length:
                            max_length = len(str(cell.value))
                    except:
                        pass
                adjusted_width = min(max_length + 2, 50)
                worksheet.column_dimensions[column_letter].width = adjusted_width
        
        output.seek(0)
        
        # Generate filename with timestamp
        timestamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
        filename = f"geomed_hcp_history_{timestamp}.xlsx"
        
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Excel export error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/batch-upload", response_model=BatchUploadResult)
async def batch_upload(file: UploadFile = File(...)):
    """Upload Excel file with multiple doctor records for batch processing."""
    try:
        # Validate file type
        if not file.filename.endswith(('.xlsx', '.xls')):
            raise HTTPException(status_code=400, detail="Only Excel files (.xlsx, .xls) are supported")
        
        # Read Excel file
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        
        # Validate required columns
        required_columns = ['Firstname', 'Lastname', 'Email ID', 'Hospital Affiliation', 'PubMed Article Title']
        missing_columns = [col for col in required_columns if col not in df.columns]
        
        if missing_columns:
            raise HTTPException(
                status_code=400, 
                detail=f"Missing required columns: {', '.join(missing_columns)}"
            )
        
        results = []
        errors = []
        successful = 0
        
        # Process each row
        for idx, row in df.iterrows():
            try:
                # Combine first and last name
                full_name = f"{row['Firstname']} {row['Lastname']}".strip()
                email = str(row['Email ID']).strip()
                hospital = str(row['Hospital Affiliation']).strip()
                pubmed_topic = str(row['PubMed Article Title']).strip()
                
                # Skip empty rows
                if not full_name or not email or not hospital or not pubmed_topic:
                    errors.append({
                        "row": idx + 2,  # +2 for 1-based index and header
                        "error": "Empty fields detected"
                    })
                    continue
                
                # Search PubMed
                pubmed_data = await search_pubmed(full_name, pubmed_topic)
                
                # Use AI to predict
                ai_prediction = await predict_country_with_ai(
                    full_name,
                    email,
                    hospital,
                    pubmed_topic,
                    pubmed_data
                )
                
                # Determine sources
                sources = ["AI Analysis"]
                if pubmed_data.get("found"):
                    sources.append("PubMed Publications")
                if "@" in email and "." in email:
                    domain = email.split("@")[1]
                    sources.append(f"Email Domain ({domain})")
                sources.append("Hospital Name Analysis")
                
                # Create result
                result = DoctorSearchResult(
                    name=full_name,
                    email=email,
                    hospital=hospital,
                    pubmed_topic=pubmed_topic,
                    predicted_country=ai_prediction["country"],
                    city=ai_prediction.get("city"),
                    confidence_score=ai_prediction["confidence"],
                    sources=sources,
                    reasoning=ai_prediction["reasoning"],
                    is_doctor=ai_prediction.get("is_doctor", True),
                    specialty=ai_prediction.get("specialty"),
                    public_profile_url=ai_prediction.get("profile_url")
                )
                
                # Save to database
                doc = result.model_dump()
                doc['timestamp'] = doc['timestamp'].isoformat()
                await db.doctor_searches.insert_one(doc)
                
                results.append(result)
                successful += 1
                
            except Exception as e:
                logger.error(f"Error processing row {idx + 2}: {e}")
                errors.append({
                    "row": idx + 2,
                    "error": str(e)
                })
        
        return BatchUploadResult(
            total_processed=len(df),
            successful=successful,
            failed=len(errors),
            results=results,
            errors=errors
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Batch upload error: {e}")
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