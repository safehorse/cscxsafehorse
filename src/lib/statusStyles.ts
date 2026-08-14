type StatusTone = {
  badge: string
  bar: string
  card: string
  dot: string
  text: string
  track: string
}

const tones = {
  open: {
    badge: 'border border-blue-100 bg-blue-50 text-blue-700',
    bar: 'bg-blue-500',
    card: 'border-blue-100 bg-blue-50/70',
    dot: 'bg-blue-500',
    text: 'text-blue-800',
    track: 'bg-blue-100',
  },
  pending: {
    badge: 'border border-slate-200 bg-slate-100 text-slate-700',
    bar: 'bg-slate-500',
    card: 'border-slate-200 bg-slate-50',
    dot: 'bg-slate-500',
    text: 'text-slate-700',
    track: 'bg-slate-200',
  },
  waiting: {
    badge: 'border border-amber-100 bg-amber-50 text-amber-700',
    bar: 'bg-amber-500',
    card: 'border-amber-100 bg-amber-50/80',
    dot: 'bg-amber-500',
    text: 'text-amber-800',
    track: 'bg-amber-100',
  },
  analysis: {
    badge: 'border border-violet-100 bg-violet-50 text-violet-700',
    bar: 'bg-violet-500',
    card: 'border-violet-100 bg-violet-50/80',
    dot: 'bg-violet-500',
    text: 'text-violet-800',
    track: 'bg-violet-100',
  },
  production: {
    badge: 'border border-orange-100 bg-orange-50 text-orange-700',
    bar: 'bg-orange-500',
    card: 'border-orange-100 bg-orange-50/80',
    dot: 'bg-orange-500',
    text: 'text-orange-800',
    track: 'bg-orange-100',
  },
  credit: {
    badge: 'border border-cyan-100 bg-cyan-50 text-cyan-700',
    bar: 'bg-cyan-500',
    card: 'border-cyan-100 bg-cyan-50/80',
    dot: 'bg-cyan-500',
    text: 'text-cyan-800',
    track: 'bg-cyan-100',
  },
  exchange: {
    badge: 'border border-indigo-100 bg-indigo-50 text-indigo-700',
    bar: 'bg-indigo-500',
    card: 'border-indigo-100 bg-indigo-50/80',
    dot: 'bg-indigo-500',
    text: 'text-indigo-800',
    track: 'bg-indigo-100',
  },
  done: {
    badge: 'border border-emerald-100 bg-emerald-50 text-emerald-700',
    bar: 'bg-emerald-500',
    card: 'border-emerald-100 bg-emerald-50/80',
    dot: 'bg-emerald-500',
    text: 'text-emerald-800',
    track: 'bg-emerald-100',
  },
  canceled: {
    badge: 'border border-rose-100 bg-rose-50 text-rose-700',
    bar: 'bg-rose-500',
    card: 'border-rose-100 bg-rose-50/80',
    dot: 'bg-rose-500',
    text: 'text-rose-800',
    track: 'bg-rose-100',
  },
  neutral: {
    badge: 'border border-gray-200 bg-gray-100 text-gray-700',
    bar: 'bg-gray-500',
    card: 'border-gray-200 bg-gray-50',
    dot: 'bg-gray-500',
    text: 'text-gray-700',
    track: 'bg-gray-200',
  },
} satisfies Record<string, StatusTone>

export function getStatusTone(status?: string | null): StatusTone {
  const key = normalizeStatus(status)

  if (key.includes('FINALIZADO') || key.includes('CONCLUIDO')) return tones.done
  if (key.includes('CANCELADO')) return tones.canceled
  if (key.includes('AGUARDANDO') || key.includes('DEVOLU')) return tones.waiting
  if (key.includes('PENDENTE')) return tones.pending
  if (key.includes('ANALISE')) return tones.analysis
  if (key.includes('PRODU')) return tones.production
  if (key.includes('CREDITO')) return tones.credit
  if (key.includes('TROCA')) return tones.exchange
  if (key.includes('ABERTO')) return tones.open

  return tones.neutral
}

function normalizeStatus(status?: string | null) {
  return (status || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}
