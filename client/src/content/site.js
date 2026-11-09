// Business contact details (taken from the approved site design). Update here only.
export const contact = {
  phone: '+91 73497 20437',
  phoneHref: 'tel:+917349720437',
  email: 'reach@anaanutricare.com',
  location: 'Bengaluru, India',
  // Registered address from the original website.
  address: [
    'Anaa My Health Nutricare Services, Nutritionist/Dietician',
    'Best Diet & Health Clinic, Grand Club House, Golden Grand Club',
    'Raghavendra Rao Road, Pipeline Road, Yeswanthpur',
    'Bengaluru, Karnataka 560022',
  ],
  tagline: 'We help you change the way you feel',
  motto: 'Good Nutrition. Better Life.',
};

// Official profiles. An icon is shown only when its URL is set.
export const social = {
  facebook: 'https://www.facebook.com/people/Anaa-Nutricare/100078797778769/',
  instagram: 'https://www.instagram.com/anaa_nutricare_myhealth/',
  youtube: 'https://www.youtube.com/@anaamyhealthnutritionservi396/videos',
  linkedin: 'https://www.linkedin.com/in/dt-arpitha-nutritionist-b4931b18b',
  // Click-to-chat link to the business WhatsApp number (a plain link; no WhatsApp API is used).
  whatsapp: 'https://wa.me/917349720437',
};

export const highlights = [
  { title: 'Personalized Nutrition Plans', text: 'For your lifestyle & goals', icon: 'leaf' },
  { title: 'Expert Guidance', text: 'By certified nutritionists', icon: 'users' },
  { title: 'Ongoing Support', text: 'For a healthier tomorrow', icon: 'heart' },
];

export const programCards = [
  { title: 'Diet Consultation', text: 'One-to-one consultation for personalized diet plans', to: '/services#diet', img: '/images/services/diet-consultation.webp', icon: 'user' },
  { title: 'Wellness Packages', text: 'Structured plans for long term health and wellness', to: '/packages', img: '/images/packages/wellness.webp', icon: 'dumbbell' },
  { title: 'Specialized Programs', text: 'Nutrition support for different health goals', to: '/services#diet', img: '/images/services/specialized-programs.webp', icon: 'leaf' },
  { title: 'Public Health & Nutrition Awareness', text: 'Education and awareness for healthier communities', to: '/services#public-health', img: '/images/about/awareness.webp', icon: 'users' },
];

export const whyChoose = [
  { icon: 'user', title: 'Truly personalized', text: 'Every plan starts with your health goals, food preferences, routine and budget.' },
  { icon: 'shield', title: 'Certified nutritionists', text: 'Guidance from qualified professionals who explain the why behind every recommendation.' },
  { icon: 'video', title: 'Online or in person', text: 'Consult from home through secure video consultations, at times that suit you.' },
  { icon: 'chart', title: 'Progress you can see', text: 'Track meals and measurements and review them with your nutritionist.' },
  { icon: 'book', title: 'Practical diet plans', text: 'Easy, everyday meal plans you can download and follow with familiar food.' },
  { icon: 'heart', title: 'Long-term support', text: 'Regular follow-ups keep you motivated well beyond the first consultation.' },
];

// Diet consultation services: the 16 on the original website, in the original order.
// Descriptions for Corporate, Student and Lactating-mother nutrition are neutral placeholders until the
// owner supplies the original page copy.
export const dietServices = [
  { title: 'Sports Nutrition', text: 'Fuel, recovery and performance for active lifestyles.', alt: 'Athlete drinking water after a workout at the gym' },
  { title: 'Child Nutrition', text: 'Healthy habits and balanced meals for growing children.', alt: 'Mother and daughter preparing a healthy meal together' },
  { title: 'Renal Diet', text: 'Diet planning for kidney health, with your doctor\'s guidance.', alt: 'Dietitian discussing food choices with a client' },
  { title: 'Diabetic Diet', text: 'Meal guidance for healthy blood sugar management.', alt: 'Fruit bowl and a nutrition checklist on a table' },
  { title: 'Weight Management', text: 'Sustainable weight loss and gain without crash diets.', alt: 'Woman preparing a fresh salad in her kitchen' },
  { title: 'Pregnancy Nutrition', text: 'Nourishing food guidance through pregnancy.', alt: 'Pregnant woman preparing fresh food in her kitchen' },
  { title: 'Fertility Nutrition', text: 'Food choices that support reproductive health.', alt: 'Couple in a calm consultation room with a professional' },
  { title: 'Corporate Nutrition', text: 'Nutrition guidance for working professionals and teams.', alt: 'Two colleagues talking at a work table' },
  { title: 'Night Shift Nutrition', text: 'Eating well when your schedule works against you.', alt: 'Professional having a salad while working at a desk' },
  { title: 'Diet For Lactating Mothers', text: 'Nourishing food guidance for mothers who are breastfeeding.', alt: 'Parents holding their newborn baby at home' },
  { title: 'Seniors Nutrition', text: 'Nutrition to support strength and energy in later life.', alt: 'Older adults and a grandchild sharing a healthy breakfast' },
  { title: 'Auto-Immune Diseases Diet Therapy', text: 'Anti-inflammatory food guidance for autoimmune conditions.', alt: 'Dietitian discussing nutrition with a client' },
  { title: 'Student Nutrition', text: 'Balanced eating habits for students and busy study routines.', alt: 'Young woman enjoying a healthy lunch bowl outdoors' },
  { title: 'Onco Nutrition', text: 'Supportive nutrition during cancer treatment and recovery.', alt: 'Dietitian in a supportive nutrition consultation' },
  { title: 'Irritable Bowel Syndrome (IBS)', text: 'Dietary support for digestive comfort.', alt: 'Dietitian discussing a meal plan with a client' },
  { title: 'PCOD/PCOS and Thyroid Issues', text: 'Nutrition support for hormonal balance, alongside medical care.', alt: 'Dietitian taking notes during a nutrition consultation' },
];

