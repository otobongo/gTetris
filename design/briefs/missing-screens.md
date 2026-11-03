# Brief: five missing screens (Brickwise design canvas)

Status: **draft, waiting for approval. Nothing gets built until it is approved.**
Surface: web app on the design canvas, phone 390x844 and tablet 834x1194, `.dc.html` files in `design/canvas/`.
Guide pack for every builder (load before starting, one pass, no review afterwards): unslop web cards `guide/layout.md`, `typography.md`, `color.md`, `interaction.md`, `imagery.md`, `copy.md`. Material 3 is the structural reference. Do not load nativefit.
The existing screens are the design system. Copy their components exactly; the values are listed in section 2 so nobody re-derives them.

---

## 1. The five screens at a glance

| # | Screen | For | New files (boards) | Reached from | Leaves to |
|---|---|---|---|---|---|
| 1 | Sign in | Grown-up | `Signin`, `SigninTablet` | Signup "Sign in" link; Settings guest panel "Use email instead" | Who's playing (`Main`); Signup ("Create a family account"); Support |
| 2 | Level select | Child | `Levels` (Brick Escape, Maya 7), `LevelsLetters` (Letter Builder, Leo 4), `LevelsTablet` (Brick Escape) | Home brain-game tiles | The game; Home |
| 3 | Sticker book | Child | `Stickers` (Maya), `StickersEmpty` (new child), `StickersTablet` | Home stats line "42 stars · 12/40 stickers" | Home; a game's Levels (from a missing sticker) |
| 4 | Break time | Child, then grown-up | `Break` (Leo 4), `BreakExtend` (grown-up panel), `BreakTablet` (Maya 7, mid-level) | Any game or Home once the daily limit is used up | Who's playing ("Switch player"); back into the saved game after extra time; Settings |
| 5 | Support, Terms, Privacy | Grown-up | `Help` (Support), `HelpDoc` (Terms; Privacy by lever), `HelpTablet` | Settings help links; Signup and Sign in footers | Back to where it came from |

All names are `<Name>.dc.html`. Tablet boards and variant boards are thin wrappers (`<dc-import name="Levels" device="tablet" hint-size="834px,1194px">`, or with a prop such as `game="letters"`), like `HubTablet` and `EscapeIce`.

**Decisions taken here:**
- **One level select for all three brain games**, driven by a `game` lever. Brick Drop calls levels "Stage"; the screen uses each game's own noun.
- **Superseded by the user (see 3.6):** there is no Explore group anymore. All nine games are brain games, shown the same way on Home, and every game tile opens Levels.
- **Support is one screen. Terms and Privacy share one document template** in the same file, chosen by a `page` lever (`help | terms | privacy`). It works like Signup's steps.
- Canvas links can only point at files, not props. So the canvas wires Brick Escape and Letter Builder to their Levels boards, and Brick Drop's Home tile keeps linking straight into the game. In the app, every brain-game tile opens Levels.

---

## 2. Decisions for all five screens (values taken from the existing files)

**Ground and frame.** Background `radial-gradient(120% 80% at 50% 15%, #33278a, #1a1246)`. Font Baloo 2 (weights 600, 700, 800 are in use), all text white unless stated. Inner frame `zoom: {{Z}}` with W/H/Z/IW/IH = 390/844/1/390/844 on phone and 834/1194/1.4/596/853 on tablet. Page padding is `20px 16px 18px` (game and Settings screens) or `24px 20px 22px` (Signup, which Sign in matches). The column gap is 12 to 14px.

**Type ramp** (size/weight/line-height, colour):

