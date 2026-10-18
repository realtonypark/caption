# Reading demo rules

`reading.ts` owns source models, sample content, passage anchors, library merge rules, and saved insights.

- The initial library has three original sample readings.
- Public URLs import actual article text through the server. PDF text and OCR are extracted in the browser. Import failures never add sample text in place of the requested source.
- Files can be added as PDF, Word (.docx), text or Markdown, and images (PNG, JPG, WebP, BMP) including pasted screenshots. All of it is read in the browser: Word text with Mammoth, images with the same OCR used for scanned PDFs. Legacy .doc files are not supported. Word and text files become "document" readings, images become "image" readings.
- Public Google Doc links import through the server as a PDF export and are titled with the document name. Private Google files report that they need link sharing.
- Web links accept HTTP(S) URLs and bare hosts, including numeric ports. Bare hosts default to HTTPS; other schemes are rejected.
- A book design is assigned once when a source is added and stored with that source.
- A passage consists of exact character ranges in one or more paragraphs.
- Highlighting, asking, and writing a note on the same passage update one insight. Each new question starts a separate answer thread; follow-ups stay in that thread. Separate readings never share insights.
- Overlapping highlighted text opens the insight with the narrowest containing range. Equal-length ranges keep their saved order.
- New highlights use yellow. Adding a personal note also highlights its passage. Removing a highlight removes its personal note but preserves answer threads. Removing the last remaining content removes the insight. Saved colors from older versions remain visible.
- AI replies stream from the selected model or its router fallback and cite valid source paragraphs. Follow-ups retain their thread history. Interrupted answers retain their question and partial text and can be retried. Web search runs only for fact-checks; other answers use the source text and thread history.
- Personal-note drafts save on Enter or an outside click. Shift+Enter adds a line; Escape discards the draft.
- Escape leaves the whole-text question bar and keeps its unfinished question for the next visit to the input. Escape during IME composition does not close an editor or move focus.
- Older saved insights retain their highlight and note context when new fields are absent.
- Notepad displays insights grouped by reading. Personal notes are edited in the reader. Notes export as Markdown or as a PDF made in the browser; the PDF uses standard Latin fonts, so other scripts are replaced with "?" and the reader is told how many.
- Browser storage is optional. Storage failures are reported and in-memory work remains available.
