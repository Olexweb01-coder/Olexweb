// Install 49: special days the LinkedIn writer marks, in your voice. Fixed dates, plus the few that move (worked out each
// year). Posts go out on weekdays: a special day on a weekend is marked on the Friday before or the Monday after.
const FIXED = {
  '01-01': 'New Year’s Day', '01-24': 'International Day of Education', '02-14': 'Valentine’s Day', '02-21': 'International Mother Language Day',
  '03-08': 'International Women’s Day', '03-20': 'International Day of Happiness', '04-07': 'World Health Day', '04-21': 'World Creativity and Innovation Day',
  '04-23': 'World Book Day', '04-26': 'World Intellectual Property Day', '05-01': 'Workers’ Day', '05-25': 'Africa Day', '05-27': 'Children’s Day in Nigeria',
  '06-12': 'Democracy Day in Nigeria', '06-16': 'the Day of the African Child', '06-27': 'Micro, Small and Medium-sized Enterprises Day', '07-15': 'World Youth Skills Day',
  '08-12': 'International Youth Day', '08-21': 'World Entrepreneurs’ Day', '09-08': 'International Literacy Day', '10-01': 'Nigeria’s Independence Day',
  '10-05': 'World Teachers’ Day', '10-10': 'World Mental Health Day', '11-19': 'International Men’s Day', '12-25': 'Christmas Day', '12-31': 'the last day of the year',
}
// the nth weekday (0 = Sunday) of a month, as MM-DD
const nth = (y, m, wd, n) => { const d = new Date(Date.UTC(y, m - 1, 1)); let c = 0; while (true) { if (d.getUTCDay() === wd && ++c === n) break; d.setUTCDate(d.getUTCDate() + 1) } return String(m).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0') }
function moving(y) { return { [nth(y, 6, 0, 3)]: 'Father’s Day', [nth(y, 5, 0, 2)]: 'Mother’s Day (international)', [nth(y, 11, 4, 3)]: 'World Philosophy Day' } }
const key = (d) => String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0')
export function specialDay(due) {
  const lagos = new Date(new Date(due).getTime() + 3600e3), y = lagos.getUTCFullYear(), all = { ...moving(y), ...FIXED }, wd = lagos.getUTCDay()
  if (all[key(lagos)]) return { name: all[key(lagos)], when: 'today' }
  const shift = (n) => { const d = new Date(lagos); d.setUTCDate(d.getUTCDate() + n); return all[key(d)] }
  if (wd === 5 && (shift(1) || shift(2))) return { name: shift(1) || shift(2), when: 'this weekend' }
  if (wd === 1 && (shift(-1) || shift(-2))) return { name: shift(-1) || shift(-2), when: 'this past weekend' }
  return null
}