// Fitness and wellness programmes: descriptions are the original website wording.
export const fitnessPrograms = [
  {
    title: "Quick Health & Fitness Assessments",
    text: "A fitness assessment identifies your current fitness levels and serves as a baseline, or starting point of your body's fitness.",
    overview: [
      "A fitness assessment identifies your current fitness levels and serves as a baseline, or starting point of your body's fitness."
    ],
    sections: [
      {
        title: "Fitness assessment & suggestions",
        items: [
          "BMI",
          "Balancing test",
          "Abdominal muscular strength & endurance",
          "Muscular endurance",
          "Cardiovascular endurance",
          "Flexibility"
        ]
      },
      {
        title: "Nutritional assessment & counselling",
        items: [
          "24 hr. dietary recall",
          "Food frequency analysis",
          "Calorie consumption & calorie requirement"
        ]
      }
    ],
    ageGroups: "8 years & above"
  },
  {
    title: "Face Yoga",
    text: "Face yoga, which includes specific exercises and massages targeting the face, may strengthen skin and reduce signs of aging, amongst other benefits.",
    overview: [
      "Our experts guide the session with an array of facial exercises that strengthen specific facial muscles.",
      "A special weekly session focuses on particular areas of the face, and weekly health tips for healthy-looking skin are shared."
    ],
    sections: [
      {
        title: "Benefits",
        items: [
          "Reducing the appearance of wrinkles",
          "Improving blood circulation",
          "Releasing tension in the face and neck",
          "Firming and tightening facial skin"
        ]
      },
      {
        title: "The weekly special session focuses on",
        items: [
          "Double chin",
          "Puffiness around the eyes",
          "Crow's feet",
          "Laughing lines",
          "Droopy eyes"
        ]
      }
    ],
    ageGroups: "18 Years & above"
  },
  {
    title: "Tabata",
    text: "This form of workout puts a lot of stress on your body and as a result, you burn more calories in a short period of time.",
    overview: [
      "Tabata is HIIT (high-intensity interval training), a highly active workout session which is helpful to increase strength, stamina and endurance.",
      "This workout is suggested for weight loss and maintenance. It helps to burn fat by giving a high-intensity (20 sec) workout with short breaks (10 sec); as a result you burn more calories in a short period of time."
    ],
    sections: [
      {
        title: "The Tabata rhythm",
        items: [
          "High-intensity work: 20 seconds",
          "Short break: 10 seconds"
        ]
      }
    ],
    ageGroups: "15 Years & above"
  },
  {
    title: "Pain Relief Yoga",
    text: "It can help people who have pain related conditions such as arthritis, joint pain, fibromyalgia, migraine headaches and chronic fatigue syndrome.",
    overview: [
      "Yoga can help people with shoulder pain, knee pain, lower back pain, and many other types of chronic pain conditions. Pain relief workshops work on various pain points of the body."
    ],
    sections: [
      {
        title: "How the sessions work",
        items: [
          "Our expert instructors guide the session with simple yoga asanas",
          "A combination of strengthening stretches, breathing techniques, and stretching to increase blood circulation and reduce pain",
          "Props yoga & exercise techniques are taught to reduce pain",
          "Special health tips & workout routines are given for maintenance"
        ]
      }
    ],
    ageGroups: "18 Years & above"
  },
  {
    title: "Zumba",
    text: "Zumba is an interval workout. The classes move between high- and low-intensity dance moves designed to get your heart rate up and boost cardio endurance.",
    overview: [
      "Zumba workout is perfect for all age groups.",
      "A total body workout, combining all elements of fitness. It makes you happy, helps you de-stress, and tones your entire body. It helps maintain a healthy weight, lose body fat and increase energy levels."
    ],
    sections: [
      {
        title: "Combines all elements of fitness",
        items: [
          "Cardio",
          "Muscle conditioning",
          "Balance",
          "Flexibility"
        ]
      }
    ],
    ageGroups: "18 Years & above"
  },
  {
    title: "Walking Workout",
    text: "Walking Workout is a combination of Bollywood music and walking exercises. Walking Workout consumes a greater number of calories.",
    overview: [
      "Walking Workout is a combination of Bollywood music and walking exercises. Walking Workout consumes a greater number of calories than a walk around the park.",
      "It's a series of multi-muscle moves. All exercises are customized to achieve higher output with simple basic exercises on the beats of Bollywood music.",
      "Higher muscle engagement leads to higher calorie burn. These exercises are simple and easy on the body and the joints. It's a powerful approach to a healthy you."
    ],
    batch: "Special batch for 45 years & above"
  },
  {
    title: "Advanced/Intermediate Yoga",
    text: "Advanced yoga, specially designed for people who are already practising yoga and wish to transform themselves.",
    overview: [
      "Advanced yoga, specially designed for people who are already practising yoga and wish to transform themselves."
    ],
    ageGroups: "18 Years & above"
  },
  {
    title: "Seniors Wellness Program",
    text: "Seniors are encouraged to adopt a healthy diet, exercise regularly, become socially active, and work on stress relief.",
    overview: [
      "Specially designed for seniors, consisting of mild yoga. The aim is overall well-being and support with issues such as depression.",
      "Weekly health and nutrition tips are included."
    ],
    sections: [
      {
        title: "The programme includes",
        items: [
          "Gentle yoga",
          "Chair-based exercises",
          "Pain relief exercises using props",
          "Strengthening work for spondylitis",
          "Eye health exercises",
          "Posture",
          "Bladder control",
          "Breathing techniques",
          "Meditation",
          "Laughter therapy"
        ]
      }
    ],
    ageGroups: "Above 55 Years"
  },
  {
    title: "Kids Wellness Program",
    text: "It gives us physical strength, mental relaxation, and social importance all over the place. It also makes everyone productive.",
    overview: [
      "Kids' monthly sessions are designed specifically for cardiovascular endurance, aerobic capacity, muscular strengthening and weight management (tracked & monitored for progress).",
      "We also conduct frequent kids' health workshops which include awareness about food, nutrition, traditional games, and healthy eating."
    ],
    sections: [
      {
        title: "Monthly sessions include",
        items: [
          "Katha yoga",
          "Kids Tabata",
          "Kids Zumba",
          "Self-defence",
          "Nutrition games",
          "Functional training"
        ]
      },
      {
        title: "Workshops & monthly sessions include",
        items: [
          "Fitness assessment & suggestions",
          "Nutritional assessment & counselling",
          "Katha yoga",
          "Health workshops",
          "Kids Tabata",
          "Kids Zumba"
        ]
      }
    ]
  }
];

