import { lazy, Suspense, useEffect, useState } from "react";
import { Header } from "./components/Header";
import { Library } from "./components/Library";
import { Link } from "./components/Link";
import { readingInsights, saveInsight } from "./reading";
import { navigate, readingPath, useRoute } from "./routing";
import { useLibrary } from "./use-library";
import { importLink, importPdf } from "./services/import";
import { AccountMenu } from "./components/AccountMenu";
import { openBook } from "./open-book";

const Reader = lazy(() =>
  import("./components/Reader").then((module) => ({ default: module.Reader })),
);
const Notepad = lazy(() =>
  import("./components/Notepad").then((module) => ({
    default: module.Notepad,
  })),
);

export const App = () => {
  const {
    state,
    update: updateLibrary,
    user,
    warning,
    status,
    loading,
  } = useLibrary();
  const [progress, setProgress] = useState("");
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
  useEffect(() => {
    document.title = `${current === "library" ? "Library" : current === "reading" ? "Reading" : "Notepad"} · Caption`;
  }, [current]);
  return (
    <div className={current === "library" ? "app app-dark" : "app app-paper"}>
      <Header
        current={current}
        account={<AccountMenu user={user} status={status} />}
      />
      {warning && (
        <p className="storage-warning" role="status">
          {warning}
        </p>
      )}
      <Suspense
        fallback={
          <main id="main" className="page-placeholder" role="status">
            <p>Opening your page…</p>
          </main>
        }
      >
        {current === "library" ? (
          <Library
            readings={state.readings}
            onOpen={(id, book) => {
              void openBook(book, () => navigate(readingPath(id)));
            }}
            progress={progress}
            onRemove={(id) => {
              const title = state.readings.find(
                (reading) => reading.id === id,
              )?.title;
              if (
                window.confirm(
                  `Remove “${title}” and its saved insights from your library?`,
                )
              )
                updateLibrary((previous) => ({
                  ...previous,
                  readings: previous.readings.filter(
                    (reading) => reading.id !== id,
                  ),
                  insights: previous.insights.filter(
                    (insight) => insight.readingId !== id,
                  ),
                }));
            }}
            onAdd={async (kind, label, file) => {
              try {
                const reading =
                  kind === "link"
                    ? await importLink(label, setProgress)
                    : await importPdf(file!, setProgress);
                updateLibrary((previous) => ({
                  ...previous,
                  readings: [...previous.readings, reading],
                }));
                navigate(readingPath(reading.id));
              } finally {
                setProgress("");
              }
            }}
          />
        ) : current === "notepad" ? (
          <Notepad state={state} />
        ) : current === "reading" && loading ? (
          <main id="main" className="page-placeholder" role="status">
            <p>Opening your reading…</p>
          </main>
        ) : reading ? (
          <Reader
            key={`${reading.id}:${insightId ?? ""}`}
            reading={reading}
            insights={insights}
            initialInsight={initialInsight}
            onSave={(passage, patch) =>
              updateLibrary((previous) =>
                previous.readings.some((item) => item.id === reading.id)
                  ? saveInsight(
                      previous,
                      reading.id,
                      passage,
                      patch,
                      crypto.randomUUID(),
                    )
                  : previous,
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
      </Suspense>
    </div>
  );
};
