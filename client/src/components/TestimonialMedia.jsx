import { useRef } from 'react';
import { videoTestimonials, whatsappMessages } from '../content/testimonialMedia.js';

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// WhatsApp messages and short video testimonials shown under the text testimonials.
// Videos use preload="none" with a poster, so nothing heavy downloads until someone presses play,
// and starting one video pauses any other that is playing.
export default function TestimonialMedia() {
  const videos = useRef([]);
  const onlyOne = (current) => videos.current.forEach((v) => { if (v && v !== current) v.pause(); });

  return (
    <>
      <div className="tm-block">
        <h3 className="tm-title">Messages from our clients</h3>
        <ul className="wa-grid">
          {whatsappMessages.map((m) => (
            <li key={m.src}>
              <figure className="wa-card">
                <img src={m.src} alt={m.alt} width="368" height="400" loading="lazy" decoding="async" />
                <figcaption>WhatsApp message from a client</figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>

      <div className="tm-block">
        <h3 className="tm-title">Video testimonials</h3>
        <ul className="vt-grid">
          {videoTestimonials.map((v, i) => (
            <li key={v.id}>
              <figure className="vt-card">
                <video
                  ref={(el) => { videos.current[i] = el; }}
                  controls
                  playsInline
                  preload="none"
                  poster={v.poster}
                  aria-label={`Video testimonial: ${v.name}${v.detail ? `, ${v.detail}` : ''} (${mmss(v.seconds)})`}
                  onPlay={(e) => onlyOne(e.currentTarget)}
                >
                  <source src={v.src} type="video/mp4" />
                  Your browser cannot play this video. <a href={v.src}>Download it</a>.
                </video>
                <figcaption>
                  <strong>{v.name}</strong>
                  {v.detail && <span>{v.detail}</span>}
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
