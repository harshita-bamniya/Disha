import LegalLayout, { CONTACT_EMAIL, LEGAL_ENTITY, type LegalSection } from './LegalLayout'

const sections: LegalSection[] = [
  {
    title: 'Who we are',
    body: [
      `${LEGAL_ENTITY} ("we", "us") operates BeginablAI and is the data fiduciary for the personal data described here, under India's Digital Personal Data Protection Act, 2023 (DPDP Act).`,
    ],
  },
  {
    title: 'Data we collect',
    body: [
      [
        'Account data: email address, password (stored hashed), phone number (collected after email verification), preferred language.',
        'Profile data: education, UPSC journey, skills, work history, preferences and other details you enter during onboarding.',
        'Uploaded content: resumes and documents, and the text we extract from them.',
        'Usage data: pages and features used, device and browser information, IP address, and security logs.',
        'Employers: company details, verification documents, team members and job postings.',
      ],
    ],
  },
  {
    title: 'Why we use it',
    body: [
      [
        'To create and secure your account and verify your email.',
        'To provide the service: resume analysis, job matching, roadmaps, interview practice and counselling.',
        'To let employers you apply to, or choose to be visible to, review your profile.',
        'To send service emails such as verification codes, application updates and announcements.',
        'To prevent fraud and abuse, and to improve the platform.',
      ],
    ],
  },
  {
    title: 'AI processing',
    body: [
      'To power AI features we send relevant parts of your content (for example resume text) to third-party AI providers acting as our processors. We share only what is needed for the feature you use, and we do not allow these providers to sell your data.',
    ],
  },
  {
    title: 'Who we share it with',
    body: [
      [
        'Employers — only when you apply, or where you have made your profile visible.',
        'Service providers — hosting, email delivery, AI processing, analytics and security, under confidentiality obligations.',
        'Authorities — when required by law or to protect rights and safety.',
      ],
      'We do not sell your personal data.',
    ],
  },
  {
    title: 'Retention',
    body: [
      'We keep your data while your account is active and for a limited period afterwards where needed for legal, security or dispute purposes. When you delete your account, we delete or anonymise your personal data unless the law requires us to keep it.',
    ],
  },
  {
    title: 'Your rights',
    body: [
      'Under the DPDP Act you may:',
      [
        'access a summary of the personal data we hold about you;',
        'correct or update inaccurate data (most of it can be edited in your profile);',
        'request erasure of your data and close your account;',
        'withdraw consent at any time, and nominate someone to exercise your rights;',
        'raise a grievance with us and, if unresolved, with the Data Protection Board of India.',
      ],
    ],
  },
  {
    title: 'Security',
    body: [
      'We use encryption in transit, hashed passwords, access controls, rate limiting and reCAPTCHA to protect your data. No system is perfectly secure; please use a strong, unique password.',
    ],
  },
  {
    title: 'Cookies and similar technologies',
    body: ['We use essential cookies and local storage to keep you signed in and remember preferences, and Google reCAPTCHA to protect sign-up and login from abuse.'],
  },
  {
    title: 'Children',
    body: ['BeginablAI is intended for adults aged 18 and over. We do not knowingly collect data from children.'],
  },
  {
    title: 'Changes and contact',
    body: [
      'We may update this policy and will notify you of material changes. For requests or grievances, contact our Grievance Officer: [name — to be added].',
      `Email: ${CONTACT_EMAIL}`,
    ],
  },
]

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      intro="This policy explains what personal data BeginablAI collects, how we use it, and the choices you have."
      sections={sections}
    />
  )
}
