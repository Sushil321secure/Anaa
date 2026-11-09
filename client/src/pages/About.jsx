import { Link } from 'react-router-dom';
import ClientMarquee from '../components/ClientMarquee.jsx';
import Icon from '../components/Icon.jsx';
import useDocumentMeta from '../hooks/useDocumentMeta.js';
import { aboutStory, awareness, dietServices } from '../content/site.js';
import { approachCards, approachIntro, companies, companiesIntro, mission, vision } from '../content/about.js';

const values = [
  { icon: 'user', title: 'Personalized', text: 'Plans built around your lifestyle, food preferences and goals, not a one-size-fits-all chart.' },
  { icon: 'leaf', title: 'Practical', text: 'Realistic, everyday food guidance you can keep following long term.' },
  { icon: 'heart', title: 'Supportive', text: 'Regular follow-ups and progress reviews so you are never on your own.' },
  { icon: 'shield', title: 'Responsible', text: 'Guidance that complements your doctor\'s care and never replaces medical advice.' },
];

const approach = [
  'Understand your health goals, history and routine',
  'Build a plan using familiar, accessible foods',
  'Review progress regularly and adjust the plan',
  'Educate, so good habits last beyond the plan',
];

export default function About() {
  useDocumentMeta('About Us | Anaa Nutricare', 'Anaa Nutricare provides personalized nutrition care from certified nutritionists in Bengaluru, India.');
  return (
    <>
      <section className="page-hero">
        <div className="container page-hero-grid">
          <div>
            <p className="eyebrow">About Us</p>
            <h1>Good Nutrition. <span>Better Life.</span></h1>
            <p className="lead">Anaa Nutricare helps people change the way they feel through personalized nutrition care, practical solutions and long term support.</p>
            <div className="cta-row">
              <Link className="btn btn-primary btn-lg" to="/discovery-call">Book a free discovery call</Link>
              <Link className="btn btn-outline btn-lg" to="/services">Our services</Link>
            </div>
          </div>
          <div className="page-hero-art"><img src="/images/about/about-table.webp" width="1100" height="749" alt="A fresh, colourful healthy meal laid out on a wooden table" /></div>
        </div>
      </section>

      <section className="section">
        <div className="container split">
          <div>
            <p className="kicker">Our mission</p>
            <h2 className="section-title">Healthy behaviours, not quick fixes</h2>
            {aboutStory.map((para) => <p key={para}>{para}</p>)}
          </div>
          <ol className="check-list numbered">
            {approach.map((a, i) => (
              <li key={a}><span className="step-no" aria-hidden="true">{i + 1}</span><span>{a}</span></li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section ab-vm" id="vision">
        <div className="container ab-vm-grid">
          <article className="ab-vision">
            <span className="icon-bubble"><Icon name="eye" /></span>
            <p className="kicker">Our vision</p>
            <h2 className="section-title">Food as medicine, rooted in local heritage</h2>
            <p>{vision}</p>
          </article>
          <article className="ab-mission">
            <span className="icon-bubble"><Icon name="heart" /></span>
            <p className="kicker">Our mission</p>
            <ol className="ab-mission-list">
              {mission.map((m, i) => (
                <li key={m}><span className="step-no" aria-hidden="true">{i + 1}</span><span>{m}</span></li>
              ))}
            </ol>
          </article>
        </div>
      </section>

      <section className="section alt" id="approach">
        <div className="container">
          <p className="kicker">Our approach</p>
          <h2 className="section-title">Diet consultation, the holistic way</h2>
          <p className="lead">{approachIntro}</p>
          <div className="feature-grid ab-approach">
            {approachCards.map((c) => (
              <article key={c.title} className="feature">
                <span className="icon-bubble purple"><Icon name={c.icon} /></span>
                <h3>{c.title}</h3>
                <p>{c.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section alt">
        <div className="container">
          <p className="kicker">What we stand for</p>
          <h2 className="section-title">Our values</h2>
          <div className="feature-grid four">
            {values.map((v) => (
              <article key={v.title} className="feature">
                <span className="icon-bubble purple"><Icon name={v.icon} /></span>
                <h3>{v.title}</h3>
                <p>{v.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <p className="kicker">Who we help</p>
          <h2 className="section-title">Programs for many health goals</h2>
          <ul className="pill-grid">
            {dietServices.map((p) => (
              <li key={p.title}><strong>{p.title}</strong><span>{p.text}</span></li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section alt" id="awareness">
        <div className="container split">
          <div>
            <p className="kicker">Public health &amp; nutrition awareness</p>
            <h2 className="section-title">Education that reaches communities</h2>
            <p>Beyond one-to-one care, we believe education builds healthier communities. We work to raise awareness about everyday nutrition so more people can make informed food choices.</p>
            <Link className="btn btn-primary" to="/services#public-health">See awareness programmes</Link>
          </div>
          <ul className="check-list">
            {awareness.map((a) => (
              <li key={a.title}><span className="icon-bubble"><Icon name="check" size={20} /></span><span><strong>{a.title}</strong>{a.text}</span></li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section" id="clients">
        <div className="container">
          <p className="kicker">Corporate wellness</p>
          <h2 className="section-title">Companies we’ve worked with</h2>
          <p className="lead">{companiesIntro}</p>
          <ClientMarquee companies={companies} />
        </div>
      </section>

      <section className="cta-band">
        <div className="container cta-band-inner">
          <div><h2>Let's start your journey</h2><p>Tell us your goal and our team will get in touch.</p></div>
          <Link className="btn btn-primary btn-lg" to="/discovery-call">Free Discovery Call</Link>
        </div>
      </section>
    </>
  );
}
