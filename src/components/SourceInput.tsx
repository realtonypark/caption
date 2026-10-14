import { useState, type FormEvent } from "react";
import { normalizeLink } from "../reading";
import { Icon } from "./Icon";
export const SourceInput = ({
  onAdd,
}: {
  onAdd: (kind: "link" | "pdf", label: string) => void;
}) => {
  const [link, setLink] = useState("");
  const [linkError, setLinkError] = useState("");
  const [pdfError, setPdfError] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    try {
      const url = normalizeLink(link);
      setLinkError("");
      onAdd("link", url);
    } catch (reason) {
      setLinkError(
        reason instanceof Error ? reason.message : "Enter a valid web link.",
      );
    }
  };
  return (
    <section
      className="source-section text-center"
      aria-labelledby="source-title"
    >
      <h1 id="source-title">What are we reading?</h1>
      <form className="source-input" onSubmit={submit}>
        <div className="source-link-row flex items-center gap-4">
          <Icon name="link" />
          <label htmlFor="source-link" className="sr-only">
            Web link
          </label>
          <input
            id="source-link"
            type="text"
            inputMode="url"
            autoComplete="url"
            value={link}
            onChange={(event) => setLink(event.target.value)}
            placeholder="Paste a link to read"
            aria-invalid={!!linkError}
            aria-describedby={
              linkError ? "source-link-error source-hint" : "source-hint"
            }
            required
          />
          <button className="open-link" type="submit" aria-label="Open link">
            <Icon name="arrow" />
          </button>
        </div>
        <div className="source-file-row flex items-center justify-between">
          <label className="file-picker flex items-center gap-2">
            <Icon name="file" />
            <span>Or choose a PDF</span>
            <input
              type="file"
              accept=".pdf,application/pdf"
              aria-label="Choose a PDF"
              aria-invalid={!!pdfError}
              aria-describedby={
                pdfError ? "source-pdf-error source-hint" : "source-hint"
              }
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (!/\.pdf$/i.test(file.name)) {
                  setPdfError("Choose a PDF file.");
                  event.target.value = "";
                  return;
                }
                setPdfError("");
                onAdd("pdf", file.name);
              }}
            />
          </label>
          <span className="source-whisper">One place for every page.</span>
        </div>
      </form>
      {linkError && (
        <p id="source-link-error" className="input-error" role="alert">
          {linkError}
        </p>
      )}
      {pdfError && (
        <p id="source-pdf-error" className="input-error" role="alert">
          {pdfError}
        </p>
      )}
      <p id="source-hint" className="demo-hint">
        Links and PDFs open sample text in this demo.
      </p>
    </section>
  );
};
