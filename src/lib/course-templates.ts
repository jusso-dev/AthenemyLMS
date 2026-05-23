import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

export type DefaultCourseLesson = {
  title: string;
  minutes: number;
  content: string;
};

export type DefaultCourseAssessmentQuestion = {
  prompt: string;
  options: string[];
  correctIndex: number;
};

export type DefaultCourseTemplate = {
  id: string;
  category: string;
  title: string;
  slug: string;
  summary: string;
  lessons: DefaultCourseLesson[];
  assessment: DefaultCourseAssessmentQuestion[];
  certificatesEnabled: boolean;
  suggestedDurationMinutes: number;
  version: number;
  locale: string;
  tags: string[];
  requiredSuggestion: boolean;
};

export const defaultCourseTemplates = [
  {
    id: "cyber-security-awareness",
    category: "Security",
    title: "Cyber Security Awareness",
    slug: "cyber-security-awareness",
    summary:
      "Plain-English security training covering phishing, passwords, safe browsing, and reporting suspicious activity.",
    lessons: [
      lesson(
        "Why security matters",
        8,
        "Security protects learners, customers, colleagues, and the organisation. This lesson explains common business risks and reminds admins to add local security contacts where needed.",
      ),
      lesson(
        "Phishing and social engineering",
        10,
        "Review suspicious sender patterns, urgency, impersonation, and safe reporting. Replace [Insert your reporting channel] with your organisation's process.",
      ),
      lesson(
        "Passwords and MFA",
        8,
        "Use unique passwords, a password manager, and multi-factor authentication for work accounts. Never share one-time codes.",
      ),
      lesson(
        "Safe browsing and downloads",
        7,
        "Only install approved software, verify links before opening them, and report unexpected downloads or browser warnings.",
      ),
      lesson(
        "Reporting suspicious activity",
        7,
        "Learners should report quickly, preserve useful evidence, and avoid investigating beyond their role.",
      ),
    ],
    assessment: [
      question(
        "What is the best first action for suspected phishing?",
        [
          "Reply asking if it is legitimate",
          "Report it using the approved channel",
          "Forward it to colleagues",
        ],
        1,
      ),
      question(
        "What should you do with MFA codes?",
        [
          "Share them with IT on request",
          "Store them in a shared document",
          "Never share them with anyone",
        ],
        2,
      ),
    ],
    certificatesEnabled: true,
    suggestedDurationMinutes: 40,
    version: 1,
    locale: "en",
    tags: ["security", "onboarding", "required"],
    requiredSuggestion: true,
  },
  {
    id: "incident-response-basics",
    category: "Security",
    title: "Incident Response Basics",
    slug: "incident-response-basics",
    summary:
      "A practical introduction to spotting, preserving, and reporting workplace security incidents.",
    lessons: [
      lesson(
        "What counts as an incident",
        7,
        "Define security incidents with examples such as lost devices, accidental sharing, malware alerts, and suspicious logins.",
      ),
      lesson(
        "First actions",
        8,
        "Stop, preserve, and report. Do not delete evidence or attempt unapproved remediation.",
      ),
      lesson(
        "Who to notify and when",
        6,
        "Replace [Insert your escalation contact] with local teams, service desks, or managers.",
      ),
      lesson(
        "Evidence and screenshots",
        6,
        "Capture dates, screenshots, sender details, URLs, and affected systems when safe.",
      ),
      lesson(
        "After-action review",
        6,
        "Explain blameless review basics and how process improvements reduce repeat incidents.",
      ),
    ],
    assessment: [
      question(
        "Which action helps preserve evidence?",
        [
          "Delete suspicious messages",
          "Take screenshots when safe",
          "Restart every affected system immediately",
        ],
        1,
      ),
      question(
        "Incident reports should be made:",
        [
          "Only after the learner proves the cause",
          "Promptly using the approved channel",
          "At the next annual review",
        ],
        1,
      ),
    ],
    certificatesEnabled: true,
    suggestedDurationMinutes: 33,
    version: 1,
    locale: "en",
    tags: ["security", "incident-response"],
    requiredSuggestion: true,
  },
  {
    id: "acceptable-internet-email-usage",
    category: "Policy",
    title: "Acceptable Internet and Email Usage",
    slug: "acceptable-internet-email-usage",
    summary:
      "Editable acceptable-use training for company systems, email, attachments, and confidentiality expectations.",
    lessons: [
      lesson(
        "Company systems and responsible use",
        7,
        "Set expectations for work systems, monitoring notices, and approved business use. Add local policy links before publishing.",
      ),
      lesson(
        "Email etiquette and prohibited activity",
        8,
        "Cover respectful communication, prohibited content, and escalation paths.",
      ),
      lesson(
        "Attachments, links, and downloads",
        7,
        "Explain safe handling for attachments, cloud links, executable files, and unexpected QR codes.",
      ),
      lesson(
        "Personal use boundaries",
        5,
        "Admins should replace this placeholder with organisation-specific boundaries and examples.",
      ),
      lesson(
        "Confidentiality and data handling",
        8,
        "Reinforce minimum necessary access, approved sharing locations, and external recipient checks.",
      ),
    ],
    assessment: [
      question(
        "Before sending confidential data externally, learners should:",
        [
          "Check recipients and use approved sharing methods",
          "Use any convenient personal account",
          "Compress the file and skip review",
        ],
        0,
      ),
      question(
        "Policy placeholders should be:",
        [
          "Left as-is forever",
          "Customized before publishing",
          "Hidden from admins",
        ],
        1,
      ),
    ],
    certificatesEnabled: true,
    suggestedDurationMinutes: 35,
    version: 1,
    locale: "en",
    tags: ["policy", "email", "acceptable-use"],
    requiredSuggestion: true,
  },
  {
    id: "phishing-awareness",
    category: "Security",
    title: "Phishing Awareness",
    slug: "phishing-awareness",
    summary:
      "Scenario-oriented phishing training for urgency, impersonation, spoofed links, attachments, and QR-code risk.",
    lessons: [
      lesson(
        "Common phishing patterns",
        8,
        "Review payment requests, password resets, delivery notices, shared documents, and urgent leadership impersonation.",
      ),
      lesson(
        "Urgency and spoofed links",
        8,
        "Practice slowing down and checking sender domains, link destinations, and context.",
      ),
      lesson(
        "Attachment and QR-code risks",
        6,
        "Explain why attachments and QR codes can bypass normal visual checks.",
      ),
      lesson(
        "Reporting suspected phishing",
        5,
        "Replace [Insert your phishing reporting channel] with your internal process.",
      ),
      lesson(
        "Scenario quiz",
        8,
        "Walk through low-stakes examples and encourage reporting over guessing.",
      ),
    ],
    assessment: [
      question(
        "A message demanding immediate gift-card purchase is likely:",
        [
          "A normal procurement workflow",
          "A social engineering attempt",
          "Always safe if it names your manager",
        ],
        1,
      ),
      question(
        "Suspicious QR codes should be:",
        [
          "Scanned on a personal phone",
          "Reported through the approved channel",
          "Shared in group chat for opinions",
        ],
        1,
      ),
    ],
    certificatesEnabled: true,
    suggestedDurationMinutes: 35,
    version: 1,
    locale: "en",
    tags: ["security", "phishing"],
    requiredSuggestion: true,
  },
  {
    id: "password-mfa-hygiene",
    category: "Security",
    title: "Password and MFA Hygiene",
    slug: "password-mfa-hygiene",
    summary:
      "Focused starter training on unique passwords, password managers, MFA prompts, recovery codes, and shared-account risks.",
    lessons: [
      lesson(
        "Password basics",
        7,
        "Use unique passwords for each work service and avoid reusing personal passwords on organization systems.",
      ),
      lesson(
        "Password managers",
        7,
        "Explain approved password managers, vault hygiene, and how to share secrets only through approved workflows.",
      ),
      lesson(
        "MFA prompts and codes",
        8,
        "Learners should verify unexpected MFA prompts, deny suspicious approvals, and never share one-time codes.",
      ),
      lesson(
        "Recovery and lost devices",
        6,
        "Replace [Insert your account recovery channel] with the local help desk or identity team.",
      ),
      lesson(
        "Shared-account risks",
        5,
        "Discourage shared credentials and explain why individual accounts improve accountability and recovery.",
      ),
    ],
    assessment: [
      question(
        "Unexpected MFA prompts should be:",
        [
          "Approved to clear the notification",
          "Denied and reported if suspicious",
          "Ignored forever",
        ],
        1,
      ),
      question(
        "Work passwords should be:",
        [
          "Unique to each service",
          "The same as personal passwords",
          "Shared in chat for convenience",
        ],
        0,
      ),
    ],
    certificatesEnabled: true,
    suggestedDurationMinutes: 33,
    version: 1,
    locale: "en",
    tags: ["security", "passwords", "mfa"],
    requiredSuggestion: true,
  },
  {
    id: "data-privacy-confidential-information",
    category: "Privacy",
    title: "Data Privacy and Confidential Information",
    slug: "data-privacy-confidential-information",
    summary:
      "A neutral privacy and confidentiality starter course that admins can adapt to local policy and jurisdiction requirements.",
    lessons: [
      lesson(
        "What data needs protection",
        8,
        "Introduce personal, customer, financial, operational, and confidential business information without making legal claims.",
      ),
      lesson(
        "Sharing data internally and externally",
        8,
        "Use need-to-know sharing, approved systems, and recipient verification.",
      ),
      lesson(
        "Storing and deleting information",
        7,
        "Connect learners to [Insert your retention policy] and approved storage locations.",
      ),
      lesson(
        "Privacy incidents",
        6,
        "Explain accidental disclosure, lost devices, misdirected email, and prompt reporting.",
      ),
      lesson(
        "Knowledge check",
        5,
        "Confirm learners understand local reporting and approved handling basics.",
      ),
    ],
    assessment: [
      question(
        "Confidential information should be shared:",
        [
          "With anyone who asks politely",
          "Only through approved channels and with a need to know",
          "By personal email for convenience",
        ],
        1,
      ),
      question(
        "This starter course is:",
        [
          "A substitute for legal advice",
          "Editable training that should link to local policy",
          "Immutable global content",
        ],
        1,
      ),
    ],
    certificatesEnabled: true,
    suggestedDurationMinutes: 34,
    version: 1,
    locale: "en",
    tags: ["privacy", "confidentiality", "onboarding"],
    requiredSuggestion: true,
  },
] satisfies DefaultCourseTemplate[];

