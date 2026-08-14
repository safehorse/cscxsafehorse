import { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, X } from 'lucide-react'

type DateTimePickerProps = {
  label: string
  value: string
  onChange: (value: string) => void
}

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const QUICK_TIMES = ['08:00', '09:00', '10:00', '14:00', '16:00']

export function DateTimePicker({ label, value, onChange }: DateTimePickerProps) {
  const selected = parseLocalDateTime(value)
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => startOfMonth(selected ?? new Date()))
  const days = useMemo(() => calendarDays(month), [month])
  const time = selected ? timeValue(selected) : '09:00'

  function selectDay(day: Date) {
    const [hour, minute] = time.split(':').map(Number)
    const next = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute)
    onChange(toLocalInputValue(next))
  }

  function selectTime(nextTime: string) {
    const base = selected ?? new Date()
    const [hour, minute] = nextTime.split(':').map(Number)
    const next = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hour, minute)
    onChange(toLocalInputValue(next))
  }

  function setQuick(offsetDays: number, nextTime: string) {
    const base = new Date()
    base.setDate(base.getDate() + offsetDays)
    const [hour, minute] = nextTime.split(':').map(Number)
    const next = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hour, minute)
    setMonth(startOfMonth(next))
    onChange(toLocalInputValue(next))
  }

  return (
    <div className="relative">
      <span className="mb-1 block text-xs font-medium text-gray-500">{label}</span>
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className={`flex h-10 w-full items-center gap-2 rounded-xl border bg-white px-3 text-left text-sm outline-none transition-colors ${open ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-200 hover:border-gray-300'}`}
      >
        <CalendarDays size={16} className="shrink-0 text-blue-500" />
        <span className={`min-w-0 flex-1 truncate ${selected ? 'font-medium text-gray-800' : 'text-gray-400'}`}>
          {selected ? formatDisplay(selected) : 'Selecione data e hora'}
        </span>
        {selected && (
          <span
            role="button"
            tabIndex={0}
            onClick={event => {
              event.stopPropagation()
              onChange('')
            }}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            title="Limpar data"
          >
            <X size={14} />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <div className="border-b border-gray-100 bg-gray-50 p-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMonth(prev => addMonths(prev, -1))}
                className="grid h-8 w-8 place-items-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-100"
                title="Mês anterior"
              >
                <ChevronLeft size={15} />
              </button>
              <div className="min-w-0 flex-1 text-center">
                <p className="text-sm font-bold capitalize text-gray-950">{monthLabel(month)}</p>
                <p className="text-[11px] text-gray-400">Escolha uma data para retorno</p>
              </div>
              <button
                type="button"
                onClick={() => setMonth(prev => addMonths(prev, 1))}
                className="grid h-8 w-8 place-items-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-100"
                title="Próximo mês"
              >
                <ChevronRight size={15} />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-100"
                title="Fechar calendario"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          <div className="p-3">
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((day, index) => (
                <div key={`${day}-${index}`} className="py-1 text-center text-[11px] font-bold text-gray-400">{day}</div>
              ))}
              {days.map(day => {
                const muted = day.getMonth() !== month.getMonth()
                const active = selected ? sameDay(day, selected) : false
                const today = sameDay(day, new Date())
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => selectDay(day)}
                    className={`grid h-9 place-items-center rounded-xl text-sm font-semibold transition-colors ${
                      active
                        ? 'bg-blue-600 text-white shadow-sm'
                        : today
                          ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                          : muted
                            ? 'text-gray-300 hover:bg-gray-50'
                            : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {day.getDate()}
                  </button>
                )
              })}
            </div>

            <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-2">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-500">
                <Clock3 size={13} />
                Horario
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {QUICK_TIMES.map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => selectTime(option)}
                    className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${time === option ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                  >
                    {option}
                  </button>
                ))}
              </div>
              <input
                type="time"
                value={time}
                onChange={event => selectTime(event.target.value)}
                className="mt-2 h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <button type="button" onClick={() => setQuick(0, '09:00')} className="rounded-xl border border-gray-200 px-2 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50">
                Hoje 09:00
              </button>
              <button type="button" onClick={() => setQuick(1, '09:00')} className="rounded-xl border border-gray-200 px-2 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50">
                Amanhã
              </button>
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl bg-blue-600 px-2 py-2 text-xs font-semibold text-white hover:bg-blue-700">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function parseLocalDateTime(value: string) {
  if (!value) return null
  const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoDate) return new Date(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3]), 9, 0)
  const br = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/)
  if (br) {
    const year = Number(br[3].length === 2 ? `20${br[3]}` : br[3])
    return new Date(year, Number(br[2]) - 1, Number(br[1]), 9, 0)
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function toLocalInputValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function timeValue(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

function calendarDays(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  const start = new Date(first)
  start.setDate(first.getDate() - first.getDay())
  return Array.from({ length: 42 }, (_, index) => {
    const next = new Date(start)
    next.setDate(start.getDate() + index)
    return next
  })
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function monthLabel(date: Date) {
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

function formatDisplay(date: Date) {
  return date.toLocaleString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
