from pydantic import BaseModel
from sqlalchemy import Column, Integer, String
from database import db

# Pydantic Model for Request Validation
class JustifyRequest(BaseModel):
    text: str

class Feedback(BaseModel):
    text: str
    type: str  # 'thumbs_up', 'thumbs_down', 'comment'
    comment: str | None = None

# SQLAlchemy Model for Database Persistence
class FeedbackDB(db.Model):
    id = Column(Integer, primary_key=True)
    text = Column(String(500))
    type = Column(String(50))  # 'thumbs_up', 'thumbs_down', 'comment'
    comment = Column(String(500), nullable=True)

    def __init__(self, text, type, comment=None):
        self.text = text
        self.type = type
        self.comment = comment
