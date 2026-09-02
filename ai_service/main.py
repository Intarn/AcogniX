from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.extraction_router import router as extraction_router
from api.chat_router import router as chat_router
from api.quiz_router import router as quiz_router
from api.flashcard_router import router as flashcard_router
from api.config_router import router as config_router

app = FastAPI(title="AcogniX AI Microservice")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_credentials=False,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


app.include_router(extraction_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(quiz_router, prefix="/api")
app.include_router(flashcard_router, prefix="/api")
app.include_router(config_router, prefix="/internal")