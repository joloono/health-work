import { useState } from "react";
import { setAuth } from "./api.js";
import { btnStyle, inputStyle, pageStyle } from "./constants.js";

export default function Login({ theme, onSuccess }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(false);
    setLoading(true);
    setAuth(user, pass);
    try {
      const res = await fetch("/api/today", {
        headers: { Authorization: `Basic ${btoa(`${user}:${pass}`)}`, "Content-Type": "application/json" },
      });
      if (res.ok) {
        onSuccess();
      } else {
        setError(true);
        localStorage.removeItem("health-auth");
      }
    } catch {
      setError(true);
      localStorage.removeItem("health-auth");
    }
    setLoading(false);
  };

  return (
    <div style={{ ...pageStyle(theme), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>🏛️</div>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.8rem", fontWeight: 700, margin: 0 }}>Health System</h1>
        <p style={{ fontSize: "0.78rem", color: "var(--fg-dim)", marginTop: "0.3rem" }}>Anmelden um fortzufahren</p>
      </div>

      <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 300, display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        <input
          type="text" value={user} onChange={(e) => setUser(e.target.value)}
          placeholder="Benutzername" autoComplete="username" autoFocus
          style={inputStyle}
        />
        <input
          type="password" value={pass} onChange={(e) => setPass(e.target.value)}
          placeholder="Passwort" autoComplete="current-password"
          style={inputStyle}
        />
        {error && (
          <div style={{ fontSize: "0.75rem", color: "var(--accent)", textAlign: "center", fontWeight: 500 }}>
            Falsches Passwort oder Benutzername
          </div>
        )}
        <button type="submit" disabled={!user || !pass || loading} style={{
          ...btnStyle(user && pass ? "var(--accent)" : "var(--muted)", user && pass ? "#fff" : "var(--fg-dim)"),
          opacity: user && pass ? 1 : 0.5, width: "100%",
        }}>
          {loading ? "..." : "Anmelden"}
        </button>
      </form>
    </div>
  );
}