export type InstantiateTemplateInput = {
  organizationId: string;
  instructorId: string;
  templateId: string;
  required?: boolean;
  autoEnrollExisting?: boolean;
  autoEnrollFuture?: boolean;
};

export function getDefaultCourseTemplate(templateId: string) {
  return defaultCourseTemplates.find((template) => template.id === templateId);
}

export function defaultStarterTemplateIds() {
  return [
    "cyber-security-awareness",
    "phishing-awareness",
    "password-mfa-hygiene",
  ].filter((id) =>
    defaultCourseTemplates.some((template) => template.id === id),
  );
}

export class CourseTemplateAlreadyEnabledError extends Error {
  constructor(public courseId: string) {
    super(
      "This template is already enabled for the organisation. Edit the existing course instead.",
    );
    this.name = "CourseTemplateAlreadyEnabledError";
  }
}

export async function instantiateDefaultCourseTemplate(
  input: InstantiateTemplateInput,
) {
  const template = getDefaultCourseTemplate(input.templateId);
  if (!template) throw new Error("Default course template not found.");

  const existing = await prisma.course.findFirst({
    where: {
      organizationId: input.organizationId,
      sourceTemplateId: template.id,
      status: { not: "ARCHIVED" },
    },
    select: { id: true },
  });
  if (existing) {
    throw new CourseTemplateAlreadyEnabledError(existing.id);
  }

  await upsertCourseTemplate(template);

  const slug = await uniqueTemplateCourseSlug(
    input.organizationId,
    template.slug,
  );
  const required = input.required ?? template.requiredSuggestion;
  const course = await prisma.course.create({
    data: {
      title: template.title,
      slug,
      subtitle: template.summary,
      description: `${template.summary}\n\nAdmin note: customize all placeholders such as [Insert your reporting channel] before assigning this course. This starter content is training guidance, not legal advice.`,
      status: "DRAFT",
      certificatesEnabled: template.certificatesEnabled,
      durationMinutes: template.suggestedDurationMinutes,
      instructorId: input.instructorId,
      organizationId: input.organizationId,
      sourceTemplateId: template.id,
      sourceTemplateVersion: template.version,
      templateCategory: template.category,
      requiredForMembers: required,
      autoEnrollMembers: Boolean(input.autoEnrollExisting),
      autoEnrollFutureMembers: Boolean(input.autoEnrollFuture),
      sections: {
        create: {
          title: template.title,
          position: 0,
          lessons: {
            create: template.lessons.map((item, position) => ({
              title: item.title,
              slug: slugify(item.title),
              content: item.content,
              durationMinutes: item.minutes,
              position,
              preview: position === 0,
            })),
          },
        },
      },
      assessments: {
        create: {
          title: `${template.title} knowledge check`,
          description:
            "A short, editable check for understanding. It is not punitive by default.",
          passingScore: 70,
          requiredForCompletion: required,
          questions: {
            create: template.assessment.map((item, position) => ({
              prompt: item.prompt,
              options: item.options,
              correctIndex: item.correctIndex,
              position,
            })),
          },
        },
      },
    },
  });

  if (input.autoEnrollExisting) {
    await autoEnrollOrganizationMembers(input.organizationId, course.id);
  }

  return course;
}

