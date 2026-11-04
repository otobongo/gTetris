/** Support questions. The account answers promise sync and deletion on every device only when a real provider is active. */
export interface Faq {
  q: string;
  a: string;
}

export function helpFaqs(accountsActive: boolean): Faq[] {
  return [
    { q: 'How do I add a child?', a: 'Open Settings, tap Add a child, then enter a first name and age.' },
    { q: 'Why doesn’t my child need a password?', a: 'Children tap their brick on Who’s playing. Only grown-ups sign in.' },
    accountsActive
      ? { q: 'How do I use Brickwise on another device?', a: 'Sign in with the same family account on each device. Stars, levels and stickers stay in sync.' }
      : { q: 'How do I use Brickwise on another device?', a: 'Not yet. Family accounts are coming soon; until then, progress stays on the device it was made on.' },
    { q: 'What happens when the game timer runs out?', a: 'The game keeps going; your child only misses the speed star. Ages 3 to 4 play with no countdown.' },
    { q: 'How do I change the daily play limit?', a: 'In Settings, under your child’s game timer. When time is up, your child sees a break screen, where you can add time for today.' },
    { q: 'How do I reset progress?', a: 'In Settings, under Progress. A reset can’t be undone.' },
    { q: 'How does my child replay a level?', a: 'In Settings, under Progress, tap the game and pick the level. Children can’t pick levels themselves.' },
    accountsActive
      ? { q: 'How do I delete my account?', a: 'In Settings, tap Delete my account. This removes every child’s stars, levels and stickers on every device.' }
      : { q: 'How do I delete my account?', a: 'In Settings, tap Delete my account. This removes every child’s stars, levels and stickers from this device.' },
  ];
}
