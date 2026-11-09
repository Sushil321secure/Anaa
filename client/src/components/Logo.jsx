// Official Anaa logo (single source for every placement).
// Size is set by the CSS class on the context: .brand (header), .footer-logo, .portal-logo.
export default function Logo({ className = '' }) {
  return (
    <img
      className={`logo-img ${className}`}
      src="/images/brand/anaa-logo.webp"
      width="900"
      height="351"
      alt="Anaa – My Health Nutri Care"
    />
  );
}
