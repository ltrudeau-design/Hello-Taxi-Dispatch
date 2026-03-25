# Hello Taxi Dispatch — UI Standards Reference

**Version:** 1.0  
**Last Updated:** January 12, 2026  
**Purpose:** Ensure visual consistency across all components and future additions

---

## 1. Design Tokens (CSS Variables)

All UI components MUST use these CSS variables. Never hardcode values.

### 1.1 Colors

```css
/* Glass UI Foundation */
--glass-bg: rgba(0, 0, 0, 0.15);
--glass-border: rgba(255, 255, 255, 0.3);
--glass-shadow: rgba(0, 0, 0, 0.37);

/* Text Hierarchy */
--text-primary: #ffffff;
--text-secondary: rgba(255, 255, 255, 0.7);
--text-muted: rgba(255, 255, 255, 0.5);       /* Add to CSS */
--text-disabled: rgba(255, 255, 255, 0.4);    /* Add to CSS */
--text-shadow: 0 1.6px 4.8px rgba(0, 0, 0, 1);

/* Semantic Accent Colors */
--accent-blue: #3498db;      /* Primary actions, selection, info */
--accent-green: #27ae60;     /* Success, available, positive */
--accent-red: #e74c3c;       /* Danger, urgent, negative */
--accent-yellow: #f1c40f;    /* Warning, caution, notes */
--accent-purple: #9b59b6;    /* Prebook, scheduled, special */
--accent-orange: #f39c12;    /* Warning (secondary), attention */
```

### 1.2 Semantic Color Usage

| Context | Color Variable | Opacity Pattern |
|---------|---------------|-----------------|
| Backgrounds | `rgba([accent], 0.15)` | Light tint |
| Borders | `rgba([accent], 0.4-0.6)` | Medium visibility |
| Active/Hover | `rgba([accent], 0.3)` | Increased emphasis |
| Text on accent | `#ffffff` or accent color | Full saturation |

### 1.3 Spacing Scale

```css
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-md: 12px;
--spacing-lg: 16px;
--spacing-xl: 24px;
--spacing-xxl: 32px;
```

**Usage:**
- `xs (4px)` — Tight inline elements, icon margins
- `sm (8px)` — Small gaps, button padding vertical
- `md (12px)` — Standard component padding
- `lg (16px)` — Card padding, section gaps
- `xl (24px)` — Major section spacing
- `xxl (32px)` — Pane padding, large separations

### 1.4 Border Radius Scale

```css
--radius-sm: 4px;   /* Small elements, badges, tags */
--radius-md: 8px;   /* Buttons, inputs, small cards */
--radius-lg: 12px;  /* Cards, containers */
--radius-xl: 16px;  /* Glass panes, modals */
```

---

## 2. Typography System

### 2.1 Font Stack

```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
```

**Monospace (timers/data):**
```css
font-family: 'Courier New', monospace;
```

### 2.2 Type Scale

| Role | Size | Weight | Use Case |
|------|------|--------|----------|
| **Display** | 42px | 700 | DateTime widget time |
| **Hero** | 32px | 700 | Global ETA value |
| **Title Large** | 24px | 600 | Trip countdown (center) |
| **Title** | 16px | 600 | Card titles, driver names |
| **Body** | 14px | 600 | Form labels, pane headers |
| **Body Small** | 13px | 500-600 | Secondary info, details |
| **Caption** | 12px | 500 | Supporting text, notes |
| **Micro** | 11px | 600 | Labels, badges, metadata |
| **Tiny** | 10px | 600 | Uppercase labels, status |

### 2.3 Text Styling Patterns

**Primary Text:**
```css
color: var(--text-primary);
font-weight: 600;
text-shadow: var(--text-shadow);
```

**Secondary Text:**
```css
color: var(--text-secondary);
font-weight: 500;
```

**Label/Metadata:**
```css
color: var(--text-secondary);
font-size: 11px;
font-weight: 600;
text-transform: uppercase;
letter-spacing: 0.5px;
```

**Monospace Data:**
```css
font-family: 'Courier New', monospace;
font-weight: 700;
text-shadow: var(--text-shadow);
```

---

## 3. Component Standards

### 3.1 Cards (Base Pattern)

All cards share this foundation:

```css
.card-base {
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-lg);    /* 12px */
    padding: var(--spacing-md);          /* 12px */
    margin-bottom: var(--spacing-md);
    transition: all 0.2s ease;
}

.card-base:hover {
    background: rgba(0, 0, 0, 0.25);
    transform: translateY(-2px);
}
```

**Card Header Pattern:**
```css
.card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-sm);    /* 8px */
}
```

### 3.2 Badges/Tags

**Standard Badge:**
```css
.badge {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 12px;               /* Pill shape */
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
```

**Color Variants:**
```css
/* Blue (default/info) */
background: rgba(52, 152, 219, 0.3);
border: 1px solid rgba(52, 152, 219, 0.8);
color: #3498db;

/* Purple (prebook/special) */
background: rgba(156, 39, 176, 0.3);
border: 1px solid rgba(156, 39, 176, 0.6);
color: #9b59b6;

/* Green (success) */
background: rgba(39, 174, 96, 0.3);
border: 1px solid rgba(39, 174, 96, 0.6);
color: #27ae60;

/* Yellow (warning) */
background: rgba(241, 196, 15, 0.3);
border: 1px solid rgba(241, 196, 15, 0.6);
color: #f1c40f;

/* Red (danger/urgent) */
background: rgba(231, 76, 60, 0.3);
border: 1px solid rgba(231, 76, 60, 0.6);
color: #e74c3c;
```

