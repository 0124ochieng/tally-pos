import { useTheme } from '../../../app/ThemeContext'

// Validated against this app's actual surfaces via the dataviz skill's
// validator (light surface #faf9f5, dark surface #1a1d27) — both pass the
// categorical 8-hue gate (CVD + normal-vision separation) with a legend +
// tooltip present (required for the light-mode contrast relief rule).
const categoricalLight = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']
const categoricalDark = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']

// Single-series (sales trend) uses a deepened brand-gold shade — raw
// brand gold (#f5c542) is too light for line contrast on a light background.
const seriesGoldLight = '#a6790f'
const seriesGoldDark = '#f5c542'

export function useChartPalette() {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  return {
    categorical: dark ? categoricalDark : categoricalLight,
    seriesGold: dark ? seriesGoldDark : seriesGoldLight,
    ink: {
      primary: dark ? '#f5f5f7' : '#16171c',
      secondary: dark ? '#b7b8c2' : '#5b5d6b',
      muted: dark ? '#797a86' : '#96979f',
      grid: dark ? '#2d2f3a' : '#e8e4d9',
      axis: dark ? '#3a3c48' : '#d8d4c8',
      surface: dark ? '#1a1c24' : '#ffffff',
    },
  }
}
