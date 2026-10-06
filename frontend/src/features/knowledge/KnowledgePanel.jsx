import { useEffect, useRef, useState } from "react";
import { FileText, Trash2, Upload } from "lucide-react";

import {
  deleteKnowledgeDocument,
  getKnowledgeDocuments,
  uploadKnowledgeDocument,
} from "../../api";

function KnowledgePanel({ theme, isLoggedIn }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const inputRef = useRef(null);

  const loadDocuments = async () => {
    if (!isLoggedIn) return;
    setLoading(true);
    try {
      const response = await getKnowledgeDocuments();
      setDocuments(response.data?.documents || []);
    } catch {
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [isLoggedIn]);

  const onUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setMessage("");
    setUploading(true);
    try {
      const response = await uploadKnowledgeDocument(file);
      setMessage(`Indexed ${response.data?.chunks || 0} chunks.`);
      await loadDocuments();
    } catch (error) {
      const detail = error?.response?.data?.detail;
      setMessage(detail || "Could not index this document.");
    } finally {
      setUploading(false);
    }
  };

  const onDelete = async (documentId) => {
    try {
      await deleteKnowledgeDocument(documentId);
      await loadDocuments();
    } catch {
      setMessage("Could not delete the document.");
    }
  };

  if (!isLoggedIn) return null;

  const shellClass =
    theme === "light"
      ? "border-slate-300 bg-white text-slate-900"
      : "border-slate-800 bg-slate-950/70 text-slate-100";

  return (
    <div className={`mt-4 rounded-xl border p-3 ${shellClass}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Knowledge Base</p>
          <p className="text-[11px] opacity-65">
            Upload project docs to ground AI reviews with relevant context.
          </p>
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-lg border px-3 py-2 text-xs font-medium"
        >
          <Upload className="mr-1 inline h-3.5 w-3.5" />
          {uploading ? "Indexing..." : "Upload"}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.md,.txt"
          onChange={onUpload}
          className="hidden"
        />
      </div>

      {message && <p className="mt-2 text-[11px] opacity-70">{message}</p>}

      <div className="mt-3 space-y-2">
        {loading ? (
          <p className="text-xs opacity-60">Loading knowledge base...</p>
        ) : documents.length === 0 ? (
          <p className="text-xs opacity-60">No documents indexed yet.</p>
        ) : (
          documents.map((document) => (
            <div
              key={document.document_id}
              className="flex items-center justify-between gap-2 rounded-lg border border-slate-700/70 px-2.5 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">
                  <FileText className="mr-1 inline h-3.5 w-3.5" />
                  {document.title}
                </p>
                <p className="text-[10px] opacity-55">
                  {document.chunks} chunks
                </p>
              </div>

              <button
                type="button"
                onClick={() => onDelete(document.document_id)}
                className="rounded p-1.5 opacity-70 hover:opacity-100"
                aria-label={`Delete ${document.title}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default KnowledgePanel;