| Role | Value | Used for |
|---|---|---|
| Wordmark | 34/800/1, text-shadow `0 4px 0 #241a63` | Sign in (matches Signup) |
| Display | 32/800/1.1 | Break heading, overlay card titles (matches the win card) |
| Screen heading | 26/800/1.1 | "Welcome back" (matches Signup) |
| Top bar title / sub | 24/800/1.1 · 15/700 `#c9c2ff` | Every top bar |
| Section heading | 20/800, with an inline note 14/700 | Level chapters, Support sections (matches Home "Brain games") |
| Panel heading | 18/800/1.15 | Panels, Q&A questions on tablet |
| Body | 16/700/1.35; long-form prose 16/600/1.5 | Messages; Terms and Privacy body |
| Secondary | 15/700 `#c9c2ff` | Support lines, answers |
| Label / helper | 14/800 `#c9c2ff` · 13/700 `#c9c2ff` | Field labels, helpers. Nothing smaller than 13px on new screens |
| Buttons | Primary 20/800 · provider and secondary 17/800 · small 15/800 | |
| Tile numerals | 22/800, `font-variant-numeric: tabular-nums` | Level numbers, counters |

Start-align anything three lines or longer (answers, document text). Centre only short headings, the Break message and empty states.

**Colour roles.**

| Role | Value |
|---|---|
| Panel (flat, for information) | `#30257a` |
| Well or inset (fields, tracks, locked tiles) | `#1d1550`; fields also use inset shadow `inset 0 3px 6px rgba(0,0,0,0.35)` |
| Raised tile (anything you can press) | `linear-gradient(180deg, #5444b8, #3a2d8f)` with shadow `0 5px 0 #241a63` |
| Text: primary, secondary | `#ffffff`, `#c9c2ff`. Do not use `#8e85d6` for text on new screens (3.6:1 on the ground); keep it for decoration and locked icons on `#1d1550` |
| Primary action | Green `linear-gradient(180deg, #5fe06e, #1fb53c)`, shadow `0 5px 0 #0f7a26` (label colour: see open question 1) |
| Accent: selection, current, focus | Yellow `#ffc21a`; yellow button `linear-gradient(180deg, #ffe266, #ffc21a)` with text `#5a3500` and shadow `#d48a00`; focus outline `3px solid #ffc21a`, offset 2px; selected ring `0 0 0 4px #ffc21a` |
| Secondary button | Flat `#4b3eaa`, or raised `linear-gradient(180deg, #6b5bd0, #4b3eaa)` (Replay) |
| Star | `#ffb21f`; unearned star `rgba(0,0,0,0.3)` |
| Link on the ground | `#ffe266` (Signup "Sign in") or underlined `#c9c2ff` (Settings help links) |
| Danger and error | Error text `#ff9fd4`, border `#ff4d5e`, destructive button `#d92f45` with shadow `#8f1f2e` |
| Success toast | `#1f9a44` |
| Dashed "add" or empty slot | `2px dashed #6d5fd0` (decorative only, always paired with text or an aria label) |
| Scrim | `rgba(10,6,30,0.65)` |
| Brick palette | The 8 colours in `pal()` / `brick()` (red, yellow, green, blue, purple, orange, pink, teal). Use only through `brick()` |

No new gradients, glows, blur or colours beyond this table.

**The one shape rule kids learn: if it looks like a brick, you can press it.** Raised = tappable (gradient plus hard offset shadow). Flat `#30257a` = information. Inset `#1d1550` = a slot, a field, or not available yet. On press, move the element down 3px and shrink the shadow to 2px over 100ms `cubic-bezier(0.16,1,0.3,1)`.

**Radius.** Existing components keep their own values when copied: provider buttons 16, inputs 14, primary CTA 18 (Signup) or 20 (Main), panels 20, overlay cards 24 to 26, avatars 22 / 14 / 11, pills 999. New components use four roles only: **12** small controls (chips, segmented items, stepper); **16** buttons, icon buttons, level tiles and sticker slots; **20** panels and tappable cards; **26** overlay cards and the album page. Pills and progress bars use 999.

