# Lovelace Swipe Card

A Lovelace card that uses [Swiper](https://swiperjs.com) to create a touch slider that lets you flick through multiple cards. Nearly every [Swiper option](https://swiperjs.com/swiper-api#parameters) can be passed through.

![Preview](examples/images/preview.gif)

## What's new in 6.0

- **Works on Home Assistant 2024.11 → 2026.8+**: child cards are wrapped in `hui-card`, so per-card `visibility:` conditions, error cards and editor previews now work; the card advertises grid options to the sections view.
- **Visual editor**: configure everything — including adding, editing, reordering and deleting the child cards — straight from the card dialog. No YAML needed.
- **Jinja templates** for `start_card` and `reset_after`, re-evaluated live as entity states change.
- **Swiper upgraded 6 → 14** (fixes CVE-2026-27212 and shadow-DOM touch handling). Swiper v6 parameter names in existing configs are translated automatically (with a console warning).
- `start_card` no longer races card loading (it used to always land on slide 1), and negative values count from the end (`-1` = last card).

## Installation

### HACS (recommended)

Add this repository as a **custom repository** (type: Dashboard) in HACS, then install *Swipe Card*.

### Manual

Copy `dist/swipe-card.js` to `/config/www/swipe-card/swipe-card.js` and add a dashboard resource:

```yaml
resources:
  - url: /local/swipe-card/swipe-card.js
    type: module
```

## Configuration

Add the card from the card picker (search for *Swipe Card*) and use the visual editor, or configure it in YAML:

```yaml
- type: custom:swipe-card
  start_card: 2
  parameters:
    pagination:
      clickable: true
  cards:
    - type: markdown
      content: First slide
    - type: markdown
      content: Second slide
    - type: markdown
      content: Third slide
```

### Options

| Name | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `cards` | list | **required** | The cards to swipe through. Any Lovelace card works, including per-card `visibility:` conditions. |
| `start_card` | number or template | 1 | The card shown first (1-based). Negative numbers count from the end (`-1` = last). Also accepts a Jinja template returning a number — the card follows template updates live. |
| `reset_after` | number or template | | Return to `start_card` after this many seconds of inactivity. Also accepts a Jinja template. |
| `card_width` | string | | CSS width forced on every slide, e.g. `80%` or `200px`. Most useful with `parameters.slidesPerView: auto`. |
| `parameters` | object | | Any [Swiper parameter](https://swiperjs.com/swiper-api#parameters), e.g. `navigation`, `pagination`, `scrollbar`, `effect`, `autoplay`, `loop`, `slidesPerView`, `spaceBetween`… |

### Templates

`start_card` and `reset_after` accept [Jinja templates](https://www.home-assistant.io/docs/configuration/templating/). The template must render to a number. Results update live when the entities they reference change state:

```yaml
- type: custom:swipe-card
  start_card: >-
    {{ 2 if is_state('binary_sensor.bed_occupied', 'on') else 1 }}
  cards:
    - type: markdown
      content: Day dashboard
    - type: markdown
      content: Night dashboard
```

### Swiper parameter examples

```yaml
# Dots + arrows
parameters:
  pagination:
    clickable: true
  navigation: {}

# Coverflow effect
parameters:
  effect: coverflow
  grabCursor: true
  centeredSlides: true
  slidesPerView: auto

# Peek at the next card
parameters:
  slidesPerView: 1.2
  spaceBetween: 8
  centeredSlides: true

# Dynamic height: the card hugs the active slide instead of the tallest one
parameters:
  autoHeight: true
```

With `autoHeight: true` the container height follows the slide being shown (animated on swipe) and re-adjusts automatically when a card inside the active slide changes size after loading.

Swiper v6 parameter names from older configs (`slidesPerColumn`, `freeModeMomentum`, `watchSlidesVisibility`, `loopedSlides`, …) are translated automatically; a warning in the browser console tells you the modern name. `lazy`, `preloadImages` and `loopFillGroupWithBlank` no longer exist in Swiper and are ignored.

## Development

```bash
npm install
npm run build       # builds dist/swipe-card.js
```

Open `harness/index.html` through a local web server for a browser test suite that runs the card against a mocked Home Assistant environment.
