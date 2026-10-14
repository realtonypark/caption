# Reading demo rules

`reading.ts` owns source models, sample content, preview creation, passage anchors, and saved insights.

- The initial library has three original sample readings.
- A URL or PDF creates a preview using sample text. No source fetching, PDF parsing, or AI request occurs.
- A book design is assigned once when a source is added and stored with that source.
- A passage consists of exact character ranges in one or more paragraphs.
- Highlighting, asking, and writing a note on the same passage update one insight. Separate readings never share insights.
- Overlapping highlighted text opens the insight with the narrowest containing range. Equal-length ranges keep their saved order.
- AI replies are labeled sample responses and cite the relevant sample paragraphs.
- Notepad displays insights grouped by reading. Personal notes are edited in the reader.
- Browser storage is optional. Storage failures are reported and in-memory work remains available.
