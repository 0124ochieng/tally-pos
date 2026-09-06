import * as Icons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export const CATEGORY_ICON_OPTIONS = [
  'Camera', 'CookingPot', 'Fan', 'Gamepad2', 'Gift', 'Headphones',
  'Laptop', 'Lightbulb', 'Package', 'Refrigerator', 'ShoppingBag',
  'Smartphone', 'Speaker', 'Tv', 'Watch', 'WashingMachine',
].sort((a, b) => a.localeCompare(b))

export function getCategoryIcon(name: string): LucideIcon {
  return (Icons as unknown as Record<string, LucideIcon>)[name] ?? Icons.Package
}
