import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Slider from './Slider.jsx';
import TestimonialMedia from './TestimonialMedia.jsx';
import { fetchTestimonials, selectTestimonials } from '../features/testimonials/testimonialSlice.js';
import { fallbackTestimonials } from '../content/testimonials.js';

const COLUMNS = [[1100, 3], [700, 2]];

// Text-only testimonial slider (no photos or avatars). Quotes come from the database exactly as stored,
// with a built-in copy of the same four while the API has nothing to return.
export default function Testimonials() {
  const dispatch = useDispatch();
  const { items: live, status } = useSelector(selectTestimonials);
  const items = status === 'ready' && live.length > 0 ? live : fallbackTestimonials; // database first, built-in copy otherwise
  useEffect(() => {
    if (status === 'idle') dispatch(fetchTestimonials());
  }, [dispatch, status]);

  return (
    <section className="section alt testi" id="testimonials">
      <div className="container">
        <p className="kicker">Testimonials</p>
        <h2 className="section-title">What Our Happy Clients Say</h2>
        <Slider
          items={items}
          getKey={(t) => t._id}
          label="Client testimonials"
          columns={COLUMNS}
          renderItem={(t) => (
            <figure className="testi-card">
              <span className="testi-mark" aria-hidden="true">&ldquo;</span>
              <blockquote>{t.quote}</blockquote>
              <figcaption>{t.name}</figcaption>
            </figure>
          )}
        />
        <TestimonialMedia />
      </div>
    </section>
  );
}
