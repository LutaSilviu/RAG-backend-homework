# Book Summaries RAG Assistant

A Python application that uses Retrieval-Augmented Generation (RAG) to answer questions about books and their summaries. It leverages LangChain, OpenAI embeddings, and Chroma vectorstore for efficient document retrieval and LLM-powered responses.

## Features

- Loads book summaries from PDF and stores them in JSON.
- Indexes summaries using vector embeddings for fast semantic search.
- Answers user questions using a language model, with context-aware responses.
- Supports image generation requests and other tools.

## Project Structure

- `app/main.py` — Application entry point.
- `app/services/` — Core logic: RAG initialization, chat, tools, and printer.
- `app/data/` — Source PDF and generated JSON summaries.
- `app/models/` — Data models for requests and questions.
- `app/router/` — API routing.
- `app/const/` — Constants and configuration.
- `app/core/` — App configuration.
- `vectorstore/` — Chroma vector database files.

## Setup

1. **Install dependencies:**
       ```
      pip install -r requirements.txt
       ```
2. **Prepare data:**
   - Place your book summaries PDF in `app/data/book_summaries.pdf`.

3. **Initialize vectorstore:**
   - Run the RAG initialization script to process and index summaries:
     ```
     python app/services/rag_init.py
     ```

4. **Start the application:**

uvicorn app.main:app --reload

## Usage

- Send questions about books or summaries to the API.
- The assistant retrieves relevant context and answers using the LLM.
- Inappropriate or unrelated questions are handled gracefully.

## Requirements

- Python 3.10+
- LangChain
- OpenAI API key (for embeddings and LLM)
- Chroma

## License

MIT
