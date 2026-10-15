import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { FREE_MODELS } from "../services/ai";
import {
  PROVIDER_CATALOG,
  providerCommand,
  listConnections,
  type ProviderConnection,
} from "../services/providers";
import { preferredModel, keepModel } from "../services/model-preference";
import { ProviderDialog } from "./ProviderDialog";
import { googleSignIn } from "../services/firebase";

export interface ProviderEditing {
  provider: string;
  id?: string;
}

export const Models = ({
  user,
  editing,
  onEditing,
}: {
  user: User | null;
  editing?: ProviderEditing;
  onEditing: (editing?: ProviderEditing) => void;
}) => {
  const [connections, setConnections] = useState<ProviderConnection[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState(false);
  const [query, setQuery] = useState("");
  const [key, setKey] = useState("");
  const [menu, setMenu] = useState<string>();
  const [modelsFor, setModelsFor] = useState<string>();
  const [modelQuery, setModelQuery] = useState("");
  const [selected, setSelected] = useState(preferredModel);
  const search = query.trim().toLowerCase();
  const filteredProviders = PROVIDER_CATALOG.filter((provider) =>
    provider.name.toLowerCase().includes(search),
  );
  const showSubscription = "chatgpt".includes(search);
  useEffect(() => {
    let alive = true;
    if (user)
      void listConnections()
        .then((value) => {
          if (alive) setConnections(value);
        })
        .catch((error) => {
          if (alive) setError(error.message);
        });
    return () => {
      alive = false;
    };
  }, [user]);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not update this connection.",
      );
    } finally {
      setBusy(false);
    }
  };
  const connect = async () => {
    if (!editing) return;
    const data = await providerCommand({ command: "connect", ...editing, key });
    if (data.connection)
      setConnections((previous) => [
        ...previous.filter((c) => c.id !== data.connection!.id),
        data.connection!,
      ]);
    setKey("");
    onEditing(undefined);
  };
  const toggle = async (connection: ProviderConnection, id: string) => {
    const enabled = connection.enabled.includes(id)
      ? connection.enabled.filter((value) => value !== id)
      : [...connection.enabled, id];
    const data = await providerCommand({
      command: "models",
      id: connection.id,
      enabled,
    });
    if (data.connection)
      setConnections((previous) =>
        previous.map((c) => (c.id === connection.id ? data.connection! : c)),
      );
  };
  return (
    <main id="main" className="models-page">
      <header>
        <span className="eyebrow">Your reading companion</span>
        <h1>Models</h1>
        <p>Choose the intelligence that reads beside you.</p>
      </header>
      {error && !editing && (
        <p className="models-error" role="alert">
          {error}
        </p>
      )}
      <section aria-labelledby="providers-heading">
        <h2 id="providers-heading">Providers</h2>
        <div className="provider-card">
          <div className="provider-row">
            <span className="provider-glyph" aria-hidden="true">
              ✳
            </span>
            <div>
              <b>Caption</b>
              <small>Free · ready to use</small>
            </div>
            <span className="provider-available">Connected</span>
          </div>
          {connections.map((connection) => (
            <div className="provider-item" key={connection.id}>
              <div className="provider-row">
                <span className="provider-glyph" aria-hidden="true">
                  ✳
                </span>
                <div>
                  <b>{connection.name}</b>
                  <small>
                    {connection.kind === "api" ? "API key" : "Subscription"}
                  </small>
                </div>
                <button
                  type="button"
                  className="provider-overflow"
                  aria-label={`${connection.name} options`}
                  aria-expanded={menu === connection.id}
                  onClick={() => {
                    setMenu(menu === connection.id ? undefined : connection.id);
                    setModelsFor(undefined);
                  }}
                >
                  ⋯
                </button>
              </div>
              {menu === connection.id && (
                <div className="provider-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setModelsFor(connection.id);
                      setMenu(undefined);
                      setModelQuery("");
                    }}
                  >
                    Set models
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onEditing({
                        provider: connection.provider,
                        id: connection.id,
                      });
                      setMenu(undefined);
                      setError("");
                    }}
                  >
                    Edit key
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await providerCommand({
                          command: "disconnect",
                          id: connection.id,
                        });
                        setConnections((value) =>
                          value.filter((c) => c.id !== connection.id),
                        );
                        setMenu(undefined);
                      })
                    }
                  >
                    Disconnect
                  </button>
                </div>
              )}
              {modelsFor === connection.id && (
                <div className="provider-models">
                  <label>
                    Search models
                    <input
                      value={modelQuery}
                      onChange={(event) => setModelQuery(event.target.value)}
                      placeholder="Search models"
                    />
                  </label>
                  <div className="model-list">
                    {connection.models
                      .filter((model) =>
                        model.name
                          .toLowerCase()
                          .includes(modelQuery.toLowerCase()),
                      )
                      .map((model) => (
                        <button
                          type="button"
                          key={model.id}
                          aria-pressed={connection.enabled.includes(model.id)}
                          disabled={
                            busy ||
                            (connection.enabled.length === 1 &&
                              connection.enabled.includes(model.id))
                          }
                          onClick={() =>
                            void run(() => toggle(connection, model.id))
                          }
                        >
                          <span>{model.name}</span>
                          <span aria-hidden="true">
                            {connection.enabled.includes(model.id) ? "✓" : ""}
                          </span>
                        </button>
                      ))}
                  </div>
                  <button
                    type="button"
                    className="paper-button"
                    onClick={() => setModelsFor(undefined)}
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          ))}
          <button
            type="button"
            className="connect-provider"
            aria-expanded={picker}
            onClick={() => setPicker(!picker)}
          >
            ＋ Connect a provider
          </button>
          {picker && (
            <div className="provider-picker">
              <label>
                Search providers
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search providers"
                />
              </label>
              {filteredProviders.length > 0 && <small>API</small>}
              {filteredProviders.map((provider) => (
                <button
                  type="button"
                  key={provider.id}
                  onClick={() => {
                    onEditing({ provider: provider.id });
                    setPicker(false);
                    setKey("");
                    setError("");
                  }}
                >
                  {provider.name}
                  <span>API key →</span>
                </button>
              ))}
              {showSubscription && (
                <>
                  <small>Subscription</small>
                  <button
                    type="button"
                    onClick={() =>
                      setError(
                        "ChatGPT subscription connection setup is pending. The supported connection method must be configured before authorization.",
                      )
                    }
                  >
                    ChatGPT<span>Subscription →</span>
                  </button>
                </>
              )}
              {!filteredProviders.length && !showSubscription && (
                <p className="models-help">No matching providers.</p>
              )}
            </div>
          )}
        </div>
        <p className="models-help">
          Caption provides free models. Your own API connections use your
          provider’s pricing and data policy. Keys are encrypted on the server
          and never returned to this page.
        </p>
      </section>
      <section aria-labelledby="reading-model-heading">
        <h2 id="reading-model-heading">Reading model</h2>
        <label className="model-select">
          Default for your next question
          <select
            value={selected}
            onChange={(event) => {
              setSelected(event.target.value);
              keepModel(event.target.value);
            }}
          >
            {!FREE_MODELS.some((model) => model.id === selected) &&
              !connections.some((connection) =>
                connection.enabled.some(
                  (id) => `${connection.id}::${id}` === selected,
                ),
              ) && (
                <option value={selected}>
                  Selected model unavailable — choose a model
                </option>
              )}
            <optgroup label="Caption · Free">
              {FREE_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </optgroup>
            {connections.map((connection) => (
              <optgroup
                key={connection.id}
                label={`${connection.name} · Your account`}
              >
                {connection.models
                  .filter((model) => connection.enabled.includes(model.id))
                  .map((model) => (
                    <option
                      key={model.id}
                      value={`${connection.id}::${model.id}`}
                    >
                      {model.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <p className="models-help">
          Your selected provider receives the reading text and question.
          Personal connections do not fall back to another provider.
        </p>
      </section>
      {editing && (
        <ProviderDialog
          busy={busy}
          onClose={() => {
            onEditing(undefined);
            setKey("");
          }}
        >
          <h2 id="connect-title">
            {editing.id ? "Edit" : "Connect"}{" "}
            {PROVIDER_CATALOG.find((p) => p.id === editing.provider)?.name}
          </h2>
          {error && (
            <p className="models-error" role="alert">
              {error}
            </p>
          )}
          {!user ? (
            <>
              <p>
                Continue with Google to keep your provider connections private
                and available across devices.
              </p>
              <button
                className="paper-button"
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await googleSignIn();
                  })
                }
              >
                Continue with Google
              </button>
            </>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void run(connect);
              }}
            >
              <label>
                API key
                <input
                  autoFocus
                  type="password"
                  autoComplete="off"
                  value={key}
                  onChange={(event) => setKey(event.target.value)}
                  required
                  placeholder="Paste your API key"
                />
              </label>
              <p>
                Your key is checked against this provider’s model list before it
                is saved.
              </p>
              <button
                type="submit"
                className="paper-button"
                disabled={busy || !key.trim()}
              >
                {busy ? "Connecting…" : "Connect"}
              </button>
            </form>
          )}
          <button
            type="button"
            className="provider-cancel"
            disabled={busy}
            onClick={() => {
              onEditing(undefined);
              setKey("");
            }}
          >
            Cancel
          </button>
        </ProviderDialog>
      )}
    </main>
  );
};
