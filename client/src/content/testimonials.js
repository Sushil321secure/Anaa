// Display copy of the four original testimonials, used only while the API has none to show (for example
// before the database is reachable or seeded). The database is the source of truth once it is available.
// This must stay word for word identical to server/src/seeds/testimonials.data.js; a server test enforces it.
export const fallbackTestimonials = [
  {
    _id: 'orig-1',
    name: 'Ms. Puneetha Nagendra',
    quote: "Excellent fitness program I have ever come across, with reasonable prices and personalized diet plans. It includes various forms like yoga, tabatha, functional training with trained and best instructors. I'm very happy  to be part of this fitness plan. Looking forward to make the most of it. Thank you Anaa fitness for being the best.",
  },
  {
    _id: 'orig-2',
    name: 'Ms. Kavya Lokesh',
    quote: 'Very nice experience at Anaa My Nealth Nutricare, the session plans are very well curated keeping everyone in their mind. Personal attention given and followups are extra ordinary. Thank you Team.',
  },
  {
    _id: 'orig-3',
    name: 'Ms. Sampriktha Chatterjee',
    quote: 'Anaa team is doing really a great job.. the seniors are benefitted a lot... Different yogas and exercises are being held.',
  },
  {
    _id: 'orig-4',
    name: 'Ms. Jyoti Kumar',
    quote: 'Anaa My Nealth Nutricare are providing excellent services in diet consultaion and yoga sessions.',
  },
];
