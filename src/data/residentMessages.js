// Friendly replies shown after a resident answers Today's Pick Up Check.
// Short enough for phone screens; never mocking anyone's circumstances.

export const disposedMessages = [
  'Trash taken out, mission accomplished! 🎉',
  'Look at you keeping the community clean! ✨',
  'One less pile, one happier neighborhood! 🥳',
  'You did your part for a cleaner tomorrow! 🌱',
  'Waste handled. Good job, CleanTrack hero! 🎊',
  'Clean streets start with little wins like yours! 💚',
  'Another clean-day victory! You love to see it! 🎉',
  'Bags out, barangay happy! Salamat! 🙌',
  'Your street says thank you! 🌿',
]

// For "No, I'm not putting out garbage today" (the first question only).
export const notTodayMessages = [
  'The trash can is getting another day off, huh? 😂',
  'Not today, garbage. You may stay a little longer! 😅',
  'The trash can said, “Maybe tomorrow?” 😂',
  'No trash mission today. We’ll catch you next time! 🫡',
  'Taking a rain check on trash duty? Fair enough! 😆',
  'Rest day for the garbage bag. Noted! 😄',
]

// Shown after the resident explains why they could not dispose. Kind, never jokey.
export const reasonReplies = {
  'truck-did-not-pass': 'Sorry the truck missed you. 💚 Your report was sent to the barangay so they can follow up.',
  'truck-did-not-stop': 'Sorry the truck didn’t stop for you. 💚 Your report was sent to the barangay so they can follow up.',
  'missed-schedule': 'No worries, it happens! Check Pickup Days for the next schedule. 🗓️',
  other: 'Thanks for telling us. 💚 The barangay will look into it.',
}

// Random pick that avoids repeating the last message from the same list.
const lastPick = {}
export function pickMessage(list, key) {
  let last = lastPick[key]
  try {
    last = Number(localStorage.getItem(`ct-msg-${key}`) ?? last)
  } catch {
    // Storage blocked: the in-memory value still prevents back-to-back repeats.
  }
  let i = Math.floor(Math.random() * list.length)
  if (list.length > 1 && i === last) i = (i + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length
  lastPick[key] = i
  try {
    localStorage.setItem(`ct-msg-${key}`, String(i))
  } catch {
    // ignore
  }
  return list[i]
}

// Remembers that a celebration already played (e.g. per resident per day), so
// reloading or answering again does not replay it.
export function celebrateOnce(key) {
  try {
    if (localStorage.getItem(`ct-celebrated-${key}`)) return false
    localStorage.setItem(`ct-celebrated-${key}`, '1')
  } catch {
    // Storage blocked: fall back to the in-memory guard in the caller.
  }
  return true
}
