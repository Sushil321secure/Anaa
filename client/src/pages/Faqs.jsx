import { Link } from 'react-router-dom';
import useDocumentMeta from '../hooks/useDocumentMeta.js';
import { faqs } from '../content/site.js';

export default function Faqs() {
  useDocumentMeta('FAQs | Anaa Nutricare', 'Answers to common questions about consultations, discovery calls and nutrition guidance.');
  return (
    <section className="container page narrow">
      <h1>Frequently asked questions</h1>
      <div className="faq-list">
        {faqs.map((f) => (
          <details key={f.q}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>
      <p>Still have a question? <Link to="/contact">Contact us</Link>.</p>
    </section>
  );
}
