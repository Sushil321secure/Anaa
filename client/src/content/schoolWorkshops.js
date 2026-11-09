// School Wellness Workshops: content carried over from the previous Anaa website (rewritten for readability, nothing dropped).
export const school = {
  intro: 'Nutrition and wellness programmes for schools: learning through play for children, and practical support for teachers and parents.',

  groups: [
    {
      icon: 'users', title: 'For students',
      items: [
        { title: 'Food play and nutrition game workshops', text: 'Awareness of healthy eating through games and worksheets.' },
        { title: 'Nutrition lessons', text: 'Delivered according to school norms and certifications.' },
        { title: 'Health, fitness and nutrition assessments', text: 'Group or individual assessments.' },
      ],
    },
    {
      icon: 'book', title: 'For the school',
      items: [
        { title: 'Nutrition curriculum planning and implementation', text: 'Well-structured, detailed lesson plans, and we implement the curriculum if required.' },
        { title: 'Train teachers to take nutrition classes', text: 'So your own staff can carry the lessons forward.' },
        { title: 'Teacher health workshops', text: 'Online or offline.' },
      ],
    },
    {
      icon: 'heart', title: 'For parents',
      items: [
        { title: 'Nutritionist counselling for parents', text: 'Guidance on healthy eating and daily diets, online or offline.' },
        { title: 'Parent health workshops', text: 'Online or offline.' },
      ],
    },
  ],

  assessment: {
    title: 'Student health, fitness and nutrition assessments',
    text: 'Group and individual assessments are done, and health reports are generated.',
    note: 'Please note: student assessment is done only in offline mode.',
  },

  modes: [
    { label: 'Online or offline', text: 'Parent and teacher workshops and parent counselling' },
    { label: 'Offline only', text: 'Student assessments, with health reports' },
  ],
};
