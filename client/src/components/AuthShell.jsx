import Icon from './Icon.jsx';

const COPY = {
  login: { title: 'Welcome back to your wellness journey', text: 'Sign in to see your consultations, diet plans and progress in one place.' },
  register: { title: 'Start your journey to better nutrition', text: 'Create a free account to book consultations, get your diet plan and track your progress.' },
  reset: { title: 'Back to feeling your best', text: 'Choose a new password and get straight back to your plan.' },
};

const POINTS = ['Book online consultations at times that suit you', 'Download your personalised diet plans', 'Track weight and measurements over time', 'Earn rewards when friends join'];

// Two-column sign in / sign up layout: brand panel on the left (hidden on small phones), form on the right.
export default function AuthShell({ mode = 'login', children }) {
  const c = COPY[mode] || COPY.login;
  return (
    <div className="auth-shell">
      <aside className="auth-aside">
        <p className="eyebrow" style={{ color: '#d9f0d2' }}><Icon name="leaf" size={22} /> Anaa Nutricare</p>
        <h2>{c.title}</h2>
        <p>{c.text}</p>
        <ul className="auth-points">
          {POINTS.map((p) => <li key={p}><Icon name="check" size={18} /> <span>{p}</span></li>)}
        </ul>
      </aside>
      <main className="auth-main">
        <div className="auth-form">{children}</div>
      </main>
    </div>
  );
}
