from google import genai
from google.genai import types
from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import os
from PyPDF2 import PdfReader
import requests
import json
from sqlalchemy import create_engine, Column, Integer, String, Text, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.sql import select
from typing import Dict, Optional
import hashlib

# --- Google GenAI Client ---
client = genai.Client(
    api_key='AIzaSyDB62WmKwIcT83Q9CsFw6PcYhJVHhwg7oU', 
    http_options=types.HttpOptions(api_version='v1alpha')
)

# --- Database Setup (SQLAlchemy) ---
DATABASE_URL = "sqlite:///./feedback.db" 
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class TextFeedback(Base):
    __tablename__ = "text_feedback"

    id = Column(Integer, primary_key=True, index=True)
    text = Column(String, unique=True, index=True)
    type = Column(String, nullable=True)  # 'up', 'down', or None
    comment = Column(Text, nullable=True)  # Column for storing comments
    __table_args__ = (UniqueConstraint('text'),)

def create_db_and_tables():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Function to load content from different file types ---
def load_document_content(filepath):
    try:
        if filepath.endswith(".pdf"):
            text = ""
            with open(filepath, 'rb') as pdf_file:
                pdf_reader = PdfReader(pdf_file)
                for page in pdf_reader.pages:
                    text += page.extract_text() + "\n"
            return text
        elif filepath.endswith(".txt") or filepath.endswith(".md"):
            with open(filepath, 'r', encoding='utf-8') as f:
                return f.read()
        elif filepath.startswith("http://") or filepath.startswith("https://"):
            response = requests.get(filepath)
            response.raise_for_status()
            return response.text
        else:
            return f"Unsupported file type: {filepath}"
    except Exception as e:
        return f"Error loading {filepath}: {str(e)}"

# --- Load all grounding data ---
def load_grounding_data(source_files):
    all_content = ""
    for file in source_files:
        content = load_document_content(file)
        all_content += f"[Content from: {os.path.basename(file)}]\n{content}\n\n"
    return all_content

app = FastAPI()

# Enable CORS 
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Models ---
class JustifyRequest(BaseModel):
    selection: str

class FeedbackRequest(BaseModel):
    text: str
    type: Optional[str] = None  # 'up', 'down', or None
    comment: Optional[str] = None  # New field for comments

# Request model
class JustifyRequest(BaseModel):
    selection: str

# Simple in-memory cache
justification_cache: Dict[str, str] = {}

# Helper function to create hash key for caching
def get_cache_key(selection: str) -> str:
    return hashlib.sha256(selection.encode()).hexdigest()

# --- FastAPI Endpoints ---
@app.on_event("startup")
def startup_event():
    create_db_and_tables()

@app.post("/api/justify")
async def justify(request: JustifyRequest):
    selection = request.selection
    cache_key = get_cache_key(selection)

    # Check if justification is already cached
    if cache_key in justification_cache:
        return {"justification": justification_cache[cache_key]}

    source_files = [
        "documents/1_History_of_Small_Wildfires.md",
        "documents/2_History_of_Medium_Wildfires.md",
        "documents/3_History_of_Large_Wildfires.md",
        "documents/4_Major_Cities_and_Effects.md",
        "documents/5_Monetary_Impact.md"
    ]

    grounding_data = load_grounding_data(source_files)

    prompt = f"""Justify the following statement based on the provided documents:

Statement: "{selection}"

Documents:
{grounding_data}

Provide a concise justification, citing the relevant parts of the documents if possible.
"""

    try:
        response = client.models.generate_content(
            model='gemini-2.0-flash-001', contents=prompt
        )
        justification = response.text
        justification_cache[cache_key] = justification  # Save to cache
        return {"justification": justification}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
@app.post("/api/feedback/")
async def submit_feedback(request: FeedbackRequest, db=Depends(get_db)):
    # Validate feedback type if provided
    if request.type is not None and request.type not in ["up", "down"]:
        raise HTTPException(status_code=400, detail="Invalid feedback type")

    # Check if we have a record for this text already
    db_feedback = db.query(TextFeedback).filter(TextFeedback.text == request.text).first()

    if db_feedback:
        # Update existing record
        if request.type is not None:
            db_feedback.type = request.type
        if request.comment is not None:
            db_feedback.comment = request.comment
    else:
        # Create new record
        db_feedback = TextFeedback(
            text=request.text,
            type=request.type,
            comment=request.comment
        )
        db.add(db_feedback)

    db.commit()
    db.refresh(db_feedback)
    
    return {
        "message": "Feedback recorded", 
        "feedback": {
            "text": db_feedback.text, 
            "type": db_feedback.type,
            "comment": db_feedback.comment
        }
    }

@app.get("/api/feedback/")
async def get_feedback(db=Depends(get_db)):
    feedback_list = db.query(TextFeedback).all()
    
    # Prepare response with separate maps for feedback types and comments
    feedback_map = {}
    comments_map = {}
    
    for feedback in feedback_list:
        # Add to feedback map if type exists
        if feedback.type:
            feedback_map[feedback.text] = feedback.type
            
        # Add to comments map if comment exists
        if feedback.comment:
            comments_map[feedback.text] = feedback.comment
    
    return {"feedback": feedback_map, "comments": comments_map}