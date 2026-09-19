import Link from 'next/link';
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#16181c]">
      {' '}
      <div className="pointer-events-none fixed inset-0">
        {' '}
        <div className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-[#f59e0b]/[0.025] blur-[120px]" />{' '}
        <div className="absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full bg-[#f59e0b]/[0.015] blur-[120px]" />{' '}
      </div>{' '}
      <div className="relative mx-auto flex min-h-screen max-w-[1400px] flex-col px-6 py-6">
        {' '}
        <div className="flex items-center justify-between">
          {' '}
          <Link
            href="/"
            className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#5c6068] transition-all duration-200 hover:text-[#f59e0b]"
          >
            {' '}
            ← Back{' '}
          </Link>{' '}
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-[#8b8f96] transition-all duration-200 hover:text-[#e8e8e8]"
          >
            {' '}
            TITANS{' '}
          </Link>{' '}
        </div>{' '}
        <div className="flex flex-1 items-center justify-center py-8">
          {' '}
          <div className="relative w-full overflow-hidden rounded-2xl border border-[#2a2e36] bg-[#1e2128]">
            {' '}
            <div className="pointer-events-none absolute -left-px -top-px z-10 h-8 w-8 rounded-tl-2xl border-l-2 border-t-2 border-[#f59e0b]/40" />{' '}
            <div className="pointer-events-none absolute -right-px -top-px z-10 h-8 w-8 rounded-tr-2xl border-r-2 border-t-2 border-[#f59e0b]/40" />{' '}
            <div className="pointer-events-none absolute -bottom-px -left-px z-10 h-8 w-8 rounded-bl-2xl border-b-2 border-l-2 border-[#f59e0b]/40" />{' '}
            <div className="pointer-events-none absolute -bottom-px -right-px z-10 h-8 w-8 rounded-br-2xl border-b-2 border-r-2 border-[#f59e0b]/40" />{' '}
            <div className="flex">
              {' '}
              <div className="min-h-[520px] flex-1 p-8 sm:p-10"> {children} </div>{' '}
              <div className="hidden w-px shrink-0 bg-[#2a2e36] lg:block" />{' '}
              <div className="hidden w-[420px] shrink-0 lg:flex lg:flex-col">
                {' '}
                <div
                  className="pointer-events-none absolute inset-0 opacity-[0.04]"
                  style={{
                    backgroundImage:
                      'radial-gradient(circle at 1px 1px, #f59e0b 1px, transparent 0)',
                    backgroundSize: '20px 20px',
                  }}
                />{' '}
                <div className="relative flex flex-1 flex-col items-center justify-center px-10 py-14">
                  {' '}
                  <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#f59e0b] text-sm font-bold text-[#16181c]">
                    {' '}
                    T{' '}
                  </div>{' '}
                  <h2 className="font-display mt-6 text-[36px] font-bold leading-[1.08] tracking-[-0.035em] text-[#e8e8e8]">
                    {' '}
                    TITANS of <br /> Manufacturing{' '}
                  </h2>{' '}
                  <div className="mt-5 h-[3px] w-14 rounded-full bg-[#f59e0b]" />{' '}
                  <p className="mt-5 text-sm leading-relaxed text-[#8b8f96]">
                    {' '}
                    Expert-led CNC manufacturing education, professional certifications, and a
                    community of modern machinists.{' '}
                  </p>{' '}
                </div>{' '}
                <div className="relative mx-10 border-t border-[#2a2e36]" />{' '}
                <div className="relative flex flex-1 flex-col items-center justify-center px-10 py-14">
                  {' '}
                  <div className="space-y-4">
                    {' '}
                    <p className="text-center text-[10px] font-bold uppercase tracking-[0.15em] text-[#f59e0b]">
                      {' '}
                      Platform Highlights{' '}
                    </p>{' '}
                    <div className="space-y-3">
                      {' '}
                      {[
                        ['Academic', 'Structured CNC curriculum from fundamentals to advanced'],
                        ['Hands-on', 'Real-world projects with toolpath simulations'],
                        ['Certified', 'Industry-recognized CNC certifications'],
                        ['Community', 'Connect with machinists and instructors worldwide'],
                      ].map(([title, desc]) => (
                        <div key={title} className="group flex gap-3">
                          {' '}
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#f59e0b]/10 text-[#f59e0b] transition-all duration-200 group-hover:bg-[#f59e0b]/20">
                            {' '}
                            <svg
                              className="h-2.5 w-2.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={3}
                            >
                              {' '}
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M4.5 12.75l6 6 9-13.5"
                              />{' '}
                            </svg>{' '}
                          </span>{' '}
                          <div>
                            {' '}
                            <p className="text-[13px] font-semibold text-[#e8e8e8]">{title}</p>{' '}
                            <p className="text-[12px] leading-relaxed text-[#6b6f76]">
                              {desc}
                            </p>{' '}
                          </div>{' '}
                        </div>
                      ))}{' '}
                    </div>{' '}
                  </div>{' '}
                </div>{' '}
              </div>{' '}
            </div>{' '}
          </div>{' '}
        </div>{' '}
        <div className="text-center text-[10px] font-semibold uppercase tracking-[0.15em] text-[#3d4148]">
          {' '}
          &copy; {new Date().getFullYear()} TITANS of Manufacturing{' '}
        </div>{' '}
      </div>{' '}
    </div>
  );
}
