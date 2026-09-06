import type { Step } from 'react-joyride'

// One small step set per page, keyed by the route path. Each step targets
// a real element already on the page via a `data-tour="..."` attribute —
// this is what makes the tour "point at the actual button", not a generic
// popup floating in the middle of the screen. Add a step set here (and the
// matching data-tour attributes on the page) to cover a new page later.
export const TOURS: Record<string, Step[]> = {
  '/dashboard': [
    {
      target: '[data-tour="dashboard-hero"]',
      title: "Today's sales, at a glance",
      content: "This is the first number to check every day — how much you've sold so far today.",
    },
    {
      target: '[data-tour="dashboard-money"]',
      title: 'Money right now',
      content: 'How much cash and M-Pesa you actually have, plus anything that needs your attention — like low stock.',
    },
    {
      target: '[data-tour="nav-sell"]',
      title: 'Ring up a sale',
      content: 'Click here any time to start selling — this is where you and your staff will spend the most time.',
    },
  ],
  '/sell': [
    {
      target: '[data-tour="sell-categories"]',
      title: 'Find a product',
      content: 'Tap a category to see its products, or just start typing a name — or scan a barcode.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="sell-cart"]',
      title: 'The current sale',
      content: "Everything you've added shows up here. You can change the quantity or remove an item any time.",
    },
    {
      target: '[data-tour="sell-charge"]',
      title: 'Take the payment',
      content: 'When the cart is ready, tap here to charge — you can pay by cash or M-Pesa.',
    },
  ],
  '/inventory': [
    {
      target: '[data-tour="inventory-add"]',
      title: 'Add a new product',
      content: "This is where you set up a product's name, price, and category. New products start with 0 stock.",
    },
    {
      target: '[data-tour="nav-stock-intake"]',
      title: 'Adding stock comes next',
      content: "Once a product exists, come here to record how much of it you've received — that's the only place stock numbers change.",
    },
  ],
  '/stock-intake': [
    {
      target: '[data-tour="intake-form"]',
      title: 'Record new stock',
      content: 'Pick a product, say how many arrived and what they cost you — this updates the stock count and logs the expense automatically.',
    },
  ],
  '/settings': [
    {
      target: '[data-tour="settings-shop"]',
      title: 'Your shop details',
      content: 'This name and address show up on printed receipts.',
    },
    {
      target: '[data-tour="settings-danger"]',
      title: 'Careful with this part',
      content: "This is where you can clear old sales data or start completely fresh. It's guarded on purpose — take your time here.",
    },
  ],
}

export function getTourForPath(pathname: string): Step[] | null {
  return TOURS[pathname] ?? null
}
