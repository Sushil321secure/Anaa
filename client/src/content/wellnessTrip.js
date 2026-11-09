// Wellness Trip: content carried over from the previous Anaa website (rewritten for readability, nothing dropped).
export const trip = {
  intro: 'A day out on the farm for corporate teams, organizations, families, friends, ladies, societies and schools. Move, learn where real food comes from, and eat a traditional meal together.',
  audience: ['Corporate teams', 'Organizations', 'Families', 'Friends', 'Ladies groups', 'Societies', 'Schools'],

  highlights: [
    {
      icon: 'dumbbell', title: 'Outdoor fitness',
      text: 'Group activities to improve fitness levels for everyone.',
      items: ['Trekking', 'Run / race for kids', 'Short hill trek and picnic for kids', 'Yoga', 'Core strength', 'Balancing workouts'],
    },
    {
      icon: 'leaf', title: 'Simple farming project',
      text: 'Learn farming by actually practising it, and experience organic farming, village culture and Indian healthy cuisine.',
      items: ['Fishing', 'Honey', 'Fruits, greens and vegetables', 'Group exercises with different people', 'Lectures on food, health and nutrition'],
    },
    {
      icon: 'book', title: 'Traditional meals and recipes',
      text: 'Eat what the region eats, and take the recipes home.',
      items: ['One healthy snack', 'One drink', 'One regional meal'],
    },
    {
      icon: 'users', title: 'Special focus on kids',
      text: 'Introducing children to farms and real food, so they know where their meals come from.',
      items: ['Farm and animal time', 'Kids run / race and short hill trek', 'Picnic'],
    },
  ],

  fresh: {
    title: 'Fresh, natural produce',
    text: 'You get what you grow. In addition, premium produce such as fruits, vegetables, greens, rice and oils from the farm is shared as per availability.',
    market: 'Farmers market (optional): for every session, local farmers are invited to bring their fresh produce and you can buy it directly from them.',
    impact: 'Contribute to the local farmers by buying their products directly from them.',
  },

  fun: [
    { icon: 'play', title: 'Fun rides', items: ['Tractor ride', 'Bull cart', 'Horse'] },
    { icon: 'heart', title: 'Pet time', items: ['Cow', 'Dog', 'Horse', 'Ducks', 'Rabbits'] },
  ],

  schedule: {
    when: 'One pre-decided Sunday every month',
    time: '8 am to 12 pm',
    options: 'Sign up for a full year, or for any special Sunday.',
    steps: [
      { title: 'A snack', text: 'Start the morning with a light, healthy snack.' },
      { title: 'Farm activity', text: 'Get hands-on: farming, exercises and outdoor fun.' },
      { title: 'Gyan session', text: 'A short session on food and farming.' },
      { title: 'Traditional meal', text: 'Sit down to a regional meal together.' },
      { title: 'Food market', text: 'Buy fresh produce straight from local farmers.' },
    ],
  },

  booking: {
    price: '₹10,000',
    priceNote: '2 visits for 3 members. Valid for a month. Negotiable for group packages.',
    rules: [
      'Booking has to be done at least 15 days prior.',
      'The amount, once paid, is non-refundable and non-transferable.',
    ],
  },
};
