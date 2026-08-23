# Lovelace Swipe Card

A Lovelace card that uses [Swiper](https://swiperjs.com) to create a touch slider that lets you flick through multiple cards.

- Works on Home Assistant 2024.11 → 2026.8+ (sections view, per-card `visibility:` conditions)
- Full visual editor: add, edit, reorder and delete the child cards from the card dialog
- `start_card` and `reset_after` accept Jinja templates, updated live
- Nearly every [Swiper parameter](https://swiperjs.com/swiper-api#parameters) can be passed through; Swiper v6 parameter names from old configs are translated automatically

```yaml
- type: custom:swipe-card
  start_card: "{{ 2 if is_state('binary_sensor.bed_occupied', 'on') else 1 }}"
  parameters:
    pagination:
      clickable: true
  cards:
    - type: markdown
      content: First slide
    - type: markdown
      content: Second slide
```
