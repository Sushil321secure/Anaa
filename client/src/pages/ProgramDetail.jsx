import { Link, useParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import NotFound from './NotFound.jsx';
import useDocumentMeta from '../hooks/useDocumentMeta.js';
import { fitnessPrograms, programSlug } from '../content/site.js';

const joinSteps = [
  { title: 'Request a free discovery call', text: 'Tell us your goal and preferred time.' },
  { title: 'We confirm your batch', text: 'Our team contacts you to confirm the available batch and schedule.' },
  { title: 'Start with support', text: 'Join the sessions, with nutrition guidance alongside if you want it.' },
];

// One page per fitness/wellness programme (reached from "Find out more" and the Programs menu).
// Content comes from the original Anaa website: overview paragraphs, titled lists, age group and special batch.
export default function ProgramDetail() {
  const { slug } = useParams();
  const program = fitnessPrograms.find((p) => programSlug(p) === slug);
  useDocumentMeta(program ? `${program.title} | Anaa Nutricare` : 'Programme not found | Anaa Nutricare', program?.text);
  if (!program) return <NotFound />;

  const others = fitnessPrograms.filter((p) => p !== program);
  const facts = [
    program.ageGroups && { label: 'Age groups', value: program.ageGroups },
    program.batch && { label: 'Special batch', value: program.batch.replace(/^Special batch for /, '') },
  ].filter(Boolean);

  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb">
        <div className="container">
          <Link to="/">Home</Link>
          <span aria-hidden="true">&rsaquo;</span>
          <Link to="/services#fitness">Programs</Link>
          <span aria-hidden="true">&rsaquo;</span>
          <span aria-current="page">{program.title}</span>
        </div>
      </nav>

      <section className="section prog-detail">
        <div className="container prog-detail-grid">
          <div className="prog-detail-media">
            <img className="prog-detail-img" src={`/images/programs/${slug}.webp`} width="1200" height="675" alt={program.title} />
            {facts.length > 0 && (
              <dl className="prog-facts">
                {facts.map((f) => (
                  <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>
                ))}
              </dl>
            )}
          </div>

          <div>
            <h1>{program.title}</h1>
            <span className="title-rule" aria-hidden="true" />
            {program.overview.map((para, i) => (
              <p key={para} className="prog-detail-text">{i === 0 && <><strong>Overview</strong> &ndash; </>}{para}</p>
            ))}

            {program.sections?.map((sec) => (
              <div key={sec.title} className="prog-sec">
                <h2 className="prog-sub">{sec.title}</h2>
                <ul className="prog-list">
                  {sec.items.map((item) => <li key={item}><Icon name="check" size={16} /> {item}</li>)}
                </ul>
              </div>
            ))}


            <div className="cta-row">
              <Link className="btn btn-primary btn-lg" to="/discovery-call" state={{ interest: program.title }}>Enquire about this programme <Icon name="arrow" size={18} /></Link>
              <Link className="btn btn-outline btn-lg" to="/services#fitness">All programmes</Link>
            </div>
            <p className="note">Nutrition and fitness guidance complements, and does not replace, your doctor&apos;s treatment.</p>
          </div>
        </div>
      </section>

      <section className="section alt">
        <div className="container">
          <p className="kicker">How to join</p>
          <h2 className="section-title">Getting started is simple</h2>
          <ol className="steps">
            {joinSteps.map((s, i) => (
              <li key={s.title}>
                <span className="step-no" aria-hidden="true">{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <p className="kicker">More programmes</p>
          <h2 className="section-title">Explore other programmes</h2>
          <ul className="prog-links">
            {others.map((p) => (
              <li key={p.title}><Link to={`/programs/${programSlug(p)}`}>{p.title}</Link></li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
