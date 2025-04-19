# database.py
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

# If you have other DB setup details, you can add them here
def init_db(app):
    app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://username:password@localhost/yourdatabase'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)