export async function autoEnrollOrganizationMembers(
  organizationId: string,
  courseId: string,
) {
  const members = await prisma.organizationMembership.findMany({
    where: { organizationId },
    select: { userId: true },
  });
  if (members.length === 0) return { count: 0 };

  return prisma.enrollment.createMany({
    data: members.map((member) => ({
      userId: member.userId,
      courseId,
      status: "ACTIVE" as const,
    })),
    skipDuplicates: true,
  });
}

export async function autoEnrollFutureMember(input: {
  organizationId: string;
  userId: string;
}) {
  const courses = await prisma.course.findMany({
    where: {
      organizationId: input.organizationId,
      status: { not: "ARCHIVED" },
      autoEnrollFutureMembers: true,
    },
    select: { id: true },
  });
  if (courses.length === 0) return { count: 0 };

  return prisma.enrollment.createMany({
    data: courses.map((course) => ({
      userId: input.userId,
      courseId: course.id,
      status: "ACTIVE" as const,
    })),
    skipDuplicates: true,
  });
}

async function upsertCourseTemplate(template: DefaultCourseTemplate) {
  const data = {
    category: template.category,
    title: template.title,
    slug: template.slug,
    summary: template.summary,
    lessons: template.lessons as unknown as Prisma.InputJsonValue,
    assessment: template.assessment as unknown as Prisma.InputJsonValue,
    certificatesEnabled: template.certificatesEnabled,
    suggestedDurationMinutes: template.suggestedDurationMinutes,
    version: template.version,
    locale: template.locale,
    tags: template.tags,
    requiredSuggestion: template.requiredSuggestion,
  };

  return prisma.courseTemplate.upsert({
    where: { id: template.id },
    update: data,
    create: { id: template.id, ...data },
  });
}

async function uniqueTemplateCourseSlug(organizationId: string, base: string) {
  const normalized = slugify(base);
  const existing = await prisma.course.count({
    where: { organizationId, slug: { startsWith: normalized } },
  });
  return existing === 0 ? normalized : `${normalized}-${existing + 1}`;
}

function lesson(title: string, minutes: number, content: string) {
  return { title, minutes, content };
}

function question(prompt: string, options: string[], correctIndex: number) {
  return { prompt, options, correctIndex };
}