// Original brand messaging (the three banner slides of the previous website).
export const brandMessages = [
  { kicker: 'Professional Nutritionist', title: 'Proper exercise and a great eating routine', text: 'Unlock your potential with good nutrition. Good Nutrition is our Mission.' },
  { kicker: 'Professional Nutritionist', title: 'Good nourishment will always make you feel your best constantly.', text: 'Make sustainable long-term changes to improve your health with good nutrition.' },
  { kicker: 'Professional Nutritionist', title: 'Eat healthy to live healthy every day', text: 'We are passionate about helping individuals improve their health and well-being.' },
];

// About Us: the original positioning (individual behaviour change, not quick fixes).
export const aboutStory = [
  'When it comes to what to eat, it can seem confusing. Anaa My Health Nutricare focuses on building healthy behaviours into your lifestyle, rather than offering a quick fix. We are dedicated to helping you to the best of our ability and achieving excellence in all that we do.',
  'We exist to set people free from food stress and teach them how to eat well for the rest of their life. We work with clients to build a healthy relationship with food.',
  'We offer individualised nutrition support and advice for a wide range of conditions, helping clients make sustainable, healthy lifestyle changes.',
];

export const slugify = (t) => t.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const programSlug = (p) => slugify(p.title);

// Public health and nutrition awareness (original website menu).
export const awareness = [
  { title: 'Corporate Nutrition Awareness', text: 'Nutrition awareness sessions for teams and companies.' },
  { title: 'School Nutrition Awareness', text: 'Healthy-eating awareness for school children and students.' },
  { title: 'Wellness Trip', text: 'A monthly Sunday farm trip with fitness, farming, a traditional meal and fresh produce, for families, friends, corporates, societies and schools.', to: '/wellness-trip' },
];

