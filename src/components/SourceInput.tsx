import { useEffect, useState, type FormEvent } from "react";
import {
  SOURCE_FILE_ACCEPT,
  normalizeLink,
  sourceFileKind,
  unsupportedFileMessage,
} from "../reading";
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
  const [fileError, setFileError] = useState("");
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
  const addFiles = async (files: File[]) => {
    const bad = files.find((file) => !sourceFileKind(file));
    if (bad) {
      setFileError(unsupportedFileMessage(bad.name));
      return;
    }
    setFileError("");
    setBusy(true);
    try {
      await onAdd({
        kind: "file",
        label: files.map((file) => file.name).join(", "),
        files,
      });
    } catch (error) {
      setFileError(
        error instanceof Error
          ? error.message
          : files.length > 1
            ? "Could not read these files."
            : "Could not read this file.",
      );
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      const image = Array.from(event.clipboardData?.files ?? []).find((file) =>
        file.type.startsWith("image/"),
      );
      if (!image || busy) return;
      event.preventDefault();
      void addFiles([
        new File(
          [image],
          `Screenshot ${new Date().toLocaleString()}.${image.type.split("/")[1]}`,
          { type: image.type },
        ),
      ]);
    };
    document.addEventListener("paste", paste);
    return () => document.removeEventListener("paste", paste);
  });
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
            <span>Or choose files</span>
            <input
              type="file"
              accept={SOURCE_FILE_ACCEPT}
              multiple
              disabled={busy}
              aria-label="Choose files"
              aria-invalid={!!fileError}
              aria-describedby={
                fileError ? "source-file-error source-hint" : "source-hint"
              }
              onChange={async (event) => {
                const input = event.currentTarget;
                const files = Array.from(input.files ?? []);
                if (!files.length) return;
                await addFiles(files);
                input.value = "";
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
      {fileError && (
        <p id="source-file-error" className="input-error" role="alert">
          {fileError}
        </p>
      )}
      <p id="source-hint" className="demo-hint">
        {busy
          ? "Opening your reading…"
          : "Read an article, Google Doc, PDF, Word file, text, or image. You can also paste a screenshot. Your notes stay with its source."}
      </p>
    </section>
  );
};
