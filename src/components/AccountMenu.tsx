import { useState } from "react";
import type { User } from "firebase/auth";
import { googleSignIn, googleSignOut } from "../services/firebase";
import { Link } from "./Link";

export const AccountMenu = ({
  user,
  status,
}: {
  user: User | null;
  status: string;
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const run = async () => {
    setBusy(true);
    setError("");
    try {
      if (user) await googleSignOut();
      else await googleSignIn();
      setOpen(false);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Sign-in could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="account-menu">
      <button
        type="button"
        className="nav-link"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {user
          ? user.displayName?.split(" ")[0] || "Account"
          : "Save across devices"}
      </button>
      {open && (
        <div className="account-popover">
          <p>{user?.email || "Keep your library and notes on every device."}</p>
          <small>{status}</small>
          <Link
            href="/models"
            className="paper-button"
            onClick={() => setOpen(false)}
          >
            Models &amp; providers
          </Link>
          <button
            type="button"
            className="paper-button"
            disabled={busy}
            onClick={() => void run()}
          >
            {busy ? "Connecting…" : user ? "Sign out" : "Continue with Google"}
          </button>
          {error && <p role="alert">{error}</p>}
        </div>
      )}
    </div>
  );
};
