import json
import os

from langchain_community.document_loaders import PyPDFLoader
from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings
from langchain.docstore.document import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.const.const import FILE_PATH, API_MODEL
from langchain.chat_models import init_chat_model


EMBEDDING_MODEL = "text-embedding-3-small"
embedding_function = OpenAIEmbeddings( model=EMBEDDING_MODEL)




def load_text_file(file_path: str):
    loader = PyPDFLoader(file_path)
    pages = loader.load()

    lines = "\n".join([p.page_content for p in pages]).splitlines()

    book_summaries = {}

    current_title, current_summary = None, []

    for line in map(str.strip, lines):
        if line.startswith("## Title:"):
            if current_title and current_summary:
                book_summaries[current_title] = " ".join(current_summary).strip()
            current_title = line.replace("## Title:", "").strip()
            current_summary = []

        elif current_title:
            if line:  # ignoră linii goale
                current_summary.append(line)

    if current_title and current_summary:
        book_summaries[current_title] = " ".join(current_summary).strip()


    file_path1 = os.path.join(os.path.dirname(__file__), "book_summaries.json")
    with open(file_path1, "w", encoding="utf-8") as f:
        json.dump(book_summaries, f, ensure_ascii=False, indent=2)

    # creează un Document per carte (fără „Title:” în text)
    docs = [
        Document(page_content=summary, metadata={"title": title})
        for title, summary in book_summaries.items()
    ]
    return docs



def initialize_vectorstore(file_path: str = FILE_PATH, vectorstore_path: str = "../vectorstore"):
    # 1 doc / carte, metadata["title"] = titlul
    docs = load_text_file(file_path)

    # Split moderat; overlap mic ca să eviți duplicatele
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=800, chunk_overlap=80, add_start_index=True
    )
    splits = splitter.split_documents(docs)

    # IMPORTANT: persist_directory ar trebui curățat când re-ingerezi,
    # altfel poți avea dubluri în index.
    return Chroma.from_documents(
        documents=splits, embedding=embedding_function, persist_directory=vectorstore_path
    )

# uvicorn app.main:app --reload
