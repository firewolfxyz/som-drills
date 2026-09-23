# Drill catalogue = configuration

The catalogue is **data, not code**. One config entry per drill. Adding a drill
means adding an entry — no new modules, no new UI.

```json
{
  "name": "2 x 1 addition",
  "operator": "add",
  "rows":    { "count": 8, "digits": 2, "signed": false },
  "columns": { "count": 5, "digits": 1 },
  "seconds": 300,
  "answer":  "integer"
}
```

## Fields

| field | meaning |
|---|---|
| `name` | display name, follows `<row digits> x <col digits> <operator>` |
| `operator` | `add` / `subtract` / `multiply` / `divide` |
| `rows.count` / `columns.count` | grid dimensions |
| `rows.digits` / `columns.digits` | exact digit counts for generated headers |
| `rows.signed` | whether row headers may be negative |
| `seconds` | time limit (300 for 40 cells, 600 for 80) |
| `answer` | `integer` or `quotientRemainder` |

`tier` is not a field; if tier filtering is ever needed it is derived from the
entry, not stored separately.

## Validation (loader must fail loudly at load, not at play)

- `rows.digits >= 2` when `rows.count === 10` — 1-digit rows cycle at 9 and would
  repeat inside a 10-row grid.
- `operator !== "divide"` when `rows.signed` is true — no division with negatives.
- `answer === "quotientRemainder"` only for division; `integer` otherwise.
- Cell count must match the declared pace: 40 cells → 300 s, 80 cells → 600 s.
- Generated row magnitudes have exactly `rows.digits` digits; column headers
  exactly `columns.digits` digits and never negative.

## The picker is generated from configs

No hand-maintained menu. The list of drills shown to a student *is* the validated
config set, so adding an entry makes it appear in the picker with no other
change.

## First entry

```json
{ "name": "2 x 1 addition", "operator": "add",
  "rows": { "count": 8, "digits": 2, "signed": false },
  "columns": { "count": 5, "digits": 1 },
  "seconds": 300, "answer": "integer" }
```

Further entries (multiplication, subtraction, division, signed variants, 80-cell
sizes) are authored incrementally as config.