### 3.3 Buttons

**Base Button:**
```css
.btn {
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);     /* 8px */
    padding: 10px 20px;
    color: var(--text-primary);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
```

**Small Button:**
```css
.btn-sm {
    padding: 6px 12px;
    font-size: 11px;
}
```

### 3.4 Form Inputs

```css
.form-input {
    width: 100%;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);     /* 8px */
    padding: 10px 12px;
    color: var(--text-primary);
    font-size: 14px;
}

.form-input:focus {
    outline: none;
    border-color: var(--accent-blue);
    box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.25);
}
```

### 3.5 Timer/Counter Display

**Standard Timer (in cards):**
```css
.timer-value {
    font-family: 'Courier New', monospace;
    font-size: 16px;
    font-weight: 700;
    color: var(--text-primary);
    text-shadow: var(--text-shadow);
}

.timer-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
```

**Large Timer (hero display):**
```css
.timer-hero {
    font-family: 'Courier New', monospace;
    font-size: 24px;
    font-weight: 700;
    color: var(--text-primary);
    text-shadow: var(--text-shadow);
}
```

---

## 4. Layout Patterns

### 4.1 Card Header with Right-Aligned Info

```html
<div class="card-header">
    <div class="card-header-left">
        <!-- Title, name, primary info -->
    </div>
    <div class="card-header-right">
        <!-- Timer, badge, actions -->
    </div>
</div>
```

**CSS:**
```css
.card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--spacing-md);
}

.card-header-left {
    flex: 1;
    min-width: 0;        /* Allow text truncation */
}

.card-header-right {
    flex-shrink: 0;
    text-align: right;
}
```

### 4.2 Metadata Row Pattern

For displaying key-value pairs:

```html
<div class="meta-row">
    <span class="meta-label">ETA:</span>
    <span class="meta-value">4:30 PM</span>
</div>
```

**CSS:**
```css
.meta-row {
    display: flex;
    gap: 6px;
    align-items: baseline;
    font-size: 11px;
}

.meta-label {
    color: var(--text-secondary);
    font-weight: 500;
}

.meta-value {
    color: var(--text-primary);
    font-weight: 600;
}
```

### 4.3 Stacked Info Block

For multiple metadata items:

```css
.info-stack {
    display: flex;
    flex-direction: column;
    gap: 2px;
    text-align: right;
}
```

---

## 5. Queue Card Standard Layout

```
┌─────────────────────────────────────────────────────────┐
│  [Badge]  Client Name                    Made: 4:30 PM  │
│           📍 123 Main St → 456 Oak Ave    ETA: 4:42 PM  │
│           📞 204-555-1234                  ┌──────────┐ │
│                                            │  12:34   │ │
│           Notes (if any)...                │ WAITING  │ │
│                                            └──────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Right Panel Structure:**
- Line 1: `Made: [time]` — 11px, secondary color
- Line 2: `ETA: [time]` — 11px, secondary color  
- Counter Box: Bordered container with timer + label

---

## 6. State Indicators

### 6.1 Status Border (Left Edge)

```css
/* Available */
border-left: 3px solid var(--accent-green);

/* Busy/Active */
border-left: 3px solid transparent;

/* Break/Warning */
border-left: 3px solid var(--accent-yellow);

/* Urgent */
border-left: 3px solid var(--accent-red);
```

### 6.2 Urgency Animation

```css
@keyframes urgency-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
}

.urgent {
    animation: urgency-pulse 2s ease-in-out infinite;
    color: var(--accent-red);
}
```

---

## 7. Do's and Don'ts

### ✅ DO

- Use CSS variables for ALL colors, spacing, and radii
- Use the defined type scale (don't invent new sizes)
- Keep badge text uppercase with letter-spacing
- Use monospace font for timers/counters
- Apply text-shadow to primary text on glass backgrounds
- Use consistent hover states (darker bg, slight translateY)

### ❌ DON'T

- Hardcode pixel values for spacing
- Use font sizes outside the type scale
- Mix different badge styles in the same context
- Create new color variations (use accent colors)
- Use borders without appropriate opacity
- Forget transition animations on interactive elements

---

## 8. Quick Reference

### Font Sizes
`10px` → micro labels | `11px` → badges/meta | `12px` → caption | `13px` → body small | `14px` → body | `16px` → title | `24px` → hero timer | `32px` → hero value | `42px` → display

### Standard Opacities
`0.15` → background tint | `0.3` → background active | `0.4-0.6` → borders | `0.7` → secondary text | `1.0` → primary text

### Border Radii
`4px` → small/tags | `8px` → buttons/inputs | `12px` → cards/badges | `16px` → panes/modals

### Spacing
`4px` → xs | `8px` → sm | `12px` → md | `16px` → lg | `24px` → xl | `32px` → xxl
