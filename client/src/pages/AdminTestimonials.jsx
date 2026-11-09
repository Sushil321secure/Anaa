import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { PageHeader } from '../components/ui.jsx';
import useDocumentMeta from '../hooks/useDocumentMeta.js';
import { fetchAllTestimonials, saveTestimonial, selectTestimonials } from '../features/testimonials/testimonialSlice.js';

const empty = { id: null, name: '', quote: '' };

export default function AdminTestimonials() {
  useDocumentMeta('Testimonials | Anaa Admin');
  const dispatch = useDispatch();
  const { admin } = useSelector(selectTestimonials);
  const [form, setForm] = useState(empty);

  useEffect(() => { dispatch(fetchAllTestimonials()); }, [dispatch]);

  async function onSubmit(e) {
    e.preventDefault();
    const res = await dispatch(saveTestimonial({ id: form.id, data: { name: form.name, quote: form.quote } }));
    if (saveTestimonial.fulfilled.match(res)) setForm(empty);
  }

  return (
    <>
      <PageHeader title="Testimonials" subtitle="Text only: no photos or avatars. Quotes are shown exactly as saved here, so get approval before correcting spelling." />
      {admin.error && <p className="form-error" role="alert">{admin.error}</p>}
      {admin.status === 'loading' && admin.items.length === 0 && <p>Loading…</p>}

      <form className="panel" onSubmit={onSubmit}>
        <h2>{form.id ? 'Edit testimonial' : 'Add testimonial'}</h2>
        <div className="field">
          <label htmlFor="t-name">Customer name</label>
          <input id="t-name" required minLength={2} maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="t-quote">Testimonial text</label>
          <textarea id="t-quote" rows="5" required maxLength={2000} value={form.quote} onChange={(e) => setForm({ ...form, quote: e.target.value })} />
        </div>
        {admin.saveError && <p className="form-error" role="alert">{admin.saveError}</p>}
        <div className="cta-row">
          <button className="btn btn-primary">{form.id ? 'Save changes' : 'Add (published)'}</button>
          {form.id && <button type="button" className="btn btn-outline" onClick={() => setForm(empty)}>Cancel</button>}
        </div>
      </form>

      <ul className="admin-list">
        {admin.items.map((t) => (
          <li key={t._id} className="panel">
            <p className="admin-quote">&ldquo;{t.quote}&rdquo;</p>
            <p><strong>{t.name}</strong> · <span className={t.isPublished ? 'tag-ok' : 'tag-off'}>{t.isPublished ? 'Published' : 'Unpublished'}</span></p>
            <div className="cta-row">
              <button className="btn btn-outline" onClick={() => dispatch(saveTestimonial({ id: t._id, data: { isPublished: !t.isPublished } }))}>
                {t.isPublished ? 'Unpublish' : 'Publish'}
              </button>
              <button className="btn btn-outline" onClick={() => { setForm({ id: t._id, name: t.name, quote: t.quote }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
