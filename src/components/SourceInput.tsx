import { useState, type FormEvent } from "react";
import { normalizeLink } from "../reading";
import { Icon } from "./Icon";
export type SourceAdd =
  | { kind: "link"; label: string }
  | { kind: "file"; label: string; files: File[] };
export const SourceInput = ({
  onAdd,
}: {
  onAdd: (input: SourceAdd) => void | Promise<void>;
}) => {
  const [link, setLink] = useState("");
  const [linkError, setLinkError] = useState("");
  const [pdfError, setPdfError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const url = normalizeLink(link);
      setLinkError("");
      setBusy(true);
      await onAdd({ kind: "link", label: url });
    } catch (reason) {
      setLinkError(
        reason instanceof Error ? reason.message : "Enter a valid web link.",
      );
    } finally {
      setBusy(false);
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
            disabled={busy}
          />
          <button
            className="open-link"
            type="submit"
            aria-label="Open link"
            disabled={busy}
          >
            <Icon name="arrow" />
          </button>
        </div>
        <div className="source-file-row flex items-center justify-between">
          <label className="file-picker flex items-center gap-2">
            <Icon name="file" />
            <span>Or choose PDFs or text files</span>
            <input
              type="file"
              accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
              multiple
              disabled={busy}
              aria-label="Choose files"
              aria-invalid={!!pdfError}
              aria-describedby={
                pdfError ? "source-pdf-error source-hint" : "source-hint"
              }
              onChange={async (event) => {
                const files = Array.from(event.target.files ?? []);
                if (!files.length) return;
                if (!files.every((file) => /\.(pdf|txt|md)$/i.test(file.name))) {
                  setPdfError("Choose PDF or text files.");
                  event.target.value = "";
                  return;
                }
                setPdfError("");
                const input = event.currentTarget;
                setBusy(true);
                try {
                  await onAdd({
                    kind: "file",
                    label: files.map((file) => file.name).join(", "),
                    files,
                  });
                } catch (error) {
                  setPdfError(
                    error instanceof Error
                      ? error.message
                      : "Could not read these files.",
                  );
                } finally {
                  setBusy(false);
                  input.value = "";
                }
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
        {busy
          ? "Opening your reading…"
          : "Read a web article or PDF. Your notes stay with its source."}
      </p>
    </section>
  );
};
