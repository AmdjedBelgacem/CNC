/**
 * Question-and-answer content, defined once and used in two places: rendered as visible
 * HTML on the page, and serialised to `FAQPage` schema.
 *
 * The homepage had an `h2` reading "Frequently Asked Questions" whose sibling headings were
 * stat tiles and academy names ("5", "13", "$0", "CNC Machining Academy") — so nothing on
 * the page was actually shaped like an answer, and nothing could be extracted as one.
 *
 * Keeping the pairs here means the visible copy and the structured data cannot drift apart,
 * which is the usual way FAQ markup ends up describing content that is not on the page.
 */

export interface FaqItem {
  question: string;
  answer: string;
}

export const HOMEPAGE_FAQ: FaqItem[] = [
  {
    question: 'What is Baroot CNC Solutions?',
    answer:
      'Baroot CNC Solutions is a manufacturing-education company that teaches CNC machining through simulation-first courses. Learners practise on a digital twin of a machine before touching metal, so they build tolerance and fixturing intuition without wasting a shift or a part.',
  },
  {
    question: 'Who are the CNC machining courses for?',
    answer:
      'The courses suit machinists moving from manual work to CNC, engineers who need to speak the shop floor fluently, and production teams standardising how they setup, program and inspect parts. Each course states its difficulty level and prerequisites before you enrol.',
  },
  {
    question: 'Do I need my own CNC machine to take a course?',
    answer:
      'No. Every course is simulation-first: the tooling, workholding, feeds and speeds are modelled in software, so you can complete the practical exercises on a laptop. If you do have machine access, the same material transfers directly to the shop floor.',
  },
  {
    question: 'What does a course certificate cover?',
    answer:
      'A certificate is issued on completion of the course material and its knowledge checks. It records the course, the competency level and the date of completion, and is intended as evidence of training rather than as a substitute for a formal qualification.',
  },
  {
    question: 'How long does it take to finish a course?',
    answer:
      'Courses are self-paced and list an estimated hour count on the course page. Most learners spread the material over several weeks alongside shop work; progress is saved automatically, so you can stop and resume without losing your place.',
  },
  {
    question: 'Are the courses suitable for a complete beginner?',
    answer:
      'Yes. Start with the CNC Machining Academy fundamentals track, which assumes no prior machining experience and builds from tool geometry and workholding through to your first finished part. More experienced machinists can enter at the intermediate or advanced path.',
  },
  {
    question: 'Does Baroot CNC Solutions offer team or institutional training?',
    answer:
      'Yes. Organisations can purchase structured training for a cohort, with the material delivered to a shared cohort rather than to individual seats. See the educational and institutional purchasing page for pricing and enrolment details.',
  },
];
