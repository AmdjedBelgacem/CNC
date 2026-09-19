import { BadgeCheck, CircleDollarSign, Globe2, TrendingUp, UsersRound } from 'lucide-react';
const stats = [
  {
    icon: UsersRound,
    value: '17.4k+',
    label: 'Active Students',
    tag: '+22%',
    tagIcon: TrendingUp,
    tagClass: 'bg-green-600/10 text-green-700',
  },
  {
    icon: BadgeCheck,
    value: '98.2%',
    label: 'Success Rate',
    tag: 'Platinum Tier',
    tagClass: 'bg-violet-600/10 text-violet-700',
  },
  {
    icon: Globe2,
    value: '140+',
    label: 'Global Partners',
    tag: '65 Countries',
    tagClass: 'bg-slate-200 text-slate-500',
  },
  {
    icon: CircleDollarSign,
    value: '1,120%',
    label: 'Avg. Career ROI',
    tag: 'Top ROI',
    tagClass: 'bg-green-600/10 text-green-700',
  },
];
export function FeatureTiles() {
  return (
    <section className="relative z-20 mx-auto -mt-24 max-w-[1280px] px-4 pb-16 md:px-10">
      {' '}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {' '}
        {stats.map(({ icon: Icon, value, label, tag, tagIcon: TagIcon, tagClass }) => (
          <article
            key={label}
            className="bg-white border border-gray-200 group relative overflow-hidden rounded-3xl p-8 transition-all duration-300"
          >
            {' '}
            <div className="absolute left-0 top-0 h-full w-1 bg-[#7c3aed] opacity-0 transition-opacity group-hover:opacity-100" />{' '}
            <div className="mb-6 flex items-start justify-between gap-3">
              {' '}
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600/10 text-[#7c3aed]">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>{' '}
              <span
                className={`flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${tagClass}`}
              >
                {TagIcon && <TagIcon className="h-3 w-3" />}
                {tag}
              </span>{' '}
            </div>{' '}
            <p className="mb-1 text-[40px] font-bold leading-[1.1] tracking-tighter text-[#111827]">
              {value}
            </p>{' '}
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">
              {label}
            </p>{' '}
          </article>
        ))}{' '}
      </div>{' '}
    </section>
  );
}
