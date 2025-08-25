import os

from fastapi import FastAPI
from langchain_chroma import Chroma
from starlette.middleware.cors import CORSMiddleware

from app.router.router import router

vector_store = None


# Initialize the vectorstore when the application starts
# check if the vectorstore is already initialized
from app.services.rag_init import initialize_vectorstore, embedding_function, load_text_file

vector_store_path = "vectorstore"
app = FastAPI()
if os.path.exists(vector_store_path):
    print("Vectorstore already exists, skipping initialization.")
    app.state.vector_store = Chroma(persist_directory=vector_store_path, embedding_function=embedding_function)
else:
    print("Initializing vectorstore...")
    # Initialize the vectorstore
    # This will load the PDF file, split it into chunks, and create a vectorstore
    app.state.vector_store = initialize_vectorstore('app/data/book_summaries.pdf',vector_store_path)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api", tags=["api"])