import { useState, type FormEvent } from "react";
import { parseLink } from "../reading";
import { Icon } from "./Icon";
export const SourceInput = ({
  onAdd,
}: {
  onAdd: (kind: "link" | "pdf", label: string) => void;
}) => {
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    try {
      const url = parseLink(link);
      setError("");
      onAdd("link", url.href);
    } catch (reason) {
      setError(
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
            placeholder="Paste a link to something worth reading"
            aria-invalid={!!error}
            aria-describedby={error ? "source-error" : "source-hint"}
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
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (!/\.pdf$/i.test(file.name)) {
                  setError("Choose a PDF file.");
                  event.target.value = "";
                  return;
                }
                setError("");
                onAdd("pdf", file.name);
              }}
            />
          </label>
          <span className="source-whisper">One place for every page.</span>
        </div>
      </form>
      {error && (
        <p id="source-error" className="input-error" role="alert">
          {error}
        </p>
      )}
      <p id="source-hint" className="demo-hint">
        Links and PDFs open sample text in this demo.
      </p>
    </section>
  );
};
