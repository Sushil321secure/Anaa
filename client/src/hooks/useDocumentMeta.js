import { useEffect } from 'react';

// Per-page SEO: sets the title and meta description.
export default function useDocumentMeta(title, description) {
  useEffect(() => {
    document.title = title;
    if (!description) return;
    let tag = document.querySelector('meta[name="description"]');
    if (!tag) {
      tag = document.createElement('meta');
      tag.name = 'description';
      document.head.appendChild(tag);
    }
    tag.content = description;
  }, [title, description]);
}
