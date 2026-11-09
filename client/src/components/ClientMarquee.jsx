// One continuous, auto-scrolling row of organisation logos. The list is rendered twice so the loop has no gap;
// the second copy is hidden from screen readers and from keyboard focus. Pauses on hover and focus.
// With reduced motion the row stops moving (the second copy is hidden and the row can be scrolled by hand).
function Set({ companies, copy }) {
  return (
    <ul className={`cm-set${copy ? ' cm-copy' : ''}`} aria-hidden={copy || undefined}>
      {companies.map((c) => (
        <li key={c.name} className="cm-item" title={c.name}>
          {c.logo ? <img src={`/images/clients/${c.logo}.webp`} alt={copy ? '' : c.name} width="130" height="70" decoding="async" draggable="false" /> : <span>{c.name}</span>}
        </li>
      ))}
    </ul>
  );
}

export default function ClientMarquee({ companies }) {
  return (
    <div className="cm" role="region" aria-label="Organisations we have worked with" style={{ '--cm-dur': `${companies.length * 3}s` }}>
      <div className="cm-track">
        <Set companies={companies} />
        <Set companies={companies} copy />
      </div>
    </div>
  );
}
