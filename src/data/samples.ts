/**
 * Sample job postings for the one-click demo. Both are fictional.
 * The clean one is a realistic remote support role; the scammy one carries
 * the exact signals the scam check is built to catch.
 */

export const SAMPLE_JOBS = [
  {
    id: 'clean-support',
    label: 'Clean listing: Customer Support Associate (remote)',
    text: [
      'Customer Support Associate (Remote, India)',
      'Northwind Support Services is hiring a Customer Support Associate to join our remote team.',
      '',
      'About the role',
      'You will answer customer emails and live chat, troubleshoot common issues, and document solutions in our knowledge base.',
      '',
      'Must have skills',
      '- Customer support and email support experience, or a strong willingness to learn',
      '- Clear written communication in English',
      '- Excel and Google Sheets for tracking tickets',
      '- Documentation skills',
      '',
      'Nice to have skills',
      '- Experience with Zendesk or Freshdesk',
      '- Basic HTML and CSS',
      '',
      'Location: Remote, anywhere in India. Work from home.',
      'Salary: Rs. 25,000 - 32,000 per month',
      'Apply by: Dec 15, 2026',
      'Apply on our careers page: https://northwind.example.com/careers',
    ].join('\n'),
  },
  {
    id: 'scam-data-entry',
    label: 'Scammy listing: Data Entry, earn from home',
    text: [
      'DATA ENTRY WORK FROM HOME - Earn Rs. 45,000 per week!!!',
      'No experience needed, anyone can apply. Immediate joining, work from your mobile.',
      '',
      'Simple form filling and copy paste work. Type 50 pages per day from home.',
      '',
      'To start, pay a refundable registration fee of Rs. 1,500. Training fee Rs. 999 extra.',
      '',
      'Contact only on WhatsApp: message us on WhatsApp for details. No interview.',
      'Send your CV to fastjobs2026@gmail.com',
      '',
      'Earn up to Rs. 2,00,000 per month. Limited seats!',
    ].join('\n'),
  },
] as const;