// Workshops, kept separate from awareness.
export const workshops = [
  { title: 'Corporate Workshops', text: 'Group and individual workshops and webinars for teams: health talks, yoga, Tabata, Zumba, healthy cooking and a 3-day wellness package.', to: '/corporate-workshops' },
  { title: 'School Wellness Workshops', text: 'Nutrition games, lessons and curriculum, teacher training, parent workshops and student health assessments for schools.', to: '/school-wellness-workshops' },
  { title: 'Wellness Trip', text: 'A monthly Sunday farm trip with fitness, farming, a traditional meal and fresh produce, for families, friends, corporates, societies and schools.', to: '/wellness-trip' },
];

export const steps = [
  { title: 'Request a discovery call', text: 'Tell us your goal and preferred time. Our team will reach out to confirm a slot.' },
  { title: 'Get your personalized plan', text: 'Your nutritionist builds a plan around your lifestyle, preferences and goals.' },
  { title: 'Stay supported', text: 'Follow-ups and progress reviews keep you on track for the long term.' },
];

export const faqs = [
  { q: 'What is a free discovery call?', a: 'A short introductory conversation where you share your health or wellness goal and we explain how we can help. Submit the request form with your preferred time; our team will contact you to confirm a slot. A requested time is not confirmed until the team approves it.' },
  { q: 'Who will guide me?', a: 'Certified nutritionists at Anaa Nutricare guide you through personalized diet plans and follow-ups.' },
  { q: 'Do you offer online consultations?', a: 'Yes. Customers can book consultations and join them online from their portal. Appointment availability is set by our team.' },
  { q: 'Is the advice a substitute for medical care?', a: 'No. Our nutrition guidance is meant to complement, not replace, advice from your doctor. If you have a medical condition, please continue to follow your doctor\'s treatment.' },
  { q: 'How do I see pricing?', a: 'Service and package prices are shown on the Services and Wellness Packages pages. If a price is not shown, contact us and we will share it.' },
  { q: 'How can I contact you?', a: `Call ${'+91 73497 20437'}, email reach@anaanutricare.com, or use the Contact page. We are based in Bengaluru, India.` },
];

export const navItems = [
  { label: 'Home', to: '/', end: true },
  { label: 'About Us', to: '/about' },
  { label: 'Programs', to: '/services#fitness', children: () => [
    ...fitnessPrograms.map((p) => ({ label: p.title, to: '/programs/' + programSlug(p) })),
  ] },
  { label: 'Public Health & Nutrition Awareness', short: 'Public Health', to: '/services#public-health', children: () => awareness.map((a) => ({ label: a.title, to: a.to || '/services#' + programSlug(a) })) },
  { label: 'Diet Consultation', to: '/services#diet', children: () => [
    { label: 'Free Discovery Call', to: '/discovery-call' },
    { label: 'Book a consultation', to: '/book-consultation' },
    { label: 'All 16 consultation services', to: '/services#diet' },
    { label: 'FAQs', to: '/faqs' },
  ] },
  { label: 'Online Yoga', to: '/online-yoga' },
  { label: 'Wellness Packages', to: '/packages' },
  { label: 'Contact Us', to: '/contact' },
];

// Wellness Packages page: who the packages are written for, and everyday Indian and South Indian meal examples.
// Plans are built around what a person already eats; nothing here is a promised outcome.
export const packageAudiences = [
  { title: 'IT professionals & office workers', text: 'Plans that work around long sitting hours, back-to-back meetings, canteen lunches and late dinners.' },
  { title: 'PG residents & students', text: 'Practical guidance for mess food, tiffin services and tight budgets, with simple swaps you can actually make.' },
  { title: 'Working couples', text: 'One shared grocery list and meal rhythm that still respects each person\'s own goal.' },
  { title: 'Vegetarian & non-vegetarian', text: 'Plans are built for how you eat: dal, paneer, curd, eggs, fish or chicken, in the portions that suit you.' },
  { title: 'People who eat out often', text: 'Know what to order at a darshini, a food court or a restaurant, and how to balance the rest of your day.' },
];

export const packageMeals = [
  'Idli or dosa with sambar and chutney',
  'Ragi mudde or ragi dosa',
  'Rice with dal, sambar and a vegetable palya',
  'Millet khichdi or millet upma',
  'Paneer or egg bhurji with chapati',
  'Curd rice with a side of vegetables',
];

export const packageSteps = [
  { title: 'Choose a package', text: 'Pick the duration that fits your goal. Prices shown are what you pay, in rupees.' },
  { title: 'Pay securely', text: 'Payment is handled by Razorpay. Your package activates only after the payment is verified.' },
  { title: 'Book your consultations', text: 'Your remaining consultations and package expiry are always visible in your dashboard.' },
];
