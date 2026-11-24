import { useEffect, useState } from "react";
import { apiRequest } from "./api";
import "./DatabaseLab.css";

const sections = [
  ["schema", "Schema explorer", "/api/admin/database/schema"],
  ["analytics", "Live analytics", "/api/admin/database/analytics"],
  ["availability-plan", "Availability query plan", "/api/admin/database/query-plan?query=availability"],
  ["bookings-plan", "Booking search query plan", "/api/admin/database/query-plan?query=bookings"],
  ["audit", "Activity audit", "/api/admin/database/audit"],
];

export default function DatabaseLab({ onHome }) {
  const [section, setSection] = useState(sections[0]);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);

  async function load(selected = section) {
    setBusy(true); setError(""); setData(null);
    try { setData(await apiRequest(selected[2])); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    let current = true;
    apiRequest(section[2]).then((payload) => { if (current) { setData(payload); setError(""); setBusy(false); } })
      .catch((failure) => { if (current) { setError(failure.message); setBusy(false); } });
    return () => { current = false; };
  }, [section]);

  async function refreshMaterializedView() {
    setBusy(true); setError("");
    try { await apiRequest("/api/admin/database/refresh-usage", { method: "POST" }); await load(section); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }

  return <main className="db-lab">
    <header className="db-lab-header"><button onClick={onHome}>← Home</button><div><p className="tagline">ADMINISTRATION · POSTGRESQL + MONGODB</p><h1>Database Lab</h1><p>Live schema, query plans, third-floor metrics and MongoDB activity events.</p></div></header>
    <nav className="db-lab-nav" aria-label="Database lab sections">{sections.map((item) => <button key={item[0]} aria-pressed={section[0] === item[0]} onClick={() => { setData(null); setError(""); setBusy(true); setSection(item); }}>{item[1]}</button>)}</nav>
    <section className="db-lab-card"><div className="db-lab-card-head"><h2>{section[1]}</h2><div>
      {section[0] === "analytics" && <button onClick={refreshMaterializedView} disabled={busy}>Refresh daily summary</button>}
      <button onClick={() => load(section)} disabled={busy}>Reload</button></div></div>
      {busy && <p role="status">Loading live database information…</p>}
      {error && <p className="db-lab-error" role="alert">{error}</p>}
      {data && <>
        {section[0] === "schema" && <>
          <p>{data.tables.length} tables · {data.constraints.length} constraints · {data.indexes.length} indexes · {data.ordinaryViews.length} views · {data.materializedViews.length} materialized views</p>
          <div className="db-lab-tables">{data.tables.map((table) => <article key={table.name}><h3>{table.name}</h3><ul>{data.columns.filter((column) => column.table_name === table.name).map((column) => <li key={column.column_name}><code>{column.column_name}</code> · {column.data_type}{column.is_nullable === "NO" ? " · required" : ""}</li>)}</ul></article>)}</div>
          <h3>Constraints</h3><pre>{JSON.stringify(data.constraints, null, 2)}</pre><h3>Indexes</h3><pre>{JSON.stringify(data.indexes, null, 2)}</pre><h3>Views</h3><pre>{JSON.stringify({ ordinary: data.ordinaryViews, materialized: data.materializedViews }, null, 2)}</pre>
          <h3>Database connection role and row security</h3><pre>{JSON.stringify({ connectionRole: data.connectionRole, rowLevelSecurity: data.rowLevelSecurity }, null, 2)}</pre>
          <h3>Functions and triggers</h3><pre>{JSON.stringify({ functions: data.routines, triggers: data.triggers }, null, 2)}</pre>
        </>}
        {section[0] === "analytics" && <><p>Snapshot generated {new Date(data.generatedAt).toLocaleString()} for floor 3.</p><pre>{JSON.stringify(data, null, 2)}</pre></>}
        {section[0].endsWith("plan") && <><p>{data.note}</p><pre>{JSON.stringify(data.plan, null, 2)}</pre></>}
        {section[0] === "audit" && <><p>Source: {data.store}. This is operational activity history, separate from PostgreSQL booking transactions.</p><pre>{JSON.stringify(data.events, null, 2)}</pre></>}
      </>}
    </section>
    <p className="db-lab-footnote">Booking availability is always checked against PostgreSQL transactions. The daily usage materialized view is analytical and can be stale until refreshed.</p>
  </main>;
}
