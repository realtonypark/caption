# Caption

A browser-only reading demo built with React, TypeScript, Vite, and Tailwind CSS.

- **Library** is the default page. Three original sample readings appear as books. A web link or PDF opens a preview using sample text.
- **Reading Session** supports passage selection, highlights, personal notes, and clearly labeled sample AI responses. AI and notes sit in the right margin on desktop and below the article on smaller screens.
- **Notepad** collects insights by reading source. Open the original passage to edit a personal note.

The library and insights are saved in this browser. This demo does not fetch articles, parse PDFs, call AI services, or connect to a backend.

## Development

```sh
npm ci
npm run dev
```

## Validation

```sh
npm run build
npm run lint
npx vitest run
```

Caveat is bundled locally under the SIL Open Font License. Titles use Caveat; body text uses system fonts. Book motion respects reduced-motion preferences.

Domain rules are documented in [src/reading.md](src/reading.md).
