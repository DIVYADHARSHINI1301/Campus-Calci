# LUXE Palette Implementation Guide

## Color Function Update
```javascript
const cgpaColor = (v) => {
  if (v >= 9) return "from-[#7A2F31] to-[#2B2420]"; // Elite
  if (v >= 8) return "from-[#7A2F31] to-[#B8A89A]"; // Great
  if (v >= 7) return "from-[#B8A89A] to-[#C9C1B8]"; // Good
  if (v >= 6) return "from-[#C9C1B8] to-[#D9D7D5]"; // Average
  return "from-[#D9D7D5] to-[#E7E1DB]";           // Needs Work
};
```

## Global Changes
- Background: `bg-[#E7E1DB] dark:bg-[#2B2420]`
- Text: `text-[#2B2420] dark:text-[#E7E1DB]`
- Loading screen: Same colors

## Semester Cards
- Container: `bg-white/60 dark:bg-[#2B2420]/50 backdrop-blur-sm`
- Header: `bg-gradient-to-r from-[#D9D7D5] to-transparent`
- Badge: `bg-[#7A2F31] text-[#E7E1DB]`
- Borders: `border-[#D9D7D5] dark:border-[#B8A89A]/20`

## Buttons
- Primary: `bg-[#7A2F31] hover:bg-[#2B2420] text-[#E7E1DB]`
- Secondary: `bg-transparent border-2 border-[#B8A89A] text-[#2B2420] dark:text-[#E7E1DB]`
- Danger: `border-[#7A2F31] text-[#7A2F31]`
- Export: `bg-[#D9D7D5] hover:bg-[#C9C1B8] text-[#2B2420] border-[#B8A89A]`

## Stats Cards
- Card 1: `bg-gradient-to-br from-[#7A2F31] to-[#2B2420] text-[#E7E1DB]`
- Card 2: `bg-gradient-to-br from-[#B8A89A] to-[#7A2F31] text-[#E7E1DB]`
- Card 3: `bg-gradient-to-br from-[#C9C1B8] to-[#B8A89A] text-[#2B2420]`

## Charts
- Container: `bg-[#2B2420]`
- Line: `stroke="#7A2F31"`
- Tooltip: `backgroundColor: "#2B2420", border: "2px solid #7A2F31", color: "#E7E1DB"`
- Badge: `bg-[#7A2F31]/20 text-[#7A2F31] border-[#7A2F31]/30`

## Modals
- Backdrop: `bg-[#2B2420]/60`
- Content: `bg-[#E7E1DB] dark:bg-[#2B2420] border-[#B8A89A]`
- Progress bars: `bg-[#7A2F31]` filled, `bg-[#D9D7D5] dark:bg-[#B8A89A]/20` empty

## Grade Table (GradeTable.jsx)
- Headers: `border-[#C9C1B8] text-[#2B2420] dark:text-[#E7E1DB]`
- Rows: `divide-[#D9D7D5] dark:divide-[#B8A89A]/20`
- Hover: `hover:bg-[#E7E1DB] dark:hover:bg-[#B8A89A]/10`
- Select: `border-[#C9C1B8] focus:ring-[#7A2F31]`