**Components to copy, not redraw.**
- Top bar: grid `54px 1fr 54px`, gap 10. A 54x54 raised icon button (radius 16, 26px icon, stroke 2.8) on the left, title and sub centred, then a 54px icon button or an empty `<span>` on the right.
- Provider buttons (from Signup): 48px tall, white with `#17171d` text and Facebook `#1877F2`, plus the "or use email" divider.
- Field: label 14/800 `#c9c2ff` above, input 18/700 on `#30257a` with the inset shadow, radius 14, padding `10px 14px`.
- Segmented control: the Settings timer modes (track `#1d1550`, selected item yellow with `#5a3500` text, radius 11 inside 14).
- Overlay card: the win card (scrim, card `max-width: 330px`, padding `24px 20px 20px`, radius 26, shadow `0 8px 0 #241a63`).
- Hold-to-open gate: the Settings locked state (140px conic ring, hold for 2 seconds).
- Toast: from Settings.

**Icons.** Inline SVG on a 24 viewBox, `stroke="currentColor"`, round caps and joins, stroke 2.2 to 2.8. Fills only for the star and the play triangle. New glyphs in the same style: lock, speaker (copy from Letters), close, chevron right (the back chevron mirrored), mail, play. No emoji anywhere (the `src/` Letter Builder chapters use emoji; do not carry them over).

**Motion.** At most one authored moment per screen: the new sticker settling on Stickers, and the bricks dropping into the box on Break. Each runs once, under 400ms, ease-out, and becomes a 150ms crossfade under reduced motion. Nothing loops, no confetti.

---

## 3. Screens

### 3.1 Sign in (`Signin.dc.html`)
**Goal:** a grown-up with an existing family account gets their children's progress onto this device in one step. **User:** parent or guardian. The screen is reached from Signup (first run) and from Settings (already behind the grown-up gate), so it needs no extra gate.

Top to bottom, matching Signup step 1:
1. Top row: a back icon button (to Signup or Settings, from the `from` lever), the wordmark in the centre, and an empty 54px span on the right.
2. "Welcome back" (26) / "Sign in to your family account. Your children's stars, levels and stickers come with you." (15/700, centred, 2 lines).
3. "Continue with Apple", "Continue with Google", "Continue with Facebook" (same labels as Signup).
4. The "or use email" divider. Email field (`type=email`, `autocomplete=email`), Password field (`autocomplete=current-password`) with a 44px "Show"/"Hide" text button inside the field (`aria-pressed`).
5. A "Forgot password?" text link (44px tall).
6. Spacer, then the green "Sign in" button. While loading it reads "Signing in…" and keeps its width.
7. Footer: "New here? [Create a family account]" (link `#ffe266`, goes to Signup), and below it one line of links: "Support · Terms · Privacy" (to Help).

States (`state` lever):

| State | What changes | Copy |
|---|---|---|
| `default` | Empty form | As above |
| `wrongPassword` | Fields keep their values; an error line under Password, `role=alert`, error colour plus icon | "That email and password don't match an account. Check them, or reset your password." (one message for both cases, so the screen never reveals which emails have accounts) |
| `providerFailed` | Error panel above the provider buttons | "Apple sign-in didn't finish. Try again, or use another way to sign in." |
| `offline` | Panel above the form; the buttons stay enabled | "No internet connection. Connect to sign in. Children can still play on this device." |
| `tooManyTries` | Sign in disabled after the attempt | "Too many tries. Wait [PLACEHOLDER: lockout minutes] minutes, or reset your password." |
| `reset` | Heading "Reset your password", Email field, "Send reset link", and "Back to sign in" | |
| `resetSent` | Confirmation | "If [email] has a family account, a reset link is on its way." |
| `signedIn` | Signup's done layout: the children's avatars, then "Start playing" (to Main) | "You're signed in" / "Maya and Leo are ready on this device." |
| `noChildren` | Same layout with no avatars; "Add a child" (to Settings) | "Your family account has no children yet." |
| `merge` | Panel shown after sign-in when the device has local progress | "This device has progress for Leo, age 4, who isn't on your family account." Primary "Add Leo to your family", text button "Skip for now", helper "Skipped progress stays on this device only." |

Levers: `device`, `from` (`signup | settings`), `state`.

### 3.2 Level select (`Levels.dc.html`)
**Goal:** a child sees where they are, plays the next level in one tap, and replays a level to earn more stars. **Users:** children aged 3 to 10. Ages 3 to 4 cannot read, so the screen must work from numbers, colour, shape and voice alone.

