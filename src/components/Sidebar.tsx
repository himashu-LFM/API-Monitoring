const NAV = ["Overview", "APIs", "Alerts", "Renewals"];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <div className="sb-logo">A</div>
        <div>
          <div className="t">API Monitor</div>
          <div className="s">Usage &amp; Renewal</div>
        </div>
      </div>
      <nav className="sb-nav">
        {NAV.map((item) => (
          <button key={item} className={"sb-item" + (item === "Overview" ? " active" : "")}>
            {item}
          </button>
        ))}
      </nav>
      <div className="sb-foot">
        <div className="sb-status">
          <span className="dot" />
          Monitoring active
        </div>
        <div className="sb-user">
          <div className="av">SA</div>
          <div>
            <div className="n">Sudhanshu A.</div>
            <div className="e">sudhanshu@example.com</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
