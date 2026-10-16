# Reading demo rules

`reading.ts` owns source models, sample content, passage anchors, library merge rules, and saved insights.

- The initial library has three original sample readings.
- Public URLs import actual article text through the server. PDF text and OCR are extracted in the browser. Plain-text files import directly. Figures import as image paragraphs; oversized figures are omitted and counted in the description. Import failures never add sample text in place of the requested source.
- Web links accept HTTP(S) URLs and bare hosts, including numeric ports. Bare hosts default to HTTPS; other schemes are rejected.
- A book design is assigned once when a source is added and stored with that source.
- A passage consists of exact character ranges in one or more paragraphs.
- Highlighting, asking, and writing a note on the same passage update one insight. Each new question starts a separate answer thread; follow-ups stay in that thread. Separate readings never share insights.
- Overlapping highlighted text opens the insight with the narrowest containing range. Equal-length ranges keep their saved order.
- New highlights use yellow. Adding a personal note also highlights its passage. Removing a highlight removes its personal note but preserves answer threads. Removing the last remaining content removes the insight. Saved colors from older versions remain visible.
- AI replies stream from the selected model or its router fallback and cite valid source paragraphs. Follow-ups retain their thread history. Interrupted answers retain their question and partial text and can be retried. Web search is disabled; answers use the source text and thread history.
- Personal-note drafts save on Enter or an outside click. Shift+Enter adds a line; Escape discards the draft.
- Escape leaves the whole-text question bar and keeps its unfinished question for the next visit to the input. Escape during IME composition does not close an editor or move focus.
- Older saved insights retain their highlight and note context when new fields are absent.
- Notepad displays insights grouped by reading. Personal notes are edited in the reader.
- Browser storage is optional. Storage failures are reported and in-memory work remains available.