Top to bottom:
1. Top bar: back to Home; title is the game name ("Brick Escape", "Brick Drop", "Letter Builder"); sub "17 of 90 stars", or "No stars yet". On the right, a speaker button "Read this page aloud" for ages 3 to 6 (an empty span for 7 to 10). It speaks the game name and the Play label.
2. A scroll area (`flex: 1; overflow-y: auto`, 16px end inset) with one section per chapter. The heading is 20/800 with a 14/700 note, and the names come from `src` data: Escape "Getting started, Think first, Icy doors, Big bricks, Master", Drop "Small bricks, Four-square bricks, Big bricks", Letters "Alphabet Train, Big and small, First sounds, Spell it". Check each one against the current mechanics. For example, Escape's "Frozen bricks" chapter in `src` describes a mechanic that commit 4177268 removed; show it as `[PLACEHOLDER: chapter name]` until it is renamed. On load, scroll to the chapter that holds the current level.
3. Level grid. Gap 8. On phone, 5 columns (tiles about 65px), or 4 columns for ages 3 to 4 (about 83px). On tablet, 8 columns, or 6 for ages 3 to 4.
4. Fixed footer: a status line (`role=status`, 15/700, empty by default), then the big green "Play Level 9" with the play icon (24/800, matching Main's "Play as Maya"), linking to the game board.

Tile states (each one differs by shape as well as colour):

| State | Look | Content | Accessible name |
|---|---|---|---|
| Done | Raised purple, shadow `0 4px 0 #241a63` | Number, then 3 small stars (12px) filled or unearned | "Level 3, 2 stars" |
| Current | Raised yellow (yellow button style) | Number in `#5a3500` and a play triangle | "Level 9, play next" (`aria-current="step"`) |
| Open, not played | Raised purple | Number and 3 unearned stars | "Level 13, not played" |
| Locked | Flat `#1d1550`, no shadow | Lock icon (18px, `#8e85d6`) and the number at 14/800 | "Level 12, locked" |

Tapping a locked tile (a button with `aria-disabled="true"`, not `disabled`) does not open anything. It fills the status line, which is also read aloud for ages 3 to 6: "Finish Level 9 to open Level 10."

Unlock rule: linear, as in `src` (a level opens once the one before it has at least 1 star). For ages 9 to 10, Signup promises "harder levels unlocked sooner", so the first level of every chapter is open too. That is the "Open, not played" state. Change this rule here if it is wrong.

Edge states (`progress` lever):
- `new`: Level 1 is current and everything else is locked. The sub reads "No stars yet" and the button "Play Level 1". All levels can never be locked, because Level 1 always opens.
- `midway`: the default. The sample data must match Home: Escape Level 9 current, 8 done, 17 stars; Drop Stage 4 current, 3 done, 6 stars; Letters Level 17 current, 16 done, 19 stars. These add up to Home's 42. Label them as sample data in a code comment.
- `complete`: every tile is done and the Play button is hidden. The status line reads "You finished every level! Pick one to play again." (the one exclamation, because this is a real milestone).
- Master chapter (open-ended in `src`): show the levels that exist, then a dashed end tile reading "More soon" as plain text, not a button.

Levers: `device`, `game` (`escape | drop | letters`), `kid` (`leo4 | nia6 | maya7 | theo10`, each with name, age and colour; sample data), `progress`.

### 3.3 Sticker book (`Stickers.dc.html`)
**Goal:** a child looks through what they have earned and finds out how to get the stickers they are missing. **Users:** children aged 3 to 10; each child has their own book.

Sticker art: 5x5 brick mosaics built with `brick()` studs, defined as cell arrays like Picture Builder's `pictures()`. They have a die-cut look: a 4px white edge on a radius-16 shape with shadow `0 3px 0 rgba(0,0,0,0.3)`. Each subject is tied to the game it comes from (for example a key for Icy doors, a train for Pattern Train, a paint pot for Color Mixer). The builder draws the 12 collected samples and reuses those shapes as silhouettes for the missing ones. No generated or library illustrations.

Top to bottom:
1. Top bar: back to Home; "Sticker book" / "12 of 40 stickers"; empty right slot.
2. Segmented page tabs: "Brain games", "Explore", "Discoveries".
3. Album page: inset `#1d1550`, radius 26, padding 14, with the page count above the grid ("5 of 13 on this page", 14/800 `#c9c2ff`). Grid gap 10: 4 columns on phone (about 75px slots), 6 on tablet. Each slot is a button:
   - Collected: the sticker, with its name at 13/700 underneath.
   - New since the last visit: a yellow "New" pill (14/800, `#5a3500` on `#ffc21a`). This is the one motion moment on the screen: the sticker settles once.
   - Missing: a dashed slot holding the silhouette in `#30257a`, with no name. Accessible name "Sticker not found yet".
4. Tapping a slot opens the overlay card (`role=dialog`, focus trapped, Escape and scrim close it, focus returns to the slot):
   - Collected: the sticker at 160px, its name (26/800) "Ice key", the source line "From Brick Escape · Icy doors", a speaker button "Say the name", and "Close".
   - Missing: the silhouette, then "Not found yet" and "Finish Icy doors in Brick Escape to get this sticker." Primary "Play Brick Escape" goes to that game's Levels; secondary is "Close".

Empty and edge states (`state` lever): `some` is the default. `empty` (the `StickersEmpty` board, a new child) puts a flat panel above the tabs: "No stickers yet" / "Win a level to get your first sticker." with the button "Play a game" (to Home), and every slot shows a silhouette. Each tab also has its own empty line, for example Discoveries: "Today's discovery on Home gives you a sticker." `pageFull` adds the line "You found every sticker on this page." `allFound` adds "Every sticker found!" Pages with more slots than fit scroll the whole screen, never inside the album (LAY-39).

Levers: `device`, `kid`, `state`, `tab`.

### 3.4 Break time (`Break.dc.html`)
**Goal:** when a child's daily play limit (set in Settings, 10 to 90 minutes) runs out, playing stops in a calm way that a child accepts. A grown-up can add time for today. **Users:** first the child; after the gate, the grown-up.

While the limit is used up, every entry to a game or to Home leads here. There is no back button. Child view, top to bottom:
1. Illustration, about 200x140: the child's own avatar brick (their colour and initial) sitting on top of an open brick box, with 4 to 6 `brick()` bricks inside. Built from existing pieces and static. The bricks drop into the box once on arrival.
2. "Time for a break, Maya" (32/800, centred).
3. "You played 30 minutes today. Your bricks will be here tomorrow." (18/700 `#c9c2ff`, centred, 2 lines). The minutes come from the limit. When the day resets is `[PLACEHOLDER: daily reset time, e.g. midnight on this device]`.
4. Mid-level only: "Level 9 is saved. Next time you start right where you stopped."
5. Today's progress as two flat chips (only when the counts are above zero): "6 stars today", "1 new sticker".
6. One line to try away from the screen: "Build something with real bricks and show a grown-up."
7. Footer: secondary "Switch player" (to Main; hidden when the family has one child). Below it, a text link "Grown-ups: add time". There is no green button, because nothing here is a "play" action for the child.
8. For ages 3 to 4 with Voice on, the heading and message are read aloud on arrival. A speaker button "Hear it again" sits top right at every age.

Grown-up flow (in place, no new screen):
- `gate`: a flat panel "Grown-up check" with "Type the number forty-seven." A numeric field (`inputmode=numeric`, `autocomplete=off`, label "Number") and buttons "Check" and "Cancel". A wrong answer shows "That number doesn't match. Try this one instead." and a new number. See open question 2.
- `extend` (the `BreakExtend` board): "Add time for Maya today". Segmented chips "10 min", "20 min", "30 min", then primary "Add 10 minutes" (the label follows the chip) and secondary "Keep the break". Helper: "Only for today. Change the daily limit in [Settings]." If time was already added today, add the line "Maya had 10 extra minutes today."
- After adding time, the child goes back into the saved game.

Levers: `device`, `kid`, `state` (`break | gate | extend`), `when` (`betweenLevels | midLevel`), `siblings` (`1 | 2`).

### 3.5 Support, Terms, Privacy (`Help.dc.html`)
**Goal:** a grown-up finds a fast answer or reaches a person, and can read the legal documents. **User:** grown-up. The email link leaves the app, so it is behind a hold gate (Signup and Sign in are not gated).

The title is **"Support"**, because the Settings link already says "Support".

`page=help`, top to bottom:
1. Top bar: back (to Settings, Signup or Sign in, from the `from` lever); "Support" / "For grown-ups"; empty right slot.
2. Flat panel "Contact support": "Write to [PLACEHOLDER: support email]. Include your family account email and the device you use." Then a hold button "Hold to email support": it fills left to right in `#ffc21a` over 2 seconds, then opens `mailto:`. Accessible name "Press and hold for 2 seconds to open your email app". The keyboard works by holding Enter or Space. Reply time: `[PLACEHOLDER: reply time]`.
3. "Common questions" (20/800), shown as a plain list rather than an accordion or cards. Each question is 16/800 white and each answer 15/700 `#c9c2ff`, start-aligned, 16px between items, answer in the first sentence. Every answer is a fact that the existing screens already state:
   - "How do I add a child?" Open Settings, tap Add a child, then enter a first name and age.
   - "Why doesn't my child need a password?" Children play under your family account and tap their brick on Who's playing. Only grown-ups sign in.
   - "How do I use Brickwise on another device?" Sign in with the same family account on each device. Stars, levels and stickers stay in sync.
   - "What happens when the game timer runs out?" The game keeps going; your child only misses the speed star. Ages 3 to 4 play with no countdown.
   - "How do I change the daily play limit?" In Settings, under your child's game timer. When time is up, your child sees a break screen, where you can add time for today.
   - "How do I reset progress?" In Settings, under Progress. A reset can't be undone.
   - "How do I delete my account?" In Settings, tap Delete my account. This removes every child's stars, levels and stickers on every device.
4. "Legal": one flat panel with two 52px link rows, "Terms of use" and "Privacy policy", each with a chevron, divided by a 2px `#1d1550` line.
5. "Version [PLACEHOLDER]" at 13/700.

`page=terms | privacy` (the `HelpDoc` board):
1. Top bar: back to Support (or to the screen that opened it); "Terms of use" or "Privacy policy" / "For grown-ups".
2. A status callout (flat panel with a yellow "Placeholder" pill and a document icon): "Placeholder text. Replace with the approved [Terms of use / Privacy policy] before launch."
3. "Last updated [PLACEHOLDER: date]".
4. Four blocks, each "[PLACEHOLDER: section heading]" (18/800) followed by "[PLACEHOLDER: approved legal text]" (16/600/1.5, start-aligned). **No real or made-up legal wording.** Counsel writes it, including the children's privacy requirements.
5. "Questions about this document? [Contact support]".

Levers: `device`, `page`, `from` (`settings | signup | signin`).

---

### 3.6 Home redesign (`Hub.dc.html`, user request 2026-11-03)
**Ask:** "Make all the Explore games use the same layout as the Brain games. All games are brain games. Redesign the landing to show all games."
- **One list, one card.** The "Brain games" and "Explore" headings and the 3-column Explore grid are replaced by one section, heading "Games", using today's brain-game card for all nine: icon art on the left (each game keeps its current art), title, one-line subtitle, level pill on the right.
- **Order and subtitles** (titles unchanged):

| Game | Subtitle | Pill |
|---|---|---|
| Brick Escape | Slide bricks out their doors | Level 9 |
| Brick Drop | Stack falling bricks into rows | Stage 4 |
| Letter Builder | Alphabet, sounds and spelling | Level 17 |
| Color Mixer | Mix two colors to make a new one | 3 of 6 |
| Shape Sorter | Match each shape to its hole | Level 2 |
| Pattern Train | Finish the pattern on the train | Level 1 |
| Number Line-up | Put the number towers in order | Level 3 |
| Picture Builder | Look, then build the picture | Level 1 |
| Brick Calculator | Add and take away with bricks | Level 1 |

  Pills are sample data like today's.
- **Fit:** nine cards don't fit a fixed 844px phone frame at today's card height. Phone: one column with the card trimmed to 64px tall (icon 56x44, title 19px, subtitle 14px, pill unchanged), 10px gaps, and the list scrolls inside the frame below a fixed header (avatar, "Hi Maya!", stars and stickers, settings gear). Today's discovery banner stays above the list and scrolls with it. Tablet: two columns, same card, no scroll needed.
- **Taps:** every card opens that game's Levels board (decision 5 now covers all nine games). On the canvas, cards without their own Levels board link straight into the game, as the brief already notes for Brick Drop.
- **Knock-on changes:** the six former Explore games drop "Explore" from their header subtitle (for example "Explore · Add and take away" becomes "Brick Calculator · Add and take away"); the canvas row titles "4. Explore: shapes and colors" and "5. Explore: numbers, math and building" become "4. Games: shapes and colors" and "5. Games: numbers, math and building"; the Levels pattern (3.2) applies to every game, using "Level" for all except Brick Drop's "Stage".

## 4. Changes to existing files (part of the build, listed so you can approve them)
- `Signup`: "Sign in" links to `Signin`. "[Terms]" and "[Privacy Policy]" in the checkbox become separate links "Terms of use" and "Privacy policy" to `HelpDoc`, kept outside the checkbox hit area.
- `Grownups`: the Support, Terms and Privacy links point to `Help` and `HelpDoc`; guest "Use email instead" goes to `Signin`.
- `Hub`: the stats line becomes a 44px-tall link to `Stickers`; the Brick Escape and Letter Builder tiles link to `Levels` and `LevelsLetters` (the tablet Escape tile to `LevelsTablet`).
- `Escape` and `EscapeTablet` back buttons go to `Levels` / `LevelsTablet`; the `Letters` back button goes to `LevelsLetters`.
- Tablet wrappers pass `device="tablet"` and nothing else, except `BreakTablet` (`kid="maya7" when="midLevel"`).
- Follow-ups, not in this build: a "Break until tomorrow" state on Who's playing, a "1 minute left" chip in game headers, and the new sticker shown on the win card.

## 5. Canvas placement (`canvas.json`; no existing board moves)

| Row | Board | x | y |
|---|---|---|---|
| 1 Start (y 0) | Signin / SigninTablet | 4152 / 4622 | 0 |
| 2 Games (y 1600) | Levels / LevelsLetters / LevelsTablet | 4152 / 4622 / 5092 | 1600 |
| 6 Settings (y 8000) | Help / HelpDoc / HelpTablet | 1384 / 1854 / 2324 | 8000 |
| **7 new** (y 9600) | Stickers / StickersEmpty / Break / BreakExtend | 0 / 470 / 940 / 1410 | 9600 |
| 7 | StickersTablet / BreakTablet | 1880 / 2794 | 9600 |

Phone boards are 390x844 and tablet boards 834x1194, with 80px between frames. Widen the row title `maxW` values: `row1` 5456, `row2` 5926, `row5` (the Settings title) 3158. Add the note `row7` at x 0, y 9300, maxW 3628, kind `title1`: "7. Around the games: sticker book and break time". Append the new boards to `order` after their row-mates, all with `is_interactive: true`.

## 6. Accessibility (hard requirements)
- **Touch targets:** at least 44px everywhere; kid controls 54px or more (top bar buttons, slots, tiles). Use no extra gaps under 8px between separate targets.
- **Contrast** at 4.5:1 for text and 3:1 for icons and large text, measured against the lightest stop of a gradient. Pairs that pass: white on `#30257a` 12.6, `#c9c2ff` on `#30257a` 7.6, `#5a3500` on yellow 6.7, `#ffe266` on the ground 9.1, white on `#d92f45` 4.7. Pairs that fail and must not be used on new screens: `#8e85d6` text (3.6), and `#c9c2ff` small text on raised tiles (4.4 on `#5444b8`; use `#ffffff` there). The green button is open question 1. Facebook's `#1877F2` (4.2 with 17px text) is set by the brand; keep it as Signup has it.
- **Real elements:** `<a href>` for navigation, `<button>` for actions, `role=switch` and `aria-pressed` as Settings does, one `h1` per screen (the top bar title), and named icon buttons. Errors use `role=alert`, the status line `role=status`, overlays `role=dialog` with focus handling.
- **Colour is never the only signal:** tile states have icons, stickers have names and pills, errors have an icon and text.
- **Read-aloud** for ages 3 to 6 on Levels, Stickers and Break through `speechSynthesis`, as Letters does. It plays automatically only when the Voice setting is on.
- **Grown-up gates:** the hold gate covers the email link; the number check covers extending time. Kid screens (Levels, Stickers, Break) contain no external links, purchases or account actions.
- **Reduced motion:** a 150ms crossfade instead of the drop and settle moments.

## 7. Open questions (each with a recommendation)
1. **The green Play button fails contrast** (white text is 2.7:1 on `#1fb53c` and 1.7:1 on `#5fe06e`). *Recommended:* use a dark label `#063510` on the same green (5.1:1 and 8.1:1), the same idea as the yellow button's brown label, applied to every green button in all files in one pass. *Alternative:* darken the fill to `#15862e` and keep white text (4.7:1). Until you decide, new screens use the current button unchanged.
2. **Gate for adding play time.** A 2-second hold is easy for a 4-year-old to pass. *Recommended:* a typed-number check ("Type the number forty-seven"), which needs no setup. *Alternatives:* the existing hold gate (weaker), or a family PIN (strongest, but needs a new control in Settings).
3. **Limit reached mid-level.** *Recommended:* pause, save the board exactly, and show Break at once. *Alternative:* let the child finish the current level first. Brick Escape has no fail state, so that could run on.
4. **What earns a sticker, and how many there are.** *Recommended:* one per finished chapter in a brain game, one per finished Explore game, and one per Today's discovery. Treat 40 as sample data until the set is drawn: `[PLACEHOLDER: total stickers]`.
5. **Home tile behaviour.** *Recommended:* the tile opens Levels, whose big Play button keeps it to one extra tap. *Alternative:* go straight into the game, with a Levels button added to each game's top bar.

## 8. Done criteria for the build
- All 14 boards exist, render at 390x844 and 834x1194 with no clipped or overflowing text, and are placed as in section 5. `canvas.json` is updated and no existing board has moved.
- Every state in section 3 can be reached through the levers listed, and the default lever values show the main state.
- Only the values in section 2 are used: no new colours, gradients, radii outside the role list, or font sizes under 13px.
- The copy matches this brief. It has no em or en dashes and none of these words: leverage, seamless, empower, unlock as hype, "Oops", "Submit". Every unknown is `[PLACEHOLDER: ...]`, and Terms and Privacy show the placeholder callout with no legal wording.
- No emoji, and no generated or library art. Stickers and the Break illustration are built from `brick()`.
- The accessibility list in section 6 holds: targets measured, contrast pairs checked against the lightest gradient stop, real buttons and links, dialogs that trap and return focus.
- The link changes in section 4 are made only after this brief is approved, and the files are committed on a feature branch.
- Handoff: a list of the new files and boards, plus anything that could not follow the brief.

## 9. Decisions from the user (2026-11-03)
1. Green buttons: dark label `#063510` on the existing green, applied to every green button in one pass.
2. Adding play time: typed-number check ("Type the number forty-seven").
3. Limit reached mid-level: save the board and show Break at once.
5. Home brain-game tiles open Levels.
6. Home: all nine games are brain games, shown in one list with the same card (section 3.6); every game opens Levels.
4. Stickers: one per finished chapter of any game, plus one per Today's discovery. 40 stays sample data.
7. Ages 9 to 10: the first level of every chapter starts open; later levels unlock in order.
**Approved for building on 2026-11-03.**
