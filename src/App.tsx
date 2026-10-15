import { useEffect, useState } from "react";
import { Header } from "./components/Header";
import { Library } from "./components/Library";
import { Reader } from "./components/Reader";
import { Notepad } from "./components/Notepad";
import { Link } from "./components/Link";
import {
  BOOK_DESIGN_COUNT,
  makePreview,
  readingInsights,
  saveInsight,
  type LibraryState,
} from "./reading";
import { navigate, readingPath, useRoute } from "./routing";
import { readLibrary, writeLibrary } from "./storage";
import { openBook } from "./open-book";

export const App = () => {
  const [restored] = useState(readLibrary);
  const [state, setState] = useState(restored.state);
  const [warning, setWarning] = useState(restored.warning);
  const route = useRoute();
  const pathname = route.split("?")[0];
  const current =
    pathname === "/notepad"
      ? "notepad"
      : pathname.startsWith("/read/")
        ? "reading"
        : "library";
  const reading = state.readings.find(
    (item) => readingPath(item.id) === pathname,
  );
  const insightId = new URLSearchParams(route.split("?")[1]).get("insight");
  const insights = reading ? readingInsights(state, reading.id) : [];
  const initialInsight = insights.find((entry) => entry.id === insightId);
  const updateLibrary = (next: LibraryState) => {
    setState(next);
    if (!restored.warning) setWarning(writeLibrary(next));
  };
  useEffect(() => {
    document.title = `${current === "library" ? "Library" : current === "reading" ? "Reading" : "Notepad"} · Caption`;
  }, [current]);
  return (
    <div className={current === "library" ? "app app-dark" : "app app-paper"}>
      <Header current={current} />
      {warning && (
        <p className="storage-warning" role="status">
          {warning}
        </p>
      )}
      {current === "library" ? (
        <Library
          readings={state.readings}
          onOpen={(id, book) => {
            void openBook(book, () => navigate(readingPath(id)));
          }}
          onAdd={(kind, label) => {
            const reading = makePreview(
              crypto.randomUUID(),
              kind,
              label,
              Math.floor(Math.random() * BOOK_DESIGN_COUNT),
            );
            updateLibrary({ ...state, readings: [...state.readings, reading] });
            navigate(readingPath(reading.id));
          }}
        />
      ) : current === "notepad" ? (
        <Notepad state={state} />
      ) : reading ? (
        <Reader
          key={`${reading.id}:${insightId ?? ""}`}
          reading={reading}
          insights={insights}
          initialInsight={initialInsight}
          onSave={(passage, patch) =>
            updateLibrary(
              saveInsight(
                state,
                reading.id,
                passage,
                patch,
                crypto.randomUUID(),
              ),
            )
          }
        />
      ) : (
        <main id="main" className="page-placeholder">
          <h1>This reading is not on your shelf.</h1>
          <p>It may have been saved in another browser.</p>
          <Link href="/" className="paper-button">
            Return to your library
          </Link>
        </main>
      )}
    </div>
  );
};
