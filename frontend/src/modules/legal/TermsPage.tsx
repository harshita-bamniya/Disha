import LegalLayout, { CONTACT_EMAIL, LEGAL_ENTITY, type LegalSection } from './LegalLayout'

const sections: LegalSection[] = [
  {
    title: 'About the service',
    body: [
      `BeginablAI ("we", "us") is operated by ${LEGAL_ENTITY}. The platform helps former UPSC aspirants understand their skills, build resumes, explore roadmaps and apply to roles, and helps employers discover and hire them.`,
      'By creating an account or using the platform you agree to these Terms. If you do not agree, please do not use the service.',
    ],
  },
  {
    title: 'Eligibility and your account',
    body: [
      'You must be at least 18 years old and able to enter a binding contract under Indian law.',
      [
        'Provide accurate information and keep it up to date.',
        'Keep your password confidential; you are responsible for activity under your account.',
        'One person, one account. Tell us promptly if you suspect unauthorised access.',
      ],
    ],
  },
  {
    title: 'AI-generated guidance',
    body: [
      'Resume scores, job-match scores, roadmaps, interview feedback and counselling responses are generated with the help of AI. They are guidance only, may contain errors, and are not a guarantee of any hiring, interview or career outcome.',
      'Please review all AI-generated content before relying on or sharing it.',
    ],
  },
  {
    title: 'Your content',
    body: [
      'You keep ownership of the resumes, profile details and other content you upload. You grant us a limited licence to store, process and display it as needed to run the service — including analysing it with AI, and sharing your profile with employers where you choose to apply or make it visible.',
      'You must not upload content that is unlawful, infringing, misleading or that belongs to someone else without permission.',
    ],
  },
  {
    title: 'For employers',
    body: [
      [
        'Employer accounts may require company verification before posting jobs or viewing candidates.',
        'Job postings must be genuine, lawful and non-discriminatory. Do not charge candidates for applying or being hired.',
        'Candidate data may be used only for recruitment by your organisation and must not be resold or used for unrelated marketing.',
      ],
    ],
  },
  {
    title: 'Acceptable use',
    body: [
      'You agree not to:',
      [
        'scrape, reverse engineer or overload the platform, or bypass its security or usage limits;',
        'impersonate others or submit false credentials or experience;',
        'harass other users or use the platform to send spam;',
        'use the service for any unlawful purpose.',
      ],
    ],
  },
  {
    title: 'Plans, credits and payments',
    body: [
      'Some features are limited by plan or usage credits. Paid plans, where offered, are billed as shown at purchase. Fees are non-refundable except where required by law or stated otherwise at purchase.',
    ],
  },
  {
    title: 'Suspension and termination',
    body: [
      'You may delete your account at any time from your settings. We may suspend or close accounts that breach these Terms or put other users or the platform at risk.',
    ],
  },
  {
    title: 'Disclaimers and liability',
    body: [
      'The service is provided "as is" and "as available". To the extent permitted by law, we are not liable for indirect or consequential loss, or for decisions made by employers or candidates on the platform. Nothing in these Terms limits liability that cannot be limited by law.',
    ],
  },
  {
    title: 'Changes to these Terms',
    body: ['We may update these Terms from time to time. Material changes will be notified in the product or by email. Continued use after the change means you accept the updated Terms.'],
  },
  {
    title: 'Governing law and contact',
    body: [
      'These Terms are governed by the laws of India. Courts at [city — to be added] have exclusive jurisdiction.',
      `Questions? Contact us at ${CONTACT_EMAIL}.`,
    ],
  },
]

export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms & Conditions"
      intro="Please read these Terms carefully. They set out the rules for using BeginablAI as a candidate or as an employer."
      sections={sections}
    />
  )
}
