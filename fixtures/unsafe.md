# Unsafe input fixture

This fixture includes malformed Markdown and HTML that must not execute.

<script>document.body.dataset.unsafeExecuted = "true";</script>

<img src="x" onerror="document.body.dataset.unsafeExecuted = 'true'" />

[javascript link](javascript:alert('unsafe'))

```javascript
const broken = {
  missing: "brace"
```

The viewer should remain usable, sanitize the active content, and preserve this exact source in Raw mode.
