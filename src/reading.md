# Reading demo rules

`reading.ts` owns source models, sample content, preview creation, passage anchors, and saved insights.

- The initial library has three original sample readings.
- A URL or PDF creates a preview using sample text. No source fetching, PDF parsing, or AI request occurs.
- Web links accept HTTP(S) URLs and bare hosts, including numeric ports. Bare hosts default to HTTPS; other schemes are rejected.
- A book design is assigned once when a source is added and stored with that source.
- A passage consists of exact character ranges in one or more paragraphs.
- Highlighting, asking, and writing a note on the same passage update one insight. Each new question starts a separate answer thread; follow-ups stay in that thread. Separate readings never share insights.
- Overlapping highlighted text opens the insight with the narrowest containing range. Equal-length ranges keep their saved order.
- Highlights keep their assigned yellow, green, blue, or pink color. Removing a highlight removes its personal note but preserves answer threads. Removing the last remaining content removes the insight.
- AI replies and whole-text answers are labeled sample responses and cite the relevant sample paragraphs. Web controls preview a setting; they do not search.
- Personal-note drafts save on Enter or an outside click. Shift+Enter adds a line; Escape discards the draft.
- Older saved insights retain their highlight and note context when new fields are absent.
- Notepad displays insights grouped by reading. Personal notes are edited in the reader.
- Browser storage is optional. Storage failures are reported and in-memory work remains available.
