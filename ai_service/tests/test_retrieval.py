import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.context_retrieval_service import retrieve_relevant_chunks

chunks = retrieve_relevant_chunks(
    project_id="dcea2e78-0ffd-4c46-bf9b-12bcb65de983",
    query="Nhóm có bao nhiêu thành viên?",
)
for c in chunks:
    print("---")
    print(c[:200])