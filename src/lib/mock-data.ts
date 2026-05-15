export const mockCourses = [
  {
    id: "course-foundations",
    title: "Course Design Foundations",
    slug: "course-design-foundations",
    subtitle: "Build learning paths that students finish.",
    description:
      "A practical course for creators turning expertise into structured lessons, assessments, and durable learning outcomes.",
    priceCents: 0,
    currency: "usd",
    status: "PUBLISHED",
    level: "Beginner",
    durationMinutes: 190,
    instructor: { name: "Mara Ellis", imageUrl: "" },
    sections: [
      {
        title: "Structure",
        lessons: [
          { id: "lesson-outcomes", title: "Write useful outcomes" },
          { id: "lesson-map", title: "Map modules to progress" },
        ],
      },
    ],
  },
  {
    id: "course-cohort",
    title: "Running a Calm Cohort",
    slug: "running-a-calm-cohort",
    subtitle: "Operate a course without burying yourself in admin.",
    description:
      "Templates and operating practices for cohorts, student support, feedback loops, and completion tracking.",
    priceCents: 7900,
    currency: "usd",
    status: "PUBLISHED",
    level: "Intermediate",
    durationMinutes: 260,
    instructor: { name: "Theo Ward", imageUrl: "" },
    sections: [
      {
        title: "Operations",
        lessons: [
          { id: "lesson-calendar", title: "Create the cohort calendar" },
          { id: "lesson-feedback", title: "Design feedback rituals" },
        ],
      },
    ],
  },
  {
    id: "course-saas",
    title: "LMS SaaS Starter",
    slug: "lms-saas-starter",
    subtitle: "Use Athenemy as the base for a focused course business.",
    description:
      "A founder-oriented path covering catalog design, pricing, checkout, dashboards, and owner-operated support.",
    priceCents: 14900,
    currency: "usd",
    status: "PUBLISHED",
    level: "Advanced",
    durationMinutes: 330,
    instructor: { name: "Nia Patel", imageUrl: "" },
    sections: [
      {
        title: "Business system",
        lessons: [
          { id: "lesson-offer", title: "Shape the course offer" },
          { id: "lesson-retention", title: "Track retention signals" },
        ],
      },
    ],
  },
];

export const dashboardStats = [
  { label: "Active enrollments", value: "128" },
  { label: "Published courses", value: "9" },
  { label: "Completion rate", value: "72%" },
  { label: "Revenue this month", value: "$8,420" },
];
