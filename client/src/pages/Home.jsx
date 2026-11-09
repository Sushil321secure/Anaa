import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import PackageCard from '../components/PackageCard.jsx';
import usePackages from '../hooks/usePackages.js';
import useDocumentMeta from '../hooks/useDocumentMeta.js';
import DietServicesCarousel from '../components/DietServicesCarousel.jsx';
import ProgramCard from '../components/ProgramCard.jsx';
import Slider from '../components/Slider.jsx';
import OnlineServicesSection from '../components/OnlineServicesSection.jsx';
import LogEarnSection from '../components/LogEarnSection.jsx';
import Testimonials from '../components/Testimonials.jsx';
import { awareness, brandMessages, faqs, fitnessPrograms, highlights, programCards, programSlug, steps, whyChoose } from '../content/site.js';

// Cards visible per row: 4 on large screens, 3 on laptops, 2 on tablets, 1 on phones.
const PROGRAM_COLUMNS = [[1500, 4], [1100, 3], [700, 2]];

export default function Home() {
  const { packages } = usePackages();
  useDocumentMeta('Anaa Nutricare | Better Nutrition, A Healthier You', 'Expert guidance from certified nutritionists: personalized diet plans, practical solutions and long term support.');
  return (
    <>
      <section className="hero">
        <img className="hero-photo" src="/images/hero/hero-bowl.webp" width="1400" height="933" fetchpriority="high" alt="A fresh nutrient-rich bowl with avocado, chickpeas, tomatoes and greens" />
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow"><Icon name="leaf" size={26} /> Personalized Nutrition Care</p>
            <h1>
              Better Nutrition <span>A Healthier You</span>
            </h1>
            <p className="lead">
              Get expert guidance from certified nutritionists to achieve your health goals with personalized diet plans, practical solutions and long term support.
            </p>
            <div className="cta-row">
              <Link className="btn btn-primary btn-lg" to="/book-consultation"><Icon name="calendar" size={22} /> Book a Consultation <Icon name="arrow" size={20} /></Link>
              <Link className="btn btn-outline btn-lg" to="/services"><Icon name="play" size={20} /> Explore Our Programs</Link>
            </div>
            <ul className="highlights">
              {highlights.map((h) => (
                <li key={h.title}>
                  <span className={`icon-bubble tone-${h.icon}`}><Icon name={h.icon} size={28} /></span>
                  <span><strong>{h.title}</strong><small>{h.text}</small></span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="hero-chip chip-a" style={{ '--depth': 28 }} aria-hidden="true"><Icon name="shield" size={20} /> Certified nutritionists</div>
        <div className="hero-chip chip-b" style={{ '--depth': 18 }} aria-hidden="true"><Icon name="video" size={20} /> Online consultations</div>
        <p className="script" aria-hidden="true">Good<br />Nutrition<br />Brighter<br />Tomorrow <Icon name="heart" size={22} /></p>
      </section>

      <section className="container program-strip-wrap" aria-label="Programs"><div className="program-strip">
        {programCards.map((c) => (
          <Link key={c.title} to={c.to} className="program-card">
            <span className="icon-bubble"><Icon name={c.icon} /></span>
            <span className="program-text">
              <strong>{c.title}</strong>
              <small>{c.text}</small>
              <span className="learn">Learn More <Icon name="arrow" size={16} /></span>
            </span>
            {c.img && <img src={c.img} alt="" loading="lazy" width="96" height="96" />}
          </Link>
        ))}
      </div>
      </section>

      <section className="section">
        <div className="container">
          <p className="kicker">Why Anaa</p>
          <h2 className="section-title">Care that fits your life</h2>
          <div className="feature-grid">
            {whyChoose.map((f) => (
              <article key={f.title} className="feature">
                <span className="icon-bubble purple"><Icon name={f.icon} /></span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section mission">
        <div className="container">
          <p className="kicker">Our mission</p>
          <h2 className="section-title">Good nutrition is our mission</h2>
          <ul className="mission-grid">
            {brandMessages.map((m) => (
              <li key={m.title}>
                <span className="mission-kicker">{m.kicker}</span>
                <h3>{m.title}</h3>
                <p>{m.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section alt prog" id="programs">
        <div className="container">
          <p className="kicker">What we offer</p>
          <h2 className="section-title">Our popular programmes</h2>
          <Slider
            items={fitnessPrograms}
            getKey={(p) => p.title}
            label="Fitness and wellness programmes"
            columns={PROGRAM_COLUMNS}
            className="prog-slider"
            renderItem={(p, copy) => <ProgramCard program={p} copy={copy} />}
          />
        </div>
      </section>

      <section className="section" id="packages">
        <div className="container">
          <p className="kicker">Wellness Packages</p>
          <h2 className="section-title">Choose the support that fits your goal</h2>
          <p className="lead">Structured plans for long term health and wellness, from a first month to a full three-month programme.</p>
          <div className="pkg-grid">
            {packages.map((p) => <PackageCard key={p._id} pkg={p} />)}
          </div>
          <p className="pkg-fine">Package terms are subject to confirmation by Anaa Nutricare. <Link to="/packages">See full package details</Link></p>
        </div>
      </section>

      <OnlineServicesSection />

      <LogEarnSection />

      <DietServicesCarousel alt id="consultations" kicker="Eat right, not less" intro={null}>
        <Link className="btn btn-primary" to="/discovery-call">Talk to a nutritionist <Icon name="arrow" size={18} /></Link>
      </DietServicesCarousel>

      <section className="section">
        <div className="container">
          <p className="kicker">How it works</p>
          <h2 className="section-title">Three simple steps</h2>
          <ol className="steps">
            {steps.map((s, i) => (
              <li key={s.title}>
                <span className="step-no" aria-hidden="true">{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section alt">
        <div className="container split">
          <div>
            <p className="kicker">Public health &amp; nutrition awareness</p>
            <h2 className="section-title">Healthier communities start with awareness</h2>
            <p className="lead">We bring nutrition education to workplaces, schools and communities.</p>
            <Link className="btn btn-outline" to="/services#public-health">Learn more</Link>
          </div>
          <ul className="check-list">
            {awareness.map((a) => (
              <li key={a.title}>
                <span className="icon-bubble"><Icon name="check" size={20} /></span>
                <span><strong>{a.title}</strong>{a.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Testimonials />

      <section className="section">
        <div className="container narrow">
          <p className="kicker">FAQs</p>
          <h2 className="section-title">Common questions</h2>
          <div className="faq-list">
            {faqs.slice(0, 3).map((f) => (
              <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>
            ))}
          </div>
          <Link to="/faqs">See all FAQs →</Link>
        </div>
      </section>

      <section className="cta-band">
        <div className="container cta-band-inner">
          <div>
            <h2>Ready to feel better?</h2>
            <p>Request a free discovery call and tell us your goal.</p>
          </div>
          <Link className="btn btn-primary btn-lg" to="/discovery-call">Free Discovery Call <Icon name="arrow" size={20} /></Link>
        </div>
      </section>
    </>
  );
}
